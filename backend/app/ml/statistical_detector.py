"""Statistical Baseline Anomaly Detector for PiBuddy.

Computes parameter-wise Gaussian Z-Scores and deviation indices against historical
baselines to identify sudden sensor spikes and out-of-distribution drifts.
"""

from typing import Dict, Any, List, Optional
import numpy as np


class StatisticalDetector:
    """Z-Score anomaly detection benchmark comparing current telemetry against baseline distributions."""

    MONITORED_PARAMS = [
        "pm2_5",
        "co2",
        "temperature",
        "humidity",
        "air_velocity",
        "differential_pressure",
        "power",
    ]

    def __init__(self) -> None:
        self.baselines: Dict[str, Dict[str, Dict[str, float]]] = {}
        self.thresholds: Dict[str, Dict[str, Dict[str, float]]] = {}
        self._initialize_default_baselines()

    def _initialize_default_baselines(self) -> None:
        """Seed empirical nominal means and standard deviations per zone."""
        self.baselines = {
            "zone_a": {
                "pm2_5": {"mean": 12.0, "std": 1.2},
                "co2": {"mean": 420.0, "std": 20.0},
                "temperature": {"mean": 22.5, "std": 0.6},
                "humidity": {"mean": 45.0, "std": 1.5},
                "air_velocity": {"mean": 3.2, "std": 0.15},
                "differential_pressure": {"mean": 15.0, "std": 1.2},
                "power": {"mean": 950.0, "std": 30.0},
            },
            "zone_b": {
                "pm2_5": {"mean": 15.0, "std": 1.5},
                "co2": {"mean": 480.0, "std": 22.0},
                "temperature": {"mean": 23.0, "std": 0.6},
                "humidity": {"mean": 47.0, "std": 1.5},
                "air_velocity": {"mean": 2.1, "std": 0.12},
                "differential_pressure": {"mean": 22.0, "std": 1.4},
                "power": {"mean": 630.0, "std": 25.0},
            },
            "zone_c": {
                "pm2_5": {"mean": 18.0, "std": 1.8},
                "co2": {"mean": 510.0, "std": 25.0},
                "temperature": {"mean": 23.5, "std": 0.7},
                "humidity": {"mean": 49.0, "std": 1.6},
                "air_velocity": {"mean": 1.6, "std": 0.10},
                "differential_pressure": {"mean": 28.0, "std": 1.6},
                "power": {"mean": 475.0, "std": 20.0},
            },
        }

    def set_baselines(self, zone_readings_history: Dict[str, List[Dict[str, Any]]]) -> None:
        """Recalculate dynamic empirical baseline statistics from historical readings.

        Args:
            zone_readings_history: Dictionary mapping zone_id to list of reading dictionaries.
        """
        for zone_id, readings in zone_readings_history.items():
            if not readings or len(readings) < 10:
                continue

            zone_stats: Dict[str, Dict[str, float]] = {}
            for param in self.MONITORED_PARAMS:
                values = [float(r[param]) for r in readings if param in r and r[param] is not None]
                if values:
                    mean_val = float(np.mean(values))
                    std_val = float(np.std(values))
                    # Prevent zero division
                    std_val = max(std_val, mean_val * 0.01, 0.01)
                    zone_stats[param] = {"mean": round(mean_val, 3), "std": round(std_val, 3)}
            if zone_stats:
                self.baselines[zone_id] = zone_stats

    def detect(self, zone_id: str, reading: Dict[str, Any]) -> Dict[str, Any]:
        """Compute parameter-level Z-Scores and determine statistical anomaly status.

        Args:
            zone_id: Identifier of the zone being evaluated.
            reading: Current sensor reading dictionary.

        Returns:
            Dict containing overall_score, parameter_scores, is_anomaly, and flagged_params.
        """
        zone_baseline = self.baselines.get(zone_id, self.baselines.get("zone_a", {}))
        parameter_scores: Dict[str, float] = {}
        flagged_params: List[Dict[str, Any]] = []
        z_values: List[float] = []

        for param in self.MONITORED_PARAMS:
            if param not in reading or param not in zone_baseline:
                continue

            val = float(reading[param])
            stats = zone_baseline[param]
            mean = stats["mean"]
            std = max(stats["std"], 0.01)

            # Compute standardized score
            z = abs(val - mean) / std
            parameter_scores[param] = round(z, 2)
            z_values.append(z)

            # Check significance thresholds
            if z >= 3.0:
                flagged_params.append({
                    "param": param,
                    "z_score": round(z, 2),
                    "severity": "critical",
                    "observed": val,
                    "baseline_mean": mean,
                })
            elif z >= 2.0:
                flagged_params.append({
                    "param": param,
                    "z_score": round(z, 2),
                    "severity": "warning",
                    "observed": val,
                    "baseline_mean": mean,
                })

        overall_score = round(float(np.mean(z_values)), 2) if z_values else 0.0
        max_score = round(float(np.max(z_values)), 2) if z_values else 0.0
        is_anomaly = bool(overall_score >= 2.5 or max_score >= 3.5 or len(flagged_params) >= 2)

        return {
            "overall_score": overall_score,
            "max_z_score": max_score,
            "parameter_scores": parameter_scores,
            "is_anomaly": is_anomaly,
            "flagged_params": flagged_params,
        }
