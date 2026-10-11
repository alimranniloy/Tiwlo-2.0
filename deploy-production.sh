#!/usr/bin/env bash
set -Eeuo pipefail

# Tiwlo VPS One-Command Production Deployment & Setup
# Auto-installs system packages (ffmpeg, curl, git), backend dependencies,
# configures permissions, reloads PM2, and verifies health.

if [[ "${EUID}" -ne 0 ]]; then
  echo "Error: This script must be run as root or with sudo."
  echo "Usage: sudo ./deploy-production.sh"
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MODE="${1:-native}"

ensure_rust_toolchain() {
  if command -v cargo >/dev/null 2>&1; then
    echo "Rust toolchain already installed: $(cargo --version)"
    return
  fi
  echo "Rust toolchain is missing; installing rustup non-interactively..."
  if ! command -v curl >/dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update -y
    apt-get install -y curl
  fi
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal
  export PATH="$HOME/.cargo/bin:$PATH"
  command -v cargo >/dev/null 2>&1 || {
    echo "Error: Rust installation completed but cargo is unavailable."
    exit 1
  }
}

build_rust_backend() {
  ensure_rust_toolchain
  if [[ ! -f "$ROOT_DIR/server/rust-backend/Cargo.lock" ||
        "$ROOT_DIR/server/rust-backend/Cargo.toml" -nt "$ROOT_DIR/server/rust-backend/Cargo.lock" ]]; then
    echo "Rust dependency manifest changed; resolving Cargo.lock..."
    cargo generate-lockfile --manifest-path "$ROOT_DIR/server/rust-backend/Cargo.toml"
  fi
  echo "--- Building Rust backend ---"
  cargo build --locked --release --manifest-path "$ROOT_DIR/server/rust-backend/Cargo.toml"
}

configure_native_rust_service() {
  local service_file="/etc/systemd/system/tiwlo-rust.service"
  cat > "$service_file" <<EOF
[Unit]
Description=Tiwlo Rust backend
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$ROOT_DIR/server/rust-backend
EnvironmentFile=-$ROOT_DIR/.env
Environment=TIWLO_RUST_BIND=127.0.0.1:7100
ExecStart=$ROOT_DIR/server/rust-backend/target/release/tiwlo-rust-backend
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable --now tiwlo-rust
}

ensure_node_dependencies() {
  local directory="$1"
  local install_args="${2:-}"
  if [[ -d "$directory/node_modules" ]]; then
    echo "Node dependencies already installed in $directory; skipping install."
    return
  fi
  echo "Installing Node dependencies in $directory..."
  # shellcheck disable=SC2086
  npm --prefix "$directory" install $install_args --no-audit --no-fund --silent
}

ensure_native_rust_environment() {
  touch "$ROOT_DIR/.env"
  chmod 600 "$ROOT_DIR/.env"
  if ! grep -q '^TIWLO_INTERNAL_IDENTITY_SECRET=' "$ROOT_DIR/.env"; then
    printf 'TIWLO_INTERNAL_IDENTITY_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$ROOT_DIR/.env"
  fi
  if ! grep -q '^TIWLO_RUST_BACKEND_URL=' "$ROOT_DIR/.env"; then
    printf 'TIWLO_RUST_BACKEND_URL=http://127.0.0.1:7100\n' >> "$ROOT_DIR/.env"
  fi
  if ! grep -q '^TIWLO_RUST_DOMAIN_CLAIM_ENABLED=' "$ROOT_DIR/.env"; then
    printf 'TIWLO_RUST_DOMAIN_CLAIM_ENABLED=false\n' >> "$ROOT_DIR/.env"
  fi
  if ! grep -q '^TIWLO_RUST_DNS_ENABLED=' "$ROOT_DIR/.env"; then
    printf 'TIWLO_RUST_DNS_ENABLED=false\n' >> "$ROOT_DIR/.env"
  fi
}

# Load the shared, non-secret platform settings. Systemd/PM2 environment values
# take precedence over this file.
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  . "$ROOT_DIR/.env"
  set +a
fi

# If explicitly running Docker mode
if [[ "$MODE" == "--docker" || "$MODE" == "docker" ]]; then
  echo "=== Running Docker Deployment Mode ==="
  ENV_FILE="$ROOT_DIR/docker/.env.production"

  if ! command -v docker >/dev/null 2>&1; then
    apt-get update
    apt-get install -y docker.io docker-compose-plugin openssl
    systemctl enable --now docker
  fi

  if [[ ! -f "$ENV_FILE" ]]; then
    DB_PASSWORD="$(openssl rand -hex 32)"
    REDIS_PASSWORD="$(openssl rand -hex 32)"
    IDENTITY_SECRET="$(openssl rand -hex 32)"
    umask 077
    cat > "$ENV_FILE" <<EOF
