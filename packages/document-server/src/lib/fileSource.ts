import { createServer, type Server } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { basename, extname } from "node:path";

export interface ResolvedSource {
  url: string;
  cleanup: () => Promise<void>;
}

const isUrl = (input: string): boolean =>
  input.startsWith("http://") || input.startsWith("https://");

const MIME_TYPES: Record<string, string> = {
  ".docx":
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx":
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf": "application/pdf",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".txt": "text/plain",
  ".html": "text/html",
  ".csv": "text/csv",
  ".js": "application/javascript",
  ".rtf": "application/rtf",
  ".doc": "application/msword",
  ".xls": "application/vnd.ms-excel",
  ".ppt": "application/vnd.ms-powerpoint",
};

const serveLocalFile = (
  filePath: string,
  host: string,
): Promise<ResolvedSource> =>
  new Promise((resolve, reject) => {
    try {
      statSync(filePath);
    } catch {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    const fileName = basename(filePath);
    const mimeType =
      MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream";

    const server: Server = createServer((req, res) => {
      if (req.url === `/${encodeURIComponent(fileName)}`) {
        res.writeHead(200, { "Content-Type": mimeType });
        createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }

      const url = `http://${host}:${address.port}/${encodeURIComponent(fileName)}`;

      resolve({
        url,
        cleanup: () =>
          new Promise<void>((resolveCleanup) => {
            server.close(() => resolveCleanup());
          }),
      });
    });

    server.on("error", reject);
  });

/**
 * Resolves a file input (local path or URL) into a fetchable URL.
 * For local files, spins up an ephemeral HTTP server scoped to the tool call.
 */
export const resolveFileSource = async (
  input: string,
  fileServerHost: string,
): Promise<ResolvedSource> => {
  if (isUrl(input)) {
    return { url: input, cleanup: async () => {} };
  }

  return serveLocalFile(input, fileServerHost);
};
