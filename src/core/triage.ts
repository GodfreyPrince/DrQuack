/**
 * Triage core: pure, dependency-free logic for classifying symptom reports
 * into a severity level. Kept separate from the MCP tool wrapper so it can
 * be unit tested directly and reused by other surfaces (API, CLI).
 */

export type SeverityLevel = "SELF_CARE" | "PRIMARY_CARE" | "URGENT" | "EMERGENCY";

export interface RedFlagRule {
  id: string;
  /** Substrings matched against normalized symptom text (lowercase). */
  patterns: string[];
  reason: string;
  /**
   * Optional extra predicate, e.g. age-aware rules
   * (fever in an infant under 3 months is an emergency).
   */
  condition?: (normalized: string, age?: number) => boolean;
}

export interface RedFlagMatch {
  id: string;
  reason: string;
}

export interface TriageSignal {
  level: SeverityLevel;
  message: string;
}

export interface TriageInput {
  symptoms: string;
  age?: number;
  /** Free-text duration supplied by the user, e.g. "3 days". */
  duration?: string;
}

export interface TriageResult {
  severity: SeverityLevel;
  redFlags: RedFlagMatch[];
  signals: TriageSignal[];
}

export const SEVERITY_LABELS: Record<SeverityLevel, string> = {
  SELF_CARE: "Self-care is likely sufficient, with monitoring",
  PRIMARY_CARE: "See a doctor (primary care) within a few days",
  URGENT: "Seek care today - urgent care or same-day appointment",
  EMERGENCY: "Potential emergency - call emergency services now",
};

