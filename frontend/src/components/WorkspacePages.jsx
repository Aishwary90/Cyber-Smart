import { useEffect, useMemo, useState } from "react";

function getUserInitials(user) {
  const source = user?.fullName || user?.email || "A";
  const parts = source.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return "A";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatRelativeTime(dateValue) {
  if (!dateValue) {
    return "Recently updated";
  }

  const timestamp = new Date(dateValue).getTime();

  if (Number.isNaN(timestamp)) {
    return "Recently updated";
  }

  const elapsedMinutes = Math.max(1, Math.round((Date.now() - timestamp) / 60000));

  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  }

  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
  }

  const elapsedDays = Math.round(elapsedHours / 24);
  if (elapsedDays < 30) {
    return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
  }

  const elapsedMonths = Math.round(elapsedDays / 30);
  return `${elapsedMonths} month${elapsedMonths === 1 ? "" : "s"} ago`;
}

function WorkspacePageShell({ eyebrow, title, description, accent, actions, children }) {
  return (
    <section className="workspace-page-shell">
      <div className={`workspace-page-hero workspace-page-hero-${accent}`}>
        <div className="workspace-page-hero-copy">
          <span className="workspace-page-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {actions ? <div className="workspace-page-hero-actions">{actions}</div> : null}
      </div>

      <div className="workspace-page-scroll">{children}</div>
    </section>
  );
}

function StatCard({ label, value, helper }) {
  return (
    <article className="workspace-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </article>
  );
}

function CaseRow({ caseRecord, isActive, onOpenCase }) {
  return (
    <button
      className={`workspace-list-row ${isActive ? "workspace-list-row-active" : ""}`}
      type="button"
      onClick={() => onOpenCase(caseRecord.id)}
    >
      <div>
        <strong>{caseRecord.title}</strong>
        <span>{formatRelativeTime(caseRecord.updated_at || caseRecord.created_at)}</span>
      </div>
      <small>{(caseRecord.status || "saved").replace(/_/g, " ")}</small>
    </button>
  );
}

function getCaseChatHistory(caseRecord) {
  const storedHistory = Array.isArray(caseRecord?.metadata?.chatHistory)
    ? caseRecord.metadata.chatHistory.filter((entry) => entry?.text)
    : [];

  if (storedHistory.length) {
    return storedHistory;
  }

  const fallbackHistory = [];

  if (caseRecord?.incident_text) {
    fallbackHistory.push({
      role: "user",
      label: "You",
      text: caseRecord.incident_text,
    });
  }

  Object.entries(caseRecord?.answers || {}).forEach(([questionId, answer], index) => {
    fallbackHistory.push({
      role: "user",
      label: `Answer ${index + 1}`,
      text: `${questionId}: ${answer}`,
    });
  });

  if (caseRecord?.verdict?.title || caseRecord?.verdict?.explanation) {
    fallbackHistory.push({
      role: "assistant",
      label: "Final Decision",
      text: [caseRecord.verdict.title, caseRecord.verdict.explanation].filter(Boolean).join(" - "),
    });
  }

  return fallbackHistory;
}

function getChatStatusLabel(chatPersistenceState) {
  switch (chatPersistenceState) {
    case "saved":
      return "Chat history saving is enabled";
    case "saving":
      return "Chat history is syncing now";
    case "error":
      return "Chat history is not saving";
    case "not_saving":
      return "Chat history is not saving";
    default:
      return "Chat history will start after the first sent message";
  }
}

