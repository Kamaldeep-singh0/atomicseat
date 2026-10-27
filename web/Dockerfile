# Multi-stage Dockerfile for Atomic Seat Web (Next.js)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY web/package.json ./web/

RUN npm install --workspace=web

COPY web/tsconfig.json ./web/
COPY web/next.config.js ./web/
COPY web/tailwind.config.ts ./web/
COPY web/postcss.config.js ./web/
COPY web/src ./web/src

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}

RUN npm run build --workspace=web

# Production Runner
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache dumb-init

COPY package.json package-lock.json* ./
COPY web/package.json ./web/

RUN npm install --omit=dev --workspace=web && npm cache clean --force

COPY --from=builder /app/web/.next ./web/.next
COPY --from=builder /app/web/next.config.js ./web/
COPY --from=builder /app/web/src ./web/src

USER node

EXPOSE 3000

ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["npm", "run", "start", "--workspace=web"]
