const express = require("express");
const { classifyIncident } = require("../engine/classifier");

const router = express.Router();

router.post("/", (request, response) => {
  try {
    const { text = "", incident = "" } = request.body || {};
    const incidentText = text || incident;
    response.json(classifyIncident(incidentText));
  } catch (error) {
    response.status(500).json({
      error: error.message || "Unable to classify the incident.",
      classification_type: "UNCLEAR",
      suspected_crimes: [],
      top_crime_id: null,
      confidence: 0,
      first_question: null,
      total_questions: 0,
      not_crime_data: null,
      model_source: "error",
      model_version: null,
      note: "Classifier failed unexpectedly.",
    });
  }
});

module.exports = router;
