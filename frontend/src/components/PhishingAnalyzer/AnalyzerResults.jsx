import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';
import './Phishing.css';

export function AnalyzerResults({ result, onBack }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (chartRef.current) {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      
      const ctx = chartRef.current.getContext('2d');
      Chart.defaults.color = '#cbd5e1';
      Chart.defaults.font.family = "'Outfit', sans-serif";
      
      chartInstance.current = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Spelling', 'Age', 'IP', 'Security', 'Keywords'],
          datasets: [{
            label: 'Risk Score',
            data: result.details.map(check => check.score),
            backgroundColor: [
              'rgba(248, 113, 113, 0.85)',
              'rgba(250, 204, 21, 0.85)',
              'rgba(74, 222, 128, 0.85)',
              'rgba(96, 165, 250, 0.85)',
              'rgba(167, 139, 250, 0.85)'
            ],
            borderColor: [
              'rgb(248, 113, 113)',
              'rgb(250, 204, 21)',
              'rgb(74, 222, 128)',
              'rgb(96, 165, 250)',
              'rgb(167, 139, 250)'
            ],
            borderWidth: 1,
            borderRadius: 6,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              grid: { color: 'rgba(255, 255, 255, 0.05)', drawBorder: false }
            },
            x: {
              grid: { display: false, drawBorder: false }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [result]);

  const scoreColor = result.score <= 30 ? '#4ade80' : result.score <= 60 ? '#facc15' : '#ef4444';

  return (
    <div className="phishing-container" style={{ minHeight: '100%', padding: '2rem' }}>
      <div className="phishing-glass-panel result-max-width" style={{ maxWidth: '42rem' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 800, textAlign: 'center', marginBottom: '1.5rem', color: 'transparent', backgroundClip: 'text', backgroundImage: 'linear-gradient(to right, #93c5fd, #d8b4fe)' }}>
          🔍 URL Safety Check
        </h1>
        
        <div className="phishing-glass-card" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '0.25rem' }}>Target URL</p>
          <p style={{ fontSize: '1.125rem', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{result.url}</p>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, marginBottom: '0.5rem' }}>Risk Score</p>
          <p style={{ fontSize: '3.75rem', fontWeight: 900, color: '#f87171', textShadow: '0 0 25px rgba(248, 113, 113, 0.4)' }}>
            {result.score}<span style={{ fontSize: '1.5rem', color: 'rgba(239, 68, 68, 0.5)' }}>/100</span>
          </p>
        </div>

        <div className="phishing-glass-card" style={{ textAlign: 'center', marginBottom: '2rem', borderLeft: `4px solid ${scoreColor}` }}>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold', color: scoreColor, marginBottom: '0.5rem' }}>{result.safety_recommendation.status}</p>
          <p style={{ color: '#e5e7eb', fontSize: '1rem', fontWeight: 300 }}>{result.safety_recommendation.message}</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
          <div className="phishing-glass-card">
            <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: '#93c5fd', marginBottom: '1rem', opacity: 0.8 }}>Risk Breakdown</h2>
            <div style={{ position: 'relative', height: '200px' }}>
              <canvas ref={chartRef}></canvas>
            </div>
          </div>
          
          <div className="phishing-glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h2 style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: '#d8b4fe', marginBottom: '1.25rem', opacity: 0.8 }}>Score Legend</h2>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem', fontWeight: 300 }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ width: '1rem', height: '1rem', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 10px rgba(74,222,128,0.8)' }}></span> 
                <span style={{ color: '#e5e7eb' }}>0–30: Likely safe</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ width: '1rem', height: '1rem', borderRadius: '50%', background: '#facc15', boxShadow: '0 0 10px rgba(250,204,21,0.8)' }}></span> 
                <span style={{ color: '#e5e7eb' }}>31–60: Minor risks</span>
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ width: '1rem', height: '1rem', borderRadius: '50%', background: '#f87171', boxShadow: '0 0 10px rgba(248,113,113,0.8)' }}></span> 
                <span style={{ color: '#e5e7eb' }}>61–100: High risk</span>
              </li>
            </ul>
          </div>
        </div>

        <h2 style={{ fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600, color: '#e9d5ff', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Analysis Details</h2>
        <div className="phishing-glass-card" style={{ marginBottom: '2rem' }}>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {result.details.map((check, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ color: '#60a5fa', marginRight: '0.75rem', fontSize: '1.25rem' }}>•</span>
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'white', display: 'block', marginBottom: '0.25rem', fontWeight: 500 }}>{check.name}</strong> 
                  <span style={{ color: '#d1d5db', fontSize: '0.875rem', opacity: 0.9 }}>{check.details}</span>
                </div>
                {check.score > 0 && (
                  <div style={{ marginLeft: '0.75rem', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.2)', color: '#fca5a5', padding: '0.25rem 0.75rem', borderRadius: '9999px', border: '1px solid rgba(239,68,68,0.3)' }}>
                      +{check.score} risk
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <a href={`http://127.0.0.1:5000/static/${result.report_path}`} target="_blank" rel="noreferrer" style={{ color: '#93c5fd', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.05em' }}>
            📄 Download Full Report
          </a>
          
          <button onClick={onBack} className="phishing-skeuo-btn" style={{ width: 'auto', padding: '1rem 2rem' }}>
            🔄 <span>Check Another</span>
          </button>
        </div>
      </div>
    </div>
  );
}
