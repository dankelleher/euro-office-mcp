export interface Config {
  /** Euro-Office Document Server base URL */
  documentServerUrl: string;
  /** JWT secret for signing requests to the Document Server */
  jwtSecret: string;
  /** Hostname the Document Server can use to reach this MCP's ephemeral file server */
  fileServerHost: string;
}

export const loadConfig = (): Config => ({
  documentServerUrl: process.env.EURO_OFFICE_URL ?? "http://localhost:8080",
  jwtSecret: process.env.EURO_OFFICE_JWT_SECRET ?? "my_jwt_secret",
  fileServerHost: process.env.EURO_OFFICE_FILE_SERVER_HOST ?? "localhost",
});
