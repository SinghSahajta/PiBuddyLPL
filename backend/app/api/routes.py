"""FastAPI REST API Route Handlers for PiBuddy.

Provides endpoints for HVAC telemetry, real-time dashboards, historical queries,
predictive anomaly analysis, alert handling, maintenance ticketing, and simulation control.
"""

from datetime import datetime, timedelta, timezone
import json
import io
import csv
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.core.database import get_db
from app.core.config import settings
from app.core.dependencies import (
    simulation_engine,
    anomaly_detector,
    zone_classifier,
    statistical_detector,
    reload_models,
)
from app.models.db_models import (
    Zone,
    SensorReading,
    Alert,
    MaintenanceRecord,
    ModelInfo,
    AnomalyPrediction,
)
from app.models.schemas import (
    DashboardSummarySchema,
    ZoneSchema,
    ZoneWithReadingSchema,
    SensorReadingSchema,
    AlertSchema,
    AlertAcknowledge,
    AlertResolve,
    MaintenanceRecordSchema,
    MaintenanceRecordCreate,
    ModelInfoSchema,
    AnomalyPredictionSchema,
    SimulationScenarioSchema,
    SimulationStatusSchema,
    ConfigurationSchema,
    ModelTrainResponse,
)


def _get_training_pipeline():
    """Lazy import to avoid hard torch dependency at module load time."""
    try:
        from app.ml.train import run_training_pipeline
        return run_training_pipeline
    except ImportError:
        return None

router = APIRouter(prefix="", tags=["PiBuddy API"])


# ---------------------------------------------------------
# Dashboard Summary
# ---------------------------------------------------------
@router.get("/dashboard", response_model=DashboardSummarySchema)
def get_dashboard_summary(db: Session = Depends(get_db)) -> DashboardSummarySchema:
    """Return aggregated high-level KPIs, zone overviews, alerts, and system health status."""
    zones = db.query(Zone).all()
    total_zones = len(zones)
    online_nodes = sum(1 for z in zones if z.status != "offline")
    offline_nodes = total_zones - online_nodes

    # Active alerts
    active_alerts_list = (
        db.query(Alert)
        .filter(Alert.status == "active")
        .order_by(desc(Alert.timestamp))
        .all()
    )
    active_alerts_count = len(active_alerts_list)

    # Determine overall system health
    has_critical = any(a.severity == "critical" for a in active_alerts_list)
    has_warning = any(a.severity == "warning" for a in active_alerts_list)
    if has_critical or offline_nodes > 0:
        system_health = "critical"
    elif has_warning:
        system_health = "warning"
    else:
        system_health = "optimal"

    # Maintenance due count (zones with active warning or critical alerts or low airflow)
    maintenance_due = sum(1 for z in zones if z.status in ["warning", "critical"])

    # Aggregate telemetry across latest readings in memory
    curr = simulation_engine.current_readings
    pm25_vals = [r.get("pm2_5", 0.0) for r in curr.values() if r.get("pm2_5") is not None]
    co2_vals = [r.get("co2", 0.0) for r in curr.values() if r.get("co2") is not None]
    vel_vals = [r.get("air_velocity", 0.0) for r in curr.values() if r.get("air_velocity") is not None]
    dp_vals = [r.get("differential_pressure", 0.0) for r in curr.values() if r.get("differential_pressure") is not None]
    power_vals = [r.get("power", 0.0) for r in curr.values() if r.get("power") is not None]

    avg_pm25 = round(float(sum(pm25_vals) / max(len(pm25_vals), 1)), 2)
    avg_co2 = round(float(sum(co2_vals) / max(len(co2_vals), 1)), 1)
    avg_velocity = round(float(sum(vel_vals) / max(len(vel_vals), 1)), 2)
    avg_pressure = round(float(sum(dp_vals) / max(len(dp_vals), 1)), 2)
    total_power = round(float(sum(power_vals)), 1)

    # Zone summary cards
    zone_summaries = []
    for z in zones:
        z_reading = curr.get(z.id, {})
        z_active_alerts = [a for a in active_alerts_list if a.zone_id == z.id]
        zone_summaries.append({
            "id": z.id,
            "name": z.name,
            "node_id": z.node_id,
            "location": z.location,
            "status": z.status,
            "pm2_5": z_reading.get("pm2_5", 0.0),
            "air_velocity": z_reading.get("air_velocity", 0.0),
            "differential_pressure": z_reading.get("differential_pressure", 0.0),
            "temperature": z_reading.get("temperature", 0.0),
            "co2": z_reading.get("co2", 0.0),
            "power": z_reading.get("power", 0.0),
            "active_alerts": len(z_active_alerts),
        })

    # Recent 5 alerts
    recent_alerts = active_alerts_list[:5]

    # Recent activity logs (from recent alerts & maintenance events)
    recent_maint = (
        db.query(MaintenanceRecord)
        .order_by(desc(MaintenanceRecord.timestamp))
        .limit(5)
        .all()
    )
    activity = []
    for m in recent_maint:
        activity.append({
            "type": "maintenance",
            "timestamp": m.timestamp.isoformat(),
            "description": f"[{m.action_type.upper()}] {m.description}",
            "zone_id": m.zone_id,
            "user": m.performed_by,
        })
    for a in recent_alerts[:5]:
        activity.append({
            "type": "alert",
            "timestamp": a.timestamp.isoformat(),
            "description": f"[{a.severity.upper()}] {a.title}: {a.parameter}={a.observed_value}{a.unit}",
            "zone_id": a.zone_id,
            "user": "System Sentinel",
        })
    activity.sort(key=lambda x: x["timestamp"], reverse=True)

    return DashboardSummarySchema(
        system_health=system_health,
        total_zones=total_zones,
        online_nodes=online_nodes,
        offline_nodes=offline_nodes,
        active_alerts=active_alerts_count,
        maintenance_due=maintenance_due,
        avg_pm25=avg_pm25,
        avg_co2=avg_co2,
        avg_velocity=avg_velocity,
        avg_pressure=avg_pressure,
        total_power=total_power,
        zone_summaries=zone_summaries,
        recent_alerts=recent_alerts,
        recent_activity=activity[:10],
        simulation_status=simulation_engine.get_status(),
    )


