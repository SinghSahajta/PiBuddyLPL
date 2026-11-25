"""Pydantic schemas and serialization models for PiBuddy.

Supports Pydantic v2 validation and serialization for API requests, responses,
and WebSocket/event payloads.
"""

from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class ZoneStatus(str, Enum):
    """Operational status flags for HVAC zones."""
    NORMAL = "normal"
    WARNING = "warning"
    CRITICAL = "critical"
    OFFLINE = "offline"


class AlertSeverity(str, Enum):
    """Severity classification for alerts."""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class AlertStatus(str, Enum):
    """Lifecycle status of alerts."""
    ACTIVE = "active"
    ACKNOWLEDGED = "acknowledged"
    RESOLVED = "resolved"


class MaintenanceActionType(str, Enum):
    """Types of maintenance interventions."""
    CLEANING = "cleaning"
    INSPECTION = "inspection"
    FILTER_REPLACEMENT = "filter_replacement"
    CALIBRATION = "calibration"


# ---------------------------------------------------------
# Zone Schemas
# ---------------------------------------------------------
class ZoneBase(BaseModel):
    id: str
    name: str
    description: str
    node_id: str
    location: str
    status: ZoneStatus = ZoneStatus.NORMAL


class ZoneCreate(ZoneBase):
    pass


class ZoneSchema(ZoneBase):
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ZoneWithReadingSchema(ZoneSchema):
    latest_reading: Optional[Dict[str, Any]] = None
    active_alerts_count: int = 0


# ---------------------------------------------------------
# Sensor Reading Schemas
# ---------------------------------------------------------
class SensorReadingBase(BaseModel):
    zone_id: str
    pm1_0: float
    pm2_5: float
    pm10: float
    co2: float
    temperature: float
    humidity: float
    air_velocity: float
    differential_pressure: float
    voltage: float
    current: float
    power: float
    energy: float
    frequency: float
    power_factor: float
    is_simulated: bool = True
    scenario: str = "normal"


class SensorReadingCreate(SensorReadingBase):
    timestamp: Optional[datetime] = None


class SensorReadingSchema(SensorReadingBase):
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Alert Schemas
# ---------------------------------------------------------
class AlertBase(BaseModel):
    alert_id: str
    severity: AlertSeverity
    zone_id: str
    parameter: str
    observed_value: float
    baseline_value: float
    unit: str
    title: str
    explanation: str
    action: str
    status: AlertStatus = AlertStatus.ACTIVE


class AlertCreate(AlertBase):
    timestamp: Optional[datetime] = None


class AlertSchema(AlertBase):
    id: int
    timestamp: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class AlertAcknowledge(BaseModel):
    notes: Optional[str] = None


class AlertResolve(BaseModel):
    resolution_notes: Optional[str] = None


# ---------------------------------------------------------
# Maintenance Schemas
# ---------------------------------------------------------
class MaintenanceRecordBase(BaseModel):
    zone_id: str
    action_type: MaintenanceActionType
    description: str
    performed_by: str
    notes: str
    before_pm25: Optional[float] = None
    after_pm25: Optional[float] = None
    before_velocity: Optional[float] = None
    after_velocity: Optional[float] = None


class MaintenanceRecordCreate(BaseModel):
    zone_id: str
    action_type: MaintenanceActionType
    description: str
    performed_by: str
    notes: str = ""
    before_pm25: Optional[float] = None
    after_pm25: Optional[float] = None
    before_velocity: Optional[float] = None
    after_velocity: Optional[float] = None


class MaintenanceRecordSchema(MaintenanceRecordBase):
    id: int
    record_id: str
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Model Info & Prediction Schemas
# ---------------------------------------------------------
class ModelInfoSchema(BaseModel):
    id: int
    model_type: str
    trained_at: Optional[datetime] = None
    training_samples: int
    validation_accuracy: float
    precision_score: float
    recall_score: float
    f1_score: float
    anomaly_threshold: float
    is_trained: bool
    notes: str
    model_config = ConfigDict(from_attributes=True)


class AnomalyPredictionSchema(BaseModel):
    id: int
    timestamp: datetime
    zone_id: str
    anomaly_score: float
    is_anomaly: bool
    suspected_zone: str
    condition: str
    explanation: str
    contributing_sensors: str
    model_type: str
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------
# Simulation Control Schemas
# ---------------------------------------------------------
class SimulationScenarioSchema(BaseModel):
    scenario: str = Field(..., description="Scenario identifier, e.g., dust_increase, velocity_drop")
    zone_id: Optional[str] = Field(None, description="Affected zone identifier (zone_a, zone_b, zone_c)")
    speed_multiplier: Optional[float] = Field(1.0, ge=0.1, le=10.0, description="Simulation speed factor")


class SimulationStatusSchema(BaseModel):
    is_running: bool
    scenario: str
    affected_zone: Optional[str] = None
    tick_count: int
    speed_multiplier: float
    active_scenario_progress: float = 0.0


# ---------------------------------------------------------
# Configuration Schemas
# ---------------------------------------------------------
class ConfigurationSchema(BaseModel):
    app_name: str = "PiBuddy"
    version: str = "1.0.0"
    simulation_interval: float = 3.0
    pm25_warning: float = 35.0
    pm25_critical: float = 65.0
    co2_warning: float = 800.0
    co2_critical: float = 1200.0
    velocity_warning_low: float = 0.8
    velocity_critical_low: float = 0.4
    pressure_warning: float = 50.0
    pressure_critical: float = 80.0
    power_warning: float = 1500.0
    power_critical: float = 2000.0


# ---------------------------------------------------------
# Dashboard Summary Schema
# ---------------------------------------------------------
class DashboardSummarySchema(BaseModel):
    system_health: str = Field(..., description="Overall health: optimal, warning, critical")
    total_zones: int = 3
    online_nodes: int
    offline_nodes: int
    active_alerts: int
    maintenance_due: int
    avg_pm25: float
    avg_co2: float
    avg_velocity: float
    avg_pressure: float
    total_power: float
    zone_summaries: List[Dict[str, Any]]
    recent_alerts: List[AlertSchema]
    recent_activity: List[Dict[str, Any]]
    simulation_status: Dict[str, Any]


class ModelTrainResponse(BaseModel):
    status: str
    message: str
    metrics: Dict[str, Any]
