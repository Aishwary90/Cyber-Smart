/**
 * classifier.js – TF-IDF keyword scoring classifier
 *
 * Returns the shape App.jsx expects:
 * {
 *   classification_type: "CRIME" | "NOT_CRIME" | "UNCLEAR",
 *   suspected_crimes: [{ id, name, score, severity }],
 *   top_crime_id: string | null,
 *   confidence: number (0-100),
 *   first_question: object | null,
 *   total_questions: number,
 *   not_crime_data: object | null,
 *   note: string
 * }
 */

const path = require("path");
const cyberCrimeData = require(path.join(__dirname, "../../data/cyber_crime.json"));
const notACrimeData = require(path.join(__dirname, "../../data/not_a_crime.json"));
const { preprocess, countKeywordHits } = require("./tfidf");
const { predictWithModel } = require("./mlModel");

/* ── Severity weighting ── */
const SEVERITY_WEIGHT = { critical: 1.4, high: 1.2, medium: 1.0, low: 0.8, none: 0.3 };

/* ── Pre-built crime list from JSON ── */
const CRIME_ENTRIES = cyberCrimeData.crime_types || [];

/* ── Not-a-crime scenarios (flat keyword lists) ── */
const NOT_CRIME_ENTRIES = Object.entries(notACrimeData)
  .filter(([key]) => key.startsWith("NAC"))
  .map(([key, val]) => ({
    id: key,
    name: val.scenario_name || "Not a Cybercrime",
    keywords: val.trigger_keywords || [],
    severity: "none",
    data: val,
  }));

function scoreCrime(tokens, crimeEntry) {
  const keywords = crimeEntry.keywords || [];
  if (keywords.length === 0) return 0;
  const { count } = countKeywordHits(tokens, keywords);
  if (count === 0) return 0;
  const ratio = count / keywords.length;
  const weight = SEVERITY_WEIGHT[crimeEntry.severity] ?? 1.0;
  return Math.min(0.99, ratio * weight * 10);
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
      note: "Incident text too short or missing.",
    };
  }

  const tokens = preprocess(text);

  /* Score all crime types */
  const crimeSuspects = CRIME_ENTRIES.map((entry) => {
    const score = scoreCrime(tokens, entry);
    const { matched } = countKeywordHits(tokens, entry.keywords || []);
    return {
      id: entry.id,
      name: entry.crime_name,
      score: Math.round(score * 100) / 100,
      severity: entry.severity,
      matched_keywords: matched.slice(0, 5),
      cross_questions: entry.cross_questions || [],
    };
  }).filter((s) => s.score > 0);

  /* Score not-a-crime scenarios */
  const notCrimeSuspects = NOT_CRIME_ENTRIES.map((entry) => {
    const score = scoreCrime(tokens, entry);
    return {
      id: entry.id,
      name: entry.name,
      score: Math.round(score * 100) / 100,
      severity: "none",
      is_not_crime: true,
      data: entry.data,
    };
  }).filter((s) => s.score > 0);

  /* Sort all by score */
  const allSuspects = [...crimeSuspects, ...notCrimeSuspects].sort(
    (a, b) => b.score - a.score
  );

  const crimeById = {};
  for (const c of CRIME_ENTRIES) {
    crimeById[c.id] = c;
  }

  const topCrime = allSuspects.find((s) => !s.is_not_crime);
  const topNotCrime = allSuspects.find((s) => s.is_not_crime);

  const mlPrediction = predictWithModel(text);
  const mlTop = mlPrediction?.ranked?.[0] || null;
  const mlSecond = mlPrediction?.ranked?.[1] || null;
  const mlMargin = mlTop && mlSecond ? mlTop.probability - mlSecond.probability : 1;
  const mlReliable = Boolean(
    mlTop &&
      mlTop.probability >= (mlPrediction?.threshold ?? 0.55) &&
      mlMargin >= 0.08
  );

  /* Determine classification */
  let classificationType = "UNCLEAR";
  if (
    mlReliable &&
    (mlTop.label.startsWith("CT") || mlTop.label.startsWith("NAC"))
  ) {
    classificationType = mlTop.label.startsWith("CT") ? "CRIME" : "NOT_CRIME";
  } else if (topCrime && (!topNotCrime || topCrime.score >= topNotCrime.score * 0.8)) {
    classificationType = "CRIME";
  } else if (topNotCrime && (!topCrime || topNotCrime.score > topCrime.score * 0.8)) {
    classificationType = "NOT_CRIME";
  } else if (topCrime) {
    classificationType = "CRIME";
  }

  /* Confidence (0-100) */
  const topScore = allSuspects[0]?.score ?? 0;
  const confidence = mlReliable
    ? Math.round(Math.min((mlTop?.probability || 0) * 100, 99))
    : Math.round(Math.min(topScore * 100, 97));

  const selectedCrimeId =
    classificationType === "CRIME"
      ? mlReliable && mlTop?.label?.startsWith("CT")
        ? mlTop.label
        : topCrime?.id ?? null
      : null;

  /* First question from top crime */
  let firstQuestion = null;
  let totalQuestions = 0;
  if (selectedCrimeId && crimeById[selectedCrimeId]) {
    const questions = crimeById[selectedCrimeId].cross_questions || [];
    totalQuestions = questions.length;
    if (questions.length > 0) {
      const q = questions[0];
      firstQuestion = {
        question_id: q.question_id,
        question: q.question,
        options: q.options || [],
        priority: q.priority || "normal",
        step: 0,
        total: totalQuestions,
      };
    }
  }

  /* Clean suspects for response (remove internal data) */
  const cleanSuspects = allSuspects
    .filter((s) => !s.is_not_crime)
    .slice(0, 5)
    .map(({ id, name, score, severity }) => ({ id, name, score, severity }));

  const inferredTopNotCrimeId =
    mlReliable && mlTop?.label?.startsWith("NAC") ? mlTop.label : topNotCrime?.id;
  const inferredNotCrimeData =
    classificationType === "NOT_CRIME" ? notACrimeData[inferredTopNotCrimeId] || null : null;

  return {
    classification_type: classificationType,
    suspected_crimes: cleanSuspects,
    top_crime_id: selectedCrimeId,
    confidence,
    first_question: firstQuestion,
    total_questions: totalQuestions,
    not_crime_data: inferredNotCrimeData,
    model_source: mlReliable ? "ml+rules" : "rules",
    model_version: mlPrediction?.modelVersion || null,
    note: allSuspects.length
      ? `Classified against ${CRIME_ENTRIES.length} crime patterns.`
      : "No strong keyword match. Please describe in more detail.",
  };
}

module.exports = { classifyIncident };
