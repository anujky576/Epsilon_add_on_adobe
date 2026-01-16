import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { analysisAPI, autoFixAPI } from '../api/client';
import { formatDateTime, getScoreClass, getScoreLabel } from '../hooks/useApi';
import ScoreGauge from '../components/Charts/ScoreGauge';
import ViolationCard from '../components/Cards/ViolationCard';

export default function DesignAnalysis() {
  const { id } = useParams();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('designer'); // 'designer' or 'manager'

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await analysisAPI.get(id);
        setAnalysis(res.data?.analysis);
      } catch (err) {
        console.error('Failed to load analysis:', err);
      } finally {
        setLoading(false);
      }
    }
    if (id) fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div>
        <header className="page-header">
          <h1 className="page-title">Analysis Not Found</h1>
        </header>
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">❌</div>
            <p>The requested analysis could not be found.</p>
            <Link to="/reports" className="btn btn-primary mt-md">
              View All Reports
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Group violations by type
  const violationsByType = (analysis.violations || []).reduce((acc, v) => {
    const type = v.type || 'other';
    if (!acc[type]) acc[type] = [];
    acc[type].push(v);
    return acc;
  }, {});

  // Group violations by severity for manager view
  const violationsBySeverity = (analysis.violations || []).reduce((acc, v) => {
    const severity = v.severity || 'low';
    if (!acc[severity]) acc[severity] = [];
    acc[severity].push(v);
    return acc;
  }, {});

  const severityOrder = ['critical', 'high', 'medium', 'low'];

  return (
    <div>
      <header className="page-header">
        <div className="flex flex-between items-center">
          <div>
            <Link to="/reports" style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
              ← Back to Reports
            </Link>
            <h1 className="page-title mt-sm">Design Analysis</h1>
            <p className="page-subtitle">
              Analyzed on {formatDateTime(analysis.createdAt)}
            </p>
          </div>
          <div className="flex gap-md">
            <button 
              className={`btn ${viewMode === 'designer' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('designer')}
            >
              👨‍🎨 Designer View
            </button>
            <button 
              className={`btn ${viewMode === 'manager' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setViewMode('manager')}
            >
              👔 Manager View
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-3 mb-lg">
        {/* Score Gauge */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Compliance Score</h3>
            <span className={`score-badge ${getScoreClass(analysis.complianceScore)}`}>
              {getScoreLabel(analysis.complianceScore)}
            </span>
          </div>
          <div className="flex flex-center" style={{ padding: 'var(--space-md) 0' }}>
            <ScoreGauge score={analysis.complianceScore} size={160} />
          </div>
        </div>

        {/* Summary */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <h3 className="card-title">Summary</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: 'var(--space-lg)' }}>
            {analysis.summary || 'No summary available.'}
          </p>
          
          {/* Category Scores */}
          {analysis.categoryScores?.length > 0 && (
            <div>
              <h4 style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-md)' }}>
                Category Breakdown
              </h4>
              <div className="flex gap-lg" style={{ flexWrap: 'wrap' }}>
                {analysis.categoryScores.map((cat, i) => (
                  <div key={i} style={{ minWidth: 100 }}>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {cat.category}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>
                      <span style={{ color: cat.score >= 70 ? 'var(--color-success)' : cat.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)' }}>
                        {Math.round(cat.score)}%
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                      {cat.violations || 0} issues
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Violations */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            Violations ({analysis.violations?.length || 0})
          </h3>
          {analysis.violations?.some(v => v.autoFixable) && (
            <button className="btn btn-primary">
              🔧 Auto-Fix Available
            </button>
          )}
        </div>

        {analysis.violations?.length > 0 ? (
          viewMode === 'designer' ? (
            // Designer View - Grouped by Type
            <div>
              {Object.entries(violationsByType).map(([type, violations]) => (
                <div key={type} style={{ marginBottom: 'var(--space-xl)' }}>
                  <h4 style={{ 
                    textTransform: 'capitalize', 
                    marginBottom: 'var(--space-md)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                  }}>
                    <span>
                      {type === 'color' ? '🎨' : 
                       type === 'font' ? '🔤' : 
                       type === 'logo' ? '🖼️' : 
                       type === 'accessibility' ? '♿' : 
                       type === 'tone' ? '💬' : '⚠️'}
                    </span>
                    {type} Issues ({violations.length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                    {violations.map((v, i) => (
                      <ViolationCard key={i} violation={v} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Manager View - Grouped by Business Impact (Severity)
            <div>
              {severityOrder.map(severity => {
                const violations = violationsBySeverity[severity];
                if (!violations?.length) return null;
                
                const impactLabels = {
                  critical: '🚨 Business Critical',
                  high: '⚠️ High Business Impact',
                  medium: '📋 Moderate Impact',
                  low: '📝 Low Priority',
                };
                
                const impactDescriptions = {
                  critical: 'These issues could cause immediate brand damage or legal liability.',
                  high: 'These issues significantly affect brand perception and should be addressed soon.',
                  medium: 'These issues affect brand consistency but are not urgent.',
                  low: 'Minor issues that can be addressed when convenient.',
                };
                
                return (
                  <div key={severity} style={{ marginBottom: 'var(--space-xl)' }}>
                    <h4 style={{ marginBottom: 'var(--space-xs)' }}>
                      {impactLabels[severity]} ({violations.length})
                    </h4>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
                      {impactDescriptions[severity]}
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                      {violations.map((v, i) => (
                        <ViolationCard key={i} violation={v} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <p>No violations found - this design is fully compliant!</p>
          </div>
        )}
      </div>
    </div>
  );
}
