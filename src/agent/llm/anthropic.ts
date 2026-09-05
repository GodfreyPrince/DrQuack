/**
 * Anthropic Messages API adapter (Claude).
 */

import type { ChatMessage, ChatRequest, ChatResponse, LlmProvider } from "./types.js";
import { timedFetch } from "./types.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

export class AnthropicProvider implements LlmProvider {
  readonly name = "anthropic";
  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const system = request.messages
        .filter((m): m is ChatMessage & { role: "system" } => m.role === "system")
        .map((m) => m.content)
        .join("\n\n");

      const res = await timedFetch(ANTHROPIC_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          system: system || undefined,
          messages: request.messages.filter((m) => m.role !== "system"),
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxTokens ?? 400,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        return {
          text: "",
          error: `Anthropic API returned ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      const data = (await res.json()) as {
        content?: { type?: string; text?: string }[];
      };
      const text =
        data.content
          ?.filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n")
          .trim() ?? "";
      if (!text) return { text: "", error: "Anthropic returned an empty completion" };
      return { text };
    } catch (err) {
      return { text: "", error: err instanceof Error ? err.message : String(err) };
    }
  }
}