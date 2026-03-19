export function EvidenceChecklist({ evidence }) {
  return (
    <div className="verdict-section evidence-section">
      <h4>Evidence Checklist</h4>
      <div className="evidence-checklist">
        {evidence.map((item) => (
          <div className="evidence-check-item" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.priority}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
