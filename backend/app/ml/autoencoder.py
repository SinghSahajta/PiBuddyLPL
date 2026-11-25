"""PyTorch LSTM Autoencoder for Multivariate Time-Series Anomaly Detection.

Learns normal HVAC temporal dynamics and detects anomalies through sequence reconstruction
errors across particulate, environmental, airflow, and power sensors.
"""

import os
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset


class LSTMAutoencoder(nn.Module):
    """LSTM-based deep autoencoder for temporal sequence reconstruction."""

    def __init__(
        self,
        input_size: int = 9,
        hidden_size: int = 32,
        num_layers: int = 2,
        sequence_length: int = 20,
    ) -> None:
        super().__init__()
        self.sequence_length = sequence_length
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers

        # Encoder LSTM
        self.encoder = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
        )

        # Bottleneck latent space representation
        self.bottleneck = nn.Linear(hidden_size, 16)

        # Decoder input projection
        self.decoder_input = nn.Linear(16, hidden_size)

        # Decoder LSTM
        self.decoder = nn.LSTM(
            input_size=hidden_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
        )

        # Output projection back to feature dimension
        self.output_layer = nn.Linear(hidden_size, input_size)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass through encoder, bottleneck, and decoder."""
        # x: (batch_size, seq_len, input_size)
        _, (h_n, _) = self.encoder(x)
        # Extract last layer hidden state: (batch_size, hidden_size)
        bottleneck = self.bottleneck(h_n[-1])

        # Project to decoder representation and repeat across sequence length
        decoder_in = self.decoder_input(bottleneck).unsqueeze(1)  # (batch_size, 1, hidden_size)
        decoder_in = decoder_in.repeat(1, x.shape[1], 1)  # (batch_size, seq_len, hidden_size)

        decoded, _ = self.decoder(decoder_in)
        output = self.output_layer(decoded)  # (batch_size, seq_len, input_size)
        return output


class AnomalyDetector:
    """End-to-end anomaly detector utilizing LSTM autoencoder and reconstruction error scoring."""

    FEATURES: List[str] = [
        "pm2_5",
        "co2",
        "temperature",
        "humidity",
        "air_velocity",
        "differential_pressure",
        "power",
        "frequency",
        "power_factor",
    ]

    def __init__(self, sequence_length: int = 20) -> None:
        self.sequence_length: int = sequence_length
        self.model: LSTMAutoencoder = LSTMAutoencoder(
            input_size=len(self.FEATURES),
            hidden_size=32,
            num_layers=2,
            sequence_length=sequence_length,
        )
        self.scaler: Optional[StandardScaler] = None
        self.threshold: float = 0.048  # Nominal fallback threshold
        self.is_trained: bool = False
        self.training_metrics: Dict[str, Any] = {}
        self.device: torch.device = torch.device("cpu")
        self.model.to(self.device)

    def _create_sequences(self, data: np.ndarray) -> np.ndarray:
        """Convert 2D array into sliding window sequence tensors."""
        sequences = []
        if len(data) < self.sequence_length:
            # Pad with first element if too short
            pad_size = self.sequence_length - len(data)
            padding = np.repeat(data[:1], pad_size, axis=0)
            padded = np.vstack([padding, data])
            sequences.append(padded)
        else:
            for i in range(len(data) - self.sequence_length + 1):
                sequences.append(data[i : i + self.sequence_length])
        return np.array(sequences, dtype=np.float32)

    def train(
        self,
        normal_data: pd.DataFrame,
        epochs: int = 40,
        lr: float = 0.001,
        batch_size: int = 32,
    ) -> Dict[str, Any]:
        """Train autoencoder on nominal baseline HVAC sensor readings."""
        # 1. Prepare and scale features
        feature_data = normal_data[self.FEATURES].copy().dropna()
        self.scaler = StandardScaler()
        scaled_data = self.scaler.fit_transform(feature_data)

        # 2. Create sliding windows per zone (never across zone boundaries)
        if "zone_id" in normal_data.columns:
            zones = normal_data.loc[feature_data.index, "zone_id"].values
            parts = [self._create_sequences(scaled_data[zones == z]) for z in np.unique(zones)]
            sequences = np.concatenate([p for p in parts if len(p)])
        else:
            sequences = self._create_sequences(scaled_data)
        if len(sequences) == 0:
            raise ValueError("Insufficient data to form sequence windows.")

        # 3. Random 80/20 train/validation split so every zone appears in both
        sequences = sequences[np.random.RandomState(0).permutation(len(sequences))]
        split_idx = int(0.8 * len(sequences))
        train_seqs = sequences[:split_idx]
        val_seqs = sequences[split_idx:] if split_idx < len(sequences) else sequences

        train_tensor = torch.tensor(train_seqs, dtype=torch.float32)
        val_tensor = torch.tensor(val_seqs, dtype=torch.float32)

        train_loader = DataLoader(
            TensorDataset(train_tensor, train_tensor),
            batch_size=min(batch_size, len(train_tensor)),
            shuffle=True,
        )

        # 4. Optimization setup
        optimizer = torch.optim.Adam(self.model.parameters(), lr=lr, weight_decay=1e-5)
        criterion = nn.MSELoss()

        self.model.train()
        train_losses = []
        for epoch in range(epochs):
            batch_losses = []
            for batch_x, _ in train_loader:
                batch_x = batch_x.to(self.device)
                optimizer.zero_grad()
                reconstructed = self.model(batch_x)
                loss = criterion(reconstructed, batch_x)
                loss.backward()
                torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
                optimizer.step()
                batch_losses.append(loss.item())
            train_losses.append(float(np.mean(batch_losses)))

        # 5. Evaluate on validation set and determine reconstruction threshold
        self.model.eval()
        with torch.no_grad():
            val_in = val_tensor.to(self.device)
            val_out = self.model(val_in)
            # MSE per sample across sequence and features
            val_errors = torch.mean((val_in - val_out) ** 2, dim=[1, 2]).cpu().numpy()

        val_mean = float(np.mean(val_errors))
        val_std = float(np.std(val_errors))
        # Threshold: 25% above the worst normal validation window, so normal data from any zone stays below it
        self.threshold = round(max(val_mean + 2.5 * val_std, float(np.max(val_errors)) * 1.25), 4)
        self.is_trained = True

        self.training_metrics = {
            "training_samples": len(feature_data),
            "final_train_loss": round(train_losses[-1], 5),
            "val_reconstruction_mean": round(val_mean, 5),
            "val_reconstruction_std": round(val_std, 5),
            "anomaly_threshold": self.threshold,
            "epochs": epochs,
        }
        return self.training_metrics

    def evaluate(self, df: pd.DataFrame) -> Dict[str, float]:
        """Measure window-level anomaly detection on a labelled dataset (is_anomaly column)."""
        preds, labels = [], []
        L = self.sequence_length
        self.model.eval()
        for _, g in df.sort_values("timestamp").groupby(["zone_id", "scenario"]):
            if len(g) < L:
                continue
            seqs = self._create_sequences(self.scaler.transform(g[self.FEATURES]))[::5]
            y = g["is_anomaly"].values[L - 1:][::5][: len(seqs)]
            with torch.no_grad():
                t = torch.tensor(seqs, dtype=torch.float32)
                err = torch.mean((t - self.model(t)) ** 2, dim=[1, 2]).numpy()
            preds.extend((err > self.threshold).tolist())
            labels.extend(y.astype(bool).tolist())
        p, y = np.array(preds), np.array(labels)
        tp, fp, fn = int((p & y).sum()), int((p & ~y).sum()), int((~p & y).sum())
        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        return {
            "accuracy": float((p == y).mean()),
            "precision": precision,
            "recall": recall,
            "f1_score": 2 * precision * recall / max(precision + recall, 1e-9),
            "windows": int(len(y)),
        }

    def predict(self, readings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Infer anomaly score and identify contributing sensor parameters.

        Args:
            readings: List of recent sensor reading dictionaries for one zone.

        Returns:
            Dict containing anomaly_score, is_anomaly, reconstruction_error, and contributing_sensors.
        """
        if not readings:
            return {
                "anomaly_score": 0.0,
                "is_anomaly": False,
                "reconstruction_error": 0.0,
                "threshold": self.threshold,
                "contributing_sensors": [],
            }

        # Extract feature matrix
        matrix = []
        for r in readings:
            row = [float(r.get(f, 0.0)) for f in self.FEATURES]
            matrix.append(row)
        arr = np.array(matrix, dtype=np.float32)

        # Scale features
        if self.scaler is not None:
            scaled = self.scaler.transform(arr)
        else:
            scaled = arr

        # Sequence creation
        seq = self._create_sequences(scaled)
        # Take the most recent sequence window
        target_seq = torch.tensor(seq[-1:], dtype=torch.float32).to(self.device)

        self.model.eval()
        with torch.no_grad():
            reconstructed = self.model(target_seq)
            # Sample reconstruction loss
            diff = (target_seq - reconstructed).squeeze(0)  # (seq_len, input_size)
            sample_mse = torch.mean(diff ** 2).item()
            feature_errors = torch.mean(diff ** 2, dim=0).cpu().numpy()

        # Score normalized relative to threshold (1.0 = threshold boundary)
        score = round(sample_mse / max(self.threshold, 1e-4), 3)
        is_anomaly = sample_mse > self.threshold

        # Rank contributing sensors
        ranked_indices = np.argsort(feature_errors)[::-1]
        contributing = [
            {
                "sensor": self.FEATURES[idx],
                "error": round(float(feature_errors[idx]), 4),
            }
            for idx in ranked_indices[:4]
            if feature_errors[idx] > 0.01
        ]

        return {
            "anomaly_score": score,
            "is_anomaly": is_anomaly,
            "reconstruction_error": round(sample_mse, 4),
            "threshold": self.threshold,
            "contributing_sensors": contributing,
        }

    def save(self, path: str = "models/autoencoder.pt") -> None:
        """Persist autoencoder weights and preprocessing scaler to disk."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        checkpoint = {
            "model_state_dict": self.model.state_dict(),
            "scaler": self.scaler,
            "threshold": self.threshold,
            "is_trained": self.is_trained,
            "training_metrics": self.training_metrics,
            "sequence_length": self.sequence_length,
        }
        torch.save(checkpoint, path)

    def load(self, path: str = "models/autoencoder.pt") -> bool:
        """Load autoencoder weights and state from disk if available."""
        if not os.path.exists(path):
            return False
        try:
            # weights_only=False: the checkpoint also holds a pickled sklearn scaler (our own file)
            checkpoint = torch.load(path, map_location=self.device, weights_only=False)
            self.model.load_state_dict(checkpoint["model_state_dict"])
            self.scaler = checkpoint.get("scaler")
            self.threshold = checkpoint.get("threshold", 0.048)
            self.is_trained = checkpoint.get("is_trained", True)
            self.training_metrics = checkpoint.get("training_metrics", {})
            self.sequence_length = checkpoint.get("sequence_length", 20)
            self.model.eval()
            return True
        except Exception:
            import logging
            logging.getLogger(__name__).exception("Failed to load autoencoder checkpoint %s", path)
            return False
