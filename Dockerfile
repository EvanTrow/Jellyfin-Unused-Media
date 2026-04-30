# ─── Stage 1: Build client ────────────────────────────────────────────────────
FROM node:20-alpine AS client-builder

WORKDIR /build/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ─── Stage 2: Build server ────────────────────────────────────────────────────
FROM node:20-alpine AS server-builder

WORKDIR /build/server

COPY server/package*.json ./
# Install only production deps + dev deps needed to compile
RUN npm ci

COPY server/ ./
RUN npm run build

# Remove dev dependencies, keep production only
RUN npm ci --omit=dev

# ─── Stage 3: Runtime image ───────────────────────────────────────────────────
FROM node:20-alpine AS runtime

LABEL org.opencontainers.image.title="Jellyfin Reports" \
      org.opencontainers.image.description="Library statistics and unused media reports for Jellyfin" \
      org.opencontainers.image.source="https://github.com/EvanTrow/Jellyfin-Reports" \
      org.opencontainers.image.licenses="MIT"

# Create non-root user
RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Server compiled output + production node_modules
COPY --from=server-builder /build/server/dist       ./server/dist
COPY --from=server-builder /build/server/node_modules ./server/node_modules

# React client build (served statically by Express in production)
COPY --from=client-builder /build/client/dist       ./client/dist

# Persistent data volume
# /app/server/data — excluded.json + disk cache (data/cache/)
RUN mkdir -p server/data/cache && chown -R app:app /app

USER app

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

# Healthcheck via the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

WORKDIR /app/server
CMD ["node", "dist/index.js"]
