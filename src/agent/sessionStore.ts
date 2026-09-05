/**
 * Local session store - persistence "just like Hermes": everything lives in
 * JSON files under a local directory (default ~/.drquack/sessions). Nothing
 * is sent anywhere except the LLM API calls you configure.
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { SeverityLevel } from "../core/triage.js";
import type { InterviewStage } from "./interview.js";
import { emptyModel, type PatientModel } from "./patientModel.js";

export interface SessionTurn {
  role: "user" | "assistant";
  content: string;
  at: string;
}

export interface Session {
  id: string;
  createdAt: string;
  updatedAt: string;
  stage: InterviewStage;
  severity: SeverityLevel;
  closed: boolean;
  model: PatientModel;
  turns: SessionTurn[];
  /** Final handoff note, set by end_session. */
  handoff?: string;
}

export function createSession(id = randomUUID()): Session {
  const now = new Date().toISOString();
  return {
    id,
    createdAt: now,
    updatedAt: now,
    stage: "OPENING",
    severity: "PRIMARY_CARE",
    closed: false,
    model: emptyModel(),
    turns: [],
  };
}

export interface SessionStore {
  get(id: string): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
}

/** File-backed store: one JSON file per session. */
export class LocalSessionStore implements SessionStore {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  private pathFor(id: string): string {
    return join(this.dir, `${id}.json`);
  }

  async get(id: string): Promise<Session | undefined> {
    try {
      const raw = await readFile(this.pathFor(id), "utf8");
      return JSON.parse(raw) as Session;
    } catch {
      return undefined;
    }
  }

  async save(session: Session): Promise<void> {
    session.updatedAt = new Date().toISOString();
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.pathFor(session.id), JSON.stringify(session, null, 2), "utf8");
  }
}

/** In-memory store for tests. */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Session>();

  async get(id: string): Promise<Session | undefined> {
    return this.sessions.get(id);
  }

  async save(session: Session): Promise<void> {
    this.sessions.set(session.id, { ...session, model: { ...session.model } });
  }
}