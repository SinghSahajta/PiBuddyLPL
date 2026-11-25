import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { DuctNetwork } from './pages/DuctNetwork';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { Alerts } from './pages/Alerts';
import { AIAnalytics } from './pages/AIAnalytics';
import { Reports } from './pages/Reports';
import { Configuration } from './pages/Configuration';
import { usePolling } from './hooks/usePolling';
import { useSimulationStore } from './store/simulationStore';
import { api } from './api/client';

// Background sync component to keep store synchronized globally
const GlobalDataSync: React.FC = () => {
  const { setDashboard, setReadings, setAlerts } = useSimulationStore();

  const syncGlobalTelemetry = async () => {
    try {
      const [dashRes, readingsRes] = await Promise.allSettled([
        api.getDashboard(),
        api.getReadings(),
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value.data) {
        setDashboard(dashRes.value.data);
        if (dashRes.value.data.recent_alerts) {
          setAlerts(dashRes.value.data.recent_alerts);
        }
      }

      if (readingsRes.status === 'fulfilled' && readingsRes.value.data) {
        setReadings(readingsRes.value.data);
      }
    } catch {
      // Offline fallback handling already in place
    }
  };

  usePolling(syncGlobalTelemetry, 3000);

  return null;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <GlobalDataSync />
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/duct-network" element={<DuctNetwork />} />
          <Route path="/monitoring" element={<LiveMonitoring />} />
          <Route path="/alerts" element={<Alerts />} />
          <Route path="/analytics" element={<AIAnalytics />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/configuration" element={<Configuration />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
};

export default App;
