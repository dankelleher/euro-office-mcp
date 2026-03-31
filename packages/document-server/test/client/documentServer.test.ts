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

      await expect(
        client.command({ c: "info", key: "test" }),
      ).rejects.toThrow(DocumentServerError);
    });

    it("sends JWT in both body token field and Authorization header", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ error: 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );

      await client.command({ c: "version" });

      const [, options] = fetchSpy.mock.calls[0];
      const body = JSON.parse(options!.body as string);
      expect(body.token).toBeDefined();
      expect(
        (options!.headers as Record<string, string>).Authorization,
      ).toMatch(/^Bearer /);
    });

    it("throws on HTTP error status", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response("Internal Server Error", { status: 500 }),
      );

      await expect(client.command({ c: "version" })).rejects.toThrow(
        "HTTP 500",
      );
    });
  });

  describe("convert", () => {
    it("returns conversion result on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            endConvert: true,
            fileType: "pdf",
            fileUrl: "http://ds/output.pdf",
            percent: 100,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
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
        client.convert({
          filetype: "docx",
          key: "k",
          outputtype: "pdf",
          url: "http://bad",
        }),
      ).rejects.toThrow("downloading source document");
    });
  });

  describe("convertAndPoll", () => {
    it("polls until conversion completes", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch");

      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ endConvert: false, percent: 50 }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            endConvert: true,
            fileType: "pdf",
            fileUrl: "http://ds/out.pdf",
            percent: 100,
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await client.convertAndPoll(
        {
          filetype: "docx",
          key: "k",
          outputtype: "pdf",
          url: "http://ex.com/d.docx",
        },
        5,
        10,
      );
      expect(result.endConvert).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("throws when polling exceeds max attempts", async () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
        new Response(
          JSON.stringify({ endConvert: false, percent: 50 }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      await expect(
        client.convertAndPoll(
          {
            filetype: "docx",
            key: "k",
            outputtype: "pdf",
            url: "http://ex.com/d.docx",
          },
          2,
          10,
        ),
      ).rejects.toThrow("timed out");
    });
  });

  describe("build", () => {
    it("returns builder result on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            key: "build-1",
            end: true,
            urls: { "output.docx": "http://ds/output.docx" },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      );

      const result = await client.build({
        url: "http://example.com/builder.js",
      });
      expect(result.end).toBe(true);
      expect(result.urls).toEqual({
        "output.docx": "http://ds/output.docx",
      });
    });
  });
});
