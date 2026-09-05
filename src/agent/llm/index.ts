import { loadConfig, resolveProviderKind } from "../../config.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAICompatibleProvider } from "./openaiCompatible.js";
import { TemplateLlmProvider } from "./template.js";
import type { LlmProvider } from "./types.js";

/**
 * Build the agent's LLM based on environment config.
 * Both wire formats connect - OpenAI-compatible and Anthropic - selected
 * via DRQUACK_LLM_PROVIDER. Falls back to the offline template renderer
 * when no key is configured, so the server always runs.
 */
export function createLlmProvider(): LlmProvider {
  const config = loadConfig();
  const kind = resolveProviderKind(config);

  switch (kind) {
    case "anthropic":
      return new AnthropicProvider(config.anthropicApiKey!, config.anthropicModel);
    case "openai":
      return new OpenAICompatibleProvider(
        config.openaiBaseUrl,
        config.openaiApiKey!,
        config.openaiModel,
      );
    case "template":
      return new TemplateLlmProvider();
  }
}