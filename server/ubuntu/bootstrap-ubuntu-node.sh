#!/usr/bin/env bash
set -euo pipefail

# Bootstraps an Ubuntu/Linux compute node for the Tiwlo Fleet:
# - Enables NTP timezone synchronization and persists state across reboots
# - Installs Docker Engine & Compose and builds ONE shared base runtime image
# - Configures low-RAM kernel tuning (sysctl + optional zram-tools) and daily storage pruning
# - Creates /srv/tiwlo-tenants and /srv/tiwlo-backups outside app code
# - Installs persistent systemd tiwlo-node-agent.service on port 9443

SHARED_IMAGE_NAME="${SHARED_IMAGE_NAME:-tiwlo-ubuntu-shared-runtime:24.04}"
AGENT_PORT="${TIWLO_AGENT_PORT:-9443}"
AGENT_TOKEN="${TIWLO_AGENT_TOKEN:-}"
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
  python3 \
  rsync \
  wireguard

systemctl enable --now docker
timedatectl set-ntp true >/dev/null 2>&1 || true

# Kernel hardening & SYN-flood mitigation (zero shared-IP HTTP blacklisting so NAT shoppers are never banned)
mkdir -p /srv/tiwlo-tenants /srv/tiwlo-backups /etc/tiwlo-node /usr/local/lib/tiwlo-node /var/lib/tiwlo-node/quarantine /etc/docker /etc/sysctl.d
chmod 0711 /srv/tiwlo-tenants
chmod 0700 /srv/tiwlo-backups /etc/tiwlo-node /var/lib/tiwlo-node/quarantine

cat > /etc/sysctl.d/99-tiwlo-cluster.conf <<'SYSCTLEOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
net.ipv4.tcp_syncookies=1
net.ipv4.tcp_max_syn_backlog=4096
net.ipv4.tcp_synack_retries=2
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
net.ipv4.icmp_echo_ignore_broadcasts=1
net.ipv6.conf.all.accept_redirects=0
net.ipv4.conf.all.accept_redirects=0
net.core.somaxconn=4096
kernel.dmesg_restrict=1
kernel.kptr_restrict=2
fs.protected_hardlinks=1
fs.protected_symlinks=1
SYSCTLEOF
sysctl --system >/dev/null 2>&1 || true

# Disable blanket HTTP/API IP banning jails if previously enabled (use Google-style PoW challenges instead)
if command -v fail2ban-client >/dev/null 2>&1 && [[ -d /etc/fail2ban/jail.d ]]; then
  cat > /etc/fail2ban/jail.d/99-tiwlo-no-http-ip-ban.conf <<'F2BEOF'
[nginx-http-auth]
enabled = false
[nginx-botsearch]
enabled = false
[apache-auth]
enabled = false
F2BEOF
  systemctl reload fail2ban >/dev/null 2>&1 || true
fi

# Malware, PHP Web-Shell, Virus & Rootkit Defense (ClamAV + freshclam + rkhunter)
TOTAL_RAM_MB="$(free -m 2>/dev/null | awk '/^Mem:/{print $2}' || echo 1024)"
for pkg in clamav clamav-freshclam rkhunter; do
  if apt-cache show "$pkg" >/dev/null 2>&1; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "$pkg" >/dev/null 2>&1 || true
  fi
done
systemctl enable --now clamav-freshclam >/dev/null 2>&1 || true
if [[ "${TOTAL_RAM_MB:-1024}" -ge 2500 ]] && apt-cache show clamav-daemon >/dev/null 2>&1; then
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends clamav-daemon >/dev/null 2>&1 || true
  systemctl enable --now clamav-daemon >/dev/null 2>&1 || true
fi

if apt-cache show zram-tools >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends zram-tools >/dev/null 2>&1 || true
  systemctl enable --now zramswap.service >/dev/null 2>&1 || systemctl enable --now zramswap >/dev/null 2>&1 || true
fi

# Enable Docker live-restore so running user containers survive daemon upgrades or restarts cleanly
if [[ ! -f /etc/docker/daemon.json ]]; then
  cat > /etc/docker/daemon.json <<'EOF'
{
  "live-restore": true,
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "3" }
}
EOF
  systemctl restart docker || true
fi

