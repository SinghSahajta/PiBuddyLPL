import React, { useState } from 'react';
import {
  Bell,
  Wrench,
  Filter,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  ClipboardList,
  PlusCircle,
} from 'lucide-react';
import { api } from '../api/client';
import { useSimulationStore } from '../store/simulationStore';
import { usePolling } from '../hooks/usePolling';
import { AlertItem } from '../components/AlertItem';
import type { MaintenanceRecord } from '../types';

export const Alerts: React.FC = () => {
  const { alerts, setAlerts } = useSimulationStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [processingId, setProcessingId] = useState<number | string | null>(null);

  // Maintenance state
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([
    {
      id: 1,
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      zone_id: 'zone_a',
      action_type: 'filter_replacement',
      description: 'Replaced primary intake MERV-13 pre-filter cartridge',
      performed_by: 'HVAC Tech #41',
      notes: 'Initial pressure drop was 165 Pa; post-replacement measured 85 Pa.',
      before_value: 165,
      after_value: 85,
      unit: 'Pa',
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
      zone_id: 'zone_b',
      action_type: 'cleaning',
      description: 'Ultrasonic sensor head cleaning on laser optical particle counter',
      performed_by: 'Automation Lead',
      notes: 'Cleaned optics to eliminate false positive dust spikes.',
      before_value: 28.5,
      after_value: 12.2,
      unit: 'µg/m³',
    },
  ]);

  const [formZone, setFormZone] = useState<string>('zone_a');
  const [formActionType, setFormActionType] = useState<MaintenanceRecord['action_type']>('cleaning');
  const [formDesc, setFormDesc] = useState<string>('');
  const [formTech, setFormTech] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false);
  const [maintenanceSuccess, setMaintenanceSuccess] = useState<string | null>(null);

  // Fetch alerts & maintenance records
  const fetchAlertsData = async () => {
    try {
      const res = await api.getAlerts({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        zone_id: zoneFilter !== 'all' ? zoneFilter : undefined,
        severity: severityFilter !== 'all' ? severityFilter : undefined,
      });

      if (res.data) {
        setAlerts(res.data);
      }
    } catch {
      // Keep existing alerts if local
    }
  };

  usePolling(fetchAlertsData, 3000);

  // Acknowledge alert
  const handleAcknowledge = async (id: number | string) => {
    setProcessingId(id);
    try {
      await api.acknowledgeAlert(id);
      setAlerts(
        alerts.map((a) => (a.id === id ? { ...a, status: 'acknowledged' } : a))
      );
    } catch {
      // Optimistic update
      setAlerts(
        alerts.map((a) => (a.id === id ? { ...a, status: 'acknowledged' } : a))
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Resolve alert
  const handleResolve = async (id: number | string) => {
    setProcessingId(id);
    try {
      await api.resolveAlert(id);
      setAlerts(
        alerts.map((a) => (a.id === id ? { ...a, status: 'resolved' } : a))
      );
    } catch {
      // Optimistic update
      setAlerts(
        alerts.map((a) => (a.id === id ? { ...a, status: 'resolved' } : a))
      );
    } finally {
      setProcessingId(null);
    }
  };

  // Submit Maintenance form
  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDesc || !formTech) return;

    setSubmittingMaintenance(true);
    const newRecord: MaintenanceRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      zone_id: formZone,
      action_type: formActionType,
      description: formDesc,
      performed_by: formTech,
      notes: formNotes,
    };

    try {
      await api.createMaintenance(newRecord);
      setMaintenanceRecords([newRecord, ...maintenanceRecords]);
      setFormDesc('');
      setFormNotes('');
      setMaintenanceSuccess(`Maintenance logged for ${formZone.toUpperCase()}`);
      setTimeout(() => setMaintenanceSuccess(null), 3000);
    } catch {
      // Fallback
      setMaintenanceRecords([newRecord, ...maintenanceRecords]);
      setFormDesc('');
      setFormNotes('');
      setMaintenanceSuccess(`Maintenance logged locally for ${formZone.toUpperCase()}`);
      setTimeout(() => setMaintenanceSuccess(null), 3000);
    } finally {
      setSubmittingMaintenance(false);
    }
  };

  // Quick Action: Simulate Cleaning for a specific zone
  const handleQuickCleaning = async (zoneId: string) => {
    const cleaningRecord: MaintenanceRecord = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      zone_id: zoneId,
      action_type: 'cleaning',
      description: `Quick automated duct wash & sensor purge on ${zoneId.toUpperCase()}`,
      performed_by: 'Simulated Auto-Purge',
      notes: 'Cleared residual dust deposits and normalized differential pressure baseline.',
      before_value: 24.8,
      after_value: 9.5,
      unit: 'µg/m³',
    };

    try {
      await api.createMaintenance(cleaningRecord);
    } catch {
      // Continue
    }

    setMaintenanceRecords([cleaningRecord, ...maintenanceRecords]);
    // Also resolve any alerts for this zone
    setAlerts(
      alerts.map((a) => (a.zone_id === zoneId ? { ...a, status: 'resolved' } : a))
    );
    setMaintenanceSuccess(`Completed simulated cleaning on ${zoneId.toUpperCase()}`);
    setTimeout(() => setMaintenanceSuccess(null), 3500);
  };

  // Filter alerts in memory
  const filteredAlerts = alerts.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (zoneFilter !== 'all' && a.zone_id !== zoneFilter) return false;
    if (severityFilter !== 'all' && a.severity !== severityFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Alerts Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <Bell size={18} color="var(--accent-primary)" />
              <span>Active Alerts & Anomaly Feed</span>
            </h3>
            <span className="card-subtitle">
              Sensor limit exceedances, pattern shifts, and predictive diagnostic notifications
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="badge-normal" style={{ fontSize: '11px' }}>
              Total: {alerts.length}
            </span>
            <span className="badge-critical" style={{ fontSize: '11px' }}>
              Active: {alerts.filter((a) => a.status === 'active').length}
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Filter size={15} color="var(--accent-secondary)" />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Filters:
              </span>
            </div>

            {/* Status Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Status:</label>
              <select
                className="select-field"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '130px', padding: '5px 8px', fontSize: '12px' }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="acknowledged">Acknowledged</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>

            {/* Zone Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Zone:</label>
              <select
                className="select-field"
                value={zoneFilter}
                onChange={(e) => setZoneFilter(e.target.value)}
                style={{ width: '120px', padding: '5px 8px', fontSize: '12px' }}
              >
                <option value="all">All Zones</option>
                <option value="zone_a">Zone A</option>
                <option value="zone_b">Zone B</option>
                <option value="zone_c">Zone C</option>
              </select>
            </div>

            {/* Severity Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Severity:</label>
              <select
                className="select-field"
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                style={{ width: '120px', padding: '5px 8px', fontSize: '12px' }}
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="warning">Warning</option>
                <option value="info">Info</option>
              </select>
            </div>
          </div>

          {(statusFilter !== 'all' || zoneFilter !== 'all' || severityFilter !== 'all') && (
            <button
              className="btn-secondary"
              onClick={() => {
                setStatusFilter('all');
                setZoneFilter('all');
                setSeverityFilter('all');
              }}
              style={{ padding: '4px 10px', fontSize: '11px' }}
            >
              <RotateCcw size={12} />
              Reset Filters
            </button>
          )}
        </div>

        {/* Alert List */}
        <div>
          {filteredAlerts.length === 0 ? (
            <div className="empty-state">
              <CheckCircle2 size={32} color="var(--status-normal)" style={{ marginBottom: '8px' }} />
              <p>No alerts match your filter criteria.</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <AlertItem
                key={alert.id || alert.alert_id}
                alert={alert}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
                isProcessing={processingId === alert.id}
              />
            ))
          )}
        </div>
      </div>

      {/* 2. Maintenance Management Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.4fr)', gap: '20px' }}>
        {/* Left: Log Maintenance Action Form & Quick Clean */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <Wrench size={18} color="var(--accent-primary)" />
                <span>Log Maintenance Action</span>
              </h3>
              <span className="card-subtitle">
                Record duct intervention, filter swaps, and calibration events
              </span>
            </div>
          </div>

          {maintenanceSuccess && (
            <div
              style={{
                background: 'rgba(52, 211, 153, 0.15)',
                border: '1px solid var(--status-normal)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--status-normal)',
                fontSize: '12px',
                marginBottom: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={15} />
              <span>{maintenanceSuccess}</span>
            </div>
          )}

          {/* Quick Action: Simulate Cleaning Buttons */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '16px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--accent-highlight)',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <Sparkles size={13} />
              Quick Action: Simulate Duct Cleaning
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['zone_a', 'zone_b', 'zone_c'].map((zid) => (
                <button
                  key={zid}
                  type="button"
                  className="btn-secondary"
                  onClick={() => handleQuickCleaning(zid)}
                  style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
                >
                  <Sparkles size={12} color="var(--accent-primary)" />
                  <span>Clean {zid.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleMaintenanceSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Target Zone</label>
                <select
                  className="select-field"
                  value={formZone}
                  onChange={(e) => setFormZone(e.target.value)}
                >
                  <option value="zone_a">Zone A (Intake)</option>
                  <option value="zone_b">Zone B (Plenum)</option>
                  <option value="zone_c">Zone C (Return)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Action Type</label>
                <select
                  className="select-field"
                  value={formActionType}
                  onChange={(e) =>
                    setFormActionType(e.target.value as MaintenanceRecord['action_type'])
                  }
                >
                  <option value="cleaning">Duct Cleaning & Wash</option>
                  <option value="filter_replacement">Filter Replacement</option>
                  <option value="inspection">Physical Inspection</option>
                  <option value="calibration">Sensor Calibration</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description of Work</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="e.g. Cleared heavy dust deposit from supply damper..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Technician / Performed By</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. John Doe (HVAC Specialist)"
                value={formTech}
                onChange={(e) => setFormTech(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Observation Notes (Optional)</label>
              <textarea
                className="textarea-field"
                rows={2}
                placeholder="Before/after pressure readings or sensor baseline adjustments..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={submittingMaintenance}
              style={{ width: '100%', marginTop: '6px' }}
            >
              {submittingMaintenance ? (
                <span className="spinner" style={{ width: '14px', height: '14px' }} />
              ) : (
                <PlusCircle size={15} />
              )}
              <span>Log Maintenance Record</span>
            </button>
          </form>
        </div>

        {/* Right: Recent Maintenance Records Table */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <ClipboardList size={18} color="var(--accent-primary)" />
                <span>Intervention History</span>
              </h3>
              <span className="card-subtitle">
                Historical maintenance log with verified before/after parameter impact
              </span>
            </div>
          </div>

          <div className="table-container" style={{ flex: 1 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Zone</th>
                  <th>Action</th>
                  <th>Details & Performed By</th>
                  <th>Before / After</th>
                </tr>
              </thead>
              <tbody>
                {maintenanceRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {new Date(rec.timestamp).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}{' '}
                      {new Date(rec.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--accent-highlight)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {rec.zone_id}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(143, 203, 255, 0.1)',
                          color: 'var(--accent-primary)',
                          textTransform: 'capitalize',
                        }}
                      >
                        {rec.action_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: '2px' }}>
                        {rec.description}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        By: {rec.performed_by}
                      </div>
                    </td>
                    <td>
                      {rec.before_value !== undefined && rec.after_value !== undefined ? (
                        <div style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>
                          <span style={{ color: 'var(--status-critical)' }}>
                            {rec.before_value}
                          </span>
                          {' → '}
                          <span style={{ color: 'var(--status-normal)', fontWeight: 600 }}>
                            {rec.after_value} {rec.unit}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Completed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
