/**
 * tfidf.js – Text pre-processing and vector utilities
 * Fixed: removed double-escaped \\s (was broken regex)
 */

function preprocess(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")   // fixed: was \\s → now \s
    .split(/\s+/)                    // fixed: was \\s+ → now \s+
    .filter(Boolean);
}

function buildVector(tokens) {
  return tokens.reduce((vector, token) => {
    vector[token] = (vector[token] || 0) + 1;
    return vector;
  }, {});
}

/**
 * Count how many keywords from a list appear in the token set.
 * Returns both count and which tokens matched (for debugging).
 */
function countKeywordHits(tokens, keywords) {
  const tokenSet = new Set(tokens);
  const matched = [];

  for (const kw of keywords) {
    // Multi-word keyword: all words must appear in the token set
    const kwTokens = preprocess(kw);
    if (kwTokens.length === 0) continue;

    const allPresent = kwTokens.every((t) => tokenSet.has(t));
    if (allPresent) {
      matched.push(kw);
    }
  }

  return { count: matched.length, matched };
}

module.exports = { preprocess, buildVector, countKeywordHits };
