#!/usr/bin/env node
// =============================================================================
// INDEX DSaaS - Microsoft Graph Compliance MCP Server
// Main entry point
// =============================================================================

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { createGraphClient } from "./services/graph-client.js";
import { registerComplianceTools } from "./tools/compliance-tools.js";

// -------------------------------------------------------------------------
// Server Initialization
// -------------------------------------------------------------------------

const server = new McpServer({
  name: "msgraph-compliance-mcp-server",
  version: "1.0.0",
});

// Initialize Graph client (will throw if env vars are missing)
let graphClient: ReturnType<typeof createGraphClient>;
try {
  graphClient = createGraphClient();
  console.error("[INDEX] Graph client initialized for tenant:", graphClient.getTenantId());
} catch (error) {
  console.error("[INDEX] WARNING: Graph client not configured.", error instanceof Error ? error.message : "");
  console.error("[INDEX] Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET to enable live queries.");
  console.error("[INDEX] Server will start but Graph queries will fail until credentials are provided.");
  // Create a stub client that will throw on use -- tools will return actionable errors
  graphClient = createGraphClient();
}

// Register all compliance tools
registerComplianceTools(server, graphClient);

// -------------------------------------------------------------------------
// Transport Setup
// -------------------------------------------------------------------------

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[INDEX] MCP server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      server: "msgraph-compliance-mcp-server",
      version: "1.0.0",
    });
  });

  const port = parseInt(process.env.PORT || "3001");
  app.listen(port, () => {
    console.error(`[INDEX] MCP server running on http://localhost:${port}/mcp`);
  });
}

// -------------------------------------------------------------------------
// Startup
// -------------------------------------------------------------------------

const transport = process.env.TRANSPORT || "stdio";

if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("[INDEX] Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("[INDEX] Server error:", error);
    process.exit(1);
  });
}
