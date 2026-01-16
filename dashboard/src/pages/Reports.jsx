import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { analysisAPI, reportsAPI } from '../api/client';
import { formatDateTime, getScoreClass, getScoreLabel } from '../hooks/useApi';

export default function Reports() {
  const [analyses, setAnalyses] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('analyses');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (activeTab === 'analyses') {
          const res = await analysisAPI.history({ page, limit: 10 });
          setAnalyses(res.data?.analyses || []);
          setPagination(res.data?.pagination || {});
        } else {
          const res = await reportsAPI.list({ page, limit: 10 });
          setReports(res.data?.reports || []);
          setPagination(res.data?.pagination || {});
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [activeTab, page]);

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Reports & Analyses</h1>
        <p className="page-subtitle">View all design analyses and generated reports</p>
      </header>

      {/* Tabs */}
      <div className="flex gap-md mb-lg">
        <button
          className={`btn ${activeTab === 'analyses' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('analyses'); setPage(1); }}
        >
          📋 Analyses
        </button>
        <button
          className={`btn ${activeTab === 'reports' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => { setActiveTab('reports'); setPage(1); }}
        >
          📊 Reports
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-secondary">
            📥 Export (Mock)
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">
            <div className="loading-spinner" />
          </div>
        ) : activeTab === 'analyses' ? (
          <>
            {analyses.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Design</th>
                      <th>Brand Kit</th>
                      <th>Score</th>
                      <th>Status</th>
                      <th>Violations</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.map((analysis) => (
                      <tr key={analysis.id}>
                        <td>
                          <div style={{ fontWeight: 500 }}>
                            {analysis.design?.name || analysis.design?.canvasId || 'Design'}
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {analysis.brandKit?.name || 'Unknown'}
                        </td>
                        <td>
                          <span className={`score-badge ${getScoreClass(analysis.complianceScore)}`}>
                            {analysis.complianceScore}%
                          </span>
                        </td>
                        <td>
                          <span className={`score-badge ${analysis.scoreLabel || getScoreClass(analysis.complianceScore)}`}>
                            {getScoreLabel(analysis.complianceScore)}
                          </span>
                        </td>
                        <td>
                          <span style={{ 
                            color: analysis.violationsCount > 5 ? 'var(--color-danger)' : 
                                   analysis.violationsCount > 0 ? 'var(--color-warning)' : 'var(--color-success)'
                          }}>
                            {analysis.violationsCount}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                          {formatDateTime(analysis.createdAt)}
                        </td>
                        <td>
                          <Link to={`/analysis/${analysis.id}`} className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
                            View Details
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <p>No analyses found</p>
                <p style={{ fontSize: 'var(--font-size-sm)' }}>Run an analysis from Adobe Express to see results here</p>
              </div>
            )}
          </>
        ) : (
          <>
            {reports.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Report Title</th>
                      <th>Brand Kit</th>
                      <th>Analyses</th>
                      <th>Avg Score</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((report) => (
                      <tr key={report.id}>
                        <td style={{ fontWeight: 500 }}>{report.title}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>
                          {report.brandKit?.name || 'Unknown'}
                        </td>
                        <td>{report.analysesCount}</td>
                        <td>
                          {report.summary?.averageComplianceScore ? (
                            <span className={`score-badge ${getScoreClass(report.summary.averageComplianceScore)}`}>
                              {Math.round(report.summary.averageComplianceScore)}%
                            </span>
                          ) : 'N/A'}
                        </td>
                        <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                          {formatDateTime(report.createdAt)}
                        </td>
                        <td>
                          <button className="btn btn-secondary" style={{ fontSize: 'var(--font-size-xs)' }}>
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">📊</div>
                <p>No reports generated yet</p>
              </div>
            )}
          </>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex flex-between items-center mt-lg" style={{ paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-color)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex gap-sm">
              <button 
                className="btn btn-secondary" 
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Previous
              </button>
              <button 
                className="btn btn-secondary" 
                disabled={page >= pagination.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
