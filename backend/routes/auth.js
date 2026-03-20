const express = require("express");
const {
  supabase,
  createSupabaseClient,
  isSupabaseConfigured,
} = require("../supabase");

const router = express.Router();

const isDemoMode = !isSupabaseConfigured || !supabase;

function normalizeDemoEmail(email) {
  const trimmed = (email || "").trim();
  return trimmed || "demo@cybersmart.ai";
}

function buildDemoUser(email, fullName = "") {
  const normalizedEmail = normalizeDemoEmail(email);
  const label = normalizedEmail.split("@")[0] || "demo-user";
  const sanitizedLabel = label.replace(/[^a-z0-9-_]/gi, "");
  const safeLabel = sanitizedLabel.length ? sanitizedLabel : "demo-user";
  const trimmedName = (fullName || "").trim();
  const displayName = trimmedName || label || "Demo User";

  return {
    id: `demo-${safeLabel.toLowerCase()}`,
    email: normalizedEmail,
    fullName: displayName,
  };
}

function sendDemoAuthResponse(res, { email, fullName = "", needsEmailVerification = false } = {}) {
  return res.json({
    user: buildDemoUser(email, fullName),
    session: null,
    needsEmailVerification,
    demo: true,
    message:
      "Supabase is not configured. Signed in with a demo profile (session is not persisted).",
  });
}

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

router.post("/signup", async (req, res) => {
  try {
    const { email, password, fullName } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    if (isDemoMode) {
      return sendDemoAuthResponse(res, { email, fullName });
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

    if (isDemoMode) {
      return sendDemoAuthResponse(res, { email });
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
  if (isDemoMode) {
    return res.json({ success: true, demo: true });
  }

  return res.json({ success: true });
});

router.post("/refresh", async (req, res) => {
  try {
    if (isDemoMode) {
      return res
        .status(400)
        .json({ error: "Session refresh is unavailable in demo mode." });
    }

    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: "refreshToken is required." });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data?.session) {
      return res.status(401).json({ error: error?.message || "Unable to refresh session." });
    }

    return res.json({
      session: data.session,
      user: data.user
        ? {
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.user_metadata?.full_name || "",
          }
        : null,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to refresh session." });
  }
});

router.get("/me", async (req, res) => {
  try {
    if (isDemoMode) {
      return res.status(401).json({ error: "Not authenticated." });
    }

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
