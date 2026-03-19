import { useEffect, useMemo, useRef, useState } from "react";
import { EvidenceChecklist } from "./EvidenceChecklist";
import { QuestionCard } from "./QuestionCard";
import { VerdictScreen } from "./VerdictScreen";

const flowSteps = ["Report", "Understand", "Verify", "Decide", "Act"];

function getFlowIndex(analysisStarted, answersCount, totalQuestions, verdictReady) {
  if (!analysisStarted) return 0;
  if (verdictReady) return 4;
  if (answersCount === 0) return 1;
  if (answersCount < totalQuestions) return 2;
  return 3;
}

/* ─── Small compact flow step tracker (top of card) ─── */
function FlowStrip({ activeIndex }) {
  return (
    <div className="claude-flow-strip">
      {flowSteps.map((step, index) => (
        <div
          key={step}
          className={`claude-flow-step ${index <= activeIndex ? "claude-flow-step-active" : ""}`}
        >
          <span className="claude-flow-dot" />
          <span>{step}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── System bubble (AI response style) ─── */
function AiBubble({ icon, label, children }) {
  return (
    <div className="claude-bubble">
      <div className="claude-bubble-avatar">{icon}</div>
      <div className="claude-bubble-body">
        {label && <span className="claude-bubble-label">{label}</span>}
        <div className="claude-bubble-content">{children}</div>
      </div>
    </div>
  );
}

/* ─── Welcome / empty state ─── */
function WelcomeState({ onQuickFill }) {
  const prompts = [
    "Money deducted automatically",
    "Sent money to someone I don't know",
    "Paid for product, never delivered",
    "Got a suspicious OTP link",
  ];

  return (
    <div className="claude-welcome">
      <div className="claude-welcome-icon">🛡️</div>
      <h2 className="claude-welcome-title">CyberSmart AI</h2>
      <p className="claude-welcome-sub">
        Describe your cybercrime or suspicious situation. I'll guide you step by step.
      </p>
      <div className="claude-quick-prompts">
        {prompts.map((p) => (
          <button
            key={p}
            className="claude-quick-btn"
            type="button"
            onClick={() => onQuickFill(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Incident submitted bubble ─── */
function IncidentBubble({ text }) {
  return (
    <div className="claude-user-bubble">
      <div className="claude-user-avatar">You</div>
      <p className="claude-user-text">{text}</p>
    </div>
  );
}

/* ─── Findings summary (compact) ─── */
function FindingsBubble({ scenario, confidence }) {
  return (
    <AiBubble icon="🔍" label="System Analysis">
      <div className="claude-findings-row">
        {scenario.suspects.slice(0, 2).map((s, i) => (
          <div key={s.label} className="claude-finding-chip">
            <span className="claude-chip-tag">{i === 0 ? "Primary" : "Secondary"}</span>
            <strong>{s.label}</strong>
          </div>
        ))}
      </div>
      <p className="claude-findings-note">Confidence: <strong>{confidence}%</strong></p>
    </AiBubble>
  );
}

/* ─── Answered question summary ─── */
function AnsweredBubble({ answeredQuestions, answers, onChangeAnswer }) {
  if (!answeredQuestions.length) return null;
  return (
    <div className="claude-answered-list">
      {answeredQuestions.map((q) => (
        <button
          key={q.id}
          className="claude-answered-item"
          type="button"
          onClick={() => onChangeAnswer(q.id)}
        >
          <span className="claude-answered-q">{q.prompt}</span>
          <span className="claude-answered-a">{answers[q.id]}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Feedback strip ─── */
function FeedbackBubble({ message }) {
  if (!message) return null;
  return (
    <AiBubble icon="✓" label="">
      <p style={{ margin: 0 }}>{message}</p>
    </AiBubble>
  );
}

/* ─── Bottom input bar (claude / chatgpt style) ─── */
function InputBar({ value, onChange, onSubmit }) {
  const ref = useRef(null);

  // Auto-grow textarea
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = "auto";
      ref.current.style.height = Math.min(ref.current.scrollHeight, 180) + "px";
    }
  }, [value]);

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSubmit();
    }
  }

  return (
    <div className="claude-input-bar">
      <div className="claude-input-shell">
        <textarea
          ref={ref}
          className="claude-input-textarea"
          placeholder="Describe your situation… (Enter to send, Shift+Enter for new line)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
        />
        <div className="claude-input-actions">
          <button
            className="claude-send-btn"
            type="button"
            onClick={onSubmit}
            disabled={!value.trim()}
            aria-label="Send"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5" />
              <polyline points="5 12 12 5 19 12" />
            </svg>
          </button>
        </div>
      </div>
      <p className="claude-input-hint">CyberSmart AI guides only · Not legal advice</p>
    </div>
  );
}

function getConfidenceSummary(submittedIncident, scenario) {
  const text = `${submittedIncident} ${scenario.verdict.confidenceDrivers?.join(" ") ?? ""}`.toLowerCase();
  const signals = ["link", "otp", "bank", "money", "seller", "delivery", "payment", "account"];
  const hits = signals.filter((s) => text.includes(s));
  return hits.length
    ? `Based on keywords like ${hits.slice(0, 3).join(", ")}.`
    : "Based on the report structure and verification answers.";
}

export function ChatWindow({
  scenario,
  submittedIncident,
  incidentDraft,
  onIncidentDraftChange,
  onSubmitIncident,
  analysisStarted,
  answers,
  activeQuestion,
  onAnswer,
  onChangeAnswer,
  onSkipQuestion,
  verdictReady,
  confidence,
  currentStep,
  statusLabel,
  flowState,
}) {
  const scrollRef = useRef(null);
  const answeredQuestions = scenario.questions.filter((q) => answers[q.id]);
  const lastAnswered = answeredQuestions[answeredQuestions.length - 1] ?? null;
  const recentFeedback =
    lastAnswered?.feedback?.[answers[lastAnswered.id]] ??
    (lastAnswered
      ? `This helps confirm ${scenario.suspects[0]?.label?.toLowerCase() ?? "the incident pattern"}.`
      : "");
  const confidenceSummary = useMemo(
    () => getConfidenceSummary(submittedIncident, scenario),
    [submittedIncident, scenario],
  );
  const flowIndex = getFlowIndex(analysisStarted, answeredQuestions.length, scenario.questions.length, verdictReady);

  // Auto scroll output to bottom when content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [analysisStarted, answeredQuestions.length, verdictReady, activeQuestion]);

  return (
    <section className="claude-workspace">
      {/* Compact top flow tracker */}
      <FlowStrip activeIndex={flowIndex} />

      {/* ── Big scrollable output area ── */}
      <div className="claude-output" ref={scrollRef}>
        {!analysisStarted ? (
          <WelcomeState onQuickFill={onIncidentDraftChange} />
        ) : (
          <>
            {/* User's incident text */}
            {submittedIncident && <IncidentBubble text={submittedIncident} />}

            {/* System findings */}
            <FindingsBubble scenario={scenario} confidence={confidence} />

            {/* Previously answered questions */}
            <AnsweredBubble
              answeredQuestions={answeredQuestions}
              answers={answers}
              onChangeAnswer={onChangeAnswer}
            />

            {/* Feedback on last answer */}
            <FeedbackBubble message={recentFeedback} />

            {/* Active question in stacked format */}
            {activeQuestion && (
              <AiBubble icon="❓" label="Verification Question">
                <QuestionCard
                  key={activeQuestion.id}
                  question={activeQuestion}
                  questionIndex={answeredQuestions.length}
                  totalQuestions={scenario.questions.length}
                  onAnswer={onAnswer}
                  onBack={() => {
                    if (answeredQuestions.length) {
                      onChangeAnswer(answeredQuestions[answeredQuestions.length - 1].id);
                    }
                  }}
                  onSkip={onSkipQuestion}
                  canGoBack={answeredQuestions.length > 0}
                />
              </AiBubble>
            )}

            {/* Final verdict */}
            {verdictReady && (
              <>
                <AiBubble icon="⚖️" label="Final Decision">
                  <p style={{ margin: 0 }}>Based on your answers, here's what we found.</p>
                </AiBubble>
                <VerdictScreen
                  scenario={scenario}
                  verdictReady={verdictReady}
                  confidence={confidence}
                  confidenceSummary={confidenceSummary}
                >
                  <EvidenceChecklist evidence={scenario.verdict.evidence} />
                </VerdictScreen>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Sticky bottom input bar ── */}
      <InputBar
        value={incidentDraft}
        onChange={onIncidentDraftChange}
        onSubmit={onSubmitIncident}
      />
    </section>
  );
}
