"""Random Forest Classifier for HVAC Fault Localization.

Classifies root-cause fault locations across Zone A, Zone B, Zone C, or Normal state
by analyzing cross-zone differential pressure, airflow velocity ratios, and particulate gradients.
"""

import os
import pickle
from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support


class ZoneClassifier:
    """Multi-class fault localization model isolating anomalous duct zones."""

    CLASSES: List[str] = ["normal", "zone_a", "zone_b", "zone_c", "unknown"]

    def __init__(self) -> None:
        self.model: RandomForestClassifier = RandomForestClassifier(
            n_estimators=100,
            max_depth=12,
            random_state=42,
            class_weight="balanced",
        )
        self.scaler: StandardScaler = StandardScaler()
        self.is_trained: bool = False
        self.metrics: Dict[str, Any] = {}

    def _extract_features(self, zone_readings: Dict[str, Dict[str, Any]]) -> np.ndarray:
        """Extract multi-sensor cross-zone relational features.

        Calculates inter-duct velocity ratios, differential pressure gradients,
        and particulate distribution ratios to reliably isolate duct faults.
        """
        za = zone_readings.get("zone_a", {})
        zb = zone_readings.get("zone_b", {})
        zc = zone_readings.get("zone_c", {})

        # Absolute parameter values
        vel_a = float(za.get("air_velocity", 3.2))
        vel_b = float(zb.get("air_velocity", 2.1))
        vel_c = float(zc.get("air_velocity", 1.6))

        dp_a = float(za.get("differential_pressure", 15.0))
        dp_b = float(zb.get("differential_pressure", 22.0))
        dp_c = float(zc.get("differential_pressure", 28.0))

        pm_a = float(za.get("pm2_5", 12.0))
        pm_b = float(zb.get("pm2_5", 15.0))
        pm_c = float(zc.get("pm2_5", 18.0))

        pwr_a = float(za.get("power", 950.0))
        pwr_b = float(zb.get("power", 630.0))
        pwr_c = float(zc.get("power", 475.0))

        # Cross-zone relational ratios & differentials
        ratio_vel_ab = vel_a / max(vel_b, 0.05)
        ratio_vel_bc = vel_b / max(vel_c, 0.05)
        ratio_vel_ac = vel_a / max(vel_c, 0.05)

        diff_dp_ab = dp_a - dp_b
        diff_dp_bc = dp_b - dp_c
        diff_dp_ac = dp_a - dp_c

        ratio_pm_ab = pm_a / max(pm_b, 0.1)
        ratio_pm_bc = pm_b / max(pm_c, 0.1)
        ratio_pm_ac = pm_a / max(pm_c, 0.1)

        total_power = pwr_a + pwr_b + pwr_c

        features = [
            vel_a, vel_b, vel_c,
            dp_a, dp_b, dp_c,
            pm_a, pm_b, pm_c,
            pwr_a, pwr_b, pwr_c,
            ratio_vel_ab, ratio_vel_bc, ratio_vel_ac,
            diff_dp_ab, diff_dp_bc, diff_dp_ac,
            ratio_pm_ab, ratio_pm_bc, ratio_pm_ac,
            total_power,
        ]
        return np.array(features, dtype=np.float32)

    def train(self, dataset: pd.DataFrame) -> Dict[str, Any]:
        """Train classifier using cross-zone relational features from synthetic dataset."""
        # Pivot dataset by timestamp so each sample includes all zones
        timestamps = dataset["timestamp"].unique()
        x_rows = []
        y_labels = []

        for ts in timestamps:
            subset = dataset[dataset["timestamp"] == ts]
            if len(subset) < 3:
                continue

            zone_dict = {}
            fault = "normal"
            for _, row in subset.iterrows():
                zid = row["zone_id"]
                zone_dict[zid] = row.to_dict()
                if row.get("fault_zone") in ["zone_a", "zone_b", "zone_c"]:
                    fault = row["fault_zone"]
                elif row.get("fault_zone") == "all":
                    fault = "zone_a"  # Systemic treated with primary duct focus
                elif row.get("fault_zone") == "none":
                    fault = "normal"

            feat = self._extract_features(zone_dict)
            x_rows.append(feat)
            y_labels.append(fault)

        if not x_rows:
            raise ValueError("No complete multi-zone timestamp instances found.")

        x_arr = np.array(x_rows)
        y_arr = np.array(y_labels)

        # Scale features
        x_scaled = self.scaler.fit_transform(x_arr)

        x_train, x_val, y_train, y_val = train_test_split(
            x_scaled, y_arr, test_size=0.2, random_state=42, stratify=y_arr
        )

        self.model.fit(x_train, y_train)
        y_pred = self.model.predict(x_val)

        acc = float(accuracy_score(y_val, y_pred))
        prec, rec, f1, _ = precision_recall_fscore_support(
            y_val, y_pred, average="weighted", zero_division=0
        )

        self.is_trained = True
        self.metrics = {
            "accuracy": round(acc, 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1_score": round(float(f1), 4),
            "samples": len(x_rows),
            "report": classification_report(y_val, y_pred, zero_division=0, output_dict=True),
        }
        return self.metrics

    def predict(self, zone_readings: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
        """Classify fault location from current multi-zone sensor readings."""
        feat = self._extract_features(zone_readings).reshape(1, -1)
        if self.is_trained:
            feat_scaled = self.scaler.transform(feat)
            pred_class = str(self.model.predict(feat_scaled)[0])
            probs = self.model.predict_proba(feat_scaled)[0]
            classes = self.model.classes_
            prob_dict = {str(c): round(float(p), 3) for c, p in zip(classes, probs)}
            confidence = round(float(np.max(probs)), 3)
        else:
            # Heuristic fallback if model not yet fitted
            za = zone_readings.get("zone_a", {})
            zb = zone_readings.get("zone_b", {})
            zc = zone_readings.get("zone_c", {})

            dp_a = za.get("differential_pressure", 15.0)
            dp_b = zb.get("differential_pressure", 22.0)
            dp_c = zc.get("differential_pressure", 28.0)

            if dp_a > 45:
                pred_class = "zone_a"
                confidence = 0.85
            elif dp_b > 45:
                pred_class = "zone_b"
                confidence = 0.85
            elif dp_c > 50:
                pred_class = "zone_c"
                confidence = 0.85
            else:
                pred_class = "normal"
                confidence = 0.95

            prob_dict = {
                "normal": 0.95 if pred_class == "normal" else 0.05,
                pred_class: confidence,
            }

        return {
            "predicted_zone": pred_class,
            "confidence": confidence,
            "probabilities": prob_dict,
        }

    def save(self, path: str = "models/zone_classifier.pkl") -> None:
        """Serialize trained model and feature scaler to disk."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        bundle = {
            "model": self.model,
            "scaler": self.scaler,
            "is_trained": self.is_trained,
            "metrics": self.metrics,
        }
        with open(path, "wb") as f:
            pickle.dump(bundle, f)

    def load(self, path: str = "models/zone_classifier.pkl") -> bool:
        """Load trained model from disk."""
        if not os.path.exists(path):
            return False
        try:
            with open(path, "rb") as f:
                bundle = pickle.load(f)
            self.model = bundle["model"]
            self.scaler = bundle["scaler"]
            self.is_trained = bundle.get("is_trained", True)
            self.metrics = bundle.get("metrics", {})
            return True
        except Exception:
            return False
