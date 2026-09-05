# DrQuack 🦆⚕️

An MCP (Model Context Protocol) server that layers medical triage and
doctor/hospital connection over **any** LLM client - Claude Desktop, Cursor,
any MCP-capable assistant.

Given a patient's symptoms, DrQuack classifies severity (self-care, primary
care, urgent, emergency), detects emergency red flags, recommends next steps,
finds nearby doctors and hospitals, and connects the patient to care.

> **DrQuack is decision-support software, not a licensed medical
> professional.** It does not provide diagnoses. See
> [Safety and compliance](#safety-and-compliance).

## Tools

| Tool | Purpose |
| --- | --- |
| `assess_symptoms` | Triage symptoms into `SELF_CARE` / `PRIMARY_CARE` / `URGENT` / `EMERGENCY` with red-flag detection and recommendations |
| `find_providers` | Search the provider directory by specialty, city, and telehealth availability |
| `find_emergency_care` | Locate hospital emergency departments with guidance |
| `request_consultation` | Connect a patient to a doctor/clinic; returns a booking reference and next steps |
| `lookup_medication` | Basic reference info: purpose, brands, warnings, common interactions |

Plus:
- **Resource** `drquack://context/patient` - a template that coaches the LLM
  on which patient information to gather (and what *not* to collect).
- **Prompt** `triage_workflow` - a guided end-to-end workflow that any LLM
  client can load: gather context → triage → find care → connect.

## Quick start

```bash
npm install
npm run build
npm start            # stdio transport (default, for local clients)
npm run start:http   # streamable HTTP on http://localhost:3001/mcp
```

Try it interactively with the MCP Inspector:

```bash
npm run inspect
```

## Connecting LLM clients

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "drquack": {
      "command": "node",
      "args": ["/absolute/path/to/DrQuack/dist/index.js"]
    }
  }
}
```

**Cursor / other stdio clients** (`mcp.json` or equivalent):

```json
{
  "mcpServers": {
    "drquack": {
      "command": "node",
      "args": ["/absolute/path/to/DrQuack/dist/index.js"]
    }
  }
}
```

**Remote / HTTP clients** (web apps, cloud deployments):

```bash
PORT=3001 npm run start:http
# MCP endpoint: http://localhost:3001/mcp  |  health check: /health
```

## Architecture

```
src/
├── index.ts                 # entry point: stdio or HTTP transport
├── server.ts                # MCP server assembly (tools + resource + prompt)
├── core/
│   ├── triage.ts            # pure triage logic: red flags, severity, signals
│   └── disclaimer.ts        # safety copy attached to every tool output
├── data/
│   ├── providers.ts         # mock provider dataset (15 entries)
│   └── medications.ts       # mock medication reference set
├── db/
│   └── providerDirectory.ts # ProviderDirectory interface + mock impl (the seam)
├── tools/                   # one file per MCP tool
├── resources.ts             # patient context resource
└── prompts.ts               # triage_workflow prompt
```

### Swapping in real data

All provider access goes through the `ProviderDirectory` interface in
`src/db/providerDirectory.ts`. Implement it against a real API, a database,
or a FHIR server, and swap the singleton export - **no tool code changes
needed**. The medication set in `src/data/medications.ts` is similarly
replaceable with a licensed drug database.

## Safety design

- **Red flags force escalation.** Chest pain, breathing trouble, stroke
  signs, severe bleeding, anaphylaxis, self-harm, and other signals always
  classify as `EMERGENCY`; they can never be down-triaged. A fever in an
  infant under 3 months is treated as an emergency.
- **Disclaimer on every output.** Tool responses cannot be produced without
  the medical disclaimer footer (enforced in `src/tools/shared.ts`).
- **No patient data is stored.** No persistence layer exists in this
  scaffold. Patient details stay in the conversation with the LLM client.
- **Guarded prompts.** The patient-context resource explicitly tells the
  model not to collect government IDs or financial details, and to stop and
  escalate on emergency signals.

## Safety and compliance

This scaffold is a starting point, not a finished medical product. Before
any real-world use, work with medical, legal, and regulatory counsel on:

- **Medical device / telehealth regulations** (e.g. FDA, EU MDR, CDSCO in
  India) - symptom triage software may be regulated in your jurisdiction.
- **Data protection** (HIPAA, GDPR, India DPDP Act) - if you add persistence
  or PHI handling, encryption, access control, and breach processes are
  mandatory.
- **Clinical validation** - the red-flag rules and severity logic here are
  illustrative, not clinically validated. They need review by clinicians and
  testing against real triage protocols.

## Roadmap ideas

- [ ] Real provider directory backend (FHIR / hospital APIs)
- [ ] Licensed drug database (openFDA or national formulary)
- [ ] Appointment booking integration with clinics/hospitals
- [ ] AuthN/AuthZ for patient context, audit logging
- [ ] Localized emergency numbers and languages
- [ ] CI pipeline with lint + test gates

## License

MIT