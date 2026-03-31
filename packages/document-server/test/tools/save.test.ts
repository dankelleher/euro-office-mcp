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
    const spy = vi
      .spyOn(client, "command")
      .mockResolvedValueOnce({ error: 0, key: "doc-1" });

    const result = await handleSaveDocument(client, {
      documentKey: "doc-1",
    });
    expect(spy.mock.calls[0][0]).toEqual({ c: "forcesave", key: "doc-1" });
    expect(result.content[0].text).toContain("force-saved");
  });

  it("passes userdata when provided", async () => {
    const spy = vi
      .spyOn(client, "command")
      .mockResolvedValueOnce({ error: 0, key: "doc-1" });

    await handleSaveDocument(client, {
      documentKey: "doc-1",
      userdata: "checkpoint",
    });
    expect(spy.mock.calls[0][0]).toEqual({
      c: "forcesave",
      key: "doc-1",
      userdata: "checkpoint",
    });
  });
});
