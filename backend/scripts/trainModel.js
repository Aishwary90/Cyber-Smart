const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const cyberCrimeData = require(path.join(__dirname, "../data/cyber_crime.json"));
const notACrimeData = require(path.join(__dirname, "../data/not_a_crime.json"));
const { preprocess } = require("../engine/tfidf");

const MODEL_OUT = path.join(__dirname, "../models/current-model.json");
const REPORT_OUT = path.join(__dirname, "../models/training-report.json");
const DEFAULT_DATASET = path.join(__dirname, "../data/training_samples.jsonl");

function hashToUnitInterval(input) {
  const digest = crypto.createHash("sha1").update(input).digest("hex").slice(0, 8);
  return parseInt(digest, 16) / 0xffffffff;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonl(filePath) {
  if (!fs.existsSync(filePath)) {
    return { rows: [], totalLines: 0, malformedLines: 0 };
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter(Boolean);
  const rows = [];
  let malformedLines = 0;

  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.text && obj?.label) {
        rows.push(obj);
      } else {
        malformedLines += 1;
      }
    } catch (_error) {
      malformedLines += 1;
    }
  }

  return { rows, totalLines: lines.length, malformedLines };
}

function buildSyntheticExamples() {
  const rows = [];

  for (const crime of cyberCrimeData.crime_types || []) {
    const keywords = Array.isArray(crime.keywords) ? crime.keywords : [];
    for (let index = 0; index < keywords.length; index += 3) {
      const text = keywords.slice(index, index + 3).join(" ");
      if (text.trim()) {
        rows.push({ text, label: crime.id, source: "synthetic_keyword" });
      }
    }
  }

  for (const [key, value] of Object.entries(notACrimeData || {})) {
    if (!key.startsWith("NAC")) continue;
    const keywords = Array.isArray(value.trigger_keywords) ? value.trigger_keywords : [];
    for (let index = 0; index < keywords.length; index += 3) {
      const text = keywords.slice(index, index + 3).join(" ");
      if (text.trim()) {
        rows.push({ text, label: key, source: "synthetic_keyword" });
      }
    }
  }

  return rows;
}

function stratifiedSplit(rows, testRatio = 0.2) {
  const groups = rows.reduce((accumulator, row) => {
    accumulator[row.label] = accumulator[row.label] || [];
    accumulator[row.label].push(row);
    return accumulator;
  }, {});

  const train = [];
  const test = [];

  for (const label of Object.keys(groups)) {
    const ordered = groups[label]
      .slice()
      .sort((a, b) => hashToUnitInterval(`${label}:${a.text}`) - hashToUnitInterval(`${label}:${b.text}`));
    const testCount =
      ordered.length <= 1 ? 0 : Math.max(1, Math.round(ordered.length * testRatio));

    ordered.forEach((row, index) => {
      if (index < testCount) {
        test.push(row);
      } else {
        train.push(row);
      }
    });
  }

  return { train, test };
}

function repeatRows(rows, times) {
  const repeated = [];
  for (const row of rows) {
    for (let index = 0; index < times; index += 1) {
      repeated.push(row);
    }
  }
  return repeated;
}

function trainNaiveBayes(rows, labels) {
  const labelDocCount = {};
  const tokenCounts = {};
  const totalTokens = {};
  const vocab = new Set();

  for (const label of labels) {
    labelDocCount[label] = 0;
    tokenCounts[label] = {};
    totalTokens[label] = 0;
  }

  for (const row of rows) {
    const tokens = preprocess(row.text);
    if (!tokens.length || !labels.includes(row.label)) continue;

    labelDocCount[row.label] += 1;
    for (const token of tokens) {
      vocab.add(token);
      tokenCounts[row.label][token] = (tokenCounts[row.label][token] || 0) + 1;
      totalTokens[row.label] += 1;
    }
  }

  const vocabSize = Math.max(vocab.size, 1);
  const totalDocs = Math.max(rows.length, 1);

  const priors = {};
  const tokenLogProbs = {};
  const unknownLogProb = {};

  for (const label of labels) {
    const docCount = labelDocCount[label] || 0;
    priors[label] = Math.log((docCount + 1) / (totalDocs + labels.length));

    tokenLogProbs[label] = {};
    const denom = (totalTokens[label] || 0) + vocabSize;
    unknownLogProb[label] = Math.log(1 / denom);

    for (const token of vocab) {
      const count = tokenCounts[label][token] || 0;
      tokenLogProbs[label][token] = Math.log((count + 1) / denom);
    }
  }

  return { labels, priors, tokenLogProbs, unknownLogProb, vocabSize };
}

function predict(model, text) {
  const tokens = preprocess(text);
  if (!tokens.length) {
    return { label: null, probabilities: {} };
  }

  const tokenFreq = {};
  for (const token of tokens) {
    tokenFreq[token] = (tokenFreq[token] || 0) + 1;
  }

  const logScores = {};
  for (const label of model.labels) {
    let score = model.priors[label];
    const probs = model.tokenLogProbs[label] || {};
    const unk = model.unknownLogProb[label] ?? -12;
    for (const [token, count] of Object.entries(tokenFreq)) {
      score += (probs[token] ?? unk) * count;
    }
    logScores[label] = score;
  }

  const max = Math.max(...Object.values(logScores));
  const exps = {};
  let sum = 0;
  for (const [label, score] of Object.entries(logScores)) {
    exps[label] = Math.exp(score - max);
    sum += exps[label];
  }

  const probabilities = {};
  for (const [label, value] of Object.entries(exps)) {
    probabilities[label] = sum > 0 ? value / sum : 0;
  }

  const ranked = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
  return { label: ranked[0]?.[0] || null, probabilities };
}

