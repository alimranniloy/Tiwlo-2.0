#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run install-host-daemon.sh as root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../../.." && pwd)"
LIB_DIR="/usr/local/lib/tiwlo-node"
ENV_FILE="/etc/tiwlo-node/vps-daemon.env"
VPS_IMAGE="${TIWLO_VPS_IMAGE:-tiwlo-ubuntu-vps:24.04}"
VPS_NETWORK="${TIWLO_VPS_NETWORK:-tiwlo-vps-net}"
VPS_BRIDGE="br-tiwlovps"
AGENT_PORT="${TIWLO_AGENT_PORT:-9443}"

install -d -m 0755 "${LIB_DIR}"
install -d -m 0711 /srv/tiwlo-tenants
install -d -m 0700 /var/lib/tiwlo-node /etc/tiwlo-node

install -m 0644 "${SCRIPT_DIR}/tiwlo-vps-daemon.mjs" "${LIB_DIR}/tiwlo-vps-daemon.mjs"
install -m 0644 "${SCRIPT_DIR}/rfc6455.mjs" "${LIB_DIR}/rfc6455.mjs"
install -m 0755 "${SCRIPT_DIR}/pty-exec.py" "${LIB_DIR}/pty-exec.py"

# Resolve shared secret cleanly from repo .env / docker env / existing daemon env
SECRET="${TIWLO_INTERNAL_IDENTITY_SECRET:-}"
for candidate in "${REPO_ROOT}/.env" "${REPO_ROOT}/docker/.env.production" "${ENV_FILE}"; do
  if [[ -z "${SECRET}" && -f "${candidate}" ]]; then
    SECRET="$(grep -E '^TIWLO_INTERNAL_IDENTITY_SECRET=' "${candidate}" | head -n1 | cut -d= -f2- | tr -d '\r' || true)"
  fi
done
if [[ -z "${SECRET}" && -f /etc/tiwlo-node/agent.env ]]; then
  SECRET="$(grep -E '^TIWLO_AGENT_TOKEN=' /etc/tiwlo-node/agent.env | head -n1 | cut -d= -f2- | tr -d '\r' || true)"
fi
if [[ -z "${SECRET}" ]]; then
  SECRET="$(openssl rand -hex 32)"
fi

BRIDGE_IP="$(docker network inspect "${COMPOSE_PROJECT_NAME:-docker}_tiwlo" --format '{{range .IPAM.Config}}{{.Gateway}}{{end}}' 2>/dev/null || true)"
if [[ -z "${BRIDGE_IP}" ]]; then
  BRIDGE_IP="172.30.240.1"
fi

umask 077
cat > "${ENV_FILE}" <<EOF
TIWLO_AGENT_PORT=${AGENT_PORT}
TIWLO_INTERNAL_IDENTITY_SECRET=${SECRET}
TIWLO_VPS_IMAGE=${VPS_IMAGE}
TIWLO_VPS_NETWORK=${VPS_NETWORK}
TIWLO_TENANTS_ROOT=/srv/tiwlo-tenants
TIWLO_VPS_REGISTRY_PATH=/var/lib/tiwlo-node/vps-registry.json
TIWLO_PTY_HELPER_PATH=${LIB_DIR}/pty-exec.py
TIWLO_DOCKER_BRIDGE_IP=${BRIDGE_IP}
EOF
chmod 0600 "${ENV_FILE}"

# Ensure node >= 20 on host
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  apt-get update -qq
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y --no-install-recommends nodejs
fi

# Create isolated Docker bridge network for tenant VPS containers (ICC disabled!)
if ! docker network inspect "${VPS_NETWORK}" >/dev/null 2>&1; then
  docker network create \
    --driver bridge \
    --subnet 172.31.0.0/16 \
    --gateway 172.31.0.1 \
    --label tiwlo.role=vps-network \
    --opt com.docker.network.bridge.name="${VPS_BRIDGE}" \
    --opt com.docker.network.bridge.enable_icc=false \
    "${VPS_NETWORK}"
fi

