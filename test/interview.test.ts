import assert from "node:assert/strict";
import { test } from "node:test";

import {
  nextInterviewStep,
  pickRosProbes,
  recordAsked,
  recommendationFor,
  triageModel,
} from "../src/agent/interview.js";
import { emptyModel, updateModel } from "../src/agent/patientModel.js";

test("opens by asking for the chief complaint", () => {
  const step = nextInterviewStep(emptyModel(), "PRIMARY_CARE");
  assert.equal(step.stage, "OPENING");
  assert.equal(step.intent?.id, "opening.chief");
  assert.equal(step.done, false);
});

test("moves from OPENING to HPI once a complaint exists", () => {
  const model = updateModel(emptyModel(), "I have a headache since this morning");
  const step = nextInterviewStep(model, "PRIMARY_CARE");
  assert.equal(step.stage, "HPI");
  // "since this morning" already answered onset - the engine adapts.
  assert.equal(step.intent?.id, "hpi.duration");
});

test("asks only HPI elements not already answered", () => {
  let model = updateModel(emptyModel(), "I have a headache");
  // Patient answers onset + duration + character in one go.
  model = updateModel(
    model,
    "It started yesterday suddenly, it is a throbbing pain and it has been constant all day",
  );
  const step = nextInterviewStep(model, "PRIMARY_CARE");
  assert.equal(step.stage, "HPI");
  assert.ok(!step.intent?.id.includes("onset"));
  assert.ok(!step.intent?.id.includes("duration"));
  assert.ok(!step.intent?.id.includes("character"));
});

test("ROS probes target the chief complaint hypothesis", () => {
  const model = updateModel(emptyModel(), "I have chest pain that started an hour ago");
  const probes = pickRosProbes(model.chiefComplaint ?? "", model);
  assert.ok(probes.some((p) => p.id === "ros.chest.radiation"));
  assert.ok(probes.every((p) => p.id.startsWith("ros.chest")));
});

test("ROS probes are asked only once", () => {
  const model = updateModel(emptyModel(), "I have chest pain");
  const first = pickRosProbes("chest pain", model);
  recordAsked(model, first[0]?.id ?? "");
  const second = pickRosProbes("chest pain", model);
  assert.ok(!second.some((p) => p.id === first[0]?.id));
});

test("full interview reaches DECISION", () => {
  let model = updateModel(emptyModel(), "I have a mild headache");
  model = updateModel(
    model,
    "It started this morning suddenly, throbbing, constant, 3 out of 10, worse with light, better when I rest",
  );

  // Answer each question the engine asks, one per turn, until it is done.
  let step = nextInterviewStep(model, "PRIMARY_CARE");
  let guard = 0;
  while (!step.done && guard < 20) {
    if (step.intent) {
      recordAsked(model, step.intent.id);
      model = updateModel(model, "No");
    }
    step = nextInterviewStep(model, "PRIMARY_CARE");
    guard += 1;
  }

  assert.equal(step.stage, "DECISION");
  assert.equal(step.done, true);
});

test("EMERGENCY severity interrupts the interview", () => {
  const model = updateModel(emptyModel(), "I have chest pain");
  const step = nextInterviewStep(model, "EMERGENCY");
  assert.equal(step.done, true);
  assert.equal(step.intent, null);
});

test("triageModel re-runs over accumulated history", () => {
  let model = updateModel(emptyModel(), "I have a mild headache");
  model = updateModel(model, "Actually now my face is drooping on one side");
  const { severity, redFlags } = triageModel(model);
  assert.equal(severity, "EMERGENCY");
  assert.ok(redFlags.some((f) => f.id === "stroke"));
});

test("recommendationFor gives emergency guidance for EMERGENCY", () => {
  assert.match(recommendationFor("EMERGENCY"), /emergency/i);
  assert.match(recommendationFor("SELF_CARE"), /self-care/i);
});