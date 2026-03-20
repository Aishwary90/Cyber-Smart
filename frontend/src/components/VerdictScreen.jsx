import { useEffect, useState } from "react";

export function VerdictScreen({ scenario, verdictReady, confidence, confidenceSummary, children }) {
  const { verdict } = scenario;
  const isCrime = verdict.kind === "confirmed_cybercrime";
  const [displayConfidence, setDisplayConfidence] = useState(0);

  useEffect(() => {
    if (!verdictReady || confidence === undefined) return;
    
    // Quick animation for the confidence meter
    const timer = window.setInterval(() => {
      setDisplayConfidence((current) => {
        if (current === confidence) {
          window.clearInterval(timer);
          return current;
        }

        const delta = confidence - current;
        const increment = Math.abs(delta) < 3 ? Math.sign(delta) : Math.round(delta / 3);
        const next = current + increment;

        if ((delta > 0 && next > confidence) || (delta < 0 && next < confidence)) {
          return confidence;
        }

        return next;
      });
    }, 30);

    return () => window.clearInterval(timer);
  }, [confidence, verdictReady]);

  if (!verdictReady) {
    return null;
  }

  return (
    <section className={isCrime ? "flow-card verdict-card verdict-danger" : "flow-card verdict-card verdict-neutral verdict-not-crime"}>
      <div className="verdict-header">
        <div>
          <span className="verdict-eyebrow">{isCrime ? "Confirmed outcome" : "Alternate outcome"}</span>
          <h3>{verdict.title}</h3>
          <p>{verdict.subtitle}</p>
        </div>
        <span className={isCrime ? "verdict-risk danger-pill" : "verdict-risk warning-pill"}>
          Risk: {verdict.risk}
        </span>
      </div>

      <div className="verdict-section confidence-explanation-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h4 style={{ margin: 0 }}>System Confidence</h4>
          <strong style={{ fontSize: '1.1rem' }}>{displayConfidence}%</strong>
        </div>
        <div className="confidence-meter" style={{ marginBottom: '16px' }}>
          <span className="confidence-meter-fill" style={{ width: `${displayConfidence}%` }} />
        </div>
        <p>{verdict.confidence}</p>
        {confidenceSummary && <p style={{ marginTop: '8px' }}>{confidenceSummary}</p>}
        {verdict.explanation ? <p style={{ marginTop: '8px' }}>{verdict.explanation}</p> : null}
      </div>

      {verdict.decisionReasoning ? (
        <div className="verdict-section">
          <h4>Why This Result</h4>
          {verdict.decisionReasoning.summary ? (
            <p>{verdict.decisionReasoning.summary}</p>
          ) : null}

          {verdict.decisionReasoning.matchedSignals?.length ? (
            <>
              <h4>Matched Signals</h4>
              <ul className="verdict-step-list">
                {verdict.decisionReasoning.matchedSignals.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}

          {verdict.decisionReasoning.missingSignals?.length ? (
            <>
              <h4>Why Not Something Else</h4>
              <ul className="verdict-step-list">
                {verdict.decisionReasoning.missingSignals.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}

          {verdict.decisionReasoning.whatWouldChange?.length ? (
            <>
              <h4>What Would Change This</h4>
              <ul className="verdict-step-list">
                {verdict.decisionReasoning.whatWouldChange.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="verdict-section">
        <h4>Legal Info</h4>
        {verdict.legalPosition?.summary ? <p>{verdict.legalPosition.summary}</p> : null}
        <div className="legal-tag-group">
          {verdict.legalSections.map((section) => (
            <span key={section} className="legal-tag">
              {section}
            </span>
          ))}
        </div>
      </div>

      <div className="verdict-section">
        <h4>{isCrime ? "What You Should Do" : "Recommended Route"}</h4>
        <ol className="verdict-step-list">
          {verdict.actionPlan.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      {children}

      <div className="verdict-footer">
        <strong>{verdict.destination}</strong>
        <button className="report-button" type="button">
          {isCrime ? "Report Now" : "Learn More"}
        </button>
      </div>
    </section>
  );
}
