import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DocumentServerClient } from "../../src/client/documentServer.js";
import {
  handleDisconnectUsers,
  handleGetServerInfo,
} from "../../src/tools/admin.js";

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
    const spy = vi
      .spyOn(client, "command")
      .mockResolvedValueOnce({ error: 0, key: "doc-1" });

    const result = await handleDisconnectUsers(client, {
      documentKey: "doc-1",
      userIds: ["u1", "u2"],
    });
    expect(spy.mock.calls[0][0]).toEqual({
      c: "drop",
      key: "doc-1",
      users: ["u1", "u2"],
    });
    expect(result.content[0].text).toContain("Disconnected");
  });

  it("disconnects all users when no IDs provided", async () => {
    const spy = vi
      .spyOn(client, "command")
      .mockResolvedValueOnce({ error: 0, key: "doc-1" });

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
    expect(result.content[0].text).toContain("Open Source");
  });
});
