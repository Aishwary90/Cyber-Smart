const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const SESSION_STORAGE_KEY = "cybersmart.session";

class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getStoredSession() {
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

export function setStoredSession(session) {
  if (!session) {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredSession() {
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

function getAuthHeader() {
  const session = getStoredSession();
  if (!session?.access_token) {
    return {};
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  };
}

async function fetchApi(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;

  const config = {
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeader(),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new ApiError(data?.error || "API request failed", response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      "Unable to connect to server. Please check if the backend is running.",
      0,
      null,
    );
  }
}

export async function signUpAccount({ email, password, fullName }) {
  const response = await fetchApi("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, fullName }),
  });

  if (response.session) {
    setStoredSession(response.session);
  }

  return response;
}

export async function signInAccount({ email, password }) {
  const response = await fetchApi("/api/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (response.session) {
    setStoredSession(response.session);
  }

  return response;
}

export async function signOutAccount() {
  try {
    await fetchApi("/api/auth/signout", {
      method: "POST",
    });
  } finally {
    clearStoredSession();
  }
}

export async function refreshAuthSession(refreshToken) {
  const response = await fetchApi("/api/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  if (response.session) {
    setStoredSession(response.session);
  }

  return response;
}

export async function getCurrentUser() {
  return fetchApi("/api/auth/me", { method: "GET" });
}

export async function submitCaseFeedback(payload) {
  return fetchApi("/api/feedback", {
    method: "POST",
    body: JSON.stringify(payload || {}),
  });
}

export async function listCaseFeedback(limit = 100) {
  return fetchApi(`/api/feedback?limit=${encodeURIComponent(limit)}`, { method: "GET" });
}

export async function listCases() {
  return fetchApi("/api/cases", { method: "GET" });
}

export async function getCase(caseId) {
  return fetchApi(`/api/cases/${caseId}`, { method: "GET" });
}

export async function createCase(payload) {
  return fetchApi("/api/cases", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateCase(caseId, payload) {
  return fetchApi(`/api/cases/${caseId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteCase(caseId) {
  return fetchApi(`/api/cases/${caseId}`, {
    method: "DELETE",
  });
}

export async function classifyIncident(text) {
  return fetchApi("/api/classify", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export async function getNextQuestion(crimeId, step, userText = "", answer = "") {
  return fetchApi("/api/questions", {
    method: "POST",
    body: JSON.stringify({ crimeId, step, userText, answer }),
  });
}

export async function getVerdict(crimeId, userText = "", answers = {}, caseId = null) {
  return fetchApi("/api/verdict", {
    method: "POST",
    body: JSON.stringify({ crimeId, userText, answers, caseId }),
  });
}

export async function checkHealth() {
  return fetchApi("/health", { method: "GET" });
}

export function transformSuspects(backendData) {
  if (!backendData.suspected_crimes) {
    return [];
  }

  return backendData.suspected_crimes.map((crime) => ({
    label: crime.name,
    score: crime.score,
    id: crime.id,
    severity: crime.severity,
  }));
}

export function transformQuestion(backendQuestion) {
  if (!backendQuestion) {
    return null;
  }

  return {
    id: backendQuestion.question_id,
    prompt: backendQuestion.question,
    options: backendQuestion.options || [],
    priority: backendQuestion.priority,
    note: `Question ${backendQuestion.step + 1} of ${backendQuestion.total}`,
    rationale: "We ask this to confirm the incident pattern before giving a verdict.",
  };
}

export function transformVerdict(backendVerdict) {
  if (!backendVerdict || !backendVerdict.verdict) {
    return null;
  }

  const verdict = backendVerdict.verdict;
  const isCrime = verdict.verdict_type === "CONFIRMED_CYBERCRIME";

  const legalSections = [];
  if (verdict.legal_sections?.it_act) {
    verdict.legal_sections.it_act.forEach((section) => {
      const label = section?.title
        ? `IT Act ${section.section}: ${section.title}`
        : `IT Act ${section.section}`;
      legalSections.push(label);
    });
  }
  if (verdict.legal_sections?.ipc) {
    verdict.legal_sections.ipc.forEach((section) => {
      const label = section?.title ? `IPC ${section.section}: ${section.title}` : `IPC ${section.section}`;
      legalSections.push(label);
    });
  }

  return {
    kind: isCrime ? "confirmed_cybercrime" : "not_a_cybercrime",
    title: verdict.title,
    subtitle: verdict.subtitle,
    risk: verdict.risk,
    confidence: isCrime ? "High confidence after verification" : "Needs further review",
    explanation: Array.isArray(verdict.explanation)
      ? verdict.explanation.join(" ")
      : verdict.explanation,
    legalSections: legalSections.length ? legalSections : ["Consumer/civil route"],
    actionPlan: verdict.immediate_actions || verdict.your_options || [],
    evidence: (verdict.evidence_required || []).map((entry) => ({
      label: typeof entry === "string" ? entry : entry.label,
      priority: "High",
    })),
    studentNotes: verdict.why_not_crime || [
      isCrime
        ? "This case matches cybercrime patterns under IT Act and IPC."
        : "This case does not meet the legal definition of cybercrime.",
    ],
    destination: isCrime
      ? "cybercrime.gov.in and 1930 helpline"
      : "Consumer forum or platform support",
    confidenceDrivers: [],
  };
}

export default {
  checkHealth,
  classifyIncident,
  clearStoredSession,
  createCase,
  deleteCase,
  getCase,
  getCurrentUser,
  getNextQuestion,
  getStoredSession,
  getVerdict,
  listCases,
  setStoredSession,
  signInAccount,
  signOutAccount,
  signUpAccount,
  refreshAuthSession,
  transformQuestion,
  transformSuspects,
  transformVerdict,
  submitCaseFeedback,
  listCaseFeedback,
  updateCase,
};
