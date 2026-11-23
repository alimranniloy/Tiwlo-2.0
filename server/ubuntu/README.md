# Tiwlo Ubuntu Node & Multi-Tenant Architecture

This directory holds **only immutable OS/runtime blueprints, provisioning scripts, and tenant registry metadata** — never live customer files or live databases.

## Core Design Principles

1. **Portal vs. Compute Nodes (No TPanel Required)**
   - **Tiwlo Main Portal (`tiwlo_master`)**: Hosts the primary web domain, Admin Dashboard, Billing, DNS, Auth, and the `system_server_nodes` + `system_ubuntu_tenants` registry.
   - **Ubuntu Nodes**: Any Ubuntu server (starting with the primary host and expanding to additional PCs/servers) connects to the Portal over a private encrypted link (WireGuard VPN + SSH Ed25519 keys).

2. **One Shared Base Runtime Image (Zero Duplicate Bloat)**
   - Every Ubuntu node builds **one** read-only shared runtime image (`tiwlo-ubuntu-shared-runtime:24.04`) defined in `shared-runtime/Dockerfile`.
   - Shared customers share this single base image (`OverlayFS`), so adding 10–20 users does **not** duplicate Ubuntu/PHP/Node/Python binaries on disk.

3. **Persistent Data Outside Application Code**
   - Live customer apps & uploads live exclusively under `/srv/tiwlo-tenants/<tenant_slug>/` (owned by isolated `tw_<slug>` non-root UID/GID with `0700` permissions), completely outside `/var/www/tiwlo` so `git pull` / container rebuilds never touch tenant data.
   - Each customer gets a dedicated PostgreSQL database (`cust_<slug>`) and least-privilege role (`role_<slug>`).
   - Automated per-tenant snapshots (`app` files + `pg_dump`) live under `/srv/tiwlo-backups/<tenant_slug>/` for instant portability to another Ubuntu node.
