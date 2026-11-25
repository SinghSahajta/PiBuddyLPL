import axios, { type AxiosResponse } from 'axios';
import type {
  DashboardSummary,
  SensorReading,
  Zone,
  Alert,
  ModelInfo,
  AnalyticsData,
  SystemConfiguration,
  MaintenanceRecord,
} from '../types';

const API_BASE = import.meta.env.VITE_API_URL
  ? `${String(import.meta.env.VITE_API_URL).replace(/\/+$/, '')}/api`
  : (typeof window !== 'undefined' && window.location.port === '5173')
    ? '/api'
    : 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});


// ---------------------------------------------------------------------------
// Adapters: translate the backend's response/request shapes into what the UI types expect.
// ---------------------------------------------------------------------------
const mapR = <T, U>(p: Promise<AxiosResponse<T>>, fn: (d: T) => U): Promise<AxiosResponse<U>> =>
  p.then((r) => ({ ...r, data: fn(r.data) }) as unknown as AxiosResponse<U>);

const adaptDashboard = (d: any): DashboardSummary => ({
  ...d,
  system_health: d.system_health === 'optimal' ? 'normal' : d.system_health,
  zone_summaries: (d.zone_summaries || []).map((z: any) => ({
    ...z,
    zone_id: z.zone_id ?? z.id,
    zone_name: z.zone_name ?? z.name,
    alert_count: z.alert_count ?? z.active_alerts ?? 0,
  })),
});

const pickModel = (models: any[]): ModelInfo | undefined =>
  models?.find((m) => m.model_type?.includes('LSTM')) ?? models?.[0];

const adaptAnalytics = (d: any): AnalyticsData => {
  const preds = Object.entries<any>(d.zone_predictions || {});
  const score = (p: any) => Math.max(p.autoencoder?.anomaly_score ?? 0, p.statistical?.overall_score ?? 0);
  const [zoneId, worst] = preds.sort((a, b) => score(b[1]) - score(a[1]))[0] ?? ['zone_a', {}];
  const model = pickModel(d.models);
  const threshold = worst.autoencoder?.threshold ?? 0.65;
  return {
    model_info: model as ModelInfo,
    current_prediction: {
      timestamp: d.timestamp,
      zone_id: zoneId,
      anomaly_score: Math.min(1, score(worst)),
      is_anomaly: !!(worst.autoencoder?.is_anomaly || worst.statistical?.is_anomaly),
      suspected_zone: d.localization?.predicted_zone ?? 'normal',
      condition: worst.condition ?? 'Nominal HVAC Operation',
      explanation: worst.explanation ?? '',
      contributing_sensors: (worst.autoencoder?.contributing_sensors?.length
        ? worst.autoencoder.contributing_sensors
        : worst.statistical?.flagged_params ?? []
      ).map((x: any) => (typeof x === 'string' ? x : x.sensor)),
      model_type: model?.model_type ?? 'Statistical_Detector',
    },
    history: (d.anomaly_history || []).map((h: any) => ({
      timestamp: h.timestamp,
      score: h.anomaly_score,
      threshold,
      is_anomaly: h.is_anomaly,
    })),
    statistical_baseline: [],
  };
};

// Thresholds the backend does not track keep UI defaults.
const EXTRA_THRESHOLDS = {
  pm10: { warning: 50, critical: 75, unit: 'µg/m³' },
  temperature: { warning: 26, critical: 30, unit: '°C' },
  humidity: { warning: 65, critical: 75, unit: '%' },
};

const adaptConfig = (c: any, zones: Zone[]): SystemConfiguration => ({
  zones,
  thresholds: {
    pm2_5: { warning: c.pm25_warning, critical: c.pm25_critical, unit: 'µg/m³' },
    co2: { warning: c.co2_warning, critical: c.co2_critical, unit: 'ppm' },
    air_velocity: { warning: c.velocity_warning_low, critical: c.velocity_critical_low, unit: 'm/s' },
    differential_pressure: { warning: c.pressure_warning, critical: c.pressure_critical, unit: 'Pa' },
    power: { warning: c.power_warning, critical: c.power_critical, unit: 'W' },
    ...EXTRA_THRESHOLDS,
  },
  simulation: { sampling_interval: c.simulation_interval, speed: 1, default_scenario: 'normal', noise_factor: 5 },
});

