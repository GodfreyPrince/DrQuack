/**
 * Minimal LLM provider abstraction. Two wire formats are supported so the
 * agent connects "widely, like Hermes":
 *  - OpenAI-compatible chat completions (OpenAI, LM Studio, GLM, OpenRouter, ...)
 *  - Anthropic Messages API (Claude)
 * Plus a deterministic offline template renderer when no key is configured.
 */

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResponse {
  text: string;
  /** Set when the provider could not be reached. */
  error?: string;
}

export interface LlmProvider {
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatResponse>;
}

/** Shared timeout so a dead endpoint never hangs a patient turn. */
export const LLM_TIMEOUT_MS = 30_000;

export function timedFetch(url: string, init: RequestInit, timeoutMs = LLM_TIMEOUT_MS): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
}