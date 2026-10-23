#!/usr/bin/env bash
set -Eeuo pipefail

# Ubuntu 24.04 host hardening for Tiwlo.
# Safe by default: inspect with --dry-run. Applying firewall changes requires
# explicit SSH and origin source allowlists and --apply.

MODE="${1:---dry-run}"
SSH_PORT="${SSH_PORT:-22}"
SSH_ALLOWLIST_CIDRS="${SSH_ALLOWLIST_CIDRS:-}"
ORIGIN_PORTS="${ORIGIN_PORTS:-80,443}"
ORIGIN_ALLOWLIST_CIDRS="${ORIGIN_ALLOWLIST_CIDRS:-}"

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

if [[ "${MODE}" == "--apply" && -z "${ORIGIN_ALLOWLIST_CIDRS}" ]]; then
  echo "Refusing to expose origin ports: set ORIGIN_ALLOWLIST_CIDRS to trusted proxy or CDN source ranges."
  echo "Example: ORIGIN_ALLOWLIST_CIDRS='198.51.100.0/24,2001:db8::/32' $0 --apply"
  exit 4
fi

if [[ "${ORIGIN_PORTS}" == *$'\n'* || ! "${ORIGIN_PORTS}" =~ ^[0-9,]+$ ]]; then
  echo "ORIGIN_PORTS must be a comma-separated list of TCP port numbers."
  exit 5
fi

ORIGIN_IPV4_CIDRS=""
ORIGIN_IPV6_CIDRS=""
if [[ "${ORIGIN_ALLOWLIST_CIDRS}" == *$'\n'* ]]; then
  echo "ORIGIN_ALLOWLIST_CIDRS must be a comma-separated list on one line."
  exit 6
fi
IFS=',' read -ra ORIGIN_CIDRS <<< "${ORIGIN_ALLOWLIST_CIDRS}"
for cidr in "${ORIGIN_CIDRS[@]}"; do
  cidr="${cidr//[[:space:]]/}"
  [[ -z "${cidr}" ]] && continue
  if [[ "${cidr}" =~ : ]]; then
    if [[ ! "${cidr}" =~ ^[0-9a-fA-F:]+(/[0-9]{1,3})?$ ]]; then
      echo "Invalid IPv6 origin allowlist entry: ${cidr}"
      exit 7
    fi
    ORIGIN_IPV6_CIDRS="${ORIGIN_IPV6_CIDRS:+${ORIGIN_IPV6_CIDRS}, }${cidr}"
  else
    if [[ ! "${cidr}" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}(/[0-9]{1,2})?$ ]]; then
      echo "Invalid IPv4 origin allowlist entry: ${cidr}"
      exit 7
    fi
    ORIGIN_IPV4_CIDRS="${ORIGIN_IPV4_CIDRS:+${ORIGIN_IPV4_CIDRS}, }${cidr}"
  fi
done
if [[ "${MODE}" == "--apply" && -z "${ORIGIN_IPV4_CIDRS}${ORIGIN_IPV6_CIDRS}" ]]; then
  echo "Refusing to apply: ORIGIN_ALLOWLIST_CIDRS has no valid address ranges."
  exit 8
fi

echo "Tiwlo Ubuntu 24 hardening (${MODE})"
echo "SSH port: ${SSH_PORT}"
echo "SSH allowlist: ${SSH_ALLOWLIST_CIDRS:-NOT CONFIGURED}"
echo "Origin ports: ${ORIGIN_PORTS}"
echo "Origin allowlist: ${ORIGIN_ALLOWLIST_CIDRS:-NOT CONFIGURED (dry run only)}"

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
  ORIGIN_FIREWALL_RULES=""
  if [[ -n "${ORIGIN_IPV4_CIDRS}" ]]; then
    ORIGIN_FIREWALL_RULES+="    tcp dport { ${ORIGIN_PORTS} } ip saddr { ${ORIGIN_IPV4_CIDRS} } ct state new accept"$'\n'
  fi
  if [[ -n "${ORIGIN_IPV6_CIDRS}" ]]; then
    ORIGIN_FIREWALL_RULES+="    tcp dport { ${ORIGIN_PORTS} } ip6 saddr { ${ORIGIN_IPV6_CIDRS} } ct state new accept"$'\n'
  fi
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
${ORIGIN_FIREWALL_RULES}
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
