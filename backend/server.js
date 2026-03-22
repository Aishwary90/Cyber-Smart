const path = require("path");

let dotenv;
try {
  dotenv = require("dotenv");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") {
    throw error;
  }
}

if (dotenv) {
  dotenv.config({ path: path.join(__dirname, ".env") });
}

const app = require("./app");

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
