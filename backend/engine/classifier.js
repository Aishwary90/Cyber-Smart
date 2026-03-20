const { preprocess, countKeywordHits } = require("./tfidf");
const { predictWithModel } = require("./mlModel");
const {
  getCatalogMeta,
  getCrimeCategories,
  getNotCrimeCategories,
  getCategoryById,
  isCrimeId,
  isNotCrimeId,
} = require("./incidentCatalog");

const SEVERITY_WEIGHT = { critical: 1.4, high: 1.2, medium: 1.0, low: 0.8, none: 0.45 };
const CRIME_ENTRIES = getCrimeCategories();
const NOT_CRIME_ENTRIES = getNotCrimeCategories();

const STRONG_CYBER_KEYWORDS = [
  "fraud",
  "scam",
  "phishing",
  "otp",
  "password",
  "login",
  "account",
  "unauthorized",
  "hacked",
  "hack",
  "compromised",
  "breach",
  "leak",
  "malware",
  "virus",
  "ransomware",
  "sextortion",
  "blackmail",
  "email",
  "message",
  "sms",
  "gmail",
  "instagram",
  "facebook",
  "whatsapp",
  "telegram",
  "upi",
  "gpay",
  "phonepe",
  "paytm",
  "bank",
  "transaction",
  "payment",
  "deducted",
  "debit",
  "withdrawn",
  "stolen",
  "money",
  "credit card",
  "debit card",
  "cvv",
  "pin",
  "kyc",
  "website",
  "link",
  "url",
  "identity",
  "impersonation",
  "suspicious",
];

const CONTEXTUAL_DOMAIN_KEYWORDS = [
  "online",
  "internet",
  "app",
  "device",
  "phone",
  "computer",
  "laptop",
  "data",
  "call",
  "remote",
  "digital",
];

const OUT_OF_SCOPE_KEYWORDS = [
  "love",
  "relationship",
  "dating",
  "marriage",
  "health",
  "doctor",
  "disease",
  "weather",
  "sports",
  "movie",
  "music",
  "game",
  "cooking",
  "recipe",
  "travel",
  "homework",
  "assignment",
  "math",
  "science",
  "history",
  "general knowledge",
];

const PHYSICAL_THEFT_PATTERNS = [
  /\b(laptop|phone|mobile|computer|tablet|device|wallet|bag|bike|car)\b.{0,40}\b(stolen|snatched|lost|missing|robbed|theft)\b/i,
  /\b(stolen|snatched|lost|missing|robbed|theft)\b.{0,40}\b(laptop|phone|mobile|computer|tablet|device|wallet|bag|bike|car)\b/i,
];

const CYBER_AFTER_THEFT_PATTERNS = [
  /\b(account|email|gmail|outlook|instagram|facebook|whatsapp|password|login|otp|bank|upi|data|messages|photos|compromised|hacked|unauthorized|reset)\b/i,
];

const FINANCIAL_HARM_PATTERNS = [
  /\b(money|amount|cash|balance|funds)\b.{0,25}\b(stolen|gone|taken|lost|deducted|debited|withdrawn|transferred)\b/i,
  /\b(stolen|gone|taken|lost|deducted|debited|withdrawn|transferred)\b.{0,25}\b(money|amount|cash|balance|funds)\b/i,
  /\b(bank|account|upi|wallet|card)\b.{0,30}\b(stolen|gone|taken|lost|deducted|debited|withdrawn|transferred)\b/i,
];

const SUSPICIOUS_CONTACT_PATTERNS = [
  /\b(suspicious|fake|fraud|scam)\b.{0,20}\b(email|sms|message|link|website|call)\b/i,
  /\b(email|sms|message|link|website|call)\b.{0,20}\b(suspicious|fake|fraud|scam)\b/i,
  /\b(phishing|smishing|vishing)\b/i,
];

const ACCOUNT_COMPROMISE_PATTERNS = [
  /\b(account|email|gmail|outlook|instagram|facebook|whatsapp|telegram|profile)\b.{0,30}\b(hacked|accessed|logged in|taken over|compromised|unauthorized|reset)\b/i,
  /\b(hacked|accessed|logged in|taken over|compromised|unauthorized|reset)\b.{0,30}\b(account|email|gmail|outlook|instagram|facebook|whatsapp|telegram|profile)\b/i,
];

