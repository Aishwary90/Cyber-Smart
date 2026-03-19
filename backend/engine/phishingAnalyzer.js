/**
 * phishingAnalyzer.js – Heuristic URL phishing analysis engine
 *
 * Analyses a URL using pattern matching and heuristics.
 * Returns the exact shape that AnalyzerResults.jsx expects:
 * {
 *   url, score, safety_recommendation: { status, message },
 *   details: [{ name, details, score }],
 *   report_path
 * }
 */

const PHISHING_KEYWORDS = [
  "login", "signin", "sign-in", "verify", "verification",
  "secure", "update", "confirm", "account", "banking",
  "paypal", "paytm", "sbi", "hdfc", "icici", "axis",
  "free", "winner", "prize", "lucky", "reward", "offer",
  "password", "credential", "otp", "pin", "card",
  "click", "urgent", "alert", "suspended", "blocked",
  "kyc", "aadhar", "refund", "cashback", "bonus",
];

const TRUSTED_TLDS = [".gov.in", ".gov", ".edu", ".edu.in", ".nic.in"];
const SUSPICIOUS_TLDS = [".xyz", ".top", ".club", ".icu", ".gq", ".cf", ".tk", ".ml", ".ga"];

const LEGITIMATE_DOMAINS = new Set([
  "google.com", "gmail.com", "youtube.com", "facebook.com",
  "instagram.com", "microsoft.com", "apple.com", "amazon.in",
  "amazon.com", "flipkart.com", "sbi.co.in", "onlinesbi.com",
  "hdfcbank.com", "icicibank.com", "axisbank.com", "paytm.com",
  "phonepe.com", "upi.npci.org.in", "cybercrime.gov.in",
]);

function getDomain(urlStr) {
  try {
    const u = new URL(urlStr);
    return { hostname: u.hostname, protocol: u.protocol, pathname: u.pathname, search: u.search };
  } catch {
    return { hostname: urlStr, protocol: "http:", pathname: "", search: "" };
  }
}

function analyzeSpelling(hostname) {
  const score = 0;
  const issues = [];

  // Check for look-alike characters
  const lookalike = hostname.match(/[0-9]+l|l[0-9]+|rn(?=[a-z])|vv(?=[a-z])/i);
  if (lookalike) issues.push(`Lookalike characters detected: "${lookalike[0]}"`);

  // Check legitimate domain spoofing (e.g., "hdfc-bank.com" when real is "hdfcbank.com")
  for (const legit of LEGITIMATE_DOMAINS) {
    const legitRoot = legit.split(".")[0];
    if (hostname !== legit && hostname.includes(legitRoot) && !hostname.endsWith(`.${legit}`)) {
      issues.push(`Domain appears to spoof "${legit}"`);
    }
  }

  // Excessive hyphens
  const hyphens = (hostname.match(/-/g) || []).length;
  if (hyphens >= 3) issues.push(`Excessive hyphens (${hyphens}) in domain`);

  const riskScore = Math.min(issues.length * 20, 60);
  return {
    name: "Spelling & Domain",
    details: issues.length ? issues.join(". ") : "Domain looks clean — no lookalike characters or spoofing detected.",
    score: riskScore,
  };
}

function analyzeDomainAge(hostname) {
  // Heuristic: new-looking domains or free subdomains
  const isFreeSubdomain = /\.(000webhostapp|netlify|vercel|site|weebly|wix)\./i.test(hostname);
  const hasNumbers = /\d{4,}/.test(hostname.replace(/\./g, ""));
  const score = (isFreeSubdomain ? 30 : 0) + (hasNumbers ? 20 : 0);

  return {
    name: "Age & Registration",
    details: isFreeSubdomain
      ? "Domain hosted on free/cheap hosting service — common in phishing sites."
      : hasNumbers
        ? "Domain contains unusual numeric sequences — may indicate recently registered phishing domain."
        : "No strong age/registration risk signals detected.",
    score: Math.min(score, 50),
  };
}

function analyzeIPUsage(hostname) {
  const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
  return {
    name: "IP vs Domain",
    details: isIp
      ? `URL uses raw IP address (${hostname}) instead of a domain — classic phishing pattern.`
      : "URL uses a proper domain name, not a raw IP address.",
    score: isIp ? 50 : 0,
  };
}

function analyzeSecuritySignals(urlObj) {
  const { protocol, hostname } = urlObj;
  const isTrustedTLD = TRUSTED_TLDS.some((tld) => hostname.endsWith(tld));
  const isSuspiciousTLD = SUSPICIOUS_TLDS.some((tld) => hostname.endsWith(tld));
  const isHttps = protocol === "https:";
  const isLegit = LEGITIMATE_DOMAINS.has(hostname);

  let score = 0;
  const flags = [];

  if (!isHttps) { score += 20; flags.push("No HTTPS — connection is unencrypted."); }
  if (isSuspiciousTLD) { score += 30; flags.push(`Suspicious TLD (${hostname.split(".").pop()}) — often used in spam.`); }
  if (isTrustedTLD) score = Math.max(0, score - 20);
  if (isLegit) score = 0;

  return {
    name: "Security Signals",
    details: flags.length ? flags.join(" ") : "HTTPS present. No suspicious TLD detected.",
    score: Math.min(score, 50),
  };
}

function analyzeKeywords(urlStr) {
  const lower = urlStr.toLowerCase();
  const found = PHISHING_KEYWORDS.filter((k) => lower.includes(k));

  return {
    name: "Keywords",
    details: found.length
      ? `Suspicious keywords found: ${found.slice(0, 5).join(", ")}.`
      : "No phishing keyword patterns detected in URL.",
    score: Math.min(found.length * 15, 60),
  };
}

function buildRecommendation(score) {
  if (score <= 20) {
    return {
      status: "✅ Likely Safe",
      message: "This URL shows no significant phishing signals. Exercise normal caution online.",
    };
  }
  if (score <= 45) {
    return {
      status: "⚠️ Proceed with Caution",
      message: "Some risk signals detected. Verify the site owner and avoid sharing sensitive details.",
    };
  }
  if (score <= 70) {
    return {
      status: "🚨 High Risk",
      message: "Multiple phishing indicators detected. Do not enter credentials or download files.",
    };
  }
  return {
    status: "🔴 Extremely Dangerous",
    message: "Strong phishing signals. Block this URL and report it to cybercrime.gov.in immediately.",
  };
}

/**
 * analyzeUrl(urlStr) → phishing result object
 */
function analyzeUrl(urlStr) {
  const urlObj = getDomain(urlStr);
  const { hostname } = urlObj;

  const checks = [
    analyzeSpelling(hostname),
    analyzeDomainAge(hostname),
    analyzeIPUsage(hostname),
    analyzeSecuritySignals(urlObj),
    analyzeKeywords(urlStr),
  ];

  const totalScore = Math.min(
    Math.round(checks.reduce((sum, c) => sum + c.score, 0)),
    100
  );

  return {
    url: urlStr,
    score: totalScore,
    safety_recommendation: buildRecommendation(totalScore),
    details: checks,
    report_path: `report_${Date.now()}.json`,
    analyzed_at: new Date().toISOString(),
  };
}

module.exports = { analyzeUrl };
