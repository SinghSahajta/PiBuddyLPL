import React from 'react';
import { AlertTriangle, Cpu } from 'lucide-react';
import { useSimulationStore } from '../store/simulationStore';

export const SimulationBanner: React.FC = () => {
  const { scenario, isRunning } = useSimulationStore();

  const formatScenarioName = (s: string) => {
    return s.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div
      style={{
        backgroundColor: '#FBBF24',
        color: '#101D38',
        padding: '6px 16px',
        fontSize: '12px',
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        letterSpacing: '0.04em',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.25)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertTriangle size={16} strokeWidth={2.5} />
        <span>
          ⚠ SIMULATION MODE — SYNTHETIC SENSOR DATA — Not connected to physical hardware
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '11px',
          fontWeight: 600,
          background: 'rgba(16, 29, 56, 0.12)',
          padding: '2px 10px',
          borderRadius: '4px',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Cpu size={13} />
          SCENARIO: <span style={{ textDecoration: 'underline' }}>{formatScenarioName(scenario || 'normal')}</span>
        </span>
        <span
          style={{
            display: 'inline-block',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isRunning ? '#10B981' : '#EF4444',
          }}
          title={isRunning ? 'Simulation Running' : 'Simulation Paused'}
        />
        <span>{isRunning ? 'ACTIVE' : 'PAUSED'}</span>
      </div>
    </div>
  );
};