const DIRECT_NOT_CRIME_PATTERNS = [
  {
    id: "NAC005_bad_customer_service",
    patterns: [
      /\b(product|item|order|parcel|package)\b.*\b(not delivered|never arrived|not received|missing)\b/i,
      /\b(delayed delivery|late delivery|refund pending|seller not responding|wrong product|damaged product)\b/i,
      /\b(customer service|platform support|delivery issue|order issue)\b/i,
    ],
  },
  {
    id: "NAC003_wrong_transfer_by_mistake",
    patterns: [
      /\b(wrong transfer|sent money by mistake|accidentally sent money|galti se transfer|mistaken transfer)\b/i,
    ],
  },
  {
    id: "NAC002_account_frozen_by_platform",
    patterns: [
      /\b(account frozen|account suspended|platform blocked my account|tos violation|terms violation)\b/i,
    ],
  },
  {
    id: "NAC001_gambling_loss",
    patterns: [/\b(dream11|rummy|betting|gambling|casino app|fantasy league)\b/i],
  },
];

function countPhraseMatches(text, phrases) {
  const lowerText = text.toLowerCase();
  const tokens = preprocess(lowerText);

  return phrases.filter((phrase) => {
    const normalized = String(phrase || "").toLowerCase();
    return normalized && (lowerText.includes(normalized) || tokens.includes(normalized));
  }).length;
}

function matchesAnyPattern(text, patterns) {
  return patterns.some((pattern) => pattern.test(text));
}

function detectPhysicalTheftOnly(text) {
  return (
    matchesAnyPattern(text, PHYSICAL_THEFT_PATTERNS) &&
    !matchesAnyPattern(text, CYBER_AFTER_THEFT_PATTERNS)
  );
}

function detectDirectNotCrimePattern(text) {
  const match = DIRECT_NOT_CRIME_PATTERNS.find((entry) => matchesAnyPattern(text, entry.patterns));
  if (!match) {
    return null;
  }

  return {
    id: match.id,
    category: getCategoryById(match.id),
  };
}

function isDomainRelevant(text) {
  if (!text || text.length < 4) {
    return false;
  }

  const lowerText = text.toLowerCase();
  const strongMatches = countPhraseMatches(lowerText, STRONG_CYBER_KEYWORDS);
  const contextualMatches = countPhraseMatches(lowerText, CONTEXTUAL_DOMAIN_KEYWORDS);

  if (detectPhysicalTheftOnly(lowerText)) {
    return false;
  }

  if (detectDirectNotCrimePattern(lowerText)) {
    return true;
  }

  if (
    matchesAnyPattern(lowerText, FINANCIAL_HARM_PATTERNS) ||
    matchesAnyPattern(lowerText, SUSPICIOUS_CONTACT_PATTERNS) ||
    matchesAnyPattern(lowerText, ACCOUNT_COMPROMISE_PATTERNS)
  ) {
    return true;
  }

  const outOfScopeMatches = OUT_OF_SCOPE_KEYWORDS.filter((keyword) => lowerText.includes(keyword))
    .length;
  if (outOfScopeMatches > 0 && strongMatches === 0) {
    return false;
  }

  if (strongMatches > 0) {
    return true;
  }

  return contextualMatches >= 2;
}

function scoreCategory(text, tokens, entry) {
  const keywords = entry.keywords || [];
  const identifiers = entry.primary_identifiers || [];
  const searchTerms = [...keywords, ...identifiers];
  const { count } = countKeywordHits(tokens, searchTerms);
  const phraseMatches = countPhraseMatches(text, searchTerms);
  const identifierMatches = countPhraseMatches(text, identifiers);
  const weight = SEVERITY_WEIGHT[entry.severity] ?? 1.0;

  const rawScore = phraseMatches * 1.8 + count * 0.9 + identifierMatches * 1.5;
  if (rawScore <= 0) {
    return 0;
  }

  return Math.min(0.99, (rawScore / Math.max(searchTerms.length * 0.32, 4)) * weight);
}

