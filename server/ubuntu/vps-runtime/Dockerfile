# ====================================================================
# TIWLO UBUNTU 24.04 VPS CONTAINER RUNTIME IMAGE
# Shared base image for customer VPS droplets (zero per-user OS bloat)
# Interactive shell, sftp-server, dev tools, fast SIGTERM PID-1 handler
# ====================================================================

FROM ubuntu:24.04
LABEL tiwlo.role="vps-runtime"

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=en_US.UTF-8
ENV LC_ALL=en_US.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    bash-completion \
    ca-certificates \
    curl \
    dnsutils \
    git \
    iproute2 \
    iputils-ping \
    locales \
    nano \
    net-tools \
    openssh-client \
    openssh-sftp-server \
    procps \
    python3 \
    sudo \
    tar \
    tzdata \
    unzip \
    vim-tiny \
    wget \
    xz-utils \
    && locale-gen en_US.UTF-8 \
    && rm -rf /var/lib/apt/lists/*

# Save pristine skeleton files so host-mounted /root and /home start with prompt & PATH
RUN mkdir -p /opt/tiwlo-vps-skel \
    && cp -a /root/. /opt/tiwlo-vps-skel/ \
    && printf '%s\n' \
       'export TERM=${TERM:-xterm-256color}' \
       'export PS1="\[\e[1;32m\]\u@\h\[\e[0m\]:\[\e[1;34m\]\w\[\e[0m\]\$ "' \
       >> /opt/tiwlo-vps-skel/.bashrc

RUN cat > /usr/local/bin/tiwlo-vps-init <<'EOF'
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
EOF
RUN chmod 0755 /usr/local/bin/tiwlo-vps-init

WORKDIR /root
ENTRYPOINT ["/usr/local/bin/tiwlo-vps-init"]
