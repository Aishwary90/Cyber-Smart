import React, { useState } from 'react';
import './Phishing.css';

// Use the same backend as the main API
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function AnalyzerHome({ onScan }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/api/phishing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      onScan(data);
    } catch (error) {
      console.error("Error connecting to Phishing Analyzer API:", error);
      setError("Failed to analyze URL. Please check if the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="phishing-container" style={{ minHeight: '100%' }}>
      <div className="phishing-glass-panel">
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '50%', background: 'linear-gradient(to bottom, rgba(255,255,255,0.05), transparent)', pointerEvents: 'none' }} />
        
        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, textAlign: 'center', marginBottom: '0.5rem', letterSpacing: '-0.025em' }}>
          <span style={{ color: 'transparent', backgroundClip: 'text', backgroundImage: 'linear-gradient(to right, #60a5fa, #c084fc)' }}>🛡️ Analyzer</span>
        </h1>
        <p style={{ textAlign: 'center', fontSize: '0.875rem', color: '#d1d5db', marginBottom: '2rem', fontWeight: 300 }}>
          AI-powered detection for suspicious URLs.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <input
              type="url"
              placeholder="Paste URL (e.g., https://site.com)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              className="phishing-skeuo-input"
            />
          </div>
          {error && (
            <div style={{ padding: '0.75rem', background: 'rgba(248, 113, 113, 0.1)', border: '1px solid rgba(248, 113, 113, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            className="phishing-skeuo-btn"
            disabled={loading}
          >
            🔍 <span>{loading ? "SCANNING..." : "Start Scan"}</span>
            {loading && <span className="phishing-spinner"></span>}
          </button>
        </form>

        <div style={{ marginTop: '2.5rem', fontSize: '0.875rem', color: '#d1d5db' }} className="phishing-glass-card">
          <p style={{ fontWeight: 600, color: '#d8b4fe', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span>⚠️</span> Quick Tips</p>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.75rem' }}>
            <li><span style={{ color: '#4ade80', fontWeight: 'bold' }}>✓</span> Check for HTTPS in the URL.</li>
            <li><span style={{ color: '#f87171', fontWeight: 'bold' }}>✓</span> Avoid links with typos or strange spellings.</li>
            <li><span style={{ color: '#facc15', fontWeight: 'bold' }}>✓</span> Don’t click shortened URLs without verifying.</li>
          </ul>
        </div>
        
        <div style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.75rem', color: 'rgba(191, 219, 254, 0.6)', fontWeight: 500 }}>
          🔒 No data stored. Your privacy is our priority.
        </div>
      </div>
    </div>
  );
}
