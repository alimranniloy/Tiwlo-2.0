# ====================================================================
# TIWLO STOCKPRO - DOCKERFILE
# Multi-stage production build for Node.js backend and Vite client
# ====================================================================

FROM node:24-alpine AS builder

WORKDIR /app

ARG VITE_WWW_SUBDOMAIN=www
ARG VITE_AUTH_SUBDOMAIN=auth
ARG VITE_TPANEL_SUBDOMAIN=tpanel
ARG VITE_DNS1_SUBDOMAIN=dns1
ARG VITE_DNS2_SUBDOMAIN=dns2
ARG VITE_MAIL_SUBDOMAIN=tmail
ARG VITE_MTA_SUBDOMAIN=mail
ARG VITE_DRIVE_SUBDOMAIN=drive
ENV VITE_WWW_SUBDOMAIN=${VITE_WWW_SUBDOMAIN} \
    VITE_AUTH_SUBDOMAIN=${VITE_AUTH_SUBDOMAIN} \
    VITE_TPANEL_SUBDOMAIN=${VITE_TPANEL_SUBDOMAIN} \
    VITE_DNS1_SUBDOMAIN=${VITE_DNS1_SUBDOMAIN} \
    VITE_DNS2_SUBDOMAIN=${VITE_DNS2_SUBDOMAIN} \
    VITE_MAIL_SUBDOMAIN=${VITE_MAIL_SUBDOMAIN} \
    VITE_MTA_SUBDOMAIN=${VITE_MTA_SUBDOMAIN} \
    VITE_DRIVE_SUBDOMAIN=${VITE_DRIVE_SUBDOMAIN}

ARG VITE_PRIMARY_DOMAIN=tiwlo.com
ARG VITE_STORE_DOMAIN=
ARG VITE_FREE_SUBDOMAIN_DOMAIN=uids.app
ARG VITE_MANAGED_DOMAINS=
ARG VITE_SERVER_IPV4=
ARG VITE_SERVER_IPV6=
ARG VITE_AUTH_DOMAIN=auth.tiwlo.com
ARG VITE_DASHBOARD_URL=https://uids.app
ARG VITE_WWW_SUBDOMAIN=www
ARG VITE_AUTH_SUBDOMAIN=auth
ARG VITE_TPANEL_SUBDOMAIN=tpanel
ARG VITE_DNS1_SUBDOMAIN=dns1
ARG VITE_DNS2_SUBDOMAIN=dns2
ARG VITE_MAIL_SUBDOMAIN=tmail
ARG VITE_MTA_SUBDOMAIN=mail
ARG VITE_DRIVE_SUBDOMAIN=drive
ENV VITE_PRIMARY_DOMAIN=${VITE_PRIMARY_DOMAIN} \
    VITE_STORE_DOMAIN=${VITE_STORE_DOMAIN} \
    VITE_FREE_SUBDOMAIN_DOMAIN=${VITE_FREE_SUBDOMAIN_DOMAIN} \
    VITE_MANAGED_DOMAINS=${VITE_MANAGED_DOMAINS} \
    VITE_SERVER_IPV4=${VITE_SERVER_IPV4} \
    VITE_SERVER_IPV6=${VITE_SERVER_IPV6} \
    VITE_AUTH_DOMAIN=${VITE_AUTH_DOMAIN} \
    VITE_DASHBOARD_URL=${VITE_DASHBOARD_URL} \
    VITE_WWW_SUBDOMAIN=${VITE_WWW_SUBDOMAIN} \
    VITE_AUTH_SUBDOMAIN=${VITE_AUTH_SUBDOMAIN} \
    VITE_TPANEL_SUBDOMAIN=${VITE_TPANEL_SUBDOMAIN} \
    VITE_DNS1_SUBDOMAIN=${VITE_DNS1_SUBDOMAIN} \
    VITE_DNS2_SUBDOMAIN=${VITE_DNS2_SUBDOMAIN} \
    VITE_MAIL_SUBDOMAIN=${VITE_MAIL_SUBDOMAIN} \
    VITE_MTA_SUBDOMAIN=${VITE_MTA_SUBDOMAIN} \
    VITE_DRIVE_SUBDOMAIN=${VITE_DRIVE_SUBDOMAIN}

# Copy root package.json and manifests
COPY package*.json ./
COPY server/package*.json ./server/
COPY client/package*.json ./client/
COPY service/TPanel/package*.json ./service/TPanel/

# Install dependencies
RUN npm install
RUN npm --prefix server install
RUN npm --prefix client install
RUN npm --prefix service/TPanel install

# Copy all source code
COPY . .

# Build Vite client production bundle
RUN npm --prefix client run build

# ====================================================================
# Runner Stage
# ====================================================================
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Runtime tools used by the application. FFmpeg is required for reliable
# production video inspection/transcoding jobs, while PostgreSQL client is
# used by health and maintenance jobs.
RUN apk add --no-cache postgresql-client ffmpeg spamassassin-client

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/pick ./pick
COPY --from=builder /app/service ./service
COPY --from=builder /app/service/TPanel/node_modules ./service/TPanel/node_modules
COPY --from=builder /app/Tiwi/assets ./Tiwi/assets
COPY --from=builder /app/service/TPanel/node_modules ./service/TPanel/node_modules

EXPOSE 5000 5001

CMD ["node", "server/server.js"]
