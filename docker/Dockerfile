# ====================================================================
# TIWLO STOCKPRO - DOCKERFILE
# Multi-stage production build for Node.js backend and Vite client
# ====================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package.json and manifests
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies
RUN npm install
RUN npm --prefix server install
RUN npm --prefix client install

# Copy all source code
COPY . .

# Build Vite client production bundle
RUN npm --prefix client run build

# ====================================================================
# Runner Stage
# ====================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Runtime tools used by the application. FFmpeg is required for reliable
# production video inspection/transcoding jobs, while PostgreSQL client is
# used by health and maintenance jobs.
RUN apk add --no-cache postgresql-client ffmpeg

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules

EXPOSE 5000 5001

CMD ["node", "server/server.js"]
