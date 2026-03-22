import React, { useEffect, useRef, useState } from "react";
import {
  chatSendMessage,
  classifyIncident,
  getNextQuestion,
  getVerdict,
  getCrimeDetails,
} from "../api";
import "../cyber-chat.css";

const MAX_FOLLOW_UP_QUESTIONS = 2;

// Enhanced question sequence
const EVIDENCE_QUESTION_ID = "Q_EVIDENCE_COLLECTION";
const DETAILED_NARRATIVE_QUESTION_ID = "Q_DETAILED_NARRATIVE";
const MAX_CLARIFYING_QUESTIONS = 6;

function toSafeString(value, fallback = "") {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return fallback;
  }

  return String(value);
}

function toStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => toSafeString(entry).trim()).filter(Boolean);
}

function parseMarkdownContent(text) {
  if (!text) return text;

  // Split by double newlines to get sections
  const sections = text.split('\n\n');

  return sections.map((section, idx) => {
    let content = section;
    let isH1 = false, isH2 = false, isListItem = false;

    // Check for headers
    if (content.startsWith('# **')) {
      content = content.replace(/^# \*\*/, '').replace(/\*\*$/, '');
      isH1 = true;
    } else if (content.startsWith('## **')) {
      content = content.replace(/^## \*\*/, '').replace(/\*\*:?$/, '');
      isH2 = true;
    } else if (/^\d+\./.test(content)) {
      isListItem = true;
    }

    // Parse inline bold (**text**)
    const parts = content.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, partIdx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIdx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (isH1) {
      return <h1 key={idx} className="legal-h1">{rendered}</h1>;
    } else if (isH2) {
      return <h2 key={idx} className="legal-h2">{rendered}</h2>;
    } else if (isListItem) {
      return <div key={idx} className="legal-list-item">{rendered}</div>;
    } else if (content.startsWith('**⚠️')) {
      return <div key={idx} className="legal-warning">{rendered}</div>;
    } else {
      return <p key={idx} className="legal-paragraph">{rendered}</p>;
    }
  });
}

function normalizeClassification(classification) {
  if (!classification || typeof classification !== "object") {
    return null;
  }

  const type = toSafeString(classification.type).trim();
  if (!type) {
    return null;
  }

  return {
    ...classification,
    type,
    confidence: Number.isFinite(Number(classification.confidence))
      ? Number(classification.confidence)
      : 0,
  };
}

function normalizeReasoning(reasoning) {
  if (!reasoning || typeof reasoning !== "object") {
    return null;
  }

  return {
    summary: toSafeString(reasoning.summary),
    matchedSignals: toStringArray(reasoning.matchedSignals),
    missingSignals: toStringArray(reasoning.missingSignals),
    whatWouldChange: toStringArray(reasoning.whatWouldChange),
  };
}

function buildAssistantMessage({
  text,
  classification = null,
  reasoning = null,
  suggestions = [],
  error = false,
}) {
  return {
    role: "assistant",
    content: toSafeString(text, "I processed your report, but the response content was incomplete."),
    classification: normalizeClassification(classification),
    reasoning: normalizeReasoning(reasoning),
    suggestions: toStringArray(suggestions),
    timestamp: Date.now(),
    error,
  };
}

function getSeverityRisk(severity) {
  const normalized = toSafeString(severity).toLowerCase();
  if (normalized === "critical" || normalized === "high") return "high";
  if (normalized === "medium") return "medium";
  return "low";
}

function buildClarifyingQuestions(primaryCrime, firstQuestion) {
  const crimeLabel = toSafeString(primaryCrime?.name || "this incident");
  const defaults = [
    `Where did this happen? (app/website/account — e.g., ${crimeLabel})`,
    "What exactly happened step-by-step? (call, message, link, login change, payment request)",
    "Did you click any link, install an app, or share an OTP/password/PIN?",
    "Do you still have access, or did someone change your password/phone/email?",
    "Was any money or data lost? Mention amount/time if yes.",
    "What proof do you have right now? (screenshots, alerts, transaction IDs, caller IDs)",
  ];

  const questions = [
    toSafeString(firstQuestion?.question).trim(),
    ...defaults,
  ].filter(Boolean);

  const unique = Array.from(new Set(questions));
  if (unique.length < 3) {
    unique.push(
      "When did this start and how did the other side contact you?",
      "Did you share any sensitive info or approve a request?",
      "Do you have any screenshots or alerts saved?"
    );
  }

  return unique.slice(0, MAX_CLARIFYING_QUESTIONS);
}

function buildPatternInsights(crimeLabel) {
  const label = toSafeString(crimeLabel).toLowerCase();

  if (/hack|unauthorized|access|account/.test(label)) {
    return {
      howItHappens: [
        "Attackers use stolen or reused passwords, phishing login pages, or OTP interception to enter the account.",
        "They trigger password resets, change recovery email/phone, and lock the real user out.",
        "Once inside, they impersonate the victim to message contacts, post content, or demand money.",
      ],
      mistakes: [
        "Sharing OTPs/reset links or tapping suspicious login prompts.",
        "Ignoring security emails about new devices or password changes.",
        "Reusing the same password across apps without 2FA enabled.",
      ],
      safeguards: [
        "Reset the password from a trusted device and enable 2FA immediately.",
        "Remove unknown devices/sessions and revoke third-party app access.",
        "Update recovery email/phone and monitor login alerts for the next 48 hours.",
      ],
    };
  }

  if (/fraud|scam|upi|payment|bank|transaction|wallet/.test(label)) {
    return {
      howItHappens: [
        "Fraudsters impersonate officials/support or send fake payment links/QRs to make you authorize transfers.",
        "They rush the victim with urgency (account blocked, prize, job task) to push OTP/PIN approvals.",
        "Money moves via UPI collect requests, card not present transactions, or net banking once credentials are exposed.",
      ],
      mistakes: [
        "Approving collect requests or sharing OTP/PIN/CVV with callers or on forms.",
        "Clicking shortened/unknown links and installing screen-sharing apps.",
        "Delaying bank/blocking steps after the first suspicious debit.",
      ],
      safeguards: [
        "Block cards/UPI immediately, raise a written dispute with the bank, and file on cybercrime.gov.in.",
        "Never approve UPI collect requests you did not initiate; verify URLs before paying.",
        "Keep SMS/email alerts on and set low transaction limits.",
      ],
    };
  }

  if (/phish|otp|kyc|link|spoof/i.test(label)) {
    return {
      howItHappens: [
        "Victims receive fake KYC/verification links or spoofed domains that capture passwords and OTPs.",
        "Attackers mirror official branding and send urgent expiry/verification messages.",
        "Stolen credentials are reused quickly across email, banking, or social accounts.",
      ],
      mistakes: [
        "Opening links from SMS/WhatsApp/email without checking the domain.",
        "Typing passwords or OTPs on pages that were not opened manually from the official site/app.",
        "Skipping 2FA and not reviewing recent login alerts.",
      ],
      safeguards: [
        "Manually type official URLs or use saved bookmarks; avoid links in unsolicited messages.",
        "Enable 2FA on email and primary accounts so stolen passwords alone fail.",
        "Report and block the sender; capture headers/URLs for evidence.",
      ],
    };
  }

  if (/data|privacy|leak|breach/.test(label)) {
    return {
      howItHappens: [
        "Personal data is exposed through compromised accounts, misconfigured sharing, or malicious insiders.",
        "Links/files with sensitive info are forwarded without consent or stored in insecure cloud folders.",
        "Attackers may use leaked data for impersonation, blackmail, or financial fraud.",
      ],
      mistakes: [
        "Storing IDs/photos in public/shared folders without access controls.",
        "Reusing passwords and not revoking access for ex-employees/third parties.",
        "Deleting evidence (logs, emails) before backing it up securely.",
      ],
      safeguards: [
        "Rotate passwords/keys, tighten sharing permissions, and enable download/view limits.",
        "Notify affected parties, request takedowns, and preserve logs/screenshots for legal action.",
        "File under the DPDP Act for personal data misuse where applicable.",
      ],
    };
  }

  return {
    howItHappens: [
      "Cyber incidents often start with social engineering (calls, messages, fake links) or reused credentials.",
      "Attackers then gain access to accounts/devices and pivot to steal money or data.",
      "Delays in responding give attackers time to lock you out or erase traces.",
    ],
    mistakes: [
      "Sharing OTPs/PINs/passwords, especially under pressure or from unknown links.",
      "Not turning on 2FA or ignoring unusual login/payment alerts.",
      "Failing to collect screenshots/IDs before deleting chats or emails.",
    ],
    safeguards: [
      "Enable 2FA everywhere and use unique passwords via a password manager.",
      "Verify callers/links independently and avoid approving unexpected requests.",
      "Keep evidence safe (screenshots, URLs, caller IDs, transaction IDs) before contacting authorities.",
    ],
  };
}

function buildLegalDetails(verdict, crimeData, crimeLabel) {
  const itActSections = (verdict?.legal_sections?.it_act || crimeData?.it_act_sections || [])
    .map((section) =>
      section?.section
        ? `IT Act Section ${section.section} - ${section.title}`
        : null
    )
    .filter(Boolean);

  const ipcSections = (verdict?.legal_sections?.ipc || crimeData?.ipc_sections || [])
    .map((section) =>
      section?.section
        ? `IPC Section ${section.section} - ${section.title}`
        : null
    )
    .filter(Boolean);

  const extras = Array.isArray(verdict?.legal_sections?.other_legal_references)
    ? verdict.legal_sections.other_legal_references.filter(Boolean)
    : [];

  const lowerLabel = toSafeString(crimeLabel).toLowerCase();
  if (/data|privacy|leak/.test(lowerLabel)) {
    extras.push("Digital Personal Data Protection (DPDP) Act, 2023 for personal data misuse.");
  }
  if (/health|medical/.test(lowerLabel)) {
    extras.push("HIPAA/health-data rules may apply if a covered entity handled the data.");
  }

  const lines = [
    itActSections.length ? `- ${itActSections.join("; ")}` : null,
    ipcSections.length ? `- ${ipcSections.join("; ")}` : null,
    extras.length ? `- ${extras.join("; ")}` : null,
  ].filter(Boolean);

  return lines.join("\n") || "Applicable sections will be determined by the investigating agency.";
}

function buildStructuredReportTemplate(crimeLabel) {
  const label = toSafeString(crimeLabel) || "the incident";
  return [
    `Platform/app + username/account ID (e.g., ${label}) and linked phone/email.`,
    "Timeline: when it started, how contact happened (call/SMS/email/link/app), and key timestamps.",
    "What exactly happened and what you shared (OTP/password/ID docs/screenshare approvals).",
    "Impact: money lost, data leaked, impersonation attempts, or account changes observed.",
    "Evidence: screenshots of chats/emails/links, caller IDs, URLs/domains, transaction/reference IDs, device info.",
    "Actions taken so far: password reset, 2FA enabled, bank dispute/1930 call, platform support ticket/FIR/DD entry.",
    "Suspect handles/links/numbers and any witnesses or system alerts received.",
  ];
}

function buildSafetySteps(crimeLabel, immediateActions = []) {
  if (immediateActions.length > 0) {
    return immediateActions;
  }

  if (/hack|unauthorized|access|account/i.test(toSafeString(crimeLabel))) {
    return [
      "Reset password from a safe device, enable 2FA, and log out all active sessions.",
      "Revoke unknown app permissions and update recovery email/phone.",
      "Capture screenshots of alerts/messages and keep them with timestamps.",
    ];
  }

  if (/fraud|payment|upi|bank|transaction/i.test(toSafeString(crimeLabel))) {
    return [
      "Call your bank/1930 to block cards/UPI immediately and raise a dispute ticket.",
      "File a complaint on cybercrime.gov.in with transaction IDs and screenshots.",
      "Do not approve any further requests or share new OTPs/PINs.",
    ];
  }

  return [
    "Preserve evidence (screenshots, URLs, caller IDs) before deleting anything.",
    "Enable 2FA and rotate passwords for linked accounts.",
    "Report on cybercrime.gov.in and to the relevant platform/bank with proof.",
  ];
}

function buildCrimeEducationText({
  crimeLabel,
  riskLabel,
  crimeDescription,
  patterns,
  legalDetails,
  safetySteps,
  reportTemplate,
  evidenceNote,
}) {
  const sections = [
    `# **Incident Brief**\n- Detected as: ${crimeLabel}\n- Risk: ${riskLabel || "medium"}${evidenceNote ? `\n- Evidence noted: ${evidenceNote}` : ""}`,
    `## **How this typically happens**\n${patterns.howItHappens.map((entry, idx) => `${idx + 1}. ${entry}`).join("\n")}`,
    `## **Common mistakes to avoid**\n${patterns.mistakes.map((entry, idx) => `${idx + 1}. ${entry}`).join("\n")}`,
    `## **Safeguard tips**\n${patterns.safeguards.map((entry, idx) => `${idx + 1}. ${entry}`).join("\n")}`,
    `## **Legal info (IT Act / IPC / applicable laws)**\n${legalDetails}`,
    `## **Steps to secure yourself now**\n${safetySteps.map((entry, idx) => `${idx + 1}. ${entry}`).join("\n")}`,
    `## **Structured report format**\n${reportTemplate.map((entry, idx) => `${idx + 1}. ${entry}`).join("\n")}`,
  ];

  const trimmed = sections.filter(Boolean);
  if (crimeDescription) {
    trimmed.splice(1, 0, `**What happened (summary):** ${crimeDescription}`);
  }

  return trimmed.join("\n\n");
}

function isExplanationIntent(message) {
  return /\b(why|how|explain|reason|result|classification|verdict|not crime|law|legal|it act|ipc|dpdp)\b/i.test(message);
}

function isResetIntent(message) {
  return /\b(new case|start over|reset|another issue|different issue)\b/i.test(message);
}

// Check if message is completely unrelated to cybercrime
function isOutOfScopeQuestion(message) {
  const lowerMsg = message.toLowerCase();

  // Cyber-related keywords - if present, NOT out of scope
  const cyberKeywords = /\b(hack|hacked|hacking|account|password|otp|money|bank|upi|payment|fraud|scam|phishing|link|email|sms|call|app|malware|virus|data|leak|steal|stolen|threat|blackmail|sextortion|photo|video|online|internet|website|social media|facebook|instagram|whatsapp|telegram|cyber|digital|computer|phone|mobile|transaction|transfer|login|access|unauthorized)\b/i;

  // If contains cyber keywords, it's not out of scope
  if (cyberKeywords.test(message)) {
    return false;
  }

  // Common out-of-scope patterns (physical issues, general questions, greetings)
  const outOfScopePatterns = /\b(leg|arm|hand|head|body|broken|injury|injured|hospital|doctor|medicine|fever|cold|sick|weather|food|recipe|movie|song|cricket|football|game|homework|exam|school|college|hello|hi|hey|good morning|good night|how are you|what's up|who are you|tell me about yourself|joke|funny|laugh|story|poem)\b/i;

  return outOfScopePatterns.test(message);
}

// Build response for out-of-scope questions
function buildOutOfScopeResponse() {
  return {
    text: "I am not a general purpose AI. I am a **Smart AI built specifically to guide you on Cybercrime matters**.\n\nPlease describe a cyber-related issue such as:\n- Online fraud or money theft\n- Account hacking\n- Phishing/scam messages\n- Blackmail or threats online\n- Data theft or privacy issues",
    classification: {
      type: "OUT_OF_SCOPE",
      confidence: 100,
    },
    suggestions: [
      "Money taken from my account",
      "My account was hacked",
      "Got a suspicious link",
    ],
  };
}

function isNewIncidentDetected(message, currentCrimeType) {
  // Detect if user is describing a completely different incident
  const moneyRelated = /\b(money|paise|paisa|amount|rupee|transaction|payment|bank|account|debit|credit|transfer|upi|phonepe|gpay|paytm)\b/i.test(message);
  const photoRelated = /\b(photo|photos|picture|pictures|image|images|video|videos|leaked|leak|nude|private|intimate|blackmail|extortion|sextortion)\b/i.test(message);
  const accountRelated = /\b(account|login|password|hacked|hack|access|unauthorized|compromise|instagram|facebook|whatsapp|email|gmail|social media)\b/i.test(message);

  const currentIsMoneyFraud = /financial|payment|fraud|money|transaction/i.test(currentCrimeType || "");
  const currentIsPhotoLeak = /sextortion|photo|leak|blackmail/i.test(currentCrimeType || "");
  const currentIsAccountHack = /account|hacking|unauthorized access/i.test(currentCrimeType || "");

  // If talking about photos but current case is money fraud → NEW INCIDENT
  if (photoRelated && !moneyRelated && currentIsMoneyFraud) {
    return true;
  }

  // If talking about money but current case is photo leak → NEW INCIDENT
  if (moneyRelated && !photoRelated && currentIsPhotoLeak) {
    return true;
  }

  // If talking about account hack but current case is money → NEW INCIDENT
  if (accountRelated && !moneyRelated && !photoRelated && currentIsMoneyFraud) {
    return true;
  }

  return false;
}

function buildClassificationReasoning(classification, incidentText) {
  const primaryCrime = classification?.suspected_crimes?.[0] || null;
  const topLabel = primaryCrime?.name || classification?.not_crime_data?.scenario_name || "current category";

  if (classification?.classification_type === "NOT_CRIME") {
    const whyNotCrime =
      classification?.not_crime_data?.detection_logic?.if_voluntary?.why_not_crime ||
      classification?.not_crime_data?.detection_logic?.if_platform_action?.why_not_crime ||
      classification?.not_crime_data?.detection_logic?.response?.why_not_crime ||
      [];

    return {
      summary: `This is currently being treated as **not a cybercrime** because it matches **${topLabel}** more than a hacking, phishing, or fraud pattern.`,
      matchedSignals: ["The report currently aligns more with a known non-crime or consumer scenario."],
      missingSignals: toStringArray(whyNotCrime),
      whatWouldChange: [
        "If there was unauthorized access, impersonation, phishing, or money moved without your approval, this should be re-evaluated.",
      ],
    };
  }

  if (classification?.classification_type === "CRIME") {
    return {
      summary: `This is currently being treated as **${topLabel}** because your report contains cyber-risk signals that match that incident pattern.`,
      matchedSignals: [
        incidentText,
        ...((classification?.suspected_crimes || []).slice(0, 2).map((item) => item.name)),
      ].filter(Boolean).slice(0, 3),
      missingSignals: [],
      whatWouldChange: [
        "The verdict can still change if your next answers show this was voluntary, unrelated, or a different cybercrime pattern.",
      ],
    };
  }

  if (classification?.classification_type === "OUT_OF_SCOPE") {
    return {
      summary: "This was treated as out of scope because the current report does not yet show a clear cyber element.",
      matchedSignals: [],
      missingSignals: ["No clear money-loss, account compromise, or suspicious-link signal has been confirmed yet."],
      whatWouldChange: [
        "Mention if money was taken digitally, an account was accessed, or a suspicious link/message was involved.",
      ],
    };
  }

  return {
    summary: "The system needs one more concrete detail before it can classify this properly.",
    matchedSignals: [],
    missingSignals: ["The report is still too general for a reliable cyber classification."],
    whatWouldChange: [
      "Describe whether this involved money loss, account access, or a suspicious link/message.",
    ],
  };
}

function buildCrimeIntroResponse(classification, incidentText) {
  const primaryCrime = classification?.suspected_crimes?.[0] || null;
  const firstQuestion = classification?.first_question || null;
  const crimeLabel = primaryCrime?.name || "a cyber incident";
  const confidence = Math.round(classification?.confidence || 0);
  const clarifyingQuestions = buildClarifyingQuestions(primaryCrime, firstQuestion);
  const introLine =
    confidence >= 85
      ? `Based on what you've told me, this appears to be **${crimeLabel}**. I'm quite confident about this (${confidence}% confidence).`
      : confidence >= 65
        ? `Based on what you've told me, this appears to be **${crimeLabel}**. I'm fairly confident about this (${confidence}% confidence).`
        : `Based on what you've told me, this appears to be **${crimeLabel}**. This seems likely from your report (${confidence}% confidence).`;

  const questionBlock = clarifyingQuestions
    .map((question, idx) => `${idx + 1}. ${question}`)
    .join("\n");

  return {
    text: `${introLine}\n\nI need a few quick answers to understand the crime clearly (brief bullet replies are fine):\n${questionBlock}`,
    classification: {
      type: "CRIME",
      confidence,
      crimeType: crimeLabel,
      risk: getSeverityRisk(primaryCrime?.severity),
    },
    suggestions: firstQuestion?.options || ["I'll answer these questions", "What should I do now?", "How serious is this?", "How did you decide this?"],
  };
}

function buildNotCrimeResponse(classification, incidentText) {
  const notCrimeName = classification?.not_crime_data?.scenario_name || "a consumer or civil issue";

  return {
    text:
      `Good news! From what you've described, this currently looks more like **${notCrimeName}** than a cybercrime. ` +
      "This seems closer to a consumer, civil, or voluntary-action issue right now. " +
      "If there was unauthorized access, phishing, impersonation, or money moved without your approval, tell me that and I will reassess it.",
    classification: {
      type: "NOT_CRIME",
      confidence: Math.round(classification?.confidence || 0),
    },
    suggestions: [
      "Why is this not crime?",
      "There was unauthorized access",
      "I was tricked by a fake caller or link",
    ],
  };
}

function buildUnclearResponse(classification, incidentText) {
  return {
    text:
      "I understand you're concerned about something, but I need a bit more context to help you properly. " +
      "Tell me whether this involved money loss, account access, or a suspicious message or link.",
    classification: {
      type:
        classification?.classification_type === "OUT_OF_SCOPE"
          ? "OUT_OF_SCOPE"
          : "NEEDS_MORE_INFO",
      confidence: Math.round(classification?.confidence || 0),
    },
    suggestions: [
      "Money was stolen from my account",
      "Someone logged into my account",
      "I got a suspicious link",
    ],
  };
}

function buildDetailedNarrativeQuestion(classification) {
  const crimeType = classification?.suspected_crimes?.[0]?.name || "this cyber incident";

  return {
    text: `I've identified this as potentially **${crimeType}**. Before I can provide a complete legal analysis, I need you to:\n\n**Explain what happened with you in detail** - Share the complete story from start to finish. Include:\n- How did it start? (Call, SMS, email, app, website?)\n- What exactly happened step by step?\n- What information did you share? (OTP, card details, passwords?)\n- When did you realize something was wrong?\n- How much money was lost (if applicable)?\n\nThis detailed narrative is crucial for proper legal classification under IT Act and IPC.`,
    classification: {
      type: "CRIME",
      confidence: Math.round(classification?.confidence || 0),
      crimeType: classification?.suspected_crimes?.[0]?.name || "Cyber incident",
      risk: getSeverityRisk(classification?.suspected_crimes?.[0]?.severity),
    },
    suggestions: [
      "Let me explain what happened in detail",
      "I'll describe the complete incident",
    ],
  };
}

function buildEvidenceCollectionQuestion(classification, crimeData) {
  const evidenceList = crimeData?.evidence_to_collect || crimeData?.evidence_required || [
    "Transaction screenshots",
    "SMS/Email screenshots",
    "Call recordings or caller ID",
    "Chat screenshots",
    "Bank statements"
  ];

  const evidenceText = evidenceList.slice(0, 5).map((item, idx) => `${idx + 1}. ${item}`).join("\n");

  return {
    text: `Thank you for the detailed explanation. Now, **do you have any proof or evidence?**\n\n**Important Evidence Needed:**\n${evidenceText}\n\n**Question:** What evidence do you currently have? Without proof, filing a complaint may be difficult, and the case might not proceed to court.\n\nPlease tell me what proof you have collected or can collect.`,
    classification: {
      type: "CRIME",
      confidence: Math.round(classification?.confidence || 0),
      crimeType: classification?.suspected_crimes?.[0]?.name || "Cyber incident",
      risk: getSeverityRisk(classification?.suspected_crimes?.[0]?.severity),
    },
    suggestions: [
      "I have screenshots and transaction details",
      "I have some evidence but not everything",
      "I don't have any proof yet",
      "What proof do I need to collect?",
    ],
  };
}

function buildEnhancedVerdictWithLegalExplanation(verdictResponse, classification, crimeData, userNarrative, userEvidence) {
  const verdict = verdictResponse?.verdict || {};
  const isCrime = verdict.verdict_type === "CONFIRMED_CYBERCRIME";
  const legalPosition = verdict.legal_position || {};
  const crimeLabel = classification?.suspected_crimes?.[0]?.name || "a cyber incident";
  const riskLabel = toSafeString(verdict.risk).toLowerCase() || getSeverityRisk(classification?.suspected_crimes?.[0]?.severity);
  const crimeDescription = crimeData?.description || toSafeString(legalPosition.summary) || `This involves ${crimeLabel}.`;
  const patterns = buildPatternInsights(crimeLabel);
  const legalDetails = buildLegalDetails(verdict, crimeData, crimeLabel);
  const safetySteps = buildSafetySteps(crimeLabel, (verdict.immediate_actions || crimeData?.immediate_actions || []).slice(0, 4));
  const reportTemplate = buildStructuredReportTemplate(crimeLabel);

  return {
    text: isCrime
      ? buildCrimeEducationText({
          crimeLabel,
          riskLabel,
          crimeDescription,
          patterns,
          legalDetails,
          safetySteps,
          reportTemplate,
          evidenceNote: userEvidence || "Evidence collection ongoing",
        })
      : `# **ANALYSIS RESULT**\n\n` +
        `Based on your description, this currently looks more like **${verdict.subtitle || "a non-cybercrime issue"}**.\n\n` +
        `${toSafeString(legalPosition.summary) || "The current facts do not fit the legal pattern of hacking, phishing, impersonation, or unauthorized digital access."}\n\n` +
        `Recommended route: ${(verdict.immediate_actions || crimeData?.immediate_actions || []).slice(0, 3).map((action, idx) => `${idx + 1}. ${action}`).join(" | ") || "Use consumer, bank, or platform grievance route first."}`,
    classification: {
      type: isCrime ? "CRIME" : "NOT_CRIME",
      confidence: Math.max(
        Math.round(classification?.confidence || 0),
        isCrime ? 90 : 75,
      ),
      ...(isCrime
        ? {
            crimeType: crimeLabel,
            risk: riskLabel,
          }
        : {}),
    },
    suggestions: isCrime
      ? ["What should I do right now?", "How to file complaint?", "Start a new case"]
      : ["Why is this not crime?", "What would make this a cybercrime?", "Start a new case"],
  };
}

function buildFinalVerdictResponse(verdictResponse, fallbackClassification) {
  const verdict = verdictResponse?.verdict || {};
  const isCrime = verdict.verdict_type === "CONFIRMED_CYBERCRIME";
  const legalPosition = verdict.legal_position || {};
  const crimeLabel = verdict.subtitle || fallbackClassification?.crimeType || "a cyber incident";
  const riskLabel = toSafeString(verdict.risk).toLowerCase() || getSeverityRisk(fallbackClassification?.risk);
  const patterns = buildPatternInsights(crimeLabel);
  const legalDetails = buildLegalDetails(verdict, null, crimeLabel);
  const safetySteps = buildSafetySteps(crimeLabel, (verdict.immediate_actions || verdict.your_options || []).slice(0, 4));
  const reportTemplate = buildStructuredReportTemplate(crimeLabel);
  const crimeDescription = toSafeString(legalPosition.summary) || `This is being treated as ${crimeLabel}.`;

  return {
    text: isCrime
      ? buildCrimeEducationText({
          crimeLabel,
          riskLabel,
          crimeDescription,
          patterns,
          legalDetails,
          safetySteps,
          reportTemplate,
        })
      : `Based on your answers, this currently looks more like **${verdict.subtitle || "a non-cyber issue"}** than a cybercrime.\n\n` +
        `${toSafeString(legalPosition.summary) || "On the current facts, this does not yet fit the legal pattern of hacking, phishing, impersonation, or unauthorized digital access."}\n\n` +
        `Recommended route: ${(verdict.immediate_actions || verdict.your_options || []).slice(0, 3).join(" | ") || "use the consumer, bank, or platform grievance route first"}.`,
    classification: {
      type: isCrime ? "CRIME" : "NOT_CRIME",
      confidence: Math.max(
        Math.round(fallbackClassification?.confidence || 0),
        isCrime ? 85 : 72,
      ),
      ...(isCrime
        ? {
            crimeType: crimeLabel,
            risk: riskLabel || "medium",
          }
        : {}),
    },
    suggestions: isCrime
      ? ["What should I do right now?", "What evidence should I keep?", "Start a new case"]
      : ["Why is this not crime?", "What would change this result?", "Start a new case"],
  };
}

const CyberSmartChat = ({ currentUser, onNewCase, onError }) => {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [caseState, setCaseState] = useState(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = currentUser?.name || currentUser?.fullName || "there";

    if (hour < 5) return `Late night guarding, ${name}`;
    if (hour < 12) return `Good morning, ${name}`;
    if (hour < 17) return `Good afternoon, ${name}`;
    if (hour < 21) return `Good evening, ${name}`;
    return `Working late, ${name}`;
  };

  const categories = [
    { label: "Financial Fraud", example: "Money taken from my account" },
    { label: "Account Security", example: "My account was hacked" },
    { label: "Phishing & Scams", example: "Got a suspicious email" },
    { label: "Malware & Viruses", example: "My computer is infected" },
    { label: "Mobile Security", example: "Strange app behavior" },
    { label: "General Threat", example: "Something feels suspicious" },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  async function runStatefulFallback(message) {
    // Check if user is describing a completely different incident
    const shouldResetCase = caseState && isNewIncidentDetected(message, caseState.categoryTitle || caseState.classification?.suspected_crimes?.[0]?.name);

    if (shouldResetCase) {
      console.log("🔄 New incident detected - resetting case state");
      setCaseState(null); // Reset case but continue to process as new
      // Fall through to process as fresh classification
    } else if (caseState?.pendingQuestion) {
      if (isExplanationIntent(message)) {
        const classification = caseState.classification;
        const reasoning = buildClassificationReasoning(classification, caseState.incidentText);
        return buildAssistantMessage({
          text:
            `${reasoning.summary} ` +
            `I still need this next detail: **${caseState.pendingQuestion.question}**`,
          classification: {
            type: "CRIME",
            confidence: Math.round(classification?.confidence || 0),
            crimeType: classification?.suspected_crimes?.[0]?.name || "Cyber incident",
            risk: getSeverityRisk(classification?.suspected_crimes?.[0]?.severity),
          },
          reasoning,
          suggestions: caseState.pendingQuestion.options || [],
        });
      }

      // Only proceed with normal flow if NOT a new incident
      if (!shouldResetCase) {
        // Special handling for narrative and evidence questions
      if (caseState.pendingQuestion.question_id === DETAILED_NARRATIVE_QUESTION_ID) {
        setCaseState((current) => ({
          ...current,
          userNarrative: message,
          detailedNarrativeProvided: true,
          pendingQuestion: {
            question_id: EVIDENCE_QUESTION_ID,
            question: "Evidence collection",
            step: -1,
          },
        }));

        return buildAssistantMessage(buildEvidenceCollectionQuestion(caseState.classification, caseState.crimeData));
      }

      if (caseState.pendingQuestion.question_id === EVIDENCE_QUESTION_ID) {
        setCaseState((current) => ({
          ...current,
          userEvidence: message,
          evidenceCollected: true,
          pendingQuestion: null,
        }));

        // Now build the enhanced verdict with full legal explanation
        const answerMap = Object.fromEntries(
          caseState.answers.map((item) => [item.questionId, item.answer]),
        );
        const compiledText = [
          caseState.incidentText,
          ...caseState.answers.map((item) => `${item.question}: ${item.answer}`),
          `Detailed narrative: ${message}`,
          `Evidence: ${caseState.userEvidence}`,
        ].join("\n");

        const verdictResponse = await getVerdict(
          caseState.crimeId,
          compiledText,
          answerMap,
          caseState.caseId || null,
        );

        setCaseState((current) => ({
          ...current,
          verdict: verdictResponse,
        }));

        return buildAssistantMessage(
          buildEnhancedVerdictWithLegalExplanation(
            verdictResponse,
            caseState.classification,
            caseState.crimeData,
            caseState.userNarrative,
            message
          )
        );
      }

      const nextAnswers = [...caseState.answers, {
        questionId: caseState.pendingQuestion.question_id,
        question: caseState.pendingQuestion.question,
        answer: message,
      }];

      const answerMap = Object.fromEntries(
        nextAnswers.map((item) => [item.questionId, item.answer]),
      );
      const compiledText = [
        caseState.incidentText,
        ...nextAnswers.map((item) => `${item.question}: ${item.answer}`),
      ].join("\n");

      if (nextAnswers.length >= MAX_FOLLOW_UP_QUESTIONS) {
        // After standard questions, ask for detailed narrative
        setCaseState((current) => ({
          ...current,
          answers: nextAnswers,
          pendingQuestion: {
            question_id: DETAILED_NARRATIVE_QUESTION_ID,
            question: "Detailed narrative needed",
            step: -1,
          },
        }));

        return buildAssistantMessage(buildDetailedNarrativeQuestion(caseState.classification));
      }

      const nextQuestionResponse = await getNextQuestion(
        caseState.crimeId,
        Number(caseState.pendingQuestion.step || 0) + 1,
        compiledText,
        message,
      );

      if (!nextQuestionResponse.done && nextQuestionResponse.question_id) {
        setCaseState((current) => ({
          ...current,
          answers: nextAnswers,
          pendingQuestion: nextQuestionResponse,
        }));

        return buildAssistantMessage({
          text: `Understood. I have kept this in the same case. Next, I need to confirm: **${nextQuestionResponse.question}**`,
          classification: {
            type: "CRIME",
            confidence: Math.round(caseState.classification?.confidence || 0),
            crimeType: caseState.classification?.suspected_crimes?.[0]?.name || "Cyber incident",
            risk: getSeverityRisk(caseState.classification?.suspected_crimes?.[0]?.severity),
          },
          suggestions: nextQuestionResponse.options || [],
        });
      }

      const verdictResponse = await getVerdict(
        caseState.crimeId,
        compiledText,
        answerMap,
        caseState.caseId || null,
      );

      setCaseState((current) => ({
        ...current,
        answers: nextAnswers,
        pendingQuestion: null,
        verdict: verdictResponse,
      }));

      return buildAssistantMessage(
        buildFinalVerdictResponse(verdictResponse, {
          confidence: caseState.classification?.confidence,
          crimeType: caseState.classification?.suspected_crimes?.[0]?.name,
        }),
      );
      }
    }

    if (caseState && isExplanationIntent(message)) {
      const verdictReasoning =
        caseState.verdict?.verdict?.decision_reasoning ||
        buildClassificationReasoning(caseState.classification, caseState.incidentText);
      const legalPosition = caseState.verdict?.verdict?.legal_position || null;
      const legalRefs = [
        ...((caseState.verdict?.verdict?.legal_sections?.it_act || []).map((entry) =>
          entry?.section ? `IT Act ${entry.section}` : null,
        )),
        ...((caseState.verdict?.verdict?.legal_sections?.ipc || []).map((entry) =>
          entry?.section ? `IPC ${entry.section}` : null,
        )),
        ...((caseState.verdict?.verdict?.other_legal_references || []).filter(Boolean)),
      ]
        .filter(Boolean)
        .slice(0, 4);
      const explanationText = [
        verdictReasoning?.summary || "This is the current decision summary for your case.",
        legalPosition?.summary || null,
        legalRefs.length ? `Relevant legal route: ${legalRefs.join(" | ")}.` : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      return buildAssistantMessage({
        text: explanationText,
        classification: {
          type:
            caseState.verdict?.verdict?.verdict_type === "CONFIRMED_CYBERCRIME"
              ? "CRIME"
              : caseState.classification?.classification_type === "NOT_CRIME"
                ? "NOT_CRIME"
                : "CRIME",
          confidence: Math.round(caseState.classification?.confidence || 0),
          crimeType: caseState.classification?.suspected_crimes?.[0]?.name || undefined,
          risk: getSeverityRisk(caseState.classification?.suspected_crimes?.[0]?.severity),
        },
        reasoning: verdictReasoning,
        suggestions: caseState.pendingQuestion?.options || ["What law applies here?", "Start a new case"],
      });
    }

    const directChatResponse = await chatSendMessage(message, currentUser?.id);
    if (!directChatResponse?.fallback) {
      // If backend returned crime data, initialize with it
      if (directChatResponse.crimeData && directChatResponse.classification?.type === "CRIME") {
        setCaseState({
          incidentText: message,
          caseId: directChatResponse.caseId || null,
          crimeId: null,
          classification: directChatResponse.classification,
          answers: [],
          pendingQuestion: null,
          verdict: directChatResponse.verdict || null,
          detailedNarrativeProvided: false,
          evidenceCollected: false,
          userNarrative: "",
          userEvidence: "",
          crimeData: directChatResponse.crimeData,
        });
      }
      return buildAssistantMessage(directChatResponse);
    }

    const classification = await classifyIncident(message);

    if (classification?.classification_type === "CRIME") {
      // Fetch detailed crime data
      let crimeData = null;
      if (classification.top_crime_id) {
        try {
          crimeData = await getCrimeDetails(classification.top_crime_id);
        } catch (error) {
          console.warn("Could not fetch crime details:", error);
        }
      }

      setCaseState({
        incidentText: message,
        caseId: directChatResponse.caseId || null,
        crimeId: classification.top_crime_id || null,
        classification,
        answers: [],
        pendingQuestion: classification.first_question || null,
        verdict: null,
        detailedNarrativeProvided: false,
        evidenceCollected: false,
        userNarrative: "",
        userEvidence: "",
        crimeData: crimeData,
      });

      return buildAssistantMessage(buildCrimeIntroResponse(classification, message));
    }

    if (classification?.classification_type === "NOT_CRIME") {
      setCaseState({
        incidentText: message,
        caseId: null,
        crimeId: classification.top_not_crime_id || null,
        classification,
        answers: [],
        pendingQuestion: null,
        verdict: null,
      });

      return buildAssistantMessage(buildNotCrimeResponse(classification, message));
    }

    setCaseState({
      incidentText: message,
      caseId: null,
      crimeId: null,
      classification,
      answers: [],
      pendingQuestion: null,
      verdict: null,
    });

    return buildAssistantMessage(buildUnclearResponse(classification, message));
  }

  const handleSendMessage = async (text = inputValue) => {
    const cleanText = toSafeString(text).trim();
    if (!cleanText || isLoading) {
      return;
    }

    // Check for reset intent first
    if (isResetIntent(cleanText)) {
      setInputValue("");
      setCaseState(null);
      setMessages((prev) => [
        ...prev,
        { role: "user", content: cleanText, timestamp: Date.now() },
        buildAssistantMessage({
          text: "Starting a fresh case now. Describe the new cyber incident and I will begin again.",
          classification: { type: "INFO", confidence: 0 },
          suggestions: categories.map((category) => category.example),
        }),
      ]);
      return;
    }

    // Check for out-of-scope/irrelevant questions
    if (isOutOfScopeQuestion(cleanText)) {
      setInputValue("");
      setMessages((prev) => [
        ...prev,
        { role: "user", content: cleanText, timestamp: Date.now() },
        buildAssistantMessage(buildOutOfScopeResponse()),
      ]);
      return;
    }

    setInputValue("");
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: cleanText,
        timestamp: Date.now(),
      },
    ]);
    setIsLoading(true);

    try {
      const aiMessage = await runStatefulFallback(cleanText);
      setMessages((prev) => [...prev, aiMessage]);
      if (caseState?.caseId) {
        onNewCase?.(caseState.caseId, caseState.incidentText);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        buildAssistantMessage({
          text: "I'm having trouble processing your request right now. Please try again in a moment.",
          error: true,
        }),
      ]);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Reset chat to start fresh
  const handleNewCase = () => {
    setMessages([]);
    setCaseState(null);
    setInputValue("");
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const shouldShowConversation = messages.length > 0 || isLoading;

  if (!shouldShowConversation) {
    return (
      <div className="cyber-chat-container">
        <div className="cyber-landing">
          <div className="cyber-header">
            <div className="cyber-shield-icon">
              <div className="shield-inner">CS</div>
              <div className="shield-pulse"></div>
            </div>
            <h1 className="cyber-greeting">{getGreeting()}</h1>
            <span className="cyber-model-badge">
              <span className="badge-dot"></span>
              CyberSmart AI 4.6
            </span>
          </div>

          <div className="cyber-input-section">
            <div className="cyber-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Describe your cybersecurity concern..."
                className="cyber-main-input"
                disabled={isLoading}
                autoFocus
              />
              <button
                onClick={() => handleSendMessage()}
                className="cyber-send-btn"
                disabled={!inputValue.trim() || isLoading}
              >
                <span className="send-icon">→</span>
              </button>
            </div>
          </div>

          <div className="cyber-categories">
            <div className="categories-grid">
              {categories.map((category) => (
                <button
                  key={category.label}
                  onClick={() => handleSendMessage(category.example)}
                  className="cyber-category-btn"
                >
                  <span className="category-label">{category.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cyber-chat-container">
      <div className="cyber-chat-header">
        <span className="cyber-model-badge">
          <span className="badge-dot"></span>
          CyberSmart AI 4.6
        </span>
        <button
          onClick={handleNewCase}
          className="new-case-btn"
          title="Start New Case"
        >
          <span className="new-case-icon">+</span>
          <span className="new-case-text">New Case</span>
        </button>
      </div>

      <div className="cyber-messages-area">
        <div className="messages-container">
          {messages.map((message, index) => {
            const classification = normalizeClassification(message.classification);
            const reasoning = normalizeReasoning(message.reasoning);

            return (
              <div key={`${message.role}-${message.timestamp || index}`} className={`message ${message.role}`}>
                {message.role === "user" ? (
                  <div className="user-message">
                    <div className="message-content">{toSafeString(message.content)}</div>
                  </div>
                ) : (
                  <div className="assistant-message">
                    <div className="message-header">
                      <div className="ai-avatar">AI</div>
                      <span className="ai-name">CyberSmart AI</span>
                      {classification ? (
                        <span
                          className={`classification-badge ${classification.type
                            .toLowerCase()
                            .replace(/[^a-z0-9_]+/g, "_")}`}
                        >
                          {classification.confidence}% confidence
                        </span>
                      ) : null}
                    </div>

                    <div className="message-content">
                      {message.role === "assistant" && message.content.includes("# **")
                        ? parseMarkdownContent(message.content)
                        : toSafeString(message.content)}
                    </div>

                    {reasoning ? (
                      <div className="reasoning-card">
                        {reasoning.summary ? (
                          <p className="reasoning-summary">{reasoning.summary}</p>
                        ) : null}

                        {reasoning.matchedSignals.length ? (
                          <div className="reasoning-section">
                            <strong>Matched signals</strong>
                            <div className="reasoning-chip-list">
                              {reasoning.matchedSignals.map((item) => (
                                <span key={item} className="reasoning-chip">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {reasoning.missingSignals.length ? (
                          <div className="reasoning-section">
                            <strong>Why not another result</strong>
                            <ul className="reasoning-list">
                              {reasoning.missingSignals.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}

                        {reasoning.whatWouldChange.length ? (
                          <div className="reasoning-section">
                            <strong>What would change this</strong>
                            <ul className="reasoning-list">
                              {reasoning.whatWouldChange.map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {Array.isArray(message.suggestions) && message.suggestions.length ? (
                      <div className="message-suggestions">
                        {message.suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleSendMessage(suggestion)}
                            className="suggestion-chip"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}

          {isLoading ? (
            <div className="message assistant">
              <div className="assistant-message">
                <div className="message-header">
                  <div className="ai-avatar">AI</div>
                  <span className="ai-name">CyberSmart AI</span>
                </div>
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          ) : null}

          {!messages.length && isLoading ? (
            <div className="chat-status-placeholder">
              Submitting your report and preparing the first response...
            </div>
          ) : null}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="cyber-chat-input">
        <div className="input-wrapper">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Reply..."
            className="chat-input"
            disabled={isLoading}
            autoFocus
          />
          <button
            onClick={() => handleSendMessage()}
            className="send-button"
            disabled={!inputValue.trim() || isLoading}
          >
            <span className="send-icon">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CyberSmartChat;
