const express = require("express");
const { getNextQuestion } = require("../engine/questionEngine");

const router = express.Router();

router.post("/", (request, response) => {
  // Frontend sends { crimeId, step, userText, answer }
  const { crimeId, step = 0, userText = "", answer = "" } = request.body || {};
  response.json(getNextQuestion({ crimeId, step, userText, answer }));
});

module.exports = router;
