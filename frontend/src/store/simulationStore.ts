import { create } from 'zustand';
import type { SensorReading, Zone, Alert, DashboardSummary } from '../types';

// Scenarios the backend simulation engine actually supports (needsZone = affects the chosen zone).
export const SCENARIOS = [
  { id: 'normal', name: 'Normal Operation', needsZone: false },
  { id: 'velocity_drop', name: 'Airflow Drop (Blockage)', needsZone: true },
  { id: 'dust_increase', name: 'Dust Ingress / Spike', needsZone: true },
  { id: 'pressure_rise', name: 'Filter Pressure Rise', needsZone: true },
  { id: 'sensor_failure', name: 'Sensor Failure (offline)', needsZone: true },
  { id: 'zone_a_restriction', name: 'Zone A Duct Restriction', needsZone: false },
  { id: 'zone_b_restriction', name: 'Zone B Duct Restriction', needsZone: false },
  { id: 'co2_rise', name: 'CO₂ Rise (all zones)', needsZone: false },
  { id: 'energy_spike', name: 'Energy Spike (all zones)', needsZone: false },
  { id: 'noisy_readings', name: 'Noisy Sensor Readings', needsZone: false },
  { id: 'cleaning', name: 'Duct Cleaning Cycle', needsZone: false },
];

export interface SimulationStore {
  isRunning: boolean;
  scenario: string;
  affectedZone: string | null;
  speed: number;
  readings: Record<string, SensorReading>;
  zones: Zone[];
  alerts: Alert[];
  dashboard: DashboardSummary | null;
  lastUpdated: Date | null;
  // Actions
  setRunning: (v: boolean) => void;
  setScenario: (scenario: string, zone?: string) => void;
  setSpeed: (speed: number) => void;
  setReadings: (readings: Record<string, SensorReading>) => void;
  setZones: (zones: Zone[]) => void;
  setAlerts: (alerts: Alert[]) => void;
  setDashboard: (data: DashboardSummary) => void;
  setLastUpdated: (date: Date) => void;
}

export const useSimulationStore = create<SimulationStore>((set) => ({
  isRunning: true,
  scenario: 'normal',
  affectedZone: null,
  speed: 1,
  readings: {},
  zones: [
    {
      id: 'zone_a',
      name: 'Zone A — Main Intake / Filter',
      description: 'Primary air intake, pre-filter and bag filter stage',
      node_id: 'NODE-01',
      location: 'Basement AHU Room',
      status: 'normal',
    },
    {
      id: 'zone_b',
      name: 'Zone B — Branch Junction & Blower',
      description: 'Main distribution supply plenum and blower motor',
      node_id: 'NODE-02',
      location: 'Floor 1 Riser Shaft',
      status: 'normal',
    },
    {
      id: 'zone_c',
      name: 'Zone C — End Return / Terminal',
      description: 'Terminal diffuser return loop and exhaust damper',
      node_id: 'NODE-03',
      location: 'Floor 3 Exhaust Header',
      status: 'normal',
    },
  ],
  alerts: [],
  dashboard: null,
  lastUpdated: null,

  setRunning: (isRunning) => set({ isRunning }),
  setScenario: (scenario, zone) =>
    set({
      scenario,
      affectedZone: zone !== undefined ? zone : null,
    }),
  setSpeed: (speed) => set({ speed }),
  setReadings: (readings) =>
    set({
      readings,
      lastUpdated: new Date(),
    }),
  setZones: (zones) => set({ zones }),
  setAlerts: (alerts) => set({ alerts }),
  setDashboard: (dashboard) =>
    set({
      dashboard,
      isRunning: dashboard.simulation_status?.is_running ?? true,
      scenario: dashboard.simulation_status?.scenario ?? 'normal',
      lastUpdated: new Date(),
    }),
  setLastUpdated: (lastUpdated) => set({ lastUpdated }),
}));
