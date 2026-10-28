# StockPro - Inventory Management Dashboard

An exact replica of the modern SaaS Inventory Management Dashboard built with **React**, **Tailwind CSS**, and **Node.js Express** with real persistent data and interactive CRUD operations.

## ✨ Features

- **Exact Visual Match**:
  - macOS window buttons, sleek icons, rounded cards, subtle shadows, and soft gradients
  - 4 KPI Stat Cards with custom wave sparklines (Total Products, Total Stock, Total Sales, Low Stock)
  - Donut Chart with Category Breakdown (Electronics, Clothing, Home & Living, Beauty & Health, Sports, Others)
  - 7-Day In/Out Stock Movement Bar Chart
  - Top Selling Products list with sales counts, revenue, and growth rates
  - 6 Quick Action tiles (Add Product, New Purchase, New Sale, Scan Barcode, Import CSV, Generate Report)
  - Recent Activity timeline with live event logging
  - Recent Products Table with real-time search, category filters, list/grid toggle, and item actions
  - Bottom 3 promotional cards (Manage Stock, Total Value $248,650, Upgrade to Pro)
  - Dark / Light mode toggle
- **Real Data & Full CRUD**:
  - Add new products via interactive modal
  - Real deletion of products (permanently updates database and recalculates metrics)
  - Edit product names, SKUs, categories, stock, and prices
  - Record sales (auto-decrements inventory and increases total revenue)
  - Record restock purchase orders (auto-increments inventory)
  - Export real CSV reports

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Lucide Icons, Plus Jakarta Sans font
- **Backend**: Node.js, Express, CORS, with an isolated Rust services workspace for high-throughput components
- **Storage**: PostgreSQL for production authentication, audit, and new uploaded media; tenant commerce records are atomically persisted per store under `server/data/db/stores`

## 🚀 Running the App

Tenant store records and the store registry persist under `server/data/db/stores`; Docker Compose mounts `server/data` as a persistent volume. Legacy flat tenant JSON files are copied into the primary tenant store on first access and are left in place as a recovery source. Store data held only in memory by an older running server cannot be recovered after that server restarts, so export any such live-only records before upgrading.

### Shared domain and DNS configuration

### Rust services workspace

The production business API remains in [`server/`](server/). High-throughput
Rust services live in [`server/rust-backend/`](server/rust-backend/) so a new
developer can identify the Rust boundary immediately. The initial service is a
private health-checked foundation; DNS, edge filtering, and media workers are
migrated independently only after their contracts and rollback paths are
verified. Rust is not started by the default Node.js `npm run dev` command.

### One-command live deployment

The live-server deployer is idempotent: it installs only missing system
packages, Node dependencies, PM2, Docker, or Rust tooling. Existing
installations are reused.

From the repository root on an Ubuntu live server:

```bash
# Native Node + PostgreSQL + PM2 + systemd Rust + face verification deployment
sudo npm run deploy:live

# Build and restart only the native Rust service
sudo npm run deploy:rust

# Private Docker Compose deployment (Node, PostgreSQL, Redis, Rust, biometrics, Caddy)
sudo npm run deploy:production -- --docker
```

The native deployer installs Python 3.10+ and the MediaPipe liveness extra in a
private virtual environment, downloads the YuNet, SFace, and passive-liveness
models, and runs the OpenBiometrics API on loopback. MediaPipe downloads its
FaceLandmarker task model on first use, so the engine needs outbound access to
Google Storage for that initial download. Docker deployments run the same API
on the private Compose network and persist model weights in a dedicated volume.
Desktop identity verification displays a Material-inspired one-time QR code
that refreshes every five minutes. Scanning it opens a temporary mobile session
without requiring a second sign-in; the QR token can be redeemed only once.
Closing either browser ends the handoff, and an inactive session expires after
30 minutes. Handoff state is held in server memory, so a server restart
invalidates active QR links. On the phone, the user uploads an identity
document and completes a randomized sequence of head turns, a blink, and an
open-mouth action; camera framing checks keep guiding position and focus before
recording begins, and each action has up to 90 seconds. Camera frames are
checked live by the engine. After the actions, the flow waits for a centered
and sharp selfie frame before running the passive liveness check. The randomized
server-checked active actions are required for liveness; the single-image
passive model score is retained as a diagnostic and cannot veto a completed
active check.
Document images, selfies, and the short camera recording are processed in
memory and are not retained. The flow compares faces, requires active
liveness, and records the passive liveness result for diagnostics, but it does
not verify document authenticity or persist an identity-verification status.
Do not treat this face-match result as formal KYC approval.

