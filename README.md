# DrQuack 🦆⚕️

An MCP (Model Context Protocol) server that layers a **stateful health
agent** over **any** LLM client - Claude Desktop, Cursor, any MCP-capable
assistant. Less a tool rack, more a Hermes-style agent: DrQuack *interviews*
the patient like a clinician, then reaches for tools to triage, find care,
and connect.

## The agent

DrQuack is an elicitation agent, not a form:

- It conducts a **structured clinical interview** - chief complaint, then
  history of present illness (onset, character, severity, aggravating/
  relieving factors), then hypothesis-targeted review-of-systems probes,
  then past history, medications, allergies.
- It **adapts**: questions already answered in the patient's own words are
  skipped; probes target the likely problem (chest pain gets cardiac
  questions, fever gets infection questions).
- It **re-triages after every answer** - the severity always reflects
  everything said so far, and an emergency red flag *interrupts* the
  interview with emergency guidance.
- Every session ends with a **structured handoff note** ready to share with
  a doctor or hospital.

The rules engine owns the method (deterministic, safe, complete); the LLM
owns the voice (warm, plain language, one question at a time). The agent
connects to both OpenAI-compatible and Anthropic APIs - or runs offline on
templates when no key is configured.

Sessions persist **locally** (JSON files under `~/.drquack/sessions`, like
Hermes keeps its history). Nothing is stored anywhere else.

> **DrQuack is decision-support software, not a licensed medical
> professional.** It does not provide diagnoses. See
> [Safety and compliance](#safety-and-compliance).

## Tools

### Agent tools

| Tool | Purpose |
| --- | --- |
| `patient_says` | The agent's mouth and ears - pass the patient's message; DrQuack runs the interview and replies. Omit `sessionId` to start a new session |
| `get_session` | Read the evolving patient model (complaint, age, conditions, meds, allergies, severity) |
| `end_session` | Close the session and produce the handoff note for the care team |

### Facet tools (the instrument panel)

| Tool | Purpose |
| --- | --- |
| `assess_symptoms` | Triage symptoms into `SELF_CARE` / `PRIMARY_CARE` / `URGENT` / `EMERGENCY` with red-flag detection and recommendations |
| `find_providers` | Search the provider directory by specialty, city, and telehealth availability |
| `find_emergency_care` | Locate hospital emergency departments with guidance |
| `request_consultation` | Connect a patient to a doctor/clinic; returns a booking reference and next steps |
| `lookup_medication` | Basic reference info: purpose, brands, warnings, common interactions |

Plus:
- **Resources** - `drquack://context/patient` (what to gather, what *not* to
  collect) and `drquack://session/{sessionId}` (live patient model).
- **Prompt** `triage_workflow` - the guided tool-driven workflow for LLM
  clients that want it.

## Quick start

```bash
npm install
npm run build
npm start            # stdio transport (default, for local clients)
npm run start:http   # streamable HTTP on http://localhost:3001/mcp
```

Without any configuration the agent runs in **offline template mode**
(deterministic questions and guidance) - perfect for a demo. To power the
agent with an LLM, copy `.env.example` to `.env` and set one provider:

```bash
# OpenAI, or any OpenAI-compatible endpoint (LM Studio, GLM, OpenRouter):
DRQUACK_LLM_PROVIDER=openai
DRQUACK_OPENAI_API_KEY=sk-...
DRQUACK_OPENAI_MODEL=gpt-4o-mini

# or Claude:
DRQUACK_LLM_PROVIDER=anthropic
DRQUACK_ANTHROPIC_API_KEY=sk-ant-...
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
├── server.ts                # MCP server assembly (agent + facet tools)
├── config.ts                # env config: LLM provider, model, session dir
├── agent/
│   ├── agent.ts             # the agent loop: update -> re-triage -> decide -> render
│   ├── interview.ts         # elicitation engine: stages, adaptive question strategy
│   ├── patientModel.ts      # evolving patient model + conservative extraction
│   ├── sessionStore.ts      # local JSON persistence (~/.drquack/sessions)
│   ├── systemPrompt.ts      # the agent's voice and method
│   └── llm/
│       ├── openaiCompatible.ts  # OpenAI / LM Studio / GLM / OpenRouter
│       ├── anthropic.ts         # Claude Messages API
│       ├── template.ts          # offline fallback renderer (no key needed)
│       └── types.ts             # LlmProvider interface
├── core/
│   ├── triage.ts            # pure triage logic: red flags, severity, signals
│   └── disclaimer.ts        # safety copy attached to every tool output
├── data/
│   ├── providers.ts         # mock provider dataset (15 entries)
│   └── medications.ts       # mock medication reference set
├── db/
│   └── providerDirectory.ts # ProviderDirectory interface + mock impl (the seam)
├── tools/                   # one file per MCP tool
├── resources.ts             # patient context + session state resources
└── prompts.ts               # triage_workflow prompt
```

### How a patient turn works

```
patient message
  -> safety gate (red flags interrupt immediately)
  -> update patient model (extract age/conditions/meds, append history)
  -> re-triage over everything said so far
  -> interview engine picks the next step
     (skip answered HPI elements, targeted ROS probes, or recommend)
  -> LLM renders the question / recommendation in the agent's voice
  -> session persisted locally
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

- [x] Elicitation agent: adaptive clinical interview with session state
- [x] Local session persistence (~/.drquack/sessions)
- [x] Dual LLM wire formats (OpenAI-compatible + Anthropic)
- [ ] Handoff to a real doctor (send the handoff note to the connected provider)

- [ ] Real provider directory backend (FHIR / hospital APIs)
- [ ] Licensed drug database (openFDA or national formulary)
- [ ] Appointment booking integration with clinics/hospitals
- [ ] AuthN/AuthZ for patient context, audit logging
- [ ] Localized emergency numbers and languages
- [ ] CI pipeline with lint + test gates

## License

MIT