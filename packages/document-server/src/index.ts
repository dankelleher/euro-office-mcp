import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Euro-Office Document Server MCP running on stdio");
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
