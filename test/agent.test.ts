import assert from "node:assert/strict";
import { test } from "node:test";

import { createAgentEngine } from "../src/agent/agent.js";
import { TemplateLlmProvider } from "../src/agent/llm/template.js";
import { MemorySessionStore } from "../src/agent/sessionStore.js";

function makeEngine() {
  return createAgentEngine(new MemorySessionStore(), new TemplateLlmProvider());
}

test("patient_says starts a session and asks the chief complaint", async () => {
  const engine = makeEngine();
  const reply = await engine.handleMessage(undefined, "Hello");
  assert.equal(reply.stage, "OPENING");
  assert.match(reply.reply, /what is the main thing/i);
  assert.ok(reply.sessionId.length > 0);
});

test("a full interview progresses to a recommendation", async () => {
  const engine = makeEngine();
  let reply = await engine.handleMessage(undefined, "I have a headache");

  reply = await engine.handleMessage(reply.sessionId, "It started this morning suddenly, throbbing, constant, 3 out of 10, worse with light, better when I rest");
  reply = await engine.handleMessage(reply.sessionId, "I am 34 years old, no conditions, no medications, no allergies");

  // Answer the remaining review-of-systems questions until done.
  let guard = 0;
  while (!reply.done && guard < 10) {
    reply = await engine.handleMessage(reply.sessionId, "No");
    guard += 1;
  }

  assert.equal(reply.stage, "DECISION");
  assert.equal(reply.done, true);
  assert.match(reply.reply, /self-care|primary care/i);
  assert.equal(reply.modelSummary.age, "34 years");
  assert.equal(reply.modelSummary.chiefComplaint, "I have a headache");
});

test("emergency mention mid-interview interrupts with emergency guidance", async () => {
  const engine = makeEngine();
  let reply = await engine.handleMessage(undefined, "I have a mild headache");
  reply = await engine.handleMessage(reply.sessionId, "I also have chest pain and I cannot breathe properly");

  assert.equal(reply.severity, "EMERGENCY");
  assert.equal(reply.done, true);
  assert.match(reply.reply, /emergency/i);
  assert.ok(reply.redFlags.length > 0);
});

test("sessions resume by id", async () => {
  const engine = makeEngine();
  const first = await engine.handleMessage(undefined, "I have a sore throat");
  const second = await engine.handleMessage(first.sessionId, "It started two days ago");
  // Same session, model carried over.
  assert.equal(second.sessionId, first.sessionId);
  assert.ok(second.modelSummary.historyPreview.includes("two days ago"));
});

test("end_session produces a structured handoff note", async () => {
  const engine = makeEngine();
  const first = await engine.handleMessage(undefined, "I am 41 and I have knee pain");
  const ended = await engine.endSession(first.sessionId);

  assert.ok("handoff" in ended);
  assert.match(ended.handoff, /Chief complaint: I am 41 and I have knee pain/);
  assert.match(ended.handoff, /Age: 41 years/);
  assert.match(ended.handoff, /Triage: /);
});

test("closed sessions cannot be resumed", async () => {
  const engine = makeEngine();
  const first = await engine.handleMessage(undefined, "I have a cough");
  await engine.endSession(first.sessionId);
  const resumed = await engine.handleMessage(first.sessionId, "It is worse now");
  assert.notEqual(resumed.sessionId, first.sessionId); // fresh session created
});