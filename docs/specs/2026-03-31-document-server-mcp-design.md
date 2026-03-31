# Euro-Office Document Server MCP — Design Spec

**Date:** 2026-03-31
**Status:** Draft
**Authors:** Dan, Claude Code, Codex

## Overview

An MCP (Model Context Protocol) server that wraps the Euro-Office Document Server APIs, enabling AI agents and end users to convert documents, manage editing sessions, and generate documents programmatically.

This is the first of multiple planned MCP servers in the `euro-office-mcp` monorepo.

## Background

Euro-Office is a sovereign office suite forked from OnlyOffice, backed by IONOS, Nextcloud, and 12+ European organizations. The Document Server is its core component — a stateless HTTP service that provides document editing, conversion, and generation capabilities.

**Source reference:** `/Users/daniel/dankelleher/euro-office/DocumentServer`

The Document Server exposes three HTTP APIs:
- **Command Service** (`POST /command`) — manage editing sessions
- **Conversion API** (`POST /converter`) — convert between document formats
- **Document Builder** (`POST /docbuilder`) — generate documents from JS scripts

Authentication uses JWT (HS256) with configurable secrets.

## Target User

**End users** — people using AI agents to work with documents. The tools should have friendly, task-oriented semantics rather than raw API terminology.

## Architecture

### Principles
- **Stateless MCP server** — no in-memory state, no persistent connections, no background processes
- **Fire-and-forget HTTP calls** — each tool invocation makes one or more HTTP requests to the Document Server and returns the result
- **Local file paths as first-class** — end users will provide local file paths more often than URLs
- **No callback listener in v1** — poll for async results rather than spinning up an HTTP listener

### Module Structure

```
packages/document-server/
  src/
    server.ts              # MCP server setup, tool registration
    client/
      documentServer.ts    # JWT signing + raw HTTP client for Document Server APIs
    tools/
      convert.ts           # convert_document tool
      status.ts            # get_document_status tool
      save.ts              # save_document tool
      generate.ts          # generate_document tool
      rename.ts            # rename_document tool
      admin.ts             # disconnect_users, get_server_info tools
    lib/
      fileSource.ts        # Path/URL normalization, ephemeral file serving
      types.ts             # Shared types
```

### File Source Strategy

The Document Server requires fetchable URLs — it pulls files via HTTP. The `fileSource.ts` module handles this:

1. **URL inputs** — passed through directly to the Document Server
2. **Local file paths** — an ephemeral HTTP server spins up on a configurable host/port, serves the single file, the Document Server fetches it, and the server tears down after the response completes. Scoped to the lifetime of a single tool call.
3. **Future (out of scope for v1)** — remote Document Server support via presigned URLs or shared volumes

**Network reachability constraint:** The ephemeral file server must be reachable from the Document Server. When the Document Server runs in Docker, `localhost` from the container is not the MCP host. To handle this:
- `EURO_OFFICE_FILE_SERVER_HOST` env var (default: `localhost`) configures the hostname/IP the Document Server should use to reach the ephemeral server. For Docker setups, set this to the host machine's IP or use `host.docker.internal`.
- v1 explicitly targets same-host or same-network setups. Cross-network deployments require a proper staging/upload mechanism (future work).

This is encapsulated behind a `FileSource` abstraction:

```typescript
interface ResolvedSource {
  url: string;
  cleanup: () => Promise<void>;
}

const resolveFileSource = async (input: string): Promise<ResolvedSource> => { ... }
```

### Authentication

The Document Server uses JWT (HS256). Configuration via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `EURO_OFFICE_URL` | Document Server base URL | `http://localhost:8080` |
| `EURO_OFFICE_JWT_SECRET` | JWT signing secret | `my_jwt_secret` |
| `EURO_OFFICE_FILE_SERVER_HOST` | Hostname the Document Server uses to reach the MCP's ephemeral file server | `localhost` |

The `documentServer.ts` client signs all requests with short-lived JWTs (5-minute expiry). The JWT payload contains the request body, matching the Document Server's expected format.

Reference: The Docker image in `DocumentServer/README.md` uses `-e JWT_SECRET=my_jwt_secret`.

## Tools

### User-Facing Tools

#### `convert_document`
Convert a document between formats.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `source` | string | Yes | Local file path or URL to the source document |
| `outputFormat` | string | Yes | Target format: `pdf`, `docx`, `odt`, `xlsx`, `ods`, `pptx`, `odp`, `txt`, `html`, etc. |
| `outputPath` | string | No | Local path to save the converted file. If omitted, returns the download URL. |

