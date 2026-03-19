/**
 * routes/phishing.js – URL phishing analysis endpoint
 * POST /api/phishing { url }
 */
const express = require("express");
const { analyzeUrl } = require("../engine/phishingAnalyzer");

const router = express.Router();

router.post("/", (req, res) => {
  const { url = "" } = req.body || {};

  if (!url || typeof url !== "string" || url.trim().length < 4) {
    return res.status(400).json({ error: "A valid URL is required." });
  }

  // Ensure URL has a scheme for parsing
  const urlToAnalyze = /^https?:\/\//i.test(url.trim()) ? url.trim() : `http://${url.trim()}`;

  const result = analyzeUrl(urlToAnalyze);
  return res.json(result);
});

module.exports = router;
