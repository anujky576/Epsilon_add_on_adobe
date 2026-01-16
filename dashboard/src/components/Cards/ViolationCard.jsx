export default function ViolationCard({ violation }) {
  const { type, severity, description, suggestedFix, affectedElement } = violation;
  
  return (
    <div className={`violation-card ${severity}`}>
      <div style={{ flex: 1 }}>
        <div className="violation-type">
          {severity.toUpperCase()} • {type.toUpperCase()}
        </div>
        <div className="violation-description">{description}</div>
        {affectedElement && (
          <div className="violation-fix" style={{ marginBottom: 'var(--space-xs)' }}>
            <strong>Element:</strong> {typeof affectedElement === 'string' ? affectedElement : JSON.stringify(affectedElement)}
          </div>
        )}
        {suggestedFix && (
          <div className="violation-fix">
            <strong>Fix:</strong> {typeof suggestedFix === 'string' ? suggestedFix : suggestedFix.action || 'Review manually'}
          </div>
        )}
      </div>
    </div>
  );
}
