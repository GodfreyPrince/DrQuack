import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { createSession, LocalSessionStore } from "../src/agent/sessionStore.js";

test("createSession starts clean", () => {
  const session = createSession();
  assert.equal(session.stage, "OPENING");
  assert.equal(session.closed, false);
  assert.equal(session.turns.length, 0);
});

test("LocalSessionStore round-trips a session to disk", async () => {
  const dir = await mkdtemp(join(tmpdir(), "drquack-test-"));
  try {
    const store = new LocalSessionStore(dir);
    const session = createSession("abc-123");
    session.model.chiefComplaint = "stomach pain";
    session.turns.push({ role: "user", content: "My stomach hurts", at: new Date().toISOString() });
    await store.save(session);

    const loaded = await store.get("abc-123");
    assert.ok(loaded);
    assert.equal(loaded.model.chiefComplaint, "stomach pain");
    assert.equal(loaded.turns[0]?.content, "My stomach hurts");

    // Persisted as JSON on disk.
    const raw = await readFile(join(dir, "abc-123.json"), "utf8");
    assert.ok(JSON.parse(raw).id === "abc-123");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("LocalSessionStore returns undefined for unknown sessions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "drquack-test-"));
  try {
    const store = new LocalSessionStore(dir);
    assert.equal(await store.get("nope"), undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});