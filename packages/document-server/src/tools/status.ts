import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";

const getDocumentStatusSchema = {
  documentKey: z
    .string()
    .describe("The unique key identifying the document/editing session"),
};

interface GetDocumentStatusInput {
  documentKey: string;
}

export const handleGetDocumentStatus = async (
  client: DocumentServerClient,
  input: GetDocumentStatusInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  const result = await client.command({ c: "info", key: input.documentKey });

  const users = result.users as string[] | undefined;
  if (!users || users.length === 0) {
    return {
      content: [
        {
          type: "text",
          text: `Document "${input.documentKey}": No active editors.`,
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: `Document "${input.documentKey}": ${users.length} active editor(s): ${users.join(", ")}`,
      },
    ],
  };
};

export const registerStatusTool = (
  server: McpServer,
  client: DocumentServerClient,
) => {
  server.tool(
    "get_document_status",
    "Check who is currently editing a document and its session status",
    getDocumentStatusSchema,
    async (input) => handleGetDocumentStatus(client, input),
  );
};
