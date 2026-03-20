/**
 * Test Suite for OUT_OF_SCOPE Validation
 * Tests the isQueryCyberRelated() function with various inputs
 */

const path = require("path");
const { preprocess } = require("../engine/tfidf");

// Define keywords (copied from classifier.js for testing)
const CYBER_DOMAIN_KEYWORDS = [
  // Crime/fraud keywords  "fraud", "scam", "hack", "phishing", "email", "password", "otp", "Money",
  "account", "bank", "credit card", "debit card", "upi", "gpay", "phonepe",
  "paytm", "transaction", "payment", "stolen", "unauthorized", "cyber",
  "malware", "virus", "ransomware", "datatheft", "sextortion", "blackmail",
  "online", "internet", "website", "link", "app", "device", "phone", "computer",
  "data", "information", "personal", "identity", "login", "username",
  "breach", "leak", "exposure", "threat", "attack", "exploit",
  // Hindi variants
  "धोखा", "धरमा", "पैसा", "खाता", "चोरी", "अनुमति", "लिंक", "ईमेल",
  "साइबर", "क्राइम", "धोखेबाजी", "ऑनलाइन", "वायरस", "नुकसान",
  // Action/legal keywords (specific to cyber crimes)
  "report", "complaint", "recover", "compromised", "hacked", "stolen",
  "legal", "law", "police", "fir", "case", "evidence", "proof"
];

const OUT_OF_SCOPE_KEYWORDS = [
  "love", "relationship", "dating", "marriage", "health", "doctor", "disease",
  "weather", "sports", "movie", "music", "game", "cooking", "recipe", "travel",
  "homework", "assignment", "math", "science", "history", "general knowledge",
  "आपका", "मेरा", "हे", "वो", "ये",
];

function isQueryCyberRelated(text) {
  if (!text || text.length < 5) {
    return false;
  }

  const lowerText = text.toLowerCase();
  const words = preprocess(lowerText);

  // Check for cyber-related keywords
  const cyberKeywordMatches = CYBER_DOMAIN_KEYWORDS.filter(kw =>
    lowerText.includes(kw.toLowerCase()) || words.includes(kw.toLowerCase())
  ).length;

  // Check for out-of-scope keywords
  const outOfScopeMatches = OUT_OF_SCOPE_KEYWORDS.filter(kw =>
    lowerText.includes(kw.toLowerCase())
  ).length;

  // If clear out-of-scope keywords found and NO cyber keywords, reject
  if (outOfScopeMatches > 0 && cyberKeywordMatches === 0) {
    return false;
  }

  // If has cyber keywords, accept (this is the primary check)
  if (cyberKeywordMatches > 0) {
    return true;
  }

  // Check for cyber-specific action patterns only
  const cyberActionPatterns = [
    /report|recover|protect|secure|help.*account/i,
    /lost.*money|lost.*password|lost.*access/i,
    /hacked|trojan|malware|virus|ransomware/i,
    /phishing|scam|fraud|unauthorized/i,
  ];

  const hasCyberActionPattern = cyberActionPatterns.some(pattern => pattern.test(lowerText));

  // Only return true if specific cyber action patterns are matched
  return hasCyberActionPattern;
}

// Test Cases
const testCases = [
  // CYBER-RELATED QUERIES (should return TRUE)
  {
    query: "Money taken from my UPI account",
    expected: true,
    category: "Financial Fraud"
  },
  {
    query: "Someone hacked my email account",
    expected: true,
    category: "Account Hacking"
  },
  {
    query: "I received a phishing email",
    expected: true,
    category: "Phishing"
  },
  {
    query: "My credit card was stolen",
    expected: true,
    category: "Credit Card Fraud"
  },
  {
    query: "Help! My bank account was compromised",
    expected: true,
    category: "Account Compromise"
  },
  {
    query: "धोखा - मेरे पैसे खाते से चोरी हो गए",
    expected: true,
    category: "Hindi - Financial Fraud"
  },
  {
    query: "साइबर क्राइम - मेरा ईमेल हैक हो गया",
    expected: true,
    category: "Hindi - Account Hacking"
  },

  // OUT-OF-SCOPE QUERIES (should return FALSE)
  {
    query: "How do I get my boyfriend back?",
    expected: false,
    category: "Relationship Advice"
  },
  {
    query: "What is the weather today?",
    expected: false,
    category: "Weather"
  },
  {
    query: "Can you help me with my homework?",
    expected: false,
    category: "Homework"
  },
  {
    query: "How do I cook biryani?",
    expected: false,
    category: "Cooking"
  },
  {
    query: "I have a headache, what medicine should I take?",
    expected: false,
    category: "Health Advice"
  },
  {
    query: "Who won the cricket match yesterday?",
    expected: false,
    category: "Sports"
  },
  {
    query: "What is the capital of India?",
    expected: false,
    category: "General Knowledge"
  },
];

console.log("\n========================================");
console.log("OUT_OF_SCOPE VALIDATION TEST SUITE");
console.log("========================================\n");

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = isQueryCyberRelated(test.query);
  const status = result === test.expected ? "✅ PASS" : "❌ FAIL";

  if (result === test.expected) {
    passed++;
  } else {
    failed++;
  }

  console.log(`Test ${index + 1}: ${status}`);
  console.log(`  Category: ${test.category}`);
  console.log(`  Query: "${test.query}"`);
  console.log(`  Expected: ${test.expected}, Got: ${result}\n`);
});

console.log("========================================");
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log("========================================\n");

if (failed === 0) {
  console.log("✅ ALL TESTS PASSED! Out-of-scope validation is working correctly.\n");
} else {
  console.log("⚠️ SOME TESTS FAILED! Please review the validation logic.\n");
}
