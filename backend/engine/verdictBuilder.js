/**
 * verdictBuilder.js - Verdict engine backed by the normalized incident catalog.
 *
 * Expected payload:
 *   { crimeId, userText, answers, caseId }
 * Returns:
 *   { verdict: { verdict_type, title, subtitle, risk, explanation,
 *                legal_sections, immediate_actions, evidence_required } }
 */

const { getCategoryById, isCrimeId } = require("./incidentCatalog");
const { buildDecisionReasoning } = require("./explanationBuilder");

const SEVERITY_TO_RISK = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "Low",
};

function buildExplanation(category, answers, userText) {
  const parts = [];

  if (category?.legal_summary) {
    parts.push(category.legal_summary);
  }

  if (category?.description) {
    parts.push(category.description);
  }

  if (userText) {
    parts.push("The verdict also considers the details you shared about this incident.");
  }

  if (answers && Object.keys(answers).length > 0) {
    parts.push("Your follow-up answers were included before preparing this result.");
  }

  return parts.length > 0 ? parts : ["Based on the incident details provided."];
}

function buildVerdict(payload) {
  const { crimeId, userText = "", answers = {} } = payload || {};
  const category = getCategoryById(crimeId);

  const isCrime = isCrimeId(crimeId);
  const severity = category?.severity || (isCrime ? "high" : "none");
  const risk = SEVERITY_TO_RISK[severity] || "Medium";

  const immediateActions =
    category?.immediate_actions?.length > 0
      ? category.immediate_actions
      : ["Contact cybercrime.gov.in or call 1930 if you suspect digital fraud."];

  const evidenceRequired =
    category?.evidence_required?.length > 0
      ? category.evidence_required
      : ["Preserve messages, screenshots, transaction IDs, and account alerts."];

  const explanation = buildExplanation(category, answers, userText);
  const decisionReasoning = buildDecisionReasoning({
    crimeId,
    userText,
    answers,
    classificationType: isCrime ? "CRIME" : "NOT_CRIME",
  });

  return {
    verdict: {
      verdict_type: isCrime ? "CONFIRMED_CYBERCRIME" : "NOT_A_CRIME",
      title: isCrime ? "Confirmed Cybercrime" : "Not a Cybercrime",
      subtitle: category?.title || (isCrime ? "Cyber Offence" : "Civil / Consumer Matter"),
      risk,
      severity,
      explanation,
      legal_sections: category?.legal_sections || { it_act: [], ipc: [] },
      immediate_actions: immediateActions,
      evidence_required: evidenceRequired,
      reporting: category?.reporting || {
        primary: "cybercrime.gov.in",
        helpline: "1930",
      },
      timeline_guidance: category?.timeline_guidance || null,
      decision_reasoning: decisionReasoning,
      why_not_crime: !isCrime
        ? [
            "This looks closer to a consumer, platform, or voluntary transaction issue than a cyber intrusion.",
            "If new evidence shows unauthorized access, phishing, impersonation, or forced transfer, the case should be re-evaluated.",
          ]
        : null,
      your_options: !isCrime
        ? category?.immediate_actions?.length > 0
          ? category.immediate_actions
          : [
              "Contact the platform, seller, or bank support first",
              "Keep transaction proof and complaint references",
            ]
        : null,
    },
    crimeId,
    userText,
    answers,
  };
}

module.exports = { buildVerdict };
