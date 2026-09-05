/**
 * The agent loop. The MCP client is a thin relay: it passes the patient's
 * message in, DrQuack runs the interview internally (update model ->
 * re-triage -> decide next step -> render), and returns the reply plus
 * session state.
 */

import { EMERGENCY_GUIDANCE } from "../core/disclaimer.js";
import { detectRedFlags } from "../core/triage.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import {
  nextInterviewStep,
  recordAsked,
  recommendationFor,
  triageModel,
} from "./interview.js";
import type { LlmProvider } from "./llm/types.js";
import { createSession, type Session, type SessionStore } from "./sessionStore.js";
import { updateModel, type PatientModel } from "./patientModel.js";

export interface AgentReply {
  sessionId: string;
  reply: string;
  severity: string;
  stage: string;
  redFlags: { id: string; reason: string }[];
  modelSummary: {
    chiefComplaint?: string;
    age?: string;
    conditions: string[];
    medications: string[];
    allergies: string[];
    historyPreview: string;
  };
  done: boolean;
}

export interface AgentEngine {
  /** Handle one patient message; creates or resumes the session. */
  handleMessage(sessionId: string | undefined, message: string): Promise<AgentReply>;
  /** Read the current session state without a turn. */
  readSession(sessionId: string): Promise<AgentReply | { error: string }>;
  /** Close a session and produce a handoff note. */
  endSession(sessionId: string): Promise<AgentReply & { handoff: string } | { error: string }>;
}

export function createAgentEngine(store: SessionStore, llm: LlmProvider): AgentEngine {
  async function loadSession(sessionId: string | undefined): Promise<Session> {
    if (sessionId) {
      const existing = await store.get(sessionId);
      if (existing && !existing.closed) return existing;
    }
    return createSession();
  }

  async function renderReply(session: Session, question: string | null, recommendation: string | null): Promise<string> {
    const system = buildSystemPrompt(session.model, session.severity);
    if (question) {
      // Ask the LLM to render the question intent naturally.
      const resp = await llm.chat({
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: `<question-intent>${JSON.stringify({ question })}</question-intent>`,
          },
        ],
      });
      return resp.text || question;
    }
    const resp = await llm.chat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: `<recommendation>${recommendation}</recommendation>` },
      ],
    });
    return resp.text || (recommendation ?? "");
  }

  function summarize(session: Session): AgentReply["modelSummary"] {
    const m: PatientModel = session.model;
    return {
      chiefComplaint: m.chiefComplaint,
      age: m.ageNote,
      conditions: m.conditions,
      medications: m.medications,
      allergies: m.allergies,
      historyPreview: m.historyText.split("\n").slice(-3).join("\n"),
    };
  }

  async function handleMessage(sessionId: string | undefined, message: string): Promise<AgentReply> {
    const session = await loadSession(sessionId);

    // 1. Safety gate: emergency red flags interrupt the interview.
    const flags = detectRedFlags(message, session.model.age);
    if (flags.length > 0) {
      session.severity = "EMERGENCY";
      session.stage = "DECISION";
      session.model = updateModel(session.model, message);
      session.turns.push({ role: "user", content: message, at: new Date().toISOString() });
      session.turns.push({ role: "assistant", content: EMERGENCY_GUIDANCE, at: new Date().toISOString() });
      await store.save(session);
      return {
        sessionId: session.id,
        reply: EMERGENCY_GUIDANCE,
        severity: session.severity,
        stage: session.stage,
        redFlags: flags,
        modelSummary: summarize(session),
        done: true,
      };
    }

    // 2. Normal turn: update the model, re-triage over everything said.
    session.model = updateModel(session.model, message);
    session.turns.push({ role: "user", content: message, at: new Date().toISOString() });
    const triage = triageModel(session.model);
    session.severity = triage.severity;

    // 3. Decide the next step.
    const step = nextInterviewStep(session.model, session.severity);
    session.stage = step.stage;

    let reply: string;
    if (step.intent) {
      recordAsked(session.model, step.intent.id);
      reply = await renderReply(session, step.intent.question, null);
    } else {
      // DECISION: recommendation time.
      const recommendation = recommendationFor(step.severity);
      reply = await renderReply(session, null, recommendation);
    }

    session.turns.push({ role: "assistant", content: reply, at: new Date().toISOString() });
    await store.save(session);

    return {
      sessionId: session.id,
      reply,
      severity: session.severity,
      stage: session.stage,
      redFlags: triage.redFlags,
      modelSummary: summarize(session),
      done: step.done,
    };
  }

  async function readSession(sessionId: string): Promise<AgentReply | { error: string }> {
    const session = await store.get(sessionId);
    if (!session || session.closed) {
      return { error: `No active session '${sessionId}'. Start one with patient_says.` };
    }
    return {
      sessionId: session.id,
      reply: "",
      severity: session.severity,
      stage: session.stage,
      redFlags: [],
      modelSummary: summarize(session),
      done: false,
    };
  }

  async function endSession(sessionId: string): Promise<AgentReply & { handoff: string } | { error: string }> {
    const session = await store.get(sessionId);
    if (!session) return { error: `No session '${sessionId}'.` };

    const triage = triageModel(session.model);
    session.severity = triage.severity;
    session.closed = true;
    session.handoff = [
      `HANDOFF NOTE (session ${session.id})`,
      `Chief complaint: ${session.model.chiefComplaint ?? "not stated"}`,
      `Age: ${session.model.ageNote ?? "unknown"}`,
      `Conditions: ${session.model.conditions.join(", ") || "none reported"}`,
      `Medications: ${session.model.medications.join(", ") || "none reported"}`,
      `Allergies: ${session.model.allergies.join(", ") || "none reported"}`,
      `Triage: ${triage.severity}${triage.redFlags.length ? ` - red flags: ${triage.redFlags.map((f) => f.id).join(", ")}` : ""}`,
      `History: ${session.model.historyText}`,
    ].join("\n");

    await store.save(session);
    return {
      sessionId: session.id,
      reply: "Session closed. A handoff note is ready to share with the care team.",
      severity: session.severity,
      stage: session.stage,
      redFlags: triage.redFlags,
      modelSummary: summarize(session),
      done: true,
      handoff: session.handoff,
    };
  }

  return { handleMessage, readSession, endSession };
}