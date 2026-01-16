import { useState, useEffect } from 'react';
import { brandKitAPI } from '../api/client';
import { formatDateTime } from '../hooks/useApi';

export default function BrandKits() {
  const [brandKits, setBrandKits] = useState([]);
  const [selectedKit, setSelectedKit] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await brandKitAPI.list();
        setBrandKits(res.data?.brandKits || []);
      } catch (err) {
        console.error('Failed to load brand kits:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleViewVersions = async (kit) => {
    setSelectedKit(kit);
    setShowVersions(true);
    try {
      const res = await brandKitAPI.getVersions(kit._id);
      setVersions(res.data?.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
      setVersions([]);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div>
      <header className="page-header">
        <div className="flex flex-between items-center">
          <div>
            <h1 className="page-title">Brand Kits</h1>
            <p className="page-subtitle">Manage brand governance rules and guidelines</p>
          </div>
          <button className="btn btn-primary">
            + Create Brand Kit
          </button>
        </div>
      </header>

      {brandKits.length > 0 ? (
        <div className="grid grid-3">
          {brandKits.map((kit) => (
            <div key={kit._id} className="card" style={{ cursor: 'pointer' }} onClick={() => handleViewVersions(kit)}>
              <div className="flex flex-between items-center mb-md">
                <h3 style={{ margin: 0 }}>{kit.name}</h3>
                {kit.isDefault && (
                  <span style={{ 
                    fontSize: 'var(--font-size-xs)', 
                    padding: '2px 8px', 
                    background: 'var(--color-primary)', 
                    borderRadius: 4 
                  }}>
                    Default
                  </span>
                )}
              </div>
              
              {kit.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-md)' }}>
                  {kit.description}
                </p>
              )}

              {/* Colors */}
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>
                  Colors ({kit.colors?.length || 0})
                </div>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  {kit.colors?.slice(0, 6).map((color, i) => (
                    <div 
                      key={i}
                      title={`${color.name}: ${color.hex}`}
                      style={{ 
                        width: 28, 
                        height: 28, 
                        borderRadius: 4, 
                        background: color.hex,
                        border: '2px solid var(--border-color)',
                      }}
                    />
                  ))}
                  {kit.colors?.length > 6 && (
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', alignSelf: 'center' }}>
                      +{kit.colors.length - 6}
                    </span>
                  )}
                </div>
              </div>

              {/* Fonts */}
              <div style={{ marginBottom: 'var(--space-md)' }}>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 'var(--space-xs)' }}>
                  Fonts ({kit.fonts?.length || 0})
                </div>
                <div className="flex gap-sm" style={{ flexWrap: 'wrap' }}>
                  {kit.fonts?.slice(0, 3).map((font, i) => (
                    <span 
                      key={i}
                      style={{ 
                        fontSize: 'var(--font-size-xs)', 
                        padding: '2px 8px', 
                        background: 'var(--bg-hover)', 
                        borderRadius: 4,
                        fontFamily: font.name,
                      }}
                    >
                      {font.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-between items-center" style={{ paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  v{kit.version || 1}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                  {formatDateTime(kit.updatedAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">🎨</div>
            <p>No brand kits created yet</p>
            <button className="btn btn-primary mt-md">
              Create Your First Brand Kit
            </button>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {showVersions && selectedKit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowVersions(false)}>
          <div className="card" style={{ maxWidth: 600, width: '90%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3 className="card-title">Version History: {selectedKit.name}</h3>
              <button className="btn btn-secondary" onClick={() => setShowVersions(false)}>✕</button>
            </div>
            
            {versions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {versions.map((v, i) => (
                  <div key={i} style={{ 
                    padding: 'var(--space-md)', 
                    background: v.isCurrent ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-hover)', 
                    borderRadius: 'var(--border-radius-md)',
                    border: v.isCurrent ? '1px solid var(--color-primary)' : '1px solid transparent',
                  }}>
                    <div className="flex flex-between items-center">
                      <div className="flex items-center gap-sm">
                        <span style={{ fontWeight: 600 }}>Version {v.version}</span>
                        {v.isCurrent && (
                          <span style={{ 
                            fontSize: 'var(--font-size-xs)', 
                            padding: '2px 8px', 
                            background: 'var(--color-primary)', 
                            borderRadius: 4 
                          }}>
                            Current
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                        {formatDateTime(v.changedAt)}
                      </span>
                    </div>
                    {v.changeNote && v.changeNote !== 'Current version' && (
                      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>
                        {v.changeNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>No version history available</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
