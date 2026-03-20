import { useEffect, useRef, useState } from "react";
import CyberSmartChat from "./components/CyberSmartChat";
import { LandingPage } from "./components/LandingPage";
import { PhishingContainer } from "./components/PhishingAnalyzer/PhishingContainer";
import { InsufficientDataScreen } from "./components/InsufficientDataScreen";
import { OutOfScopeScreen } from "./components/OutOfScopeScreen";
import { HelpPage, ProfilePage, SettingsPage } from "./components/WorkspacePages";
import { demoScenarios } from "./mockData";
import "./cyber-chat.css";
import {
  classifyIncident,
  clearStoredSession,
  createCase,
  deleteCase,
  getCase,
  getCurrentUser,
  getNextQuestion,
  getVerdict,
  getStoredSession,
  listCases,
  refreshAuthSession,
  signInAccount,
  signOutAccount,
  signUpAccount,
  transformQuestion,
  transformVerdict,
  updateCase,
} from "./api";

function getPrimaryConfidence(scenario, answersCount, verdictReady) {
  const base = Math.round((scenario.suspects[0]?.score ?? 0.78) * 100);

  if (verdictReady) {
    return Math.min(base + 10, 97);
  }

  return Math.min(base + answersCount * 5, 91);
}

function getStatusMeta(analysisStarted, answersCount, totalQuestions, verdictReady) {
  if (!analysisStarted) {
    return { flowState: "idle", currentStep: 1, statusLabel: "Ready to understand" };
  }

  if (verdictReady) {
    return { flowState: "verdict_ready", currentStep: 5, statusLabel: "Action ready" };
  }

  if (answersCount === 0) {
    return { flowState: "understanding", currentStep: 2, statusLabel: "Understanding" };
  }

  if (answersCount < totalQuestions) {
    return { flowState: "asking_questions", currentStep: 3, statusLabel: "Verifying" };
  }

  return { flowState: "deciding", currentStep: 4, statusLabel: "Deciding" };
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

function getFallbackVerdict(caseRecord, templateScenario) {
  if (caseRecord?.verdict) {
    return caseRecord.verdict;
  }

  if (templateScenario?.verdict) {
    return templateScenario.verdict;
  }

  const kind =
    caseRecord?.classification_type === "NOT_CRIME" ? "not_a_cybercrime" : "confirmed_cybercrime";

  return {
    kind,
    title: kind === "not_a_cybercrime" ? "Not a Clear Cybercrime" : "Cybercrime Likely",
    subtitle:
      caseRecord?.primary_crime_label ||
      (kind === "not_a_cybercrime" ? "Needs civil or consumer routing" : "Needs guided verification"),
    risk: kind === "not_a_cybercrime" ? "Medium" : "High",
    confidence: "Guidance based on saved case history",
    explanation:
      kind === "not_a_cybercrime"
        ? "This saved case currently aligns more with a payment, service, or consumer grievance route."
        : "This saved case still contains cybercrime indicators and should continue through verification.",
    legalSections: kind === "not_a_cybercrime" ? ["Consumer support route"] : ["IT Act review needed"],
    actionPlan:
      kind === "not_a_cybercrime"
        ? ["Review the saved case and continue through platform or grievance support."]
        : ["Resume verification and use the guided action plan before reporting."],
    evidence: [],
    studentNotes: [],
    destination:
      kind === "not_a_cybercrime" ? "Consumer forum or platform support" : "cybercrime.gov.in",
    confidenceDrivers: [],
  };
}

function getScenarioTemplate(caseRecord) {
  const fingerprint = [
    caseRecord?.primary_crime_label,
    caseRecord?.classification_type,
    caseRecord?.title,
    caseRecord?.incident_text,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/(phishing|upi|otp|bank|link fraud|credential)/.test(fingerprint)) {
    return demoScenarios.find((scenario) => scenario.id === "phishing-fraud") ?? demoScenarios[0];
  }

  if (/(marketplace|delivery|seller|consumer|civil|dispute)/.test(fingerprint)) {
    return (
      demoScenarios.find((scenario) => scenario.id === "marketplace-dispute") ?? demoScenarios[1]
    );
  }

  return demoScenarios[0];
}

function mapCaseToScenario(caseRecord) {
  const templateScenario = getScenarioTemplate(caseRecord);
  const confidence = typeof caseRecord?.confidence === "number" ? caseRecord.confidence : 48;
  const primaryLabel =
    caseRecord?.primary_crime_label ||
    templateScenario?.suspects?.[0]?.label ||
    "Case under review";
  const secondaryLabel =
    templateScenario?.suspects?.[1]?.label ||
    (caseRecord?.classification_type === "NOT_CRIME" ? "Consumer routing" : "Additional review");

  return {
    id: `saved-${caseRecord.id}`,
    label: caseRecord?.title || templateScenario?.label || "Saved Case",
    incident: caseRecord?.incident_text || templateScenario?.incident || "",
    timeWindow: formatRelativeTime(caseRecord?.updated_at || caseRecord?.created_at),
    urgency: templateScenario?.urgency || "Saved case restored from secure account history.",
    suspects: [
      {
        label: primaryLabel,
        score: Math.max(0.2, Math.min(confidence / 100, 0.97)),
      },
      {
        label: secondaryLabel,
        score: Math.max(0.18, Math.min((confidence - 12) / 100, 0.89)),
      },
    ],
    keyFacts: templateScenario?.keyFacts || [],
    questions: templateScenario?.questions || [],
    primaryCrimeId: caseRecord?.primary_crime_id || templateScenario?.primaryCrimeId || null,
    verdict: getFallbackVerdict(caseRecord, templateScenario),
    modelMeta: {
      source: caseRecord?.metadata?.modelSource || "rules_fallback",
      version: caseRecord?.metadata?.modelVersion || null,
    },
    persistedCaseId: caseRecord?.id,
  };
}

function buildChatHistoryEntries({ scenario, submittedIncident, answers, verdictReady }) {
  const history = [];
  const cleanedIncident = submittedIncident?.trim();
  const answeredQuestions = scenario?.questions?.filter((question) => answers?.[question.id]) ?? [];

  if (cleanedIncident) {
    history.push({
      role: "user",
      label: "You",
      text: cleanedIncident,
    });
  }

  if (scenario?.suspects?.length) {
    const summary = scenario.suspects
      .slice(0, 2)
      .map((suspect, index) => `${index === 0 ? "Primary" : "Secondary"}: ${suspect.label}`)
      .join(" • ");

    history.push({
      role: "assistant",
      label: "System Analysis",
      text: summary || "The system is reviewing your report.",
    });
  }

  answeredQuestions.forEach((question) => {
    history.push({
      role: "assistant",
      label: "Verification Question",
      text: question.prompt,
    });

    history.push({
      role: "user",
      label: "Your Answer",
      text: answers[question.id],
    });

    const feedback =
      question.feedback?.[answers[question.id]] ??
      `This helps confirm ${scenario?.suspects?.[0]?.label?.toLowerCase() ?? "the incident pattern"}.`;

    if (feedback) {
      history.push({
        role: "assistant",
        label: "System Note",
        text: feedback,
      });
    }
  });

  if (verdictReady && scenario?.verdict) {
    history.push({
      role: "assistant",
      label: "Final Decision",
      text: [scenario.verdict.title, scenario.verdict.subtitle, scenario.verdict.explanation]
        .filter(Boolean)
        .join(" - "),
    });
  }

  return history;
}

function buildCaseMetadata({
  scenario,
  submittedIncident,
  answers,
  verdictReady,
  apiMode,
  flowState,
  modelMeta,
}) {
  return {
    source: "frontend",
    apiMode,
    timeWindow: scenario?.timeWindow || null,
    flowState,
    modelSource: modelMeta?.source || null,
    modelVersion: modelMeta?.version || null,
    chatHistory: buildChatHistoryEntries({
      scenario,
      submittedIncident,
      answers,
      verdictReady,
    }),
  };
}

function HeaderStatus({ currentStep, statusLabel, verdictReady, scenario }) {
  const toneClass = verdictReady
    ? scenario.verdict.kind === "confirmed_cybercrime"
      ? "pulse-high-risk"
      : "pulse-confirmed"
    : "pulse-analyzing";

  return (
    <div className="header-status glass-pill">
      <div className="header-status-item">
        <span className="top-label">Step</span>
        <strong>{currentStep}/5</strong>
      </div>
      <div className="header-status-divider" />
      <div className="header-status-item">
        <span className="top-label">Status</span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className={`pulse-dot ${toneClass}`} />
          <strong>{statusLabel}</strong>
        </div>
      </div>
    </div>
  );
}

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

const userMenuItems = [
  {
    id: "profile",
    label: "Profile",
    description: "Account details, recent activity, and saved case overview.",
  },
  {
    id: "settings",
    label: "Settings",
    description: "Theme, layout, and fast workspace controls.",
  },
  {
    id: "help",
    label: "Help",
    description: "Flow guidance, urgent next steps, and product support.",
  },
];

function UserMenu({
  theme,
  setTheme,
  onLogout,
  onOpenPage,
  activePage,
  user,
  compact = false,
}) {
  const displayName = user?.fullName || "Aishwary";
  const displayEmail = user?.email || "@aishwary_99";

  return (
    <div className={compact ? "user-menu user-menu-compact" : "user-menu"}>
      <div className="user-menu-header">
        <div className="user-menu-avatar">{getUserInitials(user)}</div>
        <div>
          <strong>{displayName}</strong>
          <span>{displayEmail}</span>
        </div>
      </div>

      <div className="user-menu-divider" />

      <div className="user-menu-list">
        {userMenuItems.map((item) => (
          <button
            key={item.id}
            className={activePage === item.id ? "user-menu-link-active" : ""}
            type="button"
            onClick={() => onOpenPage(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>

      <div className="user-menu-divider" />

      <div className="user-theme-block">
        <span className="settings-subtitle">Theme</span>
        <div className="theme-switcher">
          <button
            className={theme === "light" ? "theme-button theme-button-active" : "theme-button"}
            type="button"
            onClick={() => setTheme("light")}
          >
            Light
          </button>
          <button
            className={theme === "dark" ? "theme-button theme-button-active" : "theme-button"}
            type="button"
            onClick={() => setTheme("dark")}
          >
            Dark
          </button>
        </div>
      </div>

      <div className="user-menu-divider" />

      <button className="user-menu-logout" type="button" onClick={onLogout}>
        Log out
      </button>
    </div>
  );
}

function AuthScreen({
  authMode,
  authForm,
  authError,
  currentUser,
  isSubmitting,
  onAuthModeChange,
  onAuthFormChange,
  onContinue,
}) {
  return (
    <div className="auth-screen">
      <div className="bg-blob blob-a" />
      <div className="bg-blob blob-b" />
      <div className="bg-blob blob-c" />

      <div className="auth-card">
        <div className="auth-split">
          <section className="auth-brand-panel">
            <span className="top-label">CyberSmart AI</span>
            <h1>Guided cyber diagnosis with calm, structured flow.</h1>
            <p>
              Sign in to continue into the investigation workspace, review case files, and
              track verified verdicts.
            </p>
          </section>

          <section className="auth-form-panel">
            <div className="auth-mode-switch">
              <button
                className={authMode === "signin" ? "auth-mode-active" : ""}
                type="button"
                onClick={() => onAuthModeChange("signin")}
              >
                Sign In
              </button>
              <button
                className={authMode === "signup" ? "auth-mode-active" : ""}
                type="button"
                onClick={() => onAuthModeChange("signup")}
              >
                Sign Up
              </button>
            </div>

            <div className="auth-panel-slider">
              <div
                className={
                  authMode === "signin"
                    ? "auth-slider-content"
                    : "auth-slider-content auth-slider-signup"
                }
              >
                <div className="auth-panel-copy">
                  <h2>{authMode === "signin" ? "Welcome back" : "Create your workspace"}</h2>
                  <p>
                    {authMode === "signin"
                      ? "Continue from recent cases and saved verdicts."
                      : "Set up a secure CyberSmart account for guided cyber diagnosis."}
                  </p>
                </div>

                {currentUser ? (
                  <div className="auth-session-banner">
                    <strong>Signed in as {currentUser.fullName || currentUser.email}</strong>
                    <span>You can continue directly into your workspace.</span>
                  </div>
                ) : null}

                <div className="auth-form">
                  <input
                    type="email"
                    placeholder="Email"
                    value={authForm.email}
                    onChange={(event) => onAuthFormChange("email", event.target.value)}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authForm.password}
                    onChange={(event) => onAuthFormChange("password", event.target.value)}
                  />
                  {authMode === "signup" ? (
                    <input
                      type="text"
                      placeholder="Full name"
                      value={authForm.fullName}
                      onChange={(event) => onAuthFormChange("fullName", event.target.value)}
                    />
                  ) : null}
                </div>

                {authError ? <p className="auth-error-text">{authError}</p> : null}

                <button
                  className="auth-primary-button"
                  type="button"
                  onClick={onContinue}
                  disabled={isSubmitting}
                >
                  {isSubmitting
                    ? "Please wait..."
                    : currentUser
                      ? "Continue to Workspace"
                      : authMode === "signin"
                        ? "Sign In"
                        : "Create Account"}
                </button>

                <div className="auth-divider">
                  <span>OR</span>
                </div>

                <button className="auth-google-button" type="button" disabled>
                  Google Login (Coming Soon)
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function getRiskTone(verdictKind, risk) {
  if (verdictKind === "not_a_cybercrime") {
    return "calm";
  }

  return risk?.toLowerCase() === "high" ? "high" : "normal";
}

function getChatPersistenceCopy(state, savedCount, errorMessage) {
  switch (state) {
    case "not_saving":
      return {
        tone: "warning",
        title: "Chat not saving",
        description: "Sign in first to save your chat history securely to your own account.",
      };
    case "saving":
      return {
        tone: "info",
        title: "Chat history saving",
        description: "Your latest report and answers are being synced now.",
      };
    case "saved":
      return {
        tone: "success",
        title: "Chat history saved",
        description: `${savedCount} saved ${savedCount === 1 ? "chat" : "chats"} available to review or delete.`,
      };
    case "error":
      return {
        tone: "danger",
        title: "Chat not saving",
        description: errorMessage || "The current chat could not be saved. Please try again.",
      };
    case "pending":
      return {
        tone: "info",
        title: "Chat not saving yet",
        description: "Send the first message of the case to start saving chat history.",
      };
    default:
      return {
        tone: "muted",
        title: "History ready",
        description: "Start a case to create saved chat history for this account.",
      };
  }
}

function getRenderableErrorMessage(error) {
  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    return error.message || error.error || "Something went wrong while updating the workspace.";
  }

  return "Something went wrong while updating the workspace.";
}

export default function App() {
  const initialScenario = demoScenarios[0];
  const topProfileRef = useRef(null);
  const [screen, setScreen] = useState("landing");
  const [authMode, setAuthMode] = useState("signin");
  const [theme, setTheme] = useState("light");
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [incidentDraft, setIncidentDraft] = useState("");
  const [submittedIncident, setSubmittedIncident] = useState("");
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [answers, setAnswers] = useState({});
  const [activeFeature, setActiveFeature] = useState("chat");
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [casePanelCollapsed, setCasePanelCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdvancingFlow, setIsAdvancingFlow] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [liveScenario, setLiveScenario] = useState(null);
  const [authForm, setAuthForm] = useState({ email: "", password: "", fullName: "" });
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentCaseId, setCurrentCaseId] = useState(null);
  const [savedCases, setSavedCases] = useState([]);
  const [isCasesLoading, setIsCasesLoading] = useState(false);
  const [isSyncingCase, setIsSyncingCase] = useState(false);
  const [chatSaveError, setChatSaveError] = useState("");
  const [insufficientData, setInsufficientData] = useState(null);
  const [outOfScope, setOutOfScope] = useState(null);
  const useLiveApi = true;

  const activeScenario =
    liveScenario ||
    (demoScenarios.find((scenario) => scenario.id === scenarioId) ?? demoScenarios[0]);
  const activeQuestion =
    activeScenario.questions.find((question) => !answers[question.id]) ?? null;
  const answersCount = Object.keys(answers).length;
  const verdictReady = analysisStarted && activeQuestion === null && answersCount > 0 && !isAdvancingFlow;
  const confidence = getPrimaryConfidence(activeScenario, answersCount, verdictReady);
  const statusMeta = getStatusMeta(
    analysisStarted,
    answersCount,
    activeScenario.questions.length,
    verdictReady,
  );
  const chatPersistenceState = !currentUser
    ? "not_saving"
    : chatSaveError
      ? "error"
      : isSyncingCase
        ? "saving"
        : currentCaseId
          ? "saved"
          : analysisStarted
            ? "pending"
            : "idle";
  const chatPersistenceCopy = getChatPersistenceCopy(
    chatPersistenceState,
    savedCases.length,
    chatSaveError,
  );

  function closeMenus() {
    setTopProfileOpen(false);
  }

  function openWorkspaceFeature(nextFeature) {
    setActiveFeature(nextFeature);
    closeMenus();
    setMobileSidebarOpen(false);
  }

  function openWorkspaceHome() {
    openWorkspaceFeature("chat");
  }

  const tools = [
    {
      label: "Law Explorer",
      action: openWorkspaceHome,
    },
    {
      label: "Guidance Notes",
      action: openWorkspaceHome,
    },
    {
      label: "URL Detector",
      action: () => openWorkspaceFeature("phishing"),
    },
  ];

  function handleAuthFormChange(field, value) {
    setAuthForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function loadScenario(nextScenarioId) {
    const nextScenario =
      demoScenarios.find((scenario) => scenario.id === nextScenarioId) ?? demoScenarios[0];

    setScenarioId(nextScenario.id);
    setIncidentDraft(nextScenario.incident);
    setSubmittedIncident(nextScenario.incident);
    setAnswers({});
    setAnalysisStarted(true);
    setActiveFeature("chat");
    setLiveScenario(null);
    setApiError(null);
    setCurrentCaseId(null);
    closeMenus();
    setMobileSidebarOpen(false);
  }

  async function loadSavedCase(caseId) {
    setApiError(null);
    setChatSaveError("");
    closeMenus();
    setMobileSidebarOpen(false);

    try {
      const response = await getCase(caseId);
      const caseRecord = response.case;
      const nextScenario = mapCaseToScenario(caseRecord);

      setScenarioId(nextScenario.id);
      setLiveScenario(nextScenario);
      setIncidentDraft(nextScenario.incident);
      setSubmittedIncident(nextScenario.incident);
      setAnswers(caseRecord.answers && typeof caseRecord.answers === "object" ? caseRecord.answers : {});
      setAnalysisStarted(Boolean(nextScenario.incident));
      setActiveFeature("chat");
      setCurrentCaseId(caseRecord.id);
    } catch (error) {
      setApiError(error.message || "Unable to load the selected case.");
    }
  }

  async function handleDeleteCase(caseId, event) {
    event?.stopPropagation?.();

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this case? This action cannot be undone."
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await deleteCase(caseId);

      setSavedCases((currentCases) => currentCases.filter((entry) => entry.id !== caseId));

      if (currentCaseId === caseId) {
        handleNewCase();
      }

      setApiError(null);
    } catch (error) {
      setApiError(error.message || "Unable to delete the case.");
    }
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!topProfileOpen) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (!topProfileRef.current?.contains(event.target)) {
        setTopProfileOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setTopProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [topProfileOpen]);

  useEffect(() => {
    async function restoreSession() {
      const session = getStoredSession();

      if (!session?.access_token) {
        return;
      }

      try {
        const response = await getCurrentUser();
        setCurrentUser(response.user);
        setScreen("workspace");
      } catch (_error) {
        if (session?.refresh_token) {
          try {
            const refreshResponse = await refreshAuthSession(session.refresh_token);
            if (refreshResponse?.session?.access_token) {
              const userResponse = await getCurrentUser();
              setCurrentUser(userResponse.user);
              setScreen("workspace");
              return;
            }
          } catch (_refreshError) {
            // Fall through to clear invalid local session
          }
        }

        clearStoredSession();
        setCurrentUser(null);
      }
    }

    restoreSession();
  }, []);

  useEffect(() => {
    document.body.style.overflow = screen === "workspace" ? "hidden" : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [screen]);

  useEffect(() => {
    async function loadUserCases() {
      if (!currentUser) {
        setSavedCases([]);
        return;
      }

      setIsCasesLoading(true);

      try {
        const response = await listCases();
        setSavedCases(response.cases || []);
      } catch (error) {
        console.warn("Case list warning:", error.message);
        setSavedCases([]);
      } finally {
        setIsCasesLoading(false);
      }
    }

    loadUserCases();
  }, [currentUser]);

  useEffect(() => {
    async function syncCurrentCase() {
      if (!currentUser || !currentCaseId || !analysisStarted) {
        return;
      }

      try {
        setIsSyncingCase(true);
        const response = await updateCase(currentCaseId, {
          title: activeScenario.label,
          incidentText: submittedIncident,
          status: verdictReady ? "act" : statusMeta.flowState,
          classificationType: activeScenario.verdict?.kind || null,
          primaryCrimeId: activeScenario.primaryCrimeId || null,
          primaryCrimeLabel: activeScenario.suspects?.[0]?.label || null,
          confidence,
          answers,
          verdict: verdictReady ? activeScenario.verdict : null,
          metadata: buildCaseMetadata({
            scenario: activeScenario,
            submittedIncident,
            answers,
            verdictReady,
            apiMode: useLiveApi,
            flowState: verdictReady ? "act" : statusMeta.flowState,
            modelMeta: activeScenario.modelMeta,
          }),
        });

        if (response.case) {
          setChatSaveError("");
          setSavedCases((currentCases) => [
            response.case,
            ...currentCases.filter((entry) => entry.id !== response.case.id),
          ]);
        }
      } catch (error) {
        console.warn("Case autosave warning:", error.message);
        setChatSaveError(error.message || "Chat history could not be saved.");
      } finally {
        setIsSyncingCase(false);
      }
    }

    syncCurrentCase();
  }, [
    activeScenario,
    analysisStarted,
    answers,
    confidence,
    currentCaseId,
    currentUser,
    statusMeta.flowState,
    submittedIncident,
    verdictReady,
  ]);

  function handleNewCase() {
    setIncidentDraft("");
    setSubmittedIncident("");
    setAnswers({});
    setAnalysisStarted(false);
    setActiveFeature("chat");
    setLiveScenario(null);
    setApiError(null);
    setChatSaveError("");
    setCurrentCaseId(null);
    setInsufficientData(null);
    setOutOfScope(null);
    closeMenus();
    setMobileSidebarOpen(false);
  }

  async function handleAuthContinue() {
    if (currentUser) {
      handleNewCase();
      setScreen("workspace");
      return;
    }

    setAuthError("");
    setIsAuthSubmitting(true);

    try {
      const response =
        authMode === "signin"
          ? await signInAccount({
              email: authForm.email,
              password: authForm.password,
            })
          : await signUpAccount({
              email: authForm.email,
              password: authForm.password,
              fullName: authForm.fullName,
            });

      if (response.user) {
        setCurrentUser({
          id: response.user.id,
          email: response.user.email,
          fullName: response.user.fullName || authForm.fullName,
        });
      }

      setAuthForm({ email: "", password: "", fullName: "" });

      if (response.needsEmailVerification) {
        setAuthError("Account created. Please verify your email before signing in.");
        setAuthMode("signin");
        return;
      }

      handleNewCase();
      setScreen("workspace");
    } catch (error) {
      setAuthError(error.message || "Unable to continue.");
    } finally {
      setIsAuthSubmitting(false);
    }
  }

  async function handleSubmitIncident() {
    const cleaned = incidentDraft.trim();

    if (!cleaned) {
      return;
    }

    setSubmittedIncident(cleaned);
    setAnswers({});
    setAnalysisStarted(true);
    setApiError(null);
    setChatSaveError("");
    setCurrentCaseId(null);

    let scenarioForHistory = {
      timeWindow: "Just now",
      suspects: [],
      questions: [],
      verdict: null,
      modelMeta: null,
    };

    let casePayload = {
      title: cleaned.slice(0, 60),
      incidentText: cleaned,
      status: "understand",
      classificationType: null,
      primaryCrimeId: null,
      primaryCrimeLabel: null,
      confidence: null,
      answers: {},
      metadata: {
        source: "frontend",
        apiMode: useLiveApi,
      },
    };

    if (useLiveApi) {
      setIsLoading(true);

      try {
        const response = await classifyIncident(cleaned);

        if (response.classification_type === "CRIME" && response.suspected_crimes?.length > 0) {
          const primaryCrime = response.suspected_crimes[0];
          const newScenario = {
            id: `live-${Date.now()}`,
            label: primaryCrime.name || "Live Case",
            incident: cleaned,
            timeWindow: "Just now",
            suspects: response.suspected_crimes.map((crime) => ({
              label: crime.name,
              score: crime.score,
            })),
            questions: response.first_question
              ? [transformQuestion(response.first_question)]
              : [],
            primaryCrimeId: primaryCrime.id,
            modelMeta: {
              source: response.model_source || "rules_fallback",
              version: response.model_version || null,
            },
            verdict: {
              kind: "confirmed_cybercrime",
              title: "Analysis in progress...",
              subtitle: primaryCrime.name,
              risk:
                primaryCrime.severity === "critical"
                  ? "Critical"
                  : primaryCrime.severity === "high"
                    ? "High"
                    : "Medium",
              confidence: `${Math.round(response.confidence || 50)}% confidence`,
              legalSections: [],
              actionPlan: [],
              evidence: [],
              studentNotes: [],
              destination: "cybercrime.gov.in",
            },
          };

          setLiveScenario(newScenario);
          scenarioForHistory = newScenario;
          casePayload = {
            ...casePayload,
            title: newScenario.label,
            classificationType: response.classification_type,
            primaryCrimeId: primaryCrime.id,
            primaryCrimeLabel: primaryCrime.name,
            confidence: Math.round(response.confidence || 50),
          };
        } else if (response.classification_type === "NOT_CRIME") {
          const notCrimeData = response.not_crime_data;
          const newScenario = {
            id: `live-${Date.now()}`,
            label: notCrimeData?.scenario_name || "Not a Cybercrime",
            incident: cleaned,
            timeWindow: "Just now",
            suspects: [{ label: "Not a cybercrime", score: 0.75 }],
            questions: [],
            modelMeta: {
              source: response.model_source || "rules_fallback",
              version: response.model_version || null,
            },
            verdict: {
              kind: "not_a_cybercrime",
              title: "Not a Cyber Crime",
              subtitle: notCrimeData?.scenario_name || "This is not a cybercrime",
              risk: "Low",
              confidence: "Based on pattern analysis",
              legalSections: ["Consumer/civil route"],
              actionPlan: ["Contact consumer forum", "Use platform support"],
              evidence: [],
              studentNotes: ["This case does not meet cybercrime criteria."],
              destination: "Platform support or consumer forum",
            },
          };

          setLiveScenario(newScenario);
          scenarioForHistory = newScenario;
          casePayload = {
            ...casePayload,
            title: newScenario.label,
            classificationType: response.classification_type,
            primaryCrimeLabel: newScenario.label,
            confidence: Math.round(response.confidence || 75),
            verdict: newScenario.verdict,
          };
        } else if (response.classification_type === "OUT_OF_SCOPE") {
          // Store out-of-scope info to display
          setOutOfScope(response.scope_error);
          setLiveScenario(null);
          scenarioForHistory = {
            ...scenarioForHistory,
            modelMeta: {
              source: response.model_source || "validation",
              version: response.model_version || null,
            },
            verdict: null,
          };
          casePayload = {
            ...casePayload,
            classificationType: "OUT_OF_SCOPE",
            status: "out_of_scope",
          };
        } else if (response.classification_type === "INSUFFICIENT_DATA") {
          // Store insufficient data info to display
          setInsufficientData(response.training_suggestion);
          setLiveScenario(null);
          scenarioForHistory = {
            ...scenarioForHistory,
            modelMeta: {
              source: response.model_source || "insufficient",
              version: response.model_version || null,
            },
            verdict: null,
          };
          casePayload = {
            ...casePayload,
            classificationType: "INSUFFICIENT_DATA",
            status: "needs_training",
          };
        } else {
          setLiveScenario(null);
        }
      } catch (error) {
        console.warn("API call failed, using demo mode:", error.message);
        setApiError(error.message);
        setLiveScenario(null);
      } finally {
        setIsLoading(false);
      }
    }

    casePayload.metadata = buildCaseMetadata({
      scenario: scenarioForHistory,
      submittedIncident: cleaned,
      answers: {},
      verdictReady: Boolean(casePayload.verdict),
      apiMode: useLiveApi,
      flowState: casePayload.status,
      modelMeta: scenarioForHistory.modelMeta,
    });

    if (currentUser) {
      try {
        setIsSyncingCase(true);
        const response = await createCase(casePayload);
        const nextCase = response.case || null;
        setCurrentCaseId(nextCase?.id || null);
        setChatSaveError("");

        if (nextCase) {
          setSavedCases((currentCases) => [
            nextCase,
            ...currentCases.filter((entry) => entry.id !== nextCase.id),
          ]);
        }
      } catch (error) {
        console.warn("Case creation warning:", error.message);
        setChatSaveError(error.message || "Chat history could not be saved.");
      } finally {
        setIsSyncingCase(false);
      }
    }
  }

  async function handleAnswer(questionId, answerValue) {
    const nextAnswers = {
      ...answers,
      [questionId]: answerValue,
    };
    setAnswers(nextAnswers);

    if (!useLiveApi || !liveScenario?.primaryCrimeId) {
      return;
    }

    const currentQuestionIndex = liveScenario.questions.findIndex((question) => question.id === questionId);
    if (currentQuestionIndex === -1) {
      return;
    }

    setApiError(null);
    setIsAdvancingFlow(true);

    try {
      const nextQuestionResponse = await getNextQuestion(
        liveScenario.primaryCrimeId,
        currentQuestionIndex + 1,
        submittedIncident,
        answerValue,
      );

      if (!nextQuestionResponse.done && nextQuestionResponse.question_id) {
        const nextQuestion = transformQuestion(nextQuestionResponse);
        setLiveScenario((currentScenario) => {
          if (!currentScenario) {
            return currentScenario;
          }

          const alreadyExists = currentScenario.questions.some(
            (question) => question.id === nextQuestion.id,
          );

          if (alreadyExists) {
            return currentScenario;
          }

          return {
            ...currentScenario,
            questions: [...currentScenario.questions, nextQuestion],
          };
        });
        return;
      }

      const verdictResponse = await getVerdict(
        liveScenario.primaryCrimeId,
        submittedIncident,
        nextAnswers,
        currentCaseId,
      );
      const mappedVerdict = transformVerdict(verdictResponse);

      if (mappedVerdict) {
        setLiveScenario((currentScenario) => {
          if (!currentScenario) {
            return currentScenario;
          }

          return {
            ...currentScenario,
            verdict: mappedVerdict,
          };
        });
      }
    } catch (error) {
      setApiError(error.message || "Unable to continue question flow.");
    } finally {
      setIsAdvancingFlow(false);
    }
  }

  function handleChangeAnswer(questionId) {
    const questionIndex = activeScenario.questions.findIndex(
      (question) => question.id === questionId,
    );

    if (questionIndex === -1) {
      return;
    }

    setAnswers((currentAnswers) => {
      const nextAnswers = {};

      activeScenario.questions.forEach((question, index) => {
        if (index < questionIndex && currentAnswers[question.id]) {
          nextAnswers[question.id] = currentAnswers[question.id];
        }
      });

      return nextAnswers;
    });
  }

  function handleSkipQuestion(questionId) {
    handleAnswer(questionId, "Skipped");
  }

  async function handleLogout() {
    try {
      await signOutAccount();
    } catch (_error) {
      // Local session is cleared in the API helper even if the request fails.
    }

    setCurrentUser(null);
    setCurrentCaseId(null);
    setSavedCases([]);
    setIsSyncingCase(false);
    setChatSaveError("");
    closeMenus();
    setScreen("landing");
  }

  const utilityFeature = activeFeature === "profile" || activeFeature === "settings" || activeFeature === "help";

  let workspaceContent = null;

  if (outOfScope && analysisStarted && activeFeature === "chat") {
    workspaceContent = <OutOfScopeScreen scopeError={outOfScope} />;
  } else if (insufficientData && analysisStarted && activeFeature === "chat") {
    workspaceContent = <InsufficientDataScreen trainingData={insufficientData} />;
  } else if (activeFeature === "phishing") {
    workspaceContent = <PhishingContainer />;
  } else if (activeFeature === "profile") {
    workspaceContent = (
      <ProfilePage
        user={currentUser}
        savedCases={savedCases}
        currentCaseId={currentCaseId}
        currentStatusLabel={statusMeta.statusLabel}
        chatPersistenceState={chatPersistenceState}
        theme={theme}
        onOpenCase={loadSavedCase}
        onDeleteCase={handleDeleteCase}
        onOpenSettings={() => openWorkspaceFeature("settings")}
        onOpenHelp={() => openWorkspaceFeature("help")}
        onReturnHome={openWorkspaceHome}
      />
    );
  } else if (activeFeature === "settings") {
    workspaceContent = (
      <SettingsPage
        theme={theme}
        casePanelCollapsed={casePanelCollapsed}
        user={currentUser}
        onSetTheme={setTheme}
        onSetCasePanelCollapsed={setCasePanelCollapsed}
        onOpenChat={openWorkspaceHome}
        onOpenPhishing={() => openWorkspaceFeature("phishing")}
        onOpenHelp={() => openWorkspaceFeature("help")}
        onLogout={handleLogout}
      />
    );
  } else if (activeFeature === "help") {
    workspaceContent = (
      <HelpPage
        onOpenChat={openWorkspaceHome}
        onOpenPhishing={() => openWorkspaceFeature("phishing")}
        onOpenProfile={() => openWorkspaceFeature("profile")}
        onStartFreshCase={handleNewCase}
      />
    );
  } else {
    workspaceContent = (
      <CyberSmartChat
        currentUser={currentUser}
        onNewCase={(caseId, incident) => {
          // Handle new case creation from conversational chat
          console.log("New case created:", caseId, incident);
          setAnalysisStarted(true);
          setSubmittedIncident(incident);
          setCurrentCaseId(caseId);
        }}
        onError={(error) => {
          setApiError(getRenderableErrorMessage(error));
        }}
      />
    );
  }

  if (screen === "landing") {
    return <LandingPage onStart={() => setScreen("auth")} />;
  }

  if (screen === "auth") {
    return (
      <AuthScreen
        authMode={authMode}
        authForm={authForm}
        authError={authError}
        currentUser={currentUser}
        isSubmitting={isAuthSubmitting}
        onAuthModeChange={setAuthMode}
        onAuthFormChange={handleAuthFormChange}
        onContinue={handleAuthContinue}
      />
    );
  }

  return (
    <div className="app-shell premium-shell">
      <div className="bg-blob blob-a" />
      <div className="bg-blob blob-b" />
      <div className="bg-blob blob-c" />
      <div className="bg-blob blob-d" />
      <div className="bg-grid" />

      <header className="top-bar floating-top-bar">
        <div className="brand-group">
          <div className="brand-mark">CS</div>
          <div>
            <p className="brand-eyebrow">Guided cyber diagnosis system</p>
            <h1>CyberSmart AI</h1>
          </div>
        </div>

        <div className="top-bar-actions">
          <button
            className="mobile-sidebar-toggle"
            type="button"
            onClick={() => setMobileSidebarOpen((open) => !open)}
            aria-label="Toggle case panel"
          >
            ☰
          </button>

          <HeaderStatus
            currentStep={statusMeta.currentStep}
            verdictReady={verdictReady}
            statusLabel={statusMeta.statusLabel}
            scenario={activeScenario}
          />

          <div className="top-profile-anchor" ref={topProfileRef}>
            <button
              className="top-profile-button"
              type="button"
              onClick={() => setTopProfileOpen((open) => !open)}
            >
              <span className="top-profile-avatar">{getUserInitials(currentUser)}</span>
            </button>

            {topProfileOpen ? (
              <UserMenu
                theme={theme}
                setTheme={setTheme}
                onLogout={handleLogout}
                onOpenPage={openWorkspaceFeature}
                activePage={utilityFeature ? activeFeature : ""}
                user={currentUser}
                compact
              />
            ) : null}
          </div>
        </div>
      </header>

      <div
        className={`app-frame depth-frame ${
          casePanelCollapsed ? "depth-frame-collapsed" : ""
        }`}
      >
        {mobileSidebarOpen ? (
          <button
            className="sidebar-backdrop"
            type="button"
            aria-label="Close case panel"
            onClick={() => setMobileSidebarOpen(false)}
          />
        ) : null}

        <aside
          className={`sidebar floating-sidebar case-panel ${
            casePanelCollapsed ? "case-panel-collapsed" : ""
          } ${mobileSidebarOpen ? "case-panel-mobile-open" : ""}`}
        >
          <div className="case-panel-header">
            <div className="case-panel-heading">
              <span className="sidebar-label">Case Panel</span>
              {!casePanelCollapsed ? <strong>Case Files</strong> : null}
            </div>
            <button
              className="case-panel-toggle"
              type="button"
              onClick={() => setCasePanelCollapsed((current) => !current)}
            >
              {casePanelCollapsed ? ">" : "<"}
            </button>
          </div>

          <button className="new-case-button skeuo-button" type="button" onClick={handleNewCase}>
            {casePanelCollapsed ? "+" : "+ New Case"}
          </button>

          <div className="case-panel-section">
            {!casePanelCollapsed ? (
              <span className="sidebar-label">{currentUser ? "Saved Cases" : "Case Files"}</span>
            ) : null}

            <div className="case-file-list">
              {currentUser && !casePanelCollapsed ? (
                <div
                  className={`case-file-empty case-history-status case-history-status-${chatPersistenceCopy.tone}`}
                >
                  <strong>{chatPersistenceCopy.title}</strong>
                  <span>{chatPersistenceCopy.description}</span>
                </div>
              ) : null}

              {currentUser ? (
                isCasesLoading ? (
                  <div className="case-file-empty">Loading your saved cases...</div>
                ) : savedCases.length ? (
                  savedCases.map((caseRecord) => {
                    const isActive = caseRecord.id === currentCaseId;
                    const verdictKind =
                      caseRecord.verdict?.kind ||
                      (caseRecord.classification_type === "NOT_CRIME"
                        ? "not_a_cybercrime"
                        : "confirmed_cybercrime");
                    const riskTone = caseRecord.verdict?.risk || "Medium";
                    const tone = getRiskTone(verdictKind, riskTone);
                    const savedStatus = (caseRecord.status || "saved").replace(/_/g, " ");

                    return (
                      <div key={caseRecord.id} className="case-file-item-wrapper">
                        <button
                          className={`case-file-item ${isActive ? "case-file-item-active" : ""}`}
                          type="button"
                          onClick={() => loadSavedCase(caseRecord.id)}
                          title={caseRecord.title}
                        >
                          <span className={`case-file-dot case-file-dot-${tone}`} />
                          {!casePanelCollapsed ? (
                            <div className="case-file-copy">
                              <strong>{caseRecord.title}</strong>
                              <div className="case-file-meta">
                                <span>
                                  {isActive
                                    ? "Active"
                                    : formatRelativeTime(caseRecord.updated_at || caseRecord.created_at)}
                                </span>
                                <span className="case-file-badge">{savedStatus}</span>
                              </div>
                            </div>
                          ) : null}
                        </button>
                        {!casePanelCollapsed ? (
                          <button
                            className="case-file-delete-btn"
                            type="button"
                            onClick={(e) => handleDeleteCase(caseRecord.id, e)}
                            title="Delete this case"
                            aria-label="Delete case"
                          >
                            🗑️
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                ) : null
              ) : (
                demoScenarios.map((scenario) => {
                  const isActive = scenario.id === scenarioId;
                  const tone = getRiskTone(scenario.verdict.kind, scenario.verdict.risk);

                  return (
                    <button
                      key={scenario.id}
                      className={`case-file-item ${isActive ? "case-file-item-active" : ""}`}
                      type="button"
                      onClick={() => loadScenario(scenario.id)}
                      title={scenario.label}
                    >
                      <span className={`case-file-dot case-file-dot-${tone}`} />
                      {!casePanelCollapsed ? (
                        <div className="case-file-copy">
                          <strong>{scenario.label}</strong>
                          <div className="case-file-meta">
                            <span>
                              {isActive
                                ? `Active - ${scenario.verdict.risk.toUpperCase()}`
                                : scenario.timeWindow}
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="case-panel-section case-tools">
            {!casePanelCollapsed ? <span className="sidebar-label">Tools</span> : null}
            <div className="case-tool-list">
              {tools.map((tool) => (
                <button
                  key={tool.label}
                  className={`case-tool-item ${
                    tool.label === "URL Detector" && activeFeature === "phishing"
                      ? "case-tool-item-active"
                      : ""
                  }`}
                  type="button"
                  onClick={tool.action}
                  title={tool.label}
                >
                  <span className="case-tool-bullet" />
                  {!casePanelCollapsed ? <span>{tool.label}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <main
          className={`main-workspace floating-workspace ${
            utilityFeature ? "main-workspace-utility" : ""
          }`}
        >
          {apiError ? <div className="case-file-empty workspace-inline-alert">{apiError}</div> : null}
          {isLoading ? (
            <div className="case-file-empty workspace-inline-alert">
              Analyzing your report securely...
            </div>
          ) : null}

          {workspaceContent}
        </main>
      </div>
    </div>
  );
}
