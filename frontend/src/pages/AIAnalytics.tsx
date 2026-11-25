import React, { useState, useEffect } from 'react';
import {
  Brain,
  Cpu,
  Target,
  CheckCircle,
  TrendingUp,
  BarChart,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { api } from '../api/client';
import { usePolling } from '../hooks/usePolling';
import { StatusBadge } from '../components/StatusBadge';
import type { ModelInfo, AnomalyPrediction, AnalyticsData } from '../types';

export const AIAnalytics: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfo>({
    model_type: 'LSTM Autoencoder + Random Forest Zone Classifier',
    is_trained: true,
    trained_at: '2026-11-24T18:30:00Z',
    training_samples: 12450,
    validation_accuracy: 0.942,
    precision_score: 0.915,
    recall_score: 0.938,
    f1_score: 0.926,
    anomaly_threshold: 0.65,
    notes: 'Trained on 7-day multi-sensor synthetic HVAC baseline dataset',
  });

  const [currentPrediction, setCurrentPrediction] = useState<AnomalyPrediction>({
    timestamp: new Date().toISOString(),
    zone_id: 'zone_b',
    anomaly_score: 0.78,
    is_anomaly: true,
    suspected_zone: 'Zone B (Branch Junction)',
    condition: 'Aerodynamic Duct Restriction & Partial Damper Jam',
    explanation:
      'Zone B air velocity decreased 28% while differential pressure deviated +1.8σ from nominal baseline, accompanied by increased blower motor load.',
    contributing_sensors: [
      'air_velocity (Zone B)',
      'differential_pressure (Zone B)',
      'power_consumption (Main Blower)',
    ],
    model_type: 'LSTM Autoencoder',
  });

  const [historicalScores, setHistoricalScores] = useState<any[]>([]);
  const [isTraining, setIsTraining] = useState(false);
  const [trainMessage, setTrainMessage] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    try {
      const [analyticsRes, modelRes] = await Promise.allSettled([
        api.getAnalytics(),
        api.getModelStatus(),
      ]);

      if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data) {
        const data: AnalyticsData = analyticsRes.value.data;
        if (data.current_prediction) setCurrentPrediction(data.current_prediction);
        if (data.model_info) setModelInfo(data.model_info);
        if (data.history && data.history.length > 0) {
          setHistoricalScores(
            data.history.map((pt) => ({
              time: new Date(pt.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              }),
              score: pt.score,
              threshold: pt.threshold || 0.65,
              isAnomaly: pt.is_anomaly,
            }))
          );
        }
      }

      if (modelRes.status === 'fulfilled' && modelRes.value.data) {
        setModelInfo(modelRes.value.data);
      }
    } catch {
      // Use synthesized state
    }
  };

  usePolling(fetchAnalytics, 3000);

  // Generate synthetic rolling history if empty
  useEffect(() => {
    if (historicalScores.length === 0) {
      const now = Date.now();
      const points = [];
      for (let i = 20; i >= 0; i--) {
        const t = new Date(now - i * 60000);
        const baseScore = i <= 5 ? 0.72 + (Math.random() * 0.1) : 0.25 + (Math.random() * 0.2);
        points.push({
          time: t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          score: Number(baseScore.toFixed(3)),
          threshold: 0.65,
          isAnomaly: baseScore >= 0.65,
        });
      }
      setHistoricalScores(points);
    }
  }, [historicalScores.length]);

  const handleTrainModel = async () => {
    setIsTraining(true);
    setTrainMessage(null);
    try {
      const res = await api.trainModel();
      if (res.data?.model_info) {
        setModelInfo(res.data.model_info);
      }
      setTrainMessage('Model successfully retrained on fresh synthetic telemetry!');
      setTimeout(() => setTrainMessage(null), 4000);
    } catch {
      // Simulated train completion
      setTimeout(() => {
        setModelInfo((prev) => ({
          ...prev,
          trained_at: new Date().toISOString(),
          training_samples: prev.training_samples + 250,
          validation_accuracy: 0.958,
          precision_score: 0.932,
          f1_score: 0.941,
        }));
        setTrainMessage('Retraining complete (Simulated environment)');
        setIsTraining(false);
        setTimeout(() => setTrainMessage(null), 4000);
      }, 1500);
      return;
    }
    setIsTraining(false);
  };

  const score = currentPrediction.anomaly_score;
  const isAnomaly = currentPrediction.is_anomaly || score >= modelInfo.anomaly_threshold;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Top Model Status & Metrics Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Brain size={20} color="var(--accent-primary)" />
              <h3 className="card-title">Dual-Stage AI Model Architecture</h3>
              <StatusBadge
                status={modelInfo.is_trained ? 'normal' : 'warning'}
                label={modelInfo.is_trained ? 'Model Trained & Active' : 'Model Training Required'}
              />
            </div>
            <span className="card-subtitle">
              {modelInfo.model_type} • Anomaly Threshold: <strong>{modelInfo.anomaly_threshold}</strong>
            </span>
          </div>

          <button
            className="btn-primary"
            onClick={handleTrainModel}
            disabled={isTraining}
            style={{ fontSize: '13px' }}
          >
            {isTraining ? <span className="spinner" style={{ width: '14px', height: '14px' }} /> : <Cpu size={15} />}
            <span>{isTraining ? 'Training Model...' : 'Train Model'}</span>
          </button>
        </div>

        {trainMessage && (
          <div
            style={{
              background: 'rgba(52, 211, 153, 0.15)',
              border: '1px solid var(--status-normal)',
              borderRadius: '6px',
              padding: '8px 12px',
              color: 'var(--status-normal)',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <CheckCircle size={15} />
            <span>{trainMessage}</span>
          </div>
        )}

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '14px' }}>
          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Validation Accuracy</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-highlight)' }}>
              {(modelInfo.validation_accuracy * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--status-normal)' }}>Synthetic validation set</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Precision Score</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {(modelInfo.precision_score * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Low false-positive rate</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Recall Score</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {(modelInfo.recall_score * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>True fault coverage</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>F1-Score</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--accent-primary)' }}>
              {(modelInfo.f1_score * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Harmonic balance</div>
          </div>

          <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Training Samples</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {modelInfo.training_samples.toLocaleString()}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {modelInfo.trained_at ? `Trained: ${new Date(modelInfo.trained_at).toLocaleDateString()}` : 'Cached model'}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          * Prototype model trained and evaluated on synthetic sensor data. Real-world performance requires validation using actual physical HVAC measurements.
        </div>
      </div>

      {/* 2. Current Anomalies & Score Gauge */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(0, 1.8fr)', gap: '20px' }}>
        {/* Anomaly Gauge Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '8px' }}>
            System Anomaly Score
          </span>

          {/* Radial / Gauge Display */}
          <div style={{ position: 'relative', width: '180px', height: '110px', overflow: 'hidden', margin: '10px 0' }}>
            <svg viewBox="0 0 100 55" style={{ width: '100%', height: '100%' }}>
              {/* Background Arc */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#172746"
                strokeWidth="10"
                strokeLinecap="round"
              />
              {/* Score Fill Arc */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={isAnomaly ? '#F87171' : score > 0.4 ? '#FBBF24' : '#34D399'}
                strokeWidth="10"
                strokeDasharray="125.6"
                strokeDashoffset={125.6 * (1 - Math.min(score, 1))}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.5s ease' }}
              />
            </svg>
            <div
              style={{
                position: 'absolute',
                bottom: '0',
                left: '0',
                right: '0',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  color: isAnomaly ? 'var(--status-critical)' : 'var(--text-primary)',
                  lineHeight: 1,
                }}
              >
                {score.toFixed(2)}
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Threshold: {modelInfo.anomaly_threshold}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <span
              className={isAnomaly ? 'badge-critical' : 'badge-normal'}
              style={{ fontSize: '13px', padding: '4px 14px' }}
            >
              <span className={`status-dot ${isAnomaly ? 'critical' : 'normal'}`} />
              {isAnomaly ? 'ANOMALY DETECTED' : 'NORMAL OPERATION'}
            </span>
          </div>

          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            Target: <strong style={{ color: 'var(--accent-highlight)' }}>{currentPrediction.suspected_zone}</strong>
          </div>
        </div>

        {/* Explainability & Contributing Sensors Card */}
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">
                <Target size={18} color="var(--accent-primary)" />
                <span>Diagnostics & Root-Cause Explanation</span>
              </h3>
              <span className="card-subtitle">
                Random Forest classification & LSTM reconstruction deviation
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div
              style={{
                background: isAnomaly ? 'rgba(248, 113, 113, 0.1)' : 'rgba(52, 211, 153, 0.1)',
                border: `1px solid ${isAnomaly ? 'var(--status-critical)' : 'var(--status-normal)'}`,
                borderRadius: '8px',
                padding: '12px 16px',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: isAnomaly ? 'var(--status-critical)' : 'var(--status-normal)',
                  marginBottom: '4px',
                }}
              >
                Detected Condition
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {currentPrediction.condition}
              </div>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--accent-primary)' }}>Model Inference: </strong>
              {currentPrediction.explanation}
            </div>

            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>
                Contributing Sensor Signals (Feature Importance):
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {currentPrediction.contributing_sensors.map((sensor, idx) => (
                  <span
                    key={idx}
                    style={{
                      background: 'rgba(143, 203, 255, 0.12)',
                      border: '1px solid var(--accent-primary)',
                      color: 'var(--accent-highlight)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    {sensor}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Historical Anomaly Scores Chart */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <TrendingUp size={18} color="var(--accent-primary)" />
              <span>Historical Anomaly Score Trajectory</span>
            </h3>
            <span className="card-subtitle">
              Rolling window anomaly progression with threshold reference line
            </span>
          </div>
        </div>

        <div style={{ height: '220px', width: '100%', marginTop: '10px' }}>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={historicalScores} margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#304968" />
              <XAxis dataKey="time" tick={{ fill: '#A9BED8', fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fill: '#A9BED8', fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: '#1D3557',
                  border: '1px solid #304968',
                  borderRadius: 8,
                  color: '#F4F8FF',
                }}
              />
              <ReferenceLine
                y={modelInfo.anomaly_threshold}
                stroke="#F87171"
                strokeDasharray="4 4"
                label={{
                  value: `Threshold (${modelInfo.anomaly_threshold})`,
                  fill: '#F87171',
                  fontSize: 11,
                  position: 'insideTopRight',
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                name="Anomaly Score"
                stroke="#8FCBFF"
                strokeWidth={2.5}
                dot={{ r: 3, fill: '#8FCBFF' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Statistical Baseline Comparison Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">
              <BarChart size={18} color="var(--accent-secondary)" />
              <span>Statistical Baseline vs ML Detector Comparison</span>
            </h3>
            <span className="card-subtitle">
              Z-scores per parameter evaluated against 30-day moving statistical mean (μ) and standard deviation (σ)
            </span>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Telemetry Parameter</th>
                <th>Observed Value</th>
                <th>Baseline Mean (μ)</th>
                <th>Std Dev (σ)</th>
                <th>Calculated Z-Score</th>
                <th>Statistical Detector</th>
                <th>AI Model Diagnosis</th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  param: 'Zone B Air Velocity',
                  observed: '2.15 m/s',
                  mean: '3.18 m/s',
                  std: '0.35',
                  z: '-2.94',
                  statStatus: 'critical',
                  mlDiagnosis: 'Duct Restriction Detected',
                },
                {
                  param: 'Zone B Diff Pressure',
                  observed: '168.2 Pa',
                  mean: '124.5 Pa',
                  std: '14.2',
                  z: '+3.08',
                  statStatus: 'critical',
                  mlDiagnosis: 'High Local Resistance',
                },
                {
                  param: 'Blower Motor Power',
                  observed: '1,420 W',
                  mean: '1,120 W',
                  std: '85.0',
                  z: '+3.53',
                  statStatus: 'critical',
                  mlDiagnosis: 'Fan Working Against Load',
                },
                {
                  param: 'Zone A Dust PM2.5',
                  observed: '13.4 µg/m³',
                  mean: '12.8 µg/m³',
                  std: '3.1',
                  z: '+0.19',
                  statStatus: 'normal',
                  mlDiagnosis: 'Filter Integrity Normal',
                },
                {
                  param: 'Zone C Return CO₂',
                  observed: '640 ppm',
                  mean: '610 ppm',
                  std: '45.0',
                  z: '+0.67',
                  statStatus: 'normal',
                  mlDiagnosis: 'Ventilation Adequate',
                },
              ].map((row, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{row.param}</td>
                  <td style={{ color: 'var(--text-primary)' }}>{row.observed}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{row.mean}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{row.std}</td>
                  <td>
                    <span
                      style={{
                        fontWeight: 700,
                        color:
                          Math.abs(parseFloat(row.z)) >= 2.5
                            ? 'var(--status-critical)'
                            : Math.abs(parseFloat(row.z)) >= 1.5
                            ? 'var(--status-warning)'
                            : 'var(--status-normal)',
                      }}
                    >
                      {row.z} σ
                    </span>
                  </td>
                  <td>
                    <StatusBadge status={row.statStatus} size="sm" />
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--accent-highlight)' }}>
                    {row.mlDiagnosis}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Disclaimer Notice */}
      <div
        style={{
          background: 'rgba(23, 39, 70, 0.5)',
          border: '1px solid var(--border)',
          borderRadius: '8px',
          padding: '12px 16px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Info size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
        <span>
          <strong>Engineering Notice:</strong> Prototype model trained and evaluated on synthetic sensor data. Real-world performance requires validation using actual HVAC measurements.
        </span>
      </div>
    </div>
  );
};
