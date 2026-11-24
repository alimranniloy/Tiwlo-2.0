#!/usr/bin/env bash
set -e

mkdir -p /root/.ssh /srv /var/www /tmp
chmod 0700 /root/.ssh

if [[ ! -f /root/.bashrc && -d /opt/tiwlo-vps-skel ]]; then
  cp -an /opt/tiwlo-vps-skel/. /root/ || true
fi

TARGET_USER="${TIWLO_VPS_USER:-root}"
if [[ -n "${TARGET_USER}" && "${TARGET_USER}" != "root" && "${TARGET_USER}" =~ ^[a-z_][a-z0-9_-]{1,31}$ ]]; then
  if ! id -u "${TARGET_USER}" >/dev/null 2>&1; then
    useradd -m -s /bin/bash "${TARGET_USER}"
  fi
  usermod -aG sudo "${TARGET_USER}" || true
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "${TARGET_USER}" > "/etc/sudoers.d/90-tiwlo-${TARGET_USER}"
  chmod 0440 "/etc/sudoers.d/90-tiwlo-${TARGET_USER}"
  HOME_DIR="$(eval echo "~${TARGET_USER}")"
  if [[ -d "${HOME_DIR}" && ! -f "${HOME_DIR}/.bashrc" && -d /opt/tiwlo-vps-skel ]]; then
    cp -an /opt/tiwlo-vps-skel/. "${HOME_DIR}/" || true
    chown -R "${TARGET_USER}:${TARGET_USER}" "${HOME_DIR}" || true
  fi
fi

cat > /etc/motd <<MOTD
Welcome to Ubuntu 24.04 LTS (Tiwlo Cloud VPS - ${TIWLO_VPS_HOSTNAME:-$(hostname)})
  Internal VPC IP : ${TIWLO_VPS_INTERNAL_IP:-10.20.0.x}
  SSH Access Mode : Single-Port Gateway (Zero Router Ports Needed)
MOTD

trap 'exit 0' TERM INT QUIT HUP
while :; do
  sleep 3600 &
  wait $! || true
done
