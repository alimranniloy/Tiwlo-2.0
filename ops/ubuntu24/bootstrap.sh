#!/usr/bin/env bash
set -Eeuo pipefail

# Fresh Ubuntu 24.04 bootstrap for Tiwlo.
# Usage:
#   sudo bash ops/ubuntu24/bootstrap.sh --dry-run
#   sudo Tiwlo_ROOT=/opt/tiwlo SSH_ALLOWLIST_CIDRS="203.0.113.10/32" \
#     bash ops/ubuntu24/bootstrap.sh --apply

MODE="${1:---dry-run}"
ROOT_DIR="${Tiwlo_ROOT:-/opt/tiwlo}"
SSH_ALLOWLIST_CIDRS="${SSH_ALLOWLIST_CIDRS:-}"
NODE_MAJOR="${NODE_MAJOR:-20}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run with sudo/root."
  exit 1
fi
if [[ "${MODE}" != "--dry-run" && "${MODE}" != "--apply" ]]; then
  echo "Usage: $0 [--dry-run|--apply]"
  exit 2
fi
if [[ "${MODE}" == "--apply" && -z "${SSH_ALLOWLIST_CIDRS}" ]]; then
  echo "Refusing to apply without SSH_ALLOWLIST_CIDRS."
  exit 3
fi

run() {
  if [[ "${MODE}" == "--dry-run" ]]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

echo "Tiwlo Ubuntu 24 bootstrap: ${MODE}"
run apt-get update
run env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl git ffmpeg openssl build-essential \
  postgresql postgresql-contrib redis-server nginx certbot python3-certbot-nginx \
  postfix mailutils nftables fail2ban auditd apparmor apparmor-utils unattended-upgrades

run systemctl enable --now postgresql
run systemctl enable --now redis-server
run systemctl enable --now nginx
run systemctl enable --now fail2ban
run systemctl enable --now auditd
run systemctl enable --now apparmor

if [[ "${MODE}" == "--apply" ]]; then
  if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "${NODE_MAJOR}" ]]; then
    curl -fsSL https://deb.nodesource.com/setup_${NODE_MAJOR}.x | bash -
    apt-get install -y nodejs
  fi
  npm install --global pm2
  install -d -m 0755 "${ROOT_DIR}"
  if [[ ! -d "${ROOT_DIR}/.git" ]]; then
    echo "Clone the repository into ${ROOT_DIR} before rerunning, or set Tiwlo_ROOT."
    exit 4
  fi

  cd "${ROOT_DIR}"
  mkdir -p server/data/db/stores server/uploads upload
  chmod 750 server/data server/uploads upload
  npm install --no-audit --no-fund
  npm --prefix server install --omit=dev --no-audit --no-fund
  npm --prefix client install --no-audit --no-fund
  npm run build

  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'tiwlo_master'" | grep -q 1 ||
    sudo -u postgres createdb tiwlo_master

  if [[ ! -f .env ]]; then
    echo "Create ${ROOT_DIR}/.env from .env.example and set secrets before starting services."
    exit 5
  fi

  bash ops/ubuntu24/harden.sh --apply
  pm2 startOrReload ecosystem.config.cjs --update-env 2>/dev/null ||
    pm2 start server/server.js --name tiwlo-backend
  if [[ -f server/dns/dnsServer.js ]]; then
    pm2 start dns/dnsServer.js --name tiwlo-dns 2>/dev/null || true
  fi
  pm2 save
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
else
  echo "Dry run only; no packages, services, firewall, certificates, or mail settings changed."
fi

echo "Bootstrap completed: ${MODE}"
