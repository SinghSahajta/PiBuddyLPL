"""Application Singletons and Shared Dependency Container.

Instantiates persistent instances of the physical simulation engine,
PyTorch LSTM autoencoder anomaly detector, Random Forest zone classifier,
and statistical threshold engine.

Note: PyTorch (torch) is an optional dependency. If not installed,
the anomaly detector will operate in a lightweight fallback mode
using reconstruction-error heuristics instead of the LSTM autoencoder.
"""

import os
import logging
from app.simulation.engine import SimulationEngine
from app.ml.statistical_detector import StatisticalDetector

logger = logging.getLogger(__name__)

# 1. Physical Simulation Engine Singleton
simulation_engine: SimulationEngine = SimulationEngine()

# 2. LSTM Autoencoder Anomaly Detector Singleton (optional — requires torch)
anomaly_detector = None
try:
    from app.ml.autoencoder import AnomalyDetector
    anomaly_detector = AnomalyDetector(sequence_length=20)
    autoencoder_weights_path = os.path.join("models", "autoencoder.pt")
    if os.path.exists(autoencoder_weights_path):
        anomaly_detector.load(autoencoder_weights_path)
    logger.info("LSTM Autoencoder anomaly detector initialized.")
except ImportError:
    logger.warning(
        "PyTorch not installed — LSTM autoencoder disabled. "
        "Install torch to enable deep-learning anomaly detection."
    )

# 3. Random Forest Zone Fault Classifier Singleton
zone_classifier = None
try:
    from app.ml.zone_classifier import ZoneClassifier
    zone_classifier = ZoneClassifier()
    classifier_path = os.path.join("models", "zone_classifier.pkl")
    if os.path.exists(classifier_path):
        zone_classifier.load(classifier_path)
    logger.info("Zone fault classifier initialized.")
except ImportError:
    logger.warning(
        "scikit-learn not available — zone classifier disabled."
    )

# 4. Statistical Detector Singleton (always available — uses only numpy)
statistical_detector: StatisticalDetector = StatisticalDetector()