# ---------------------------------------------------------
# Zones Endpoints
# ---------------------------------------------------------
@router.get("/zones", response_model=List[ZoneWithReadingSchema])
def get_zones(db: Session = Depends(get_db)) -> List[ZoneWithReadingSchema]:
    """Retrieve all configured HVAC zones with latest readings and alert counts."""
    zones = db.query(Zone).all()
    result = []
    curr = simulation_engine.current_readings

    for z in zones:
        alert_count = (
            db.query(Alert)
            .filter(Alert.zone_id == z.id, Alert.status == "active")
            .count()
        )
        z_dict = {
            "id": z.id,
            "name": z.name,
            "description": z.description,
            "node_id": z.node_id,
            "location": z.location,
            "status": z.status,
            "created_at": z.created_at,
            "latest_reading": curr.get(z.id),
            "active_alerts_count": alert_count,
        }
        result.append(ZoneWithReadingSchema(**z_dict))
    return result


# ---------------------------------------------------------
# Sensor Readings Endpoints
# ---------------------------------------------------------
@router.get("/readings")
def get_current_readings() -> Dict[str, Any]:
    """Return latest instantaneous sensor readings for all zones from the simulation engine."""
    return simulation_engine.current_readings


@router.get("/readings/history", response_model=List[SensorReadingSchema])
def get_readings_history(
    zone_id: Optional[str] = Query(None, description="Optional zone ID filter (zone_a, zone_b, zone_c)"),
    hours: float = Query(24.0, ge=0.1, le=720.0, description="Hours of historical data"),
    limit: int = Query(500, ge=1, le=2000, description="Maximum number of reading records"),
    db: Session = Depends(get_db),
) -> List[SensorReadingSchema]:
    """Retrieve historical time-series sensor telemetry from SQLite storage."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    query = db.query(SensorReading).filter(SensorReading.timestamp >= cutoff)

    if zone_id:
        query = query.filter(SensorReading.zone_id == zone_id)

    readings = query.order_by(desc(SensorReading.timestamp)).limit(limit).all()
    return list(reversed(readings))


# ---------------------------------------------------------
# Alerts Management Endpoints
# ---------------------------------------------------------
@router.get("/alerts", response_model=List[AlertSchema])
def get_alerts(
    status: Optional[str] = Query(None, description="Filter by status: active, acknowledged, resolved"),
    zone_id: Optional[str] = Query(None, description="Filter by zone ID"),
    severity: Optional[str] = Query(None, description="Filter by severity: info, warning, critical"),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> List[AlertSchema]:
    """Query system alerts with optional state, zone, and severity filters."""
    query = db.query(Alert)
    if status:
        query = query.filter(Alert.status == status)
    if zone_id:
        query = query.filter(Alert.zone_id == zone_id)
    if severity:
        query = query.filter(Alert.severity == severity)

    alerts = query.order_by(desc(Alert.timestamp)).limit(limit).all()
    return alerts


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertSchema)
def acknowledge_alert(
    alert_id: str,
    body: Optional[AlertAcknowledge] = None,
    db: Session = Depends(get_db),
) -> AlertSchema:
    """Acknowledge an active alert, logging timestamp and optional operator notes."""
    alert = db.query(Alert).filter((Alert.alert_id == alert_id) | (Alert.id == (int(alert_id) if alert_id.isdigit() else -1))).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")

    alert.status = "acknowledged"
    alert.acknowledged_at = datetime.now(timezone.utc)
    if body and body.notes:
        alert.explanation = f"{alert.explanation} [Ack note: {body.notes}]"

    db.commit()
    db.refresh(alert)
    return alert


@router.post("/alerts/{alert_id}/resolve", response_model=AlertSchema)
def resolve_alert(
    alert_id: str,
    body: Optional[AlertResolve] = None,
    db: Session = Depends(get_db),
) -> AlertSchema:
    """Mark an alert as resolved and record operator resolution notes."""
    alert = db.query(Alert).filter((Alert.alert_id == alert_id) | (Alert.id == (int(alert_id) if alert_id.isdigit() else -1))).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found.")

    alert.status = "resolved"
    alert.resolved_at = datetime.now(timezone.utc)
    if body and body.resolution_notes:
        alert.action = f"{alert.action} [Resolution: {body.resolution_notes}]"

    db.commit()
    db.refresh(alert)
    return alert


# ---------------------------------------------------------
# Maintenance Endpoints
# ---------------------------------------------------------
@router.post("/maintenance", response_model=MaintenanceRecordSchema)
def create_maintenance_record(
    payload: MaintenanceRecordCreate,
    db: Session = Depends(get_db),
) -> MaintenanceRecordSchema:
    """Create a maintenance log entry and trigger cleaning restoration cycle."""
    zone = db.query(Zone).filter(Zone.id == payload.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail=f"Zone '{payload.zone_id}' not found.")

    record = simulation_engine.apply_cleaning(
        zone_id=payload.zone_id,
        db_session=db,
        performed_by=payload.performed_by,
        notes=payload.notes,
    )
    return record


@router.get("/maintenance", response_model=List[MaintenanceRecordSchema])
def get_maintenance_records(
    zone_id: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> List[MaintenanceRecordSchema]:
    """List historical maintenance actions and cleaning logs."""
    query = db.query(MaintenanceRecord)
    if zone_id:
        query = query.filter(MaintenanceRecord.zone_id == zone_id)
    return query.order_by(desc(MaintenanceRecord.timestamp)).limit(limit).all()


# ---------------------------------------------------------
# Predictive Analytics & ML Inference
# ---------------------------------------------------------
@router.get("/analytics")
def get_analytics(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Execute live ML inference over recent readings and return anomaly predictions."""
    now = datetime.now(timezone.utc)
    curr = simulation_engine.current_readings

    # 1. Random Forest Zone localization
    if zone_classifier is not None:
        localization = zone_classifier.predict(curr)
    else:
        localization = {"predicted_zone": "unknown", "confidence": 0.0, "probabilities": {}}
    predicted_fault_zone = localization["predicted_zone"]
    localization_conf = localization["confidence"]

    # 2. LSTM Autoencoder inference per zone
    zone_predictions = {}
    db_predictions = []

    for zone_id in ["zone_a", "zone_b", "zone_c"]:
        # Fetch last 20 readings from DB
        recent_records = (
            db.query(SensorReading)
            .filter(SensorReading.zone_id == zone_id)
            .order_by(desc(SensorReading.timestamp))
            .limit(20)
            .all()
        )
        readings_dicts = [
            {
                "pm2_5": r.pm2_5,
                "co2": r.co2,
                "temperature": r.temperature,
                "humidity": r.humidity,
                "air_velocity": r.air_velocity,
                "differential_pressure": r.differential_pressure,
                "power": r.power,
                "frequency": r.frequency,
                "power_factor": r.power_factor,
            }
            for r in reversed(recent_records)
        ]
        # Include latest memory reading
        if zone_id in curr:
            readings_dicts.append(curr[zone_id])

        # Infer with autoencoder
        if anomaly_detector is not None and anomaly_detector.is_trained:
            ae_res = anomaly_detector.predict(readings_dicts)
        else:
            ae_res = {
                "anomaly_score": 0.0, "is_anomaly": False,
                "reconstruction_error": 0.0, "threshold": 1.0,
                "contributing_sensors": [],
            }

        # Statistical detection
        stat_res = statistical_detector.detect(zone_id, curr.get(zone_id, {}))

        # Synthesize explanation
        if ae_res["is_anomaly"] or stat_res["is_anomaly"]:
            condition = f"Fault condition detected in {zone_id}"
            expl = (
                f"Autoencoder reconstruction error ({ae_res['reconstruction_error']:.4f}) exceeded "
                f"threshold ({ae_res['threshold']:.4f}). High deviation observed in: "
                f"{', '.join(c['sensor'] for c in ae_res['contributing_sensors'])}."
            )
        else:
            condition = "Nominal HVAC Operation"
            expl = "Sensor telemetry trajectories conform strictly to baseline aerodynamic profiles."

        zone_predictions[zone_id] = {
            "autoencoder": ae_res,
            "statistical": stat_res,
            "condition": condition,
            "explanation": expl,
        }

        # Log to DB
        pred_entry = AnomalyPrediction(
            timestamp=now,
            zone_id=zone_id,
            anomaly_score=float(ae_res["anomaly_score"]),
            is_anomaly=bool(ae_res["is_anomaly"] or stat_res["is_anomaly"]),
            suspected_zone=predicted_fault_zone,
            condition=condition,
            explanation=expl,
            contributing_sensors=json.dumps(ae_res["contributing_sensors"]),
            model_type="LSTM_Autoencoder",
        )
        db_predictions.append(pred_entry)

    db.add_all(db_predictions)
    db.commit()

    # Query recent anomaly history for charts
    history_entries = (
        db.query(AnomalyPrediction)
        .order_by(desc(AnomalyPrediction.timestamp))
        .limit(60)
        .all()
    )
    history_data = [
        {
            "id": h.id,
            "timestamp": h.timestamp.isoformat(),
            "zone_id": h.zone_id,
            "anomaly_score": h.anomaly_score,
            "is_anomaly": h.is_anomaly,
            "suspected_zone": h.suspected_zone,
        }
        for h in reversed(history_entries)
    ]

    # Models metadata
    models = db.query(ModelInfo).all()

    return {
        "timestamp": now.isoformat(),
        "localization": localization,
        "zone_predictions": zone_predictions,
        "models": [ModelInfoSchema.model_validate(m).model_dump() for m in models],
        "anomaly_history": history_data,
    }


