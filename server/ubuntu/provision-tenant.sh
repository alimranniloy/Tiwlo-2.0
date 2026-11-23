#!/usr/bin/env bash
set -euo pipefail

# Provisions one isolated tenant workspace under /srv/tiwlo-tenants/<slug>
# using the single shared runtime image (no duplicated OS layers).

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <tenant_slug> [ram_mb] [cpu_cpus]" >&2
  exit 1
fi

TENANT_SLUG="$1"
RAM_MB="${2:-512}"
CPU_LIMIT="${3:-0.5}"
SHARED_IMAGE="${SHARED_IMAGE_NAME:-tiwlo-ubuntu-shared-runtime:24.04}"

if [[ ! "${TENANT_SLUG}" =~ ^[a-z0-9][a-z0-9_]{1,35}$ ]]; then
  echo "Invalid tenant_slug: ${TENANT_SLUG}" >&2
  exit 1
fi

TENANT_DIR="/srv/tiwlo-tenants/${TENANT_SLUG}"
LINUX_USER="tw_${TENANT_SLUG}"
CONTAINER_NAME="tiwlo-tenant-${TENANT_SLUG}"

if ! id -u "${LINUX_USER}" >/dev/null 2>&1; then
  useradd --system --home-dir "${TENANT_DIR}" --shell /usr/sbin/nologin "${LINUX_USER}"
fi

mkdir -p "${TENANT_DIR}/app" "${TENANT_DIR}/storage" "${TENANT_DIR}/logs"
chown -R "${LINUX_USER}:${LINUX_USER}" "${TENANT_DIR}"
chmod 0700 "${TENANT_DIR}"

docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --memory "${RAM_MB}m" \
  --cpus "${CPU_LIMIT}" \
  --read-only \
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --tmpfs /run:rw,nosuid,size=16m \
  -v "${TENANT_DIR}/app:/srv/tenant/app:rw" \
  -v "${TENANT_DIR}/storage:/srv/tenant/storage:rw" \
  -v "${TENANT_DIR}/logs:/srv/tenant/logs:rw" \
  "${SHARED_IMAGE}"

echo "Provisioned isolated container ${CONTAINER_NAME} using shared image ${SHARED_IMAGE}."
