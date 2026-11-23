#!/usr/bin/env bash
set -euo pipefail

# Bootstraps a fresh Ubuntu compute node (physical PC/server or VM) so it
# builds ONE shared runtime image without duplicating OS/runtime bloat and
# prepares isolated tenant/backup storage outside /var/www/tiwlo.

SHARED_IMAGE_NAME="${SHARED_IMAGE_NAME:-tiwlo-ubuntu-shared-runtime:24.04}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $EUID -ne 0 ]]; then
  echo "Run this script as root (sudo bash bootstrap-ubuntu-node.sh)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates \
  curl \
  docker.io \
  docker-compose-plugin \
  postgresql-client \
  rsync \
  wireguard

systemctl enable --now docker

mkdir -p /srv/tiwlo-tenants /srv/tiwlo-backups
chmod 0711 /srv/tiwlo-tenants
chmod 0700 /srv/tiwlo-backups

echo "Building single shared runtime image: ${SHARED_IMAGE_NAME}"
docker build -t "${SHARED_IMAGE_NAME}" "${SCRIPT_DIR}/shared-runtime"

echo "Ubuntu node ready."
echo "- Tenants root: /srv/tiwlo-tenants"
echo "- Backups root: /srv/tiwlo-backups"
echo "- Shared image: ${SHARED_IMAGE_NAME}"
