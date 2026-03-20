const assert = require("assert");

const { classifyIncident } = require("../engine/classifier");
const { answerKnowledgeQuery } = require("../engine/knowledgeRouter");
const { getCategoryById } = require("../engine/incidentCatalog");
const { buildCategoryPayload } = require("../engine/categoryPayload");

const tests = [
  {
    name: "Law section lookup is handled as knowledge",
    run() {
      const response = answerKnowledgeQuery({ text: "What is IT Act 66C?" });
      assert(response, "Expected a knowledge response");
      assert.strictEqual(response.classificationType, "LAW_INFO");
      assert(/66C/i.test(response.text), "Expected section 66C in response");
    },
  },
  {
    name: "Crime info lookup is handled as knowledge",
    run() {
      const response = answerKnowledgeQuery({ text: "Explain phishing attack laws" });
      assert(response, "Expected a knowledge response");
      assert.strictEqual(response.classificationType, "CYBER_CRIME_INFO");
      assert(response.categoryId, "Expected a matched category");
    },
  },
  {
    name: "Not-crime info lookup is handled as knowledge",
    run() {
      const response = answerKnowledgeQuery({ text: "Is delayed refund a cyber crime?" });
      assert(response, "Expected a knowledge response");
      assert.strictEqual(response.classificationType, "NOT_CRIME_INFO");
      assert.strictEqual(response.categoryId, "NAC005_bad_customer_service");
    },
  },
  {
    name: "Incident report still goes through incident classifier",
    run() {
      const knowledge = answerKnowledgeQuery({
        text: "Money was stolen from my UPI after I shared OTP on a fake call",
      });
      const classification = classifyIncident(
        "Money was stolen from my UPI after I shared OTP on a fake call",
      );

      assert.strictEqual(knowledge, null);
      assert.strictEqual(classification.classification_type, "CRIME");
      assert(classification.top_crime_id, "Expected a top crime id");
    },
  },
  {
    name: "Non-cyber prompt stays out of scope",
    run() {
      const knowledge = answerKnowledgeQuery({ text: "What is the weather today?" });
      const classification = classifyIncident("What is the weather today?");

      assert.strictEqual(knowledge, null);
      assert.strictEqual(classification.classification_type, "OUT_OF_SCOPE");
    },
  },
  {
    name: "Blocked on social media is direct not-crime",
    run() {
      const classification = classifyIncident("Someone blocked me on Instagram and unfriended me");
      assert.strictEqual(classification.classification_type, "NOT_CRIME");
      assert.strictEqual(classification.top_not_crime_id, "NAC004_blocked_on_social_media");
    },
  },
  {
    name: "Fake shopping site is not forced into customer-service not-crime",
    run() {
      const classification = classifyIncident(
        "I paid on a fake shopping website and the product was never delivered",
      );
      assert.notStrictEqual(classification.top_not_crime_id, "NAC005_bad_customer_service");
    },
  },
  {
    name: "Category payload exposes normalized legal sections",
    run() {
      const category = getCategoryById("CT002");
      const payload = buildCategoryPayload(category);
      assert(payload, "Expected category payload");
      assert(payload.it_act_sections.length > 0, "Expected IT Act sections in payload");
    },
  },
];

let passed = 0;

for (const test of tests) {
  try {
    test.run();
    passed += 1;
    console.log(`PASS: ${test.name}`);
  } catch (error) {
    console.error(`FAIL: ${test.name}`);
    console.error(error.message);
    process.exitCode = 1;
  }
}

if (!process.exitCode) {
  console.log(`All ${passed} tests passed.`);
}
