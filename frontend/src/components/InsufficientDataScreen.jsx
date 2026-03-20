export function InsufficientDataScreen({ trainingData }) {
  if (!trainingData) {
    return null;
  }

  return (
    <section className="flow-card insufficient-data-card">
      <div className="insufficient-data-header">
        <div className="insufficient-data-icon">📚</div>
        <div>
          <h3>More Training Data Needed</h3>
          <p>{trainingData.message}</p>
        </div>
      </div>

      <div className="insufficient-data-content">
        <div className="training-section">
          <h4>What Information We Need:</h4>
          <ul className="training-list">
            {trainingData.what_needed?.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="training-section">
          <h4>How You Can Help:</h4>
          <ul className="training-list">
            {trainingData.how_to_help?.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="training-section">
          <h4>Learn More:</h4>
          <div className="training-links">
            {trainingData.learn_more?.legal_cases && (
              <a
                href={trainingData.learn_more.legal_cases}
                target="_blank"
                rel="noopener noreferrer"
                className="training-link"
              >
                📋 Legal Case Database (Indian Kanoon)
              </a>
            )}
            {trainingData.learn_more?.incident_database && (
              <a
                href={trainingData.learn_more.incident_database}
                target="_blank"
                rel="noopener noreferrer"
                className="training-link"
              >
                🔍 Incident Database (Cybercrime.gov.in)
              </a>
            )}
            {trainingData.learn_more?.training_resources && (
              <a
                href={trainingData.learn_more.training_resources}
                target="_blank"
                rel="noopener noreferrer"
                className="training-link"
              >
                🎓 Training Resources (NCRB)
              </a>
            )}
          </div>
        </div>

        <div className="insufficient-data-footer">
          <p className="footer-note">
            ✓ Every new case you submit helps improve our system
          </p>
          <p className="footer-note">
            ✓ Your feedback corrections are used for continuous learning
          </p>
        </div>
      </div>
    </section>
  );
}