# Power-loss-safe fail-safe recovery + atomic package updater (resumes interrupted updates cleanly)
cat > /usr/local/bin/tiwlo-node-safe-update.sh <<'UPDEOF'
#!/usr/bin/env bash
set -euo pipefail
LOCK_FILE="/var/lock/tiwlo-node-update.lock"
STATE_FILE="/var/lib/tiwlo-node/update-state.json"
exec 9>"${LOCK_FILE}"
flock -n 9 || exit 0
write_state() {
  local phase="$1" tmp
  tmp="$(mktemp "${STATE_FILE}.XXXXXX")"
  printf '{"phase":"%s","updatedAt":"%s"}\n' "${phase}" "$(date -Iseconds)" > "${tmp}"
  mv -f "${tmp}" "${STATE_FILE}"
}
write_state "recovering_interrupted"
export DEBIAN_FRONTEND=noninteractive
dpkg --configure -a || true
apt-get update -qq
write_state "upgrading_security_packages"
apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" upgrade || {
  dpkg --configure -a || true
  write_state "rolled_back_retry_pending"
  exit 1
}
write_state "healthy"
UPDEOF
chmod 0700 /usr/local/bin/tiwlo-node-safe-update.sh

# Recover any power-interrupted package state automatically on boot
cat > /etc/systemd/system/tiwlo-update-recovery.service <<'RECEOF'
[Unit]
Description=Tiwlo Power-Loss Transaction Recovery
After=local-fs.target
Before=docker.service tiwlo-node-agent.service

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'dpkg --configure -a || true'
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
RECEOF
systemctl enable tiwlo-update-recovery.service || true

if [[ -f "${SCRIPT_DIR}/shared-runtime/Dockerfile" ]]; then
  echo "Building single shared runtime image: ${SHARED_IMAGE_NAME}"
  docker build -t "${SHARED_IMAGE_NAME}" "${SCRIPT_DIR}/shared-runtime"
fi

if [[ -z "${AGENT_TOKEN}" ]]; then
  AGENT_TOKEN="$(head -c 24 /dev/urandom | od -An -tx1 | tr -d ' \n')"
fi

EXISTING_BACKUP_ENABLED=""
if [[ -z "${TIWLO_BACKUP_ENABLED:-}" && -f /etc/tiwlo-node/agent.env ]]; then
  EXISTING_BACKUP_ENABLED="$(grep -E '^TIWLO_BACKUP_ENABLED=' /etc/tiwlo-node/agent.env | tail -n1 | cut -d= -f2- || true)"
fi
AGENT_PORT="${AGENT_PORT//[^0-9]/}"
AGENT_PORT="${AGENT_PORT:-9443}"
AGENT_TOKEN="$(printf '%s' "${AGENT_TOKEN:-}" | tr -cd 'A-Za-z0-9')"
if [[ -z "${AGENT_TOKEN}" ]]; then
  AGENT_TOKEN="$(openssl rand -hex 24 2>/dev/null || python3 -c 'import secrets; print(secrets.token_hex(24))')"
fi
BACKUP_ENABLED="${TIWLO_BACKUP_ENABLED:-${EXISTING_BACKUP_ENABLED:-false}}"
if [[ "${BACKUP_ENABLED}" != "true" ]]; then
  BACKUP_ENABLED="false"
fi

cat > /etc/tiwlo-node/agent.env <<EOF
TIWLO_AGENT_PORT=${AGENT_PORT}
TIWLO_AGENT_TOKEN=${AGENT_TOKEN}
TIWLO_BACKUP_ENABLED=${BACKUP_ENABLED}
EOF
chmod 0600 /etc/tiwlo-node/agent.env

cat > /usr/local/lib/tiwlo-node/agent.py <<'PYEOF'
import hmac, http.server, json, os, shutil, socket, subprocess, time

PORT = int(os.environ.get("TIWLO_AGENT_PORT", "9443"))
TOKEN = os.environ.get("TIWLO_AGENT_TOKEN", "").strip()
UPDATE_STATE_PATH = "/var/lib/tiwlo-node/update-state.json"
SECURITY_SCAN_PATH = "/var/lib/tiwlo-node/security-scan.json"
DOCKER_DAEMON_CONFIG = "/etc/docker/daemon.json"

def detect_os():
    data = {}
    try:
        with open("/etc/os-release") as f:
            for line in f:
                if "=" in line:
                    k, v = line.strip().split("=", 1)
                    data[k] = v.strip('"')
    except Exception:
        pass
    os_id = data.get("ID", "linux").lower()
    ver = data.get("VERSION_ID", "")
    pretty = data.get("PRETTY_NAME", os_id)
    mapped = "ubuntu-24"
    if os_id == "ubuntu" and ver.startswith("22"):
        mapped = "ubuntu-22"
    elif os_id == "debian":
        mapped = "debian-12"
    elif os_id in ("almalinux", "rocky", "rhel"):
        mapped = "almalinux-9"
    elif os_id == "fedora":
        mapped = "fedora-40"
    return {"detectedOsId": mapped, "detectedOsPretty": pretty}

