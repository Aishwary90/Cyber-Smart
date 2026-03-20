const express = require("express");
const { getNextQuestion } = require("../engine/questionEngine");

const router = express.Router();

router.post("/", (request, response) => {
  try {
    const { crimeId, step = 0, userText = "", answer = "" } = request.body || {};
    response.json(getNextQuestion({ crimeId, step, userText, answer }));
  } catch (error) {
    response.status(500).json({
      done: true,
      error: error.message || "Unable to get the next verification question.",
      reason: "Question engine failed unexpectedly.",
    });
  }
});

module.exports = router;
