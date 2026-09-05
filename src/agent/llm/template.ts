/**
 * Offline renderer: deterministic, key-free fallback so the agent works
 * end-to-end even when no LLM is configured. Used for tests and demos;
 * swap in a real provider via env config.
 */

import type { LlmProvider, ChatRequest, ChatResponse } from "./types.js";

export class TemplateLlmProvider implements LlmProvider {
  readonly name = "template";

  async chat(request: ChatRequest): Promise<ChatResponse> {
    // Last user turn drives the reply; the agent passes a single "system"
    // message containing the intent JSON when it wants a structured answer.
    const last = [...request.messages].reverse().find((m) => m.role === "user");
    const text = last?.content ?? "";
    const intentMatch = text.match(/<question-intent>([\s\S]*?)<\/question-intent>/);
    if (intentMatch?.[1]) {
      try {
        const intent = JSON.parse(intentMatch[1]) as { question?: string };
        if (intent.question) {
          return { text: intent.question };
        }
      } catch {
        // fall through
      }
    }
    if (text.includes("<recommendation>")) {
      const m = text.match(/<recommendation>([\s\S]*?)<\/recommendation>/);
      if (m?.[1]) return { text: m[1] };
    }
    return {
      text: "Understood. Could you tell me a little more about that? (Offline mode - configure DRQUACK_LLM_PROVIDER and an API key for natural responses.)",
    };
  }
}