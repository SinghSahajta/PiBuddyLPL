import React from 'react';
import type { ZoneSummary } from '../types';
import { StatusBadge } from './StatusBadge';
import { Wind, Gauge, AlertCircle, Cloud, Droplets } from 'lucide-react';

interface ZoneStatusCardProps {
  summary: ZoneSummary;
  nodeId?: string;
  onClick?: () => void;
  isSelected?: boolean;
}

export const ZoneStatusCard: React.FC<ZoneStatusCardProps> = ({
  summary,
  nodeId,
  onClick,
  isSelected = false,
}) => {
  const status = (summary.status || 'normal').toLowerCase();

  const getBorderColor = (s: string) => {
    switch (s) {
      case 'critical':
      case 'danger':
        return 'var(--status-critical)';
      case 'warning':
        return 'var(--status-warning)';
      case 'offline':
        return 'var(--status-offline)';
      default:
        return 'var(--status-normal)';
    }
  };

  const getGlow = (s: string) => {
    switch (s) {
      case 'critical':
        return '0 0 12px rgba(248, 113, 113, 0.25)';
      case 'warning':
        return '0 0 10px rgba(251, 191, 36, 0.2)';
      default:
        return '0 0 8px rgba(52, 211, 153, 0.15)';
    }
  };

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        borderLeftWidth: '5px',
        borderLeftColor: getBorderColor(status),
        boxShadow: isSelected ? getGlow(status) : undefined,
        outline: isSelected ? `2px solid var(--accent-primary)` : 'none',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '2px',
            }}
          >
            {summary.zone_name || summary.zone_id.toUpperCase()}
          </h3>
          <span
            style={{
              fontSize: '11px',
              color: 'var(--accent-primary)',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
            }}
          >
            {nodeId || summary.zone_id}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {summary.alert_count > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--status-critical)',
                background: 'rgba(248, 113, 113, 0.12)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(248, 113, 113, 0.3)',
              }}
            >
              <AlertCircle size={12} />
              {summary.alert_count}
            </span>
          )}
          <StatusBadge status={status} size="sm" />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '12px',
          paddingTop: '10px',
          borderTop: '1px solid rgba(48, 73, 104, 0.5)',
        }}
      >
        {/* PM2.5 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cloud size={15} color="var(--accent-primary)" />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>PM2.5</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {summary.pm2_5 !== undefined ? `${Number(summary.pm2_5).toFixed(1)} µg/m³` : '--'}
            </div>
          </div>
        </div>

        {/* CO2 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Droplets size={15} color="var(--accent-secondary)" />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>CO₂</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {summary.co2 !== undefined ? `${Math.round(summary.co2)} ppm` : '--'}
            </div>
          </div>
        </div>

        {/* Velocity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wind size={15} color="var(--accent-highlight)" />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Air Velocity</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {summary.air_velocity !== undefined ? `${Number(summary.air_velocity).toFixed(2)} m/s` : '--'}
            </div>
          </div>
        </div>

        {/* Pressure */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Gauge size={15} color="#34D399" />
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Diff. Pressure</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {summary.differential_pressure !== undefined
                ? `${Number(summary.differential_pressure).toFixed(1)} Pa`
                : '--'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
