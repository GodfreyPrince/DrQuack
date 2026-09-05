import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import type { AgentEngine } from "../agent/agent.js";
import { registerSafeTool } from "./shared.js";

export function registerGetSession(server: McpServer, engine: AgentEngine): void {
  registerSafeTool(
    server,
    "get_session",
    [
      "Read the current patient model for a session: chief complaint, age, conditions, medications, allergies, severity, and recent history.",
      "Does not advance the interview.",
    ].join(" "),
    {
      sessionId: z.string().describe("Session id from patient_says."),
    },
    async (args) => engine.readSession(args.sessionId),
  );
}

export function registerEndSession(server: McpServer, engine: AgentEngine): void {
  registerSafeTool(
    server,
    "end_session",
    [
      "Close a session and produce a structured handoff note summarizing the patient's history, triage severity, and any red flags.",
      "Use when the interview is done or the patient is being handed to a doctor or hospital.",
    ].join(" "),
    {
      sessionId: z.string().describe("Session id from patient_says."),
    },
    async (args) => engine.endSession(args.sessionId),
  );
}