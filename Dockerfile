# Use official stable Node 20 LTS image (Debian Bookworm, glibc, with curl and ca-certificates built-in)
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

# Install build tools needed to compile native addons (better-sqlite3, bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

# Compile native addons directly in the final glibc environment
RUN npm ci --omit=dev

COPY . .

# Create persistent storage and logs directory with non-root ownership
# 'node' user is pre-created by the official Node Docker image (UID 1000)
RUN mkdir -p /app/logs /app/data && chown -R node:node /app

# Run as non-root user
USER node

EXPOSE 10000

# Health check using node native HTTP request (no curl package dependency required)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('http'); http.get('http://127.0.0.1:10000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1));"

CMD ["node", "src/server.js"]
