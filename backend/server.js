const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");

const classifyRoute = require("./routes/classify");
const questionRoute = require("./routes/questions");
const verdictRoute = require("./routes/verdict");
const phishingRoute = require("./routes/phishing");
const authRoute = require("./routes/auth");
const casesRoute = require("./routes/cases");
const feedbackRoute = require("./routes/feedback");

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:4173",
      "http://127.0.0.1:5173",
    ],
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
    version: "2.0.0",
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

app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

const port = Number(process.env.PORT) || 5000;

const server = app.listen(port, () => {
  console.log(`CyberSmart backend running on http://localhost:${port}`);
  console.log(
    `Supabase: ${process.env.SUPABASE_URL ? "configured" : "not configured"}`,
  );
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} is already in use. Your backend may already be running on http://localhost:${port}.`,
    );
    process.exit(1);
  }

  console.error("Backend failed to start:", error.message);
  process.exit(1);
});