Address verification is required for new and existing signed-in accounts before
protected application APIs are available. The user must select **Verify** and
grant browser location permission. The browser reports a fresh GPS fix's
coordinates and accuracy to the server, which uses only the administrator-managed Google Maps
Geocoding API. Verification requires Google's formatted address, area, postcode,
and Plus Code, as well as device-reported GPS accuracy of 50 meters or better. Google
is retried once; API errors, missing address fields, missing API configuration,
or insufficient GPS accuracy fail closed. There is no offline/IP fallback.
Coordinates, reported accuracy, Google address fields, Plus Code, and the server
verification time are saved as the account's latest live-location check, not as
a permanent residential address. GPS can be inaccurate or spoofed; this is not
proof that the user is physically present or proof of residence/banking KYC.

After address verification, the first login on a browser offers a transparent,
optional location-sharing prompt. Once the user consents, each new login
session attempts one fresh browser GPS capture and resolves it with the same
server-side Google Geocoding API. If GPS is unavailable, the server may save a
clearly labeled approximate location from its local `geoip-lite` IP database;
this estimate is not an exact location and does not count as address
verification. If GPS becomes available later in that session, the approximate
entry is replaced rather than duplicated. Only the latest 10 login-location
records per user are retained. Administrators can review them from
**Administrator → User Locations**; access to a user's history is audit-logged.
Declining location sharing or denying GPS does not block login.

For local `npm run dev`, start the private verification engine separately with
`npm run docker:biometrics` (Docker required). The development Compose file
binds it to `127.0.0.1:8000`; production Compose does not publish the engine
port.

Docker mode creates `docker/.env.production` with random database, Redis, and
internal identity secrets on first run only. Review the generated file before
enabling any Rust claim or DNS cutover flag. Both Rust cutover flags default to
`false` and must remain disabled until staging and rollback verification are
complete.

### Fresh Ubuntu 24 one-command setup

On a fresh Ubuntu 24.04 host, clone the repository and run the safe dry-run:

```bash
git clone https://github.com/alimranniloy/Tiwlo-2.0.git /opt/tiwlo && cd /opt/tiwlo && sudo bash ops/ubuntu24/bootstrap.sh --dry-run
```

After reviewing the commands, apply with an explicit administrator SSH
allowlist. The script installs Node.js, PM2, PostgreSQL, Redis, Nginx,
Certbot, Postfix prerequisites, nftables, Fail2ban, auditd, AppArmor and
application dependencies:

```bash
cd /opt/tiwlo && sudo SSH_ALLOWLIST_CIDRS="YOUR_ADMIN_IP/32" bash ops/ubuntu24/bootstrap.sh --apply
```

Create `/opt/tiwlo/.env` from `.env.example` before the apply step. DNS
registrar changes, TLS issuance and SMTP delivery still require valid DNS
records and provider credentials; the installer refuses to invent secrets or
claim those services are healthy without configuration.

Copy the repository-root `.env.example` to `.env` before starting the web client or backend. The root `.env` is the single source for the website domain, default store-domain suffix, server IPv4, auth/TPanel/DNS/mail subdomains, platform email addresses, DNS record policies, TTLs, and server-only integration credentials. The server loads it at runtime, and the Vite client reads only its public `VITE_` values during development/build. Never put passwords, provider secrets, or API keys in `VITE_` variables. Keep `.env` out of Git; production servers need their own root `.env` with the same settings. Docker deployment also needs its separate `docker/.env.production` for database credentials.

Free stores use `<store-name>.<VITE_STORE_DOMAIN>`; leave `VITE_STORE_DOMAIN` blank to follow `VITE_PRIMARY_DOMAIN`. `VITE_FREE_SUBDOMAIN_DOMAIN` is reserved separately for the future user Domain Service (currently `uids.app`) and is not used by store routing or provisioning. Add future platform domains as a comma-separated `VITE_MANAGED_DOMAINS` value; authoritative DNS and generated SSL/Nginx host lists read this registry automatically. SMTP settings use `SMTP_*`; Gemini uses `GEMINI_API_KEY`; Stripe, PayPal, bKash, Nagad, and SSLCommerz use their corresponding server-only `*_KEY`, `*_SECRET`, or provider-prefixed variables. Email transport settings are read from `.env`; there is no separate email JSON file or admin API write path. Editable platform settings are stored in PostgreSQL. These payment entries are placeholders only; checkout and webhook integrations are not implemented. Generate unique values for the application signing secrets before production use. After changing a domain, rebuild the web client and restart the server. Update registrar DNS/glue records and provision matching SSL certificates separately; an application `.env` cannot change external registrar records by itself.

