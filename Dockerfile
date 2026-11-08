# The game server, which also serves the built client (SERVE_CLIENT=1): one address for everything.
# Built by `pnpm test:online` (docker-compose.test.yml). The Clerk publishable key goes into the client at
# build time: `--build-arg VITE_CLERK_PUBLISHABLE_KEY=pk_…`.

FROM node:24-slim AS base
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
# The pnpm version of `packageManager` (package.json).
COPY package.json ./
RUN corepack enable && corepack install

# The manifests only: the dependencies stay cached while the code changes.
FROM base AS manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
COPY packages/shared/package.json packages/shared/

# Every dependency, then the client build.
FROM manifests AS client
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/client apps/client
ARG VITE_CLERK_PUBLISHABLE_KEY=
RUN pnpm --filter @8box/client build

# What the server needs to run: its dependencies and those of shared, without the dev tools.
FROM manifests AS server-deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm install --frozen-lockfile --prod --filter @8box/server...

FROM node:24-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 SERVE_CLIENT=1
WORKDIR /app
COPY --from=server-deps /app/node_modules node_modules
COPY --from=server-deps /app/packages/shared/node_modules packages/shared/node_modules
COPY --from=server-deps /app/apps/server/node_modules apps/server/node_modules
COPY package.json tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/server apps/server
COPY --from=client /app/apps/client/dist apps/client/dist
USER node
EXPOSE 3000
WORKDIR /app/apps/server
HEALTHCHECK --interval=10s --timeout=3s --start-period=60s --retries=3 \
    CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# Node itself is the main process: `docker stop` sends it SIGTERM and it saves the world before quitting.
CMD ["node", "--import", "tsx", "src/main.ts"]
