/**
 * Integration smoke tests against a live Euro-Office Document Server.
 *
 * Run with: INTEGRATION_TEST=true pnpm test -- test/integration/smoke.test.ts
 *
 * Expects:
 *   - Document Server at http://localhost:8080 (or EURO_OFFICE_URL)
 *   - JWT_SECRET=secret (or EURO_OFFICE_JWT_SECRET)
 */
import { describe, it, expect, beforeAll } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import { loadConfig } from "../../src/config.js";

const shouldRun = process.env.INTEGRATION_TEST === "true";

describe.skipIf(!shouldRun)("Smoke tests against live Document Server", () => {
  let client: DocumentServerClient;

  beforeAll(() => {
    const config = loadConfig();
    client = new DocumentServerClient(config);
  });

  it("version: returns a version string", async () => {
    const result = await client.command({ c: "version" });
    expect(result).toHaveProperty("version");
    expect(typeof result.version).toBe("string");
    console.log("Document Server version:", result.version);
  });

  it("license: returns license info", async () => {
    const result = await client.command({ c: "license" });
    expect(result).toHaveProperty("license");
    console.log("License info:", JSON.stringify(result.license));
  });

  it("convert: URL-based docx-to-pdf conversion", async () => {
    // Use a small publicly-hosted sample docx
    const sampleUrl =
      "https://calibre-ebook.com/downloads/demos/demo.docx";

    const result = await client.convertAndPoll({
      filetype: "docx",
      key: `smoke-${Date.now()}`,
      outputtype: "pdf",
      url: sampleUrl,
    });

    expect(result.endConvert).toBe(true);
    expect(result.fileUrl).toBeDefined();
    expect(typeof result.fileUrl).toBe("string");
    console.log("Conversion result URL:", result.fileUrl);

    // Verify the output URL is actually fetchable
    const downloadResponse = await fetch(result.fileUrl!);
    expect(downloadResponse.ok).toBe(true);
    expect(downloadResponse.headers.get("content-type")).toContain("pdf");
  }, 60_000); // 60s timeout for conversion polling
});