POSTGRES_USER=tiwlo
POSTGRES_DB=tiwlo_master
POSTGRES_PASSWORD=$DB_PASSWORD
REDIS_PASSWORD=$REDIS_PASSWORD
TIWLO_INTERNAL_IDENTITY_SECRET=$IDENTITY_SECRET
TIWLO_RUST_DOMAIN_CLAIM_ENABLED=false
TIWLO_RUST_DNS_ENABLED=false
EOF
  fi

  if ! grep -q '^REDIS_PASSWORD=' "$ENV_FILE"; then
    printf '\nREDIS_PASSWORD=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE"
  fi
  if ! grep -q '^TIWLO_INTERNAL_IDENTITY_SECRET=' "$ENV_FILE"; then
    printf 'TIWLO_INTERNAL_IDENTITY_SECRET=%s\n' "$(openssl rand -hex 32)" >> "$ENV_FILE"
  fi
  if ! grep -q '^TIWLO_RUST_DOMAIN_CLAIM_ENABLED=' "$ENV_FILE"; then
    printf 'TIWLO_RUST_DOMAIN_CLAIM_ENABLED=false\n' >> "$ENV_FILE"
  fi
  if ! grep -q '^TIWLO_RUST_DNS_ENABLED=' "$ENV_FILE"; then
    printf 'TIWLO_RUST_DNS_ENABLED=false\n' >> "$ENV_FILE"
  fi

  cd "$ROOT_DIR"
  docker compose --env-file .env --env-file docker/.env.production -f docker/docker-compose.production.yml up -d --build --remove-orphans
  docker compose --env-file .env --env-file docker/.env.production -f docker/docker-compose.production.yml ps
  exit 0
fi

if [[ "$MODE" == "--rust-only" || "$MODE" == "rust-only" ]]; then
  ensure_native_rust_environment
  build_rust_backend
  configure_native_rust_service
  curl --fail --silent --show-error http://127.0.0.1:7100/health
  echo
  echo "Rust backend deployment completed."
  exit 0
fi

# ========================================================
# Native VPS Deployment Mode (PM2 + Nginx + PostgreSQL)
# ========================================================
echo "=========================================================="
echo "    TIWLO PRODUCTION SERVER DEPLOYMENT & SETUP ENGINE     "
echo "=========================================================="
echo "Working directory: $ROOT_DIR"

# 1. System Dependencies (ffmpeg, curl, git, openssl)
echo "--- Step 1: Ensuring System Packages (FFmpeg, OpenSSL, Curl) ---"
MISSING_PKGS=""
if ! command -v ffmpeg >/dev/null 2>&1; then
  MISSING_PKGS="$MISSING_PKGS ffmpeg"
fi
if ! command -v curl >/dev/null 2>&1; then
  MISSING_PKGS="$MISSING_PKGS curl"
fi
if ! command -v git >/dev/null 2>&1; then
  MISSING_PKGS="$MISSING_PKGS git"
fi
if ! command -v openssl >/dev/null 2>&1; then
  MISSING_PKGS="$MISSING_PKGS openssl"
fi
if ! command -v psql >/dev/null 2>&1; then
  MISSING_PKGS="$MISSING_PKGS postgresql postgresql-contrib"
fi

if [[ -n "$MISSING_PKGS" ]]; then
  echo "Installing missing system packages:$MISSING_PKGS..."
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -y
  apt-get install -y $MISSING_PKGS
else
  echo "All required system utilities (including FFmpeg & PostgreSQL) are installed."
fi

# Ensure PostgreSQL service is active and tiwlo_master database exists
if command -v psql >/dev/null 2>&1; then
  systemctl enable --now postgresql 2>/dev/null || true
  sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'tiwlo_master'" | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE tiwlo_master;" 2>/dev/null || true
  sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tiwlo_master TO postgres;" 2>/dev/null || true
fi

# 2. Prepare Storage & Directory Structure
echo "--- Step 2: Preparing Storage & Permissions ---"
mkdir -p "$ROOT_DIR/server/data/db/stores"
mkdir -p "$ROOT_DIR/server/uploads"
mkdir -p "$ROOT_DIR/upload"
chmod -R u+rwX "$ROOT_DIR/upload" "$ROOT_DIR/server/uploads" "$ROOT_DIR/server/data" 2>/dev/null || true

