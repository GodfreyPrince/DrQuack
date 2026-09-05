import assert from "node:assert/strict";
import { test } from "node:test";

import { MockProviderDirectory } from "../src/db/providerDirectory.js";

const directory = new MockProviderDirectory();

test("search by specialty filters results", async () => {
  const results = await directory.search({ specialty: "Cardiologist" });
  assert.equal(results.length, 1);
  assert.equal(results[0]?.specialty, "Cardiologist");
});

test("search by city matches with aliases", async () => {
  const results = await directory.search({ location: "bangalore" });
  assert.ok(results.length > 0);
  assert.ok(results.every((p) => p.city === "Bengaluru"));
});

test("emergencyOnly returns emergency departments only", async () => {
  const results = await directory.search({ emergencyOnly: true });
  assert.ok(results.length > 0);
  assert.ok(results.every((p) => p.emergency === true));
});

test("results are sorted by rating descending", async () => {
  const results = await directory.search({});
  const ratings = results.map((p) => p.rating);
  const sorted = [...ratings].sort((a, b) => b - a);
  assert.deepEqual(ratings, sorted);
});

test("limit truncates results", async () => {
  const results = await directory.search({ limit: 3 });
  assert.equal(results.length, 3);
});

test("getById returns the provider or undefined", async () => {
  const found = await directory.getById("p-001");
  assert.equal(found?.name, "Dr. Ananya Rao");
  assert.equal(await directory.getById("nope"), undefined);
});

test("telehealthOnly filters", async () => {
  const results = await directory.search({ telehealthOnly: true, limit: 25 });
  assert.ok(results.every((p) => p.telehealthAvailable));
});