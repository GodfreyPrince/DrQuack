import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { providerDirectory } from "../db/providerDirectory.js";
import { registerSafeTool } from "./shared.js";

export function registerRequestConsultation(server: McpServer): void {
  registerSafeTool(
    server,
    "request_consultation",
    [
      "Connect a patient to a doctor, clinic, or hospital from the directory.",
      "Creates a consultation request (mock in this scaffold) and returns the booking reference plus next steps.",
      "Requires a provider id from find_providers or find_emergency_care.",
    ].join(" "),
    {
      providerId: z
        .string()
        .describe("Provider id as returned by find_providers, e.g. 'p-001'."),
      patientName: z
        .string()
        .optional()
        .describe("Patient's name, only if the patient consents to share it."),
      reason: z
        .string()
        .min(3)
        .describe("Short reason for the consultation, e.g. 'Persistent fever and cough for 3 days'."),
      preferredTime: z
        .string()
        .optional()
        .describe("Preferred time, e.g. 'tomorrow morning' or 'anytime today'."),
      mode: z
        .enum(["IN_PERSON", "TELEHEALTH"])
        .optional()
        .describe("Consultation mode; defaults to what the provider supports."),
    },
    async (args) => {
      const provider = await providerDirectory.getById(args.providerId);
      if (!provider) {
        return {
          ok: false,
          error: `No provider found with id '${args.providerId}'. Run find_providers first and use a returned id.`,
        };
      }

      const telehealthRequested = args.mode === "TELEHEALTH";
      if (telehealthRequested && !provider.telehealthAvailable) {
        return {
          ok: false,
          error: `${provider.name} does not offer telehealth. Request an in-person visit or pick a provider with telehealthAvailable: true.`,
        };
      }
      if (args.mode === "IN_PERSON" && provider.emergency) {
        return {
          ok: false,
          error: `${provider.facility} is an emergency department - walk in or call ahead directly rather than booking a consultation.`,
        };
      }

      const reference = `DQ-${Date.now().toString(36).toUpperCase().slice(-6)}`;

      return {
        ok: true,
        reference,
        status: "REQUESTED",
        provider: {
          id: provider.id,
          name: provider.name,
          specialty: provider.specialty,
          facility: provider.facility,
          phone: provider.phone,
          address: provider.address,
        },
        mode: args.mode ?? (provider.telehealthAvailable ? "TELEHEALTH" : "IN_PERSON"),
        preferredTime: args.preferredTime ?? provider.nextAvailableSlot,
        reason: args.reason,
        nextSteps: [
          `The provider's office (${provider.phone}) will confirm the appointment. Ask about fees and documents needed.`,
          `For a ${args.mode === "TELEHEALTH" || (args.mode === undefined && provider.telehealthAvailable) ? "video" : "in-person"} visit, have your symptoms, duration, and medication list ready.`,
          "If symptoms worsen while waiting, seek urgent care or call emergency services - do not wait for the appointment.",
        ],
      };
    },
  );
}