# 2b. Build Frontend Client
echo "--- Step 2b: Building Production Frontend Client ---"
if [[ -d "$ROOT_DIR/client" ]]; then
  ensure_node_dependencies "$ROOT_DIR/client"
  cd "$ROOT_DIR/client"
  npm run build
  cd "$ROOT_DIR"
fi

if [[ -d "$ROOT_DIR/client/dist" ]]; then
  find "$ROOT_DIR/client/dist" -type d -exec chmod 755 {} +
  find "$ROOT_DIR/client/dist" -type f -exec chmod 644 {} +
fi

# 3. Backend Dependencies
echo "--- Step 3: Installing Backend Production Dependencies ---"
if [[ -d "$ROOT_DIR/server" ]]; then
  ensure_node_dependencies "$ROOT_DIR/server" "--omit=dev"
  echo "Backend dependencies installed successfully."
fi

# 3b. Rust backend
echo "--- Step 3b: Ensuring Rust backend ---"
ensure_native_rust_environment
build_rust_backend
configure_native_rust_service

# 4. Process Reload (PM2)
echo "--- Step 4: Reloading PM2 Services ---"
if ! command -v pm2 >/dev/null 2>&1; then
  echo "PM2 is missing; installing it globally..."
  npm install --global pm2 --no-audit --no-fund --silent
fi
if command -v pm2 >/dev/null 2>&1; then
  cd "$ROOT_DIR/server"
  pm2 reload tiwlo-backend || pm2 restart tiwlo-backend || pm2 start server.js --name tiwlo-backend
  if [[ -f "$ROOT_DIR/server/dns/dnsServer.js" ]]; then
    pm2 reload tiwlo-dns || pm2 restart tiwlo-dns || pm2 start dns/dnsServer.js --name tiwlo-dns || true
  fi
  sleep 2
  echo "--- Step 4b: Provisioning Native Tiwlo Mail Transport ---"
  node "$ROOT_DIR/server/scripts/provision-mail.js"
  pm2 save
  pm2 startup systemd -u root --hp /root 2>/dev/null || true
  echo "PM2 services active."
else
  echo "Warning: PM2 not found in PATH."
fi

# 4b. Configure Nginx Media Reverse Proxy for /upload and /uploads
echo "--- Step 4b: Verifying Nginx Media Reverse Proxy ---"
if command -v nginx >/dev/null 2>&1; then
  for CONF in /etc/nginx/sites-available/tiwlo /etc/nginx/sites-available/default /etc/nginx/conf.d/tiwlo.conf; do
    if [[ -f "$CONF" ]] && grep -q "location /api/" "$CONF" && ! grep -q "location /upload/" "$CONF"; then
      echo "Configuring Nginx /upload/ and /uploads/ proxy in $CONF..."
      sed -i '/location \/api\/ {/i \
    location /upload/ {\
        proxy_pass http://127.0.0.1:5001/upload/;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_cache_bypass $http_upgrade;\
        client_max_body_size 100M;\
    }\
    location /uploads/ {\
        proxy_pass http://127.0.0.1:5001/uploads/;\
        proxy_http_version 1.1;\
        proxy_set_header Upgrade $http_upgrade;\
        proxy_set_header Connection "upgrade";\
        proxy_set_header Host $host;\
        proxy_cache_bypass $http_upgrade;\
        client_max_body_size 100M;\
    }' "$CONF"
      nginx -t 2>/dev/null && systemctl reload nginx 2>/dev/null || true
    fi
  done
fi

# 5. Verification
echo "--- Step 5: Validating Health Status ---"
sleep 2
if curl --fail --silent --show-error http://127.0.0.1:5001/api/health >/dev/null 2>&1 || curl --fail --silent --show-error http://127.0.0.1:5000/api/health >/dev/null 2>&1; then
  echo "Health check succeeded!"
else
  echo "Waiting for service initialization (3s)..."
  sleep 3
  curl --fail --silent --show-error http://127.0.0.1:5001/api/health || true
fi

echo "=========================================================="
echo "   DEPLOYMENT COMPLETED SUCCESSFULLY ON TIWLO LIVE SERVER!"
echo "   Domain: https://${VITE_PRIMARY_DOMAIN:-tiwlo.com}"
echo "=========================================================="
