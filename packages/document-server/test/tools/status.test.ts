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

    const result = await handleGetDocumentStatus(client, {
      documentKey: "doc-1",
    });
    expect(result.content[0].text).toContain("user-a");
    expect(result.content[0].text).toContain("user-b");
    expect(result.content[0].text).toContain("2 active editor(s)");
  });

  it("reports no active editors when users array is empty", async () => {
    vi.spyOn(client, "command").mockResolvedValueOnce({
      error: 0,
      key: "doc-1",
      users: [],
    });

    const result = await handleGetDocumentStatus(client, {
      documentKey: "doc-1",
    });
    expect(result.content[0].text).toContain("No active editors");
  });
});
