import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";
import { resolveFileSource } from "../lib/fileSource.js";
import { writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { createHash } from "node:crypto";

const convertDocumentSchema = {
  source: z
    .string()
    .describe("Local file path or URL to the source document"),
  outputFormat: z
    .string()
    .describe(
      "Target format: pdf, docx, odt, xlsx, ods, pptx, odp, txt, html, csv, etc.",
    ),
  outputPath: z
    .string()
    .optional()
    .describe(
      "Local path to save the converted file. If omitted, returns the download URL.",
    ),
};

interface ConvertDocumentInput {
  source: string;
  outputFormat: string;
  outputPath?: string;
}

const inferFileType = (source: string): string => {
  // Strip query string and fragment for URL inputs
  const pathOnly = source.split("?")[0].split("#")[0];
  const ext = extname(pathOnly).replace(".", "").toLowerCase();
  return ext || "docx";
};

const generateKey = (source: string, outputFormat: string): string => {
  const hash = createHash("md5")
    .update(`${source}-${outputFormat}-${Date.now()}`)
    .digest("hex");
  return hash.slice(0, 20);
};

export const handleConvertDocument = async (
  client: DocumentServerClient,
  fileServerHost: string,
  input: ConvertDocumentInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  const fileSource = await resolveFileSource(input.source, fileServerHost);

  try {
    const result = await client.convertAndPoll({
      filetype: inferFileType(input.source),
      key: generateKey(input.source, input.outputFormat),
      outputtype: input.outputFormat,
      url: fileSource.url,
    });

    if (!result.fileUrl) {
      return {
        content: [
          {
            type: "text",
            text: "Conversion completed but no output URL was returned.",
          },
        ],
      };
    }

    if (input.outputPath) {
      const response = await fetch(result.fileUrl);
      if (!response.ok) {
        throw new Error(
          `Failed to download converted file: HTTP ${response.status} ${response.statusText}`,
        );
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(input.outputPath, buffer);
      return {
        content: [
          {
            type: "text",
            text: `Converted to ${input.outputFormat} and saved to ${input.outputPath}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: `Converted to ${input.outputFormat}. Download URL: ${result.fileUrl}`,
        },
      ],
    };
  } finally {
    await fileSource.cleanup();
  }
};

export const registerConvertTool = (
  server: McpServer,
  client: DocumentServerClient,
  fileServerHost: string,
) => {
  server.tool(
    "convert_document",
    "Convert a document between formats (e.g., docx to pdf, xlsx to csv, odt to docx)",
    convertDocumentSchema,
    async (input) => handleConvertDocument(client, fileServerHost, input),
  );
};
