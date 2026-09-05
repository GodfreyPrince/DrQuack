/**
 * Runtime configuration. Reads from process.env (optionally via a local
 * .env file, loaded like Hermes loads local config - nothing leaves the
 * machine except the LLM API calls you configure).
 */

import { homedir } from "node:os";
import { join } from "node:path";

// Load .env if present (Node >= 20.12). Missing file is fine - env vars
// may be provided by the shell instead.
try {
  process.loadEnvFile?.();
} catch {
  // no .env file - rely on the environment
}

export type LlmProviderKind = "openai" | "anthropic" | "template";

export interface LlmConfig {
  kind: LlmProviderKind;
  /** OpenAI-compatible endpoint, e.g. https://api.openai.com/v1 or http://localhost:1234/v1 (LM Studio). */
  openaiBaseUrl: string;
  openaiApiKey?: string;
  openaiModel: string;
  anthropicApiKey?: string;
  anthropicModel: string;
  /** Where sessions persist locally (JSON files). */
  sessionDir: string;
}

function defaultSessionDir(): string {
  return join(homedir(), ".drquack", "sessions");
}

export function loadConfig(): LlmConfig {
  const kind: LlmProviderKind =
    (process.env.DRQUACK_LLM_PROVIDER as LlmProviderKind) ?? "openai";
  return {
    kind,
    openaiBaseUrl:
      process.env.DRQUACK_OPENAI_BASE_URL ?? "https://api.openai.com/v1",
    openaiApiKey: process.env.DRQUACK_OPENAI_API_KEY,
    openaiModel: process.env.DRQUACK_OPENAI_MODEL ?? "gpt-4o-mini",
    anthropicApiKey: process.env.DRQUACK_ANTHROPIC_API_KEY,
    anthropicModel: process.env.DRQUACK_ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    sessionDir: process.env.DRQUACK_SESSION_DIR ?? defaultSessionDir(),
  };
}

/**
 * Which provider should the agent actually use?
 * Explicit "template" wins; otherwise a provider is usable only when its
 * key is configured; otherwise we fall back to the offline template
 * renderer so the server still runs with zero configuration.
 */
export function resolveProviderKind(config: LlmConfig): LlmProviderKind {
  if (config.kind === "template") return "template";
  if (config.kind === "anthropic") {
    return config.anthropicApiKey ? "anthropic" : "template";
  }
  return config.openaiApiKey ? "openai" : "template";
}