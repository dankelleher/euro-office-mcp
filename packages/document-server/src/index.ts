import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import { loadConfig } from "./config.js";
import { DocumentServerClient } from "./client/documentServer.js";
import { registerConvertTool } from "./tools/convert.js";
import { registerGenerateTool } from "./tools/generate.js";
import { registerStatusTool } from "./tools/status.js";
import { registerSaveTool } from "./tools/save.js";
import { registerRenameTool } from "./tools/rename.js";
import { registerAdminTools } from "./tools/admin.js";

const config = loadConfig();
const client = new DocumentServerClient(config);

/** Create and configure a new McpServer instance with all tools registered. */
const createServer = (): McpServer => {
  const server = new McpServer({
    name: "euro-office-document-server",
    version: "0.1.0",
  });

  registerConvertTool(server, client, config.fileServerHost);
  registerGenerateTool(server, client, config.fileServerHost);
  registerStatusTool(server, client);
  registerSaveTool(server, client);
  registerRenameTool(server, client);
  registerAdminTools(server, client);

  return server;
};

const startStdio = async () => {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Euro-Office Document Server MCP running on stdio");
};

const startHttp = async (port: number) => {
  const app = express();
  app.use(express.json());

  const transports: Record<string, StreamableHTTPServerTransport> = {};

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && transports[sessionId]) {
      await transports[sessionId].handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) delete transports[sid];
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID" },
      id: null,
    });
  });

  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }
    await transports[sessionId].handleRequest(req, res);
  });

  app.listen(port, "0.0.0.0", () => {
    console.error(
      `Euro-Office Document Server MCP running on http://0.0.0.0:${port}/mcp`,
    );
  });
};

const main = async () => {
  const transport = process.env.MCP_TRANSPORT ?? "stdio";
  if (transport === "http") {
    const port = parseInt(process.env.MCP_PORT ?? "3000", 10);
    await startHttp(port);
  } else {
    await startStdio();
  }
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