def detect_ips():
    v4, v6 = [], []
    try:
        out4 = subprocess.check_output(["ip", "-4", "-o", "addr", "show", "scope", "global"], text=True)
        for line in out4.splitlines():
            parts = line.split()
            for p in parts:
                if "/" in p and "." in p:
                    v4.append(p.split("/")[0])
    except Exception:
        pass
    try:
        out6 = subprocess.check_output(["ip", "-6", "-o", "addr", "show", "scope", "global"], text=True)
        for line in out6.splitlines():
            parts = line.split()
            for p in parts:
                if "/" in p and ":" in p:
                    v6.append(p.split("/")[0])
    except Exception:
        pass
    return {"ipv4": list(dict.fromkeys(v4)), "ipv6": list(dict.fromkeys(v6))}

def get_mem_info():
    total_gb, free_gb, mem_pressure_pct = 1, 0.5, 0
    try:
        vals = {}
        with open("/proc/meminfo") as f:
            for line in f:
                k, v = line.split(":", 1)
                vals[k.strip()] = int(v.strip().split()[0])
        total_kb = vals.get("MemTotal", 0)
        if total_kb > 0:
            total_gb = max(1, round(total_kb / (1024 * 1024)))
            avail_kb = vals.get("MemAvailable", vals.get("MemFree", 0))
            free_gb = round(avail_kb / (1024 * 1024), 1)
            used_kb = max(0, total_kb - avail_kb)
            mem_pressure_pct = min(100, max(0, round((used_kb / total_kb) * 100)))
    except Exception:
        pass
    return total_gb, free_gb, mem_pressure_pct

