const COMMAND_ERRORS: Record<number, string> = {
  0: "Success",
  1: "Document not found — check the document key",
  2: "Invalid callback URL",
  3: "Document Server internal error",
  4: "No unsaved changes to save",
  5: "Unknown command",
  6: "Authentication failed — check JWT secret",
};

const CONVERSION_ERRORS: Record<number, string> = {
  [-1]: "Unknown conversion error",
  [-2]: "Conversion timeout",
  [-3]: "Conversion failed",
  [-4]: "Error downloading source document — check the URL is reachable from the Document Server",
  [-5]: "Incorrect document password",
  [-6]: "Database access error",
  [-7]: "Invalid input",
  [-8]: "Invalid token — check JWT secret",
  [-9]: "Cannot determine output format automatically",
  [-10]: "Document size limit exceeded",
};

export class DocumentServerError extends Error {
  constructor(
    public readonly code: number,
    public readonly context: string,
  ) {
    super(
      `${context}: ${COMMAND_ERRORS[code] ?? CONVERSION_ERRORS[code] ?? `Unknown error (code ${code})`}`,
    );
    this.name = "DocumentServerError";
  }
}

export const formatCommandError = (code: number): string =>
  COMMAND_ERRORS[code] ?? `Unknown error (code ${code})`;

export const formatConversionError = (code: number): string =>
  CONVERSION_ERRORS[code] ?? `Unknown conversion error (code ${code})`;
