import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DocumentServerClient } from "../client/documentServer.js";

const disconnectUsersSchema = {
  documentKey: z
    .string()
    .describe("The unique key identifying the document"),
  userIds: z
    .array(z.string())
    .optional()
    .describe(
      "Specific user IDs to disconnect. If omitted, disconnects all.",
    ),
};

interface DisconnectUsersInput {
  documentKey: string;
  userIds?: string[];
}

export const handleDisconnectUsers = async (
  client: DocumentServerClient,
  input: DisconnectUsersInput,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  await client.command({
    c: "drop",
    key: input.documentKey,
    ...(input.userIds ? { users: input.userIds } : {}),
  });

  const target = input.userIds
    ? `users ${input.userIds.join(", ")}`
    : "all users";
  return {
    content: [
      {
        type: "text",
        text: `Disconnected ${target} from document "${input.documentKey}"`,
      },
    ],
  };
};

export const handleGetServerInfo = async (
  client: DocumentServerClient,
): Promise<{ content: Array<{ type: "text"; text: string }> }> => {
  const [versionResult, licenseResult] = await Promise.all([
    client.command({ c: "version" }),
    client.command({ c: "license" }),
  ]);

  const version = versionResult.version as string;
  const license = licenseResult.license as
    | Record<string, unknown>
    | undefined;
  const serverInfo = licenseResult.server as
    | Record<string, unknown>
    | undefined;
  const packageTypes = ["Open Source", "Enterprise", "Developer"];
  const packageType =
    packageTypes[(serverInfo?.packageType as number) ?? 0] ?? "Unknown";

  const lines = [
    "Euro-Office Document Server",
    `Version: ${version}`,
    `Build: ${serverInfo?.buildVersion ?? "unknown"}`,
    `Package: ${packageType}`,
  ];

  if (license) {
    lines.push(`License expires: ${license.end_date ?? "N/A"}`);
    lines.push(`Trial: ${license.trial ?? false}`);
  }

  return { content: [{ type: "text", text: lines.join("\n") }] };
};

export const registerAdminTools = (
  server: McpServer,
  client: DocumentServerClient,
) => {
  server.tool(
    "disconnect_users",
    "Remove users from an active document editing session (admin)",
    disconnectUsersSchema,
    async (input) => handleDisconnectUsers(client, input),
  );

  server.tool(
    "get_server_info",
    "Get Euro-Office Document Server version and license information (admin)",
    {},
    async () => handleGetServerInfo(client),
  );
};
