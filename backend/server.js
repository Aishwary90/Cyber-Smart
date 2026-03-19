const express = require("express");
const cors = require("cors");

const classifyRoute = require("./routes/classify");
const questionRoute = require("./routes/questions");
const verdictRoute = require("./routes/verdict");

const app = express();

/* ── Middleware ── */
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"],
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json());

/* ── Health ── */
app.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "cyber-smart-ai-backend", version: "2.0.0" });
});

/* ── API Routes ── */
app.use("/api/classify", classifyRoute);
app.use("/api/questions", questionRoute);   // fixed: was /api/next-question
app.use("/api/verdict", verdictRoute);

/* ── 404 catch-all ── */
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const port = process.env.PORT || 5000;     // fixed: was 4000

app.listen(port, () => {
  console.log(`✅  CyberSmart backend running on http://localhost:${port}`);
});
