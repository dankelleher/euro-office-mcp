import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";

const renameDocumentSchema = {
  documentKey: z
    .string()
    .describe("The unique key identifying the document"),
  title: z.string().describe("New document title"),
};

interface RenameDocumentInput {
  documentKey: string;
  title: string;
}

export const handleRenameDocument = async (
  client: DocumentServerClient,
  input: RenameDocumentInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  await client.command({
    c: "meta",
    key: input.documentKey,
    meta: { title: input.title },
  });

  return {
    content: [
      {
        type: "text",
        text: `Document "${input.documentKey}" renamed to "${input.title}"`,
      },
    ],
  };
};

export const registerRenameTool = (
  server: McpServer,
  client: DocumentServerClient,
) => {
  server.tool(
    "rename_document",
    "Update the title of a document in an active editing session",
    renameDocumentSchema,
    async (input) => handleRenameDocument(client, input),
  );
};
