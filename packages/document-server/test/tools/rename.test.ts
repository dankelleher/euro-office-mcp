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
    const spy = vi
      .spyOn(client, "command")
      .mockResolvedValueOnce({ error: 0, key: "doc-1" });

    const result = await handleRenameDocument(client, {
      documentKey: "doc-1",
      title: "New Name.docx",
    });
    expect(spy.mock.calls[0][0]).toEqual({
      c: "meta",
      key: "doc-1",
      meta: { title: "New Name.docx" },
    });
    expect(result.content[0].text).toContain("New Name.docx");
  });
});
