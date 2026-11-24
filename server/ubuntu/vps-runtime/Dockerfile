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

COPY tiwlo-vps-init.sh /usr/local/bin/tiwlo-vps-init
RUN chmod 0755 /usr/local/bin/tiwlo-vps-init

WORKDIR /root
ENTRYPOINT ["/usr/local/bin/tiwlo-vps-init"]
