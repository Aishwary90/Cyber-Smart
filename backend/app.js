const express = require("express");
const cors = require("cors");

const classifyRoute = require("./routes/classify");
const questionRoute = require("./routes/questions");
const verdictRoute = require("./routes/verdict");
const phishingRoute = require("./routes/phishing");
const authRoute = require("./routes/auth");
const casesRoute = require("./routes/cases");
const feedbackRoute = require("./routes/feedback");
const chatRoute = require("./routes/chat");

const app = express();

function buildCorsOrigins() {
  const defaultOrigins = [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
    "http://127.0.0.1:5173",
  ];

  const fromEnv = (process.env.FRONTEND_ORIGIN || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return [...new Set([...defaultOrigins, ...fromEnv])];
}

app.use(
  cors({
    origin: buildCorsOrigins(),
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Backend chal gya",
    backendRunning: true,
    health: "/health",
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "cyber-smart-ai-backend",
    version: "2.1.0",
    supabase: Boolean(process.env.SUPABASE_URL),
  });
});

app.use("/api/classify", classifyRoute);
app.use("/api/questions", questionRoute);
app.use("/api/verdict", verdictRoute);
app.use("/api/phishing", phishingRoute);
app.use("/api/auth", authRoute);
app.use("/api/cases", casesRoute);
app.use("/api/feedback", feedbackRoute);
app.use("/api/chat", chatRoute);

app.use((error, _req, res, _next) => {
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Invalid JSON payload." });
  }

  return res.status(500).json({ error: error?.message || "Internal server error." });
});

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

module.exports = app;
