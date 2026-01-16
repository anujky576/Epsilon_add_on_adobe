import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analyticsAPI, executiveSummaryAPI, analysisAPI } from '../api/client';
import { formatPercent, formatDateTime, getScoreClass, getScoreLabel } from '../hooks/useApi';
import ScoreGauge from '../components/Charts/ScoreGauge';
import StatsCard from '../components/Cards/StatsCard';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [summaryRes, analyticsRes, analysesRes] = await Promise.all([
          executiveSummaryAPI.get({ period: 'week' }).catch(() => null),
          analyticsAPI.get().catch(() => null),
          analysisAPI.history({ limit: 5 }).catch(() => null),
        ]);
        
        if (summaryRes?.data) setSummary(summaryRes.data.executiveSummary);
        if (analyticsRes?.data) setAnalytics(analyticsRes.data);
        if (analysesRes?.data) setRecentAnalyses(analysesRes.data.analyses || []);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
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

  const overviewData = summary?.overview || analytics?.overview || {};
  const riskData = summary?.riskAssessment || {};
  const violations = summary?.violations || analytics?.topViolationCategories || [];
  
  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Brand Governance Dashboard</h1>
        <p className="page-subtitle">Enterprise-wide brand compliance overview</p>
      </header>

      {/* Executive Insight */}
      {summary?.executiveInsight && (
        <div className="card mb-lg" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(14, 165, 233, 0.05) 100%)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
          <div className="flex items-center gap-md mb-md">
            <span style={{ fontSize: '1.5rem' }}>💡</span>
            <h3 style={{ margin: 0 }}>Executive Insight</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-lg)', lineHeight: 1.6 }}>
            {summary.executiveInsight}
          </p>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-4 mb-lg">
        <StatsCard
          icon="📊"
          value={overviewData.totalScansCompleted || overviewData.totalScans || 0}
          label="Total Scans"
        />
        <StatsCard
          icon="✅"
          value={formatPercent(overviewData.averageComplianceScore || overviewData.averageScore, 1)}
          label="Avg Compliance"
        />
        <StatsCard
          icon="⚠️"
          value={overviewData.totalViolationsFound || overviewData.totalViolations || 0}
          label="Violations Found"
        />
        <StatsCard
          icon="🎨"
          value={overviewData.activeBrandKits || analytics?.entityCounts?.brandKits || 0}
          label="Active Brand Kits"
        />
      </div>

      <div className="grid grid-2 mb-lg">
        {/* Compliance Score */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Overall Compliance</h3>
            <span className={`score-badge ${getScoreClass(overviewData.averageComplianceScore || overviewData.averageScore)}`}>
              {getScoreLabel(overviewData.averageComplianceScore || overviewData.averageScore)}
            </span>
          </div>
          <div className="flex flex-center" style={{ padding: 'var(--space-lg) 0' }}>
            <ScoreGauge score={overviewData.averageComplianceScore || overviewData.averageScore || 0} />
          </div>
          <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: 'var(--space-md)' }}>
            Trend: <span style={{ color: overviewData.complianceTrend === 'improving' ? 'var(--color-success)' : overviewData.complianceTrend === 'declining' ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
              {overviewData.complianceTrend || 'Stable'} {overviewData.complianceTrend === 'improving' ? '↑' : overviewData.complianceTrend === 'declining' ? '↓' : '→'}
            </span>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Risk Assessment</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            <RiskBar label="Brand Risk" value={riskData.brandRisk || 0} />
            <RiskBar label="Accessibility Risk" value={riskData.accessibilityRisk || 0} />
            <RiskBar label="Legal Risk" value={riskData.legalRisk || 0} />
          </div>
          {riskData.topRisks?.length > 0 && (
            <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>Top Concerns</h4>
              {riskData.topRisks.slice(0, 2).map((risk, i) => (
                <div key={i} className="risk-indicator mb-sm">
                  <span className={`risk-dot ${risk.level}`}></span>
                  <span style={{ fontSize: 'var(--font-size-sm)' }}>{risk.description}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        {/* Top Violations */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Top Violation Categories</h3>
            <Link to="/analytics" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
              View All →
            </Link>
          </div>
          {(violations.topCategories || violations).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              {(violations.topCategories || violations).slice(0, 5).map((v, i) => (
                <div key={i} className="flex flex-between items-center">
                  <div className="flex items-center gap-md">
                    <span style={{ 
                      width: 8, 
                      height: 8, 
                      borderRadius: '50%', 
                      background: ['var(--color-danger)', 'var(--color-warning)', 'var(--color-info)', 'var(--color-primary)', 'var(--text-muted)'][i] 
                    }}></span>
                    <span style={{ textTransform: 'capitalize' }}>{v.category || v._id}</span>
                  </div>
                  <span style={{ fontWeight: 600 }}>{v.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <p>No violations detected</p>
            </div>
          )}
        </div>

        {/* Recent Analyses */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Analyses</h3>
            <Link to="/reports" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
              View All →
            </Link>
          </div>
          {recentAnalyses.length > 0 ? (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Design</th>
                    <th>Score</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAnalyses.map((analysis) => (
                    <tr key={analysis.id}>
                      <td>
                        <Link to={`/analysis/${analysis.id}`}>
                          {analysis.design?.name || analysis.design?.canvasId || 'Design'}
                        </Link>
                      </td>
                      <td>
                        <span className={`score-badge ${getScoreClass(analysis.complianceScore)}`}>
                          {analysis.complianceScore}%
                        </span>
                      </td>
                      <td>{analysis.violationsCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p>No analyses yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations */}
      {summary?.recommendations?.length > 0 && (
        <div className="card mt-lg">
          <div className="card-header">
            <h3 className="card-title">Recommended Actions</h3>
          </div>
          <div className="grid grid-2" style={{ gap: 'var(--space-md)' }}>
            {summary.recommendations.map((rec, i) => (
              <div key={i} style={{ 
                padding: 'var(--space-md)', 
                background: 'rgba(0,0,0,0.2)', 
                borderRadius: 'var(--border-radius-md)',
                borderLeft: `3px solid ${rec.priority === 'critical' ? 'var(--color-danger)' : rec.priority === 'high' ? 'var(--color-warning)' : 'var(--color-primary)'}`
              }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)', textTransform: 'uppercase' }}>
                  {rec.priority} • {rec.category}
                </div>
                <div style={{ fontWeight: 500, marginBottom: 'var(--space-xs)' }}>{rec.action}</div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{rec.impact}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RiskBar({ label, value }) {
  const color = value > 60 ? 'var(--color-danger)' : value > 30 ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <div>
      <div className="flex flex-between items-center mb-sm">
        <span style={{ fontSize: 'var(--font-size-sm)' }}>{label}</span>
        <span style={{ fontWeight: 600, color }}>{value}%</span>
      </div>
      <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${value}%`, height: '100%', background: color, transition: 'width 0.5s ease' }}></div>
      </div>
    </div>
  );
}
