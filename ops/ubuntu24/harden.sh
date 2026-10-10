#!/usr/bin/env bash
set -Eeuo pipefail

# Ubuntu 24.04 host hardening for Tiwlo.
# Safe by default: inspect with --dry-run. Applying firewall changes requires
# an explicit SSH_ALLOWLIST_CIDRS value and --apply.

MODE="${1:---dry-run}"
SSH_PORT="${SSH_PORT:-22}"
SSH_ALLOWLIST_CIDRS="${SSH_ALLOWLIST_CIDRS:-}"
ORIGIN_PORTS="${ORIGIN_PORTS:-80,443}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run as root: sudo bash ops/ubuntu24/harden.sh --dry-run"
  exit 1
fi

if [[ "${MODE}" != "--dry-run" && "${MODE}" != "--apply" ]]; then
  echo "Usage: $0 [--dry-run|--apply]"
  exit 2
fi

if [[ "${MODE}" == "--apply" && -z "${SSH_ALLOWLIST_CIDRS}" ]]; then
  echo "Refusing to apply: set SSH_ALLOWLIST_CIDRS before changing firewall rules."
  echo "Example: SSH_ALLOWLIST_CIDRS='203.0.113.10/32' $0 --apply"
  exit 3
fi

echo "Tiwlo Ubuntu 24 hardening (${MODE})"
echo "SSH port: ${SSH_PORT}"
echo "SSH allowlist: ${SSH_ALLOWLIST_CIDRS:-NOT CONFIGURED}"
echo "Origin ports: ${ORIGIN_PORTS}"

run() {
  if [[ "${MODE}" == "--dry-run" ]]; then
    printf '+'
    printf ' %q' "$@"
    printf '\n'
  else
    "$@"
  fi
}

run apt-get update
run env DEBIAN_FRONTEND=noninteractive apt-get install -y \
  nftables fail2ban nginx unattended-upgrades auditd apparmor apparmor-utils

run systemctl enable --now nftables
run systemctl enable --now fail2ban
run systemctl enable --now auditd
run systemctl enable --now apparmor

if [[ "${MODE}" == "--apply" ]]; then
  install -d -m 0755 /etc/nftables
  cat > /etc/nftables/tiwlo.nft <<EOF
flush ruleset
table inet tiwlo_filter {
  chain input {
    type filter hook input priority 0; policy drop;
    iifname "lo" accept
    ct state established,related accept
    ct state invalid drop
    ip protocol icmp accept
    ip6 nexthdr ipv6-icmp accept
    tcp dport ${SSH_PORT} ip saddr { ${SSH_ALLOWLIST_CIDRS} } ct state new accept
    tcp dport { ${ORIGIN_PORTS} } ct state new accept
    udp dport 53 limit rate 200/second burst 400 packets accept
    tcp dport 53 ct state new accept
    tcp flags syn limit rate 100/second burst 200 packets accept
    counter drop
  }
  chain forward { type filter hook forward priority 0; policy drop; }
  chain output { type filter hook output priority 0; policy accept; }
}
EOF
  nft -c -f /etc/nftables/tiwlo.nft
  nft -f /etc/nftables/tiwlo.nft
  systemctl enable nftables

  cat > /etc/sysctl.d/99-tiwlo-network.conf <<'EOF'
net.ipv4.tcp_syncookies = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.conf.default.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv6.conf.default.accept_redirects = 0
EOF
  sysctl --system

  cat > /etc/fail2ban/jail.d/tiwlo.local <<EOF
[DEFAULT]
bantime = 1h
findtime = 10m
maxretry = 5
backend = systemd

[sshd]
enabled = true
port = ${SSH_PORT}

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true
EOF
  systemctl restart fail2ban
fi

echo "Checking public listeners:"
ss -lntup || true
echo "Checking firewall:"
nft list ruleset 2>/dev/null || true
echo "Hardening ${MODE} completed."
