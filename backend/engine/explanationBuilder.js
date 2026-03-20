const { preprocess } = require("./tfidf");
const { getCategoryById, isCrimeId } = require("./incidentCatalog");

const GENERIC_CYBER_CHANGE_SIGNALS = [
  "unauthorized login or password reset",
  "phishing link, fake caller, or impersonation",
  "money moved without your approval",
  "OTP, PIN, CVV, password, or banking credentials shared under deception",
];

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function extractMatchedSignals(text, category, limit = 4) {
  const normalizedText = String(text || "").toLowerCase();
  const tokens = new Set(preprocess(normalizedText));
  const candidates = [...(category?.primary_identifiers || []), ...(category?.keywords || [])];

  return uniqueStrings(
    candidates.filter((phrase) => {
      const normalizedPhrase = String(phrase).toLowerCase();
      if (!normalizedPhrase) {
        return false;
      }

      if (normalizedText.includes(normalizedPhrase)) {
        return true;
      }

      const phraseTokens = preprocess(normalizedPhrase);
      return phraseTokens.length > 0 && phraseTokens.every((token) => tokens.has(token));
    }),
  ).slice(0, limit);
}

function getNotCrimeBranch(category) {
  const logic = category?.not_crime_data?.detection_logic || {};
  const entries = Object.entries(logic);

  for (const [, value] of entries) {
    if (value && typeof value === "object" && value.classification === "NOT_CRIME") {
      return value;
    }
  }

  if (logic.response?.classification === "NOT_CRIME") {
    return logic.response;
  }

  return null;
}

function formatLegalReferences(category) {
  const itAct = (category?.legal_sections?.it_act || []).map((entry) =>
    entry?.section ? `IT Act ${entry.section}` : null,
  );
  const ipc = (category?.legal_sections?.ipc || []).map((entry) =>
    entry?.section ? `IPC ${entry.section}` : null,
  );

  return uniqueStrings([...itAct, ...ipc]).slice(0, 5);
}

function buildCrimeReasoning(category, text, answers) {
  const matchedSignals = extractMatchedSignals(text, category);
  const answerList = Object.values(answers || {}).filter(Boolean);

  const decisionFactors = uniqueStrings([
    category?.description,
    category?.legal_summary,
    category?.disambiguation_note,
    answerList.length > 0 ? "The follow-up answers are consistent with this cyber incident pattern." : null,
  ]).slice(0, 4);

  return {
    summary:
      `This was treated as **${category?.title || "a cyber incident"}** because the report matches a cybercrime pattern involving deception, unauthorized access, or digital misuse.`,
    matchedSignals:
      matchedSignals.length > 0
        ? matchedSignals
        : ["The report contains cyber-risk indicators that fit this category."],
    decisionFactors,
    missingSignals: [],
    whatWouldChange: uniqueStrings([
      category?.disambiguation_note
        ? `This would need review if the facts point somewhere else: ${category.disambiguation_note}`
        : null,
      "If the transaction was fully voluntary and there was no deception, hacking, or unauthorized access, the result could move away from cybercrime.",
    ]).slice(0, 3),
    references: formatLegalReferences(category),
  };
}

function buildNotCrimeReasoning(category, text) {
  const matchedSignals = extractMatchedSignals(text, category);
  const branch = getNotCrimeBranch(category);

  const decisionFactors = uniqueStrings([
    ...(branch?.explanation || []),
    category?.legal_summary,
    category?.disambiguation_note,
  ]).slice(0, 4);

  const missingSignals = uniqueStrings([
    ...(branch?.why_not_crime || []),
    "No clear phishing, hacking, impersonation, or unauthorized access has been established yet.",
  ]).slice(0, 5);

  const whatWouldChange = uniqueStrings([
    branch?.exceptions || null,
    branch?.if_harassment_involved || null,
    "If you were tricked by a fake caller, fake link, fake website, or unauthorized login, this should be re-classified.",
    ...GENERIC_CYBER_CHANGE_SIGNALS,
  ]).slice(0, 5);

  return {
    summary:
      `This was treated as **not a cybercrime** because it currently matches **${category?.title || "a non-crime scenario"}** more than a hacking, fraud, or phishing pattern.`,
    matchedSignals:
      matchedSignals.length > 0 ? matchedSignals : ["The report matched a known non-crime / consumer / voluntary-action pattern."],
    decisionFactors,
    missingSignals,
    whatWouldChange,
    references: formatLegalReferences(category),
  };
}

function buildDecisionReasoning({ crimeId, userText = "", answers = {}, classificationType = null }) {
  const category = getCategoryById(crimeId);

  if (!category) {
    return {
      summary: "The system could not find a category-level explanation for this result.",
      matchedSignals: [],
      decisionFactors: [],
      missingSignals: [],
      whatWouldChange: GENERIC_CYBER_CHANGE_SIGNALS,
      references: [],
    };
  }

  const combinedText = [userText, ...Object.values(answers || {})].filter(Boolean).join(" ");
  const isCrime = classificationType
    ? classificationType === "CRIME"
    : isCrimeId(category.id);

  return isCrime
    ? buildCrimeReasoning(category, combinedText, answers)
    : buildNotCrimeReasoning(category, combinedText);
}

module.exports = { buildDecisionReasoning };
