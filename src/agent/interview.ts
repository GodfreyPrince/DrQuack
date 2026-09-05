/**
 * The elicitation engine: an adaptive clinical interview.
 *
 * Rules own the method (what to ask, in what order, when to stop, when to
 * escalate) so safety and completeness are deterministic. The LLM owns the
 * voice (rendering each question naturally, warmly, in plain language).
 *
 * Interview stages follow a structured history:
 *   OPENING  - establish the chief complaint
 *   HPI      - history of present illness (OLD CARTS elements)
 *   ROS      - targeted review of systems probes for the chief complaint
 *   PMH      - past medical history, medications, allergies
 *   DECISION - enough gathered: classify and recommend
 */

import { assessTriage, SEVERITY_LABELS, type SeverityLevel } from "../core/triage.js";
import type { PatientModel } from "./patientModel.js";

export type InterviewStage = "OPENING" | "HPI" | "ROS" | "PMH" | "DECISION";

export interface QuestionIntent {
  /** The stage this question belongs to. */
  stage: InterviewStage;
  /** Short label for the intent, e.g. "hpi.duration". */
  id: string;
  /** The question to ask, in the agent's voice. */
  question: string;
  /** What the answer is for - used for LLM context. */
  purpose: string;
}

export interface InterviewUpdate {
  stage: InterviewStage;
  severity: SeverityLevel;
  redFlags: string[];
  intent: QuestionIntent | null;
  /** True when the interview is complete and a recommendation is due. */
  done: boolean;
}

/** HPI elements (OLD CARTS) with a fill-check per element. */
const HPI_ELEMENTS: { id: string; label: string; question: string; filled: (text: string) => boolean }[] = [
  {
    id: "onset",
    label: "when it started",
    question: "When did this first start? Was it sudden or gradual?",
    filled: (t) => /\b(started|began|since|first (?:noticed|felt|had))\b/.test(t) || /\b\d+\s*(days|weeks|hours|months)\s*(ago|back)?\b/.test(t),
  },
  {
    id: "duration",
    label: "how long it lasts",
    question: "How long does it last each time - is it constant, or does it come and go?",
    filled: (t) => /\b(constant|continuous|intermittent|comes and goes|off and on|on and off|all day|all the time|for \d+)\b/.test(t),
  },
  {
    id: "character",
    label: "what it feels like",
    question: "Can you describe what it feels like? For example, sharp, dull, burning, pressure, or throbbing?",
    filled: (t) => /\b(sharp|dull|burning|pressure|throbbing|aching|stabbing|cramping|pulsing|tight|squeezing|heavy)\b/.test(t),
  },
  {
    id: "severity",
    label: "how bad it is",
    question: "On a scale of 1 to 10, how bad is it right now - and is it getting worse?",
    filled: (t) => /\b(\d+\s*(out\s*of\s*)?1?0?|\/\s*10)\b/.test(t) || /\b(severe|mild|moderate|unbearable|worst)\b/.test(t),
  },
  {
    id: "aggravating",
    label: "what makes it worse",
    question: "Is there anything that makes it worse - certain movements, food, activity, or stress?",
    filled: (t) => /\b(worse|aggravated|triggered|hurts more|painful when)\b/.test(t),
  },
  {
    id: "relieving",
    label: "what makes it better",
    question: "And does anything make it better - rest, medication, heat or cold, lying down?",
    filled: (t) => /\b(better|relieved|helps|improves|eases|lessens|goes away with)\b/.test(t),
  },
];

/**
 * Hypothesis-driven ROS probes keyed by chief-complaint keywords.
 * Each probe is asked once per session.
 */
