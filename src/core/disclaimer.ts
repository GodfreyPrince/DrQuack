/**
 * Global safety disclaimers and emergency guidance.
 * Every tool output should carry the disclaimer so LLM clients always
 * surface it to the patient.
 */

export const DISCLAIMER =
  "DrQuack is decision-support software, not a licensed medical professional. " +
  "It does not provide a medical diagnosis and cannot replace examination by a " +
  "qualified clinician. Always confirm any plan with a doctor or pharmacist. " +
  "If symptoms worsen or new symptoms appear, seek care promptly.";

export const EMERGENCY_GUIDANCE =
  "This looks like a potential medical emergency. Call your local emergency " +
  "number now (112 or 108 in India, 911 in the US, 999 in the UK) or go to the " +
  "nearest hospital emergency department immediately. Do not wait for an " +
  "online assessment. If someone is unconscious or not breathing, start CPR " +
  "if you are trained and ask someone nearby to call for help.";