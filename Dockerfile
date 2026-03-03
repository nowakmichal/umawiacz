# ── Stage 1: install production dependencies ────────────────────────────────
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ── Stage 2: build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Stage 3: runtime ─────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Angular SSR server bundle + static browser assets
COPY --from=builder /app/dist/umawiacz/ ./

# Production node_modules (in case Express isn't fully bundled)
COPY --from=prod-deps /app/node_modules ./node_modules

ENV NODE_ENV=production
ENV PORT=4000
# API_URL is set at runtime (e.g. via docker-compose)

EXPOSE 4000
CMD ["node", "server/server.mjs"]
