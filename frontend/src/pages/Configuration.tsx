import React, { useState, useEffect } from 'react';
import {
  Settings,
  Sliders,
  Layers,
  Save,
  RotateCcw,
  CheckCircle,
  Info,
} from 'lucide-react';
import { api } from '../api/client';
import type { SystemConfiguration, Zone, ThresholdItem } from '../types';

export const Configuration: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'zones' | 'thresholds' | 'simulation'>('zones');
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const defaultConfiguration: SystemConfiguration = {
    zones: [
      {
        id: 'zone_a',
        name: 'Zone A — Main Intake / Filter',
        description: 'Primary air intake, pre-filter and bag filter stage',
        node_id: 'NODE-01',
        location: 'Basement AHU Room',
        status: 'normal',
      },
      {
        id: 'zone_b',
        name: 'Zone B — Branch Junction & Blower',
        description: 'Main distribution supply plenum and blower motor',
        node_id: 'NODE-02',
        location: 'Floor 1 Riser Shaft',
        status: 'normal',
      },
      {
        id: 'zone_c',
        name: 'Zone C — End Return / Terminal',
        description: 'Terminal diffuser return loop and exhaust header',
        node_id: 'NODE-03',
        location: 'Floor 3 Exhaust Header',
        status: 'normal',
      },
    ],
    thresholds: {
      pm2_5: { warning: 25.0, critical: 40.0, unit: 'µg/m³' },
      pm10: { warning: 50.0, critical: 75.0, unit: 'µg/m³' },
      co2: { warning: 800, critical: 1100, unit: 'ppm' },
      air_velocity: { warning: 2.2, critical: 1.8, unit: 'm/s' },
      differential_pressure: { warning: 180.0, critical: 240.0, unit: 'Pa' },
      power: { warning: 1400, critical: 1800, unit: 'W' },
      temperature: { warning: 26.0, critical: 30.0, unit: '°C' },
      humidity: { warning: 65.0, critical: 75.0, unit: '%' },
    },
    simulation: {
      sampling_interval: 3,
      speed: 1,
      default_scenario: 'normal',
      noise_factor: 5,
    },
  };

  const [config, setConfig] = useState<SystemConfiguration>(defaultConfiguration);

  // Load config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await api.getConfig();
        if (res.data) {
          setConfig(res.data);
        }
      } catch {
        // Fall back to default config
      }
    };
    loadConfig();
  }, []);

  // Update zone field
  const handleZoneChange = (index: number, field: keyof Zone, value: string) => {
    const updatedZones = [...config.zones];
    updatedZones[index] = {
      ...updatedZones[index],
      [field]: value,
    };
    setConfig({ ...config, zones: updatedZones });
  };

  // Update threshold field
  const handleThresholdChange = (
    key: string,
    field: 'warning' | 'critical',
    value: number
  ) => {
    setConfig({
      ...config,
      thresholds: {
        ...config.thresholds,
        [key]: {
          ...config.thresholds[key],
          [field]: value,
        },
      },
    });
  };

  // Update simulation field
  const handleSimulationChange = (field: string, value: any) => {
    setConfig({
      ...config,
      simulation: {
        ...config.simulation,
        [field]: value,
      },
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      await api.updateConfig(config);
      setStatusMessage({ text: 'System configuration saved successfully!', type: 'success' });
    } catch {
      setStatusMessage({ text: 'Configuration saved to local application state.', type: 'success' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  const handleResetDefaults = () => {
    setConfig(defaultConfiguration);
    setStatusMessage({ text: 'Configuration reset to factory defaults.', type: 'success' });
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Tab Navigation */}
      <div
        className="card"
        style={{
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          {[
            { id: 'zones', label: '1. Duct Zones', icon: Layers },
            { id: 'thresholds', label: '2. Sensor Thresholds', icon: Sliders },
            { id: 'simulation', label: '3. Simulation Engine', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  background: isActive ? 'var(--accent-secondary)' : 'var(--bg-secondary)',
                  color: isActive ? '#101D38' : 'var(--text-primary)',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border)'}`,
                  transition: 'all 0.15s ease',
                }}
              >
                <Icon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleResetDefaults}
            style={{ fontSize: '12px' }}
          >
            <RotateCcw size={14} />
            <span>Reset to Defaults</span>
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSave}
            disabled={isSaving}
            style={{ fontSize: '12px' }}
          >
            {isSaving ? <span className="spinner" style={{ width: '13px', height: '13px' }} /> : <Save size={14} />}
            <span>Save Configuration</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          style={{
            background:
              statusMessage.type === 'success'
                ? 'rgba(52, 211, 153, 0.15)'
                : 'rgba(248, 113, 113, 0.15)',
            border: `1px solid ${
              statusMessage.type === 'success'
                ? 'var(--status-normal)'
                : 'var(--status-critical)'
            }`,
            borderRadius: '6px',
            padding: '10px 14px',
            color:
              statusMessage.type === 'success'
                ? 'var(--status-normal)'
                : 'var(--status-critical)',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={16} />
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tab 1: Duct Zones */}
      {activeTab === 'zones' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {config.zones.map((zone, idx) => (
            <div key={zone.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    Zone #{idx + 1} — <span style={{ color: 'var(--accent-highlight)' }}>{zone.id.toUpperCase()}</span>
                  </h3>
                  <span className="card-subtitle">Node identity & spatial physical location</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Zone Display Name</label>
                  <input
                    type="text"
                    className="input-field"
                    value={zone.name}
                    onChange={(e) => handleZoneChange(idx, 'name', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Hardware Node ID</label>
                  <input
                    type="text"
                    className="input-field"
                    value={zone.node_id}
                    onChange={(e) => handleZoneChange(idx, 'node_id', e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Physical Location</label>
                  <input
                    type="text"
                    className="input-field"
                    value={zone.location}
                    onChange={(e) => handleZoneChange(idx, 'location', e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '14px', marginBottom: 0 }}>
                <label className="form-label">Zone Description & Function</label>
                <input
                  type="text"
                  className="input-field"
                  value={zone.description}
                  onChange={(e) => handleZoneChange(idx, 'description', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Sensor Thresholds */}
      {activeTab === 'thresholds' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <Sliders size={18} color="var(--accent-primary)" />
                <span>Alarm Limits & Critical Thresholds</span>
              </h3>
              <span className="card-subtitle">
                Set upper/lower bounds that trigger automated warning and critical alerts
              </span>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Telemetry Parameter</th>
                  <th>Unit</th>
                  <th>Warning Threshold (Yellow)</th>
                  <th>Critical Threshold (Red)</th>
                  <th>Operational Guidance</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(config.thresholds).map(([paramKey, item]: [string, ThresholdItem]) => {
                  const paramLabels: Record<string, { label: string; desc: string }> = {
                    pm2_5: {
                      label: 'PM2.5 (Fine Dust)',
                      desc: 'Threshold exceeds WHO standard; signals filter bypass',
                    },
                    pm10: {
                      label: 'PM10 (Inhalable Dust)',
                      desc: 'Coarse dust ingress from outdoor louver',
                    },
                    co2: {
                      label: 'Carbon Dioxide (CO₂)',
                      desc: 'Ventilation demand threshold',
                    },
                    air_velocity: {
                      label: 'Air Velocity (Min. Bound)',
                      desc: 'Values below bound indicate damper jam or duct clogging',
                    },
                    differential_pressure: {
                      label: 'Differential Pressure (ΔP)',
                      desc: 'High pressure indicates dirty loaded filter media',
                    },
                    power: {
                      label: 'Blower Motor Power',
                      desc: 'Motor thermal or mechanical overload threshold',
                    },
                    temperature: {
                      label: 'Air Temperature',
                      desc: 'Cooling/Heating coil supply bounds',
                    },
                    humidity: {
                      label: 'Relative Humidity',
                      desc: 'Condensation and mold growth prevention limits',
                    },
                  };

                  const meta = paramLabels[paramKey] || {
                    label: paramKey,
                    desc: 'Operational parameter',
                  };

                  return (
                    <tr key={paramKey}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{meta.label}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          {meta.desc}
                        </div>
                      </td>
                      <td style={{ color: 'var(--accent-secondary)', fontWeight: 500 }}>
                        {item.unit}
                      </td>
                      <td style={{ width: '160px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            className="input-field"
                            value={item.warning}
                            onChange={(e) =>
                              handleThresholdChange(
                                paramKey,
                                'warning',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            style={{ width: '90px', padding: '5px 8px' }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--status-warning)' }}>
                            WARN
                          </span>
                        </div>
                      </td>
                      <td style={{ width: '160px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            className="input-field"
                            value={item.critical}
                            onChange={(e) =>
                              handleThresholdChange(
                                paramKey,
                                'critical',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            style={{ width: '90px', padding: '5px 8px' }}
                          />
                          <span style={{ fontSize: '11px', color: 'var(--status-critical)' }}>
                            CRIT
                          </span>
                        </div>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Default demo baseline
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Simulation Parameters */}
      {activeTab === 'simulation' && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <Settings size={18} color="var(--accent-primary)" />
                <span>Simulation Engine Parameters</span>
              </h3>
              <span className="card-subtitle">
                Configure synthetic sensor generation interval, baseline noise, and start parameters
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label">Telemetry Sampling Interval (Seconds)</label>
              <input
                type="number"
                min="1"
                max="30"
                className="input-field"
                value={config.simulation.sampling_interval}
                onChange={(e) =>
                  handleSimulationChange(
                    'sampling_interval',
                    parseInt(e.target.value, 10) || 3
                  )
                }
              />
              <div className="form-hint">Frontend poll frequency matches this value (default: 3 seconds)</div>
            </div>

            <div className="form-group">
              <label className="form-label">Simulation Speed Multiplier</label>
              <select
                className="select-field"
                value={config.simulation.speed}
                onChange={(e) =>
                  handleSimulationChange('speed', parseFloat(e.target.value) || 1)
                }
              >
                <option value={0.5}>0.5x (Slow Motion)</option>
                <option value={1}>1.0x (Real-time)</option>
                <option value={2}>2.0x (Fast Forward)</option>
                <option value={5}>5.0x (Stress Simulation)</option>
              </select>
              <div className="form-hint">Accelerates sensor drift and diurnal cycle rates</div>
            </div>

            <div className="form-group">
              <label className="form-label">Default Boot Scenario</label>
              <select
                className="select-field"
                value={config.simulation.default_scenario}
                onChange={(e) =>
                  handleSimulationChange('default_scenario', e.target.value)
                }
              >
                <option value="normal">Normal Baseline</option>
                <option value="duct_restriction">Duct Restriction</option>
                <option value="dust_increase">Dust Ingress / Spike</option>
                <option value="damper_failure">Damper Jam</option>
                <option value="filter_clog">Filter Clog</option>
              </select>
              <div className="form-hint">Scenario loaded on simulation boot/reset</div>
            </div>

            <div className="form-group">
              <label className="form-label">Synthetic Noise Factor (%)</label>
              <input
                type="number"
                min="0"
                max="25"
                className="input-field"
                value={config.simulation.noise_factor || 5}
                onChange={(e) =>
                  handleSimulationChange(
                    'noise_factor',
                    parseInt(e.target.value, 10) || 5
                  )
                }
              />
              <div className="form-hint">Gaussian stochastic noise added to sensor readings</div>
            </div>
          </div>
        </div>
      )}

      {/* Safety Disclaimer Note */}
      <div
        style={{
          background: 'rgba(23, 39, 70, 0.5)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Engineering Notice:</strong> Default values are for demonstration purposes. Not certified HVAC life-safety or explosive dust limits.
        </span>
      </div>
    </div>
  );
};
