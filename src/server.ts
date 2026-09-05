import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPatientContext } from "./resources.js";
import { registerTriagePrompt } from "./prompts.js";
import { registerAssessSymptoms } from "./tools/assessSymptoms.js";
import { registerFindEmergencyCare } from "./tools/findEmergencyCare.js";
import { registerFindProviders } from "./tools/findProviders.js";
import { registerLookupMedication } from "./tools/lookupMedication.js";
import { registerRequestConsultation } from "./tools/requestConsultation.js";

export const SERVER_NAME = "drquack";
export const SERVER_VERSION = "0.1.0";

/** Build the fully-wired MCP server with all tools, resources, and prompts. */
export function buildServer(): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Tools
  registerAssessSymptoms(server);
  registerFindProviders(server);
  registerFindEmergencyCare(server);
  registerRequestConsultation(server);
  registerLookupMedication(server);

  // Resources
  registerPatientContext(server);

  // Prompts
  registerTriagePrompt(server);

  return server;
}