/** Normalize text: lowercase, strip punctuation, collapse whitespace. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const RED_FLAG_RULES: RedFlagRule[] = [
  {
    id: "chest_pain",
    patterns: [
      "chest pain",
      "chest pressure",
      "chest tightness",
      "pain in my chest",
      "crushing chest",
    ],
    reason: "Chest pain or pressure can signal a heart attack or other cardiac emergency.",
  },
  {
    id: "breathing",
    patterns: [
      "difficulty breathing",
      "shortness of breath",
      "cannot breathe",
      "can't breathe",
      "struggling to breathe",
      "hard to breathe",
      "wheezing and can't talk",
    ],
    reason: "Trouble breathing is an emergency until proven otherwise.",
  },
  {
    id: "unconscious",
    patterns: ["unconscious", "not waking up", "won't wake up", "passed out and did not wake"],
    reason: "Loss of consciousness needs immediate emergency evaluation.",
  },
  {
    id: "seizure",
    patterns: ["seizure", "convulsing", "convulsion", "fitting on the floor"],
    reason: "A seizure can indicate a serious neurologic emergency.",
  },
  {
    id: "severe_bleeding",
    patterns: ["severe bleeding", "bleeding heavily", "bleeding that won't stop", "gushing blood"],
    reason: "Severe or uncontrolled bleeding requires emergency care.",
  },
  {
    id: "stroke",
    patterns: [
      "face drooping",
      "face is drooping",
      "face feels droopy",
      "one side of my face drooping",
      "drooping on one side",
      "arm weakness on one side",
      "numbness on one side",
      "slurred speech",
      "speech is slurred",
      "sudden confusion",
      "worst headache of my life",
      "sudden severe headache",
    ],
    reason: "Sudden weakness, speech trouble, confusion, or a sudden severe headache can signal a stroke.",
  },
  {
    id: "anaphylaxis",
    patterns: [
      "throat closing",
      "throat swelling",
      "swelling of the face and lips",
      "swelling of my face",
      "anaphylaxis",
      "allergic reaction and trouble breathing",
    ],
    reason: "Swelling of the face or throat with breathing trouble is anaphylaxis - an emergency.",
  },
  {
    id: "blood_loss",
    patterns: [
      "coughing up blood",
      "vomiting blood",
      "blood in my vomit",
      "black tarry stool",
      "blood in my stool",
      "bleeding during pregnancy",
    ],
    reason: "Bleeding from the airway, gut, or during pregnancy is an emergency signal.",
  },
  {
    id: "self_harm",
    patterns: [
      "suicidal",
      "want to kill myself",
      "wanting to hurt myself",
      "thinking about suicide",
      "self harm",
      "self-harm",
    ],
    reason: "Thoughts of suicide or self-harm need immediate crisis support.",
  },
  {
    id: "abdomen",
    patterns: [
      "sudden severe abdominal pain",
      "severe stomach pain",
      "unbearable abdominal pain",
      "rigid belly",
    ],
    reason: "Sudden or severe abdominal pain can signal appendicitis or other emergencies.",
  },
  {
    id: "head_injury",
    patterns: [
      "hit my head and",
      "head injury",
      "fell and hit my head",
      "headache after a fall",
    ],
    reason: "Head injury with symptoms needs emergency evaluation to rule out bleeding in the brain.",
  },
  {
    id: "infant_fever",
    patterns: ["fever", "temperature"],
    reason: "Fever in a baby under 3 months old is an emergency - the immune system is not fully developed.",
    condition: (_normalized, age) => age !== undefined && age < 3,
  },
];

export const MODERATE_SIGNALS: { patterns: string[]; message: string }[] = [
  {
    patterns: ["high fever", "fever above 39", "fever over 39", "fever of 102", "fever of 103", "temperature 39"],
    message: "High fever can indicate a significant infection that should be evaluated today.",
  },
  {
    patterns: ["vomiting for more than", "can't keep fluids down", "cannot keep fluids down", "persistent vomiting", "vomiting all day"],
    message: "Persistent vomiting risks dehydration and should be seen today.",
  },
  {
    patterns: ["severe pain", "unbearable pain", "excruciating pain", "agonizing pain", "worst pain"],
    message: "Severe pain should be evaluated today.",
  },
  {
    patterns: ["rash with fever", "rash and fever"],
    message: "A rash with fever can be a sign of a serious infection such as meningitis.",
  },
  {
    patterns: ["can't urinate", "cannot urinate", "burning when i urinate", "pain when urinating", "blood in urine"],
    message: "Urinary symptoms may need evaluation and treatment today.",
  },
  {
    patterns: ["burn larger than", "burn on my face", "burn on my hands"],
    message: "Large or sensitive-area burns need prompt professional care.",
  },
];

export const MILD_SIGNALS: { patterns: string[]; message: string }[] = [
  {
    patterns: ["mild headache", "slight headache", "tension headache"],
    message: "Mild headache usually settles with rest, fluids, and over-the-counter pain relief.",
  },
  {
    patterns: ["runny nose", "sneezing", "stuffy nose", "congestion", "mild cough", "sore throat", "scratchy throat"],
    message: "Cold-like symptoms usually resolve on their own within a week.",
  },
  {
    patterns: ["mild fever", "low fever", "fever of 99", "fever of 100", "temperature 37", "temperature 38"],
    message: "A mild fever is often the body fighting off a routine infection.",
  },
  {
    patterns: ["minor cut", "small cut", "scrape", "scratch", "minor burn", "small burn", "mild muscle ache", "mild back pain"],
    message: "Minor injuries and aches can usually be managed with rest and basic first aid.",
  },
  {
    patterns: ["mild diarrhea", "loose stools", "mild nausea", "fatigue", "tiredness", "mild fatigue"],
    message: "Mild digestive or fatigue symptoms usually settle with rest and hydration.",
  },
];

const ESCALATING_ADJECTIVES = ["severe", "unbearable", "excruciating", "agonizing", "extreme", "debilitating", "worst"];

export function detectRedFlags(text: string, age?: number): RedFlagMatch[] {
  const normalized = normalize(text);
  const matches: RedFlagMatch[] = [];
  for (const rule of RED_FLAG_RULES) {
    const patternHit = rule.patterns.some((p) => normalized.includes(normalize(p)));
    if (!patternHit) continue;
    // Rules with a condition (e.g. infant fever) must satisfy BOTH the
    // symptom pattern and the condition, so a plain "fever" in an adult
    // is never escalated by the infant rule.
    const conditionHit = rule.condition ? rule.condition(normalized, age) : true;
    if (conditionHit) {
      matches.push({ id: rule.id, reason: rule.reason });
    }
  }
  return matches;
}

export function assessTriage(input: TriageInput): TriageResult {
  const normalized = normalize(input.symptoms);
  const signals: TriageSignal[] = [];

  const redFlags = detectRedFlags(input.symptoms, input.age);
  if (redFlags.length > 0) {
    for (const flag of redFlags) {
      signals.push({ level: "EMERGENCY", message: flag.reason });
    }
    return { severity: "EMERGENCY", redFlags, signals };
  }

  for (const signal of MODERATE_SIGNALS) {
    if (signal.patterns.some((p) => normalized.includes(normalize(p)))) {
      signals.push({ level: "URGENT", message: signal.message });
    }
  }
  if (signals.some((s) => s.level === "URGENT")) {
    return { severity: "URGENT", redFlags: [], signals };
  }

  const hasEscalating = ESCALATING_ADJECTIVES.some((word) => normalized.includes(word));
  if (!hasEscalating && normalized.length > 0) {
    const mildHits = MILD_SIGNALS.filter((signal) =>
      signal.patterns.some((p) => normalized.includes(normalize(p))),
    );
    for (const signal of mildHits) {
      signals.push({ level: "SELF_CARE", message: signal.message });
    }
    // If every matched signal is mild, self-care is reasonable.
    if (mildHits.length > 0 && signals.every((s) => s.level === "SELF_CARE")) {
      return { severity: "SELF_CARE", redFlags: [], signals };
    }
  }

  signals.push({
    level: "PRIMARY_CARE",
    message:
      "These symptoms are not clearly self-limiting - a primary care evaluation is the safest path.",
  });
  return { severity: "PRIMARY_CARE", redFlags: [], signals };
}