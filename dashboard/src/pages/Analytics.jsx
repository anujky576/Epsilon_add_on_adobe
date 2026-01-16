import { useState, useEffect } from 'react';
import { analyticsAPI } from '../api/client';
import { formatPercent } from '../hooks/useApi';
import ScoreGauge from '../components/Charts/ScoreGauge';

export default function Analytics() {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await analyticsAPI.get();
        setAnalytics(res.data);
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  const overview = analytics?.overview || {};
  const violations = analytics?.topViolationCategories || [];
  const scoreDistribution = analytics?.scoreDistribution || [];
  const trend = analytics?.trend?.data || [];

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Brand compliance trends and insights</p>
      </header>

      {/* Overview Stats */}
      <div className="grid grid-4 mb-lg">
        <div className="card stats-card">
          <div className="stats-value">{overview.totalScans || 0}</div>
          <div className="stats-label">Total Scans</div>
        </div>
        <div className="card stats-card">
          <div className="stats-value">{formatPercent(overview.averageComplianceScore, 1)}</div>
          <div className="stats-label">Average Score</div>
        </div>
        <div className="card stats-card">
          <div className="stats-value">{overview.totalViolationsFound || 0}</div>
          <div className="stats-label">Total Violations</div>
        </div>
        <div className="card stats-card">
          <div className="stats-value">{overview.averageProcessingTime || 0}ms</div>
          <div className="stats-label">Avg Processing Time</div>
        </div>
      </div>

      <div className="grid grid-2 mb-lg">
        {/* Score Distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Score Distribution</h3>
          </div>
          {scoreDistribution.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {scoreDistribution.map((bucket, i) => {
                const maxCount = Math.max(...scoreDistribution.map(b => b.count));
                const percentage = maxCount > 0 ? (bucket.count / maxCount) * 100 : 0;
                const colors = ['var(--color-danger)', 'var(--color-warning)', 'var(--text-muted)', 'var(--color-success)', 'var(--color-excellent)'];
                return (
                  <div key={i}>
                    <div className="flex flex-between items-center mb-sm">
                      <span style={{ fontSize: 'var(--font-size-sm)' }}>{bucket.label || bucket.range}</span>
                      <span style={{ fontWeight: 600 }}>{bucket.count}</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${percentage}%`, 
                        height: '100%', 
                        background: colors[i] || 'var(--color-primary)', 
                        transition: 'width 0.5s ease' 
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <p>No data available</p>
            </div>
          )}
        </div>

        {/* Violation Categories */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Violation Categories</h3>
          </div>
          {violations.length > 0 ? (
            <div>
              {violations.map((v, i) => {
                const maxCount = Math.max(...violations.map(x => x.count));
                const percentage = maxCount > 0 ? (v.count / maxCount) * 100 : 0;
                return (
                  <div key={i} style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="flex flex-between items-center mb-sm">
                      <div className="flex items-center gap-sm">
                        <span style={{ 
                          fontSize: '1.25rem',
                        }}>
                          {v.category === 'color' ? '🎨' : 
                           v.category === 'font' || v.category === 'typography' ? '🔤' : 
                           v.category === 'logo' ? '🖼️' : 
                           v.category === 'accessibility' ? '♿' : 
                           v.category === 'tone' ? '💬' : '⚠️'}
                        </span>
                        <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>{v.category}</span>
                      </div>
                      <span style={{ fontWeight: 600 }}>{v.count} issues</span>
                    </div>
                    <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${percentage}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 100%)', 
                        transition: 'width 0.5s ease' 
                      }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <p>No violations recorded</p>
            </div>
          )}
        </div>
      </div>

      {/* Compliance Trend */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Compliance Trend (Last 7 Days)</h3>
        </div>
        {trend.length > 0 ? (
          <div style={{ padding: 'var(--space-lg) 0' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: 200, gap: 'var(--space-sm)' }}>
              {trend.map((day, i) => {
                const height = (day.averageScore / 100) * 180;
                const color = day.averageScore >= 90 ? 'var(--color-excellent)' : 
                             day.averageScore >= 70 ? 'var(--color-success)' : 
                             day.averageScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)';
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-sm)' }}>
                    <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600 }}>{day.averageScore}%</span>
                    <div style={{ 
                      width: '100%', 
                      height: height, 
                      background: `linear-gradient(180deg, ${color} 0%, ${color}80 100%)`, 
                      borderRadius: 'var(--border-radius-sm)',
                      transition: 'height 0.5s ease',
                      minHeight: 4,
                    }}></div>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {day.scansCount} scans
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📈</div>
            <p>Not enough data for trend analysis</p>
          </div>
        )}
      </div>

      {/* Entity Summary */}
      {analytics?.entityCounts && (
        <div className="grid grid-3 mt-lg">
          <div className="card text-center">
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🖼️</div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700 }}>{analytics.entityCounts.designs}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Total Designs</div>
          </div>
          <div className="card text-center">
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🎨</div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700 }}>{analytics.entityCounts.brandKits}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Brand Kits</div>
          </div>
          <div className="card text-center">
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📊</div>
            <div style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 700 }}>{analytics.entityCounts.analyses}</div>
            <div style={{ color: 'var(--text-secondary)' }}>Analyses Run</div>
          </div>
        </div>
      )}
    </div>
  );
}