Obsolete TPanel Nginx, DNS, and runtime JSON snapshots were removed. Active DNS and SSL/Nginx configuration is generated by the server from the shared environment settings. Plugin `manifest.json` files are retained as plugin metadata, not deployment configuration or secret storage.

Tiwi reads one `EXPO_PUBLIC_API_URL` base URL from `Tiwi/.env` (copy `Tiwi/.env.example`). All API and server-hosted media URLs use that base; local development can override it with the same variable.

### Custom domain API

Custom domains are available to Growth, Pro, and Enterprise plans (up to 10 per account). The authenticated API is under `/api/domains`:

1. `POST /api/domains` with `{ "domain": "shop.example.com" }` creates a pending record and returns the ownership TXT record plus the A record target.
2. Add the provided TXT record at `_tiwlo-verification.shop.example.com` and point the domain A record to the returned server IP at the registrar/DNS provider.
3. Call `POST /api/domains/:id/verify` to verify TXT ownership and inspect whether the A record has propagated.
4. Once the A record points directly to this server (DNS-only, without a proxy), call `POST /api/domains/:id/provision`. Nginx deployments issue a Let’s Encrypt certificate and add a virtual host; production Docker/Caddy deployments allow Caddy to issue the certificate on demand after the domain is active. The development Docker compose stack has no TLS proxy and does not support SSL provisioning.
5. `GET /api/domains` lists owned domains and their statuses; `GET /api/domains/:id` refreshes DNS status. `DELETE /api/domains/:id` removes a pending/failed domain; active SSL domains cannot yet be detached through this API.

The DNS provider is not changed automatically; customers must add the records themselves. The current API provisions the apex hostname only (not `www`). Active custom hostnames can obtain TLS and reach the shared Tiwlo web application, but store-specific hostname routing is not implemented yet. A dashboard workflow and active-domain detach/revocation are also not implemented yet.

### Security, audit, and data retention

