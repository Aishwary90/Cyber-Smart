const express = require("express");
const { classifyIncident } = require("../engine/classifier");
const { getNextQuestion } = require("../engine/questionEngine");
const { buildVerdict } = require("../engine/verdictBuilder");
const { getCategoryById } = require("../engine/incidentCatalog");
const { buildDecisionReasoning } = require("../engine/explanationBuilder");

const router = express.Router();

// Store conversation contexts (in production, use Redis or database)
const conversationContexts = new Map();

const DEFAULT_SUGGESTIONS = [
  "Money was stolen from my account",
  "I think someone hacked my email",
  "I got a suspicious message",
  "Help me understand if this is a scam",
];

function buildClassificationBadge(type, confidence, extra = {}) {
  return {
    type,
    confidence: Math.round(confidence || 0),
    ...extra,
  };
}

function buildReasoningForCase(currentCase, messageOverride = "") {
  const answerMap = {};
  for (const answer of currentCase?.answers || []) {
    answerMap[answer.question_id] = answer.answer;
  }

  return buildDecisionReasoning({
    crimeId: currentCase?.crimeId || currentCase?.notCrimeId || null,
    userText: messageOverride || currentCase?.originalText || "",
    answers: answerMap,
    classificationType: currentCase?.classificationType || null,
  });
}

function renderReasoningSummary(reasoning, isCrime) {
  if (!reasoning) {
    return isCrime
      ? "The current report still fits a cybercrime pattern."
      : "The current report does not yet show enough signs of cybercrime.";
  }

  const factorCandidate = reasoning.decisionFactors?.[0] || reasoning.missingSignals?.[0] || null;
  const factor = factorCandidate && factorCandidate !== reasoning.summary ? factorCandidate : null;
  const change = reasoning.whatWouldChange?.[0];

  return [reasoning.summary, factor, change ? `If this changes: ${change}` : null]
    .filter(Boolean)
    .join(" ");
}

