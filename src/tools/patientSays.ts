import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AgentEngine } from "../agent/agent.js";
import { registerSafeTool } from "./shared.js";

/**
 * The agent's mouth and ears. The client LLM (or a plain web chat) relays
 * the patient's message here; DrQuack runs the elicitation interview
 * internally and returns the reply plus session state.
 */
export function registerPatientSays(server: McpServer, engine: AgentEngine): void {
  registerSafeTool(
    server,
    "patient_says",
    [
      "Speak to the patient through DrQuack. Pass whatever the patient just said (or wrote).",
      "DrQuack conducts the clinical interview: it updates the patient model, re-triages, and replies with the next question or a recommendation.",
      "Return the sessionId to the caller so the conversation can continue; omit it to start a new session.",
    ].join(" "),
    {
      sessionId: z
        .string()
        .optional()
        .describe("Session id from a previous patient_says call. Omit to start a new session."),
      message: z
        .string()
        .min(1)
        .describe("The patient's message, verbatim where possible."),
    },
    async (args) => {
      const reply = await engine.handleMessage(args.sessionId, args.message);
      return reply;
    },
  );
}