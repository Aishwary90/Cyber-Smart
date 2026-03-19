/**
 * questionEngine.js – Step-based cross-questioning engine
 *
 * Pulls questions from cyber_crime.json cross_questions array for a given crime ID.
 * Supports skip-logic: if the user's original text already contains the
 * info_provided_keywords for a question, it is auto-skipped.
 *
 * Expected payload: { crimeId, step, userText, answer }
 * Returns: { question_id, question, options, priority, step, total, done }
 */

const path = require("path");
const cyberCrimeData = require(path.join(__dirname, "../../data/cyber_crime.json"));
const { preprocess } = require("./tfidf");

const CRIME_MAP = {};
for (const crime of cyberCrimeData.crime_types || []) {
  CRIME_MAP[crime.id] = crime;
}

/**
 * Decide if a question should be skipped because the user's text
 * already contains the info_provided_keywords.
 */
function shouldSkip(question, userTokenSet) {
  const infoKws = question.skip_logic?.skip_if_keywords_present
    ? question.info_provided_keywords || []
    : [];

  if (infoKws.length === 0) return false;

  return infoKws.some((kw) => {
    const kwTokens = preprocess(kw);
    return kwTokens.length > 0 && kwTokens.every((t) => userTokenSet.has(t));
  });
}

/**
 * getNextQuestion({ crimeId, step, userText }) → question object or done signal
 */
function getNextQuestion(payload) {
  const { crimeId, step = 0, userText = "" } = payload || {};

  /* ── Look up crime ── */
  const crime = CRIME_MAP[crimeId];
  if (!crime) {
    return {
      done: true,
      reason: `Crime ID "${crimeId}" not found in data.`,
    };
  }

  const questions = crime.cross_questions || [];
  if (questions.length === 0) {
    return { done: true, reason: "No cross-questions defined for this crime." };
  }

  const userTokenSet = new Set(preprocess(userText));
  const total = questions.length;

  /* Find the next non-skipped question starting from `step` */
  let currentStep = Number(step) || 0;

  while (currentStep < total) {
    const q = questions[currentStep];
    if (!shouldSkip(q, userTokenSet)) {
      /* Return this question */
      return {
        question_id: q.question_id,
        question: q.question,
        options: q.options || [],
        priority: q.priority || "normal",
        type: q.type || "single_choice",
        step: currentStep,
        total,
        done: false,
        skip_hint: q.skip_logic?.reason || null,
      };
    }
    /* Auto-skip: move to next step */
    currentStep++;
  }

  /* All questions answered or skipped */
  return { done: true, step: currentStep, total };
}

module.exports = { getNextQuestion };
