# Stage 1: Build stage
FROM node:20-bullseye-slim AS builder

WORKDIR /app

# Install build tools for native addons (better-sqlite3, bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Install all dependencies and build native addons with release flags
RUN npm ci

COPY . .

# Stage 2: Runtime stage
FROM node:20-bullseye-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Install runtime dependencies (curl for healthcheck, dumb-init for PID 1 signal management)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dumb-init \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root user and directories
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

RUN mkdir -p /app/logs /app/data && chown -R appuser:appgroup /app

# Copy built node_modules and code from builder stage
COPY --from=builder --chown=appuser:appgroup /app/package*.json ./
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/src ./src
COPY --from=builder --chown=appuser:appgroup /app/public ./public

# Run as non-root user
USER appuser

EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:10000/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/server.js"]
