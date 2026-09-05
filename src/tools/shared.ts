import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  ShapeOutput,
  ZodRawShapeCompat,
} from "@modelcontextprotocol/sdk/server/zod-compat.js";

import { DISCLAIMER } from "../core/disclaimer.js";

/** Wrap any value as an MCP text content block. */
export function text(payload: unknown): {
  content: { type: "text"; text: string }[];
} {
  return {
    content: [
      {
        type: "text",
        text: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

/** Attach the standard medical disclaimer to a result object. */
export function withDisclaimer<T extends object>(payload: T): T & { disclaimer: string } {
  return { ...payload, disclaimer: DISCLAIMER };
}

/**
 * Thin wrapper that registers a tool and appends the disclaimer to its
 * output, so no tool can forget the safety footer.
 */
export function registerSafeTool<S extends ZodRawShapeCompat>(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: S,
  handler: (args: ShapeOutput<S>) => Promise<object>,
): void {
  // The SDK's generic ToolCallback resolves awkwardly when wrapped in a
  // generic function (its conditional type defers over the type parameter),
  // so we cast at this single boundary. The handler above stays fully typed.
  const callback = (async (args: ShapeOutput<S>) => {
    const result = await handler(args);
    return text(withDisclaimer(result));
  }) as never;

  server.registerTool(name, { title: name, description, inputSchema }, callback);
}