import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";

const config = loadConfig();

const server = new McpServer({
  name: "euro-office-document-server",
  version: "0.1.0",
});

const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Euro-Office Document Server MCP running on stdio");
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
