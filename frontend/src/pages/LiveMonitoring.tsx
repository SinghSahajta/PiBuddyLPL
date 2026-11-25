import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Droplets,
  Thermometer,
  Wind,
  Gauge,
  Zap,
  Info,
  Clock,
  Layers,
} from 'lucide-react';
import { api } from '../api/client';
import { useSimulationStore } from '../store/simulationStore';
import { usePolling } from '../hooks/usePolling';
import { SensorCard } from '../components/SensorCard';
import type { SensorReading } from '../types';

export const LiveMonitoring: React.FC = () => {
  const { readings, setReadings, lastUpdated } = useSimulationStore();
  const [selectedZone, setSelectedZone] = useState<string>('zone_a');
  const [zoneHistories, setZoneHistories] = useState<Record<string, Record<string, number[]>>>({
    zone_a: {},
    zone_b: {},
    zone_c: {},
  });

  // Fetch readings every 3s
  const fetchLiveReadings = async () => {
    try {
      const res = await api.getReadings();
      if (res.data) {
        setReadings(res.data);
      }
    } catch (e) {
      console.warn('Live readings polling fallback:', e);
    }
  };

  usePolling(fetchLiveReadings, 3000);

  // Maintain rolling 20-point history for each metric per zone
  useEffect(() => {
    const activeReading: SensorReading = readings[selectedZone] || {
      zone_id: selectedZone,
      timestamp: new Date().toISOString(),
      pm1_0: selectedZone === 'zone_b' ? 10.4 : 6.8,
      pm2_5: selectedZone === 'zone_b' ? 19.2 : 12.4,
      pm10: selectedZone === 'zone_b' ? 28.1 : 21.0,
      co2: selectedZone === 'zone_c' ? 730 : 540,
      temperature: 22.1,
      humidity: 48.2,
      air_velocity: selectedZone === 'zone_b' ? 2.18 : 3.15,
      differential_pressure: 125.4,
      voltage: 231.0,
      current: 4.85,
      power: 1120,
      energy: 154.2,
      frequency: 50.0,
      power_factor: 0.96,
      is_simulated: true,
      scenario: 'normal',
    };

    setZoneHistories((prev) => {
      const currentZoneHistory = prev[selectedZone] || {};
      const pushPoint = (key: string, val: number) => {
        const arr = currentZoneHistory[key] || [];
        return [...arr, val].slice(-20);
      };

      return {
        ...prev,
        [selectedZone]: {
          pm1_0: pushPoint('pm1_0', activeReading.pm1_0),
          pm2_5: pushPoint('pm2_5', activeReading.pm2_5),
          pm10: pushPoint('pm10', activeReading.pm10),
          co2: pushPoint('co2', activeReading.co2),
          temperature: pushPoint('temperature', activeReading.temperature),
          humidity: pushPoint('humidity', activeReading.humidity),
          air_velocity: pushPoint('air_velocity', activeReading.air_velocity),
          differential_pressure: pushPoint('differential_pressure', activeReading.differential_pressure),
          power: pushPoint('power', activeReading.power),
          current: pushPoint('current', activeReading.current),
          voltage: pushPoint('voltage', activeReading.voltage),
          frequency: pushPoint('frequency', activeReading.frequency),
          power_factor: pushPoint('power_factor', activeReading.power_factor),
        },
      };
    });
  }, [readings, selectedZone]);

  const current: SensorReading = readings[selectedZone] || {
    zone_id: selectedZone,
    timestamp: new Date().toISOString(),
    pm1_0: selectedZone === 'zone_b' ? 10.4 : 6.8,
    pm2_5: selectedZone === 'zone_b' ? 19.2 : 12.4,
    pm10: selectedZone === 'zone_b' ? 28.1 : 21.0,
    co2: selectedZone === 'zone_c' ? 730 : 540,
    temperature: 22.1,
    humidity: 48.2,
    air_velocity: selectedZone === 'zone_b' ? 2.18 : 3.15,
    differential_pressure: 125.4,
    voltage: 231.0,
    current: 4.85,
    power: 1120,
    energy: 154.2,
    frequency: 50.0,
    power_factor: 0.96,
    is_simulated: true,
    scenario: 'normal',
  };

  const hist = zoneHistories[selectedZone] || {};

  // Status helper based on thresholds
  const getStatus = (val: number, warn: number, crit: number, lowerIsBad: boolean = false) => {
    if (lowerIsBad) {
      if (val <= crit) return 'critical';
      if (val <= warn) return 'warning';
      return 'normal';
    }
    if (val >= crit) return 'critical';
    if (val >= warn) return 'warning';
    return 'normal';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Zone Tabs */}
      <div
        className="card"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={18} color="var(--accent-primary)" />
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Selected Monitoring Node:
          </span>
          <div style={{ display: 'flex', gap: '8px', marginLeft: '8px' }}>
            {[
              { id: 'zone_a', name: 'Zone A (Intake Node 01)' },
              { id: 'zone_b', name: 'Zone B (Plenum Node 02)' },
              { id: 'zone_c', name: 'Zone C (Return Node 03)' },
            ].map((z) => (
              <button
                key={z.id}
                onClick={() => setSelectedZone(z.id)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: selectedZone === z.id ? 600 : 500,
                  background:
                    selectedZone === z.id ? 'var(--accent-secondary)' : 'var(--bg-secondary)',
                  color: selectedZone === z.id ? '#101D38' : 'var(--text-primary)',
                  border: `1px solid ${
                    selectedZone === z.id ? 'var(--accent-primary)' : 'var(--border)'
                  }`,
                  transition: 'all 0.15s ease',
                }}
              >
                {z.name}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px' }}>
          <span style={{ color: 'var(--status-warning)', fontWeight: 600 }}>
            [SIMULATED] All readings are synthetic
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
            <Clock size={13} />
            <span>Updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Live'}</span>
          </div>
        </div>
      </div>

      {/* 1. Dust Monitoring Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cloud size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              1. Particulate Matter & Dust Telemetry
            </h3>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Laser scattering optical sensor (PMSA003I)
          </span>
        </div>

        <div
          style={{
            background: 'rgba(143, 203, 255, 0.08)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <Info size={15} color="var(--accent-primary)" />
          <span>
            <strong>WHO 2021 Air Quality Guidance:</strong> PM2.5 24-hr guideline is 15 µg/m³; PM10 is 45 µg/m³. HVAC filters target &gt;85% arrestance.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <SensorCard
            label="PM1.0 (Ultrafine)"
            value={current.pm1_0}
            unit="µg/m³"
            status={getStatus(current.pm1_0, 15, 25)}
            trend={hist.pm1_0}
            icon={<Cloud size={16} />}
            description="Sub-micron combustion and fine industrial aerosol"
          />
          <SensorCard
            label="PM2.5 (Fine Particles)"
            value={current.pm2_5}
            unit="µg/m³"
            status={getStatus(current.pm2_5, 25, 40)}
            trend={hist.pm2_5}
            icon={<Cloud size={16} />}
            description="Respirable fine dust. Key indicator of filter degradation"
          />
          <SensorCard
            label="PM10 (Inhalable Dust)"
            value={current.pm10}
            unit="µg/m³"
            status={getStatus(current.pm10, 50, 75)}
            trend={hist.pm10}
            icon={<Cloud size={16} />}
            description="Coarse atmospheric dust and mechanical debris"
          />
        </div>
      </div>

      {/* 2. Air Quality (CO2) Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Droplets size={18} color="var(--accent-secondary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            2. Air Quality & Carbon Dioxide (CO₂)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <SensorCard
            label="Carbon Dioxide (CO₂)"
            value={current.co2}
            unit="ppm"
            status={getStatus(current.co2, 800, 1100)}
            trend={hist.co2}
            precision={0}
            icon={<Droplets size={16} />}
            description="NDIR CO₂ sensor. Normal baseline: 400-600 ppm, ASHRAE limit: 1000 ppm"
          />
        </div>
      </div>

      {/* 3. Environmental (Temperature, Humidity) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Thermometer size={18} color="var(--accent-highlight)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            3. Environmental Conditions (SHT31 / BME280)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <SensorCard
            label="Air Temperature"
            value={current.temperature}
            unit="°C"
            status={getStatus(current.temperature, 26, 30)}
            trend={hist.temperature}
            icon={<Thermometer size={16} />}
            description="Duct airstream dry-bulb temperature"
          />
          <SensorCard
            label="Relative Humidity"
            value={current.humidity}
            unit="%"
            status={getStatus(current.humidity, 65, 75)}
            trend={hist.humidity}
            icon={<Droplets size={16} />}
            description="Supply air hygrometry. Comfort window: 40% - 60%"
          />
        </div>
      </div>

      {/* 4. Airflow (Air Velocity) */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Wind size={18} color="var(--accent-primary)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            4. Duct Airflow Aerodynamics
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <SensorCard
            label="Air Velocity"
            value={current.air_velocity}
            unit="m/s"
            status={getStatus(current.air_velocity, 2.2, 1.8, true)}
            trend={hist.air_velocity}
            precision={2}
            icon={<Wind size={16} />}
            description="Hot-wire anemometer. Baseline: 3.0 - 3.5 m/s. Drop indicates blockage"
          />
        </div>
      </div>

      {/* 5. Differential Pressure */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Gauge size={18} color="#34D399" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            5. Pressure & Filter Loading
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          <SensorCard
            label="Differential Pressure (ΔP)"
            value={current.differential_pressure}
            unit="Pa"
            status={getStatus(current.differential_pressure, 180, 240)}
            trend={hist.differential_pressure}
            precision={1}
            icon={<Gauge size={16} />}
            description="Piezoresistive pressure drop across duct section & filter media"
          />
        </div>
      </div>

      {/* 6. Energy Telemetry */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Zap size={18} color="var(--status-warning)" />
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
            6. Motor & Electrical Energy (PZEM-004T)
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <SensorCard
            label="Active Power"
            value={current.power}
            unit="W"
            status={getStatus(current.power, 1400, 1800)}
            trend={hist.power}
            precision={0}
            icon={<Zap size={16} />}
            description="Blower fan electrical power"
          />
          <SensorCard
            label="Line Voltage"
            value={current.voltage}
            unit="V"
            status={current.voltage < 210 || current.voltage > 245 ? 'warning' : 'normal'}
            trend={hist.voltage}
            precision={1}
            description="AC single phase supply"
          />
          <SensorCard
            label="Motor Current"
            value={current.current}
            unit="A"
            status={getStatus(current.current, 6.5, 8.0)}
            trend={hist.current}
            precision={2}
            description="RMS current consumption"
          />
          <SensorCard
            label="Power Factor"
            value={current.power_factor}
            unit=""
            status={current.power_factor < 0.85 ? 'warning' : 'normal'}
            trend={hist.power_factor}
            precision={2}
            description="Displacement factor cos φ"
          />
          <SensorCard
            label="Mains Frequency"
            value={current.frequency}
            unit="Hz"
            status="normal"
            trend={hist.frequency}
            precision={1}
            description="Grid supply frequency"
          />
          <SensorCard
            label="Cumulative Energy"
            value={current.energy}
            unit="kWh"
            status="normal"
            precision={1}
            description="Metered electrical energy"
          />
        </div>
      </div>
    </div>
  );
};
