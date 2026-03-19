export const demoScenarios = [
  {
    id: "phishing-fraud",
    label: "Bank Link Fraud",
    incident:
      "I received a text that looked like it came from my bank, tapped the link, entered my OTP, and then money was deducted from my account.",
    timeWindow: "Last 25 minutes",
    urgency: "Live financial loss detected. Freeze payment channels and contact 1930 immediately.",
    suspects: [
      { label: "Phishing", score: 0.86 },
      { label: "UPI Fraud", score: 0.72 }
    ],
    keyFacts: [
      "Impersonation of a trusted bank",
      "Credential capture through a link",
      "Financial loss after OTP sharing"
    ],
    questions: [
      {
        id: "bank_link",
        prompt: "Did the message ask you to open a link that appeared to be from your bank?",
        note: "This confirms whether impersonation and lure tactics were involved.",
        rationale: "We ask this to confirm impersonation, lure behavior, and malicious link patterns.",
        feedback: {
          Yes: "This confirms a link-based phishing pattern.",
          No: "That weakens the phishing score and shifts focus to other fraud patterns.",
          "Not Sure": "That keeps phishing open but lowers certainty until other signals confirm it."
        }
      },
      {
        id: "otp_shared",
        prompt: "Did you enter your OTP, password, or PIN after opening the page?",
        note: "Credentials or OTP sharing is a strong sign of phishing-driven fraud.",
        rationale: "We ask this because OTP or credential entry strongly increases fraud confidence.",
        feedback: {
          Yes: "This confirms credential harvesting behavior.",
          No: "That reduces direct phishing certainty and suggests another attack path.",
          "Not Sure": "That keeps both phishing and social engineering routes under review."
        }
      },
      {
        id: "money_deducted",
        prompt: "Was any money debited or transferred after that interaction?",
        note: "Financial loss changes the urgency and reporting guidance immediately.",
        rationale: "We ask this to decide urgency, reporting path, and whether immediate bank action is required.",
        feedback: {
          Yes: "This confirms live financial fraud and raises urgency.",
          No: "That may still be an attempted cybercrime, but response urgency changes.",
          "Not Sure": "We still treat this carefully until account activity is verified."
        }
      }
    ],
    verdict: {
      kind: "confirmed_cybercrime",
      title: "Confirmed Cybercrime",
      subtitle: "Phishing and Financial Fraud",
      risk: "High",
      confidence: "High confidence after verification",
      explanation:
        "The incident combines impersonation, credential harvesting, and post-authentication financial loss. That pattern strongly matches phishing-driven financial fraud.",
      legalSections: ["IT Act 66C", "IT Act 66D", "IPC 420"],
      actionPlan: [
        "Call your bank and request an immediate account or card block.",
        "Report the fraud on 1930 as fast as possible while the transaction window is still fresh.",
        "File a complaint on cybercrime.gov.in with transaction details and screenshots.",
        "Preserve SMS, call logs, account alerts, and transaction references without editing them."
      ],
      evidence: [
        { label: "SMS or WhatsApp screenshot", priority: "Critical" },
        { label: "Transaction ID and debit alert", priority: "Critical" },
        { label: "Bank statement or app timeline", priority: "High" },
        { label: "Screenshot of phishing page", priority: "Useful" }
      ],
      studentNotes: [
        "Why 66C applies: identity details or credentials were misused.",
        "Why 66D applies: cheating happened through impersonation using a digital channel.",
        "Why IPC 420 matters: the deception resulted in wrongful financial loss."
      ],
      destination: "cybercrime.gov.in and nearest cyber cell",
      confidenceDrivers: ["link", "OTP", "bank", "money deducted"]
    }
  },
  {
    id: "marketplace-dispute",
    label: "Marketplace Delivery Issue",
    incident:
      "I paid an online seller for a product, they stopped responding after delay, and there is no sign that my bank or account was hacked.",
    timeWindow: "Two days ago",
    urgency: "No active account compromise detected. Review platform dispute and consumer options first.",
    suspects: [
      { label: "Marketplace Scam", score: 0.48 },
      { label: "Civil or Consumer Dispute", score: 0.63 }
    ],
    keyFacts: [
      "Payment dispute with a seller",
      "No account takeover or phishing signal",
      "Likely consumer grievance before cybercrime escalation"
    ],
    questions: [
      {
        id: "seller_platform",
        prompt: "Did the transaction happen through a known shopping platform or marketplace account?",
        note: "Platform disputes often have internal grievance paths before police escalation.",
        rationale: "We ask this because marketplace disputes often belong in platform and consumer workflows first.",
        feedback: {
          Yes: "This supports a platform dispute route over immediate cybercrime escalation.",
          No: "That keeps scam or fraud possibilities more open.",
          "Not Sure": "We need more context before deciding between dispute and deception routes."
        }
      },
      {
        id: "credential_loss",
        prompt: "Did you share OTP, PIN, password, or click a suspicious verification link?",
        note: "If not, it may not fit the cybercrime pattern described in the core law engine.",
        rationale: "We ask this to separate a normal seller dispute from account compromise or phishing.",
        feedback: {
          Yes: "That reopens cybercrime indicators and needs deeper verification.",
          No: "This supports the not-a-cybercrime route.",
          "Not Sure": "That keeps both dispute and fraud paths active for now."
        }
      },
      {
        id: "account_access",
        prompt: "Was your bank, email, or shopping account accessed without your permission?",
        note: "Unauthorized access would push the case back toward cybercrime handling.",
        rationale: "We ask this because unauthorized access is a stronger cybercrime signal than delayed delivery.",
        feedback: {
          Yes: "This shifts the case back toward cybercrime handling.",
          No: "This strengthens the consumer-dispute interpretation.",
          "Not Sure": "We need account history checks before final routing."
        }
      }
    ],
    verdict: {
      kind: "not_a_cybercrime",
      title: "Not a Clear Cybercrime",
      subtitle: "Likely Consumer or Civil Dispute",
      risk: "Medium",
      confidence: "Needs platform and payment trail review",
      explanation:
        "Based on the current facts, this looks more like a seller dispute or grievance issue than a direct cyber offense such as phishing, hacking, or account compromise.",
      legalSections: [
        "Consumer grievance route",
        "Platform dispute resolution",
        "Bank chargeback review if applicable"
      ],
      actionPlan: [
        "Open a grievance with the marketplace or seller platform first.",
        "Preserve order IDs, payment receipts, and seller chat records.",
        "If card or UPI abuse appears later, restart triage as a fraud case immediately.",
        "If the seller identity was fake and digital deception expands, escalate through consumer and police channels together."
      ],
      evidence: [
        { label: "Order confirmation and invoice", priority: "Critical" },
        { label: "Seller chat and timeline", priority: "High" },
        { label: "Payment receipt or UPI proof", priority: "Critical" },
        { label: "Marketplace ticket history", priority: "Useful" }
      ],
      studentNotes: [
        "This is a good example of why the system must detect non-crimes instead of over-classifying everything.",
        "Not every online problem is a cyber offense; routing matters as much as detection."
      ],
      destination: "Marketplace support, consumer grievance forum, and bank dispute desk if payment abuse is suspected",
      confidenceDrivers: ["seller", "delivery", "payment", "no hack signal"]
    }
  }
];

export const stageLabels = ["Understand", "Verify", "Confirm", "Act"];
