# ====================================================================
# TIWLO SHARED UBUNTU WORKER RUNTIME IMAGE
# Single read-only base image shared across isolated customer tenants
# to avoid duplicating OS/runtime files on NVMe storage.
# ====================================================================

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    gnupg \
    nginx \
    php-fpm \
    php-cli \
    php-pgsql \
    php-curl \
    php-mbstring \
    php-xml \
    php-zip \
    postgresql-client \
    python3 \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Non-root tenant runner mount point & unprivileged nginx setup; customer files stay outside the image
RUN mkdir -p /srv/tenant/app /srv/tenant/storage /srv/tenant/logs /var/lib/nginx /var/log/nginx /run/php \
    && sed -i 's/listen 80 default_server;/listen 8080 default_server;/g; s/listen \[::\]:80 default_server;/listen [::]:8080 default_server;/g; s/^user www-data;/# user www-data;/g' /etc/nginx/nginx.conf /etc/nginx/sites-available/default 2>/dev/null || true \
    && chown -R www-data:www-data /srv/tenant /var/lib/nginx /var/log/nginx /run/php

USER www-data
WORKDIR /srv/tenant/app

EXPOSE 8080

CMD ["sh", "-c", "php-fpm* -F & exec nginx -g 'daemon off; pid /tmp/nginx.pid;'"]
