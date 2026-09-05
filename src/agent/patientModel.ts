/**
 * The evolving patient model. The agent accumulates findings across turns;
 * triage re-runs over the full transcript so severity always reflects
 * everything the patient has said.
 *
 * Extraction here is deliberately conservative rule-based logic: age,
 * conditions, and medications are pulled with simple patterns. The
 * interview engine (interview.ts) fills the qualitative elements.
 */

import { MOCK_MEDICATIONS } from "../data/medications.js";

export interface PatientModel {
  /** Chief complaint as first described by the patient. */
  chiefComplaint?: string;
  age?: number;
  ageNote?: string;
  conditions: string[];
  medications: string[];
  allergies: string[];
  /** Free text of everything the patient has said (the raw history). */
  historyText: string;
  /** Qualitative HPI elements answered so far. */
  hpi: Record<string, string>;
  /** Review-of-systems probes already asked. */
  askedProbes: string[];
  /** Extra structured findings captured from answers. */
  findings: string[];
}

export function emptyModel(): PatientModel {
  return {
    conditions: [],
    medications: [],
    allergies: [],
    historyText: "",
    hpi: {},
    askedProbes: [],
    findings: [],
  };
}

const AGE_PATTERNS: { re: RegExp; note: (v: string) => string }[] = [
  { re: /\b(\d{1,2})\s*(?:years?\s*(?:old)?|yrs?\.?|yo)\b/i, note: (v) => `${v} years` },
  { re: /\b(?:i am|i'm|im)\s+(\d{1,2})\b/i, note: (v) => `${v} years` },
  { re: /\b(?:age|aged)\s+(\d{1,2})\b/i, note: (v) => `${v} years` },
  { re: /\b(\d{1,2})\s*months?\b/i, note: (v) => `${v} months` },
];

const CONDITION_KEYWORDS: { word: RegExp; label: string }[] = [
  { word: /\bdiabet\w*\b/i, label: "diabetes" },
  { word: /\bhypertension\b|\bhigh blood pressure\b/i, label: "hypertension" },
  { word: /\basthma\b/i, label: "asthma" },
  { word: /\bheart disease\b|\bcardiac\b|\bheart condition\b/i, label: "heart disease" },
  { word: /\bkidney\b/i, label: "kidney disease" },
  { word: /\bliver\b|\bcirrhosis\b/i, label: "liver disease" },
  { word: /\bthyroid\b/i, label: "thyroid disease" },
  { word: /\bepilepsy\b|\bseizure disorder\b/i, label: "epilepsy" },
  { word: /\bdepression\b/i, label: "depression" },
  { word: /\banxiety\b/i, label: "anxiety" },
  { word: /\bcancer\b/i, label: "cancer" },
  { word: /\bimmune\b|\bautoimmune\b/i, label: "autoimmune condition" },
];

export function extractAge(text: string): { age?: number; ageNote?: string } {
  for (const { re, note } of AGE_PATTERNS) {
    const m = text.match(re);
    if (m?.[1]) {
      const months = re.source.includes("months");
      const value = Number(m[1]);
      return { age: months ? value / 12 : value, ageNote: note(m[1]) };
    }
  }
  return {};
}

export function extractConditions(text: string, known: string[]): string[] {
  const found = new Set(known.map((c) => c.toLowerCase()));
  for (const { word, label } of CONDITION_KEYWORDS) {
    if (word.test(text)) found.add(label);
  }
  return [...found];
}

export function extractMedications(text: string, known: string[]): string[] {
  const found = new Set(known.map((m) => m.toLowerCase()));
  for (const med of MOCK_MEDICATIONS) {
    const names = [med.name, med.genericName, ...med.commonBrands];
    for (const n of names) {
      if (n.length >= 3 && text.toLowerCase().includes(n.toLowerCase())) {
        found.add(med.name);
        break;
      }
    }
  }
  return [...found];
}

export function extractAllergies(text: string, known: string[]): string[] {
  const found = new Set(known.map((a) => a.toLowerCase()));
  const m = text.match(/\ballergic to\s+([^.,;]+)/i);
  if (m?.[1]) {
    for (const item of m[1].split(/\band\b|,|\//)) {
      const trimmed = item.trim().toLowerCase();
      if (trimmed) found.add(trimmed);
    }
  }
  return [...found];
}

/** Messages that are not a chief complaint (greetings, fillers). */
const NON_COMPLAINTS = new Set([
  "hi",
  "hello",
  "hey",
  "yo",
  "namaste",
  "good morning",
  "good afternoon",
  "good evening",
  "how are you",
  "what do you do",
  "test",
]);

/** Symptom-like words that mark a real chief complaint. */
const SYMPTOM_HINT =
  /\b(pain|hurt|ache|headache|stomachache|toothache|earache|backache|heartburn|fever|cough|cold|sore|stomach|head|chest|nausea|vomit|diarrhea|rash|burn|cut|bleed|breath|tired|dizzy|itch|swell|infection|flu|allerg|injur|fell|fall|sick|ill|throat|ear|eye|back|knee|leg|arm|hand|foot|tooth)\b/i;

export function looksLikeComplaint(message: string): boolean {
  const t = message.trim();
  if (t.length < 6) return false;
  if (NON_COMPLAINTS.has(t.toLowerCase())) return false;
  return t.length >= 20 || SYMPTOM_HINT.test(t);
}

/**
 * Incorporate a new patient utterance into the model. Runs after the
 * safety check, so emergency red flags have already been handled.
 */
export function updateModel(model: PatientModel, message: string): PatientModel {
  const next: PatientModel = {
    ...model,
    historyText: [model.historyText, message].filter(Boolean).join("\n"),
  };

  const { age, ageNote } = extractAge(message);
  if (age !== undefined && next.age === undefined) {
    next.age = age;
    next.ageNote = ageNote;
  }

  if (!next.chiefComplaint && looksLikeComplaint(message)) {
    next.chiefComplaint = message.slice(0, 280);
  }

  next.conditions = extractConditions(message, model.conditions);
  next.medications = extractMedications(message, model.medications);
  next.allergies = extractAllergies(message, model.allergies);

  return next;
}