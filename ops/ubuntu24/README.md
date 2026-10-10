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
sudo SSH_ALLOWLIST_CIDRS="203.0.113.10/32" \
  bash ops/ubuntu24/harden.sh --dry-run
```

## Apply

The script refuses to change firewall rules unless an administrator explicitly
provides the trusted SSH source CIDR:

```bash
sudo SSH_ALLOWLIST_CIDRS="203.0.113.10/32" \
  bash ops/ubuntu24/harden.sh --apply
```

Before applying, verify that:

- the allowlisted address is the administrator's current public IP;
- a second SSH session is already open;
- DNS and mail are hosted on the intended public addresses;
- PostgreSQL and Redis listen only on localhost/private network;
- the provider has an out-of-band console for recovery.

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
