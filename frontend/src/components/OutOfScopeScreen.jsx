export function OutOfScopeScreen({ scopeError }) {
  if (!scopeError) {
    return null;
  }

  return (
    <section className="flow-card out-of-scope-card">
      <div className="out-of-scope-header">
        <div className="out-of-scope-icon">🚫</div>
        <div>
          <h3>Outside My Expertise</h3>
          <p>This model is for cyber-related queries. Please ask relevant questions or provide relevant information that belongs to my expertise.</p>
        </div>
      </div>

      <div className="out-of-scope-content">
        <div className="scope-section">
          <h4>✓ I Can Help With:</h4>
          <div className="scope-examples">
            <div className="scope-example">
              <span className="icon">💳</span>
              <div>
                <strong>Financial Fraud</strong>
                <p>Money stolen, unauthorized transactions, UPI scams</p>
              </div>
            </div>
            <div className="scope-example">
              <span className="icon">🔑</span>
              <div>
                <strong>Account Hacking</strong>
                <p>Unauthorized access, forgotten passwords, stolen accounts</p>
              </div>
            </div>
            <div className="scope-example">
              <span className="icon">📧</span>
              <div>
                <strong>Phishing & Scams</strong>
                <p>Suspicious emails, fake links, impersonation</p>
              </div>
            </div>
            <div className="scope-example">
              <span className="icon">⚠️</span>
              <div>
                <strong>Cybersecurity Threats</strong>
                <p>Malware, data theft, blackmail, online harassment</p>
              </div>
            </div>
          </div>
        </div>

        <div className="scope-section">
          <h4>❌ I Cannot Help With:</h4>
          <div className="out-of-scope-list">
            <span>Personal relationships</span>
            <span>Health and medical advice</span>
            <span>Academic homework</span>
            <span>General knowledge questions</span>
            <span>Non-digital crimes</span>
            <span>Legal advice (general)</span>
          </div>
        </div>

        <div className="scope-section tips-section">
          <h4>💡 Try Describing:</h4>
          <ul className="tips-list">
            <li>What happened online or with your accounts?</li>
            <li>Was there unauthorized access to your personal data?</li>
            <li>Did you lose money or receive suspicious requests?</li>
            <li>Did someone threaten or harass you online?</li>
            <li>Did you receive a suspicious email, link, or message?</li>
            <li>Is your device behaving strangely (slow, crashing, data loss)?</li>
          </ul>
        </div>

        <div className="scope-footer">
          <p className="footer-emphasis">
            Please provide details about your cybersecurity concern, and I'll help guide you through it with legal information and action steps.
          </p>
        </div>
      </div>
    </section>
  );
}
