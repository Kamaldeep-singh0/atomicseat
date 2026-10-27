# Multi-stage Dockerfile for Atomic Seat API
FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and package configuration
COPY package.json package-lock.json* ./
COPY api/package.json ./api/

# Install build dependencies
RUN npm install --workspace=api

# Copy API source files
COPY api/tsconfig.json ./api/
COPY api/src ./api/src

# Compile TypeScript
RUN npm run build --workspace=api

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Install dumb-init for proper signal forwarding and zombie reaper
RUN apk add --no-cache dumb-init

COPY package.json package-lock.json* ./
COPY api/package.json ./api/

# Install production dependencies only
RUN npm install --omit=dev --workspace=api && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /app/api/dist ./api/dist

USER node

EXPOSE 4000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "api/dist/server.js"]
