export default function StatsCard({ icon, value, label, trend, trendDirection }) {
  return (
    <div className="card stats-card">
      <div className="flex flex-between items-center">
        <span style={{ fontSize: '2rem' }}>{icon}</span>
        {trend && (
          <span className={`stats-trend ${trendDirection}`}>
            {trendDirection === 'up' ? '↑' : '↓'} {trend}
          </span>
        )}
      </div>
      <div className="stats-value">{value}</div>
      <div className="stats-label">{label}</div>
    </div>
  );
}
