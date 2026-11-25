import React, { useState, useEffect } from 'react';
import {
  Download,
  Calendar,
  Wind,
  Cloud,
  Droplets,
  Gauge,
  Zap,
  CheckCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../api/client';
import { StatusBadge } from '../components/StatusBadge';
import type { Alert, MaintenanceRecord } from '../types';

export const Reports: React.FC = () => {
  // 24 hours default
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const formatDateForInput = (d: Date) => {
    return d.toISOString().slice(0, 16);
  };

  const [startDate, setStartDate] = useState(formatDateForInput(yesterday));
  const [endDate, setEndDate] = useState(formatDateForInput(now));
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Multi-series historical chart telemetry
  const [telemetrySeries, setTelemetrySeries] = useState<any[]>([]);

  const [alertHistory] = useState<Alert[]>([
    {
      id: 201,
      alert_id: 'ALT-201',
      timestamp: new Date(now.getTime() - 3600000 * 2).toISOString(),
      severity: 'critical',
      zone_id: 'zone_b',
      parameter: 'Air Velocity',
      observed_value: 1.85,
      baseline_value: 3.2,
      unit: 'm/s',
      title: 'Severe Duct Airflow Restriction',
      explanation: 'Air velocity plunged below 2.0 m/s critical threshold.',
      action: 'Emergency damper inspection and plenum clearing',
      status: 'resolved',
    },
    {
      id: 202,
      alert_id: 'ALT-202',
      timestamp: new Date(now.getTime() - 3600000 * 7).toISOString(),
      severity: 'warning',
      zone_id: 'zone_a',
      parameter: 'PM2.5',
      observed_value: 29.4,
      baseline_value: 12.0,
      unit: 'µg/m³',
      title: 'Intake Filter Dust Breach',
      explanation: 'Transient outdoor dust ingress through intake damper.',
      action: 'Check intake louver pre-filter screen',
      status: 'resolved',
    },
    {
      id: 203,
      alert_id: 'ALT-203',
      timestamp: new Date(now.getTime() - 3600000 * 14).toISOString(),
      severity: 'warning',
      zone_id: 'zone_c',
      parameter: 'CO2',
      observed_value: 890,
      baseline_value: 550,
      unit: 'ppm',
      title: 'Return Loop Elevated CO2',
      explanation: 'Occupancy load increase during peak operating shift.',
      action: 'Increase fresh air intake ratio by 15%',
      status: 'resolved',
    },
  ]);

  const [maintenanceHistory] = useState<MaintenanceRecord[]>([
    {
      id: 301,
      timestamp: new Date(now.getTime() - 3600000 * 3).toISOString(),
      zone_id: 'zone_b',
      action_type: 'cleaning',
      description: 'Cleared debris accumulation around branch junction damper',
      performed_by: 'Alex M. (Lead Mech)',
      before_value: 1.85,
      after_value: 3.1,
      unit: 'm/s',
      notes: 'Damper mechanical linkage lubricated with silicone grease.',
    },
    {
      id: 302,
      timestamp: new Date(now.getTime() - 3600000 * 8).toISOString(),
      zone_id: 'zone_a',
      action_type: 'filter_replacement',
      description: 'Replaced primary intake pre-filter panel',
      performed_by: 'Facility Service Team',
      before_value: 29.4,
      after_value: 11.2,
      unit: 'µg/m³',
      notes: 'New MERV-13 filter panel installed and pressure tested.',
    },
  ]);

  // Generate realistic 24-hour historical telemetry points
  useEffect(() => {
    const points = [];
    const count = 24; // 1 point per hour
    const startMs = new Date(startDate).getTime();
    const endMs = new Date(endDate).getTime();
    const step = (endMs - startMs) / count;

    for (let i = 0; i <= count; i++) {
      const t = new Date(startMs + i * step);
      const timeStr = t.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
        t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Daily diurnal variation
      const hour = t.getHours();
      const loadFactor = Math.sin((hour - 6) / 24 * Math.PI * 2);

      points.push({
        time: timeStr,
        pm25_a: Number((12 + Math.random() * 3 + (hour > 8 && hour < 18 ? 3 : 0)).toFixed(1)),
        pm25_b: Number((15 + Math.random() * 4 + (hour > 8 && hour < 18 ? 4 : 0)).toFixed(1)),
        pm25_c: Number((13 + Math.random() * 2 + (hour > 8 && hour < 18 ? 2 : 0)).toFixed(1)),
        co2: Math.round(520 + loadFactor * 180 + Math.random() * 40),
        velocity_a: Number((3.1 + Math.random() * 0.2).toFixed(2)),
        velocity_b: Number((i > 18 && i < 22 ? 2.1 : 3.0 + Math.random() * 0.25).toFixed(2)),
        velocity_c: Number((2.8 + Math.random() * 0.2).toFixed(2)),
        pressure: Number((120 + loadFactor * 25 + Math.random() * 8).toFixed(1)),
        power: Math.round(3800 + loadFactor * 800 + Math.random() * 150),
      });
    }

    setTelemetrySeries(points);
  }, [startDate, endDate]);

  const handleExportCSV = async () => {
    setIsExporting(true);
    setExportNotice(null);

    try {
      const res = await api.exportCSV({
        start_date: startDate,
        end_date: endDate,
        zone_id: selectedZone !== 'all' ? selectedZone : undefined,
      });

      // Trigger browser download
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pibuddy_hvac_telemetry_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportNotice('Telemetry CSV successfully exported!');
    } catch {
      // Generate synthetic CSV on client side if backend export endpoint is starting up
      const headers = 'timestamp,zone,pm1_0,pm2_5,pm10,co2,air_velocity,diff_pressure,power,voltage,is_simulated\n';
      const rows = telemetrySeries.map((row) =>
        `"${row.time}","Zone B",8.2,${row.pm25_b},24.1,${row.co2},${row.velocity_b},${row.pressure},${row.power},230.2,TRUE`
      ).join('\n');

      const blob = new Blob([headers + rows], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pibuddy_simulated_export_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportNotice('Simulated Telemetry CSV exported successfully!');
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportNotice(null), 4000);
    }
  };

  const handleQuickPreset = (hours: number) => {
    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600000);
    setStartDate(formatDateForInput(start));
    setEndDate(formatDateForInput(end));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Filter Bar & Export Actions */}
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
            <Calendar size={16} color="var(--accent-primary)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Historical Range:
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>From:</label>
            <input
              type="datetime-local"
              className="input-field"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '190px', padding: '6px 10px', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>To:</label>
            <input
              type="datetime-local"
              className="input-field"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '190px', padding: '6px 10px', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Zone:</label>
            <select
              className="select-field"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              style={{ width: '130px', padding: '6px 10px', fontSize: '12px' }}
            >
              <option value="all">All Zones</option>
              <option value="zone_a">Zone A</option>
              <option value="zone_b">Zone B</option>
              <option value="zone_c">Zone C</option>
            </select>
          </div>

          {/* Quick presets */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {[
              { label: '1H', h: 1 },
              { label: '6H', h: 6 },
              { label: '24H', h: 24 },
              { label: '7D', h: 168 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                className="btn-secondary"
                onClick={() => handleQuickPreset(p.h)}
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            type="button"
            className="btn-primary"
            onClick={handleExportCSV}
            disabled={isExporting}
          >
            {isExporting ? <span className="spinner" style={{ width: '14px', height: '14px' }} /> : <Download size={15} />}
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div
          style={{
            background: 'rgba(52, 211, 153, 0.15)',
            border: '1px solid var(--status-normal)',
            borderRadius: '6px',
            padding: '8px 12px',
            color: 'var(--status-normal)',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <CheckCircle size={15} />
          <span>{exportNotice}</span>
        </div>
      )}

      {/* 2. Charts Section */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Chart 1: PM2.5 Dust Trend across zones */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <Cloud size={18} color="var(--accent-primary)" />
                <span>PM2.5 Dust Telemetry Trend (µg/m³)</span>
              </h3>
              <span className="card-subtitle">Comparative historical dust concentrations across Zone A, B, and C</span>
            </div>
          </div>

          <div style={{ height: '220px', width: '100%', marginTop: '6px' }}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={telemetrySeries} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#304968" />
                <XAxis dataKey="time" tick={{ fill: '#A9BED8', fontSize: 11 }} />
                <YAxis tick={{ fill: '#A9BED8', fontSize: 11 }} unit=" µg" />
                <Tooltip
                  contentStyle={{
                    background: '#1D3557',
                    border: '1px solid #304968',
                    borderRadius: 8,
                    color: '#F4F8FF',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="pm25_a" name="Zone A (Intake)" stroke="#8FCBFF" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pm25_b" name="Zone B (Plenum)" stroke="#FBBF24" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="pm25_c" name="Zone C (Return)" stroke="#34D399" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2 & 3: CO2 and Air Velocity in 2 cols */}
        <div className="grid-two">
          {/* CO2 Trend */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Droplets size={18} color="var(--accent-secondary)" />
                  <span>CO₂ Concentration Trend (ppm)</span>
                </h3>
                <span className="card-subtitle">Building occupancy and ventilation air exchange</span>
              </div>
            </div>

            <div style={{ height: '200px', width: '100%', marginTop: '6px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={telemetrySeries} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#304968" />
                  <XAxis dataKey="time" tick={{ fill: '#A9BED8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#A9BED8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1D3557',
                      border: '1px solid #304968',
                      borderRadius: 8,
                      color: '#F4F8FF',
                    }}
                  />
                  <Line type="monotone" dataKey="co2" name="Return CO₂ (ppm)" stroke="#5DA9E9" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Air Velocity Trend */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Wind size={18} color="var(--accent-highlight)" />
                  <span>Duct Air Velocity (m/s)</span>
                </h3>
                <span className="card-subtitle">Airflow distribution across branches</span>
              </div>
            </div>

            <div style={{ height: '200px', width: '100%', marginTop: '6px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={telemetrySeries} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#304968" />
                  <XAxis dataKey="time" tick={{ fill: '#A9BED8', fontSize: 11 }} />
                  <YAxis domain={[1.5, 4.0]} tick={{ fill: '#A9BED8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1D3557',
                      border: '1px solid #304968',
                      borderRadius: 8,
                      color: '#F4F8FF',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Line type="monotone" dataKey="velocity_a" name="Zone A" stroke="#8FCBFF" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="velocity_b" name="Zone B" stroke="#FBBF24" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="velocity_c" name="Zone C" stroke="#34D399" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Chart 4 & 5: Differential Pressure & Power Consumption */}
        <div className="grid-two">
          {/* Diff Pressure */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Gauge size={18} color="#34D399" />
                  <span>Differential Pressure (Pa)</span>
                </h3>
                <span className="card-subtitle">Filter restriction & duct aerodynamic resistance</span>
              </div>
            </div>

            <div style={{ height: '200px', width: '100%', marginTop: '6px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={telemetrySeries} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#304968" />
                  <XAxis dataKey="time" tick={{ fill: '#A9BED8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#A9BED8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1D3557',
                      border: '1px solid #304968',
                      borderRadius: 8,
                      color: '#F4F8FF',
                    }}
                  />
                  <Line type="monotone" dataKey="pressure" name="ΔP (Pa)" stroke="#34D399" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Power Consumption */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Zap size={18} color="var(--status-warning)" />
                  <span>Blower Electrical Power (W)</span>
                </h3>
                <span className="card-subtitle">Motor electrical load & variable speed drive consumption</span>
              </div>
            </div>

            <div style={{ height: '200px', width: '100%', marginTop: '6px' }}>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={telemetrySeries} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#304968" />
                  <XAxis dataKey="time" tick={{ fill: '#A9BED8', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#A9BED8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: '#1D3557',
                      border: '1px solid #304968',
                      borderRadius: 8,
                      color: '#F4F8FF',
                    }}
                  />
                  <Line type="monotone" dataKey="power" name="Power (W)" stroke="#FBBF24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Alert History Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Historical Alert Audit Log</h3>
            <span className="card-subtitle">Threshold infractions recorded within the selected timeframe</span>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Alert ID</th>
                <th>Zone</th>
                <th>Severity</th>
                <th>Parameter</th>
                <th>Observed vs Baseline</th>
                <th>Diagnosis & Status</th>
              </tr>
            </thead>
            <tbody>
              {alertHistory.map((al) => (
                <tr key={al.id}>
                  <td style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(al.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent-primary)' }}>
                    {al.alert_id}
                  </td>
                  <td>
                    <strong style={{ color: 'var(--accent-highlight)' }}>
                      {al.zone_id.toUpperCase()}
                    </strong>
                  </td>
                  <td>
                    <StatusBadge status={al.severity} size="sm" />
                  </td>
                  <td>{al.parameter}</td>
                  <td>
                    <span style={{ color: 'var(--status-critical)', fontWeight: 600 }}>
                      {al.observed_value} {al.unit}
                    </span>
                    <span style={{ margin: '0 4px', color: 'var(--text-secondary)' }}>/</span>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {al.baseline_value} {al.unit}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '12px' }}>{al.title}</div>
                    <div style={{ fontSize: '11px', color: 'var(--status-normal)', textTransform: 'capitalize' }}>
                      Status: {al.status}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Maintenance History Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Intervention & Maintenance Record History</h3>
            <span className="card-subtitle">Resolved duct cleaning and component service operations</span>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Zone</th>
                <th>Action Type</th>
                <th>Description</th>
                <th>Technician</th>
                <th>Verified Impact</th>
              </tr>
            </thead>
            <tbody>
              {maintenanceHistory.map((mh) => (
                <tr key={mh.id}>
                  <td style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {new Date(mh.timestamp).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td>
                    <strong style={{ color: 'var(--accent-highlight)' }}>
                      {mh.zone_id.toUpperCase()}
                    </strong>
                  </td>
                  <td style={{ textTransform: 'capitalize' }}>
                    {mh.action_type.replace(/_/g, ' ')}
                  </td>
                  <td style={{ fontSize: '12px' }}>{mh.description}</td>
                  <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{mh.performed_by}</td>
                  <td>
                    {mh.before_value !== undefined ? (
                      <span style={{ fontSize: '12px' }}>
                        <span style={{ color: 'var(--status-critical)' }}>{mh.before_value}</span>
                        {' → '}
                        <span style={{ color: 'var(--status-normal)', fontWeight: 600 }}>
                          {mh.after_value} {mh.unit}
                        </span>
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Simulated export footer note */}
      <div
        style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.4)',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '12px',
          color: 'var(--status-warning)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <span>
          [SIMULATED DATA] Exported records are synthetic telemetry generated by the PiBuddy HVAC simulation model.
        </span>
      </div>
    </div>
  );
};