# ---------------------------------------------------------
# Model Status & Training
# ---------------------------------------------------------
@router.get("/model/status", response_model=List[ModelInfoSchema])
def get_model_status(db: Session = Depends(get_db)) -> List[ModelInfoSchema]:
    """Retrieve tracking records and validation benchmarks for all ML models."""
    return db.query(ModelInfo).all()


@router.post("/model/train", response_model=ModelTrainResponse)
def trigger_model_training(
    background_tasks: BackgroundTasks,
    sync: bool = Query(False, description="Whether to execute synchronously"),
) -> ModelTrainResponse:
    """Trigger synthetic dataset generation and model retrain."""
    run_training_pipeline = _get_training_pipeline()
    if run_training_pipeline is None:
        return ModelTrainResponse(
            status="error",
            message="PyTorch not installed — training pipeline unavailable. Install torch to enable.",
            metrics={"status": "unavailable"},
        )
    def train_and_reload():
        result = run_training_pipeline()
        reload_models()
        return result

    if sync:
        metrics = train_and_reload()
        return ModelTrainResponse(
            status="completed",
            message="Model training pipeline finished synchronously.",
            metrics=metrics,
        )
    else:
        background_tasks.add_task(train_and_reload)
        return ModelTrainResponse(
            status="accepted",
            message="Model training pipeline dispatched in background.",
            metrics={"status": "in_progress"},
        )


