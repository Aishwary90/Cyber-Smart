const express = require("express");
const { buildVerdict } = require("../engine/verdictBuilder");

const router = express.Router();

router.post("/", (request, response) => {
  try {
    const { crimeId, userText = "", answers = {}, caseId = null } = request.body || {};
    response.json(buildVerdict({ crimeId, userText, answers, caseId }));
  } catch (error) {
    response.status(500).json({
      error: error.message || "Unable to build verdict.",
      verdict: null,
    });
  }
});

module.exports = router;
