# Euro-Office Document Server MCP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server that wraps the Euro-Office Document Server's conversion, builder, and command APIs for end users.

**Architecture:** Stateless TypeScript MCP server using stdio transport. A thin HTTP client handles JWT signing and Document Server communication. An ephemeral file server bridges local file paths to the URL-based Document Server API. Tools are organized by API surface: conversion, generation, and session management.

**Tech Stack:** TypeScript (strict), `@modelcontextprotocol/sdk`, `zod/v4`, `jsonwebtoken`, Node.js built-in `fetch` and `http`, Vitest, pnpm workspaces.

**Spec:** `docs/specs/2026-03-31-document-server-mcp-design.md`

**Document Server source:** `/Users/daniel/dankelleher/euro-office/DocumentServer`

**Local Document Server:** `http://localhost:8080`, JWT_SECRET=`secret`, runs in Docker via `DocumentServer/develop/docker-compose.yml`

---

## File Structure

```
euro-office-mcp/
  package.json                                    # Root workspace config
  tsconfig.json                                   # Shared TS config (strict)
  packages/
    document-server/
      package.json                                # Package deps + scripts
      tsconfig.json                               # Extends root, sets src/build paths
      src/
        index.ts                                  # Entry point: create server, connect stdio
        config.ts                                 # Env var loading + validation
        client/
          documentServer.ts                       # JWT signing + HTTP client for all DS endpoints
        lib/
          fileSource.ts                           # Local path / URL resolution + ephemeral HTTP server
          errors.ts                               # DS error code mapping to user-friendly messages
        tools/
          convert.ts                              # convert_document tool
          generate.ts                             # generate_document tool
          status.ts                               # get_document_status tool
          save.ts                                 # save_document tool
          rename.ts                               # rename_document tool
          admin.ts                                # disconnect_users + get_server_info tools
      test/
        client/
          documentServer.test.ts                  # Client unit tests (mocked fetch)
        lib/
          fileSource.test.ts                      # File source unit tests
          errors.test.ts                          # Error mapping tests
        tools/
          convert.test.ts                         # Convert tool tests
          generate.test.ts                        # Generate tool tests
          status.test.ts                          # Status tool tests
          save.test.ts                            # Save tool tests
          rename.test.ts                          # Rename tool tests
          admin.test.ts                           # Admin tool tests
        integration/
          smoke.test.ts                           # Live Document Server smoke tests
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.json` (root)
- Create: `packages/document-server/package.json`
- Create: `packages/document-server/tsconfig.json`
- Create: `packages/document-server/src/config.ts`
- Create: `packages/document-server/src/index.ts`
- Test: `packages/document-server/test/config.test.ts` (deferred to after config is written)

- [ ] **Step 1: Initialize root workspace**

Root `package.json`:
```json
{
  "name": "euro-office-mcp",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

Root `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 2: Initialize document-server package**

`packages/document-server/package.json`:
```json
{
  "name": "@euro-office-mcp/document-server",
  "version": "0.1.0",
  "type": "module",
  "main": "build/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "biome check src/ test/"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "jsonwebtoken": "^9.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@biomejs/biome": "latest",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.8.0",
    "vitest": "^3.0.0"
  }
}
```

`packages/document-server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "build",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Install dependencies**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp && pnpm install`
Expected: Dependencies installed, node_modules created.

- [ ] **Step 4: Write config module**

`packages/document-server/src/config.ts`:
```typescript
export interface Config {
  /** Euro-Office Document Server base URL */
  documentServerUrl: string;
  /** JWT secret for signing requests to the Document Server */
  jwtSecret: string;
  /** Hostname the Document Server can use to reach this MCP's ephemeral file server */
  fileServerHost: string;
}

export const loadConfig = (): Config => ({
  documentServerUrl: process.env.EURO_OFFICE_URL ?? "http://localhost:8080",
  jwtSecret: process.env.EURO_OFFICE_JWT_SECRET ?? "my_jwt_secret",
  fileServerHost: process.env.EURO_OFFICE_FILE_SERVER_HOST ?? "localhost",
});
```

- [ ] **Step 5: Write minimal MCP server entry point**

`packages/document-server/src/index.ts`:
```typescript
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
```

- [ ] **Step 6: Build and verify**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp && pnpm build`
Expected: TypeScript compiles without errors. `packages/document-server/build/` contains `.js` files.

- [ ] **Step 7: Commit**

```bash
git add packages/ package.json tsconfig.json pnpm-workspace.yaml
git commit -m "scaffold: monorepo with document-server MCP package"
```

Note: You may need to create `pnpm-workspace.yaml` with:
```yaml
packages:
  - "packages/*"
```

---

### Task 2: Document Server HTTP Client

**Files:**
- Create: `packages/document-server/src/lib/errors.ts`
- Create: `packages/document-server/src/client/documentServer.ts`
- Test: `packages/document-server/test/client/documentServer.test.ts`
- Test: `packages/document-server/test/lib/errors.test.ts`

- [ ] **Step 1: Write error mapping module**

`packages/document-server/src/lib/errors.ts`:
```typescript
const COMMAND_ERRORS: Record<number, string> = {
  0: "Success",
  1: "Document not found — check the document key",
  2: "Invalid callback URL",
  3: "Document Server internal error",
  4: "No unsaved changes to save",
  5: "Unknown command",
  6: "Authentication failed — check JWT secret",
};

