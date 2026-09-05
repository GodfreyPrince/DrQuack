import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { EMERGENCY_GUIDANCE } from "../core/disclaimer.js";
import { providerDirectory } from "../db/providerDirectory.js";
import { registerSafeTool } from "./shared.js";

export function registerFindEmergencyCare(server: McpServer): void {
  registerSafeTool(
    server,
    "find_emergency_care",
    [
      "Locate the nearest hospital emergency departments for a medical emergency.",
      "Use this when assess_symptoms returns EMERGENCY, or for accidents and sudden severe illness.",
      "Always pair with emergency-services guidance.",
    ].join(" "),
    {
      location: z
        .string()
        .optional()
        .describe("City, e.g. 'Bengaluru', 'Chennai', 'Mumbai'."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Maximum number of results (default 3)."),
    },
    async (args) => {
      const departments = await providerDirectory.search({
        location: args.location,
        emergencyOnly: true,
        limit: args.limit ?? 3,
      });

      return {
        emergencyGuidance: EMERGENCY_GUIDANCE,
        departments: departments.map((d) => ({
          id: d.id,
          name: d.name,
          facility: d.facility,
          city: d.city,
          address: d.address,
          phone: d.phone,
          openHours: d.nextAvailableSlot,
        })),
        hint:
          departments.length === 0
            ? "No emergency department found for that city in the mock directory. Call emergency services for the nearest facility."
            : "If you can, call ahead so the emergency team is ready. Do not drive yourself if you feel seriously unwell - have someone drive you or call an ambulance.",
      };
    },
  );
}