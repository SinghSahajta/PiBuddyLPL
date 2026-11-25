"""SQLAlchemy ORM database models for PiBuddy.

Defines schemas for HVAC zones, sensor readings across all hardware probes,
operational alerts, maintenance logs, ML model metadata, and anomaly predictions.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    Index,
)
from sqlalchemy.orm import relationship

from app.core.database import Base


def utc_now() -> datetime:
    """Return current UTC datetime."""
    return datetime.now(timezone.utc)


class Zone(Base):
    """HVAC zone representation and hardware node association."""

    __tablename__ = "zones"

    id = Column(String(50), primary_key=True, index=True)  # e.g., "zone_a"
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=False)
    node_id = Column(String(50), nullable=False)  # e.g., "NODE-A01"
    location = Column(String(150), nullable=False)
    status = Column(String(20), default="normal", nullable=False)  # normal/warning/critical/offline
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Relationships
    readings = relationship("SensorReading", back_populates="zone", cascade="all, delete-orphan")


class SensorReading(Base):
    """Time-series sensor telemetry reading from a physical or simulated node."""

    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    zone_id = Column(String(50), ForeignKey("zones.id"), nullable=False, index=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)

    # PMS7003 Particulate Matter (ug/m3)
    pm1_0 = Column(Float, nullable=False)
    pm2_5 = Column(Float, nullable=False)
    pm10 = Column(Float, nullable=False)

    # SCD40 Environmental
    co2 = Column(Float, nullable=False)  # ppm
    temperature = Column(Float, nullable=False)  # Celsius
    humidity = Column(Float, nullable=False)  # % RH

    # FS3000 Air Velocity
    air_velocity = Column(Float, nullable=False)  # m/s

    # MPXV7002DP Differential Pressure
    differential_pressure = Column(Float, nullable=False)  # Pa

    # PZEM-004T Electrical Telemetry
    voltage = Column(Float, nullable=False)  # Volts
    current = Column(Float, nullable=False)  # Amperes
    power = Column(Float, nullable=False)  # Watts
    energy = Column(Float, nullable=False)  # kWh
    frequency = Column(Float, nullable=False)  # Hz
    power_factor = Column(Float, nullable=False)  # unitless (0.0 - 1.0)

    # Metadata
    is_simulated = Column(Boolean, default=True, nullable=False)
    scenario = Column(String(50), default="normal", nullable=False)

    # Relationship
    zone = relationship("Zone", back_populates="readings")

    __table_args__ = (
        Index("idx_zone_timestamp", "zone_id", "timestamp"),
    )


class Alert(Base):
    """System-generated alert representing an anomalous parameter condition."""

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    alert_id = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "ALT-001"
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)
    severity = Column(String(20), nullable=False)  # info/warning/critical
    zone_id = Column(String(50), nullable=False, index=True)
    parameter = Column(String(50), nullable=False)  # e.g. "pm2_5", "air_velocity"
    observed_value = Column(Float, nullable=False)
    baseline_value = Column(Float, nullable=False)
    unit = Column(String(20), nullable=False)
    title = Column(String(150), nullable=False)
    explanation = Column(Text, nullable=False)
    action = Column(Text, nullable=False)
    status = Column(String(20), default="active", nullable=False, index=True)  # active/acknowledged/resolved
    acknowledged_at = Column(DateTime, nullable=True)
    resolved_at = Column(DateTime, nullable=True)


class MaintenanceRecord(Base):
    """Log entry documenting inspection, cleaning, filter changes, or calibration."""

    __tablename__ = "maintenance_records"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    record_id = Column(String(50), unique=True, index=True, nullable=False)  # e.g., "MNT-001"
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)
    zone_id = Column(String(50), nullable=False, index=True)
    action_type = Column(String(50), nullable=False)  # cleaning/inspection/filter_replacement/calibration
    description = Column(Text, nullable=False)
    performed_by = Column(String(100), nullable=False)
    notes = Column(Text, nullable=False)
    before_pm25 = Column(Float, nullable=True)
    after_pm25 = Column(Float, nullable=True)
    before_velocity = Column(Float, nullable=True)
    after_velocity = Column(Float, nullable=True)


class ModelInfo(Base):
    """Metadata tracking trained Machine Learning models and validation performance."""

    __tablename__ = "model_info"

    id = Column(Integer, primary_key=True, autoincrement=True)
    model_type = Column(String(50), nullable=False, unique=True)  # e.g., "LSTM_Autoencoder"
    trained_at = Column(DateTime, nullable=True)
    training_samples = Column(Integer, default=0, nullable=False)
    validation_accuracy = Column(Float, default=0.0, nullable=False)
    precision_score = Column(Float, default=0.0, nullable=False)
    recall_score = Column(Float, default=0.0, nullable=False)
    f1_score = Column(Float, default=0.0, nullable=False)
    anomaly_threshold = Column(Float, default=0.0, nullable=False)
    is_trained = Column(Boolean, default=False, nullable=False)
    notes = Column(Text, default="", nullable=False)


class AnomalyPrediction(Base):
    """Real-time machine learning inference prediction log."""

    __tablename__ = "anomaly_predictions"

    id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)
    zone_id = Column(String(50), nullable=False, index=True)
    anomaly_score = Column(Float, nullable=False)
    is_anomaly = Column(Boolean, default=False, nullable=False)
    suspected_zone = Column(String(50), nullable=False)
    condition = Column(String(100), nullable=False)
    explanation = Column(Text, nullable=False)
    contributing_sensors = Column(Text, nullable=False)  # JSON serialized string
    model_type = Column(String(50), nullable=False)
