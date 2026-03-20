/**
 * questionEngine.js - Step-based cross-questioning engine
 *
 * Pulls questions from the normalized incident catalog for a given category ID.
 * Supports skip-logic: if the user's text already contains the
 * info_provided_keywords for a question, it is auto-skipped.
 *
 * Expected payload: { crimeId, step, userText }
 * Returns: { question_id, question, options, priority, step, total, done }
 */

const { preprocess } = require("./tfidf");
const { getCategoryById } = require("./incidentCatalog");

function shouldSkip(question, userTokenSet) {
  const infoKeywords = question.skip_logic?.skip_if_keywords_present
    ? question.info_provided_keywords || []
    : [];

  if (infoKeywords.length === 0) {
    return false;
  }

  return infoKeywords.some((keyword) => {
    const keywordTokens = preprocess(keyword);
    return keywordTokens.length > 0 && keywordTokens.every((token) => userTokenSet.has(token));
  });
}

function getNextQuestion(payload) {
  const { crimeId, step = 0, userText = "" } = payload || {};

  const category = getCategoryById(crimeId);
  if (!category) {
    return {
      done: true,
      reason: `Category ID "${crimeId}" not found in the normalized catalog.`,
    };
  }

  const questions = category.questions || [];
  if (questions.length === 0) {
    return {
      done: true,
      reason: "No cross-questions defined for this category.",
    };
  }

  const userTokenSet = new Set(preprocess(userText));
  const total = questions.length;
  let currentStep = Number(step) || 0;

  while (currentStep < total) {
    const question = questions[currentStep];
    if (!shouldSkip(question, userTokenSet)) {
      return {
        question_id: question.question_id,
        question: question.question,
        options: question.options || [],
        priority: question.priority || "normal",
        type: question.type || "single_choice",
        category_id: category.id,
        category_title: category.title,
        step: currentStep,
        total,
        done: false,
        skip_hint: question.skip_logic?.reason || null,
      };
    }

    currentStep += 1;
  }

  return {
    done: true,
    step: currentStep,
    total,
  };
}

module.exports = { getNextQuestion };