# ---------------------------------------------------------
# Simulation Control Endpoints
# ---------------------------------------------------------
@router.post("/simulation/start")
def start_simulation() -> Dict[str, Any]:
    """Resume or start the background simulation engine clock."""
    simulation_engine.is_running = True
    return {"status": "running", "simulation": simulation_engine.get_status()}


@router.post("/simulation/pause")
def pause_simulation() -> Dict[str, Any]:
    """Halt background sensor progression ticks."""
    simulation_engine.is_running = False
    return {"status": "paused", "simulation": simulation_engine.get_status()}


@router.post("/simulation/reset")
def reset_simulation(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Reset simulation engine state back to standard normal operating baseline."""
    simulation_engine.scenario = "normal"
    simulation_engine.affected_zone = None
    simulation_engine.tick_count = 0
    simulation_engine.speed_multiplier = 1.0
    simulation_engine.is_running = True
    simulation_engine._setup_baselines()

    # Reset zone statuses in DB
    zones = db.query(Zone).all()
    for z in zones:
        z.status = "normal"
    db.commit()

    return {"status": "reset", "simulation": simulation_engine.get_status()}


@router.post("/simulation/scenario")
def set_simulation_scenario(payload: SimulationScenarioSchema) -> Dict[str, Any]:
    """Inject an operating condition or hardware disturbance scenario into the HVAC system."""
    valid_scenarios = [
        "normal",
        "dust_increase",
        "velocity_drop",
        "pressure_rise",
        "zone_a_restriction",
        "zone_b_restriction",
        "co2_rise",
        "energy_spike",
        "sensor_failure",
        "noisy_readings",
        "cleaning",
    ]
    if payload.scenario not in valid_scenarios:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario '{payload.scenario}'. Valid options: {valid_scenarios}",
        )

    if payload.speed_multiplier:
        simulation_engine.speed_multiplier = payload.speed_multiplier

    simulation_engine.set_scenario(payload.scenario, payload.zone_id)
    return {
        "status": "scenario_applied",
        "scenario": payload.scenario,
        "affected_zone": payload.zone_id,
        "speed_multiplier": simulation_engine.speed_multiplier,
        "simulation": simulation_engine.get_status(),
    }


# ---------------------------------------------------------
# System Configuration
# ---------------------------------------------------------
@router.get("/configuration", response_model=ConfigurationSchema)
def get_configuration() -> ConfigurationSchema:
    """Retrieve global system thresholds, simulation intervals, and configuration limits."""
    return ConfigurationSchema(
        app_name=settings.APP_NAME,
        version=settings.VERSION,
        simulation_interval=settings.SIMULATION_INTERVAL,
        pm25_warning=settings.PM25_WARNING,
        pm25_critical=settings.PM25_CRITICAL,
        co2_warning=settings.CO2_WARNING,
        co2_critical=settings.CO2_CRITICAL,
        velocity_warning_low=settings.VELOCITY_WARNING_LOW,
        velocity_critical_low=settings.VELOCITY_CRITICAL_LOW,
        pressure_warning=settings.PRESSURE_WARNING,
        pressure_critical=settings.PRESSURE_CRITICAL,
        power_warning=settings.POWER_WARNING,
        power_critical=settings.POWER_CRITICAL,
    )


@router.put("/configuration", response_model=ConfigurationSchema)
def update_configuration(config: ConfigurationSchema) -> ConfigurationSchema:
    """Update runtime configuration thresholds and simulation timing parameters."""
    settings.SIMULATION_INTERVAL = config.simulation_interval
    settings.PM25_WARNING = config.pm25_warning
    settings.PM25_CRITICAL = config.pm25_critical
    settings.CO2_WARNING = config.co2_warning
    settings.CO2_CRITICAL = config.co2_critical
    settings.VELOCITY_WARNING_LOW = config.velocity_warning_low
    settings.VELOCITY_CRITICAL_LOW = config.velocity_critical_low
    settings.PRESSURE_WARNING = config.pressure_warning
    settings.PRESSURE_CRITICAL = config.pressure_critical
    settings.POWER_WARNING = config.power_warning
    settings.POWER_CRITICAL = config.power_critical

    return config


# ---------------------------------------------------------
# Reporting and Telemetry Export
# ---------------------------------------------------------
@router.get("/reports/history")
def get_reports_history(
    start: Optional[str] = Query(None, description="ISO timestamp start filter"),
    end: Optional[str] = Query(None, description="ISO timestamp end filter"),
    zone_id: Optional[str] = Query(None, description="Zone ID filter"),
    sensor: Optional[str] = Query(None, description="Specific sensor parameter name"),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Generate structured historical telemetry reports with summary statistics."""
    query = db.query(SensorReading)

    if start:
        try:
            start_dt = datetime.fromisoformat(start)
            query = query.filter(SensorReading.timestamp >= start_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start ISO datetime format.")

    if end:
        try:
            end_dt = datetime.fromisoformat(end)
            query = query.filter(SensorReading.timestamp <= end_dt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end ISO datetime format.")

    if zone_id:
        query = query.filter(SensorReading.zone_id == zone_id)

    readings = query.order_by(SensorReading.timestamp.asc()).all()

    # Extract specific sensor values or full records
    data_points = []
    values_for_stats = []
    for r in readings:
        pt = {
            "timestamp": r.timestamp.isoformat(),
            "zone_id": r.zone_id,
            "scenario": r.scenario,
        }
        if sensor and hasattr(r, sensor):
            val = getattr(r, sensor)
            pt[sensor] = val
            if val is not None:
                values_for_stats.append(float(val))
        else:
            pt.update({
                "pm2_5": r.pm2_5,
                "air_velocity": r.air_velocity,
                "differential_pressure": r.differential_pressure,
                "co2": r.co2,
                "power": r.power,
            })
        data_points.append(pt)

    stats = {}
    if values_for_stats:
        import numpy as np
        stats = {
            "sensor": sensor,
            "count": len(values_for_stats),
            "mean": round(float(np.mean(values_for_stats)), 3),
            "std": round(float(np.std(values_for_stats)), 3),
            "min": round(float(np.min(values_for_stats)), 3),
            "max": round(float(np.max(values_for_stats)), 3),
        }

    return {
        "total_records": len(data_points),
        "zone_filter": zone_id,
        "sensor_filter": sensor,
        "statistics": stats,
        "data": data_points,
    }


@router.get("/reports/export")
def export_reports_csv(
    zone_id: Optional[str] = Query(None, description="Optional zone ID filter"),
    hours: float = Query(24.0, ge=0.1, le=720.0, description="Hours of historical data"),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    """Export historical sensor telemetry formatted as a CSV spreadsheet."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    query = db.query(SensorReading).filter(SensorReading.timestamp >= cutoff)
    if zone_id:
        query = query.filter(SensorReading.zone_id == zone_id)

    readings = query.order_by(SensorReading.timestamp.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "timestamp",
        "zone_id",
        "pm1_0",
        "pm2_5",
        "pm10",
        "co2",
        "temperature",
        "humidity",
        "air_velocity",
        "differential_pressure",
        "voltage",
        "current",
        "power",
        "energy",
        "frequency",
        "power_factor",
        "scenario",
    ])

    for r in readings:
        writer.writerow([
            r.timestamp.isoformat(),
            r.zone_id,
            r.pm1_0,
            r.pm2_5,
            r.pm10,
            r.co2,
            r.temperature,
            r.humidity,
            r.air_velocity,
            r.differential_pressure,
            r.voltage,
            r.current,
            r.power,
            r.energy,
            r.frequency,
            r.power_factor,
            r.scenario,
        ])

    output.seek(0)
    filename = f"pibuddy_telemetry_{zone_id or 'all_zones'}_{int(hours)}h.csv"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers=headers,
    )