export function ProfilePage({
  user,
  savedCases,
  currentCaseId,
  currentStatusLabel,
  chatPersistenceState,
  theme,
  onOpenCase,
  onDeleteCase,
  onOpenSettings,
  onOpenHelp,
  onReturnHome,
}) {
  const [selectedHistoryId, setSelectedHistoryId] = useState(currentCaseId || savedCases[0]?.id || null);
  const totalCases = savedCases.length;
  const resolvedCases = savedCases.filter((caseRecord) => Boolean(caseRecord.verdict)).length;
  const highAttentionCases = savedCases.filter(
    (caseRecord) => caseRecord.classification_type !== "NOT_CRIME",
  ).length;
  const recentCases = savedCases.slice(0, 4);
  const selectedHistoryCase = useMemo(
    () => savedCases.find((caseRecord) => caseRecord.id === selectedHistoryId) || savedCases[0] || null,
    [savedCases, selectedHistoryId],
  );
  const selectedHistoryEntries = useMemo(
    () => (selectedHistoryCase ? getCaseChatHistory(selectedHistoryCase) : []),
    [selectedHistoryCase],
  );

  useEffect(() => {
    if (!savedCases.length) {
      setSelectedHistoryId(null);
      return;
    }

    if (currentCaseId && savedCases.some((caseRecord) => caseRecord.id === currentCaseId)) {
      setSelectedHistoryId(currentCaseId);
      return;
    }

    if (!savedCases.some((caseRecord) => caseRecord.id === selectedHistoryId)) {
      setSelectedHistoryId(savedCases[0].id);
    }
  }, [currentCaseId, savedCases, selectedHistoryId]);

  return (
    <WorkspacePageShell
      eyebrow="Profile"
      title={user?.fullName || "CyberSmart workspace"}
      description="Review your account snapshot, saved case activity, and the quickest ways back into the investigation flow."
      accent="profile"
      actions={
        <>
          <button className="workspace-page-button workspace-page-button-primary" type="button" onClick={onReturnHome}>
            Open workspace
          </button>
          <button className="workspace-page-button" type="button" onClick={onOpenSettings}>
            Settings
          </button>
        </>
      }
    >
      <section className="workspace-page-grid workspace-page-grid-two-up">
        <article className="workspace-panel workspace-profile-panel workspace-profile-identity">
          <div className="workspace-profile-head">
            <div className="workspace-profile-avatar">{getUserInitials(user)}</div>
            <div className="workspace-profile-copy">
              <span className="workspace-page-eyebrow">Account identity</span>
              <h3>{user?.fullName || "CyberSmart user"}</h3>
              <p>{user?.email || "No email connected"}</p>
            </div>
          </div>

          <div className="workspace-chip-row">
            <span className="workspace-chip">Theme: {theme}</span>
            <span className="workspace-chip">Current flow: {currentStatusLabel}</span>
            <span className="workspace-chip">{getChatStatusLabel(chatPersistenceState)}</span>
          </div>
        </article>

        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Case overview</span>
            <h3>How your workspace is being used</h3>
          </div>

          <div className="workspace-stat-grid">
            <StatCard
              label="Saved cases"
              value={totalCases}
              helper="Every started case can be restored here."
            />
            <StatCard
              label="Verdicts reached"
              value={resolvedCases}
              helper="Cases that already moved to decision or action."
            />
            <StatCard
              label="High attention"
              value={highAttentionCases}
              helper="Cases still leaning toward cybercrime handling."
            />
          </div>
        </article>
      </section>

      <section className="workspace-page-grid workspace-page-grid-two-up">
        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Recent activity</span>
            <h3>Open a case and continue where you left off</h3>
          </div>

          {recentCases.length ? (
            <div className="workspace-list">
              {recentCases.map((caseRecord) => (
                <CaseRow
                  key={caseRecord.id}
                  caseRecord={caseRecord}
                  isActive={caseRecord.id === currentCaseId}
                  onOpenCase={onOpenCase}
                />
              ))}
            </div>
          ) : (
            <div className="workspace-empty-card">
              <strong>No saved cases yet</strong>
              <p>Start a new investigation to build secure case history for this profile.</p>
              <button
                className="workspace-page-button workspace-page-button-primary"
                type="button"
                onClick={onReturnHome}
              >
                Start first case
              </button>
            </div>
          )}
        </article>

        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Support lane</span>
            <h3>Stay organized and safe</h3>
          </div>

          <div className="workspace-checklist">
            <div className="workspace-checklist-item">
              <strong>Keep one case per incident.</strong>
              <p>Separate reports make timelines, evidence, and next actions easier to track.</p>
            </div>
            <div className="workspace-checklist-item">
              <strong>Capture proof early.</strong>
              <p>Screenshots, payment IDs, chat logs, and links help the guided verdict become more useful.</p>
            </div>
            <div className="workspace-checklist-item">
              <strong>Use settings for workspace comfort.</strong>
              <p>Theme and layout controls are available without interrupting your current investigation.</p>
            </div>
          </div>

          <div className="workspace-action-row">
            <button className="workspace-page-button" type="button" onClick={onOpenHelp}>
              Open help center
            </button>
            <button className="workspace-page-button" type="button" onClick={onOpenSettings}>
              Review settings
            </button>
          </div>
        </article>
      </section>

      <section className="workspace-page-grid">
        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Chat history</span>
            <h3>Review your own saved chats and remove them when needed</h3>
          </div>

          {savedCases.length ? (
            <div className="workspace-history-layout">
              <div className="workspace-history-list">
                {savedCases.map((caseRecord) => (
                  <div
                    key={caseRecord.id}
                    className={`workspace-history-item ${
                      selectedHistoryCase?.id === caseRecord.id ? "workspace-history-item-active" : ""
                    }`}
                  >
                    <button
                      className="workspace-history-card"
                      type="button"
                      onClick={() => setSelectedHistoryId(caseRecord.id)}
                    >
                      <strong>{caseRecord.title}</strong>
                      <span>{formatRelativeTime(caseRecord.updated_at || caseRecord.created_at)}</span>
                    </button>

                    <div className="workspace-history-actions">
                      <button
                        className="workspace-icon-button"
                        type="button"
                        onClick={() => onOpenCase(caseRecord.id)}
                      >
                        Open
                      </button>
                      <button
                        className="workspace-icon-button workspace-icon-button-danger"
                        type="button"
                        onClick={() => onDeleteCase(caseRecord.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="workspace-history-preview">
                {selectedHistoryCase ? (
                  <>
                    <div className="workspace-history-preview-head">
                      <div>
                        <span className="workspace-page-eyebrow">Selected chat</span>
                        <h4>{selectedHistoryCase.title}</h4>
                        <p>{formatRelativeTime(selectedHistoryCase.updated_at || selectedHistoryCase.created_at)}</p>
                      </div>
                      <button
                        className="workspace-page-button workspace-page-button-primary"
                        type="button"
                        onClick={() => onOpenCase(selectedHistoryCase.id)}
                      >
                        Open in workspace
                      </button>
                    </div>

                    <div className="workspace-history-thread">
                      {selectedHistoryEntries.length ? (
                        selectedHistoryEntries.map((entry, index) => (
                          <div
                            key={`${selectedHistoryCase.id}-${index}`}
                            className={`workspace-history-message workspace-history-message-${entry.role === "user" ? "user" : "assistant"}`}
                          >
                            <span>{entry.label || (entry.role === "user" ? "You" : "Assistant")}</span>
                            <p>{entry.text}</p>
                          </div>
                        ))
                      ) : (
                        <div className="workspace-empty-card">
                          <strong>No message history available</strong>
                          <p>This saved case does not have transcript entries yet.</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="workspace-empty-card">
                    <strong>No chat selected</strong>
                    <p>Choose a saved case to review its transcript here.</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="workspace-empty-card">
              <strong>No saved chats yet</strong>
              <p>Your chat history will appear here after you send a report while signed in.</p>
            </div>
          )}
        </article>
      </section>
    </WorkspacePageShell>
  );
}

export function SettingsPage({
  theme,
  casePanelCollapsed,
  user,
  onSetTheme,
  onSetCasePanelCollapsed,
  onOpenChat,
  onOpenPhishing,
  onOpenHelp,
  onLogout,
}) {
  return (
    <WorkspacePageShell
      eyebrow="Settings"
      title="Workspace comfort and control"
      description="Tune the interface for faster review, cleaner focus, and easier switching between investigation tools."
      accent="settings"
      actions={
        <>
          <button className="workspace-page-button workspace-page-button-primary" type="button" onClick={onOpenChat}>
            Return to case
          </button>
          <button className="workspace-page-button" type="button" onClick={onOpenHelp}>
            Help
          </button>
        </>
      }
    >
      <section className="workspace-page-grid workspace-page-grid-two-up">
        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Appearance</span>
            <h3>Pick the view that feels most readable</h3>
          </div>

          <div className="workspace-choice-grid">
            <button
              className={`workspace-choice-card ${theme === "light" ? "workspace-choice-card-active" : ""}`}
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => onSetTheme("light")}
            >
              <strong>Light mode</strong>
              <span>Bright surface contrast for daytime review and demos.</span>
            </button>
            <button
              className={`workspace-choice-card ${theme === "dark" ? "workspace-choice-card-active" : ""}`}
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => onSetTheme("dark")}
            >
              <strong>Dark mode</strong>
              <span>Lower glare for long sessions and lower-light work.</span>
            </button>
          </div>
        </article>

        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Layout</span>
            <h3>Adjust how much room the case panel takes</h3>
          </div>

          <div className="workspace-setting-card">
            <div>
              <strong>Case panel</strong>
              <p>
                {casePanelCollapsed
                  ? "The sidebar is collapsed for more workspace width."
                  : "The sidebar stays expanded so saved cases and tools remain visible."}
              </p>
            </div>
            <button
              className="workspace-page-button workspace-page-button-primary"
              type="button"
              onClick={() => onSetCasePanelCollapsed(!casePanelCollapsed)}
            >
              {casePanelCollapsed ? "Expand panel" : "Collapse panel"}
            </button>
          </div>

          <div className="workspace-chip-row">
            <span className="workspace-chip">Signed in as {user?.email || "active user"}</span>
            <span className="workspace-chip">Theme sync is live</span>
          </div>
        </article>
      </section>

      <section className="workspace-page-grid workspace-page-grid-two-up">
        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Shortcuts</span>
            <h3>Jump to the right tool quickly</h3>
          </div>

          <div className="workspace-action-stack">
            <button className="workspace-list-row" type="button" onClick={onOpenChat}>
              <div>
                <strong>Investigation workspace</strong>
                <span>Continue incident intake, verification questions, and verdict review.</span>
              </div>
              <small>Open</small>
            </button>
            <button className="workspace-list-row" type="button" onClick={onOpenPhishing}>
              <div>
                <strong>URL detector</strong>
                <span>Scan suspicious links without losing your current case context.</span>
              </div>
              <small>Open</small>
            </button>
            <button className="workspace-list-row" type="button" onClick={onOpenHelp}>
              <div>
                <strong>Help center</strong>
                <span>Review guidance, flow explanations, and urgent next steps.</span>
              </div>
              <small>Open</small>
            </button>
          </div>
        </article>

        <article className="workspace-panel workspace-panel-danger">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Session</span>
            <h3>Account and access</h3>
          </div>

          <p className="workspace-panel-text">
            Use sign out when you are on a shared machine or after reviewing sensitive case information.
          </p>

          <div className="workspace-action-row">
            <button className="workspace-page-button workspace-page-button-danger" type="button" onClick={onLogout}>
              Log out
            </button>
          </div>
        </article>
      </section>
    </WorkspacePageShell>
  );
}

export function HelpPage({ onOpenChat, onOpenPhishing, onOpenProfile, onStartFreshCase }) {
  const flowSteps = [
    {
      label: "Report",
      detail: "Describe what happened in plain language. The system uses your words to detect likely patterns.",
    },
    {
      label: "Understand",
      detail: "CyberSmart identifies the strongest case direction and highlights the main signals behind it.",
    },
    {
      label: "Verify",
      detail: "You answer follow-up questions so the final guidance is grounded in details, not guesses.",
    },
    {
      label: "Decide",
      detail: "The workspace determines whether the incident points to cybercrime or another support route.",
    },
    {
      label: "Act",
      detail: "You get practical next steps, evidence guidance, and reporting directions for the chosen route.",
    },
  ];

  const faqs = [
    {
      question: "What should I type into the report box?",
      answer: "Start with what happened, when it happened, how money or access was affected, and any links or accounts involved.",
    },
    {
      question: "When should I use the URL detector?",
      answer: "Use it anytime a message, email, or website looks suspicious and you want a quick safety check before opening or sharing anything.",
    },
    {
      question: "Why do some incidents route away from cybercrime?",
      answer: "The system distinguishes between cybercrime indicators and civil, consumer, or platform-support issues to keep advice realistic.",
    },
  ];

  return (
    <WorkspacePageShell
      eyebrow="Help"
      title="Guidance center for calmer decisions"
      description="Use this page to understand the product flow, choose the right tool faster, and remember the first actions that matter after an incident."
      accent="help"
      actions={
        <>
          <button className="workspace-page-button workspace-page-button-primary" type="button" onClick={onOpenChat}>
            Back to workspace
          </button>
          <button className="workspace-page-button" type="button" onClick={onOpenProfile}>
            Profile
          </button>
        </>
      }
    >
      <section className="workspace-page-grid workspace-page-grid-three-up">
        {flowSteps.map((step, index) => (
          <article key={step.label} className="workspace-panel workspace-flow-card">
            <span className="workspace-flow-index">0{index + 1}</span>
            <h3>{step.label}</h3>
            <p>{step.detail}</p>
          </article>
        ))}
      </section>

      <section className="workspace-page-grid workspace-page-grid-two-up">
        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Quick answers</span>
            <h3>Questions users usually ask first</h3>
          </div>

          <div className="workspace-faq-list">
            {faqs.map((item) => (
              <div key={item.question} className="workspace-faq-item">
                <strong>{item.question}</strong>
                <p>{item.answer}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="workspace-panel workspace-panel-urgent">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">If the situation is urgent</span>
            <h3>Use official reporting channels quickly</h3>
          </div>

          <div className="workspace-checklist">
            <div className="workspace-checklist-item">
              <strong>Preserve the evidence.</strong>
              <p>Keep screenshots, payment references, phone numbers, account names, and chat history before anything disappears.</p>
            </div>
            <div className="workspace-checklist-item">
              <strong>Use the official cybercrime route.</strong>
              <p>For India-focused guidance in this app, the main reporting path already referenced across the project is cybercrime.gov.in and the 1930 helpline.</p>
            </div>
            <div className="workspace-checklist-item">
              <strong>Return here to organize the case.</strong>
              <p>The workspace helps turn raw details into a clearer action plan and evidence checklist.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="workspace-page-grid workspace-page-grid-two-up">
        <article className="workspace-panel">
          <div className="workspace-panel-heading">
            <span className="workspace-page-eyebrow">Next move</span>
            <h3>Pick the tool that matches your situation</h3>
          </div>

          <div className="workspace-action-stack">
            <button className="workspace-list-row" type="button" onClick={onStartFreshCase}>
              <div>
                <strong>Start a fresh case</strong>
                <span>Open a clean investigation workspace and begin a new report.</span>
              </div>
              <small>Start</small>
            </button>
            <button className="workspace-list-row" type="button" onClick={onOpenPhishing}>
              <div>
                <strong>Scan a suspicious URL</strong>
                <span>Use the phishing analyzer when the incident centers on a link, domain, or fake website.</span>
              </div>
              <small>Scan</small>
            </button>
            <button className="workspace-list-row" type="button" onClick={onOpenChat}>
              <div>
                <strong>Continue current case</strong>
                <span>Return to the guided question flow and keep the current investigation moving.</span>
              </div>
              <small>Open</small>
            </button>
          </div>
        </article>
      </section>
    </WorkspacePageShell>
  );
}
