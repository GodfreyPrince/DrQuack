import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { EMERGENCY_GUIDANCE } from "../core/disclaimer.js";
import {
  assessTriage,
  SEVERITY_LABELS,
  type SeverityLevel,
} from "../core/triage.js";
import { registerSafeTool } from "./shared.js";

const inputSchema = {
  symptoms: z
    .string()
    .min(3)
    .describe("Description of the symptoms, in the patient's own words."),
  duration: z
    .string()
    .optional()
    .describe("How long the symptoms have been present, e.g. 'since yesterday' or '3 days'."),
  age: z
    .number()
    .int()
    .positive()
    .max(120)
    .optional()
    .describe("Patient's age in years (months for infants, e.g. 0.5 for 6 months)."),
  existingConditions: z
    .array(z.string())
    .optional()
    .describe("Known medical conditions, e.g. ['diabetes', 'asthma']."),
  currentMedications: z
    .array(z.string())
    .optional()
    .describe("Medications the patient is currently taking."),
};

export function registerAssessSymptoms(server: McpServer): void {
  registerSafeTool(
    server,
    "assess_symptoms",
    [
      "Classify a patient's symptom report into a severity level: SELF_CARE, PRIMARY_CARE, URGENT, or EMERGENCY.",
      "Detects emergency red flags (chest pain, breathing trouble, stroke signs, etc.) and forces EMERGENCY when found.",
      "Returns structured recommendations and guidance for the next step.",
      "This is decision support, never a diagnosis.",
    ].join(" "),
    inputSchema,
    async (args) => {
      const result = assessTriage({ symptoms: args.symptoms, duration: args.duration, age: args.age });

      const severity: SeverityLevel = result.severity;
      const recommendations: string[] = [];

      if (severity === "EMERGENCY") {
        recommendations.push(EMERGENCY_GUIDANCE);
        recommendations.push(
          "While help is on the way: stay with the patient, keep them comfortable, do not give food or drink unless advised, and be ready to describe their symptoms and medications to responders.",
        );
      } else if (severity === "URGENT") {
        recommendations.push(
          "Seek care today: visit urgent care, or ask your doctor's office for a same-day appointment. Bring a list of symptoms, their duration, and any medications.",
        );
      } else if (severity === "PRIMARY_CARE") {
        recommendations.push(
          "Book an appointment with a primary care or family physician within a few days. Use find_providers to locate one, then request_consultation to connect.",
        );
      } else {
        recommendations.push(
          "Self-care with monitoring is reasonable: rest, fluids, and over-the-counter remedies if appropriate. Watch for warning signs - if symptoms worsen, last longer than a week, or new symptoms appear, escalate to a doctor.",
        );
      }

      return {
        severity,
        severityMeaning: SEVERITY_LABELS[severity],
        redFlags: result.redFlags,
        signals: result.signals,
        recommendations,
        nextTools:
          severity === "EMERGENCY"
            ? ["find_emergency_care"]
            : severity === "SELF_CARE"
              ? []
              : ["find_providers", "request_consultation"],
        patientContext: {
          age: args.age ?? "not provided",
          existingConditions: args.existingConditions ?? [],
          currentMedications: args.currentMedications ?? [],
        },
      };
    },
  );
}