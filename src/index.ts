#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { createServer } from "node:http";

import { buildServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);

/** stdio transport - the default for local LLM clients (Claude Desktop, Cursor, ...). */
async function runStdio(): Promise<void> {
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`${SERVER_NAME} v${SERVER_VERSION} running over stdio`);
}

/**
 * Streamable HTTP transport - for remote/embedded clients (web apps,
 * cloud deployments). Single-session mode: one client per server instance.
 */
async function runHttp(): Promise<void> {
  const server = buildServer();
  const app = express();

  app.use(express.json({ limit: "5mb" }));
  // Wide-open CORS for the scaffold; tighten per origin in production.
  app.use((_req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Mcp-Session-Id");
    if (_req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ name: SERVER_NAME, version: SERVER_VERSION, status: "ok" });
  });

  app.post("/mcp", async (req, res) => {
    const { StreamableHTTPServerTransport } = await import(
      "@modelcontextprotocol/sdk/server/streamableHttp.js"
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // single session
      onsessioninitialized: (sessionId) => {
        console.error(`MCP session initialized: ${sessionId}`);
      },
    });
    res.on("close", () => {
      void transport.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const httpServer = createServer(app);
  httpServer.listen(PORT, () => {
    console.error(`${SERVER_NAME} v${SERVER_VERSION} listening on http://localhost:${PORT}/mcp`);
  });
}

const useHttp = process.argv.includes("--http");
if (useHttp) {
  void runHttp();
} else {
  void runStdio();
}