const ROS_PROBES: { keywords: string[]; probes: { id: string; question: string; purpose: string }[] }[] = [
  {
    keywords: ["chest", "heart", "pressure", "palpitation"],
    probes: [
      { id: "ros.chest.radiation", question: "Does the pain spread to your arm, jaw, neck, or back?", purpose: "chest pain radiation" },
      { id: "ros.chest.sweating", question: "Are you sweating, feeling nauseous, or lightheaded with it?", purpose: "associated autonomic symptoms" },
      { id: "ros.chest.breathe", question: "Any shortness of breath with the pain?", purpose: "dyspnea association" },
      { id: "ros.chest.risk", question: "Do you have a history of heart disease, diabetes, or high blood pressure? Do you smoke?", purpose: "cardiac risk factors" },
    ],
  },
  {
    keywords: ["breathe", "breathing", "wheeze", "cough", "asthma"],
    probes: [
      { id: "ros.breath.position", question: "Does lying flat make the breathing harder, or is it better sitting up?", purpose: "orthopnea" },
      { id: "ros.breath.sputum", question: "Are you coughing anything up - and if so, what color?", purpose: "sputum character" },
      { id: "ros.breath.fever", question: "Do you have a fever or chills with this?", purpose: "infection signs" },
      { id: "ros.breath.smoke", question: "Do you smoke, or have you in the past?", purpose: "exposure history" },
    ],
  },
  {
    keywords: ["fever", "temperature", "chills", "flu"],
    probes: [
      { id: "ros.fever.rash", question: "Any rash, or a stiff neck with the fever?", purpose: "meningitis/rickettsial signs" },
      { id: "ros.fever.headache", question: "Any severe headache or sensitivity to light?", purpose: "meningitis signs" },
      { id: "ros.fever.urine", question: "Any pain or burning when you urinate?", purpose: "urinary infection" },
      { id: "ros.fever.travel", question: "Any recent travel or contact with someone who is sick?", purpose: "exposure history" },
    ],
  },
  {
    keywords: ["stomach", "abdominal", "belly", "abdomen", "vomit", "nausea", "diarrhea"],
    probes: [
      { id: "ros.gi.location", question: "Where exactly is the pain - and does it move?", purpose: "pain localization" },
      { id: "ros.gi.blood", question: "Any blood in your vomit or stool? Has your stool been black or tarry?", purpose: "GI bleeding signs" },
      { id: "ros.gi.eating", question: "Is it related to eating, or worse on an empty stomach?", purpose: "meal relationship" },
      { id: "ros.gi.fever", question: "Any fever or chills with the stomach symptoms?", purpose: "inflammatory signs" },
    ],
  },
  {
    keywords: ["headache", "head pain", "migraine"],
    probes: [
      { id: "ros.head.vision", question: "Any vision changes, numbness, or weakness with the headache?", purpose: "neurologic signs" },
      { id: "ros.head.worst", question: "Is this the worst headache you have ever had?", purpose: "sentinel headache" },
      { id: "ros.head.fever", question: "Any fever or stiff neck?", purpose: "meningitis signs" },
      { id: "ros.head.injury", question: "Did you hit your head recently?", purpose: "trauma history" },
    ],
  },
  {
    keywords: ["injured", "injury", "fell", "twisted", "sprain", "cut", "wound", "burn", "fracture", "broken"],
    probes: [
      { id: "ros.injury.move", question: "Can you move the area, and put weight on it if it is a limb?", purpose: "function status" },
      { id: "ros.injury.swelling", question: "Any swelling, deformity, numbness, or color change?", purpose: "injury severity" },
      { id: "ros.injury.tetanus", question: "For cuts or wounds - when was your last tetanus shot?", purpose: "tetanus prophylaxis" },
      { id: "ros.injury.mechanism", question: "What happened exactly - and did you hit your head or lose consciousness?", purpose: "mechanism of injury" },
    ],
  },
];

const PMH_QUESTIONS: { id: string; question: string; purpose: string }[] = [
  { id: "pmh.conditions", question: "Do you have any ongoing medical conditions, or has anything like this happened before?", purpose: "past medical history" },
  { id: "pmh.medications", question: "Are you currently taking any medicines, including over-the-counter ones?", purpose: "current medications" },
  { id: "pmh.allergies", question: "And any allergies - especially to medicines?", purpose: "drug allergies" },
];

