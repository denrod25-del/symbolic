# syntax=docker/dockerfile:1.7
#
# Multi-stage build for the Next.js app, sized for Coolify.
#
# Stages:
#   deps     - installs npm dependencies with a clean, reproducible install
#   builder  - runs `next build` and produces the standalone output
#   runner   - the small production image that actually runs on the VPS
#
# Real secrets (DATABASE_URL, Clerk keys, etc.) live in Coolify's
# "Environment Variables" panel and are injected at container start,
# NOT baked into the image. The placeholder values in the builder
# stage exist only so `next build` can evaluate src/libs/Env.ts.

ARG NODE_VERSION=20

# ---------- deps ----------
FROM node:${NODE_VERSION}-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# ---------- builder ----------
FROM node:${NODE_VERSION}-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time only. Overridden at runtime by Coolify env vars.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_SENTRY_DISABLED=true
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV BRAVE_SEARCH_API_KEY="placeholder"
ENV CLERK_SECRET_KEY="placeholder"
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_placeholder"

RUN npx next build

# ---------- runner ----------
FROM node:${NODE_VERSION}-alpine AS runner
RUN apk add --no-cache libc6-compat
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs \
  && adduser -S -u 1001 -G nodejs nextjs

# Standalone output: a minimal server + only the node_modules it uses.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# server.js is emitted by Next.js standalone output.
CMD ["node", "server.js"]
