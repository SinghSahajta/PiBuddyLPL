import React, { type ReactNode } from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { StatusBadge, type SystemStatus } from './StatusBadge';

export interface SensorCardProps {
  label: string;
  value: number | null;
  unit: string;
  status: 'normal' | 'warning' | 'critical' | 'offline' | SystemStatus;
  trend?: number[]; // sparkline data
  icon?: ReactNode;
  description?: string;
  precision?: number;
}

export const SensorCard: React.FC<SensorCardProps> = ({
  label,
  value,
  unit,
  status,
  trend,
  icon,
  description,
  precision = 1,
}) => {
  const formattedValue =
    value === null || value === undefined
      ? '--'
      : Number(value).toFixed(precision);

  // Fallback trend if none supplied
  const sparklineData = (
    trend && trend.length > 1
      ? trend
      : value !== null
      ? [value * 0.98, value * 1.01, value * 0.99, value * 1.02, value]
      : [0, 0, 0, 0, 0]
  ).map((val, idx) => ({ idx, val }));

  // Color selection based on status
  const getLineColor = (s: string) => {
    switch (s) {
      case 'warning':
        return 'var(--status-warning)';
      case 'critical':
      case 'danger':
        return 'var(--status-critical)';
      case 'offline':
        return 'var(--status-offline)';
      default:
        return 'var(--accent-primary)';
    }
  };

  const getBorderColor = (s: string) => {
    switch (s) {
      case 'critical':
        return 'rgba(248, 113, 113, 0.4)';
      case 'warning':
        return 'rgba(251, 191, 36, 0.4)';
      default:
        return 'var(--border)';
    }
  };

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderColor: getBorderColor(status),
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {icon && (
              <span
                style={{
                  color: 'var(--accent-primary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {icon}
              </span>
            )}
            <span
              style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                letterSpacing: '0.02em',
                textTransform: 'uppercase',
              }}
            >
              {label}
            </span>
          </div>
          <StatusBadge status={status} size="sm" />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: '6px',
            marginBottom: '6px',
          }}
        >
          <span
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              letterSpacing: '-0.02em',
            }}
          >
            {formattedValue}
          </span>
          <span
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: 'var(--accent-secondary)',
            }}
          >
            {unit}
          </span>
        </div>

        {description && (
          <p
            style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              lineHeight: 1.4,
              marginBottom: '10px',
            }}
          >
            {description}
          </p>
        )}
      </div>

      <div style={{ height: '38px', width: '100%', marginTop: '6px' }}>
        <ResponsiveContainer width="100%" height={38}>
          <LineChart data={sparklineData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
            <Line
              type="monotone"
              dataKey="val"
              stroke={getLineColor(status)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
