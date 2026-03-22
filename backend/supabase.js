const path = require("path");
const { createClient } = require("@supabase/supabase-js");

let dotenv;
try {
  dotenv = require("dotenv");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

if (dotenv?.config) {
  dotenv.config({ path: path.join(__dirname, ".env") });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.error("SUPABASE_URL or SUPABASE_ANON_KEY missing from backend/.env");
}

function createSupabaseClient(accessToken = null) {
  if (!isSupabaseConfigured) {
    return null;
  }

  const options = accessToken
    ? {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    : undefined;

  return createClient(supabaseUrl, supabaseAnonKey, options);
}

function getAccessToken(req) {
  return (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
}

const supabase = createSupabaseClient();

module.exports = {
  supabase,
  createSupabaseClient,
  getAccessToken,
  isSupabaseConfigured,
};
