import { getScoreClass } from '../../hooks/useApi';

export default function ScoreGauge({ score, size = 180, label = 'Compliance' }) {
  const radius = (size - 24) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = ((score || 0) / 100) * circumference;
  const offset = circumference - progress;
  
  const scoreClass = getScoreClass(score);
  const colors = {
    excellent: '#10b981',
    good: '#22c55e',
    'needs-work': '#f59e0b',
    poor: '#ef4444',
  };
  const strokeColor = colors[scoreClass] || colors.poor;

  return (
    <div className="score-gauge" style={{ width: size, height: size }}>
      <svg className="score-gauge-circle" width={size} height={size}>
        <circle
          className="score-gauge-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className="score-gauge-fill"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ filter: `drop-shadow(0 0 6px ${strokeColor}40)` }}
        />
      </svg>
      <div className="score-gauge-value">
        <div className="score-gauge-number" style={{ color: strokeColor }}>
          {score !== null && score !== undefined ? Math.round(score) : '--'}
        </div>
        <div className="score-gauge-label">{label}</div>
      </div>
    </div>
  );
}
