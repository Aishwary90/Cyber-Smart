const express = require("express");
const {
  supabase,
  createSupabaseClient,
  getAccessToken,
  isSupabaseConfigured,
} = require("../supabase");

const router = express.Router();

async function getRequestContext(req) {
  const token = getAccessToken(req);
  if (!token || !supabase) {
    return { token: null, user: null, client: null };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { token: null, user: null, client: null };
  }

  return {
    token,
    user: data.user,
    client: createSupabaseClient(token),
  };
}

router.use((_req, res, next) => {
  if (!isSupabaseConfigured || !supabase) {
    return res
      .status(500)
      .json({ error: "Supabase is not configured. Check backend/.env." });
  }
  return next();
});

router.post("/", async (req, res) => {
  try {
    const { user, client } = await getRequestContext(req);
    if (!user || !client) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const {
      caseId = null,
      incidentText = "",
      predictedClass = null,
      correctedClass = null,
      verdictType = null,
      wasHelpful = null,
      rating = null,
      notes = "",
      answers = {},
      confidence = null,
      metadata = {},
    } = req.body || {};

    const payload = {
      user_id: user.id,
      case_id: caseId,
      incident_text: incidentText,
      predicted_class: predictedClass,
      corrected_class: correctedClass,
      verdict_type: verdictType,
      was_helpful: typeof wasHelpful === "boolean" ? wasHelpful : null,
      rating: typeof rating === "number" ? rating : null,
      notes,
      answers,
      confidence,
      metadata,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await client
      .from("case_feedback")
      .insert([payload])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ feedback: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to save feedback." });
  }
});

router.get("/", async (req, res) => {
  try {
    const { user, client } = await getRequestContext(req);
    if (!user || !client) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const limit = Number(req.query.limit || 100);
    const { data, error } = await client
      .from("case_feedback")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 500));

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ feedback: data || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to list feedback." });
  }
});

module.exports = router;
