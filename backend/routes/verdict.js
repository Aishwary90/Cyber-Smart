const express = require("express");
const { buildVerdict } = require("../engine/verdictBuilder");

const router = express.Router();

router.post("/", (request, response) => {
  // Frontend sends { crimeId, userText, answers, caseId }
  const { crimeId, userText = "", answers = {}, caseId = null } = request.body || {};
  response.json(buildVerdict({ crimeId, userText, answers, caseId }));
});

module.exports = router;
