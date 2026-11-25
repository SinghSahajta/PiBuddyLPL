import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Zap,
  Sliders,
  CheckCircle,
} from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';
import { api } from '../api/client';

interface SimulationPanelProps {
  compact?: boolean;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  compact = false,
}) => {
  const {
    isRunning,
    scenario,
    affectedZone,
    speed,
    setRunning,
    setScenario,
    setSpeed,
  } = useSimulationStore();

  const [selectedScenario, setSelectedScenario] = useState<string>(scenario || 'normal');
  const [selectedZone, setSelectedZone] = useState<string>(affectedZone || 'zone_a');
  const [selectedSpeed, setSelectedSpeed] = useState<number>(speed || 1);
  const [isApplying, setIsApplying] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const scenarios = [
    { id: 'normal', name: 'Normal Operation', needsZone: false },
    { id: 'duct_restriction', name: 'Duct Restriction / Blockage', needsZone: true },
    { id: 'dust_increase', name: 'Dust Ingress / Spike', needsZone: true },
    { id: 'damper_failure', name: 'Damper Actuator Failure', needsZone: true },
    { id: 'filter_clog', name: 'Filter Heavy Clogging', needsZone: true },
    { id: 'sensor_drift', name: 'Sensor Calibration Drift', needsZone: true },
  ];

  const currentScenarioObj = scenarios.find((s) => s.id === selectedScenario);
  const requiresZone = currentScenarioObj ? currentScenarioObj.needsZone : false;

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const handleTogglePlay = async () => {
    try {
      if (isRunning) {
        await api.pauseSimulation();
        setRunning(false);
        showFeedback('Simulation Paused');
      } else {
        await api.startSimulation();
        setRunning(true);
        showFeedback('Simulation Running');
      }
    } catch {
      // Local fallback for offline/disconnected demo
      setRunning(!isRunning);
      showFeedback(isRunning ? 'Paused (offline)' : 'Started (offline)');
    }
  };

  const handleReset = async () => {
    try {
      await api.resetSimulation();
      setScenario('normal');
      setSelectedScenario('normal');
      setSelectedSpeed(1);
      setSpeed(1);
      showFeedback('Simulation Reset');
    } catch {
      setScenario('normal');
      setSelectedScenario('normal');
      showFeedback('Reset (offline)');
    }
  };

  const handleApplyScenario = async () => {
    setIsApplying(true);
    try {
      await api.setScenario({
        scenario: selectedScenario,
        affected_zone: requiresZone ? selectedZone : undefined,
        speed: selectedSpeed,
      });
      setScenario(selectedScenario, requiresZone ? selectedZone : undefined);
      setSpeed(selectedSpeed);
      showFeedback(`Applied: ${selectedScenario.replace(/_/g, ' ')}`);
    } catch {
      // Fallback
      setScenario(selectedScenario, requiresZone ? selectedZone : undefined);
      setSpeed(selectedSpeed);
      showFeedback(`Set local: ${selectedScenario.replace(/_/g, ' ')}`);
    } finally {
      setIsApplying(false);
    }
  };

  if (compact) {
    return (
      <div
        style={{
          background: 'rgba(16, 29, 56, 0.65)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              letterSpacing: '0.05em',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Sliders size={12} color="var(--accent-primary)" />
            Simulation Engine
          </span>

          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              fontWeight: 600,
              color: isRunning ? 'var(--status-normal)' : 'var(--status-critical)',
            }}
          >
            <span
              className={`status-dot ${isRunning ? 'normal' : 'critical'}`}
              style={{ width: '6px', height: '6px' }}
            />
            {isRunning ? 'RUNNING' : 'PAUSED'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
          <button
            onClick={handleTogglePlay}
            className={isRunning ? 'btn-secondary' : 'btn-primary'}
            style={{ flex: 1, padding: '6px 8px', fontSize: '11px' }}
            title={isRunning ? 'Pause' : 'Play'}
          >
            {isRunning ? <Pause size={13} /> : <Play size={13} />}
            <span>{isRunning ? 'Pause' : 'Start'}</span>
          </button>

          <button
            onClick={handleReset}
            className="btn-secondary"
            style={{ padding: '6px 8px', fontSize: '11px' }}
            title="Reset Simulation"
          >
            <RotateCcw size={13} />
          </button>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
          Active: <strong style={{ color: 'var(--accent-primary)' }}>{scenario}</strong>
          {affectedZone && (
            <span style={{ color: 'var(--status-warning)' }}> ({affectedZone})</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">
          <Zap size={18} color="var(--accent-primary)" />
          <span>HVAC Simulation Controller</span>
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            className={isRunning ? 'badge-normal' : 'badge-critical'}
            style={{ fontSize: '11px' }}
          >
            <span className={`status-dot ${isRunning ? 'normal' : 'critical'}`} />
            {isRunning ? 'Engine Running' : 'Simulation Paused'}
          </span>
        </div>
      </div>

      {feedbackMsg && (
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
          <CheckCircle size={14} />
          <span>{feedbackMsg}</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        {/* Scenario Selection */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Simulation Scenario</label>
          <select
            className="select-field"
            value={selectedScenario}
            onChange={(e) => setSelectedScenario(e.target.value)}
          >
            {scenarios.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Target Zone */}
        {requiresZone && (
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Affected Target Zone</label>
            <select
              className="select-field"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
            >
              <option value="zone_a">Zone A — Main Intake / Filter</option>
              <option value="zone_b">Zone B — Branch Junction & Blower</option>
              <option value="zone_c">Zone C — End Return / Terminal</option>
            </select>
          </div>
        )}

        {/* Speed multiplier */}
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Simulation Speed Multiplier</label>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[0.5, 1, 2, 5].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setSelectedSpeed(spd)}
                style={{
                  flex: 1,
                  padding: '7px 4px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background:
                    selectedSpeed === spd
                      ? 'var(--accent-secondary)'
                      : 'var(--bg-secondary)',
                  color: selectedSpeed === spd ? '#101D38' : 'var(--text-secondary)',
                  border: `1px solid ${
                    selectedSpeed === spd ? 'var(--accent-primary)' : 'var(--border)'
                  }`,
                }}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: '14px',
          borderTop: '1px solid rgba(48, 73, 104, 0.6)',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className={isRunning ? 'btn-secondary' : 'btn-success'}
            onClick={handleTogglePlay}
          >
            {isRunning ? <Pause size={15} /> : <Play size={15} />}
            <span>{isRunning ? 'Pause Engine' : 'Resume Simulation'}</span>
          </button>

          <button
            type="button"
            className="btn-secondary"
            onClick={handleReset}
          >
            <RotateCcw size={15} />
            <span>Reset Normal</span>
          </button>
        </div>

        <button
          type="button"
          className="btn-primary"
          onClick={handleApplyScenario}
          disabled={isApplying}
        >
          {isApplying ? (
            <span className="spinner" style={{ width: '14px', height: '14px' }} />
          ) : (
            <Zap size={15} />
          )}
          <span>Apply Scenario</span>
        </button>
      </div>
    </div>
  );
};
