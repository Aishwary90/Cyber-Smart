/**
 * classifier.js – TF-IDF keyword scoring classifier
 *
 * Uses cyber_crime.json and not_a_crime.json to score how well
 * the user's incident text matches each known crime type.
 * Returns ranked suspects in the shape expected by api.js → transformSuspects().
 */

const path = require("path");
const cyberCrimeData = require(path.join(__dirname, "../../data/cyber_crime.json"));
const notACrimeData = require(path.join(__dirname, "../../data/not_a_crime.json"));
const { preprocess, countKeywordHits } = require("./tfidf");

/* ── Severity weighting ── */
const SEVERITY_WEIGHT = { critical: 1.4, high: 1.2, medium: 1.0, low: 0.8, none: 0.3 };

/* ── Pre-built crime list from JSON ── */
const CRIME_ENTRIES = cyberCrimeData.crime_types || [];

/* ── Not-a-crime scenarios (flat keyword lists) ── */
const NOT_CRIME_ENTRIES = Object.entries(notACrimeData)
  .filter(([key]) => key.startsWith("NAC"))
  .map(([_key, val]) => ({
    id: _key,
    name: val.scenario_name || "Not a Cybercrime",
    keywords: val.trigger_keywords || [],
    severity: "none",
  }));

/**
 * Score text against a single crime entry.
 * score = (keyword_hits / total_keywords) * severity_weight
 * Capped at 0.99.
 */
function scoreCrime(tokens, crimeEntry) {
  const keywords = crimeEntry.keywords || [];
  if (keywords.length === 0) return 0;

  const { count } = countKeywordHits(tokens, keywords);
  if (count === 0) return 0;

  const ratio = count / keywords.length;
  const weight = SEVERITY_WEIGHT[crimeEntry.severity] ?? 1.0;

  return Math.min(0.99, ratio * weight * 10); // ×10 to get a 0–1 range from raw ratio
}

/**
 * classifyIncident(text) → { suspected_crimes: [...], top_crime_id, note }
 *
 * Each suspect:
 *   { id, name, score, severity, matched_keywords }
 */
function classifyIncident(text) {
  if (!text || typeof text !== "string" || text.trim().length < 3) {
    return {
      suspected_crimes: [],
      top_crime_id: null,
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
    };
  }).filter((s) => s.score > 0);

  /* Score not-a-crime scenarios */
  const notCrimeSuspects = NOT_CRIME_ENTRIES.map((entry) => {
    const score = scoreCrime(tokens, entry);
    const { matched } = countKeywordHits(tokens, entry.keywords || []);
    return {
      id: entry.id,
      name: entry.name,
      score: Math.round(score * 100) / 100,
      severity: "none",
      matched_keywords: matched.slice(0, 3),
      is_not_crime: true,
    };
  }).filter((s) => s.score > 0);

  /* Merge and sort */
  const allSuspects = [...crimeSuspects, ...notCrimeSuspects].sort(
    (a, b) => b.score - a.score
  );

  const topCrime = allSuspects.find((s) => !s.is_not_crime);
  const topCrimeId = topCrime?.id ?? null;

  return {
    suspected_crimes: allSuspects.slice(0, 5),
    top_crime_id: topCrimeId,
    note: allSuspects.length
      ? `Classified against ${CRIME_ENTRIES.length} crime patterns.`
      : "No strong keyword match. Needs more detail.",
  };
}

module.exports = { classifyIncident };
