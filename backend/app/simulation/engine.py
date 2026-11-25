"""Intelligent HVAC Simulation Engine for PiBuddy.

Simulates physical behavior, sensor dynamics, environmental disturbances,
fault conditions, and maintenance restoration for a 3-zone HVAC facility.
"""

from datetime import datetime, timezone
import random
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import func, desc

from app.models.db_models import Zone, SensorReading, Alert, MaintenanceRecord
from app.core.config import settings


class SimulationEngine:
    """Singleton simulation engine governing hardware sensor emulation."""

    _instance: Optional["SimulationEngine"] = None

    def __new__(cls) -> "SimulationEngine":
        if cls._instance is None:
            cls._instance = super(SimulationEngine, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if getattr(self, "_initialized", False):
            return

        self.is_running: bool = True  # Starts running by default
        self.scenario: str = "normal"
        self.affected_zone: Optional[str] = None
        self.tick_count: int = 0
        self.speed_multiplier: float = 1.0
        self.current_readings: Dict[str, Dict[str, Any]] = {}
        self.baselines: Dict[str, Dict[str, float]] = {}
        self._cumulative_energy: Dict[str, float] = {"zone_a": 12.4, "zone_b": 8.6, "zone_c": 6.2}
        self._cleaning_starting_values: Dict[str, Dict[str, float]] = {}
        self._alert_counter: int = 0

        # Load baseline specifications
        self._setup_baselines()

        # Initialize current readings with nominal baselines
        now_iso = datetime.now(timezone.utc).isoformat()
        for zone_id, base in self.baselines.items():
            reading = dict(base)
            reading["zone_id"] = zone_id
            reading["timestamp"] = now_iso
            reading["is_simulated"] = True
            reading["scenario"] = "normal"
            self.current_readings[zone_id] = reading

        self._initialized = True

    def _setup_baselines(self) -> None:
        """Configure nominal physical operating baselines for medium office HVAC."""
        # Zone A (main duct — highest airflow)
        self.baselines["zone_a"] = {
            "pm1_0": 8.0,
            "pm2_5": 12.0,
            "pm10": 18.0,
            "co2": 420.0,
            "temperature": 22.5,
            "humidity": 45.0,
            "air_velocity": 3.2,
            "differential_pressure": 15.0,
            "voltage": 230.0,
            "current": 4.2,
            "power": 950.0,
            "energy": self._cumulative_energy["zone_a"],
            "frequency": 50.0,
            "power_factor": 0.92,
        }

        # Zone B (branch A — medium airflow)
        self.baselines["zone_b"] = {
            "pm1_0": 10.0,
            "pm2_5": 15.0,
            "pm10": 22.0,
            "co2": 480.0,
            "temperature": 23.0,
            "humidity": 47.0,
            "air_velocity": 2.1,
            "differential_pressure": 22.0,
            "voltage": 230.0,
            "current": 2.8,
            "power": 630.0,
            "energy": self._cumulative_energy["zone_b"],
            "frequency": 50.0,
            "power_factor": 0.91,
        }

        # Zone C (branch B — lower airflow)
        self.baselines["zone_c"] = {
            "pm1_0": 12.0,
            "pm2_5": 18.0,
            "pm10": 28.0,
            "co2": 510.0,
            "temperature": 23.5,
            "humidity": 49.0,
            "air_velocity": 1.6,
            "differential_pressure": 28.0,
            "voltage": 230.0,
            "current": 2.1,
            "power": 475.0,
            "energy": self._cumulative_energy["zone_c"],
            "frequency": 50.0,
            "power_factor": 0.90,
        }

    def _init_alert_counter_from_db(self, db_session: Session) -> None:
        """Ensure sequential alert counter is synchronized with database."""
        if self._alert_counter == 0:
            last_alert = db_session.query(Alert).order_by(desc(Alert.id)).first()
            if last_alert and last_alert.alert_id.startswith("ALT-"):
                try:
                    num_part = int(last_alert.alert_id.split("-")[1])
                    self._alert_counter = num_part
                except (IndexError, ValueError):
                    self._alert_counter = db_session.query(Alert).count()
            else:
                self._alert_counter = db_session.query(Alert).count()

    def set_scenario(self, scenario: str, zone: Optional[str] = None) -> None:
        """Trigger an operational perturbation or scenario.

        Args:
            scenario: Name of scenario (normal, dust_increase, velocity_drop, etc.)
            zone: Optional target zone ID (zone_a, zone_b, zone_c).
        """
        self.scenario = scenario
        self.affected_zone = zone if zone in ["zone_a", "zone_b", "zone_c"] else None
        self.tick_count = 0

        # If cleaning initiated, snapshot current readings to interpolate back smoothly
        if scenario == "cleaning":
            self._cleaning_starting_values = {
                z: dict(self.current_readings[z]) for z in self.baselines.keys()
            }

    def tick(self, db_session: Session) -> List[Dict[str, Any]]:
        """Advance simulation clock by one cycle and persist generated state.

        Args:
            db_session: Active SQLAlchemy database session.

        Returns:
            List of generated sensor readings for all zones.
        """
        self._init_alert_counter_from_db(db_session)
        self.tick_count += 1
        now = datetime.now(timezone.utc)
        tick_readings: List[Dict[str, Any]] = []
        db_reading_objects: List[SensorReading] = []

        # Calculate time delta for cumulative energy calculation
        # interval = 3.0 seconds * speed_multiplier
        hours_elapsed = (settings.SIMULATION_INTERVAL * self.speed_multiplier) / 3600.0

        for zone_id in ["zone_a", "zone_b", "zone_c"]:
            reading_dict = self._generate_zone_reading(zone_id, hours_elapsed)
            self.current_readings[zone_id] = reading_dict
            tick_readings.append(reading_dict)

            # Create DB ORM object
            db_reading = SensorReading(
                zone_id=zone_id,
                timestamp=now,
                pm1_0=reading_dict["pm1_0"],
                pm2_5=reading_dict["pm2_5"],
                pm10=reading_dict["pm10"],
                co2=reading_dict["co2"],
                temperature=reading_dict["temperature"],
                humidity=reading_dict["humidity"],
                air_velocity=reading_dict["air_velocity"],
                differential_pressure=reading_dict["differential_pressure"],
                voltage=reading_dict["voltage"],
                current=reading_dict["current"],
                power=reading_dict["power"],
                energy=reading_dict["energy"],
                frequency=reading_dict["frequency"],
                power_factor=reading_dict["power_factor"],
                is_simulated=True,
                scenario=self.scenario,
            )
            db_reading_objects.append(db_reading)

            # Check thresholds and trigger alerts
            self._check_thresholds_and_alert(zone_id, reading_dict, db_session, now)

        # Bulk save readings
        db_session.add_all(db_reading_objects)
        db_session.commit()

        # Update zone operational statuses
        self._update_zone_statuses(db_session)

        # Database retention: keep only latest 1000 records per zone
        self._prune_old_readings(db_session)

        # If cleaning scenario reached completion (20 ticks), reset to normal
        if self.scenario == "cleaning" and self.tick_count >= 20:
            self.scenario = "normal"
            self.affected_zone = None
            self.tick_count = 0
            self._cleaning_starting_values.clear()

        return tick_readings

    def _generate_zone_reading(self, zone_id: str, hours_elapsed: float) -> Dict[str, Any]:
        """Compute synthesized sensor values with noise and scenario perturbations."""
        base = self.baselines[zone_id]
        scenario = self.scenario
        affected = self.affected_zone

        # Determine standard noise scale (2% normally, 15% during noisy_readings)
        noise_pct = 0.15 if scenario == "noisy_readings" else 0.02

        def with_noise(val: float, scale_override: Optional[float] = None) -> float:
            pct = scale_override if scale_override is not None else noise_pct
            sigma = max(val * pct, 0.001)
            return round(random.gauss(val, sigma), 2)

        # Check if sensor offline failure scenario
        is_failing = (scenario == "sensor_failure") and (affected is None or affected == zone_id)
        if is_failing:
            return {
                "zone_id": zone_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "pm1_0": 0.0,
                "pm2_5": 0.0,
                "pm10": 0.0,
                "co2": 0.0,
                "temperature": 0.0,
                "humidity": 0.0,
                "air_velocity": 0.0,
                "differential_pressure": 0.0,
                "voltage": 0.0,
                "current": 0.0,
                "power": 0.0,
                "energy": round(self._cumulative_energy[zone_id], 3),
                "frequency": 0.0,
                "power_factor": 0.0,
                "is_simulated": True,
                "scenario": scenario,
            }

        # Multipliers
        pm_mult = 1.0
        co2_offset = 0.0
        temp_offset = 0.0
        humidity_offset = 0.0
        vel_mult = 1.0
        dp_mult = 1.0
        power_mult = 1.0
        pf_val = base["power_factor"]

        # Calculate scenario dynamics
        if scenario == "dust_increase":
            progress = min(self.tick_count / 60.0, 1.0)
            if affected == zone_id or (affected is None and zone_id == "zone_a"):
                pm_mult = 1.0 + 2.0 * progress  # Up to 3.0x
            else:
                pm_mult = 1.0 + 0.20 * progress  # Up to 1.2x

        elif scenario == "velocity_drop":
            progress = min(self.tick_count / 30.0, 1.0)
            if affected == zone_id or (affected is None and zone_id == "zone_b"):
                vel_mult = 1.0 - 0.70 * progress  # Drops to 30%
                dp_mult = 1.0 + 0.40 * progress   # Rises +40%
            else:
                vel_mult = 1.0 - 0.10 * progress

        elif scenario == "pressure_rise":
            progress = min(self.tick_count / 30.0, 1.0)
            if affected == zone_id or (affected is None and zone_id == "zone_a"):
                dp_mult = 1.0 + 0.80 * progress   # Rises +80%
                vel_mult = 1.0 - 0.15 * progress  # Drops slightly
            else:
                dp_mult = 1.0 + 0.15 * progress

        elif scenario == "zone_a_restriction":
            progress = min(self.tick_count / 30.0, 1.0)
            if zone_id == "zone_a":
                vel_mult = 1.0 - 0.60 * progress  # -60%
                dp_mult = 1.0 + 1.00 * progress   # +100%
                pm_mult = 1.0 + 0.50 * progress   # +50%
            elif zone_id == "zone_b":
                vel_mult = 1.0 + 0.10 * progress  # Air diverted
                dp_mult = 1.0 + 0.10 * progress

        elif scenario == "zone_b_restriction":
            progress = min(self.tick_count / 30.0, 1.0)
            if zone_id == "zone_b":
                vel_mult = 1.0 - 0.55 * progress  # -55%
                dp_mult = 1.0 + 0.90 * progress   # +90%
                pm_mult = 1.0 + 0.40 * progress   # +40%
            elif zone_id == "zone_c":
                vel_mult = 1.0 + 0.10 * progress  # Air diverted

        elif scenario == "co2_rise":
            progress = min(self.tick_count / 40.0, 1.0)
            # CO2 rises to 1500 ppm in all zones
            target_co2 = 1500.0
            co2_offset = (target_co2 - base["co2"]) * progress

        elif scenario == "energy_spike":
            progress = min(self.tick_count / 20.0, 1.0)
            power_mult = 1.0 + 0.80 * progress  # 1.8x baseline
            pf_val = base["power_factor"] - (base["power_factor"] - 0.78) * progress

        elif scenario == "cleaning":
            # Smoothly transition from starting perturbed values back to nominal baseline over 20 ticks
            progress = min(self.tick_count / 20.0, 1.0)
            start_vals = self._cleaning_starting_values.get(zone_id, base)
            
            clean_pm25 = start_vals.get("pm2_5", base["pm2_5"]) + (base["pm2_5"] - start_vals.get("pm2_5", base["pm2_5"])) * progress
            clean_vel = start_vals.get("air_velocity", base["air_velocity"]) + (base["air_velocity"] - start_vals.get("air_velocity", base["air_velocity"])) * progress
            clean_dp = start_vals.get("differential_pressure", base["differential_pressure"]) + (base["differential_pressure"] - start_vals.get("differential_pressure", base["differential_pressure"])) * progress
            clean_co2 = start_vals.get("co2", base["co2"]) + (base["co2"] - start_vals.get("co2", base["co2"])) * progress
            clean_pwr = start_vals.get("power", base["power"]) + (base["power"] - start_vals.get("power", base["power"])) * progress

            pm_mult = clean_pm25 / max(base["pm2_5"], 1.0)
            vel_mult = clean_vel / max(base["air_velocity"], 0.1)
            dp_mult = clean_dp / max(base["differential_pressure"], 1.0)
            co2_offset = clean_co2 - base["co2"]
            power_mult = clean_pwr / max(base["power"], 1.0)

        # Synthesize individual parameter readings
        pm1_0 = max(0.0, with_noise(base["pm1_0"] * pm_mult))
        pm2_5 = max(0.0, with_noise(base["pm2_5"] * pm_mult))
        pm10 = max(0.0, with_noise(base["pm10"] * pm_mult))

        co2 = max(350.0, with_noise(base["co2"] + co2_offset))
        temperature = with_noise(base["temperature"] + temp_offset)
        humidity = max(10.0, min(95.0, with_noise(base["humidity"] + humidity_offset)))

        air_velocity = max(0.05, with_noise(base["air_velocity"] * vel_mult))
        differential_pressure = max(0.0, with_noise(base["differential_pressure"] * dp_mult))

        voltage = with_noise(base["voltage"], scale_override=0.005)
        power = max(10.0, with_noise(base["power"] * power_mult))
        current = round(power / (voltage * pf_val), 2)
        frequency = with_noise(base["frequency"], scale_override=0.002)
        power_factor = round(max(0.60, min(1.0, pf_val + random.gauss(0, 0.005))), 2)

        # Accumulate energy
        self._cumulative_energy[zone_id] += (power * hours_elapsed) / 1000.0
        energy = round(self._cumulative_energy[zone_id], 3)

        return {
            "zone_id": zone_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "pm1_0": pm1_0,
            "pm2_5": pm2_5,
            "pm10": pm10,
            "co2": co2,
            "temperature": temperature,
            "humidity": humidity,
            "air_velocity": air_velocity,
            "differential_pressure": differential_pressure,
            "voltage": voltage,
            "current": current,
            "power": power,
            "energy": energy,
            "frequency": frequency,
            "power_factor": power_factor,
            "is_simulated": True,
            "scenario": scenario,
        }

    def _check_thresholds_and_alert(
        self,
        zone_id: str,
        reading: Dict[str, Any],
        db_session: Session,
        now: datetime,
    ) -> None:
        """Evaluate parameters against safety thresholds and manage alert lifecycles."""
        base = self.baselines[zone_id]

        # Parameter rules: (param_key, warn_threshold, crit_threshold, unit, is_lower_bound)
        checks = [
            ("pm2_5", settings.PM25_WARNING, settings.PM25_CRITICAL, "ug/m3", False,
             "High PM2.5 Concentration",
             "Particulate matter concentration exceeds clean air standards, indicating dust accumulation or filtration degradation.",
             "Inspect duct lining and schedule air filter replacement."),

            ("co2", settings.CO2_WARNING, settings.CO2_CRITICAL, "ppm", False,
             "Elevated Indoor CO2 Level",
             "Carbon dioxide level is elevated, suggesting insufficient fresh air intake or ventilation blockage.",
             "Increase fresh air damper opening and check circulation fans."),

            ("air_velocity", settings.VELOCITY_WARNING_LOW, settings.VELOCITY_CRITICAL_LOW, "m/s", True,
             "Low Airflow Velocity",
             "Air velocity has fallen below minimum design airflow, causing thermal stratification and stagnant pockets.",
             "Inspect damper positions, fan belt tension, and duct obstructions."),

            ("differential_pressure", settings.PRESSURE_WARNING, settings.PRESSURE_CRITICAL, "Pa", False,
             "High Filter Differential Pressure",
             "Differential pressure across filter bank is excessive, indicating heavy dust cake loading.",
             "Perform duct cleaning or execute filter replacement procedure."),

            ("power", settings.POWER_WARNING, settings.POWER_CRITICAL, "W", False,
             "Excessive Electrical Power Draw",
             "Blower motor electrical consumption exceeds nominal range, possibly due to mechanical resistance or bearing wear.",
             "Check motor phase balance and inspect blower impeller bearings."),
        ]

        for param, warn_val, crit_val, unit, is_low, title, expl, act in checks:
            val = reading.get(param, 0.0)

            # Determine breach condition
            if is_low:
                is_crit = val <= crit_val
                is_warn = val <= warn_val and not is_crit
                is_normal = val > warn_val
            else:
                is_crit = val >= crit_val
                is_warn = val >= warn_val and not is_crit
                is_normal = val < warn_val

            # Query existing active or acknowledged alert for this parameter in this zone
            existing_alert = (
                db_session.query(Alert)
                .filter(
                    Alert.zone_id == zone_id,
                    Alert.parameter == param,
                    Alert.status.in_(["active", "acknowledged"]),
                )
                .first()
            )

            if is_crit or is_warn:
                severity = "critical" if is_crit else "warning"
                if not existing_alert:
                    # Create new alert
                    self._alert_counter += 1
                    alert_code = f"ALT-{self._alert_counter:03d}"
                    new_alert = Alert(
                        alert_id=alert_code,
                        timestamp=now,
                        severity=severity,
                        zone_id=zone_id,
                        parameter=param,
                        observed_value=float(val),
                        baseline_value=float(base[param]),
                        unit=unit,
                        title=f"{title} ({zone_id.replace('_', ' ').title()})",
                        explanation=expl,
                        action=act,
                        status="active",
                    )
                    db_session.add(new_alert)
                else:
                    # Update observed value and escalate severity if critical
                    existing_alert.observed_value = float(val)
                    if is_crit and existing_alert.severity != "critical":
                        existing_alert.severity = "critical"
            elif is_normal and existing_alert:
                # Auto-resolve alert when condition returns to normal
                existing_alert.status = "resolved"
                existing_alert.resolved_at = now

    def _update_zone_statuses(self, db_session: Session) -> None:
        """Update Zone status based on active alerts and hardware failure status."""
        for zone_id in ["zone_a", "zone_b", "zone_c"]:
            zone_obj = db_session.query(Zone).filter(Zone.id == zone_id).first()
            if not zone_obj:
                continue

            if self.scenario == "sensor_failure" and (self.affected_zone is None or self.affected_zone == zone_id):
                zone_obj.status = "offline"
                continue

            # Query active alerts for this zone
            active_alerts = (
                db_session.query(Alert)
                .filter(Alert.zone_id == zone_id, Alert.status == "active")
                .all()
            )

            has_critical = any(a.severity == "critical" for a in active_alerts)
            has_warning = any(a.severity == "warning" for a in active_alerts)

            if has_critical:
                zone_obj.status = "critical"
            elif has_warning:
                zone_obj.status = "warning"
            else:
                zone_obj.status = "normal"

        db_session.commit()

    def _prune_old_readings(self, db_session: Session) -> None:
        """Retain at most MAX_HISTORICAL_READINGS_PER_ZONE sensor readings per zone."""
        max_records = settings.MAX_HISTORICAL_READINGS_PER_ZONE
        for zone_id in ["zone_a", "zone_b", "zone_c"]:
            count = (
                db_session.query(func.count(SensorReading.id))
                .filter(SensorReading.zone_id == zone_id)
                .scalar()
                or 0
            )
            if count > max_records:
                excess = count - max_records
                # Find the ID cutoff
                old_ids = (
                    db_session.query(SensorReading.id)
                    .filter(SensorReading.zone_id == zone_id)
                    .order_by(SensorReading.id.asc())
                    .limit(excess)
                    .all()
                )
                ids_to_delete = [row[0] for row in old_ids]
                if ids_to_delete:
                    db_session.query(SensorReading).filter(
                        SensorReading.id.in_(ids_to_delete)
                    ).delete(synchronize_session=False)
                    db_session.commit()

    def apply_cleaning(
        self,
        zone_id: str,
        db_session: Session,
        performed_by: str = "Facility Tech",
        notes: str = "Automated duct cleaning and purge cycle executed.",
    ) -> MaintenanceRecord:
        """Initiate duct cleaning remediation cycle and log maintenance action."""
        now = datetime.now(timezone.utc)
        curr = self.current_readings.get(zone_id, self.baselines[zone_id])
        base = self.baselines[zone_id]

        before_pm25 = curr.get("pm2_5", base["pm2_5"])
        before_vel = curr.get("air_velocity", base["air_velocity"])

        # Count maintenance records to generate unique sequential code
        mnt_count = db_session.query(MaintenanceRecord).count() + 1
        record_id = f"MNT-{mnt_count:03d}"

        # Expected restored values after cleaning
        after_pm25 = base["pm2_5"]
        after_vel = base["air_velocity"]

        record = MaintenanceRecord(
            record_id=record_id,
            timestamp=now,
            zone_id=zone_id,
            action_type="cleaning",
            description=f"High-efficiency particulate scrubbing and duct de-fouling for {zone_id.replace('_', ' ').title()}",
            performed_by=performed_by,
            notes=notes,
            before_pm25=before_pm25,
            after_pm25=after_pm25,
            before_velocity=before_vel,
            after_velocity=after_vel,
        )
        db_session.add(record)
        db_session.commit()

        # Trigger cleaning scenario to smoothly transition readings back
        self.set_scenario("cleaning", zone=zone_id)

        # Resolve active alerts for this zone
        active_alerts = (
            db_session.query(Alert)
            .filter(Alert.zone_id == zone_id, Alert.status.in_(["active", "acknowledged"]))
            .all()
        )
        for a in active_alerts:
            a.status = "resolved"
            a.resolved_at = now
        db_session.commit()

        return record

    def get_status(self) -> Dict[str, Any]:
        """Return current operational simulation metadata."""
        max_ticks_map = {
            "dust_increase": 60,
            "velocity_drop": 30,
            "pressure_rise": 30,
            "zone_a_restriction": 30,
            "zone_b_restriction": 30,
            "co2_rise": 40,
            "energy_spike": 20,
            "cleaning": 20,
        }
        max_ticks = max_ticks_map.get(self.scenario, 1)
        progress = min(self.tick_count / float(max_ticks), 1.0) if self.scenario != "normal" else 1.0

        return {
            "is_running": self.is_running,
            "scenario": self.scenario,
            "affected_zone": self.affected_zone,
            "tick_count": self.tick_count,
            "speed_multiplier": self.speed_multiplier,
            "active_scenario_progress": round(progress, 2),
        }
