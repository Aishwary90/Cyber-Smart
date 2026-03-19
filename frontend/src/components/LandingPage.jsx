import React, { useState, useEffect, useRef } from "react";
import "./LandingPage.css";

export function LandingPage({ onStart }) {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const simState = "idle";
  const containerRef = useRef(null);

  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const { left, top, width, height } = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    setMousePos({ x, y });
  };

  const handleStartInteraction = () => {
    onStart();
  };

  const getTransform = (depth) => {
    return {
      transform: `translate3d(${mousePos.x * depth}px, ${mousePos.y * depth}px, 0)`
    };
  };

  return (
    <div className="landing-shell-4d" onMouseMove={handleMouseMove} ref={containerRef}>
      <div className="bg-grid" />
      <div
        className="cursor-light"
        style={{
          left: `calc(50% + ${mousePos.x * 100}vw)`,
          top: `calc(50% + ${mousePos.y * 100}vh)`
        }}
      />

      <header className="landing-topbar-4d">
        <div className="brand-group">
          <div className="brand-mark">CS</div>
          <div>
            <p className="brand-eyebrow">Cyber Investigation Interface</p>
            <h1 style={{ margin: 0, fontSize: "1.2rem" }}>CyberSmart AI</h1>
          </div>
        </div>
        <div className="landing-top-actions">
          <button className="landing-secondary" type="button" onClick={onStart}>
            Login / Signup
          </button>
        </div>
      </header>

      <main className="landing-content-4d">
        <section className="landing-hero-4d">
          <div className="hero-left-4d">
            <h1 className="hero-title-4d">
              Understand cyber incidents before you panic.
            </h1>
            <p className="hero-sub-4d">
              We don’t give more data. We give the right understanding.
            </p>
            <button className="hero-cta-4d" onClick={handleStartInteraction}>
              Start Investigation
            </button>
          </div>

          <div className="hero-right-4d">
            <div className={`ai-core-4d state-${simState}`} style={getTransform(15)}>
              <div className="ai-core-glow" />
              <div className="ai-core-ring ring-1" />
              <div className="ai-core-ring ring-2" />
              <div className="ai-core-orb"></div>
            </div>

            <div className="floating-cards-4d">
              <div className={`glass-card-4d card-input state-${simState}`} style={getTransform(20)}>
                <span className="card-kicker-4d">User Input</span>
                <div className="typing-text">"Seller stopped responding..."</div>
              </div>

              <div className={`glass-card-4d card-analysis state-${simState}`} style={getTransform(30)}>
                <span className="card-kicker-4d">Analysis</span>
                <strong>Marketplace Scam</strong>
                <p>82% confidence</p>
              </div>

              <div className={`glass-card-4d card-question state-${simState}`} style={getTransform(45)}>
                <span className="card-kicker-4d">Question</span>
                <strong>Did seller stop responding?</strong>
                <div className="card-options-4d">
                  <span>Yes</span>
                  <span>No</span>
                </div>
              </div>

              <div className={`glass-card-4d card-verdict state-${simState}`} style={getTransform(60)}>
                <span className="card-kicker-4d">Verdict</span>
                <strong>Not a cybercrime</strong>
                <p>Consumer Dispute Route</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
