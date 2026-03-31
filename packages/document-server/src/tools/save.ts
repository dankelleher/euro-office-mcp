import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";

const saveDocumentSchema = {
  documentKey: z
    .string()
    .describe("The unique key identifying the document/editing session"),
  userdata: z
    .string()
    .optional()
    .describe("Custom data passed through to the save callback"),
};

interface SaveDocumentInput {
  documentKey: string;
  userdata?: string;
}

export const handleSaveDocument = async (
  client: DocumentServerClient,
  input: SaveDocumentInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  await client.command({
    c: "forcesave",
    key: input.documentKey,
    ...(input.userdata ? { userdata: input.userdata } : {}),
  });

  return {
    content: [
      {
        type: "text",
        text: `Document "${input.documentKey}" force-saved. Note: the saved file is delivered via the Document Server's callback mechanism to the configured storage integration.`,
      },
    ],
  };
};

export const registerSaveTool = (
  server: McpServer,
  client: DocumentServerClient,
) => {
  server.tool(
    "save_document",
    "Force-save a document that is currently being edited (requires active editing session with callback URL)",
    saveDocumentSchema,
    async (input) => handleSaveDocument(client, input),
  );
};
