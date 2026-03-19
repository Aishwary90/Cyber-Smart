const fs = require("fs");
const path = require("path");
const { preprocess } = require("./tfidf");

const MODEL_PATH = path.join(__dirname, "../models/current-model.json");

let cachedModel = null;
let cachedMtime = 0;

function loadModel() {
  try {
    const stat = fs.statSync(MODEL_PATH);
    if (cachedModel && cachedMtime === stat.mtimeMs) {
      return cachedModel;
    }

    const raw = fs.readFileSync(MODEL_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.labels) || parsed.labels.length === 0) {
      return null;
    }

    cachedModel = parsed;
    cachedMtime = stat.mtimeMs;
    return cachedModel;
  } catch (_error) {
    return null;
  }
}

function softmax(logScores) {
  const values = Object.values(logScores);
  if (!values.length) return {};
  const max = Math.max(...values);
  const exps = {};
  let sum = 0;
  for (const [label, score] of Object.entries(logScores)) {
    const v = Math.exp(score - max);
    exps[label] = v;
    sum += v;
  }
  const probs = {};
  for (const [label, v] of Object.entries(exps)) {
    probs[label] = sum > 0 ? v / sum : 0;
  }
  return probs;
}

function predictWithModel(text) {
  const model = loadModel();
  if (!model || !text || typeof text !== "string") {
    return null;
  }

  const tokens = preprocess(text);
  if (!tokens.length) {
    return null;
  }

  const tokenFreq = {};
  for (const token of tokens) {
    tokenFreq[token] = (tokenFreq[token] || 0) + 1;
  }

  const logScores = {};
  for (const label of model.labels) {
    let score = model.priors?.[label] ?? Math.log(1 / model.labels.length);
    const labelTokenProbs = model.tokenLogProbs?.[label] || {};
    const unk = model.unknownLogProb?.[label] ?? -12;

    for (const [token, count] of Object.entries(tokenFreq)) {
      const lp = labelTokenProbs[token] ?? unk;
      score += lp * count;
    }

    logScores[label] = score;
  }

  const probs = softmax(logScores);
  const ranked = Object.entries(probs)
    .map(([label, probability]) => ({ label, probability }))
    .sort((a, b) => b.probability - a.probability);

  if (!ranked.length) return null;

  return {
    modelVersion: model.version || "unknown",
    threshold: model.threshold ?? 0.55,
    ranked,
  };
}

module.exports = {
  predictWithModel,
  loadModel,
  MODEL_PATH,
};
