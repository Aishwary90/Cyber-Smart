const { preprocess, countKeywordHits } = require("./tfidf");
const { getAllCategories, getCategoryById } = require("./incidentCatalog");
const { buildCategoryPayload } = require("./categoryPayload");

const ALL_CATEGORIES = getAllCategories();

const CASE_INFO_PATTERNS =
  /\b(law|legal|section|sections|punishment|penalty|ipc|it act|dpdp|evidence|proof|report|complaint|fir|how do i report|how to report|what should i do|next step|what applies)\b/i;
const GENERAL_INFO_PATTERNS =
  /\b(what|which|why|how|explain|meaning|define|difference|about|under which|covered|applicable|applicable law|legal remedy|punishment|penalty|law|legal|section|sections|ipc|it act|dpdp|report|complaint|evidence|proof)\b/i;
const CYBER_INFO_HINTS =
  /\b(cyber|cybercrime|fraud|scam|phishing|upi|bank|account|hack|hacked|hacking|blackmail|sextortion|otp|password|data|privacy|dpdp|it act|ipc|consumer forum|ombudsman|cert-in|1930|cybercrime\.gov)\b/i;
const INCIDENT_NARRATIVE_PATTERNS = [
  /\b(i|my|me|mine|someone|they)\b.{0,50}\b(hacked|scammed|cheated|stole|stolen|lost|received|got|asked|threatened|blackmailed|deducted|debited|transferred|clicked|shared|sent|froze|blocked)\b/i,
  /\b(money|account|upi|bank|email|instagram|facebook|whatsapp|phone|device|data)\b.{0,40}\b(gone|lost|stolen|deducted|debited|hacked|compromised|locked|blocked|leaked|accessed)\b/i,
];

