# One image per app, built from the monorepo root.
#   docker build --target server .
#   docker build --target web --build-arg VITE_SERVER_URL=https://api.example.com .
FROM oven/bun:1.3.14-slim AS base
WORKDIR /app

# All the workspace manifests are needed, so the install matches bun.lock.
FROM base AS deps
COPY . .
RUN bun install --frozen-lockfile

FROM deps AS server
ENV NODE_ENV=production
WORKDIR /app/apps/server
RUN bun run build \
  && mkdir -p uploads \
  && chown bun:bun uploads
USER bun
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:3000/'); process.exit(r.ok ? 0 : 1)"]
CMD ["bun", "run", "start"]

FROM deps AS web
# Vite writes this address into the browser code, so it is set at build time.
ARG VITE_SERVER_URL
ENV NODE_ENV=production
ENV VITE_SERVER_URL=$VITE_SERVER_URL
WORKDIR /app/apps/web
RUN bun run build
USER bun
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD ["bun", "-e", "const r = await fetch('http://127.0.0.1:3001/'); process.exit(r.ok ? 0 : 1)"]
CMD ["bun", "run", "start"]
