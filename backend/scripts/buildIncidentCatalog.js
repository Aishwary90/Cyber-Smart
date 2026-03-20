const fs = require("fs");
const path = require("path");

const combinedData = require(path.join(__dirname, "../data/cyber_crimes_combined.json"));
const crossQuestionsBank = require(path.join(__dirname, "../data/cross_questions_bank.json"));
const notACrimeData = require(path.join(__dirname, "../data/not_a_crime.json"));
const legalDb = require(path.join(__dirname, "../data/legal_db.json"));

const OUT_PATH = path.join(__dirname, "../data/normalized_incident_catalog.json");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function uniqueStrings(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function getSeverityWeight(severity) {
  if (!severity) return "medium";
  const normalized = String(severity).toLowerCase();
  if (["critical", "high", "medium", "low", "none"].includes(normalized)) {
    return normalized;
  }
  return "medium";
}

function normalizeCrimeCategories() {
  const questionMap = new Map(
    (crossQuestionsBank.categories || []).map((entry) => [entry.crime_id, entry]),
  );
  const legalMap = new Map((legalDb.crimes || []).map((entry) => [entry.id, entry]));

  return (combinedData.categories || []).map((category) => {
    const questionEntry = questionMap.get(category.id);
    const legalEntry = legalMap.get(category.id);

    return {
      id: category.id,
      type: "crime",
      title: category.crime_name,
      description: category.description || "",
      severity: getSeverityWeight(category.severity || legalEntry?.classification?.severity),
      keywords: uniqueStrings(category.keywords),
      primary_identifiers: uniqueStrings(category.primary_identifiers),
      disambiguation_note: category.disambiguation_note || "",
      questions: questionEntry?.cross_questions || [],
      evidence_required: uniqueStrings(
        category.evidence_to_collect || legalEntry?.evidence_required || [],
      ),
      immediate_actions: uniqueStrings(
        category.immediate_actions || legalEntry?.immediate_actions || [],
      ),
      legal_sections: {
        it_act: category.it_act_sections || legalEntry?.legal_mapping?.it_act || [],
        ipc: category.ipc_sections || legalEntry?.legal_mapping?.ipc || [],
      },
      legal_summary: legalEntry?.legal_summary || "",
      reporting: legalEntry?.reporting || null,
      timeline_guidance: legalEntry?.timeline_guidance || null,
      model_hints: {
        source: "combined_v2",
        question_count: questionEntry?.cross_questions?.length || 0,
      },
    };
  });
}

function normalizeNotCrimeCategories() {
  return Object.entries(notACrimeData || {})
    .filter(([key]) => key.startsWith("NAC"))
    .map(([id, entry]) => ({
      id,
      type: "not_crime",
      title: entry.scenario_name || id,
      description:
        entry?.detection_logic?.if_voluntary?.explanation?.join(" ") ||
        entry?.detection_logic?.if_platform_action?.explanation?.join(" ") ||
        "",
      severity: "none",
      keywords: uniqueStrings(entry.trigger_keywords),
      primary_identifiers: uniqueStrings(entry.trigger_keywords?.slice(0, 10) || []),
      disambiguation_note: entry?.detection_logic?.primary_check || "",
      questions: entry?.detection_logic?.clarifying_question
        ? [
            {
              question_id: `${id}_clarify`,
              priority: "high",
              question: entry.detection_logic.clarifying_question.question,
              type: "single_choice",
              options: entry.detection_logic.clarifying_question.options || [],
            },
          ]
        : [],
      evidence_required: [],
      immediate_actions: uniqueStrings(
        entry?.detection_logic?.if_voluntary?.your_options ||
          entry?.detection_logic?.if_platform_action?.your_options ||
          [],
      ),
      legal_sections: {
        it_act: [],
        ipc: [],
      },
      legal_summary:
        entry?.detection_logic?.if_voluntary?.legal_status ||
        entry?.detection_logic?.if_platform_action?.legal_reality ||
        "",
      reporting: null,
      timeline_guidance: null,
      not_crime_data: entry,
      model_hints: {
        source: "not_a_crime",
        question_count: entry?.detection_logic?.clarifying_question ? 1 : 0,
      },
    }));
}

function buildCatalog() {
  const crimes = normalizeCrimeCategories();
  const notCrimes = normalizeNotCrimeCategories();

  return {
    meta: {
      generated_at: new Date().toISOString(),
      source_files: [
        "cyber_crimes_combined.json",
        "cross_questions_bank.json",
        "not_a_crime.json",
        "legal_db.json",
      ],
      version: "normalized_v1",
      total_categories: crimes.length + notCrimes.length,
      crime_categories: crimes.length,
      not_crime_categories: notCrimes.length,
    },
    categories: [...crimes, ...notCrimes],
  };
}

function main() {
  const catalog = buildCatalog();
  ensureDir(OUT_PATH);
  fs.writeFileSync(OUT_PATH, JSON.stringify(catalog, null, 2), "utf8");
  console.log(`Normalized catalog written to ${OUT_PATH}`);
  console.log(
    `Crime categories: ${catalog.meta.crime_categories}, not-crime categories: ${catalog.meta.not_crime_categories}`,
  );
}

main();
