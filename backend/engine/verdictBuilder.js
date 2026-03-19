/**
 * verdictBuilder.js – Rule-based legal verdict engine
 *
 * Uses legal_db.json to produce a structured verdict that matches the
 * shape expected by api.js → transformVerdict().
 *
 * Expected payload: { crimeId, userText, answers, caseId }
 * Returns: { verdict: { verdict_type, title, subtitle, risk, explanation,
 *             legal_sections, immediate_actions, evidence_required } }
 */

const path = require("path");
const legalDb = require(path.join(__dirname, "../../data/legal_db.json"));
const cyberCrimeData = require(path.join(__dirname, "../../data/cyber_crime.json"));

/* ── Build lookup maps ── */
const LEGAL_MAP = {};
for (const entry of legalDb.crimes || []) {
  LEGAL_MAP[entry.id] = entry;
}

const CRIME_MAP = {};
for (const crime of cyberCrimeData.crime_types || []) {
  CRIME_MAP[crime.id] = crime;
}

const SEVERITY_TO_RISK = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  none: "None",
};

/**
 * Build a human-readable explanation from multiple sources.
 */
function buildExplanation(legal, crime, answers) {
  const parts = [];

  if (legal?.legal_summary) parts.push(legal.legal_summary);

  if (crime?.case_study?.key_lesson) {
    parts.push(crime.case_study.key_lesson);
  }

  if (answers && Object.keys(answers).length > 0) {
    parts.push("Your answers have been taken into account for this verdict.");
  }

  return parts.length ? parts : ["Based on the incident details provided."];
}

/**
 * buildVerdict({ crimeId, userText, answers, caseId }) → verdict response
 */
function buildVerdict(payload) {
  const { crimeId, userText = "", answers = {} } = payload || {};

  /* ── Not-a-crime IDs start with NAC ── */
  const isNotCrimeId =
    !crimeId || crimeId.startsWith("NAC") || crimeId === "CT999";

  /* ── Look up records ── */
  const legal = LEGAL_MAP[crimeId] || LEGAL_MAP["CT999"];
  const crime = CRIME_MAP[crimeId] || null;

  /* ── Determine verdict type ── */
  const isCrime =
    !isNotCrimeId && legal?.classification?.type === "cybercrime";

  const verdictType = isCrime ? "CONFIRMED_CYBERCRIME" : "NOT_A_CRIME";
  const severity = legal?.classification?.severity || (isCrime ? "high" : "none");
  const risk = SEVERITY_TO_RISK[severity] || "Unknown";

  /* ── Legal sections ── */
  const legalSections = legal?.legal_mapping || {};

  /* ── Actions & evidence ── */
  const immediateActions =
    crime?.immediate_actions ??
    legal?.immediate_actions ??
    ["Contact cybercrime.gov.in or call 1930"];

  const evidenceRequired =
    crime?.evidence_to_collect ??
    legal?.evidence_required ??
    ["Preserve all messages and screenshots"];

  /* ── Explanation ── */
  const explanation = buildExplanation(legal, crime, answers);

  /* ── Reporting details ── */
  const reporting = legal?.reporting || {
    primary: "cybercrime.gov.in",
    helpline: "1930",
  };

  return {
    verdict: {
      verdict_type: verdictType,
      title: isCrime ? "Confirmed Cybercrime" : "Not a Cybercrime",
      subtitle: legal?.crime_name ?? (isCrime ? "Cyber Offence" : "Civil / Consumer Matter"),
      risk,
      severity,
      explanation,
      legal_sections: {
        it_act: legalSections.it_act || [],
        ipc: legalSections.ipc || [],
      },
      immediate_actions: immediateActions,
      evidence_required: evidenceRequired,
      reporting,
      timeline_guidance: legal?.timeline_guidance || null,
      why_not_crime: !isCrime
        ? [
            "No illegal hacking, fraud, or phishing pattern detected.",
            "This may be a civil or consumer dispute.",
          ]
        : null,
      your_options: !isCrime
        ? [
            "Contact consumer forum or platform support",
            "File civil complaint if amount is significant",
          ]
        : null,
    },
    crimeId,
    userText,
    answers,
  };
}

module.exports = { buildVerdict };