function buildOutOfScopeResponse(text) {
  const physicalTheftOnly = detectPhysicalTheftOnly(text);

  return {
    classification_type: "OUT_OF_SCOPE",
    suspected_crimes: [],
    top_crime_id: null,
    confidence: 0,
    first_question: null,
    total_questions: 0,
    not_crime_data: null,
    model_source: "validation",
    model_version: null,
    note: physicalTheftOnly
      ? "This appears to be a physical theft or non-digital incident without a clear cyber element."
      : "This model is for cyber-related queries. Please provide a cyber incident or a digital consumer/platform scenario.",
    scope_error: {
      message: physicalTheftOnly ? "Physical theft detected" : "Out of scope query detected",
      expected:
        "Cybercrime-related incidents such as fraud, phishing, account compromise, online blackmail, or digital consumer/platform disputes.",
      guidance: physicalTheftOnly
        ? "If the stolen device led to account misuse, suspicious logins, data theft, or financial fraud, mention that explicitly."
        : "Describe what happened online, what account or payment method was involved, and whether there was unauthorized access, money loss, or a suspicious message or link.",
    },
  };
}

function buildFirstQuestion(categoryId) {
  const category = getCategoryById(categoryId);
  const questions = category?.questions || [];

  if (questions.length === 0) {
    return { firstQuestion: null, totalQuestions: 0 };
  }

  const question = questions[0];
  return {
    firstQuestion: {
      question_id: question.question_id,
      question: question.question,
      options: question.options || [],
      priority: question.priority || "normal",
      step: 0,
      total: questions.length,
    },
    totalQuestions: questions.length,
  };
}

