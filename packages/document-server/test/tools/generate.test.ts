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

    const result = await handleGenerateDocument(
      client,
      mockConfig.fileServerHost,
      { script: "http://example.com/builder.js" },
    );

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

  it("handles generation with no output files", async () => {
    vi.spyOn(client, "buildAndPoll").mockResolvedValueOnce({
      key: "build-1",
      end: true,
      urls: {},
    });

    const result = await handleGenerateDocument(
      client,
      mockConfig.fileServerHost,
      { script: "http://example.com/builder.js" },
    );

    expect(result.content[0].text).toContain("no output files");
  });
});
