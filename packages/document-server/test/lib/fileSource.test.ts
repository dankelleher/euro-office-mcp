import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
} from "vitest";
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
    try {
      unlinkSync(testFile);
    } catch {
      // ignore cleanup errors
    }
  });

  it("passes http URLs through directly", async () => {
    const source = await resolveFileSource(
      "http://example.com/doc.docx",
      "localhost",
    );
    expect(source.url).toBe("http://example.com/doc.docx");
    await source.cleanup();
  });

  it("passes https URLs through directly", async () => {
    const source = await resolveFileSource(
      "https://example.com/doc.docx",
      "localhost",
    );
    expect(source.url).toBe("https://example.com/doc.docx");
    await source.cleanup();
  });

  it("serves local files via ephemeral HTTP server", async () => {
    const source = await resolveFileSource(testFile, "localhost");
    expect(source.url).toMatch(/^http:\/\/localhost:\d+\//);

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
    await source.cleanup();

    await expect(fetch(source.url)).rejects.toThrow();
  });

  it("throws for non-existent local files", async () => {
    await expect(
      resolveFileSource("/nonexistent/file.docx", "localhost"),
    ).rejects.toThrow("File not found");
  });
});