# Scoped INPUT & DOCKER-USER firewall isolation ONLY on customer bridge br-tiwlovps (never disrupts host/platform containers)
if command -v iptables >/dev/null 2>&1; then
  # Block customer containers on br-tiwlovps from reaching ANY host-bound socket (9443, 22, 5432, etc.)
  iptables -C INPUT -i "${VPS_BRIDGE}" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT >/dev/null 2>&1 \
    || iptables -I INPUT 1 -i "${VPS_BRIDGE}" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT || true
  iptables -C INPUT -i "${VPS_BRIDGE}" -j DROP >/dev/null 2>&1 \
    || iptables -I INPUT 2 -i "${VPS_BRIDGE}" -j DROP || true

  iptables -C DOCKER-USER -i "${VPS_BRIDGE}" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT >/dev/null 2>&1 \
    || iptables -I DOCKER-USER 1 -i "${VPS_BRIDGE}" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT || true

  for cidr in 169.254.0.0/16 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
    iptables -C DOCKER-USER -i "${VPS_BRIDGE}" -d "${cidr}" -j DROP >/dev/null 2>&1 \
      || iptables -I DOCKER-USER 2 -i "${VPS_BRIDGE}" -d "${cidr}" -j DROP || true
  done

  for port in 25 465 587 3333 4444 5555 7777 9999 14433 14444; do
    iptables -C DOCKER-USER -i "${VPS_BRIDGE}" -p tcp --dport "${port}" -j DROP >/dev/null 2>&1 \
      || iptables -I DOCKER-USER 2 -i "${VPS_BRIDGE}" -p tcp --dport "${port}" -j DROP || true
  done
fi

# Build shared Ubuntu 24.04 VPS runtime image when missing or changed
RUNTIME_DIR="${REPO_ROOT}/server/ubuntu/vps-runtime"
HASH_FILE="/var/lib/tiwlo-node/vps-image.sha256"
if [[ -f "${RUNTIME_DIR}/Dockerfile" ]]; then
  NEW_HASH="$(cat "${RUNTIME_DIR}/Dockerfile" "${RUNTIME_DIR}/tiwlo-vps-init.sh" 2>/dev/null | sha256sum | awk '{print $1}')"
  OLD_HASH="$(cat "${HASH_FILE}" 2>/dev/null || true)"
  if [[ "${1:-}" == "--force-image" || "${NEW_HASH}" != "${OLD_HASH}" ]] || ! docker image inspect "${VPS_IMAGE}" >/dev/null 2>&1; then
    echo "Building shared customer VPS image: ${VPS_IMAGE}..."
    docker build -t "${VPS_IMAGE}" "${RUNTIME_DIR}"
    printf '%s\n' "${NEW_HASH}" > "${HASH_FILE}"
  fi
fi

# Host gateway login shell (only permits SSH mux invocation)
cat > /usr/local/bin/tiwlo-vps-login-shell <<'SHELLEOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "-c" && "${2:-}" == "/usr/local/bin/tiwlo-vps-ssh-mux" ]]; then
  exec /usr/local/bin/tiwlo-vps-ssh-mux
fi
echo "Tiwlo VPS SSH gateway account: interactive host shell disabled." >&2
exit 1
SHELLEOF
chmod 0755 /usr/local/bin/tiwlo-vps-login-shell
if ! grep -qxF "/usr/local/bin/tiwlo-vps-login-shell" /etc/shells; then
  printf '%s\n' "/usr/local/bin/tiwlo-vps-login-shell" >> /etc/shells
fi

# PAM authenticator helper (scrypt verification strictly for twvps_* users via local daemon)
cat > /usr/local/bin/tiwlo-vps-pam-auth <<'PAMEOF'
#!/usr/bin/env python3
import json
import os
import sys
import urllib.error
import urllib.request

ENV_FILE = "/etc/tiwlo-node/vps-daemon.env"


def read_env():
    out = {}
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    except Exception:
        pass
    return out


