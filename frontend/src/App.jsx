import { useEffect, useMemo, useState } from "react";
import { ChatWindow } from "./components/ChatWindow";
import { LandingPage } from "./components/LandingPage";
import { PhishingContainer } from "./components/PhishingAnalyzer/PhishingContainer";
import { demoScenarios } from "./mockData";
import {
  classifyIncident,
  createCase,
  getCase,
  getCurrentUser,
  getStoredSession,
  listCases,
  signInAccount,
  signOutAccount,
  signUpAccount,
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
    persistedCaseId: caseRecord?.id,
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

function UserMenu({ theme, setTheme, onLogout, user, compact = false }) {
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
        <button type="button">Profile</button>
        <button type="button">Settings</button>
        <button type="button">Help</button>
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

export default function App() {
  const initialScenario = demoScenarios[0];
  const [screen, setScreen] = useState("landing");
  const [authMode, setAuthMode] = useState("signin");
  const [theme, setTheme] = useState("light");
  const [scenarioId, setScenarioId] = useState(initialScenario.id);
  const [incidentDraft, setIncidentDraft] = useState(initialScenario.incident);
  const [submittedIncident, setSubmittedIncident] = useState(initialScenario.incident);
  const [analysisStarted, setAnalysisStarted] = useState(true);
  const [answers, setAnswers] = useState({});
  const [activeFeature, setActiveFeature] = useState("chat");
  const [topProfileOpen, setTopProfileOpen] = useState(false);
  const [casePanelCollapsed, setCasePanelCollapsed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [liveScenario, setLiveScenario] = useState(null);
  const [authForm, setAuthForm] = useState({ email: "", password: "", fullName: "" });
  const [authError, setAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentCaseId, setCurrentCaseId] = useState(null);
  const [savedCases, setSavedCases] = useState([]);
  const [isCasesLoading, setIsCasesLoading] = useState(false);
  const useLiveApi = true;

  const activeScenario =
    liveScenario ||
    (demoScenarios.find((scenario) => scenario.id === scenarioId) ?? demoScenarios[0]);
  const activeQuestion =
    activeScenario.questions.find((question) => !answers[question.id]) ?? null;
  const answersCount = Object.keys(answers).length;
  const verdictReady = analysisStarted && activeQuestion === null && answersCount > 0;
  const confidence = getPrimaryConfidence(activeScenario, answersCount, verdictReady);
  const statusMeta = getStatusMeta(
    analysisStarted,
    answersCount,
    activeScenario.questions.length,
    verdictReady,
  );

  const tools = useMemo(
    () => [
      {
        label: "Law Explorer",
        action: () => {
          setActiveFeature("chat");
          setTopProfileOpen(false);
        },
      },
      {
        label: "Guidance Notes",
        action: () => {
          setActiveFeature("chat");
          setTopProfileOpen(false);
        },
      },
      {
        label: "URL Detector",
        action: () => {
          setActiveFeature("phishing");
          setTopProfileOpen(false);
        },
      },
    ],
    [],
  );

  function closeMenus() {
    setTopProfileOpen(false);
  }

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
  }

  async function loadSavedCase(caseId) {
    setApiError(null);
    closeMenus();

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

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    async function restoreSession() {
      const session = getStoredSession();

      if (!session?.access_token) {
        return;
      }

      try {
        const response = await getCurrentUser();
        setCurrentUser(response.user);
      } catch (_error) {
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
          metadata: {
            source: "frontend",
            timeWindow: activeScenario.timeWindow || null,
          },
        });

        if (response.case) {
          setSavedCases((currentCases) => [
            response.case,
            ...currentCases.filter((entry) => entry.id !== response.case.id),
          ]);
        }
      } catch (error) {
        console.warn("Case autosave warning:", error.message);
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
    setCurrentCaseId(null);
    closeMenus();
  }

  async function handleAuthContinue() {
    if (currentUser) {
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
    setCurrentCaseId(null);

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
              ? [
                  {
                    id: response.first_question.question_id,
                    prompt: response.first_question.question,
                    options: response.first_question.options,
                    note: `Step ${(response.first_question.step || 0) + 1} of ${
                      response.total_questions || 3
                    }`,
                    rationale: "We ask this to confirm the incident pattern.",
                  },
                ]
              : [],
            primaryCrimeId: primaryCrime.id,
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
          casePayload = {
            ...casePayload,
            title: newScenario.label,
            classificationType: response.classification_type,
            primaryCrimeLabel: newScenario.label,
            confidence: Math.round(response.confidence || 75),
            verdict: newScenario.verdict,
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

    if (currentUser) {
      try {
        const response = await createCase(casePayload);
        const nextCase = response.case || null;
        setCurrentCaseId(nextCase?.id || null);

        if (nextCase) {
          setSavedCases((currentCases) => [
            nextCase,
            ...currentCases.filter((entry) => entry.id !== nextCase.id),
          ]);
        }
      } catch (error) {
        console.warn("Case creation warning:", error.message);
      }
    }
  }

  function handleAnswer(questionId, answerValue) {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [questionId]: answerValue,
    }));
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
    closeMenus();
    setScreen("landing");
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
          <HeaderStatus
            currentStep={statusMeta.currentStep}
            verdictReady={verdictReady}
            statusLabel={statusMeta.statusLabel}
            scenario={activeScenario}
          />

          <div className="top-profile-anchor">
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
        <aside
          className={`sidebar floating-sidebar case-panel ${
            casePanelCollapsed ? "case-panel-collapsed" : ""
          }`}
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
                      <button
                        key={caseRecord.id}
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
                    );
                  })
                ) : (
                  <div className="case-file-empty">
                    Your account is ready. Start a case to save secure history here.
                  </div>
                )
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

        <main className="main-workspace floating-workspace">
          {apiError ? <div className="case-file-empty workspace-inline-alert">{apiError}</div> : null}
          {isLoading ? (
            <div className="case-file-empty workspace-inline-alert">
              Analyzing your report securely...
            </div>
          ) : null}

          {activeFeature === "phishing" ? (
            <PhishingContainer />
          ) : (
            <ChatWindow
              scenario={activeScenario}
              submittedIncident={submittedIncident}
              incidentDraft={incidentDraft}
              onIncidentDraftChange={setIncidentDraft}
              onSubmitIncident={handleSubmitIncident}
              analysisStarted={analysisStarted}
              answers={answers}
              activeQuestion={activeQuestion}
              onAnswer={handleAnswer}
              onChangeAnswer={handleChangeAnswer}
              onSkipQuestion={handleSkipQuestion}
              verdictReady={verdictReady}
              confidence={confidence}
              currentStep={statusMeta.currentStep}
              statusLabel={statusMeta.statusLabel}
              flowState={statusMeta.flowState}
            />
          )}
        </main>
      </div>
    </div>
  );
}
