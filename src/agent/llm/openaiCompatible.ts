/**
 * OpenAI-compatible chat completions adapter.
 * Works with: OpenAI, LM Studio (http://localhost:1234/v1), GLM/OpenRouter
 * and most hosted models that expose /chat/completions.
 */

import type { ChatRequest, ChatResponse, LlmProvider } from "./types.js";
import { timedFetch } from "./types.js";

export class OpenAICompatibleProvider implements LlmProvider {
  readonly name = "openai-compatible";
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(baseUrl: string, apiKey: string, model: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const res = await timedFetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxTokens ?? 400,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        return {
          text: "",
          error: `LLM endpoint returned ${res.status}: ${body.slice(0, 200)}`,
        };
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = data.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { text: "", error: "LLM returned an empty completion" };
      return { text };
    } catch (err) {
      return { text: "", error: err instanceof Error ? err.message : String(err) };
    }
  }
}