def main():
    pam_user = os.environ.get("PAM_USER", "").strip().lower()
    if not pam_user.startswith("twvps_"):
        sys.exit(1)

    raw_stdin = sys.stdin.buffer.read()
    # pam_exec expose_authtok appends a single NUL terminator
    password = raw_stdin.rstrip(b"\x00").decode("utf-8", errors="replace")
    if not password:
        sys.exit(1)

    env = read_env()
    port = env.get("TIWLO_AGENT_PORT", "9443")
    secret = env.get("TIWLO_INTERNAL_IDENTITY_SECRET", "")
    if not secret:
        sys.exit(1)

    payload = json.dumps({"sshGatewayUser": pam_user, "password": password}).encode("utf-8")
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/host/v1/ssh/verify-password",
        data=payload,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {secret}",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=4) as resp:
            if resp.status == 200:
                body = json.loads(resp.read().decode("utf-8"))
                if body.get("ok") is True:
                    sys.exit(0)
    except Exception:
        pass
    sys.exit(1)


if __name__ == "__main__":
    main()
PAMEOF
chmod 0700 /usr/local/bin/tiwlo-vps-pam-auth

# Root SSH mux executor (drops verified SSH client directly into their container!)
cat > /usr/local/bin/tiwlo-vps-ssh-mux-root <<'MUXROOT'
#!/usr/bin/env python3
import json
import os
import re
import sys
import urllib.parse
import urllib.request

ENV_FILE = "/etc/tiwlo-node/vps-daemon.env"
SAFE_CONTAINER_RE = re.compile(r"^tiwlo-vps-[a-zA-Z0-9_-]{4,64}$")
SAFE_USER_RE = re.compile(r"^[a-z_][a-z0-9_-]{0,31}$")


