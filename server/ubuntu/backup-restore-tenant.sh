#!/usr/bin/env bash
set -euo pipefail

# Packages or restores one isolated tenant directory + PostgreSQL database
# so a customer can move cleanly between Ubuntu nodes.

MODE="${1:-}"
TENANT_SLUG="${2:-}"
PG_URL="${DATABASE_URL:-}"

if [[ -z "${MODE}" || -z "${TENANT_SLUG}" ]]; then
  echo "Usage: $0 <backup|restore> <tenant_slug> [archive_path]" >&2
  exit 1
fi

if [[ ! "${TENANT_SLUG}" =~ ^[a-z0-9][a-z0-9_]{1,35}$ ]]; then
  echo "Invalid tenant_slug: ${TENANT_SLUG}" >&2
  exit 1
fi

TENANT_DIR="/srv/tiwlo-tenants/${TENANT_SLUG}"
BACKUP_DIR="/srv/tiwlo-backups/${TENANT_SLUG}"
DB_NAME="cust_${TENANT_SLUG}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

case "${MODE}" in
  backup)
    mkdir -p "${BACKUP_DIR}"
    WORK_DIR="$(mktemp -d)"
    trap 'rm -rf "${WORK_DIR}"' EXIT
    tar -C /srv/tiwlo-tenants -cf "${WORK_DIR}/files.tar" "${TENANT_SLUG}"
    if [[ -n "${PG_URL}" ]]; then
      pg_dump "${PG_URL}/${DB_NAME}" -Fc -f "${WORK_DIR}/db.dump"
    fi
    ARCHIVE_FILE="${3:-${BACKUP_DIR}/${TENANT_SLUG}-${STAMP}.tar.gz}"
    tar -C "${WORK_DIR}" -czf "${ARCHIVE_FILE}" .
    echo "Created portable tenant archive: ${ARCHIVE_FILE}"
    ;;
  restore)
    ARCHIVE_FILE="${3:?Specify archive path for restore}"
    WORK_DIR="$(mktemp -d)"
    trap 'rm -rf "${WORK_DIR}"' EXIT
    tar --no-same-owner --no-same-permissions -xzf "${ARCHIVE_FILE}" -C "${WORK_DIR}"
    if tar -tvf "${WORK_DIR}/files.tar" | grep -Eq '(^| )/|(\.\./)|^l'; then
      echo "Unsafe path or symlink detected in tenant backup archive; aborting restore." >&2
      exit 1
    fi
    mkdir -p /srv/tiwlo-tenants
    tar --no-same-owner --no-same-permissions -C /srv/tiwlo-tenants -xf "${WORK_DIR}/files.tar"
    if [[ -n "${PG_URL}" && -f "${WORK_DIR}/db.dump" ]]; then
      psql "${PG_URL}/postgres" -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 \
        || psql "${PG_URL}/postgres" -c "CREATE DATABASE \"${DB_NAME}\";"
      pg_restore --clean --if-exists -d "${PG_URL}/${DB_NAME}" "${WORK_DIR}/db.dump"
    fi
    echo "Restored tenant ${TENANT_SLUG} from ${ARCHIVE_FILE}"
    ;;
  *)
    echo "Unknown mode: ${MODE}. Use backup or restore." >&2
    exit 1
    ;;
esac