- The admin page `/administrator/google-drive` accepts Google service-account JSON and a shared root-folder ID. Credentials are encrypted with AES-256-GCM before PostgreSQL persistence; `SECURITY_SECRET` must remain stable or saved credentials cannot be decrypted. The page/API returns account metadata only, never Drive file links. Once a folder is verified and selected, new uploads use Drive through Tiwlo's `drive` subdomain proxy. **Sync all to Google Drive** scans the managed `upload/` and `server/uploads/` trees (including nested folders and non-image files), mirrors their relative hierarchy, migrates database-backed media, and verifies size and SHA-256 before removing server copies. Sync direction, status, and counters persist in PostgreSQL; an interrupted job resumes on server startup, and individual files are safe to retry. **Transfer all back to server** writes and verifies server copies before deleting Drive media. TPanel-specific storage is not included.
- Optional `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_BASE64` and `GOOGLE_DRIVE_ROOT_FOLDER_ID` variables bootstrap an account into PostgreSQL. The JSON must be base64-encoded locally and must not be committed. The account is not automatically activated: verify it in the admin page first. `VITE_DRIVE_SUBDOMAIN` defaults to `drive` and is included in generated SSL/Nginx host configuration; DNS still needs to point that hostname at the server.
- OTP challenges and password-reset grants are stored in PostgreSQL as keyed hashes, expire, and are deleted after successful use. SSO replay nonces and login lockout counters are also database-backed; login identifiers are stored as keyed hashes for these counters.
- The `security` plugin adds PostgreSQL-backed request limits shared across server instances for sign-in, registration, mailbox availability/creation, per-account mail sending, address verification, and login-location capture. Limit hits are audit-logged once per rate-limit window; authentication lockouts remain temporary, and request-rate signals alone do not permanently ban accounts. Old counters expire and are pruned during schema maintenance.
- Tiwlo Mail limits sends to 20 messages per account per hour and 50 per day, caps each message at 10 unique recipients and attachments at 100 MB per account per day, and enforces per-mailbox inbound storage caps. Production mail provisioning installs and enables SpamAssassin; high-scoring incoming messages go to Junk rather than being used as grounds to ban an account. If the scanner is unavailable, delivery is deferred instead of silently skipping the check. Postfix also applies per-client connection, message, and recipient rate limits. Mailbox quota overflow is temporarily deferred by SMTP; a real network flood still needs upstream CDN/WAF/provider DDoS mitigation.
- Public account creation always starts on the Free plan; a client-supplied plan ID cannot grant a paid tier. No free-trial entitlement currently exists. Email uniqueness plus persistent IP-based signup throttles reduce browser-clear/restart bypass, but preventing multiple identities across changing IPs requires verified phone/payment or equivalent proof; IP/device/geolocation alone cannot prove that accounts belong to one person.
- Browser dimensions, device fingerprints, VPN/proxy status, and geographic location are not treated as trusted identity or ban evidence. Browser-supplied values are spoofable, accurate IP intelligence requires a maintained local data source or a configured provider, and installing many unrelated packages would add supply-chain risk without providing reliable protection.
- Account registration will not trust caller-supplied social/SSO flags. Social-provider registration is unavailable until a provider identity assertion is verified server-side. TPanel APIs derive the account exclusively from the authenticated session; user IDs supplied in URLs, headers, or request bodies are not authentication.
- Moderation strikes, cooldowns, and permanent account restrictions are stored in PostgreSQL. Content publishing fails closed with HTTP 503 when moderation cannot run.
- Email delivery audit rows are written to `system_email_outbox`; they contain delivery metadata only, never message HTML or OTP values. Security/authentication events are available to administrators at `GET /api/admin/security-events`; email delivery records remain at `GET /api/admin/email-outbox`. Both audit tables retain at most 90 days and are capped at 100,000 security events and 50,000 email records.
- Tiwi Mail at `https://<VITE_MAIL_SUBDOMAIN>.<VITE_PRIMARY_DOMAIN>/` uses authenticated `/api/email` endpoints and PostgreSQL-backed, per-user mailboxes, inbox messages, sent messages, drafts, and attachments. After signing in through the existing `auth` flow (including its email verification and 2FA steps), each Tiwlo account can reserve one unique `@<VITE_PRIMARY_DOMAIN>` address. Availability and inbound recipient validation use the PostgreSQL mailbox registry. Native Linux production deployments configure Postfix to accept only registered mailbox recipients and deliver messages into the application; OpenDKIM signs outbound mail, and the authoritative DNS service publishes its public key. Outbound SMTP acceptance is shown as queued, not proof of delivery to the recipient's inbox. The deployment must permit inbound TCP port 25 and outbound SMTP, and public MX/A, SPF, DKIM, and DMARC records must resolve correctly.
- `VITE_MAIL_SUBDOMAIN` is the web UI hostname (currently `tmail`); `VITE_MTA_SUBDOMAIN` is the SMTP/MX hostname (defaults to `mail`). Legacy `/email` and `/mail` paths redirect to the dedicated mail web hostname and are not served on the main website. The native deployment provisions SMTP transport automatically; Docker deployments do not install or configure host Postfix/OpenDKIM.
- New social, store, and security uploads are stored as PostgreSQL `BYTEA`; existing `/upload` and `/uploads` URLs continue to work through database-first lookup and legacy disk fallback. Request staging and video processing use only short-lived OS temporary files, removed after each upload/job or process exit; Nginx request/response buffering is disabled on proxied media paths. Video uploads remain unavailable until FFmpeg/FFprobe moderation succeeds. Regenerate/reload Nginx so media paths proxy to Express instead of bypassing it for static files. PostgreSQL media increases database and backup size, so size database backups accordingly.
- To migrate existing `upload/` and `server/uploads/` files without deleting them, back up PostgreSQL and run `node server/scripts/backfill-media-to-postgres.js --dry-run`, then run `node server/scripts/backfill-media-to-postgres.js`. The importer checks byte size and SHA-256 for every file and leaves originals intact on any failure. Only after a verified backup and successful complete import, `node server/scripts/backfill-media-to-postgres.js --delete-after-verify` removes the exact source files it verified. Legacy disk serving remains enabled for unimported assets.
- This repository does not currently implement Stripe, PayPal, bKash, Nagad, or SSLCommerz payment processing/webhooks. There are no trustworthy gateway transaction events to record yet. Once a provider is integrated, store provider event IDs, status, amount, currency, and safe references; never store card numbers, CVV, OTPs, or gateway secrets in transaction logs.
- **Not all application data is PostgreSQL-only yet.** The web client still persists session tokens/profile data in browser `localStorage`, and the full tenant inventory/store implementation still has runtime-memory code paths. Legacy media files also remain on disk until the verified backfill above is run against the deployed PostgreSQL database. The production server refuses to start without PostgreSQL, but these remaining paths mean not all application data survives a restart yet.
- PostgreSQL connection pooling and short-lived process memory needed for image/video inference are runtime resources, not persistent caches. The database-backed audit retention limits above are intended to prevent operational logs from growing without bound.

### Start both Frontend & Backend:
```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:5000