const CONVERSION_ERRORS: Record<number, string> = {
  [-1]: "Unknown conversion error",
  [-2]: "Conversion timeout",
  [-3]: "Conversion failed",
  [-4]: "Error downloading source document — check the URL is reachable from the Document Server",
  [-5]: "Incorrect document password",
  [-6]: "Database access error",
  [-7]: "Invalid input",
  [-8]: "Invalid token — check JWT secret",
  [-9]: "Cannot determine output format automatically",
  [-10]: "Document size limit exceeded",
};

export class DocumentServerError extends Error {
  constructor(
    public readonly code: number,
    public readonly context: string,
  ) {
    super(`${context}: ${COMMAND_ERRORS[code] ?? CONVERSION_ERRORS[code] ?? `Unknown error (code ${code})`}`);
    this.name = "DocumentServerError";
  }
}

export const formatCommandError = (code: number): string =>
  COMMAND_ERRORS[code] ?? `Unknown error (code ${code})`;

export const formatConversionError = (code: number): string =>
  CONVERSION_ERRORS[code] ?? `Unknown conversion error (code ${code})`;
```

- [ ] **Step 2: Write failing test for error mapping**

`packages/document-server/test/lib/errors.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { DocumentServerError, formatCommandError, formatConversionError } from "../../src/lib/errors.js";

describe("formatCommandError", () => {
  it("returns user-friendly message for known codes", () => {
    expect(formatCommandError(1)).toBe("Document not found — check the document key");
    expect(formatCommandError(6)).toBe("Authentication failed — check JWT secret");
  });

  it("returns generic message for unknown codes", () => {
    expect(formatCommandError(99)).toBe("Unknown error (code 99)");
  });
});

describe("formatConversionError", () => {
  it("returns user-friendly message for known codes", () => {
    expect(formatConversionError(-4)).toBe(
      "Error downloading source document — check the URL is reachable from the Document Server",
    );
  });

  it("returns generic message for unknown codes", () => {
    expect(formatConversionError(-99)).toBe("Unknown conversion error (code -99)");
  });
});

describe("DocumentServerError", () => {
  it("includes context and mapped message", () => {
    const err = new DocumentServerError(6, "command");
    expect(err.message).toBe("command: Authentication failed — check JWT secret");
    expect(err.code).toBe(6);
  });
});
```

- [ ] **Step 3: Run error tests**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp/packages/document-server && pnpm test -- test/lib/errors.test.ts`
Expected: All tests pass.

- [ ] **Step 4: Write the Document Server client**

