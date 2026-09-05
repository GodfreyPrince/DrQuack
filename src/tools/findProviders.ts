import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { providerDirectory } from "../db/providerDirectory.js";
import { registerSafeTool } from "./shared.js";

export function registerFindProviders(server: McpServer): void {
  registerSafeTool(
    server,
    "find_providers",
    [
      "Search the provider directory for doctors and clinics matching a specialty and location.",
      "Returns contact details, telehealth availability, next available slot, and rating.",
      "Data is mock/placeholder in this scaffold.",
    ].join(" "),
    {
      location: z
        .string()
        .optional()
        .describe("City, e.g. 'Bengaluru', 'Chennai', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune'."),
      specialty: z
        .string()
        .optional()
        .describe("Specialty keyword, e.g. 'General Physician', 'Cardiologist', 'Pediatrician'."),
      telehealthOnly: z
        .boolean()
        .optional()
        .describe("Only return providers offering video consultations."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .describe("Maximum number of results (default 5)."),
    },
    async (args) => {
      const providers = await providerDirectory.search({
        location: args.location,
        specialty: args.specialty,
        telehealthOnly: args.telehealthOnly,
        limit: args.limit ?? 5,
      });

      return {
        count: providers.length,
        query: {
          location: args.location ?? "any",
          specialty: args.specialty ?? "any",
          telehealthOnly: args.telehealthOnly ?? false,
        },
        providers: providers.map((p) => ({
          id: p.id,
          name: p.name,
          specialty: p.specialty,
          facility: p.facility,
          city: p.city,
          address: p.address,
          phone: p.phone,
          telehealthAvailable: p.telehealthAvailable,
          acceptsSelfReferral: p.acceptsSelfReferral,
          nextAvailableSlot: p.nextAvailableSlot,
          rating: p.rating,
        })),
        hint:
          providers.length === 0
            ? "No providers matched. Try a different specialty or city, or drop the filters."
            : "Use request_consultation with a provider id to connect the patient.",
      };
    },
  );
}