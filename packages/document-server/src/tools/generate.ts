import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";
import { resolveFileSource } from "../lib/fileSource.js";
import { writeFile } from "node:fs/promises";

const generateDocumentSchema = {
  script: z
    .string()
    .describe("Local file path or URL to a .js Document Builder script"),
  outputPath: z
    .string()
    .optional()
    .describe("Local path to save the generated document"),
  arguments: z
    .record(z.unknown())
    .optional()
    .describe("Arguments passed to the builder script"),
};

interface GenerateDocumentInput {
  script: string;
  outputPath?: string;
  arguments?: Record<string, unknown>;
}

export const handleGenerateDocument = async (
  client: DocumentServerClient,
  fileServerHost: string,
  input: GenerateDocumentInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  const fileSource = await resolveFileSource(input.script, fileServerHost);

  try {
    const result = await client.buildAndPoll({
      url: fileSource.url,
      argument: input.arguments,
    });

    if (!result.urls || Object.keys(result.urls).length === 0) {
      return {
        content: [
          {
            type: "text",
            text: "Document generation completed but no output files were produced.",
          },
        ],
      };
    }

    const entries = Object.entries(result.urls);

    if (input.outputPath && entries.length > 0) {
      const [, url] = entries[0];
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(input.outputPath, buffer);
      return {
        content: [
          {
            type: "text",
            text: `Generated document saved to ${input.outputPath}`,
          },
        ],
      };
    }

    const fileList = entries
      .map(([name, url]) => `- ${name}: ${url}`)
      .join("\n");
    return {
      content: [{ type: "text", text: `Generated document(s):\n${fileList}` }],
    };
  } finally {
    await fileSource.cleanup();
  }
};

export const registerGenerateTool = (
  server: McpServer,
  client: DocumentServerClient,
  fileServerHost: string,
) => {
  server.tool(
    "generate_document",
    "Create a document programmatically using a Document Builder script",
    generateDocumentSchema,
    async (input) => handleGenerateDocument(client, fileServerHost, input),
  );
};
