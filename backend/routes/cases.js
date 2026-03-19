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

router.get("/", async (req, res) => {
  try {
    const { user, client } = await getRequestContext(req);
    if (!user || !client) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const { data, error } = await client
      .from("cases")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ cases: data || [] });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to list cases." });
  }
});

router.post("/", async (req, res) => {
  try {
    const { user, client } = await getRequestContext(req);
    if (!user || !client) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const {
      title,
      incidentText,
      status,
      classificationType,
      primaryCrimeId,
      primaryCrimeLabel,
      confidence,
      answers,
      verdict,
      metadata,
    } = req.body || {};

    const { data, error } = await client
      .from("cases")
      .insert([
        {
          user_id: user.id,
          title: title || "Untitled Case",
          incident_text: incidentText || "",
          status: status || "understand",
          classification_type: classificationType || null,
          primary_crime_id: primaryCrimeId || null,
          primary_crime_label: primaryCrimeLabel || null,
          confidence: confidence ?? null,
          answers: answers || {},
          verdict: verdict || null,
          metadata: metadata || {},
        },
      ])
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json({ case: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to create case." });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { user, client } = await getRequestContext(req);
    if (!user || !client) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const { data, error } = await client
      .from("cases")
      .select("*")
      .eq("id", req.params.id)
      .eq("user_id", user.id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: error?.message || "Case not found." });
    }

    return res.json({ case: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to load case." });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const { user, client } = await getRequestContext(req);
    if (!user || !client) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const {
      title,
      incidentText,
      status,
      classificationType,
      primaryCrimeId,
      primaryCrimeLabel,
      confidence,
      answers,
      verdict,
      metadata,
    } = req.body || {};

    const update = {};
    if (title !== undefined) update.title = title;
    if (incidentText !== undefined) update.incident_text = incidentText;
    if (status !== undefined) update.status = status;
    if (classificationType !== undefined) update.classification_type = classificationType;
    if (primaryCrimeId !== undefined) update.primary_crime_id = primaryCrimeId;
    if (primaryCrimeLabel !== undefined) update.primary_crime_label = primaryCrimeLabel;
    if (confidence !== undefined) update.confidence = confidence;
    if (answers !== undefined) update.answers = answers;
    if (verdict !== undefined) update.verdict = verdict;
    if (metadata !== undefined) update.metadata = metadata;
    update.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from("cases")
      .update(update)
      .eq("id", req.params.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: error?.message || "Case not found." });
    }

    return res.json({ case: data });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to update case." });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const { user, client } = await getRequestContext(req);
    if (!user || !client) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const { error } = await client
      .from("cases")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", user.id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to delete case." });
  }
});

module.exports = router;
