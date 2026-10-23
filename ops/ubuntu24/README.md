# Ubuntu 24 host hardening

This directory contains a safe-by-default host hardening script for the Tiwlo
VPS. It is intentionally separate from the Node.js application because
firewall, kernel, SSH, and process isolation controls must run below Node.js.

`bootstrap.sh` installs the Ubuntu prerequisites and application services on a
fresh Ubuntu 24.04 host. It does not invent database, SMTP, DNS, TLS, or
application secrets. Put those values in a protected `.env` before starting
production services.

## Dry run

```bash
sudo env SSH_ALLOWLIST_CIDRS="203.0.113.10/32" \
  ORIGIN_ALLOWLIST_CIDRS="198.51.100.0/24,2001:db8::/32" \
  bash ops/ubuntu24/harden.sh --dry-run
```

## Apply

The script refuses to change firewall rules unless an administrator explicitly
provides both the trusted SSH source CIDR and the trusted reverse-proxy/CDN
source ranges for HTTP(S):

```bash
sudo env SSH_ALLOWLIST_CIDRS="203.0.113.10/32" \
  ORIGIN_ALLOWLIST_CIDRS="198.51.100.0/24,2001:db8::/32" \
  bash ops/ubuntu24/harden.sh --apply
```

Use the exact source ranges published by the proxy/CDN configured for the
domain. Do not apply this firewall with example ranges: doing so can lock out
SSH or block all website traffic. If the origin is intentionally public, first
decide on the trusted ingress policy and set its allowlist explicitly.

Before applying, verify that:

- the allowlisted address is the administrator's current public IP;
- a second SSH session is already open;
- DNS and mail are hosted on the intended public addresses;
- PostgreSQL and Redis listen only on localhost/private network;
- the provider has an out-of-band console for recovery.
- the origin allowlist includes every intended IPv4 and IPv6 proxy source range.

The script installs and configures `nftables`, `fail2ban`, `auditd`, AppArmor,
unattended security upgrades, SYN-cookie and network sysctl protections. It
does not claim to stop volumetric DDoS after the provider uplink is saturated;
that requires upstream provider filtering or an edge network.

## TLS, DNS, and email

Certificates can only be issued after DNS points at the host and the required
domains are configured. Registrar nameserver changes cannot be automated by
this repository without registrar API credentials. SMTP delivery also requires
valid provider or local Postfix configuration; the bootstrap never fabricates
credentials or reports these services healthy without a check.

Set `VITE_SERVER_IPV4` in the protected runtime/build environment when custom
domain DNS records or server-address displays are needed. It is intentionally
blank in the example environment file so the origin address is not published
in source control.