function classifyIncident(text) {
  if (!text || typeof text !== "string" || text.trim().length < 3) {
    return {
      classification_type: "UNCLEAR",
      suspected_crimes: [],
      top_crime_id: null,
      confidence: 0,
      first_question: null,
      total_questions: 0,
      not_crime_data: null,
      model_source: "validation",
      model_version: null,
      note: "Incident text too short or missing.",
    };
  }

  const inputText = text.trim();
  if (!isDomainRelevant(inputText)) {
    return buildOutOfScopeResponse(inputText);
  }

  const directNotCrime = detectDirectNotCrimePattern(inputText.toLowerCase());
  if (directNotCrime) {
    return {
      classification_type: "NOT_CRIME",
      suspected_crimes: [],
      top_crime_id: null,
      top_not_crime_id: directNotCrime.id,
      confidence: 82,
      first_question: null,
      total_questions: 0,
      not_crime_data: directNotCrime.category?.not_crime_data || null,
      model_source: "rules",
      model_version: null,
      note: "Matched a known non-cyber consumer/platform scenario.",
    };
  }

  const tokens = preprocess(inputText);
  const crimeSuspects = CRIME_ENTRIES.map((entry) => ({
    id: entry.id,
    name: entry.title,
    score: Math.round(scoreCategory(inputText.toLowerCase(), tokens, entry) * 100) / 100,
    severity: entry.severity,
  })).filter((suspect) => suspect.score > 0);

  const notCrimeSuspects = NOT_CRIME_ENTRIES.map((entry) => ({
    id: entry.id,
    name: entry.title,
    score: Math.round(scoreCategory(inputText.toLowerCase(), tokens, entry) * 100) / 100,
    severity: "none",
    is_not_crime: true,
    data: entry.not_crime_data || entry,
  })).filter((suspect) => suspect.score > 0);

  const allSuspects = [...crimeSuspects, ...notCrimeSuspects].sort((a, b) => b.score - a.score);
  const topCrime = allSuspects.find((suspect) => !suspect.is_not_crime) || null;
  const topNotCrime = allSuspects.find((suspect) => suspect.is_not_crime) || null;

  const mlPrediction = predictWithModel(inputText);
  const mlTop = mlPrediction?.ranked?.[0] || null;
  const mlSecond = mlPrediction?.ranked?.[1] || null;
  const mlMargin = mlTop && mlSecond ? mlTop.probability - mlSecond.probability : 1;
  const mlLabelKnown = Boolean(mlTop?.label && getCategoryById(mlTop.label));
  const mlReliable = Boolean(
    mlLabelKnown &&
      mlTop &&
      mlTop.probability >= (mlPrediction?.threshold ?? 0.55) &&
      mlMargin >= 0.08,
  );

  const financialAmbiguity = matchesAnyPattern(inputText, FINANCIAL_HARM_PATTERNS);
  const suspiciousContact = matchesAnyPattern(inputText, SUSPICIOUS_CONTACT_PATTERNS);
  const accountCompromise = matchesAnyPattern(inputText, ACCOUNT_COMPROMISE_PATTERNS);

  let classificationType = "UNCLEAR";
  let selectedCrimeId = null;
  let selectedNotCrimeId = null;

  if (mlReliable && isCrimeId(mlTop.label)) {
    classificationType = "CRIME";
    selectedCrimeId = mlTop.label;
  } else if (mlReliable && isNotCrimeId(mlTop.label)) {
    classificationType = "NOT_CRIME";
    selectedNotCrimeId = mlTop.label;
  } else if (topCrime && (!topNotCrime || topCrime.score >= topNotCrime.score * 0.82)) {
    classificationType = "CRIME";
    selectedCrimeId = topCrime.id;
  } else if (topNotCrime) {
    classificationType = "NOT_CRIME";
    selectedNotCrimeId = topNotCrime.id;
  } else if (suspiciousContact) {
    classificationType = "CRIME";
    selectedCrimeId = "CT002";
  } else if (accountCompromise) {
    classificationType = "CRIME";
    selectedCrimeId = "CT008";
  } else if (financialAmbiguity) {
    classificationType = "CRIME";
    selectedCrimeId = "CT001";
  }

  const inferredTopScore = allSuspects[0]?.score ?? 0;
  let confidence = mlReliable
    ? Math.round(Math.min((mlTop?.probability || 0) * 100, 99))
    : Math.round(Math.min(Math.max(inferredTopScore * 100, 0), 97));

  if (!mlReliable && classificationType === "CRIME" && selectedCrimeId === "CT001" && financialAmbiguity) {
    confidence = Math.max(confidence, 62);
  }

  if (!mlReliable && classificationType === "CRIME" && selectedCrimeId === "CT002" && suspiciousContact) {
    confidence = Math.max(confidence, 68);
  }

  if (!mlReliable && classificationType === "CRIME" && selectedCrimeId === "CT008" && accountCompromise) {
    confidence = Math.max(confidence, 72);
  }

  if (classificationType === "CRIME" && !selectedCrimeId) {
    selectedCrimeId = topCrime?.id || "CT001";
  }

  if (classificationType === "NOT_CRIME" && !selectedNotCrimeId) {
    selectedNotCrimeId = topNotCrime?.id || null;
  }

  const { firstQuestion, totalQuestions } = selectedCrimeId
    ? buildFirstQuestion(selectedCrimeId)
    : { firstQuestion: null, totalQuestions: 0 };

  const cleanSuspects = allSuspects
    .filter((suspect) => !suspect.is_not_crime)
    .slice(0, 5)
    .map(({ id, name, score, severity }) => ({ id, name, score, severity }));

  return {
    classification_type: classificationType,
    suspected_crimes: cleanSuspects,
    top_crime_id: classificationType === "CRIME" ? selectedCrimeId : null,
    top_not_crime_id: classificationType === "NOT_CRIME" ? selectedNotCrimeId : null,
    confidence,
    first_question: classificationType === "CRIME" ? firstQuestion : null,
    total_questions: classificationType === "CRIME" ? totalQuestions : 0,
    not_crime_data:
      classificationType === "NOT_CRIME" ? getCategoryById(selectedNotCrimeId)?.not_crime_data || null : null,
    model_source: mlReliable ? "hybrid_ml_rules" : "rules_fallback",
    model_version: mlPrediction?.modelVersion || null,
    note:
      classificationType === "UNCLEAR"
        ? "This looks cyber-related, but the current data is not specific enough yet. Ask a clarifying question instead of rejecting it."
        : `Evaluated ${getCatalogMeta().crime_categories || CRIME_ENTRIES.length} crime categories with ${
            mlReliable ? "hybrid ML + rules" : "rule fallback"
          }.`,
  };
}

module.exports = { classifyIncident };
