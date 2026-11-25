import React from 'react';

export type SystemStatus = 'normal' | 'warning' | 'critical' | 'offline' | string;

interface StatusBadgeProps {
  status: SystemStatus;
  label?: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  size = 'md',
}) => {
  const normalized = (status || 'normal').toLowerCase();

  const getBadgeClass = (s: string) => {
    switch (s) {
      case 'warning':
        return 'badge-warning';
      case 'critical':
      case 'danger':
      case 'error':
        return 'badge-critical';
      case 'offline':
        return 'badge-offline';
      case 'normal':
      case 'healthy':
      case 'active':
      default:
        return 'badge-normal';
    }
  };

  const getDotClass = (s: string) => {
    switch (s) {
      case 'warning':
        return 'warning';
      case 'critical':
      case 'danger':
      case 'error':
        return 'critical';
      case 'offline':
        return 'offline';
      case 'normal':
      case 'healthy':
      case 'active':
      default:
        return 'normal';
    }
  };

  const displayLabel = label || normalized;

  return (
    <span
      className={getBadgeClass(normalized)}
      style={{
        fontSize: size === 'sm' ? '11px' : '12px',
        padding: size === 'sm' ? '2px 8px' : '3px 10px',
      }}
    >
      <span className={`status-dot ${getDotClass(normalized)}`} />
      <span>{displayLabel}</span>
    </span>
  );
};
