import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Network,
  Activity,
  Bell,
  Brain,
  BarChart2,
  Settings,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { SimulationBanner } from './SimulationBanner';
import { SimulationPanel } from './SimulationPanel';
import { StatusBadge } from './StatusBadge';
import { useSimulationStore } from '../store/simulationStore';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const { alerts, dashboard, lastUpdated } = useSimulationStore();

  const activeAlertsCount =
    dashboard?.active_alerts ?? alerts.filter((a) => a.status === 'active').length;
  const systemHealth = dashboard?.system_health || 'normal';

  const navItems = [
    { path: '/', label: 'Overview', icon: LayoutDashboard },
    { path: '/duct-network', label: 'Duct Network', icon: Network },
    { path: '/monitoring', label: 'Live Monitoring', icon: Activity },
    {
      path: '/alerts',
      label: 'Alerts',
      icon: Bell,
      badge: activeAlertsCount > 0 ? activeAlertsCount : undefined,
    },
    { path: '/analytics', label: 'AI Analytics', icon: Brain },
    { path: '/reports', label: 'Reports', icon: BarChart2 },
    { path: '/configuration', label: 'Configuration', icon: Settings },
  ];

  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return 'System Overview & Dashboard';
      case '/duct-network':
        return 'Interactive Duct Network & Topology';
      case '/monitoring':
        return 'Live Sensor Telemetry & Monitoring';
      case '/alerts':
        return 'Alert Management & Maintenance Log';
      case '/analytics':
        return 'AI Diagnostics & Predictive Analytics';
      case '/reports':
        return 'Historical Telemetry & Export Reports';
      case '/configuration':
        return 'System Thresholds & Simulation Settings';
      default:
        return 'PiBuddy HVAC Intelligence';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* 1. Persistent Top Warning Banner */}
      <SimulationBanner />

      <div style={{ display: 'flex', flex: 1, minHeight: 'calc(100vh - 33px)' }}>
        {/* 2. Left Sidebar */}
        <aside
          style={{
            width: '260px',
            background: 'var(--bg-secondary)',
            borderRight: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
            padding: '20px 14px',
            position: 'sticky',
            top: '33px',
            height: 'calc(100vh - 33px)',
            overflowY: 'auto',
          }}
        >
          <div>
            {/* Brand Logo & Title */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '0 8px 20px 8px',
                borderBottom: '1px solid rgba(48, 73, 104, 0.6)',
                marginBottom: '20px',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, #1D3557, #5DA9E9)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 12px rgba(143, 203, 255, 0.3)',
                  border: '1px solid var(--accent-primary)',
                }}
              >
                <ShieldCheck size={22} color="#F4F8FF" />
              </div>
              <div>
                <h1
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    letterSpacing: '-0.01em',
                    lineHeight: 1.2,
                  }}
                >
                  PiBuddy
                </h1>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--accent-primary)',
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  HVAC Sentinel
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {navItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = location.pathname === item.path;

                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      color: isActive ? 'var(--accent-highlight)' : 'var(--text-secondary)',
                      backgroundColor: isActive
                        ? 'rgba(143, 203, 255, 0.12)'
                        : 'transparent',
                      borderLeft: isActive
                        ? '3px solid var(--accent-primary)'
                        : '3px solid transparent',
                      fontWeight: isActive ? 600 : 500,
                      fontSize: '13px',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <IconComponent
                        size={17}
                        color={isActive ? 'var(--accent-primary)' : 'var(--text-secondary)'}
                      />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && (
                      <span
                        style={{
                          background: 'var(--status-critical)',
                          color: '#101D38',
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '10px',
                          minWidth: '18px',
                          textAlign: 'center',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar Content: Mini Simulation Panel & Badge */}
          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <SimulationPanel compact />

            <div
              style={{
                background: 'rgba(251, 191, 36, 0.1)',
                border: '1px dashed rgba(251, 191, 36, 0.5)',
                borderRadius: '6px',
                padding: '8px 10px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  color: 'var(--status-warning)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '2px',
                }}
              >
                🔬 Synthetic Telemetry
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                Simulating 3 Raspberry Pi sensor nodes
              </div>
            </div>
          </div>
        </aside>

        {/* 3. Main Content Container */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Top Header */}
          <header
            style={{
              height: '60px',
              background: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 28px',
              position: 'sticky',
              top: '33px',
              zIndex: 90,
            }}
          >
            <div>
              <h2
                style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.01em',
                }}
              >
                {getPageTitle(location.pathname)}
              </h2>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              {/* System Status indicator */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>System Health:</span>
                <StatusBadge status={systemHealth} label={systemHealth.toUpperCase()} />
              </div>

              {/* Last Updated Time */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-card)',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                }}
              >
                <RefreshCw size={13} color="var(--accent-primary)" />
                <span>
                  {lastUpdated
                    ? `Updated: ${lastUpdated.toLocaleTimeString()}`
                    : 'Syncing...'}
                </span>
              </div>
            </div>
          </header>

          {/* Page Body */}
          <main
            style={{
              flex: 1,
              padding: '24px 28px',
              overflowY: 'auto',
            }}
          >
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};
