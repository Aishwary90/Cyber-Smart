const express = require("express");
const { classifyIncident } = require("../engine/classifier");

const router = express.Router();

router.post("/", (request, response) => {
  // Frontend sends { text }, engine expects a string
  const { text = "", incident = "" } = request.body || {};
  const incidentText = text || incident;
  response.json(classifyIncident(incidentText));
});

module.exports = router;