`packages/document-server/src/client/documentServer.ts`:
```typescript
import jwt from "jsonwebtoken";
import type { Config } from "../config.js";
import { DocumentServerError } from "../lib/errors.js";

interface CommandRequest {
  c: "info" | "drop" | "forcesave" | "meta" | "version" | "license";
  key?: string;
  users?: string[];
  meta?: { title: string };
  userdata?: string;
}

interface ConversionRequest {
  filetype: string;
  key: string;
  outputtype: string;
  url: string;
  async?: boolean;
  title?: string;
}

interface BuilderRequest {
  url: string;
  async?: boolean;
  key?: string;
  argument?: Record<string, unknown>;
}

interface ConversionResponse {
  endConvert: boolean;
  fileType?: string;
  fileUrl?: string;
  percent: number;
  error?: number;
}

interface BuilderResponse {
  key: string;
  end: boolean;
  urls?: Record<string, string>;
  error?: number;
}

export class DocumentServerClient {
  private readonly baseUrl: string;
  private readonly secret: string;

  constructor(config: Config) {
    this.baseUrl = config.documentServerUrl.replace(/\/$/, "");
    this.secret = config.jwtSecret;
  }

  private signPayload(payload: Record<string, unknown>): string {
    return jwt.sign(payload, this.secret, { algorithm: "HS256", expiresIn: "5m" });
  }

  private async post<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    const token = this.signPayload(body);
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${this.signPayload({ payload: body })}`,
      },
      body: JSON.stringify({ ...body, token }),
    });

    if (!response.ok) {
      throw new Error(`Document Server returned HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  async command(request: CommandRequest): Promise<Record<string, unknown>> {
    const result = await this.post<Record<string, unknown>>("/command", request);
    const error = result.error as number | undefined;
    if (error !== undefined && error !== 0) {
      throw new DocumentServerError(error, `command:${request.c}`);
    }
    return result;
  }

  async convert(request: ConversionRequest): Promise<ConversionResponse> {
    const result = await this.post<ConversionResponse>("/converter", request);
    if (result.error !== undefined && result.error !== 0) {
      throw new DocumentServerError(result.error, "conversion");
    }
    return result;
  }

  async convertAndPoll(request: ConversionRequest, maxAttempts = 30, intervalMs = 1000): Promise<ConversionResponse> {
    const asyncRequest = { ...request, async: true };
    let result = await this.convert(asyncRequest);

    let attempts = 0;
    while (!result.endConvert && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      result = await this.convert(asyncRequest);
      attempts++;
    }

    if (!result.endConvert) {
      throw new Error("Conversion timed out after polling");
    }

    return result;
  }

  async build(request: BuilderRequest): Promise<BuilderResponse> {
    const result = await this.post<BuilderResponse>("/docbuilder", request);
    if (result.error !== undefined && result.error !== 0) {
      throw new DocumentServerError(result.error, "docbuilder");
    }
    return result;
  }

  async buildAndPoll(request: BuilderRequest, maxAttempts = 60, intervalMs = 1000): Promise<BuilderResponse> {
    const key = request.key ?? crypto.randomUUID();
    const asyncRequest = { ...request, async: true, key };
    let result = await this.build(asyncRequest);

    let attempts = 0;
    while (!result.end && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      result = await this.build({ ...asyncRequest, key });
      attempts++;
    }

    if (!result.end) {
      throw new Error("Document generation timed out after polling");
    }

    return result;
  }
}
```

- [ ] **Step 5: Write failing tests for the client**

`packages/document-server/test/client/documentServer.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import { DocumentServerError } from "../../src/lib/errors.js";

const mockConfig = {
  documentServerUrl: "http://localhost:8080",
  jwtSecret: "test-secret",
  fileServerHost: "localhost",
};

describe("DocumentServerClient", () => {
  let client: DocumentServerClient;

  beforeEach(() => {
    client = new DocumentServerClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("command", () => {
    it("returns result for version command", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 0, version: "9.2.1" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      const result = await client.command({ c: "version" });
      expect(result).toEqual({ error: 0, version: "9.2.1" });
    });

    it("throws DocumentServerError for non-zero error code", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 6, key: "test" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(client.command({ c: "info", key: "test" })).rejects.toThrow(DocumentServerError);
    });

    it("sends JWT in both body token field and Authorization header", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 0 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await client.command({ c: "version" });

      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options!.body as string);
      expect(body.token).toBeDefined();
      expect((options!.headers as Record<string, string>).Authorization).toMatch(/^Bearer /);
    });
  });

  describe("convert", () => {
    it("returns conversion result on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({ endConvert: true, fileType: "pdf", fileUrl: "http://ds/output.pdf", percent: 100 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await client.convert({
        filetype: "docx",
        key: "test-key",
        outputtype: "pdf",
        url: "http://example.com/doc.docx",
      });
      expect(result.endConvert).toBe(true);
      expect(result.fileUrl).toBe("http://ds/output.pdf");
    });

    it("throws on conversion error", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ error: -4 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

      await expect(
        client.convert({ filetype: "docx", key: "k", outputtype: "pdf", url: "http://bad" }),
      ).rejects.toThrow("downloading source document");
    });
  });

  describe("convertAndPoll", () => {
    it("polls until conversion completes", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      fetchSpy.mockResolvedValueOnce(
        new Response(JSON.stringify({ endConvert: false, percent: 50 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ endConvert: true, fileType: "pdf", fileUrl: "http://ds/out.pdf", percent: 100 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );

      const result = await client.convertAndPoll(
        { filetype: "docx", key: "k", outputtype: "pdf", url: "http://ex.com/d.docx" },
        5,
        10,
      );
      expect(result.endConvert).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
```

- [ ] **Step 6: Run client tests**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp/packages/document-server && pnpm test`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add packages/document-server/src/client/ packages/document-server/src/lib/errors.ts packages/document-server/test/
git commit -m "feat: Document Server HTTP client with JWT auth and error mapping"
```

---

### Task 3: File Source Module

**Files:**
- Create: `packages/document-server/src/lib/fileSource.ts`
- Test: `packages/document-server/test/lib/fileSource.test.ts`

- [ ] **Step 1: Write failing tests for file source**

`packages/document-server/test/lib/fileSource.test.ts`:
```typescript
import { describe, it, expect, afterEach } from "vitest";
import { resolveFileSource } from "../../src/lib/fileSource.js";
import { writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("resolveFileSource", () => {
  const testDir = join(tmpdir(), "euro-office-mcp-test");
  const testFile = join(testDir, "test.docx");

  beforeAll(() => {
    mkdirSync(testDir, { recursive: true });
    writeFileSync(testFile, "fake docx content");
  });

  afterAll(() => {
    unlinkSync(testFile);
  });

  it("passes URLs through directly", async () => {
    const source = await resolveFileSource("http://example.com/doc.docx", "localhost");
    expect(source.url).toBe("http://example.com/doc.docx");
    await source.cleanup();
  });

  it("passes https URLs through directly", async () => {
    const source = await resolveFileSource("https://example.com/doc.docx", "localhost");
    expect(source.url).toBe("https://example.com/doc.docx");
    await source.cleanup();
  });

  it("serves local files via ephemeral HTTP server", async () => {
    const source = await resolveFileSource(testFile, "localhost");
    expect(source.url).toMatch(/^http:\/\/localhost:\d+\//);

    // Verify the file is actually served
    const response = await fetch(source.url);
    expect(response.ok).toBe(true);
    const body = await response.text();
    expect(body).toBe("fake docx content");

    await source.cleanup();
  });

  it("uses configured host for URL construction", async () => {
    const source = await resolveFileSource(testFile, "host.docker.internal");
    expect(source.url).toMatch(/^http:\/\/host\.docker\.internal:\d+\//);
    await source.cleanup();
  });

  it("cleanup shuts down the ephemeral server", async () => {
    const source = await resolveFileSource(testFile, "localhost");
    const url = source.url;
    await source.cleanup();

    await expect(fetch(url)).rejects.toThrow();
  });

  it("throws for non-existent local files", async () => {
    await expect(resolveFileSource("/nonexistent/file.docx", "localhost")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp/packages/document-server && pnpm test -- test/lib/fileSource.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement file source module**

`packages/document-server/src/lib/fileSource.ts`:
```typescript
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
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf": "application/pdf",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".txt": "text/plain",
  ".html": "text/html",
  ".csv": "text/csv",
  ".js": "application/javascript",
};

const serveLocalFile = (filePath: string, host: string): Promise<ResolvedSource> =>
  new Promise((resolve, reject) => {
    // Verify file exists before starting server
    try {
      statSync(filePath);
    } catch {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    const fileName = basename(filePath);
    const mimeType = MIME_TYPES[extname(filePath)] ?? "application/octet-stream";

    const server: Server = createServer((req, res) => {
      if (req.url === `/${fileName}`) {
        res.writeHead(200, { "Content-Type": mimeType });
        createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }

      const url = `http://${host}:${address.port}/${fileName}`;

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

export const resolveFileSource = async (input: string, fileServerHost: string): Promise<ResolvedSource> => {
  if (isUrl(input)) {
    return { url: input, cleanup: async () => {} };
  }

  return serveLocalFile(input, fileServerHost);
};
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp/packages/document-server && pnpm test -- test/lib/fileSource.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/document-server/src/lib/fileSource.ts packages/document-server/test/lib/fileSource.test.ts
git commit -m "feat: ephemeral file source for serving local files to Document Server"
```

---

### Task 4: convert_document Tool

**Files:**
- Create: `packages/document-server/src/tools/convert.ts`
- Modify: `packages/document-server/src/index.ts`
- Test: `packages/document-server/test/tools/convert.test.ts`

- [ ] **Step 1: Write failing test for convert tool**

`packages/document-server/test/tools/convert.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import { handleConvertDocument } from "../../src/tools/convert.js";

const mockConfig = {
  documentServerUrl: "http://localhost:8080",
  jwtSecret: "test-secret",
  fileServerHost: "localhost",
};

describe("handleConvertDocument", () => {
  let client: DocumentServerClient;

  beforeEach(() => {
    client = new DocumentServerClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts a URL source and returns the download URL", async () => {
    vi.spyOn(client, "convertAndPoll").mockResolvedValueOnce({
      endConvert: true,
      fileType: "pdf",
      fileUrl: "http://ds/output.pdf",
      percent: 100,
    });

    const result = await handleConvertDocument(client, mockConfig.fileServerHost, {
      source: "http://example.com/doc.docx",
      outputFormat: "pdf",
    });

    expect(result.content[0]).toEqual({
      type: "text",
      text: expect.stringContaining("http://ds/output.pdf"),
    });
  });

  it("generates a document key from source and format", async () => {
    const spy = vi.spyOn(client, "convertAndPoll").mockResolvedValueOnce({
      endConvert: true,
      fileType: "pdf",
      fileUrl: "http://ds/output.pdf",
      percent: 100,
    });

    await handleConvertDocument(client, mockConfig.fileServerHost, {
      source: "http://example.com/doc.docx",
      outputFormat: "pdf",
    });

    const callArgs = spy.mock.calls[0][0];
    expect(callArgs.key).toBeDefined();
    expect(callArgs.filetype).toBe("docx");
    expect(callArgs.outputtype).toBe("pdf");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp/packages/document-server && pnpm test -- test/tools/convert.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement convert tool**

`packages/document-server/src/tools/convert.ts`:
```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";
import { resolveFileSource } from "../lib/fileSource.js";
import { writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { createHash } from "node:crypto";

export const convertDocumentSchema = z.object({
  source: z.string().describe("Local file path or URL to the source document"),
  outputFormat: z
    .string()
    .describe("Target format: pdf, docx, odt, xlsx, ods, pptx, odp, txt, html, csv, etc."),
  outputPath: z
    .string()
    .optional()
    .describe("Local path to save the converted file. If omitted, returns the download URL."),
});

type ConvertDocumentInput = z.infer<typeof convertDocumentSchema>;

const inferFileType = (source: string): string => {
  const ext = extname(source).replace(".", "").toLowerCase();
  return ext || "docx";
};

const generateKey = (source: string, outputFormat: string): string => {
  const hash = createHash("md5").update(`${source}-${outputFormat}-${Date.now()}`).digest("hex");
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
      return { content: [{ type: "text", text: "Conversion completed but no output URL was returned." }] };
    }

    if (input.outputPath) {
      const response = await fetch(result.fileUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(input.outputPath, buffer);
      return {
        content: [{ type: "text", text: `Converted to ${input.outputFormat} and saved to ${input.outputPath}` }],
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

export const registerConvertTool = (server: McpServer, client: DocumentServerClient, fileServerHost: string) => {
  server.tool(
    "convert_document",
    "Convert a document between formats (e.g., docx to pdf, xlsx to csv, odt to docx)",
    convertDocumentSchema.shape,
    async (input) => handleConvertDocument(client, fileServerHost, input),
  );
};
```

- [ ] **Step 4: Wire up in index.ts**

Update `packages/document-server/src/index.ts`:
```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { DocumentServerClient } from "./client/documentServer.js";
import { registerConvertTool } from "./tools/convert.js";

const config = loadConfig();
const client = new DocumentServerClient(config);

const server = new McpServer({
  name: "euro-office-document-server",
  version: "0.1.0",
});

registerConvertTool(server, client, config.fileServerHost);

const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Euro-Office Document Server MCP running on stdio");
};

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

- [ ] **Step 5: Run tests and build**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp && pnpm test && pnpm build`
Expected: All tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/document-server/src/tools/convert.ts packages/document-server/src/index.ts packages/document-server/test/tools/convert.test.ts
git commit -m "feat: convert_document tool with URL and local file support"
```

---

### Task 5: generate_document Tool

**Files:**
- Create: `packages/document-server/src/tools/generate.ts`
- Modify: `packages/document-server/src/index.ts`
- Test: `packages/document-server/test/tools/generate.test.ts`

- [ ] **Step 1: Write failing test**

`packages/document-server/test/tools/generate.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import { handleGenerateDocument } from "../../src/tools/generate.js";

const mockConfig = {
  documentServerUrl: "http://localhost:8080",
  jwtSecret: "test-secret",
  fileServerHost: "localhost",
};

describe("handleGenerateDocument", () => {
  let client: DocumentServerClient;

  beforeEach(() => {
    client = new DocumentServerClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates a document from a script URL", async () => {
    vi.spyOn(client, "buildAndPoll").mockResolvedValueOnce({
      key: "build-1",
      end: true,
      urls: { "output.docx": "http://ds/output.docx" },
    });

    const result = await handleGenerateDocument(client, mockConfig.fileServerHost, {
      script: "http://example.com/builder.js",
    });

    expect(result.content[0].text).toContain("output.docx");
  });

  it("passes arguments to the builder", async () => {
    const spy = vi.spyOn(client, "buildAndPoll").mockResolvedValueOnce({
      key: "build-1",
      end: true,
      urls: { "output.docx": "http://ds/output.docx" },
    });

    await handleGenerateDocument(client, mockConfig.fileServerHost, {
      script: "http://example.com/builder.js",
      arguments: { title: "My Doc" },
    });

    expect(spy.mock.calls[0][0].argument).toEqual({ title: "My Doc" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp/packages/document-server && pnpm test -- test/tools/generate.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement generate tool**

`packages/document-server/src/tools/generate.ts`:
```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";
import { resolveFileSource } from "../lib/fileSource.js";
import { writeFile } from "node:fs/promises";

export const generateDocumentSchema = z.object({
  script: z.string().describe("Local file path or URL to a .js Document Builder script"),
  outputPath: z.string().optional().describe("Local path to save the generated document"),
  arguments: z
    .record(z.unknown())
    .optional()
    .describe("Arguments passed to the builder script"),
});

type GenerateDocumentInput = z.infer<typeof generateDocumentSchema>;

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
      return { content: [{ type: "text", text: "Document generation completed but no output files were produced." }] };
    }

    const entries = Object.entries(result.urls);

    if (input.outputPath && entries.length > 0) {
      const [, url] = entries[0];
      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      await writeFile(input.outputPath, buffer);
      return {
        content: [{ type: "text", text: `Generated document saved to ${input.outputPath}` }],
      };
    }

    const fileList = entries.map(([name, url]) => `- ${name}: ${url}`).join("\n");
    return {
      content: [{ type: "text", text: `Generated document(s):\n${fileList}` }],
    };
  } finally {
    await fileSource.cleanup();
  }
};

export const registerGenerateTool = (server: McpServer, client: DocumentServerClient, fileServerHost: string) => {
  server.tool(
    "generate_document",
    "Create a document programmatically using a Document Builder script",
    generateDocumentSchema.shape,
    async (input) => handleGenerateDocument(client, fileServerHost, input),
  );
};
```

- [ ] **Step 4: Register in index.ts**

Add to `packages/document-server/src/index.ts`:
```typescript
import { registerGenerateTool } from "./tools/generate.js";
// ... after registerConvertTool:
registerGenerateTool(server, client, config.fileServerHost);
```

- [ ] **Step 5: Run tests and build**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp && pnpm test && pnpm build`
Expected: All tests pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add packages/document-server/src/tools/generate.ts packages/document-server/src/index.ts packages/document-server/test/tools/generate.test.ts
git commit -m "feat: generate_document tool with builder API support"
```

---

### Task 6: Session Management Tools (status, save, rename)

**Files:**
- Create: `packages/document-server/src/tools/status.ts`
- Create: `packages/document-server/src/tools/save.ts`
- Create: `packages/document-server/src/tools/rename.ts`
- Modify: `packages/document-server/src/index.ts`
- Test: `packages/document-server/test/tools/status.test.ts`
- Test: `packages/document-server/test/tools/save.test.ts`
- Test: `packages/document-server/test/tools/rename.test.ts`

- [ ] **Step 1: Write failing tests for all three tools**

`packages/document-server/test/tools/status.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import { handleGetDocumentStatus } from "../../src/tools/status.js";

const mockConfig = {
  documentServerUrl: "http://localhost:8080",
  jwtSecret: "test-secret",
  fileServerHost: "localhost",
};

describe("handleGetDocumentStatus", () => {
  let client: DocumentServerClient;

  beforeEach(() => {
    client = new DocumentServerClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns active users for a document", async () => {
    vi.spyOn(client, "command").mockResolvedValueOnce({
      error: 0,
      key: "doc-1",
      users: ["user-a", "user-b"],
    });

    const result = await handleGetDocumentStatus(client, { documentKey: "doc-1" });
    expect(result.content[0].text).toContain("user-a");
    expect(result.content[0].text).toContain("user-b");
  });
});
```

`packages/document-server/test/tools/save.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import { handleSaveDocument } from "../../src/tools/save.js";

const mockConfig = {
  documentServerUrl: "http://localhost:8080",
  jwtSecret: "test-secret",
  fileServerHost: "localhost",
};

describe("handleSaveDocument", () => {
  let client: DocumentServerClient;

  beforeEach(() => {
    client = new DocumentServerClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("triggers force-save for a document key", async () => {
    const spy = vi.spyOn(client, "command").mockResolvedValueOnce({ error: 0, key: "doc-1" });

    const result = await handleSaveDocument(client, { documentKey: "doc-1" });
    expect(spy.mock.calls[0][0]).toEqual({ c: "forcesave", key: "doc-1" });
    expect(result.content[0].text).toContain("saved");
  });

  it("passes userdata when provided", async () => {
    const spy = vi.spyOn(client, "command").mockResolvedValueOnce({ error: 0, key: "doc-1" });

    await handleSaveDocument(client, { documentKey: "doc-1", userdata: "checkpoint" });
    expect(spy.mock.calls[0][0]).toEqual({ c: "forcesave", key: "doc-1", userdata: "checkpoint" });
  });
});
```

`packages/document-server/test/tools/rename.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import { handleRenameDocument } from "../../src/tools/rename.js";

const mockConfig = {
  documentServerUrl: "http://localhost:8080",
  jwtSecret: "test-secret",
  fileServerHost: "localhost",
};

describe("handleRenameDocument", () => {
  let client: DocumentServerClient;

  beforeEach(() => {
    client = new DocumentServerClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends meta command with new title", async () => {
    const spy = vi.spyOn(client, "command").mockResolvedValueOnce({ error: 0, key: "doc-1" });

    const result = await handleRenameDocument(client, { documentKey: "doc-1", title: "New Name.docx" });
    expect(spy.mock.calls[0][0]).toEqual({ c: "meta", key: "doc-1", meta: { title: "New Name.docx" } });
    expect(result.content[0].text).toContain("New Name.docx");
  });
});
```

- [ ] **Step 2: Implement all three tools**

`packages/document-server/src/tools/status.ts`:
```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";

export const getDocumentStatusSchema = z.object({
  documentKey: z.string().describe("The unique key identifying the document/editing session"),
});

type GetDocumentStatusInput = z.infer<typeof getDocumentStatusSchema>;

export const handleGetDocumentStatus = async (
  client: DocumentServerClient,
  input: GetDocumentStatusInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  const result = await client.command({ c: "info", key: input.documentKey });

  const users = result.users as string[] | undefined;
  if (!users || users.length === 0) {
    return { content: [{ type: "text", text: `Document "${input.documentKey}": No active editors.` }] };
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

export const registerStatusTool = (server: McpServer, client: DocumentServerClient) => {
  server.tool(
    "get_document_status",
    "Check who is currently editing a document and its session status",
    getDocumentStatusSchema.shape,
    async (input) => handleGetDocumentStatus(client, input),
  );
};
```

`packages/document-server/src/tools/save.ts`:
```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";

export const saveDocumentSchema = z.object({
  documentKey: z.string().describe("The unique key identifying the document/editing session"),
  userdata: z.string().optional().describe("Custom data passed through to the save callback"),
});

type SaveDocumentInput = z.infer<typeof saveDocumentSchema>;

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

export const registerSaveTool = (server: McpServer, client: DocumentServerClient) => {
  server.tool(
    "save_document",
    "Force-save a document that is currently being edited (requires active editing session with callback URL)",
    saveDocumentSchema.shape,
    async (input) => handleSaveDocument(client, input),
  );
};
```

`packages/document-server/src/tools/rename.ts`:
```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";

export const renameDocumentSchema = z.object({
  documentKey: z.string().describe("The unique key identifying the document"),
  title: z.string().describe("New document title"),
});

type RenameDocumentInput = z.infer<typeof renameDocumentSchema>;

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
    content: [{ type: "text", text: `Document "${input.documentKey}" renamed to "${input.title}"` }],
  };
};

export const registerRenameTool = (server: McpServer, client: DocumentServerClient) => {
  server.tool(
    "rename_document",
    "Update the title of a document in an active editing session",
    renameDocumentSchema.shape,
    async (input) => handleRenameDocument(client, input),
  );
};
```

- [ ] **Step 3: Register all three in index.ts**

Add to `packages/document-server/src/index.ts`:
```typescript
import { registerStatusTool } from "./tools/status.js";
import { registerSaveTool } from "./tools/save.js";
import { registerRenameTool } from "./tools/rename.js";
// ... after existing registrations:
registerStatusTool(server, client);
registerSaveTool(server, client);
registerRenameTool(server, client);
```

- [ ] **Step 4: Run all tests and build**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp && pnpm test && pnpm build`
Expected: All tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/document-server/src/tools/status.ts packages/document-server/src/tools/save.ts packages/document-server/src/tools/rename.ts packages/document-server/src/index.ts packages/document-server/test/tools/
git commit -m "feat: session management tools (status, save, rename)"
```

---

### Task 7: Admin Tools (disconnect_users, get_server_info)

**Files:**
- Create: `packages/document-server/src/tools/admin.ts`
- Modify: `packages/document-server/src/index.ts`
- Test: `packages/document-server/test/tools/admin.test.ts`

- [ ] **Step 1: Write failing test**

`packages/document-server/test/tools/admin.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import { handleDisconnectUsers, handleGetServerInfo } from "../../src/tools/admin.js";

const mockConfig = {
  documentServerUrl: "http://localhost:8080",
  jwtSecret: "test-secret",
  fileServerHost: "localhost",
};

describe("handleDisconnectUsers", () => {
  let client: DocumentServerClient;

  beforeEach(() => {
    client = new DocumentServerClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("disconnects specific users", async () => {
    const spy = vi.spyOn(client, "command").mockResolvedValueOnce({ error: 0, key: "doc-1" });

    const result = await handleDisconnectUsers(client, { documentKey: "doc-1", userIds: ["u1", "u2"] });
    expect(spy.mock.calls[0][0]).toEqual({ c: "drop", key: "doc-1", users: ["u1", "u2"] });
    expect(result.content[0].text).toContain("Disconnected");
  });

  it("disconnects all users when no IDs provided", async () => {
    const spy = vi.spyOn(client, "command").mockResolvedValueOnce({ error: 0, key: "doc-1" });

    await handleDisconnectUsers(client, { documentKey: "doc-1" });
    expect(spy.mock.calls[0][0]).toEqual({ c: "drop", key: "doc-1" });
  });
});

describe("handleGetServerInfo", () => {
  let client: DocumentServerClient;

  beforeEach(() => {
    client = new DocumentServerClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns version and license info", async () => {
    const spy = vi.spyOn(client, "command");
    spy.mockResolvedValueOnce({ error: 0, version: "9.2.1" });
    spy.mockResolvedValueOnce({
      error: 0,
      license: { end_date: "2099-01-01", trial: false },
      server: { packageType: 0, buildVersion: "9.2.1" },
    });

    const result = await handleGetServerInfo(client);
    expect(result.content[0].text).toContain("9.2.1");
  });
});
```

- [ ] **Step 2: Implement admin tools**

`packages/document-server/src/tools/admin.ts`:
```typescript
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";

export const disconnectUsersSchema = z.object({
  documentKey: z.string().describe("The unique key identifying the document"),
  userIds: z.array(z.string()).optional().describe("Specific user IDs to disconnect. If omitted, disconnects all."),
});

type DisconnectUsersInput = z.infer<typeof disconnectUsersSchema>;

export const handleDisconnectUsers = async (
  client: DocumentServerClient,
  input: DisconnectUsersInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  await client.command({
    c: "drop",
    key: input.documentKey,
    ...(input.userIds ? { users: input.userIds } : {}),
  });

  const target = input.userIds ? `users ${input.userIds.join(", ")}` : "all users";
  return {
    content: [{ type: "text", text: `Disconnected ${target} from document "${input.documentKey}"` }],
  };
};

export const handleGetServerInfo = async (
  client: DocumentServerClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  const [versionResult, licenseResult] = await Promise.all([
    client.command({ c: "version" }),
    client.command({ c: "license" }),
  ]);

  const version = versionResult.version as string;
  const license = licenseResult.license as Record<string, unknown> | undefined;
  const serverInfo = licenseResult.server as Record<string, unknown> | undefined;
  const packageTypes = ["Open Source", "Enterprise", "Developer"];
  const packageType = packageTypes[(serverInfo?.packageType as number) ?? 0] ?? "Unknown";

  const lines = [
    `Euro-Office Document Server`,
    `Version: ${version}`,
    `Build: ${serverInfo?.buildVersion ?? "unknown"}`,
    `Package: ${packageType}`,
  ];

  if (license) {
    lines.push(`License expires: ${license.end_date ?? "N/A"}`);
    lines.push(`Trial: ${license.trial ?? false}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
};

export const registerAdminTools = (server: McpServer, client: DocumentServerClient) => {
  server.tool(
    "disconnect_users",
    "Remove users from an active document editing session (admin)",
    disconnectUsersSchema.shape,
    async (input) => handleDisconnectUsers(client, input),
  );

  server.tool("get_server_info", "Get Euro-Office Document Server version and license information (admin)", {}, async () =>
    handleGetServerInfo(client),
  );
};
```

- [ ] **Step 3: Register in index.ts**

Add to `packages/document-server/src/index.ts`:
```typescript
import { registerAdminTools } from "./tools/admin.js";
// ... after existing registrations:
registerAdminTools(server, client);
```

- [ ] **Step 4: Run all tests and build**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp && pnpm test && pnpm build`
Expected: All tests pass, build succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/document-server/src/tools/admin.ts packages/document-server/src/index.ts packages/document-server/test/tools/admin.test.ts
git commit -m "feat: admin tools (disconnect_users, get_server_info)"
```

---

### Task 8: Integration Smoke Test

**Files:**
- Create: `packages/document-server/test/integration/smoke.test.ts`

This task requires a running Document Server at `http://localhost:8080` with `JWT_SECRET=secret`.

- [ ] **Step 1: Write integration smoke test**

`packages/document-server/test/integration/smoke.test.ts`:
```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";

const INTEGRATION = process.env.INTEGRATION_TEST === "true";

describe.skipIf(!INTEGRATION)("Document Server Integration", () => {
  let client: DocumentServerClient;

  beforeAll(() => {
    client = new DocumentServerClient({
      documentServerUrl: process.env.EURO_OFFICE_URL ?? "http://localhost:8080",
      jwtSecret: process.env.EURO_OFFICE_JWT_SECRET ?? "secret",
      fileServerHost: process.env.EURO_OFFICE_FILE_SERVER_HOST ?? "host.docker.internal",
    });
  });

  it("gets server version", async () => {
    const result = await client.command({ c: "version" });
    expect(result.error).toBe(0);
    expect(result.version).toBeDefined();
    console.error("Server version:", result.version);
  });

  it("gets license info", async () => {
    const result = await client.command({ c: "license" });
    expect(result.error).toBe(0);
    expect(result.server).toBeDefined();
    console.error("Server info:", JSON.stringify(result.server));
  });

  it("returns error for non-existent document key", async () => {
    await expect(client.command({ c: "info", key: "nonexistent-key-12345" })).rejects.toThrow("Document not found");
  });
});
```

- [ ] **Step 2: Run integration test (requires live Document Server)**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp/packages/document-server && INTEGRATION_TEST=true pnpm test -- test/integration/smoke.test.ts`
Expected: Tests pass if Document Server is running. Tests skip if `INTEGRATION_TEST` is not set.

- [ ] **Step 3: Add integration test script to package.json**

Add to `packages/document-server/package.json` scripts:
```json
"test:integration": "INTEGRATION_TEST=true vitest run test/integration/"
```

- [ ] **Step 4: Commit**

```bash
git add packages/document-server/test/integration/ packages/document-server/package.json
git commit -m "test: integration smoke tests against live Document Server"
```

---

### Task 9: README and Final Wiring

**Files:**
- Create: `packages/document-server/README.md`
- Create: `.gitignore`

- [ ] **Step 1: Write package README**

`packages/document-server/README.md`:
```markdown
# @euro-office-mcp/document-server

MCP server for the Euro-Office Document Server. Provides tools for document conversion, generation, and editing session management.

## Setup

```bash
pnpm install
pnpm build
```

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `EURO_OFFICE_URL` | Document Server base URL | `http://localhost:8080` |
| `EURO_OFFICE_JWT_SECRET` | JWT signing secret | `my_jwt_secret` |
| `EURO_OFFICE_FILE_SERVER_HOST` | Hostname for ephemeral file server (use `host.docker.internal` for Docker) | `localhost` |

## Usage with Claude Desktop / VS Code

Add to your MCP config:

```json
{
  "euro-office-document-server": {
    "type": "stdio",
    "command": "node",
    "args": ["path/to/euro-office-mcp/packages/document-server/build/index.js"],
    "env": {
      "EURO_OFFICE_URL": "http://localhost:8080",
      "EURO_OFFICE_JWT_SECRET": "secret",
      "EURO_OFFICE_FILE_SERVER_HOST": "host.docker.internal"
    }
  }
}
```

## Tools

### User-Facing
- **convert_document** — Convert between formats (docx, pdf, odt, xlsx, etc.)
- **generate_document** — Create documents from builder scripts
- **get_document_status** — Check active editors on a document
- **save_document** — Force-save a document in an active editing session
- **rename_document** — Update document title

### Admin
- **disconnect_users** — Remove users from an editing session
- **get_server_info** — Server version and license info

## Testing

```bash
pnpm test                    # Unit tests
pnpm test:integration        # Integration tests (requires running Document Server)
```

## Running the Document Server locally

```bash
docker pull ghcr.io/euro-office/documentserver:latest
docker run -d -p 8080:80 -e JWT_SECRET=secret -e ALLOW_PRIVATE_IP_ADDRESS=true ghcr.io/euro-office/documentserver:latest
```
```

- [ ] **Step 2: Create .gitignore**

`.gitignore` (root):
```
node_modules/
build/
dist/
*.tsbuildinfo
.env
```

- [ ] **Step 3: Final build and test run**

Run: `cd /Users/daniel/dankelleher/euro-office-mcp && pnpm install && pnpm build && pnpm test`
Expected: Everything passes.

- [ ] **Step 4: Commit**

```bash
git add packages/document-server/README.md .gitignore
git commit -m "docs: README with setup, config, and usage instructions"
```