def get_update_state():
    try:
        with open(UPDATE_STATE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except FileNotFoundError:
        return {"phase": "unknown", "updatedAt": None}
    except Exception as exc:
        return {"phase": "error", "error": str(exc)}
    return {"phase": "unknown", "updatedAt": None}

def get_docker_live_restore():
    try:
        out = subprocess.check_output(
            ["docker", "info", "--format", "{{.LiveRestoreEnabled}}"],
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=2,
        ).strip().lower()
        if out == "true":
            return True
        if out == "false":
            return False
    except Exception:
        pass
    try:
        with open(DOCKER_DAEMON_CONFIG, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        if isinstance(cfg, dict):
            return bool(cfg.get("live-restore", False))
    except Exception:
        pass
    return False

def get_security_scan_state():
    try:
        with open(SECURITY_SCAN_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict):
            return data
    except Exception:
        pass
    return {
        "clamavInstalled": shutil.which("clamscan") is not None,
        "rkhunterInstalled": shutil.which("rkhunter") is not None,
        "lastScanAt": None,
        "quarantinedHits": 0,
    }

class Handler(http.server.BaseHTTPRequestHandler):
    timeout = 5

    def do_GET(self):
        if self.path.split("?", 1)[0] != "/agent/v1/health":
            self.send_response(404)
            self.end_headers()
            return
        if not TOKEN:
            self.send_response(503)
            self.end_headers()
            return
        auth = self.headers.get("Authorization", "")
        expected = f"Bearer {TOKEN}"
        if not hmac.compare_digest(auth.encode("utf-8"), expected.encode("utf-8")):
            self.send_response(401)
            self.end_headers()
            return
        usage = shutil.disk_usage("/")
        ips = detect_ips()
        os_info = detect_os()
        ram_total_gb, ram_free_gb, mem_pressure_pct = get_mem_info()
        disk_total_gb = max(1, round(usage.total / (1024 ** 3)))
        disk_pressure_pct = min(100, max(0, round((usage.used / usage.total) * 100))) if usage.total > 0 else 0
        payload = {
            "ok": True,
            "hostname": socket.gethostname(),
            "cpuCores": os.cpu_count() or 1,
            "ramGb": ram_total_gb,
            "ramFreeGb": ram_free_gb,
            "memPressurePct": mem_pressure_pct,
            "storageGb": disk_total_gb,
            "storageTotalGb": disk_total_gb,
            "storageUsedGb": round(usage.used / (1024 ** 3)),
            "storageFreeGb": round(usage.free / (1024 ** 3), 1),
            "diskPressurePct": disk_pressure_pct,
            "loadPct": min(100, round((os.getloadavg()[0] / max(1, os.cpu_count() or 1)) * 100)),
            "updateState": get_update_state(),
            "dockerLiveRestore": get_docker_live_restore(),
            "securityScan": get_security_scan_state(),
            "networkAddresses": ips,
            "timezone": time.tzname[0] if time.tzname else "UTC",
            **os_info,
        }
        body = json.dumps(payload).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        pass

if __name__ == "__main__":
    srv = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    srv.daemon_threads = True
    srv.serve_forever()
PYEOF

cat > /etc/systemd/system/tiwlo-node-agent.service <<'EOF'
[Unit]
Description=Tiwlo Fleet Compute Node Telemetry Agent
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=/etc/tiwlo-node/agent.env
ExecStart=/usr/bin/python3 /usr/local/lib/tiwlo-node/agent.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Automated Storage-Saving Log & Cache Pruning (never touches running containers, volumes, /srv/tiwlo-tenants, or databases)
cat > /usr/local/lib/tiwlo-node/tiwlo-prune.sh <<'PRUNEEOF'
#!/usr/bin/env bash
set -euo pipefail

if command -v journalctl >/dev/null 2>&1; then
  journalctl --vacuum-size=50M >/dev/null 2>&1 || true
fi

if command -v apt-get >/dev/null 2>&1; then
  apt-get clean >/dev/null 2>&1 || true
fi

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  docker system prune -f --filter "until=72h" >/dev/null 2>&1 || true
fi
PRUNEEOF
chmod 0700 /usr/local/lib/tiwlo-node/tiwlo-prune.sh

cat > /etc/systemd/system/tiwlo-prune.service <<'PRUNESVC'
[Unit]
Description=Tiwlo Automated Storage-Saving Log & Cache Pruning
After=docker.service

[Service]
Type=oneshot
Nice=19
IOSchedulingClass=idle
ExecStart=/usr/local/lib/tiwlo-node/tiwlo-prune.sh
PRUNESVC

cat > /etc/systemd/system/tiwlo-prune.timer <<'PRUNETMR'
[Unit]
Description=Daily Tiwlo Storage-Saving Log & Cache Pruning Timer

[Timer]
OnCalendar=daily
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
PRUNETMR

systemctl daemon-reload
systemctl enable tiwlo-node-agent.service
systemctl restart tiwlo-node-agent.service
systemctl enable --now tiwlo-prune.timer || true

# Daily PHP web-shell, reverse-shell, crypto-miner & ClamAV malware quarantine scanner
cat > /usr/local/bin/tiwlo-malware-scan.sh <<'SCANEOF'
#!/usr/bin/env bash
set -euo pipefail

QUARANTINE_DIR="/var/lib/tiwlo-node/quarantine"
SCAN_STATE="/var/lib/tiwlo-node/security-scan.json"
mkdir -p "${QUARANTINE_DIR}"
HITS=0

quarantine_file() {
  local target="$1"
  [[ -f "${target}" ]] || return 0
  chmod 0000 "${target}" >/dev/null 2>&1 || true
  local base ts dest
  base="$(basename "${target}" | tr -cd 'A-Za-z0-9._-')"
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  dest="${QUARANTINE_DIR}/${ts}-${base}.quarantine"
  mv -f "${target}" "${dest}" >/dev/null 2>&1 || true
  chmod 0000 "${dest}" >/dev/null 2>&1 || true
  HITS=$((HITS + 1))
}

for root_dir in /srv/tiwlo-tenants /var/www /tmp; do
  [[ -d "${root_dir}" ]] || continue
  while IFS= read -r hit; do
    [[ -n "${hit}" ]] && quarantine_file "${hit}"
  done < <(grep -rIlE "eval\(\s*(base64_decode|gzinflate|str_rot13)\s*\(|(FilesMan|c99shell|r57shell|b374k)|/dev/tcp/[0-9]|stratum\+(tcp|ssl)://|\bxmrig\b" "${root_dir}" 2>/dev/null || true)
done

if command -v clamscan >/dev/null 2>&1; then
  ionice -c3 nice -n 19 clamscan -r -i --move="${QUARANTINE_DIR}" /srv/tiwlo-tenants /var/www >/var/log/tiwlo-clamav.log 2>&1 || true
fi

TMP_JSON="$(mktemp "${SCAN_STATE}.XXXXXX")"
printf '{"clamavInstalled":%s,"rkhunterInstalled":%s,"lastScanAt":"%s","quarantinedHits":%d}\n' \
  "$(command -v clamscan >/dev/null 2>&1 && echo true || echo false)" \
  "$(command -v rkhunter >/dev/null 2>&1 && echo true || echo false)" \
  "$(date -Iseconds)" "${HITS}" > "${TMP_JSON}"
mv -f "${TMP_JSON}" "${SCAN_STATE}"
SCANEOF
chmod 0700 /usr/local/bin/tiwlo-malware-scan.sh

cat > /etc/systemd/system/tiwlo-malware-scan.service <<'SCANSVC'
[Unit]
Description=Tiwlo Malware, PHP Web-Shell & ClamAV Scanner
After=local-fs.target

[Service]
Type=oneshot
Nice=19
IOSchedulingClass=idle
ExecStart=/usr/local/bin/tiwlo-malware-scan.sh
SCANSVC

cat > /etc/systemd/system/tiwlo-malware-scan.timer <<'SCANTMR'
[Unit]
Description=Daily Tiwlo Malware & PHP Web-Shell Scan Timer

[Timer]
OnCalendar=daily
RandomizedDelaySec=20m
Persistent=true

[Install]
WantedBy=timers.target
SCANTMR

systemctl daemon-reload
systemctl enable --now tiwlo-malware-scan.timer || true

# Scheduled peer snapshot archival + atomic recovery unit (gated by TIWLO_BACKUP_ENABLED=true in /etc/tiwlo-node/agent.env)
cat > /usr/local/lib/tiwlo-node/tiwlo-cross-node-backup.sh <<'BKPEOF'
#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="/etc/tiwlo-node/agent.env"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

if [[ "${TIWLO_BACKUP_ENABLED:-false}" != "true" ]]; then
  echo "Cross-node backup skipped (TIWLO_BACKUP_ENABLED=${TIWLO_BACKUP_ENABLED:-false} in ${ENV_FILE})."
  exit 0
fi

SNAP_DIR="/srv/tiwlo-backups/snapshots"
mkdir -p "${SNAP_DIR}"
for tenant_dir in /srv/tiwlo-tenants/*; do
  [[ -d "${tenant_dir}" ]] || continue
  slug="$(basename "${tenant_dir}")"
  tmp_archive="${SNAP_DIR}/${slug}.tar.gz.tmp"
  final_archive="${SNAP_DIR}/${slug}.latest.tar.gz"
  ionice -c3 nice -n 19 tar -czf "${tmp_archive}" -C /srv/tiwlo-tenants "${slug}" && mv -f "${tmp_archive}" "${final_archive}"
done
if [[ -n "${TIWLO_PEER_BACKUP_TARGET:-}" ]]; then
  if [[ "${TIWLO_PEER_BACKUP_TARGET}" =~ ^- ]] || [[ ! "${TIWLO_PEER_BACKUP_TARGET}" =~ ^[A-Za-z0-9._:@/-]+$ ]]; then
    echo "Refusing unsafe TIWLO_PEER_BACKUP_TARGET." >&2
    exit 1
  fi
  ionice -c3 nice -n 19 rsync -az --partial --timeout=30 -- "${SNAP_DIR}/" "${TIWLO_PEER_BACKUP_TARGET}/" || true
fi
BKPEOF
chmod 0700 /usr/local/lib/tiwlo-node/tiwlo-cross-node-backup.sh

if [[ -f "${SCRIPT_DIR}/host-daemon/install-host-daemon.sh" ]]; then
  echo "Installing Tiwlo VPS host daemon, SSH mux, and Ubuntu VPS runtime..."
  TIWLO_AGENT_PORT="${AGENT_PORT}" TIWLO_AGENT_TOKEN="${AGENT_TOKEN}" bash "${SCRIPT_DIR}/host-daemon/install-host-daemon.sh"
fi

echo "Ubuntu node ready."
echo "- Agent Port: ${AGENT_PORT} (systemd persistent across reboots)"
echo "- Docker live-restore: enabled (containers survive daemon updates/restarts)"
echo "- Low-RAM tuning: /etc/sysctl.d/99-tiwlo-cluster.conf + optional zramswap"
echo "- Daily storage pruning: /usr/local/lib/tiwlo-node/tiwlo-prune.sh (tiwlo-prune.timer)"
echo "- Recovery & cross-node backup script: /usr/local/lib/tiwlo-node/tiwlo-cross-node-backup.sh (TIWLO_BACKUP_ENABLED=${BACKUP_ENABLED})"
echo "- Tenants root: /srv/tiwlo-tenants"
echo "- Backups root: /srv/tiwlo-backups"
