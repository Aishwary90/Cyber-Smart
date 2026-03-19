import React, { useState } from 'react';
import { AnalyzerHome } from './AnalyzerHome';
import { AnalyzerResults } from './AnalyzerResults';

export function PhishingContainer() {
  const [result, setResult] = useState(null);

  const handleScanComplete = (scanData) => {
    setResult(scanData);
  };

  const handleReset = () => {
    setResult(null);
  };

  if (result) {
    return <AnalyzerResults result={result} onBack={handleReset} />;
  }

  return <AnalyzerHome onScan={handleScanComplete} />;
}
