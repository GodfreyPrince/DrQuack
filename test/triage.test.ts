import assert from "node:assert/strict";
import { test } from "node:test";

import { assessTriage, detectRedFlags, normalize } from "../src/core/triage.js";

test("normalize lowercases and strips punctuation", () => {
  assert.equal(normalize("Chest Pain!! - since 2 days"), "chest pain since 2 days");
});

test("detectRedFlags finds chest pain", () => {
  const flags = detectRedFlags("I have chest pain and it feels tight");
  assert.ok(flags.some((f) => f.id === "chest_pain"));
});

test("detectRedFlags finds stroke signs", () => {
  const flags = detectRedFlags("my face is drooping on one side and speech is slurred");
  assert.ok(flags.some((f) => f.id === "stroke"));
});

test("detectRedFlags finds self-harm signals", () => {
  const flags = detectRedFlags("I keep thinking about suicide");
  assert.ok(flags.some((f) => f.id === "self_harm"));
});

test("chest pain forces EMERGENCY", () => {
  const result = assessTriage({ symptoms: "chest pain for an hour" });
  assert.equal(result.severity, "EMERGENCY");
  assert.ok(result.redFlags.length > 0);
});

test("fever in infant under 3 months is EMERGENCY", () => {
  const result = assessTriage({ symptoms: "baby has fever", age: 0.5 });
  assert.equal(result.severity, "EMERGENCY");
  assert.ok(result.redFlags.some((f) => f.id === "infant_fever"));
});

test("fever in a 5-year-old is not an emergency by itself", () => {
  const result = assessTriage({ symptoms: "child has fever", age: 5 });
  assert.notEqual(result.severity, "EMERGENCY");
});

test("high fever escalates to URGENT", () => {
  const result = assessTriage({ symptoms: "high fever and body ache since yesterday" });
  assert.equal(result.severity, "URGENT");
});

test("mild cold symptoms classify as SELF_CARE", () => {
  const result = assessTriage({ symptoms: "runny nose and sneezing, mild headache" });
  assert.equal(result.severity, "SELF_CARE");
});

test("vague symptoms default to PRIMARY_CARE", () => {
  const result = assessTriage({ symptoms: "feeling a bit off, not sure what it is" });
  assert.equal(result.severity, "PRIMARY_CARE");
});

test("escalating adjectives prevent SELF_CARE down-classification", () => {
  const result = assessTriage({ symptoms: "severe headache" });
  assert.equal(result.severity, "PRIMARY_CARE");
});