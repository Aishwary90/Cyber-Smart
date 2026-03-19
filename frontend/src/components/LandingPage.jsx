export function LandingPage({ onStart }) {
  return (
    <div className="landing-shell">
      <div className="bg-blob blob-a" />
      <div className="bg-blob blob-b" />
      <div className="bg-blob blob-c" />
      <div className="bg-blob blob-d" />
      <div className="bg-blob blob-e" />

      <header className="landing-topbar">
        <div className="brand-group">
          <div className="brand-mark">CS</div>
          <div>
            <p className="brand-eyebrow">Cyber intelligence platform</p>
            <h1>CyberSmart AI</h1>
          </div>
        </div>

        <div className="landing-top-actions">
          <button className="landing-primary" type="button" onClick={onStart}>
            Login / Sign Up
          </button>
        </div>
      </header>

      <main className="landing-content">
        <section className="landing-hero">
          <div className="landing-copy">
            <span className="landing-chip">Guided cyber diagnosis system</span>
            <h2>Understand cyber incidents before you panic, report, or lose evidence.</h2>
            <p>
              CyberSmart AI helps users describe what happened, verifies the facts
              step by step, maps the case to cyber law, and turns confusion into a
              structured action plan.
            </p>

            <div className="landing-cta-row">
              <button className="landing-primary" type="button" onClick={onStart}>
                Enter Platform
              </button>
              <button className="landing-secondary" type="button" onClick={onStart}>
                Continue to Login
              </button>
            </div>

            <div className="landing-stats">
              <div className="landing-stat-card">
                <strong>4-step flow</strong>
                <span>Understand - Verify - Confirm - Act</span>
              </div>
              <div className="landing-stat-card">
                <strong>Hybrid engine</strong>
                <span>ML classification + verified legal rule system</span>
              </div>
              <div className="landing-stat-card">
                <strong>Built for trust</strong>
                <span>Handles cybercrime and not-a-crime cases clearly</span>
              </div>
            </div>
          </div>

          <div className="landing-visual">
            <div className="landing-orb-core">
              <div className="landing-orb-ring ring-one" />
              <div className="landing-orb-ring ring-two" />
              <div className="landing-orb-center">
                <span>CyberSmart</span>
                <strong>AI Triage Core</strong>
              </div>
            </div>

            <div className="floating-feature-card card-analysis">
              <span className="feature-card-kicker">Analysis</span>
              <strong>Possible matches</strong>
              <p>Phishing 82% • UPI Fraud 71%</p>
            </div>

            <div className="floating-feature-card card-verification">
              <span className="feature-card-kicker">Verification</span>
              <strong>One question at a time</strong>
              <p>Did you click a link sent by message?</p>
            </div>

            <div className="floating-feature-card card-verdict">
              <span className="feature-card-kicker">Verdict</span>
              <strong>Action-ready outcome</strong>
              <p>Law sections, evidence, and reporting steps</p>
            </div>
          </div>
        </section>

        <section className="landing-grid-panels">
          <article className="landing-info-panel">
            <span className="landing-panel-title">What the platform does</span>
            <h3>Not a chatbot. A structured cyber guidance engine.</h3>
            <p>
              Users do not need to know legal terms. They simply explain the
              incident, and the system guides them through a controlled diagnostic
              flow.
            </p>
          </article>

          <article className="landing-info-panel">
            <span className="landing-panel-title">Who it serves</span>
            <h3>Public mode and student mode in one product.</h3>
            <p>
              Public users get urgency, evidence preservation, and next steps.
              Students get deeper explanations and why a law or route applies.
            </p>
          </article>

          <article className="landing-info-panel">
            <span className="landing-panel-title">Why it matters</span>
            <h3>It builds trust by detecting non-crimes too.</h3>
            <p>
              The system should not classify everything as cybercrime. It should
              also route civil disputes and consumer issues correctly.
            </p>
          </article>
        </section>

        <section className="landing-process-strip">
          <div className="process-card">
            <span>01</span>
            <strong>Describe the issue</strong>
            <p>Tell the platform what happened in plain language.</p>
          </div>
          <div className="process-card">
            <span>02</span>
            <strong>Verify the facts</strong>
            <p>The system asks focused confirmation questions.</p>
          </div>
          <div className="process-card">
            <span>03</span>
            <strong>See the verdict</strong>
            <p>Get law mapping, risk level, and next steps.</p>
          </div>
          <div className="process-card">
            <span>04</span>
            <strong>Act with confidence</strong>
            <p>Preserve evidence and report through the right channel.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
