# ── Stage 1: Install production deps ──────────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy manifests only — caches the npm install layer when code changes
COPY package*.json ./
RUN npm ci --only=production

# ── Stage 2: Copy source ───────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root
RUN addgroup -S farmtrace && adduser -S farmtrace -G farmtrace

WORKDIR /app

# Pull installed node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Remove dev/test artefacts from the final image
RUN rm -rf __tests__ test_*.js *.test.js *.spec.js

USER farmtrace

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "index.js"]