function inferRisk(severity) {
  const normalized = String(severity || "").toLowerCase();
  if (normalized === "critical" || normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function createCaseState(message, classification) {
  const category = classification.top_crime_id ? getCategoryById(classification.top_crime_id) : null;
  const notCrimeCategory = classification.top_not_crime_id
    ? getCategoryById(classification.top_not_crime_id)
    : null;

  return {
    id: `case-${Date.now()}`,
    originalText: message,
    latestUserText: message,
    classificationType: classification.classification_type,
    confidence: classification.confidence || 0,
    modelSource: classification.model_source || "rules_fallback",
    crimeId: classification.top_crime_id || null,
    notCrimeId: classification.top_not_crime_id || null,
    categoryTitle:
      category?.title ||
      notCrimeCategory?.title ||
      classification.suspected_crimes?.[0]?.name ||
      "Cyber incident",
    severity: category?.severity || notCrimeCategory?.severity || "medium",
    risk: inferRisk(category?.severity || notCrimeCategory?.severity),
    answers: [],
    status: classification.first_question ? "questioning" : "classified",
    pendingQuestion: classification.first_question || null,
    verdict: null,
    notCrimeData: classification.not_crime_data || notCrimeCategory?.not_crime_data || null,
    createdAt: new Date().toISOString(),
  };
}

function appendContextMessages(context, userText, assistantText) {
  context.messages.push(
    { role: "user", content: userText, timestamp: new Date() },
    { role: "assistant", content: assistantText, timestamp: new Date() },
  );
  context.messages = context.messages.slice(-20);
}

function isExplanationIntent(message = "") {
  return /\b(why|how|explain|reason|not crime|out of scope|result|classification|verdict)\b/i.test(
    message,
  );
}

function isResetIntent(message = "") {
  return /\b(new case|another case|different issue|different problem|start over|reset chat|new incident)\b/i.test(
    message,
  );
}

function buildOutOfScopeResponse() {
  return {
    text:
      "I can help with cybercrime, scams, phishing, account compromise, and digital payment incidents. " +
      "This message does not yet show a clear cyber element. If money, an account, a suspicious link, or unauthorized access was involved, tell me that directly and I will continue.",
    classification: buildClassificationBadge("OUT_OF_SCOPE", 0),
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

function buildUnclearResponse() {
  return {
    text:
      "This still sounds like it may be cyber-related, but I need one key detail before I label it. " +
      "Tell me whether this involved money loss, account access, a suspicious message or link, or device compromise.",
    classification: buildClassificationBadge("NEEDS_MORE_INFO", 0),
    suggestions: [
      "Money was taken from my bank account",
      "Someone logged into my account",
      "I received a suspicious email or link",
      "My phone or laptop was stolen and accounts were accessed",
    ],
  };
}

function buildNotCrimeResponse(currentCase, verdict) {
  const options = verdict.verdict.your_options || currentCase.notCrimeData?.detection_logic?.if_voluntary?.your_options || [];
  const reasoning = verdict.verdict.decision_reasoning || buildReasoningForCase(currentCase);

  return {
    text:
      `From what you've described, this currently looks like **${verdict.verdict.subtitle}**, which is not being treated as a cybercrime right now. ` +
      "If there was phishing, impersonation, unauthorized login, or money moved without your approval, tell me that and I will reassess the case.",
    classification: buildClassificationBadge("NOT_CRIME", currentCase.confidence),
    reasoning,
    suggestions:
      options.length > 0
        ? [...options.slice(0, 2), "Why is this not crime?", "What would change this result?"]
        : ["Why is this not crime?", "What would change this result?", "Start a new case"],
  };
}

function buildCrimeQuestionResponse(currentCase, question, introText) {
  const reasoning = buildReasoningForCase(currentCase);
  return {
    text:
      `${introText} ` +
      `To verify the case properly, I need one detail: **${question.question}**`,
    classification: buildClassificationBadge("CRIME", currentCase.confidence, {
      crimeType: currentCase.categoryTitle,
      risk: currentCase.risk,
    }),
    reasoning,
    caseCreated: true,
    caseId: currentCase.id,
    suggestions: [...(question.options || []), "How did you decide this?"],
  };
}

function buildCrimeVerdictResponse(currentCase, verdict) {
  const actions = verdict.verdict.immediate_actions || [];
  const reasoning = verdict.verdict.decision_reasoning || buildReasoningForCase(currentCase);

  return {
    text:
      `Based on the details shared, this now looks like **${verdict.verdict.subtitle}**. ` +
      `Risk level: **${verdict.verdict.risk}**. ` +
      (actions.length > 0 ? `Start with: ${actions.slice(0, 2).join(" | ")}` : "I can help you with the next action steps."),
    classification: buildClassificationBadge("CRIME", currentCase.confidence, {
      crimeType: currentCase.categoryTitle,
      risk: currentCase.risk,
    }),
    reasoning,
    caseCreated: true,
    caseId: currentCase.id,
    suggestions: [
      "What should I do right now?",
      "What evidence should I keep?",
      "How did you decide this?",
      "How do I report this?",
    ],
  };
}

function buildExplanationResponse(currentCase) {
  if (!currentCase) {
    return {
      text: "There is no active case yet. Describe the incident and I will explain the result step by step.",
      classification: buildClassificationBadge("INFO", 0),
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  if (currentCase.verdict?.verdict?.verdict_type === "NOT_A_CRIME") {
    const reasoning =
      currentCase.verdict.verdict.decision_reasoning || buildReasoningForCase(currentCase);
    return {
      text:
        renderReasoningSummary(reasoning, false),
      classification: buildClassificationBadge("NOT_CRIME", currentCase.confidence),
      reasoning,
      suggestions: [
        "There was unauthorized access",
        "I was tricked by a fake caller or link",
        "Money moved without my approval",
        "Start a new case",
      ],
    };
  }

  if (currentCase.pendingQuestion) {
    const reasoning = buildReasoningForCase(currentCase);
    return {
      text:
        renderReasoningSummary(reasoning, true) +
        ` I have not finalized the verdict yet. The next detail I need is: **${currentCase.pendingQuestion.question}**`,
      classification: buildClassificationBadge("CRIME", currentCase.confidence, {
        crimeType: currentCase.categoryTitle,
        risk: currentCase.risk,
      }),
      reasoning,
      suggestions: currentCase.pendingQuestion.options || [],
    };
  }

  if (currentCase.verdict) {
    const reasoning =
      currentCase.verdict.verdict.decision_reasoning || buildReasoningForCase(currentCase);
    return {
      text:
        renderReasoningSummary(reasoning, currentCase.verdict.verdict.verdict_type === "CONFIRMED_CYBERCRIME"),
      classification: buildClassificationBadge(
        currentCase.verdict.verdict.verdict_type === "CONFIRMED_CYBERCRIME" ? "CRIME" : "NOT_CRIME",
        currentCase.confidence,
        currentCase.verdict.verdict.verdict_type === "CONFIRMED_CYBERCRIME"
          ? { crimeType: currentCase.categoryTitle, risk: currentCase.risk }
          : {},
      ),
      reasoning,
      suggestions: ["What should I do right now?", "What evidence should I keep?", "How did you decide this?"],
    };
  }

  return {
    text:
      `The current case is being tracked as **${currentCase.categoryTitle}** with ${currentCase.confidence}% confidence. ` +
      "Share the next detail and I will keep the same case open instead of starting over.",
    classification: buildClassificationBadge(currentCase.classificationType || "INFO", currentCase.confidence),
    reasoning: buildReasoningForCase(currentCase),
    suggestions: currentCase.pendingQuestion?.options || DEFAULT_SUGGESTIONS,
  };
}

function finalizeCrimeCase(currentCase) {
  const answerMap = {};
  for (const answer of currentCase.answers) {
    answerMap[answer.question_id] = answer.answer;
  }

  const compiledText = [
    currentCase.originalText,
    ...currentCase.answers.map((answer) => `${answer.question}: ${answer.answer}`),
  ].join("\n");

  const verdict = buildVerdict({
    crimeId: currentCase.crimeId,
    userText: compiledText,
    answers: answerMap,
    caseId: currentCase.id,
  });

  currentCase.status = "resolved";
  currentCase.verdict = verdict;
  currentCase.pendingQuestion = null;
  currentCase.confidence = Math.max(currentCase.confidence, 75);

  return buildCrimeVerdictResponse(currentCase, verdict);
}

function handleActiveCaseReply(context, message) {
  const currentCase = context.currentCase;

  if (isExplanationIntent(message)) {
    return buildExplanationResponse(currentCase);
  }

  if (isResetIntent(message)) {
    context.currentCase = null;
    return null;
  }

  if (!currentCase?.pendingQuestion) {
    return buildExplanationResponse(currentCase);
  }

  currentCase.answers.push({
    question_id: currentCase.pendingQuestion.question_id,
    question: currentCase.pendingQuestion.question,
    answer: message,
    step: currentCase.pendingQuestion.step,
    answeredAt: new Date().toISOString(),
  });
  currentCase.latestUserText = message;

  const combinedText = [
    currentCase.originalText,
    ...currentCase.answers.map((answer) => answer.answer),
  ].join(" ");

  const nextQuestion = getNextQuestion({
    crimeId: currentCase.crimeId,
    step: Number(currentCase.pendingQuestion.step || 0) + 1,
    userText: combinedText,
  });

  if (!nextQuestion.done) {
    currentCase.pendingQuestion = nextQuestion;
    currentCase.status = "questioning";

    return {
      text: `Understood. I have kept this in the same case. Next, I need to confirm: **${nextQuestion.question}**`,
      classification: buildClassificationBadge("CRIME", currentCase.confidence, {
        crimeType: currentCase.categoryTitle,
        risk: currentCase.risk,
      }),
      caseCreated: true,
      caseId: currentCase.id,
      suggestions: nextQuestion.options || [],
    };
  }

  return finalizeCrimeCase(currentCase);
}

function startNewCase(message, classification, context) {
  if (classification.classification_type === "OUT_OF_SCOPE") {
    context.currentCase = null;
    return buildOutOfScopeResponse();
  }

  if (classification.classification_type === "UNCLEAR" || classification.classification_type === "INSUFFICIENT_DATA") {
    context.currentCase = null;
    return buildUnclearResponse();
  }

  if (classification.classification_type === "NOT_CRIME") {
    const currentCase = createCaseState(message, classification);
    currentCase.status = "resolved";
    currentCase.verdict = buildVerdict({
      crimeId: currentCase.notCrimeId,
      userText: message,
      answers: {},
      caseId: currentCase.id,
    });
    context.currentCase = currentCase;
    return buildNotCrimeResponse(currentCase, currentCase.verdict);
  }

  const currentCase = createCaseState(message, classification);
  context.currentCase = currentCase;

  if (classification.first_question) {
    return buildCrimeQuestionResponse(
      currentCase,
      classification.first_question,
      `Based on what you've described, this looks like **${currentCase.categoryTitle}** (${currentCase.confidence}% confidence).`,
    );
  }

  return finalizeCrimeCase(currentCase);
}

router.post("/", async (req, res) => {
  try {
    const { message, userId = "anonymous" } = req.body;

    if (!message || typeof message !== "string") {
      return res.status(400).json({
        error: "Message is required and must be a string",
      });
    }

    const context = conversationContexts.get(userId) || { messages: [], currentCase: null };
    let response = null;

    if (context.currentCase) {
      response = handleActiveCaseReply(context, message.trim());
    }

    if (!response) {
      const classification = classifyIncident(message.trim());
      response = startNewCase(message.trim(), classification, context);
    }

    appendContextMessages(context, message.trim(), response.text);
    conversationContexts.set(userId, context);

    res.json(response);
  } catch (error) {
    console.error("Chat API error:", error);
    res.status(500).json({
      text:
        "I ran into a processing problem while handling this case. Please try once more. " +
        "If the problem continues and the incident is urgent, contact 1930 or cybercrime.gov.in directly.",
      classification: buildClassificationBadge("ERROR", 0),
      suggestions: [
        "Try again",
        "Explain what happened in more detail",
        "Start a new case",
      ],
    });
  }
});

router.get("/history/:userId", (req, res) => {
  const { userId } = req.params;
  const context = conversationContexts.get(userId) || { messages: [], currentCase: null };

  res.json({
    messages: context.messages,
    currentCase: context.currentCase,
  });
});

router.delete("/history/:userId", (req, res) => {
  const { userId } = req.params;
  conversationContexts.delete(userId);

  res.json({ success: true, message: "Conversation history cleared" });
});

module.exports = router;
