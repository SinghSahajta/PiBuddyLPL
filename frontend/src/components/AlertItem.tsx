import React, { useState } from 'react';
import type { Alert } from '../types';
import { StatusBadge } from './StatusBadge';
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Wrench,
  Info,
} from 'lucide-react';

interface AlertItemProps {
  alert: Alert;
  onAcknowledge?: (id: number | string) => void;
  onResolve?: (id: number | string) => void;
  isProcessing?: boolean;
}

export const AlertItem: React.FC<AlertItemProps> = ({
  alert,
  onAcknowledge,
  onResolve,
  isProcessing = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const formatTimestamp = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
        ' ' +
        d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return ts;
    }
  };

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'critical':
        return 'var(--status-critical)';
      case 'warning':
        return 'var(--status-warning)';
      default:
        return 'var(--accent-primary)';
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderLeft: `4px solid ${getSeverityColor(alert.severity)}`,
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '10px',
        transition: 'all 0.2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
          <StatusBadge
            status={alert.severity}
            label={alert.severity.toUpperCase()}
            size="sm"
          />

          <span
            style={{
              fontSize: '11px',
              fontFamily: 'monospace',
              color: 'var(--text-secondary)',
              background: 'rgba(16, 29, 56, 0.4)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid rgba(48, 73, 104, 0.5)',
            }}
          >
            {alert.alert_id || `#${alert.id}`}
          </span>

          <span
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {alert.title}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: 'var(--text-secondary)',
            }}
          >
            <Clock size={13} />
            <span>{formatTimestamp(alert.timestamp)}</span>
          </div>

          <div
            style={{
              display: 'inline-block',
              fontSize: '11px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '12px',
              background:
                alert.status === 'resolved'
                  ? 'rgba(52, 211, 153, 0.15)'
                  : alert.status === 'acknowledged'
                  ? 'rgba(251, 191, 36, 0.15)'
                  : 'rgba(248, 113, 113, 0.15)',
              color:
                alert.status === 'resolved'
                  ? 'var(--status-normal)'
                  : alert.status === 'acknowledged'
                  ? 'var(--status-warning)'
                  : 'var(--status-critical)',
              border: `1px solid ${
                alert.status === 'resolved'
                  ? 'rgba(52, 211, 153, 0.3)'
                  : alert.status === 'acknowledged'
                  ? 'rgba(251, 191, 36, 0.3)'
                  : 'rgba(248, 113, 113, 0.3)'
              }`,
              textTransform: 'uppercase',
            }}
          >
            {alert.status}
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              color: 'var(--accent-primary)',
              display: 'flex',
              alignItems: 'center',
              padding: '4px',
              borderRadius: '4px',
            }}
            title={isExpanded ? 'Collapse' : 'Expand details'}
          >
            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Primary summary row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
          marginTop: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Zone: </span>
          <strong style={{ color: 'var(--accent-highlight)' }}>
            {alert.zone_id.toUpperCase()}
          </strong>
        </div>

        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Parameter: </span>
          <strong style={{ color: 'var(--text-primary)' }}>
            {alert.parameter}
          </strong>
        </div>

        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Observed: </span>
          <strong style={{ color: getSeverityColor(alert.severity) }}>
            {alert.observed_value} {alert.unit}
          </strong>
          <span style={{ margin: '0 4px', opacity: 0.6 }}>/</span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Baseline: {alert.baseline_value} {alert.unit}
          </span>
        </div>
      </div>

      {/* Expandable detail section */}
      {isExpanded && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(48, 73, 104, 0.6)',
            fontSize: '13px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {alert.explanation && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--accent-primary)' }}>Diagnosis: </strong>
                <span style={{ color: 'var(--text-primary)' }}>{alert.explanation}</span>
              </div>
            </div>
          )}

          {alert.action && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Wrench size={16} color="var(--status-warning)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--status-warning)' }}>Recommended Action: </strong>
                <span style={{ color: 'var(--text-primary)' }}>{alert.action}</span>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
            }}
          >
            {alert.status === 'active' && onAcknowledge && (
              <button
                className="btn-secondary"
                onClick={() => onAcknowledge(alert.id)}
                disabled={isProcessing}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                <AlertTriangle size={14} />
                Acknowledge Alert
              </button>
            )}

            {alert.status !== 'resolved' && onResolve && (
              <button
                className="btn-success"
                onClick={() => onResolve(alert.id)}
                disabled={isProcessing}
                style={{ fontSize: '12px', padding: '6px 12px' }}
              >
                <CheckCircle2 size={14} />
                Mark Resolved
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