const configToBackend = (c: Partial<SystemConfiguration>) => {
  const t = c.thresholds ?? {};
  return {
    simulation_interval: c.simulation?.sampling_interval ?? 3,
    pm25_warning: t.pm2_5?.warning, pm25_critical: t.pm2_5?.critical,
    co2_warning: t.co2?.warning, co2_critical: t.co2?.critical,
    velocity_warning_low: t.air_velocity?.warning, velocity_critical_low: t.air_velocity?.critical,
    pressure_warning: t.differential_pressure?.warning, pressure_critical: t.differential_pressure?.critical,
    power_warning: t.power?.warning, power_critical: t.power?.critical,
  };
};

export const api = {
  getDashboard: (): Promise<AxiosResponse<DashboardSummary>> =>
    mapR(apiClient.get<any>(`/dashboard`), adaptDashboard),

  getZones: (): Promise<AxiosResponse<Zone[]>> =>
    apiClient.get<Zone[]>(`/zones`),

  getReadings: (): Promise<AxiosResponse<Record<string, SensorReading>>> =>
    apiClient.get<Record<string, SensorReading>>(`/readings`),

  getHistory: (params: { zone_id?: string; hours?: number; limit?: number }): Promise<AxiosResponse<SensorReading[]>> =>
    apiClient.get<SensorReading[]>(`/readings/history`, { params }),

  getAlerts: (params?: { status?: string; zone_id?: string; severity?: string }): Promise<AxiosResponse<Alert[]>> =>
    apiClient.get<Alert[]>(`/alerts`, { params }),

  acknowledgeAlert: (id: number | string): Promise<AxiosResponse<{ success: boolean; message: string; alert: Alert }>> =>
    apiClient.post(`/alerts/${id}/acknowledge`),

  resolveAlert: (id: number | string): Promise<AxiosResponse<{ success: boolean; message: string; alert: Alert }>> =>
    apiClient.post(`/alerts/${id}/resolve`),

  createMaintenance: (data: Partial<MaintenanceRecord>): Promise<AxiosResponse<{ success: boolean; record: MaintenanceRecord }>> =>
    apiClient.post(`/maintenance`, data),

  getMaintenanceHistory: (params?: { zone_id?: string }): Promise<AxiosResponse<MaintenanceRecord[]>> =>
    apiClient.get<MaintenanceRecord[]>(`/maintenance`, { params }),

  getAnalytics: (): Promise<AxiosResponse<AnalyticsData>> =>
    mapR(apiClient.get<any>(`/analytics`), adaptAnalytics),

  getModelStatus: (): Promise<AxiosResponse<ModelInfo>> =>
    mapR(apiClient.get<any[]>(`/model/status`), (m) => pickModel(m) as ModelInfo),

  trainModel: (): Promise<AxiosResponse<{ success: boolean; message: string; model_info: ModelInfo }>> =>
    apiClient.post(`/model/train`),

  startSimulation: (): Promise<AxiosResponse<{ is_running: boolean; message: string }>> =>
    apiClient.post(`/simulation/start`),

  pauseSimulation: (): Promise<AxiosResponse<{ is_running: boolean; message: string }>> =>
    apiClient.post(`/simulation/pause`),

  resetSimulation: (): Promise<AxiosResponse<{ message: string; state: any }>> =>
    apiClient.post(`/simulation/reset`),

  setScenario: (data: { scenario: string; affected_zone?: string; speed?: number }): Promise<AxiosResponse<{ success: boolean; scenario: string; affected_zone?: string }>> =>
    apiClient.post(`/simulation/scenario`, {
      scenario: data.scenario,
      zone_id: data.affected_zone,
      speed_multiplier: data.speed,
    }),

  getConfig: (): Promise<AxiosResponse<SystemConfiguration>> =>
    Promise.all([apiClient.get<any>(`/configuration`), apiClient.get<Zone[]>(`/zones`)]).then(
      ([c, z]) => ({ ...c, data: adaptConfig(c.data, z.data) }) as AxiosResponse<SystemConfiguration>
    ),

  updateConfig: (data: Partial<SystemConfiguration>): Promise<AxiosResponse<{ success: boolean; configuration: SystemConfiguration }>> =>
    apiClient.put(`/configuration`, configToBackend(data)),

  getReports: (params: { start_date?: string; end_date?: string; zone_id?: string }): Promise<AxiosResponse<any>> =>
    apiClient.get(`/reports/history`, { params }),

  exportCSV: (params: { start_date?: string; end_date?: string; zone_id?: string }): Promise<AxiosResponse<Blob>> =>
    apiClient.get(`/reports/export`, { params, responseType: 'blob' }),
};
