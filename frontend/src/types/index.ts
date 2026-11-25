export interface SensorReading {
  zone_id: string;
  timestamp: string;
  pm1_0: number;
  pm2_5: number;
  pm10: number;
  co2: number;
  temperature: number;
  humidity: number;
  air_velocity: number;
  differential_pressure: number;
  voltage: number;
  current: number;
  power: number;
  energy: number;
  frequency: number;
  power_factor: number;
  is_simulated: boolean;
  scenario: string;
}

export interface Zone {
  id: string;
  name: string;
  description: string;
  node_id: string;
  location: string;
  status: 'normal' | 'warning' | 'critical' | 'offline';
}

export interface Alert {
  id: number;
  alert_id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  zone_id: string;
  parameter: string;
  observed_value: number;
  baseline_value: number;
  unit: string;
  title: string;
  explanation: string;
  action: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

export interface ZoneSummary {
  zone_id: string;
  zone_name: string;
  status: string;
  pm2_5: number;
  co2: number;
  air_velocity: number;
  differential_pressure: number;
  alert_count: number;
}

export interface DashboardSummary {
  system_health: string;
  total_zones: number;
  online_nodes: number;
  offline_nodes: number;
  active_alerts: number;
  maintenance_due: number;
  avg_pm25: number;
  avg_co2: number;
  avg_velocity: number;
  avg_pressure: number;
  total_power: number;
  zone_summaries: ZoneSummary[];
  recent_alerts: Alert[];
  simulation_status: {
    is_running: boolean;
    scenario: string;
  };
}

export interface AnomalyPrediction {
  timestamp: string;
  zone_id: string;
  anomaly_score: number;
  is_anomaly: boolean;
  suspected_zone: string;
  condition: string;
  explanation: string;
  contributing_sensors: string[];
  model_type: string;
}

export interface ModelInfo {
  model_type: string;
  is_trained: boolean;
  trained_at: string | null;
  training_samples: number;
  validation_accuracy: number;
  precision_score: number;
  recall_score: number;
  f1_score: number;
  anomaly_threshold: number;
  notes: string;
}

export interface MaintenanceRecord {
  id: number;
  timestamp: string;
  zone_id: string;
  action_type: 'cleaning' | 'inspection' | 'filter_replacement' | 'calibration';
  description: string;
  performed_by: string;
  notes?: string;
  before_value?: number;
  after_value?: number;
  unit?: string;
}

export interface ThresholdItem {
  warning: number;
  critical: number;
  unit: string;
}

export interface SystemConfiguration {
  zones: Zone[];
  thresholds: Record<string, ThresholdItem>;
  simulation: {
    sampling_interval: number;
    speed: number;
    default_scenario: string;
    noise_factor?: number;
  };
}

export interface AnomalyHistoryPoint {
  timestamp: string;
  score: number;
  threshold: number;
  is_anomaly: boolean;
}

export interface StatisticalComparisonItem {
  parameter: string;
  current_value: number;
  baseline_mean: number;
  baseline_std: number;
  z_score: number;
  status: 'normal' | 'warning' | 'critical';
}

export interface AnalyticsData {
  model_info: ModelInfo;
  current_prediction: AnomalyPrediction;
  history: AnomalyHistoryPoint[];
  statistical_baseline: StatisticalComparisonItem[];
}