function evaluate(model, rows, labels) {
  if (!rows.length) {
    return { accuracy: 0, macroF1: 0, support: 0 };
  }

  let correct = 0;
  const perLabel = {};
  for (const label of labels) {
    perLabel[label] = { tp: 0, fp: 0, fn: 0, support: 0 };
  }

  for (const row of rows) {
    const predicted = predict(model, row.text).label;
    if (predicted === row.label) {
      correct += 1;
    }

    perLabel[row.label].support += 1;

    for (const label of labels) {
      if (predicted === label && row.label === label) perLabel[label].tp += 1;
      else if (predicted === label && row.label !== label) perLabel[label].fp += 1;
      else if (predicted !== label && row.label === label) perLabel[label].fn += 1;
    }
  }

  const perLabelMetrics = {};
  const f1Values = labels.map((label) => {
    const { tp, fp, fn, support } = perLabel[label];
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    perLabelMetrics[label] = {
      support,
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
    };

    return f1;
  });

  const macroF1 = f1Values.reduce((sum, value) => sum + value, 0) / Math.max(f1Values.length, 1);

  return {
    accuracy: Number((correct / rows.length).toFixed(4)),
    macroF1: Number(macroF1.toFixed(4)),
    support: rows.length,
    perLabel: perLabelMetrics,
  };
}

function buildLabelDistribution(rows) {
  return rows.reduce((accumulator, row) => {
    accumulator[row.label] = (accumulator[row.label] || 0) + 1;
    return accumulator;
  }, {});
}

function main() {
  const datasetArg = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_DATASET;
  const datasetRead = readJsonl(datasetArg);
  const customRows = datasetRead.rows.map((row) => ({ ...row, source: row.source || "human_labeled" }));
  const syntheticRows = buildSyntheticExamples();

  if (fs.existsSync(datasetArg) && datasetRead.totalLines > 0 && customRows.length === 0) {
    throw new Error(
      `Dataset exists but no valid JSONL rows were parsed from ${datasetArg}. Expected one JSON object per line with "text" and "label".`,
    );
  }

  const labels = [
    ...(cyberCrimeData.crime_types || []).map((crime) => crime.id),
    ...Object.keys(notACrimeData || {}).filter((key) => key.startsWith("NAC")),
  ];

  const { train: humanTrain, test: humanTest } = stratifiedSplit(customRows);
  const weightedHumanTrain = repeatRows(humanTrain, 3);
  const trainRows = [...syntheticRows, ...weightedHumanTrain];

  const modelCore = trainNaiveBayes(trainRows, labels);
  const trainMetrics = evaluate(modelCore, trainRows, labels);
  const humanTestMetrics = evaluate(modelCore, humanTest, labels);
  const syntheticTrainMetrics = evaluate(modelCore, syntheticRows, labels);

  const warnings = [];
  if (customRows.length < 100) {
    warnings.push("Very few human-labeled samples. Expect weak generalization.");
  }
  if (humanTest.length === 0) {
    warnings.push("No human-labeled holdout set available. Reported quality is not trustworthy.");
  }
  if (datasetRead.malformedLines > 0) {
    warnings.push(`${datasetRead.malformedLines} malformed dataset lines were ignored.`);
  }

  const model = {
    version: `nb-${new Date().toISOString()}`,
    createdAt: new Date().toISOString(),
    threshold: 0.55,
    labels: modelCore.labels,
    priors: modelCore.priors,
    tokenLogProbs: modelCore.tokenLogProbs,
    unknownLogProb: modelCore.unknownLogProb,
    metadata: {
      datasetPath: datasetArg,
      totalRows: trainRows.length + humanTest.length,
      trainRows: trainRows.length,
      testRows: humanTest.length,
      humanRows: customRows.length,
      syntheticRows: syntheticRows.length,
      malformedRows: datasetRead.malformedLines,
      labelDistribution: buildLabelDistribution(customRows),
      trainMetrics,
      testMetrics: humanTestMetrics,
      syntheticTrainMetrics,
      warnings,
    },
  };

  ensureDir(MODEL_OUT);
  fs.writeFileSync(MODEL_OUT, JSON.stringify(model, null, 2), "utf8");
  fs.writeFileSync(
    REPORT_OUT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        modelVersion: model.version,
        datasetPath: datasetArg,
        humanRows: customRows.length,
        syntheticRows: syntheticRows.length,
        malformedRows: datasetRead.malformedLines,
        labelDistribution: buildLabelDistribution(customRows),
        trainMetrics,
        testMetrics: humanTestMetrics,
        syntheticTrainMetrics,
        warnings,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("Model trained and saved:");
  console.log(`- Model: ${MODEL_OUT}`);
  console.log(`- Report: ${REPORT_OUT}`);
  console.log(`- Human rows: ${customRows.length}, Synthetic rows: ${syntheticRows.length}`);
  console.log(`- Human holdout accuracy: ${humanTestMetrics.accuracy}, macroF1: ${humanTestMetrics.macroF1}`);
  if (warnings.length) {
    console.log(`- Warnings: ${warnings.join(" | ")}`);
  }
}

main();