def read_env():
    out = {}
    try:
        with open(ENV_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    except Exception:
        pass
    return out


def main():
    gw_user = os.environ.get("SUDO_USER", "").strip().lower()
    if not gw_user.startswith("twvps_"):
        sys.stderr.write("Access denied: invalid Tiwlo SSH gateway identity.\n")
        sys.exit(1)

    env = read_env()
    port = env.get("TIWLO_AGENT_PORT", "9443")
    secret = env.get("TIWLO_INTERNAL_IDENTITY_SECRET", "")
    url = f"http://127.0.0.1:{port}/host/v1/ssh/resolve-user?user={urllib.parse.quote(gw_user)}"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {secret}"})

    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        sys.stderr.write(f"Tiwlo VPS gateway could not resolve instance: {exc}\n")
        sys.exit(1)

    if not data.get("ok"):
        sys.stderr.write("VPS instance not found.\n")
        sys.exit(1)
    if data.get("status") != "active":
        sys.stderr.write(f"VPS is currently {data.get('status')}. Power it on from Tiwlo Cloud Dashboard.\n")
        sys.exit(1)

    container = str(data.get("containerName") or "")
    access_user = str(data.get("accessUsername") or "root")
    if not SAFE_CONTAINER_RE.match(container) or not SAFE_USER_RE.match(access_user):
        sys.stderr.write("Invalid container specification.\n")
        sys.exit(1)

    raw_term = os.environ.get("TERM") or "xterm-256color"
    term = re.sub(r"[^a-zA-Z0-9._-]", "", raw_term)[:64] or "xterm-256color"
    has_tty = sys.stdin.isatty() and sys.stdout.isatty()
    flags = ["-it"] if has_tty else ["-i"]
    orig_cmd = os.environ.get("SSH_ORIGINAL_COMMAND")

    docker_args = ["docker", "exec", *flags, "-e", f"TERM={term}", "-u", access_user, container]
    if orig_cmd:
        if orig_cmd.strip().endswith("/sftp-server") or orig_cmd.strip() == "internal-sftp":
            docker_args.append("/usr/lib/openssh/sftp-server")
        else:
            docker_args.extend(["/bin/bash", "-lc", orig_cmd])
    else:
        docker_args.extend(["/bin/bash", "-l"])

    os.execvp("docker", docker_args)


if __name__ == "__main__":
    main()
MUXROOT
chmod 0700 /usr/local/bin/tiwlo-vps-ssh-mux-root

cat > /usr/local/bin/tiwlo-vps-ssh-mux <<'MUXEOF'
#!/usr/bin/env bash
exec /usr/bin/sudo -n /usr/local/bin/tiwlo-vps-ssh-mux-root
MUXEOF
chmod 0755 /usr/local/bin/tiwlo-vps-ssh-mux

# Sudoers drop-in (only allows %tiwlo-vps-users to run tiwlo-vps-ssh-mux-root cleanly)
groupadd -f tiwlo-vps-users
SUDOERS_TMP="$(mktemp)"
cat > "${SUDOERS_TMP}" <<'SUD'
Defaults env_keep += "SSH_ORIGINAL_COMMAND"
Defaults env_keep += "TERM"
%tiwlo-vps-users ALL=(root) NOPASSWD: /usr/local/bin/tiwlo-vps-ssh-mux-root
SUD
if visudo -cf "${SUDOERS_TMP}" >/dev/null 2>&1; then
  install -m 0440 "${SUDOERS_TMP}" /etc/sudoers.d/tiwlo-vps-mux
  rm -f "${SUDOERS_TMP}"
else
  rm -f "${SUDOERS_TMP}"
  echo "Invalid sudoers rule rejected by visudo!" >&2
  exit 1
fi

# Inject PAM rule ONLY for twvps_* BEFORE @include common-auth (root stays 100% unchanged)
PAM_LINE="auth [success=done default=ignore] pam_exec.so expose_authtok quiet /usr/local/bin/tiwlo-vps-pam-auth # tiwlo-vps-pam"
if [[ -f /etc/pam.d/sshd ]]; then
  if grep -q "tiwlo-vps-pam" /etc/pam.d/sshd; then
    sed -i '/tiwlo-vps-pam/d' /etc/pam.d/sshd
  fi
  awk -v line="${PAM_LINE}" '
    BEGIN { inserted = 0 }
    /^@include common-auth/ && !inserted { print line; inserted = 1 }
    { print }
  ' /etc/pam.d/sshd > /etc/pam.d/sshd.tiwlo.tmp
  mv -f /etc/pam.d/sshd.tiwlo.tmp /etc/pam.d/sshd
  chmod 0644 /etc/pam.d/sshd
fi

# OpenSSH single-port Match block for customer SSH multiplexer
SSHD_CONF="/etc/ssh/sshd_config.d/99-tiwlo-vps-mux.conf"
cat > "${SSHD_CONF}.tmp" <<'SSHEOF'
Match User twvps_*
    PasswordAuthentication yes
    KbdInteractiveAuthentication yes
    PubkeyAuthentication yes
    PermitEmptyPasswords no
    PermitTTY yes
    AllowTcpForwarding no
    AllowAgentForwarding no
    AllowStreamLocalForwarding no
    X11Forwarding no
    PermitTunnel no
    GatewayPorts no
    ForceCommand /usr/local/bin/tiwlo-vps-ssh-mux
SSHEOF
chmod 0644 "${SSHD_CONF}.tmp"
mv -f "${SSHD_CONF}.tmp" "${SSHD_CONF}"
if ! sshd -t; then
  rm -f "${SSHD_CONF}"
  echo "sshd -t validation failed; rolled back ${SSHD_CONF}" >&2
  exit 1
fi
systemctl reload ssh >/dev/null 2>&1 || systemctl reload sshd >/dev/null 2>&1 || true

# Install systemd unit & start tiwlo-vps-daemon
cat > /etc/systemd/system/tiwlo-vps-daemon.service <<EOF
[Unit]
Description=Tiwlo VPS Container Provisioner, SSH Auth & PTY Daemon
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/node ${LIB_DIR}/tiwlo-vps-daemon.mjs
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable tiwlo-vps-daemon.service
systemctl restart tiwlo-vps-daemon.service

# Wait up to 15s for daemon health check
for _ in $(seq 1 15); do
  if curl -fsS -H "Authorization: Bearer ${SECRET}" "http://127.0.0.1:${AGENT_PORT}/agent/v1/health" >/dev/null 2>&1; then
    echo "Tiwlo VPS daemon ready on 127.0.0.1:${AGENT_PORT} and ${BRIDGE_IP}:${AGENT_PORT}."
    exit 0
  fi
  sleep 1
done

echo "tiwlo-vps-daemon failed health check!" >&2
journalctl -u tiwlo-vps-daemon.service -n 30 --no-pager >&2 || true
exit 1
