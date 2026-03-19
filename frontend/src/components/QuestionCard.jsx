import { useEffect, useState } from "react";

export function QuestionCard({
  question,
  questionIndex,
  totalQuestions,
  onAnswer,
  onBack,
  onSkip,
  canGoBack,
}) {
  const [otherValue, setOtherValue] = useState("");
  const [showOther, setShowOther] = useState(false);
  const optionList = Array.isArray(question.options) && question.options.length
    ? question.options
    : ["Yes", "No", "Not sure"];

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      const numericKey = Number(event.key);
      if (!Number.isInteger(numericKey) || numericKey < 1 || numericKey > optionList.length) {
        return;
      }

      const selectedOption = optionList[numericKey - 1];
      if (selectedOption) {
        onAnswer(question.id, selectedOption);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onAnswer, optionList, question.id]);

  return (
    <section className="stacked-question-card">
      <div className="stacked-question-header">
        <h3 className="stacked-question-prompt">
          {question.prompt}
        </h3>
        <button className="icon-copy-btn" type="button" aria-label="Copy question" title="Copy question">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
        </button>
      </div>

      <div className="stacked-options-list">
        {optionList.map((option) => (
          <button
            key={option}
            className="stacked-btn"
            type="button"
            onClick={() => onAnswer(question.id, option)}
          >
            [ {option} ]
          </button>
        ))}

        {!showOther ? (
          <button className="stacked-btn" type="button" onClick={() => setShowOther(true)}>
            [ Something else ]
          </button>
        ) : (
          <div className="stacked-other-input-row" style={{ display: 'flex', alignItems: 'center' }}>
            <span className="stacked-bracket">[</span>
            <input 
              autoFocus
              className="stacked-inline-input"
              value={otherValue} 
              onChange={e => setOtherValue(e.target.value)} 
              placeholder="Specify detail..." 
              onKeyDown={(e) => {
                if (e.key === 'Enter' && otherValue.trim()) {
                  onAnswer(question.id, otherValue.trim());
                }
              }}
            />
            <button 
              className="stacked-inline-submit"
              type="button"
              onClick={() => { if(otherValue.trim()) onAnswer(question.id, otherValue.trim()) }}
            >
              Use
            </button>
            <span className="stacked-bracket">]</span>
          </div>
        )}

        <button className="stacked-btn next-btn" type="button" onClick={() => onSkip(question.id)}>
          [ Next ]
        </button>
      </div>
    </section>
  );
}
