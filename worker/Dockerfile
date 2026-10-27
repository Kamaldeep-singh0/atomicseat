# Multi-stage Dockerfile for Atomic Seat Rush Worker
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY worker/package.json ./worker/

RUN npm install --workspace=worker

COPY worker/tsconfig.json ./worker/
COPY worker/src ./worker/src

RUN npm run build --workspace=worker

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

RUN apk add --no-cache dumb-init

COPY package.json package-lock.json* ./
COPY worker/package.json ./worker/

RUN npm install --omit=dev --workspace=worker && npm cache clean --force

COPY --from=builder /app/worker/dist ./worker/dist

USER node

EXPOSE 5000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "worker/dist/server.js"]
