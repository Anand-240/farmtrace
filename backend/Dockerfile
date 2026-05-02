# ── Stage 1: Build ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDeps like prisma) to generate client
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# ── Stage 2: Runner ────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: run as non-root
RUN addgroup -S farmtrace && adduser -S farmtrace -G farmtrace

WORKDIR /app

# Copy production node_modules and generated prisma client from builder
COPY --from=builder /app/node_modules ./node_modules
# Copy application source
COPY . .

# Remove dev/test artefacts from the final image
RUN rm -rf __tests__ test_*.js *.test.js *.spec.js

USER farmtrace

EXPOSE 4000

ENV NODE_ENV=production

CMD ["node", "index.js"]
