const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const OUT_PATH = path.join(__dirname, "../data/training_samples.jsonl");

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function normalizeLabel(row) {
  return row.corrected_class || row.predicted_class || null;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL + (SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY) are required.");
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("case_feedback")
    .select("incident_text,predicted_class,corrected_class,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(10000);

  if (error) {
    throw new Error(`Supabase query failed: ${error.message}`);
  }

  const lines = [];
  for (const row of data || []) {
    const text = (row.incident_text || "").trim();
    const label = normalizeLabel(row);
    if (!text || !label) continue;

    lines.push(
      JSON.stringify({
        text,
        label,
        source: "feedback",
        metadata: row.metadata || {},
        created_at: row.created_at || null,
      })
    );
  }

  ensureDir(OUT_PATH);
  fs.writeFileSync(OUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log(`Exported ${lines.length} labeled samples to ${OUT_PATH}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
