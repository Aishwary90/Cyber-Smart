const express = require("express");
const {
  supabase,
  createSupabaseClient,
  isSupabaseConfigured,
} = require("../supabase");

const router = express.Router();

async function ensureProfile(session, user, fallbackFullName = "") {
  if (!session?.access_token || !user?.id) {
    return;
  }

  const requestSupabase = createSupabaseClient(session.access_token);
  if (!requestSupabase) {
    return;
  }

  const fullName = user.user_metadata?.full_name || fallbackFullName || "";

  const { error } = await requestSupabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email || "",
      full_name: fullName,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) {
    console.warn("Profile sync warning:", error.message);
  }
}

router.use((_req, res, next) => {
  if (!isSupabaseConfigured || !supabase) {
    return res
      .status(500)
      .json({ error: "Supabase is not configured. Check backend/.env." });
  }

  return next();
});

router.post("/signup", async (req, res) => {
  try {
    const { email, password, fullName } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || "" } },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    await ensureProfile(data.session, data.user, fullName);

    return res.json({
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.user_metadata?.full_name || fullName || "",
          }
        : null,
      session: data.session || null,
      needsEmailVerification: !data.session,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to sign up." });
  }
});

router.post("/signin", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: error.message });
    }

    await ensureProfile(data.session, data.user);

    return res.json({
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.user_metadata?.full_name || "",
          }
        : null,
      session: data.session || null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to sign in." });
  }
});

router.post("/signout", async (_req, res) => {
  return res.json({ success: true });
});

router.get("/me", async (req, res) => {
  try {
    const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return res.status(401).json({ error: "Not authenticated." });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: "Invalid session." });
    }

    return res.json({
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.user_metadata?.full_name || "",
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to load user." });
  }
});

module.exports = router;
