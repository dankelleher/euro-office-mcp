FROM node:22-slim AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY packages/document-server/package.json packages/document-server/tsconfig.json ./packages/document-server/

RUN pnpm install --frozen-lockfile

COPY packages/document-server/src ./packages/document-server/src

RUN pnpm --filter @euro-office-mcp/document-server build

FROM node:22-slim AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/document-server/package.json ./packages/document-server/
COPY --from=builder /app/packages/document-server/build ./packages/document-server/build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/document-server/node_modules ./packages/document-server/node_modules

ENV MCP_TRANSPORT=http
ENV MCP_PORT=3000
ENV EURO_OFFICE_URL=http://localhost:8080
ENV EURO_OFFICE_JWT_SECRET=my_jwt_secret
ENV EURO_OFFICE_FILE_SERVER_HOST=localhost

EXPOSE 3000

CMD ["node", "packages/document-server/build/index.js"]
