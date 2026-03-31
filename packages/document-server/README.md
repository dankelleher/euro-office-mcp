# @euro-office-mcp/document-server

MCP server for the Euro-Office Document Server. Provides tools for document conversion, generation, and editing session management.

## Setup

```bash
pnpm install
pnpm build
```

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `EURO_OFFICE_URL` | Document Server base URL | `http://localhost:8080` |
| `EURO_OFFICE_JWT_SECRET` | JWT signing secret | `my_jwt_secret` |
| `EURO_OFFICE_FILE_SERVER_HOST` | Hostname for ephemeral file server (use `host.docker.internal` for Docker) | `localhost` |

## Usage with Claude Desktop / VS Code

Add to your MCP config:

```json
{
  "euro-office-document-server": {
    "type": "stdio",
    "command": "node",
    "args": ["path/to/euro-office-mcp/packages/document-server/build/index.js"],
    "env": {
      "EURO_OFFICE_URL": "http://localhost:8080",
      "EURO_OFFICE_JWT_SECRET": "secret",
      "EURO_OFFICE_FILE_SERVER_HOST": "host.docker.internal"
    }
  }
}
```

## Tools

### User-Facing

- **convert_document** — Convert between formats (docx, pdf, odt, xlsx, etc.). Accepts local file paths or URLs as source, with optional local output path.
- **generate_document** — Create documents from Document Builder `.js` scripts. Accepts local script paths or URLs.
- **get_document_status** — Check active editors on a document editing session.
- **save_document** — Force-save a document in an active editing session. Requires a valid callback/storage integration on the Document Server side.
- **rename_document** — Update the title of a document in an active editing session.

### Admin

- **disconnect_users** — Remove users from an editing session (all or specific user IDs).
- **get_server_info** — Server version and license info.

## Local File Handling

When you provide a local file path, the MCP server spins up an ephemeral HTTP server to make the file accessible to the Document Server. This works when both run on the same host or network.

For Docker setups, set `EURO_OFFICE_FILE_SERVER_HOST` to `host.docker.internal` so the Document Server container can reach the ephemeral server on the host machine.

## Testing

```bash
pnpm test                    # Unit tests
pnpm test:integration        # Integration tests (requires running Document Server)
```

## Running the Document Server Locally

```bash
docker pull ghcr.io/euro-office/documentserver:latest
docker run -d -p 8080:80 \
  -e JWT_SECRET=secret \
  -e ALLOW_PRIVATE_IP_ADDRESS=true \
  ghcr.io/euro-office/documentserver:latest
```

Or use the dev compose setup from the Euro-Office DocumentServer repo:

```bash
cd /path/to/euro-office/DocumentServer/develop
docker compose up --build
```

This starts the Document Server on `:8080` with JWT auth pre-configured.
