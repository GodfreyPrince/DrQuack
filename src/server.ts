import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { createAgentEngine } from "./agent/agent.js";
import { createLlmProvider } from "./agent/llm/index.js";
import { LocalSessionStore } from "./agent/sessionStore.js";
import { loadConfig } from "./config.js";
import { registerPatientContext } from "./resources.js";
import { registerTriagePrompt } from "./prompts.js";
import { registerAssessSymptoms } from "./tools/assessSymptoms.js";
import { registerFindEmergencyCare } from "./tools/findEmergencyCare.js";
import { registerFindProviders } from "./tools/findProviders.js";
import { registerLookupMedication } from "./tools/lookupMedication.js";
import { registerPatientSays } from "./tools/patientSays.js";
import { registerRequestConsultation } from "./tools/requestConsultation.js";
import { registerEndSession, registerGetSession } from "./tools/sessionTools.js";
import { registerSessionResource } from "./resources.js";

export const SERVER_NAME = "drquack";
export const SERVER_VERSION = "0.2.0";

/** Build the fully-wired MCP server with the agent and all facet tools. */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // The agent: stateful elicitation engine with local session persistence
  // and a pluggable LLM (OpenAI-compatible or Anthropic, offline fallback).
  const config = loadConfig();
  const engine = createAgentEngine(new LocalSessionStore(config.sessionDir), createLlmProvider());

  // Agent tools
  registerPatientSays(server, engine);
  registerGetSession(server, engine);
  registerEndSession(server, engine);

  // Facet tools (the instrument panel the agent and clients reach for)
  registerAssessSymptoms(server);
  registerFindProviders(server);
  registerFindEmergencyCare(server);
  registerRequestConsultation(server);
  registerLookupMedication(server);

  // Resources
  registerPatientContext(server);
  registerSessionResource(server, engine);

  // Prompts
  registerTriagePrompt(server);

  return server;
}