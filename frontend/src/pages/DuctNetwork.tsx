import React, { useState } from 'react';
import {
  Fan,
  Wind,
  RotateCcw,
  Sliders,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { useSimulationStore, SCENARIOS } from '../store/simulationStore';
import { usePolling } from '../hooks/usePolling';
import { StatusBadge } from '../components/StatusBadge';
import type { SensorReading } from '../types';

export const DuctNetwork: React.FC = () => {
  const { readings, zones, alerts, setReadings, setZones, setScenario, setAlerts } =
    useSimulationStore();

  const [selectedZoneId, setSelectedZoneId] = useState<string>('zone_a');
  const [selectedScenario, setSelectedScenario] = useState<string>('velocity_drop');
  const [actionZone, setActionZone] = useState<string>('zone_b');
  const [isApplying, setIsApplying] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Poll readings, zones and alerts every 3 seconds
  const fetchDuctData = async () => {
    try {
      const [readingsRes, zonesRes, alertsRes] = await Promise.allSettled([
        api.getReadings(),
        api.getZones(),
        api.getAlerts(),
      ]);

      if (readingsRes.status === 'fulfilled' && readingsRes.value.data) {
        setReadings(readingsRes.value.data);
      }
      if (zonesRes.status === 'fulfilled' && zonesRes.value.data) {
        setZones(zonesRes.value.data);
      }
      if (alertsRes.status === 'fulfilled' && alertsRes.value.data) {
        setAlerts(alertsRes.value.data);
      }
    } catch (e) {
      console.warn('Error polling duct data:', e);
    }
  };

  usePolling(fetchDuctData, 3000);

  // Helper to get status color
  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'warning':
        return '#FBBF24';
      case 'critical':
      case 'danger':
        return '#F87171';
      case 'offline':
        return '#6B7280';
      case 'normal':
      default:
        return '#34D399';
    }
  };

  const getZoneStatus = (zoneId: string) => {
    const z = zones.find((item) => item.id === zoneId);
    if (z) return z.status;
    const reading = readings[zoneId];
    if (reading) {
      if (reading.scenario === 'duct_restriction' || reading.air_velocity < 2.0) return 'warning';
      if (reading.pm2_5 > 35) return 'critical';
    }
    return 'normal';
  };

  // Get active readings for selected zone
  const currentReading: SensorReading = readings[selectedZoneId] || {
    zone_id: selectedZoneId,
    timestamp: new Date().toISOString(),
    pm1_0: 7.2,
    pm2_5: selectedZoneId === 'zone_b' ? 18.5 : 12.1,
    pm10: 24.3,
    co2: selectedZoneId === 'zone_c' ? 740 : 560,
    temperature: 22.4,
    humidity: 46.8,
    air_velocity: selectedZoneId === 'zone_b' ? 2.15 : 3.2,
    differential_pressure: selectedZoneId === 'zone_a' ? 142.0 : 115.5,
    voltage: 230.1,
    current: 4.8,
    power: 1104,
    energy: 142.6,
    frequency: 50.0,
    power_factor: 0.96,
    is_simulated: true,
    scenario: 'normal',
  };

  const selectedZoneObj = zones.find((z) => z.id === selectedZoneId) || {
    id: selectedZoneId,
    name:
      selectedZoneId === 'zone_a'
        ? 'Zone A — Main Intake / Filter'
        : selectedZoneId === 'zone_b'
        ? 'Zone B — Branch Junction & Blower'
        : 'Zone C — End Return / Terminal',
    description:
      selectedZoneId === 'zone_a'
        ? 'Primary intake plenum and bag filter stage'
        : selectedZoneId === 'zone_b'
        ? 'Central distribution supply branch and blower riser'
        : 'Terminal diffuser return loop and exhaust header',
    node_id:
      selectedZoneId === 'zone_a'
        ? 'NODE-01'
        : selectedZoneId === 'zone_b'
        ? 'NODE-02'
        : 'NODE-03',
    location:
      selectedZoneId === 'zone_a'
        ? 'Basement AHU Room'
        : selectedZoneId === 'zone_b'
        ? 'Floor 1 Riser Shaft'
        : 'Floor 3 Exhaust Header',
    status: getZoneStatus(selectedZoneId),
  };

  const selectedZoneAlerts = alerts.filter(
    (a) => a.zone_id === selectedZoneId && a.status !== 'resolved'
  );

  const handleApplyScenario = async () => {
    setIsApplying(true);
    try {
      await api.setScenario({
        scenario: selectedScenario,
        affected_zone: actionZone,
      });
      setScenario(selectedScenario, actionZone);
      setActionMessage(`Applied ${selectedScenario.replace(/_/g, ' ')} to ${actionZone.toUpperCase()}`);
      setTimeout(() => setActionMessage(null), 3500);
      fetchDuctData();
    } catch {
      setActionMessage('Failed to apply scenario - backend rejected or unreachable');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsApplying(false);
    }
  };

  const handleRestoreNormal = async () => {
    setIsApplying(true);
    try {
      await api.setScenario({
        scenario: 'normal',
      });
      setScenario('normal');
      setActionMessage('Restored all zones to Normal operation');
      setTimeout(() => setActionMessage(null), 3500);
      fetchDuctData();
    } catch {
      setScenario('normal');
      setActionMessage('Restored to Normal (simulated)');
      setTimeout(() => setActionMessage(null), 3500);
    } finally {
      setIsApplying(false);
    }
  };

  const statusA = getZoneStatus('zone_a');
  const statusB = getZoneStatus('zone_b');
  const statusC = getZoneStatus('zone_c');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Simulation Scenario Toolbar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Scenario Injector:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Target:</label>
            <select
              className="select-field"
              value={actionZone}
              onChange={(e) => setActionZone(e.target.value)}
              style={{ width: '130px', padding: '6px 10px', fontSize: '12px' }}
            >
              <option value="zone_a">Zone A (Intake)</option>
              <option value="zone_b">Zone B (Junction)</option>
              <option value="zone_c">Zone C (Return)</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Fault Scenario:</label>
            <select
              className="select-field"
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              style={{ width: '220px', padding: '6px 10px', fontSize: '12px' }}
            >
              {SCENARIOS.filter((sc) => sc.id !== 'normal').map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn-primary"
            onClick={handleApplyScenario}
            disabled={isApplying}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            {isApplying ? <span className="spinner" style={{ width: '12px', height: '12px' }} /> : <Wind size={14} />}
            <span>Inject Fault</span>
          </button>

          <button
            className="btn-secondary"
            onClick={handleRestoreNormal}
            disabled={isApplying}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            <RotateCcw size={14} />
            <span>Restore Normal</span>
          </button>
        </div>

        {actionMessage && (
          <div
            style={{
              fontSize: '12px',
              color: 'var(--status-normal)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle size={14} />
            <span>{actionMessage}</span>
          </div>
        )}
      </div>

      {/* Main Grid: SVG Topology on Left, Selected Zone Detail Panel on Right */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1.1fr)', gap: '20px' }}>
        {/* Left: SVG Duct Network Diagram */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <Fan size={18} color="var(--accent-primary)" />
                <span>HVAC Air Distribution Network</span>
              </h3>
              <span className="card-subtitle">
                Interactive airflow paths. Click any zone block to inspect real-time sensor parameters.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#34D399' }}>
                <span className="status-dot normal" style={{ width: '7px', height: '7px' }} /> Normal
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#FBBF24' }}>
                <span className="status-dot warning" style={{ width: '7px', height: '7px' }} /> Warning
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#F87171' }}>
                <span className="status-dot critical" style={{ width: '7px', height: '7px' }} /> Critical
              </span>
            </div>
          </div>

          {/* SVG Canvas */}
          <div
            style={{
              background: '#0D172C',
              borderRadius: '8px',
              border: '1px solid var(--border)',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '440px',
            }}
          >
            <svg
              viewBox="0 0 860 480"
              style={{ width: '100%', height: 'auto', maxHeight: '500px' }}
            >
              <defs>
                {/* Airflow arrow marker */}
                <marker
                  id="arrow"
                  viewBox="0 0 10 10"
                  refX="6"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#8FCBFF" />
                </marker>

                <linearGradient id="ductGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#172746" />
                  <stop offset="100%" stopColor="#1D3557" />
                </linearGradient>

                <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#34D399" floodOpacity="0.4" />
                </filter>
                <filter id="glowYellow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#FBBF24" floodOpacity="0.5" />
                </filter>
                <filter id="glowRed" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#F87171" floodOpacity="0.6" />
                </filter>
              </defs>

              {/* 1. AHU (Air Handling Unit) Box */}
              <g transform="translate(30, 160)">
                <rect
                  x="0"
                  y="0"
                  width="130"
                  height="160"
                  rx="10"
                  fill="#172746"
                  stroke="#5DA9E9"
                  strokeWidth="2.5"
                />
                {/* AHU Grille Pattern */}
                <line x1="15" y1="35" x2="115" y2="35" stroke="#304968" strokeWidth="2" />
                <line x1="15" y1="45" x2="115" y2="45" stroke="#304968" strokeWidth="2" />
                <line x1="15" y1="55" x2="115" y2="55" stroke="#304968" strokeWidth="2" />

                {/* Blower Fan Circle */}
                <circle cx="65" cy="100" r="30" fill="#101D38" stroke="#8FCBFF" strokeWidth="2" />
                <path
                  d="M 65 80 L 65 120 M 45 100 L 85 100 M 51 86 L 79 114 M 51 114 L 79 86"
                  stroke="#8FCBFF"
                  strokeWidth="2"
                  strokeLinecap="round"
                />

                <text
                  x="65"
                  y="24"
                  fill="#F4F8FF"
                  fontSize="13"
                  fontWeight="bold"
                  textAnchor="middle"
                  fontFamily="Inter"
                >
                  AHU-01
                </text>
                <text
                  x="65"
                  y="148"
                  fill="#A9BED8"
                  fontSize="10"
                  textAnchor="middle"
                  fontFamily="Inter"
                >
                  Primary Blower
                </text>
              </g>

              {/* 2. Main Supply Duct (from AHU to Junction) */}
              <path
                d="M 160 240 L 320 240"
                fill="none"
                stroke="#304968"
                strokeWidth="28"
                strokeLinecap="round"
              />
              <path
                d="M 160 240 L 320 240"
                fill="none"
                stroke="#5DA9E9"
                strokeWidth="4"
                strokeDasharray="8 6"
                markerEnd="url(#arrow)"
              />
              <text x="235" y="220" fill="#A9BED8" fontSize="11" textAnchor="middle" fontWeight="500">
                Main Duct
              </text>

              {/* 3. Distribution Junction Block */}
              <g transform="translate(320, 205)">
                <rect
                  x="0"
                  y="0"
                  width="70"
                  height="70"
                  rx="8"
                  fill="#1D3557"
                  stroke="#8FCBFF"
                  strokeWidth="2"
                />
                <circle cx="35" cy="35" r="14" fill="#101D38" stroke="#5DA9E9" strokeWidth="2" />
                <text
                  x="35"
                  y="39"
                  fill="#F4F8FF"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  JUNCT
                </text>
              </g>

              {/* 4. Branch Ducts splitting to Zones A, B, and C */}
              {/* Branch to Zone A (Top) */}
              <path
                d="M 390 220 L 460 220 L 460 100 L 530 100"
                fill="none"
                stroke="#304968"
                strokeWidth="22"
                strokeLinejoin="round"
              />
              <path
                d="M 390 220 L 460 220 L 460 100 L 530 100"
                fill="none"
                stroke="#8FCBFF"
                strokeWidth="3"
                strokeDasharray="6 4"
                markerEnd="url(#arrow)"
              />

              {/* Branch to Zone B (Middle) */}
              <path
                d="M 390 240 L 530 240"
                fill="none"
                stroke="#304968"
                strokeWidth="22"
                strokeLinecap="round"
              />
              <path
                d="M 390 240 L 530 240"
                fill="none"
                stroke="#8FCBFF"
                strokeWidth="3"
                strokeDasharray="6 4"
                markerEnd="url(#arrow)"
              />

              {/* Branch to Zone C (Bottom) */}
              <path
                d="M 390 260 L 460 260 L 460 380 L 530 380"
                fill="none"
                stroke="#304968"
                strokeWidth="22"
                strokeLinejoin="round"
              />
              <path
                d="M 390 260 L 460 260 L 460 380 L 530 380"
                fill="none"
                stroke="#8FCBFF"
                strokeWidth="3"
                strokeDasharray="6 4"
                markerEnd="url(#arrow)"
              />

              {/* 5. Zone A Box (Top) */}
              <g
                transform="translate(530, 45)"
                onClick={() => setSelectedZoneId('zone_a')}
                style={{ cursor: 'pointer' }}
                filter={
                  statusA === 'critical'
                    ? 'url(#glowRed)'
                    : statusA === 'warning'
                    ? 'url(#glowYellow)'
                    : 'url(#glowGreen)'
                }
              >
                <rect
                  x="0"
                  y="0"
                  width="280"
                  height="110"
                  rx="10"
                  fill="#172746"
                  stroke={getStatusColor(statusA)}
                  strokeWidth={selectedZoneId === 'zone_a' ? 3.5 : 2}
                />
                {selectedZoneId === 'zone_a' && (
                  <rect
                    x="-4"
                    y="-4"
                    width="288"
                    height="118"
                    rx="14"
                    fill="none"
                    stroke="#8FCBFF"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}
                <text x="18" y="32" fill="#F4F8FF" fontSize="15" fontWeight="bold">
                  ZONE A
                </text>
                <text x="85" y="32" fill="#8FCBFF" fontSize="11" fontFamily="monospace">
                  [NODE-01]
                </text>
                <text x="18" y="52" fill="#A9BED8" fontSize="11">
                  Main Intake & Bag Filter
                </text>
                <text x="18" y="78" fill="#F4F8FF" fontSize="12" fontWeight="600">
                  Airflow: {readings.zone_a ? `${readings.zone_a.air_velocity.toFixed(2)} m/s` : '3.12 m/s'}
                </text>
                <text x="145" y="78" fill="#F4F8FF" fontSize="12" fontWeight="600">
                  PM2.5: {readings.zone_a ? `${readings.zone_a.pm2_5.toFixed(1)} µg` : '12.3 µg'}
                </text>
                <circle cx="254" cy="28" r="6" fill={getStatusColor(statusA)} />
              </g>

              {/* 6. Zone B Box (Middle) */}
              <g
                transform="translate(530, 185)"
                onClick={() => setSelectedZoneId('zone_b')}
                style={{ cursor: 'pointer' }}
                filter={
                  statusB === 'critical'
                    ? 'url(#glowRed)'
                    : statusB === 'warning'
                    ? 'url(#glowYellow)'
                    : 'url(#glowGreen)'
                }
              >
                <rect
                  x="0"
                  y="0"
                  width="280"
                  height="110"
                  rx="10"
                  fill="#172746"
                  stroke={getStatusColor(statusB)}
                  strokeWidth={selectedZoneId === 'zone_b' ? 3.5 : 2}
                />
                {selectedZoneId === 'zone_b' && (
                  <rect
                    x="-4"
                    y="-4"
                    width="288"
                    height="118"
                    rx="14"
                    fill="none"
                    stroke="#8FCBFF"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}
                <text x="18" y="32" fill="#F4F8FF" fontSize="15" fontWeight="bold">
                  ZONE B
                </text>
                <text x="85" y="32" fill="#8FCBFF" fontSize="11" fontFamily="monospace">
                  [NODE-02]
                </text>
                <text x="18" y="52" fill="#A9BED8" fontSize="11">
                  Branch Junction & Blower Riser
                </text>
                <text x="18" y="78" fill="#F4F8FF" fontSize="12" fontWeight="600">
                  Airflow: {readings.zone_b ? `${readings.zone_b.air_velocity.toFixed(2)} m/s` : '2.15 m/s'}
                </text>
                <text x="145" y="78" fill="#F4F8FF" fontSize="12" fontWeight="600">
                  PM2.5: {readings.zone_b ? `${readings.zone_b.pm2_5.toFixed(1)} µg` : '18.5 µg'}
                </text>
                <circle cx="254" cy="28" r="6" fill={getStatusColor(statusB)} />
              </g>

              {/* 7. Zone C Box (Bottom) */}
              <g
                transform="translate(530, 325)"
                onClick={() => setSelectedZoneId('zone_c')}
                style={{ cursor: 'pointer' }}
                filter={
                  statusC === 'critical'
                    ? 'url(#glowRed)'
                    : statusC === 'warning'
                    ? 'url(#glowYellow)'
                    : 'url(#glowGreen)'
                }
              >
                <rect
                  x="0"
                  y="0"
                  width="280"
                  height="110"
                  rx="10"
                  fill="#172746"
                  stroke={getStatusColor(statusC)}
                  strokeWidth={selectedZoneId === 'zone_c' ? 3.5 : 2}
                />
                {selectedZoneId === 'zone_c' && (
                  <rect
                    x="-4"
                    y="-4"
                    width="288"
                    height="118"
                    rx="14"
                    fill="none"
                    stroke="#8FCBFF"
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />
                )}
                <text x="18" y="32" fill="#F4F8FF" fontSize="15" fontWeight="bold">
                  ZONE C
                </text>
                <text x="85" y="32" fill="#8FCBFF" fontSize="11" fontFamily="monospace">
                  [NODE-03]
                </text>
                <text x="18" y="52" fill="#A9BED8" fontSize="11">
                  End Return & Terminal Diffuser
                </text>
                <text x="18" y="78" fill="#F4F8FF" fontSize="12" fontWeight="600">
                  Airflow: {readings.zone_c ? `${readings.zone_c.air_velocity.toFixed(2)} m/s` : '2.94 m/s'}
                </text>
                <text x="145" y="78" fill="#F4F8FF" fontSize="12" fontWeight="600">
                  PM2.5: {readings.zone_c ? `${readings.zone_c.pm2_5.toFixed(1)} µg` : '13.9 µg'}
                </text>
                <circle cx="254" cy="28" r="6" fill={getStatusColor(statusC)} />
              </g>
            </svg>
          </div>
        </div>

        {/* Right Detail Panel: Clicked Zone Telemetry & Alerts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 className="card-title">{selectedZoneObj.name}</h3>
                <StatusBadge status={getZoneStatus(selectedZoneId)} size="sm" />
              </div>
              <span className="card-subtitle">
                Hardware Node: <strong>{selectedZoneObj.node_id}</strong> | {selectedZoneObj.location}
              </span>
            </div>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            {selectedZoneObj.description}
          </p>

          {/* Active alerts for this zone */}
          {selectedZoneAlerts.length > 0 && (
            <div
              style={{
                background: 'rgba(248, 113, 113, 0.1)',
                border: '1px solid var(--status-critical)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '16px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'var(--status-critical)',
                  fontSize: '12px',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                <AlertCircle size={14} />
                <span>Active Alert on this Node:</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                {selectedZoneAlerts[0].title}
              </div>
            </div>
          )}

          {/* Sensor Telemetry Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
            {/* PM2.5 */}
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PM2.5 (Fine Dust)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-primary)' }}>
                {currentReading.pm2_5.toFixed(1)} <span style={{ fontSize: '11px' }}>µg/m³</span>
              </div>
            </div>

            {/* PM10 */}
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PM10 (Coarse Dust)</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {currentReading.pm10.toFixed(1)} <span style={{ fontSize: '11px' }}>µg/m³</span>
              </div>
            </div>

            {/* Air Velocity */}
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Air Velocity</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: currentReading.air_velocity < 2.2 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
                {currentReading.air_velocity.toFixed(2)} <span style={{ fontSize: '11px' }}>m/s</span>
              </div>
            </div>

            {/* Differential Pressure */}
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Diff. Pressure</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--status-normal)' }}>
                {currentReading.differential_pressure.toFixed(1)} <span style={{ fontSize: '11px' }}>Pa</span>
              </div>
            </div>

            {/* CO2 */}
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CO₂ Concentration</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {Math.round(currentReading.co2)} <span style={{ fontSize: '11px' }}>ppm</span>
              </div>
            </div>

            {/* Temperature */}
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Temperature</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {currentReading.temperature.toFixed(1)} <span style={{ fontSize: '11px' }}>°C</span>
              </div>
            </div>

            {/* Humidity */}
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Rel. Humidity</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {currentReading.humidity.toFixed(1)} <span style={{ fontSize: '11px' }}>%</span>
              </div>
            </div>

            {/* Power */}
            <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Power Consumption</div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-highlight)' }}>
                {Math.round(currentReading.power)} <span style={{ fontSize: '11px' }}>W</span>
              </div>
            </div>
          </div>

          <div
            style={{
              paddingTop: '12px',
              borderTop: '1px solid rgba(48, 73, 104, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '11px',
              color: 'var(--text-secondary)',
            }}
          >
            <div>
              Electrical: {currentReading.voltage.toFixed(1)}V / {currentReading.current.toFixed(2)}A (PF {currentReading.power_factor.toFixed(2)})
            </div>
            <div>
              Status flag: <strong>{currentReading.scenario}</strong> (Synthetic Mode)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
