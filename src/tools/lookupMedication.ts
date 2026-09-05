import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { MOCK_MEDICATIONS } from "../data/medications.js";
import { registerSafeTool } from "./shared.js";

export function registerLookupMedication(server: McpServer): void {
  registerSafeTool(
    server,
    "lookup_medication",
    [
      "Look up basic reference information about a medication: purpose, common brands, warnings, and common interactions.",
      "Covers a small mock set of common drugs in this scaffold.",
      "Always advise confirming with a doctor or pharmacist.",
    ].join(" "),
    {
      drugName: z
        .string()
        .min(2)
        .describe("Drug name, generic or brand, e.g. 'paracetamol', 'Dolo 650', 'metformin'."),
    },
    async (args) => {
      const needle = args.drugName.trim().toLowerCase();
      const matches = MOCK_MEDICATIONS.filter(
        (m) =>
          m.name.toLowerCase().includes(needle) ||
          m.genericName.toLowerCase().includes(needle) ||
          m.commonBrands.some((b) => b.toLowerCase().includes(needle)),
      );

      if (matches.length === 0) {
        return {
          found: false,
          searched: args.drugName,
          message:
            "This medication is not in the reference set. Check the prescription or packaging, and ask a doctor or pharmacist before taking anything.",
          overdoseNote:
            "If you suspect an overdose or a severe reaction, call emergency services immediately.",
        };
      }

      return {
        found: true,
        searched: args.drugName,
        matches: matches.map((m) => ({
          name: m.name,
          genericName: m.genericName,
          purpose: m.purpose,
          commonBrands: m.commonBrands,
          requiresPrescription: m.requiresPrescription,
          warnings: m.warnings,
          commonInteractions: m.commonInteractions,
        })),
        note: "This is general reference information, not a prescription or medical advice. Verify dosage with your doctor or pharmacist.",
      };
    },
  );
}