function uniqueStrings(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function countPhraseMatches(text, phrases) {
  const lowerText = String(text || "").toLowerCase();
  const tokens = preprocess(lowerText);

  return phrases.filter((phrase) => {
    const normalized = String(phrase || "").toLowerCase();
    if (!normalized) {
      return false;
    }

    if (lowerText.includes(normalized)) {
      return true;
    }

    const phraseTokens = preprocess(normalized);
    return phraseTokens.length > 0 && phraseTokens.every((token) => tokens.includes(token));
  }).length;
}

function normalizeSection(section) {
  return String(section || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function buildSectionIndex(categories) {
  const index = new Map();

  const ensureEntry = (key, payload) => {
    if (!index.has(key)) {
      index.set(key, {
        ...payload,
        categories: [],
      });
    }

    return index.get(key);
  };

  for (const category of categories) {
    for (const [sourceKey, actLabel] of [
      ["it_act", "IT Act"],
      ["ipc", "IPC"],
    ]) {
      const sections = category?.legal_sections?.[sourceKey] || [];
      for (const sectionEntry of sections) {
        const normalizedSection = normalizeSection(sectionEntry?.section);
        if (!normalizedSection) {
          continue;
        }

        const key = `${sourceKey}:${normalizedSection}`;
        const record = ensureEntry(key, {
          code: String(sectionEntry.section).toUpperCase(),
          act: actLabel,
          title: sectionEntry.title || "",
          penalty: sectionEntry.penalty || sectionEntry.punishment || "",
        });

        if (!record.categories.includes(category.id)) {
          record.categories.push(category.id);
        }
      }
    }
  }

  return index;
}

const SECTION_INDEX = buildSectionIndex(ALL_CATEGORIES);

const CATEGORY_CORPUS = ALL_CATEGORIES.map((category) => {
  const sectionPhrases = uniqueStrings([
    ...(category?.legal_sections?.it_act || []).flatMap((entry) => [
      entry?.section ? `it act ${entry.section}` : null,
      entry?.section ? `section ${entry.section}` : null,
      entry?.title || null,
    ]),
    ...(category?.legal_sections?.ipc || []).flatMap((entry) => [
      entry?.section ? `ipc ${entry.section}` : null,
      entry?.section ? `section ${entry.section}` : null,
      entry?.title || null,
    ]),
  ]);

  return {
    category,
    titleTerms: uniqueStrings([category.title]),
    titleTokenTerms: uniqueStrings(preprocess(category.title || "").filter((token) => token.length > 2)),
    keywordTerms: uniqueStrings(category.keywords || []),
    identifierTerms: uniqueStrings(category.primary_identifiers || []),
    sectionTerms: sectionPhrases,
  };
});

function findSectionMatches(text) {
  const matches = [];
  const regex = /\b(?:(it\s*act|ipc|indian penal code)\s*)?(?:section|sec\.?)?\s*([0-9]{2,3}[a-z]?)\b/gi;
  let match = regex.exec(text);

  while (match) {
    const rawAct = String(match[1] || "").toLowerCase();
    const rawSection = normalizeSection(match[2]);
    const keys = rawAct.includes("ipc")
      ? [`ipc:${rawSection}`]
      : rawAct.includes("it")
        ? [`it_act:${rawSection}`]
        : [`it_act:${rawSection}`, `ipc:${rawSection}`];

    for (const key of keys) {
      const record = SECTION_INDEX.get(key);
      if (record) {
        matches.push(record);
      }
    }

    match = regex.exec(text);
  }

  return uniqueStrings(matches.map((entry) => `${entry.act}:${entry.code}`)).map((key) =>
    matches.find((entry) => `${entry.act}:${entry.code}` === key),
  );
}

function scoreCategoryForKnowledge(text, corpusEntry) {
  const lowerText = String(text || "").toLowerCase();
  const tokens = preprocess(lowerText);
  const titleMatches = countPhraseMatches(lowerText, corpusEntry.titleTerms);
  const titleTokenMatches = countPhraseMatches(lowerText, corpusEntry.titleTokenTerms);
  const keywordMatches = countPhraseMatches(lowerText, corpusEntry.keywordTerms);
  const identifierMatches = countPhraseMatches(lowerText, corpusEntry.identifierTerms);
  const sectionMatches = countPhraseMatches(lowerText, corpusEntry.sectionTerms);
  const keywordHitCount = countKeywordHits(tokens, [
    ...corpusEntry.titleTokenTerms,
    ...corpusEntry.keywordTerms,
    ...corpusEntry.identifierTerms,
    ...corpusEntry.sectionTerms,
  ]).count;

  return (
    titleMatches * 4 +
    titleTokenMatches * 1.6 +
    sectionMatches * 3 +
    identifierMatches * 2.2 +
    keywordMatches * 1.4 +
    keywordHitCount * 0.5
  );
}

function findBestCategoryMatch(text) {
  const ranked = CATEGORY_CORPUS.map((entry) => ({
    category: entry.category,
    score: scoreCategoryForKnowledge(text, entry),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    top: ranked[0] || null,
    ranked,
  };
}

function hasIncidentNarrative(text) {
  return INCIDENT_NARRATIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function looksLikeKnowledgeQuery(text, currentCase) {
  const normalizedText = String(text || "").trim().toLowerCase();
  if (!normalizedText) {
    return false;
  }

  if (currentCase && CASE_INFO_PATTERNS.test(normalizedText)) {
    return true;
  }

  const sectionMatches = findSectionMatches(normalizedText);
  if (sectionMatches.length > 0) {
    return true;
  }

  const bestMatch = findBestCategoryMatch(normalizedText).top;
  const shortInfoShortcut =
    normalizedText.split(/\s+/).length <= 2 &&
    Boolean(bestMatch?.score >= 4.5) &&
    !hasIncidentNarrative(normalizedText) &&
    !/\b(received|clicked|lost|deducted|debited|hacked|scammed|shared|sent|blocked|froze)\b/i.test(normalizedText);
  const hasInfoCue =
    GENERAL_INFO_PATTERNS.test(normalizedText) ||
    normalizedText.includes("?") ||
    shortInfoShortcut;
  const cyberHint = CYBER_INFO_HINTS.test(normalizedText) || Boolean(bestMatch?.score >= 4);

  if (!hasInfoCue || !cyberHint) {
    return false;
  }

  if (hasIncidentNarrative(normalizedText) && !CASE_INFO_PATTERNS.test(normalizedText)) {
    return false;
  }

  return true;
}

function formatSectionLine(entry) {
  const title = entry?.title ? ` - ${entry.title}` : "";
  const penalty = entry?.penalty ? ` (${entry.penalty})` : "";
  return `${entry.act} ${entry.code}${title}${penalty}`;
}

function buildReasoning(summary, matchedSignals, whatWouldChange = []) {
  return {
    summary,
    matchedSignals: uniqueStrings(matchedSignals).slice(0, 6),
    missingSignals: [],
    whatWouldChange: uniqueStrings(whatWouldChange).slice(0, 4),
  };
}

function getNotCrimeBranch(category) {
  const logic = category?.not_crime_data?.detection_logic || {};
  for (const value of Object.values(logic)) {
    if (value && typeof value === "object" && value.classification === "NOT_CRIME") {
      return value;
    }
  }

  if (logic.response?.classification === "NOT_CRIME") {
    return logic.response;
  }

  return null;
}

function buildCategorySuggestions(category) {
  if (!category) {
    return [
      "What is IT Act 66C?",
      "Explain phishing attack",
      "How do I report cyber fraud?",
    ];
  }

  if (category.type === "not_crime") {
    return [
      "Why is this not cyber crime?",
      "What would make this a cyber crime?",
      "How do I handle this issue?",
    ];
  }

  return [
    "What law applies here?",
    "What evidence should I keep?",
    "How do I report this?",
  ];
}

function buildCategoryInfoResponse(category, queryText, mode = "category") {
  const categoryData = buildCategoryPayload(category);
  const notCrimeBranch = getNotCrimeBranch(category);
  const itAct = categoryData.it_act_sections
    .map((entry) => `IT Act ${entry.section}${entry.title ? ` - ${entry.title}` : ""}`)
    .slice(0, 4);
  const ipc = categoryData.ipc_sections
    .map((entry) => `IPC ${entry.section}${entry.title ? ` - ${entry.title}` : ""}`)
    .slice(0, 4);
  const legalHighlights = uniqueStrings([...itAct, ...ipc]).slice(0, 6);
  const actionLine =
    categoryData.immediate_actions.length > 0
      ? `Start with: ${categoryData.immediate_actions.slice(0, 3).join(" | ")}.`
      : null;
  const evidenceLine =
    categoryData.evidence_to_collect.length > 0
      ? `Important evidence: ${categoryData.evidence_to_collect.slice(0, 4).join(" | ")}.`
      : null;

  if (category.type === "not_crime") {
    const explanationLine =
      (notCrimeBranch?.explanation || []).join(" ") ||
      categoryData.legal_summary ||
      categoryData.description;
    const options = (notCrimeBranch?.your_options || categoryData.immediate_actions || []).slice(0, 4);
    return {
      text: [
        `**${categoryData.title}** is usually treated as **not a cyber crime** in this system.`,
        explanationLine || null,
        options.length > 0 ? `Better route: ${options.join(" | ")}.` : null,
        "If there was phishing, impersonation, hacking, or unauthorized money movement, describe that and I can re-evaluate it as an incident.",
      ]
        .filter(Boolean)
        .join(" "),
      classificationType: "NOT_CRIME_INFO",
      confidence: 88,
      reasoning: buildReasoning(
        `This query matched the non-crime category **${categoryData.title}**.`,
        [categoryData.title, ...(category.keywords || []).slice(0, 3)],
        ["If deception, hacking, or unauthorized access is added, the result may change to cybercrime."],
      ),
      suggestions: buildCategorySuggestions(category),
      categoryId: category.id,
      crimeData: categoryData,
      knowledgeMode: mode,
    };
  }

  return {
    text: [
      `**${categoryData.title}** is a cyber-crime category covered in this system.`,
      categoryData.description || null,
      categoryData.legal_summary || null,
      legalHighlights.length > 0 ? `Relevant legal sections: ${legalHighlights.join(" | ")}.` : null,
      actionLine,
      evidenceLine,
      mode === "category"
        ? "If this happened to you personally, describe the incident and I will switch from information mode to case assessment."
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    classificationType: "CYBER_CRIME_INFO",
    confidence: 89,
    reasoning: buildReasoning(
      `This query matched the cyber-crime category **${categoryData.title}**.`,
      [categoryData.title, ...(category.primary_identifiers || []).slice(0, 3)],
      ["If you want case-specific guidance, share what actually happened and what was accessed or lost."],
    ),
    suggestions: buildCategorySuggestions(category),
    categoryId: category.id,
    crimeData: categoryData,
    knowledgeMode: mode,
  };
}

function buildSectionInfoResponse(sectionMatches) {
  const primary = sectionMatches[0];
  const relatedCategories = uniqueStrings(
    sectionMatches.flatMap((entry) => entry.categories.map((categoryId) => getCategoryById(categoryId)?.title || null)),
  ).slice(0, 5);

  return {
    text: [
      `**${primary.act} ${primary.code}**${primary.title ? ` covers ${primary.title}.` : "."}`,
      primary.penalty ? `Typical penalty in this catalog: ${primary.penalty}.` : null,
      relatedCategories.length > 0
        ? `In this backend, it is commonly mapped to: ${relatedCategories.join(" | ")}.`
        : null,
      "If you want, I can also explain which incident types in your data map to this section.",
    ]
      .filter(Boolean)
      .join(" "),
    classificationType: "LAW_INFO",
    confidence: 92,
    reasoning: buildReasoning(
      `The query directly matched a stored legal section: ${primary.act} ${primary.code}.`,
      sectionMatches.map((entry) => `${entry.act} ${entry.code}${entry.title ? ` - ${entry.title}` : ""}`),
      ["Describe the incident itself if you want category classification instead of legal reference lookup."],
    ),
    suggestions: [
      "Explain phishing laws",
      "Which law applies to account hacking?",
      "How do I report cyber fraud?",
    ],
    categoryId: null,
    crimeData: null,
    knowledgeMode: "section",
  };
}

function buildGeneralCyberInfoResponse(queryText) {
  const bestMatch = findBestCategoryMatch(queryText).top;
  if (bestMatch?.category && bestMatch.score >= 3.2) {
    return buildCategoryInfoResponse(bestMatch.category, queryText, "category");
  }

  return {
    text:
      "I can explain cyber-crime categories and cyber-law routes from your backend data, including IT Act / IPC sections, reporting steps, evidence, and whether something is not a cyber crime. Ask about a section like `IT Act 66C`, a crime type like `phishing`, or describe the incident for case assessment.",
    classificationType: "INFO",
    confidence: 78,
    reasoning: buildReasoning(
      "This looks like a general cyber-law or cyber-crime information query.",
      ["General cyber-law guidance requested"],
      ["Mention a specific section, crime type, or incident for a more targeted answer."],
    ),
    suggestions: [
      "What is IT Act 66D?",
      "Explain UPI fraud laws",
      "Is delayed refund a cyber crime?",
    ],
    categoryId: null,
    crimeData: null,
    knowledgeMode: "general",
  };
}

function buildCurrentCaseInfoResponse(currentCase, text) {
  const categoryId = currentCase?.crimeId || currentCase?.notCrimeId || null;
  const category = getCategoryById(categoryId);
  if (!category) {
    return null;
  }

  const categoryData = buildCategoryPayload(category);
  const lowerText = String(text || "").toLowerCase();
  const wantsEvidence = /\b(evidence|proof|screenshot|screenshots|what should i keep|what to keep)\b/i.test(lowerText);
  const wantsReport = /\b(report|complaint|fir|police|1930|cybercrime\.gov|where do i complain|how do i report|how to report)\b/i.test(lowerText);
  const wantsLaw = /\b(law|legal|section|sections|punishment|penalty|ipc|it act|dpdp)\b/i.test(lowerText);
  const wantsAction = /\b(action|actions|what should i do|what do i do|next step|do now)\b/i.test(lowerText);

  const legalHighlights = uniqueStrings([
    ...categoryData.it_act_sections.map((entry) => `IT Act ${entry.section}${entry.title ? ` - ${entry.title}` : ""}`),
    ...categoryData.ipc_sections.map((entry) => `IPC ${entry.section}${entry.title ? ` - ${entry.title}` : ""}`),
  ]).slice(0, 6);

  const textParts = [`Current case: **${categoryData.title}**.`];

  if (wantsLaw || (!wantsEvidence && !wantsReport && !wantsAction)) {
    textParts.push(categoryData.legal_summary || categoryData.description);
    if (legalHighlights.length > 0) {
      textParts.push(`Relevant sections: ${legalHighlights.join(" | ")}.`);
    }
  }

  if (wantsEvidence) {
    textParts.push(
      categoryData.evidence_to_collect.length > 0
        ? `Keep this evidence: ${categoryData.evidence_to_collect.slice(0, 5).join(" | ")}.`
        : "Keep screenshots, transaction IDs, alerts, chat logs, and any platform emails.",
    );
  }

  if (wantsReport) {
    const reportingText = categoryData.reporting?.primary
      ? `Report via ${categoryData.reporting.primary}${categoryData.reporting.helpline ? ` and call ${categoryData.reporting.helpline}` : ""}.`
      : "Report via cybercrime.gov.in and use 1930 for urgent financial cyber fraud.";
    textParts.push(reportingText);
    if (categoryData.timeline_guidance) {
      const timelinePreview = Object.entries(categoryData.timeline_guidance)
        .slice(0, 2)
        .map(([label, value]) => `${label}: ${value}`)
        .join(" | ");
      if (timelinePreview) {
        textParts.push(`Timing matters: ${timelinePreview}.`);
      }
    }
  }

  if (wantsAction) {
    textParts.push(
      categoryData.immediate_actions.length > 0
        ? `Immediate steps: ${categoryData.immediate_actions.slice(0, 4).join(" | ")}.`
        : "Immediate steps: preserve evidence, secure accounts, and report quickly.",
    );
  }

  return {
    text: textParts.filter(Boolean).join(" "),
    classificationType: currentCase.classificationType || "INFO",
    confidence: Math.max(Number(currentCase.confidence || 0), 80),
    reasoning: buildReasoning(
      `This answer was built from the currently active case category: **${categoryData.title}**.`,
      [categoryData.title, ...(wantsLaw ? legalHighlights.slice(0, 2) : [])],
      ["Start a new case if you want to discuss a different incident."],
    ),
    suggestions: buildCategorySuggestions(category),
    categoryId,
    crimeData: categoryData,
    knowledgeMode: "case",
  };
}

function answerKnowledgeQuery({ text, currentCase = null } = {}) {
  if (!looksLikeKnowledgeQuery(text, currentCase)) {
    return null;
  }

  if (currentCase) {
    const caseResponse = buildCurrentCaseInfoResponse(currentCase, text);
    if (caseResponse) {
      return caseResponse;
    }
  }

  const sectionMatches = findSectionMatches(text);
  if (sectionMatches.length > 0) {
    return buildSectionInfoResponse(sectionMatches);
  }

  const bestMatch = findBestCategoryMatch(text).top;
  if (bestMatch?.category && bestMatch.score >= 3.2) {
    return buildCategoryInfoResponse(bestMatch.category, text, "category");
  }

  return buildGeneralCyberInfoResponse(text);
}

module.exports = {
  answerKnowledgeQuery,
};
