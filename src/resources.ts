import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { DISCLAIMER } from "./core/disclaimer.js";

/**
 * Read-only patient context template. Any LLM client can pull this
 * resource to structure how it gathers information from the patient.
 * No patient data is stored anywhere by this server.
 */
const PATIENT_CONTEXT_TEMPLATE = `# Patient Context

Gather the following before assessing symptoms. Ask only for what is needed,
and reassure the patient that this information stays between them and their
care team - DrQuack does not store any of it.

## 1. Basic information
- Age (years; months for infants)
- Sex assigned at birth and pregnancy status (if relevant)

## 2. Presenting problem
- Main symptoms, in the patient's own words
- When did it start? (duration)
- Constant or intermittent?
- Anything that makes it better or worse?
- Any medications taken for it so far?

## 3. Past history
- Known medical conditions (diabetes, hypertension, asthma, heart disease, ...)
- Current medications and doses
- Known allergies (especially drug allergies)

## 4. Location
- City, so providers can be found nearby

## Guardrails
- Do NOT ask for or record government IDs, full addresses, or financial details.
- If the patient reports an emergency red flag (chest pain, breathing trouble,
  stroke signs, severe bleeding, loss of consciousness, self-harm thoughts),
  escalate immediately via the emergency guidance - do not continue the interview.
- End every interaction with the disclaimer.

${DISCLAIMER}`;

export function registerPatientContext(server: McpServer): void {
  server.registerResource(
    "patient-context",
    "drquack://context/patient",
    {
      title: "Patient context",
      description:
        "Template for gathering structured patient context before triage. Read-only; DrQuack stores nothing.",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/plain",
          text: PATIENT_CONTEXT_TEMPLATE,
        },
      ],
    }),
  );
}