export function pickRosProbes(chiefComplaint: string, model: PatientModel): { id: string; question: string; purpose: string }[] {
  const text = `${chiefComplaint} ${model.historyText}`.toLowerCase();
  const asked = new Set(model.askedProbes);
  const chosen: { id: string; question: string; purpose: string }[] = [];
  for (const group of ROS_PROBES) {
    if (group.keywords.some((k) => text.includes(k))) {
      for (const probe of group.probes) {
        if (!asked.has(probe.id)) chosen.push(probe);
      }
    }
  }
  return chosen;
}

/** True when all HPI elements are answered. */
function hpiComplete(model: PatientModel): boolean {
  return HPI_ELEMENTS.every((e) => !!model.hpi[e.id]);
}

export function assessHpiFill(model: PatientModel): void {
  // Re-derive element fill from what the patient has said.
  for (const element of HPI_ELEMENTS) {
    if (!model.hpi[element.id] && element.filled(model.historyText)) {
      model.hpi[element.id] = element.label;
    }
  }
}

/**
 * Compute the next interview step for a session. Pure and deterministic -
 * the LLM only renders the resulting intent.
 */
export function nextInterviewStep(model: PatientModel, severity: SeverityLevel): InterviewUpdate {
  assessHpiFill(model);

  // Safety: never continue a friendly interview over an emergency.
  if (severity === "EMERGENCY") {
    return { stage: "DECISION", severity, redFlags: [], intent: null, done: true };
  }

  if (!model.chiefComplaint) {
    return {
      stage: "OPENING",
      severity,
      redFlags: [],
      intent: {
        stage: "OPENING",
        id: "opening.chief",
        question: "I am DrQuack, your health assistant. Before anything else - what is the main thing that is bothering you today?",
        purpose: "establish the chief complaint",
      },
      done: false,
    };
  }

  if (!hpiComplete(model)) {
    const missing = HPI_ELEMENTS.find((e) => !model.hpi[e.id]);
    if (missing) {
      return {
        stage: "HPI",
        severity,
        redFlags: [],
        intent: { stage: "HPI", id: `hpi.${missing.id}`, question: missing.question, purpose: missing.label },
        done: false,
      };
    }
  }

  const probes = pickRosProbes(model.chiefComplaint, model);
  const probe = probes[0];
  if (probe) {
    return {
      stage: "ROS",
      severity,
      redFlags: [],
      intent: { stage: "ROS", id: probe.id, question: probe.question, purpose: probe.purpose },
      done: false,
    };
  }

  const pmh = PMH_QUESTIONS.find((q) => !model.hpi[`pmh.${q.id}`]);
  if (pmh) {
    return {
      stage: "PMH",
      severity,
      redFlags: [],
      intent: { stage: "PMH", id: `pmh.${pmh.id}`, question: pmh.question, purpose: pmh.purpose },
      done: false,
    };
  }

  return { stage: "DECISION", severity, redFlags: [], intent: null, done: true };
}

/** Mark a question as asked/answered in the model. */
export function recordAsked(model: PatientModel, intentId: string): void {
  if (intentId.startsWith("ros.") && !model.askedProbes.includes(intentId)) {
    model.askedProbes.push(intentId);
  }
  if (intentId.startsWith("pmh.") && !model.hpi[intentId]) {
    model.hpi[intentId] = "asked";
  }
  if (intentId.startsWith("hpi.") && !model.hpi[intentId]) {
    model.hpi[intentId] = "answered";
  }
}

/** Plain-language recommendation template for the DECISION stage. */
export function recommendationFor(severity: SeverityLevel): string {
  if (severity === "EMERGENCY") {
    return (
      "Based on everything you have told me, this needs emergency attention right now. " +
      "Call your local emergency number (112 or 108 in India, 911 in the US, 999 in the UK) " +
      "or go to the nearest hospital emergency department immediately. Do not wait."
    );
  }
  return `Based on everything you have told me, ${SEVERITY_LABELS[severity].toLowerCase()}.`;
}

/** Convenience for full-session triage over accumulated history. */
export function triageModel(model: PatientModel): {
  severity: SeverityLevel;
  redFlags: { id: string; reason: string }[];
} {
  const result = assessTriage({
    symptoms: model.historyText || model.chiefComplaint || "",
    age: model.age,
  });
  return { severity: result.severity, redFlags: result.redFlags };
}