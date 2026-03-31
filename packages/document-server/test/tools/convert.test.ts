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

  it("handles conversion with no output URL", async () => {
    vi.spyOn(client, "convertAndPoll").mockResolvedValueOnce({
      endConvert: true,
      percent: 100,
    });

    const result = await handleConvertDocument(client, mockConfig.fileServerHost, {
      source: "http://example.com/doc.docx",
      outputFormat: "pdf",
    });

    expect(result.content[0].text).toContain("no output URL");
  });

  it("saves to outputPath when provided", async () => {
    vi.spyOn(client, "convertAndPoll").mockResolvedValueOnce({
      endConvert: true,
      fileType: "pdf",
      fileUrl: "http://ds/output.pdf",
      percent: 100,
    });

    // Mock the fetch for downloading the converted file
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(Buffer.from("pdf content"), { status: 200 }),
    );

    const { writeFile } = await import("node:fs/promises");
    vi.mock("node:fs/promises", async () => {
      const actual = await vi.importActual("node:fs/promises");
      return { ...actual, writeFile: vi.fn().mockResolvedValue(undefined) };
    });

    const result = await handleConvertDocument(client, mockConfig.fileServerHost, {
      source: "http://example.com/doc.docx",
      outputFormat: "pdf",
      outputPath: "/tmp/output.pdf",
    });

    expect(result.content[0].text).toContain("saved to /tmp/output.pdf");
  });
});
