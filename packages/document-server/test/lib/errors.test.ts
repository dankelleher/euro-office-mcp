import { describe, it, expect } from "vitest";
import {
  DocumentServerError,
  formatCommandError,
  formatConversionError,
} from "../../src/lib/errors.js";

describe("formatCommandError", () => {
  it("returns user-friendly message for known codes", () => {
    expect(formatCommandError(1)).toBe(
      "Document not found — check the document key",
    );
    expect(formatCommandError(6)).toBe(
      "Authentication failed — check JWT secret",
    );
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
    expect(formatConversionError(-99)).toBe(
      "Unknown conversion error (code -99)",
    );
  });
});

describe("DocumentServerError", () => {
  it("includes context and mapped message", () => {
    const err = new DocumentServerError(6, "command");
    expect(err.message).toBe(
      "command: Authentication failed — check JWT secret",
    );
    expect(err.code).toBe(6);
    expect(err.name).toBe("DocumentServerError");
  });
});
