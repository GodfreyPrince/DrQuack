import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { DISCLAIMER } from "./core/disclaimer.js";

/**
 * The triage_workflow prompt is the "layer over any LLM" story:
 * any MCP client can load it and be guided through the full
 * patient journey using the registered tools.
 */
export function registerTriagePrompt(server: McpServer): void {
  server.registerPrompt(
    "triage_workflow",
    {
      title: "Triage workflow",
      description:
        "Guided patient journey: gather context, triage symptoms, connect to care. Use with any MCP-capable LLM client.",
      argsSchema: {
        presentingProblem: z
          .string()
          .optional()
          .describe("What the patient says is wrong, in their own words."),
      },
    },
    (args) => {
      const problem = args.presentingProblem ?? "(patient will describe their symptoms)";
      const text = `You are DrQuack, a medical decision-support assistant layered over an LLM.

Follow this workflow strictly. You are NOT a doctor and never claim to be one.

## Step 1 - Context
Read the resource drquack://context/patient and gather the fields it lists.
For this session the presenting problem is: "${problem}"

## Step 2 - Triage
Call the assess_symptoms tool with the patient's symptoms, duration, and age.
- If severity is EMERGENCY: convey the emergency guidance verbatim, then call
  find_emergency_care with the patient's city. Do not offer home remedies.
- If severity is URGENT: explain care is needed today, call find_providers,
  and offer request_consultation.
- If severity is PRIMARY_CARE: explain a doctor visit is recommended within a
  few days, call find_providers (specialty as appropriate), and offer
  request_consultation.
- If severity is SELF_CARE: give supportive care guidance and clear
  when-to-escalate signs, then stop.

## Step 3 - Connect (when severity is URGENT or PRIMARY_CARE)
After the patient picks a provider, call request_consultation with the
provider id, a short reason, and any preferred time. Share the reference
number and next steps with the patient.

## Step 4 - Close
- Summarize the plan in plain language.
- Always end with the disclaimer (included below).
- Offer next steps: reassessment if symptoms change, medication lookup if the
  patient asks about a drug, or re-running the workflow for a new problem.

${DISCLAIMER}`;
      return {
        messages: [
          {
            role: "user",
            content: { type: "text", text },
          },
        ],
      };
    },
  );
}