**Wraps:** `POST /converter`

**Supported format categories:**
- Text: docx, doc, odt, rtf, txt, html, epub, fb2, md, pdf
- Spreadsheet: xlsx, xls, ods, csv
- Presentation: pptx, ppt, odp
- Cross-category: any text/spreadsheet/presentation format to PDF

**Behavior:**
1. Resolve `source` via `fileSource` (URL passthrough or ephemeral serve)
2. POST to `/converter` with `filetype`, `outputtype`, `key`, `url`, and JWT token
3. If async (`endConvert: false`), poll until complete
4. If `outputPath` provided, download the result and save locally
5. Return the result URL or confirmation of local save

#### `get_document_status`
Check the status of a document editing session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentKey` | string | Yes | The unique key identifying the document/editing session |

**Wraps:** `POST /command` with `{"c": "info"}`

**Returns:** Active user list and session status.

#### `save_document`
Force-save a document that is currently being edited.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentKey` | string | Yes | The unique key identifying the document/editing session |
| `userdata` | string | No | Custom data passed through to the callback |

**Wraps:** `POST /command` with `{"c": "forcesave"}`

**Important:** This tool triggers a force-save on an *existing* Document Server editing session. It does not persist files independently — the Document Server's callback mechanism delivers the saved file to the configured storage integration. This tool is only useful when a document is actively being edited through the Document Server with a valid callback URL configured. See `DocumentServer/document-server-integration/web/documentserver-example/nodejs/app.js` lines 860-980 for the force-save callback flow.

#### `generate_document`
Create a document programmatically using the Document Builder API.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `script` | string | Yes | Local file path or URL to a `.js` builder script |
| `outputPath` | string | No | Local path to save the generated document |
| `arguments` | object | No | Arguments passed to the builder script |

**Wraps:** `POST /docbuilder`

**Behavior:**
1. Resolve `script` via `fileSource` (URL passthrough or ephemeral serve for local `.js` files)
2. POST to `/docbuilder` with `url`, optional `argument`, and JWT token
3. If async, poll until complete
4. If `outputPath` provided, download and save locally
5. Return generated document URL(s) or confirmation

#### `rename_document`
Update the title/metadata of a document in an active editing session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentKey` | string | Yes | The unique key identifying the document |
| `title` | string | Yes | New document title |

**Wraps:** `POST /command` with `{"c": "meta"}`

### Admin Tools

#### `disconnect_users`
Remove users from an active editing session.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `documentKey` | string | Yes | The unique key identifying the document |
| `userIds` | string[] | No | Specific user IDs to disconnect. If omitted, disconnects all. |

**Wraps:** `POST /command` with `{"c": "drop"}`

#### `get_server_info`
Get Euro-Office Document Server version and license information.

No parameters.

**Wraps:** `POST /command` with `{"c": "version"}` and `{"c": "license"}`

## Technology Stack

- **Runtime:** Node.js
- **Language:** TypeScript (strict mode)
- **MCP Framework:** `@modelcontextprotocol/sdk`
- **HTTP Client:** Built-in `fetch`
- **JWT:** `jsonwebtoken` library
- **Build:** TypeScript compiler, pnpm
- **Transport:** stdio (default)

## Monorepo Structure

This is the first package in a planned monorepo:

```
euro-office-mcp/
  packages/
    document-server/     # This spec
    # Future: nextcloud-integration/, web-apps/, etc.
  package.json           # Root workspace config
  tsconfig.json          # Shared TypeScript config
```

## Error Handling

Errors from the Document Server are mapped to user-friendly messages:

| DS Error Code | User-Facing Message |
|---------------|---------------------|
| 0 | Success |
| 1 | Document not found — check the document key |
| 2 | Invalid callback URL |
| 3 | Document Server internal error |
| 4 | No unsaved changes to save |
| 5 | Unknown command |
| 6 | Authentication failed — check JWT secret |

Conversion-specific errors (-1 through -10) are similarly mapped to descriptive messages.

## Testing Strategy

- **Unit tests:** Mock HTTP responses from Document Server, test tool logic and error mapping
- **Integration tests:** Run against a real Document Server Docker container (`ghcr.io/euro-office/documentserver:latest`)
- **Test framework:** Vitest

## Open Questions

1. Do we need a `list_supported_formats` tool, or is the format list static enough to embed in tool descriptions?
