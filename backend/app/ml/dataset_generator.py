"""Synthetic HVAC Dataset Generator for PiBuddy.

Generates labeled multivariate time-series datasets representing all 11 HVAC scenarios
with realistic inter-sensor correlations, Gaussian sensor noise, and zone dynamics.
"""

import os
from datetime import datetime, timedelta, timezone
import random
import numpy as np
import pandas as pd


def generate_dataset(
    n_samples_per_scenario: int = 200,
    output_path: str = "data/synthetic_dataset.csv",
) -> pd.DataFrame:
    """Generate labeled time-series dataset for all 11 scenarios across 3 zones.

    Columns:
        timestamp, zone_id, pm1_0, pm2_5, pm10, co2, temperature, humidity,
        air_velocity, differential_pressure, voltage, current, power,
        frequency, power_factor, scenario, is_anomaly, fault_zone
    """
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    baselines = {
        "zone_a": {
            "pm1_0": 8.0, "pm2_5": 12.0, "pm10": 18.0,
            "co2": 420.0, "temperature": 22.5, "humidity": 45.0,
            "air_velocity": 3.2, "differential_pressure": 15.0,
            "voltage": 230.0, "current": 4.2, "power": 950.0,
            "frequency": 50.0, "power_factor": 0.92,
        },
        "zone_b": {
            "pm1_0": 10.0, "pm2_5": 15.0, "pm10": 22.0,
            "co2": 480.0, "temperature": 23.0, "humidity": 47.0,
            "air_velocity": 2.1, "differential_pressure": 22.0,
            "voltage": 230.0, "current": 2.8, "power": 630.0,
            "frequency": 50.0, "power_factor": 0.91,
        },
        "zone_c": {
            "pm1_0": 12.0, "pm2_5": 18.0, "pm10": 28.0,
            "co2": 510.0, "temperature": 23.5, "humidity": 49.0,
            "air_velocity": 1.6, "differential_pressure": 28.0,
            "voltage": 230.0, "current": 2.1, "power": 475.0,
            "frequency": 50.0, "power_factor": 0.90,
        },
    }

    scenarios = [
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

    fault_zone_mapping = {
        "normal": "none",
        "dust_increase": "zone_a",
        "velocity_drop": "zone_b",
        "pressure_rise": "zone_a",
        "zone_a_restriction": "zone_a",
        "zone_b_restriction": "zone_b",
        "co2_rise": "all",
        "energy_spike": "all",
        "sensor_failure": "zone_c",
        "noisy_readings": "all",
        "cleaning": "none",
    }

    records = []
    base_time = datetime.now(timezone.utc) - timedelta(hours=24)
    tick_step = timedelta(seconds=10)
    current_time = base_time

    for scenario in scenarios:
        fault_zone = fault_zone_mapping[scenario]
        is_anomaly_scenario = scenario not in ["normal", "cleaning"]

        for step in range(n_samples_per_scenario):
            current_time += tick_step
            progress = min((step + 1) / float(n_samples_per_scenario), 1.0)

            # Environmental drift
            diurnal_temp = 1.2 * np.sin(2 * np.pi * step / n_samples_per_scenario)
            diurnal_hum = -2.0 * np.sin(2 * np.pi * step / n_samples_per_scenario)

            for zone_id in ["zone_a", "zone_b", "zone_c"]:
                base = baselines[zone_id]
                noise_scale = 0.15 if scenario == "noisy_readings" else 0.02

                def add_noise(val: float, scale: float = noise_scale) -> float:
                    sigma = max(val * scale, 0.001)
                    return float(np.random.normal(val, sigma))

                # Offline sensor failure scenario
                if scenario == "sensor_failure" and zone_id == fault_zone:
                    records.append({
                        "timestamp": current_time.isoformat(),
                        "zone_id": zone_id,
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
                        "frequency": 0.0,
                        "power_factor": 0.0,
                        "scenario": scenario,
                        "is_anomaly": True,
                        "fault_zone": fault_zone,
                    })
                    continue

                pm_mult = 1.0
                vel_mult = 1.0
                dp_mult = 1.0
                co2_offset = 0.0
                power_mult = 1.0
                pf_val = base["power_factor"]
                is_zone_anomaly = is_anomaly_scenario

                if scenario == "dust_increase":
                    if zone_id == fault_zone:
                        pm_mult = 1.0 + 2.0 * progress
                    else:
                        pm_mult = 1.0 + 0.20 * progress
                        is_zone_anomaly = False

                elif scenario == "velocity_drop":
                    if zone_id == fault_zone:
                        vel_mult = 1.0 - 0.70 * progress
                        dp_mult = 1.0 + 0.40 * progress
                    else:
                        vel_mult = 1.0 - 0.10 * progress
                        is_zone_anomaly = False

                elif scenario == "pressure_rise":
                    if zone_id == fault_zone:
                        dp_mult = 1.0 + 0.80 * progress
                        vel_mult = 1.0 - 0.15 * progress
                    else:
                        dp_mult = 1.0 + 0.15 * progress
                        is_zone_anomaly = False

                elif scenario == "zone_a_restriction":
                    if zone_id == "zone_a":
                        vel_mult = 1.0 - 0.60 * progress
                        dp_mult = 1.0 + 1.00 * progress
                        pm_mult = 1.0 + 0.50 * progress
                    else:
                        vel_mult = 1.0 + 0.10 * progress
                        is_zone_anomaly = False

                elif scenario == "zone_b_restriction":
                    if zone_id == "zone_b":
                        vel_mult = 1.0 - 0.55 * progress
                        dp_mult = 1.0 + 0.90 * progress
                        pm_mult = 1.0 + 0.40 * progress
                    else:
                        vel_mult = 1.0 + 0.10 * progress
                        is_zone_anomaly = False

                elif scenario == "co2_rise":
                    co2_offset = (1500.0 - base["co2"]) * progress

                elif scenario == "energy_spike":
                    power_mult = 1.0 + 0.80 * progress
                    pf_val = base["power_factor"] - (base["power_factor"] - 0.78) * progress

                elif scenario == "cleaning":
                    # Restoring back towards nominal
                    decay = np.exp(-3.0 * progress)
                    pm_mult = 1.0 + 1.5 * decay
                    vel_mult = 1.0 - 0.4 * decay
                    dp_mult = 1.0 + 0.5 * decay
                    is_zone_anomaly = False

                pm1_0 = max(0.0, round(add_noise(base["pm1_0"] * pm_mult), 2))
                pm2_5 = max(0.0, round(add_noise(base["pm2_5"] * pm_mult), 2))
                pm10 = max(0.0, round(add_noise(base["pm10"] * pm_mult), 2))

                co2 = max(350.0, round(add_noise(base["co2"] + co2_offset), 1))
                temperature = round(add_noise(base["temperature"] + diurnal_temp), 2)
                humidity = max(10.0, min(95.0, round(add_noise(base["humidity"] + diurnal_hum), 1)))

                air_velocity = max(0.05, round(add_noise(base["air_velocity"] * vel_mult), 3))
                differential_pressure = max(0.0, round(add_noise(base["differential_pressure"] * dp_mult), 2))

                voltage = round(add_noise(base["voltage"], 0.005), 1)
                power = max(10.0, round(add_noise(base["power"] * power_mult), 1))
                current = round(power / (voltage * pf_val), 2)
                frequency = round(add_noise(base["frequency"], 0.002), 2)
                power_factor = round(max(0.60, min(1.0, pf_val + np.random.normal(0, 0.005))), 2)

                records.append({
                    "timestamp": current_time.isoformat(),
                    "zone_id": zone_id,
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
                    "frequency": frequency,
                    "power_factor": power_factor,
                    "scenario": scenario,
                    "is_anomaly": is_zone_anomaly,
                    "fault_zone": fault_zone,
                })

    df = pd.DataFrame(records)
    df.to_csv(output_path, index=False)
    return df


if __name__ == "__main__":
    generated_df = generate_dataset(n_samples_per_scenario=200)
    print(f"Generated synthetic HVAC dataset with {len(generated_df)} rows at data/synthetic_dataset.csv")
