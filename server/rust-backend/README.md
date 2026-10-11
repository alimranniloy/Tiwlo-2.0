# Tiwlo Rust backend

This directory contains Tiwlo's Rust services. The Node.js API remains the
public API and compatibility gateway; security-sensitive authentication
operations and free-subdomain/DNS persistence are handled by this Rust service.

## Source layout

```text
rust-backend/
├── Cargo.toml
└── src/
    ├── main.rs        # process startup and route wiring
    ├── config.rs      # environment configuration and validation
    ├── state.rs       # shared application state
    ├── rate_limit.rs  # in-memory edge rate limiter
    ├── middleware.rs  # request IDs and security middleware
    ├── handlers.rs    # HTTP handlers
    ├── domain.rs      # subdomain validation and suggestions
    ├── account.rs     # account input policy checks
    ├── password.rs   # Node-compatible password hashing and verification
    ├── otp.rs        # OTP/grant generation, hashing, and validation
    ├── sso.rs        # SSO ticket signing and verification
    ├── claim.rs       # atomic domain-claim policy decisions
    ├── dns.rs         # DNS record validation
    ├── media.rs       # video preflight and playback compatibility policy
    ├── metrics.rs     # Prometheus-compatible process counters
    ├── repository.rs  # PostgreSQL availability and atomic domain claims
    ├── session.rs     # session and cookie security policy
    └── audit.rs       # structured audit-event contract
```

## Service boundary

| Rust service | Responsibility | Status |
| --- | --- | --- |
| `tiwlo-rust-backend` | Free-subdomain lifecycle, DNS records, edge admission, health/readiness | Production API |
| Authoritative DNS | High-volume DNS, RRL, record cache | Next isolated service |
| Edge gateway | Connection limits and request filtering | Implemented foundation |
| Media worker | File validation and FFmpeg orchestration | Next isolated service |

Rust services must not write directly to business tables without an explicit
contract. PostgreSQL remains the source of truth; Redis is the preferred
cache/queue boundary. The Node.js API remains responsible for public authentication routes,
third-party provider integrations (currently disabled until credentials and
server-side token verification are configured), email delivery, domain claims, account
policy, and business transactions. Rust owns session lifecycle, password
hashing/verification and legacy-password upgrades, auth lockout persistence,
OTP/reset-grant operations, and SSO ticket signing/verification and nonce
consumption.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/ready` | Readiness/configuration check |
| `GET` | `/metrics` | Prometheus-compatible HTTP counters |
| `GET` | `/v1/edge/admission` | Lightweight edge admission response |
| `POST` | `/v1/domains/validate` | Validate/normalize a subdomain label |
| `POST` | `/v1/domains/availability` | Read PostgreSQL-backed subdomain availability |
| `GET` | `/v1/domains/check?name=:name` | Check subdomain availability and return suggestions |
| `GET` | `/v1/domains` | List the authenticated user's active subdomains |
| `POST` | `/v1/domains/claim` | Atomically claim a free subdomain |
| `POST` | `/v1/accounts/policy` | Validate account input policy (never handles passwords) |
| `POST` | `/v1/domains/claim-policy` | Evaluate claim preconditions |
| `GET` | `/v1/domains/:subdomain_id/records` | List owned DNS records |
| `POST` | `/v1/domains/:subdomain_id/records` | Create an owned DNS record |
| `PATCH` | `/v1/domains/:subdomain_id/records/:record_id` | Update an owned DNS record |
| `DELETE` | `/v1/domains/:subdomain_id/records/:record_id` | Delete an owned DNS record |
| `POST` | `/v1/dns/record-policy` | Validate A/CNAME/TXT/NS records |
| `POST` | `/v1/media/preflight` | Validate video metadata and transcode requirements |
| `POST` | `/v1/auth/session-policy` | Evaluate session expiry and cookie security policy |

Every request receives security headers and an `x-request-id`. Requests are
limited per connected source IP (120 per minute by default) and bodies are
limited to 1 MiB. Change the limits with `TIWLO_RUST_RATE_LIMIT`.

DNS record create/update returns `409 Conflict` with
`dns_record_already_exists` when the database uniqueness constraint is hit.
The delete endpoint returns an empty `204 No Content` response.
Domain claim failures preserve stable codes such as
`EMAIL_VERIFICATION_REQUIRED`, `FREE_DOMAIN_ALREADY_USED`,
`SUBDOMAIN_ALREADY_REGISTERED`, and `FREE_DOMAIN_RATE_LIMITED`.

`/metrics` is intended for a private monitoring network only. It reports
process-local counters; deploy Prometheus scraping and aggregation before
using these values for autoscaling decisions.

The Node.js `/api/subdomains` routes are a compatibility gateway to these Rust
endpoints. Rust owns subdomain validation, availability, claims, DNS record
validation, and persistence; the gateway retains public API paths, rate limits,
authentication context, and the signed internal identity bridge.

Domain syntax and reserved names are validated in Rust, while PostgreSQL
remains the source of truth for availability and atomic claims. The account
policy endpoint does not receive passwords. Node.js orchestrates provider
sign-in only after a verified provider integration is configured; social sign-in
is currently disabled. Node.js also owns email delivery and MFA challenge
initiation/resends;
password secrets, OTP/grant state, MFA completion, and SSO handshake tickets
are handled by Rust.
MFA setup completion also verifies its `setup_2fa` challenge and enables the
account's two-factor/email-verified flags in one PostgreSQL transaction.
Email verification completion consumes the `email_verify` challenge and marks
the account verified in that same transaction.
MFA login completion consumes a `login_2fa` challenge and creates its
authenticated session atomically, only for verified, MFA-enabled, non-banned
accounts.

The media preflight endpoint does not read arbitrary filesystem paths or publish
files. It validates trusted FFprobe metadata and returns the canonical playback
target: MP4, H.264, YUV420P, AAC, and `+faststart`. The existing Node.js worker
remains responsible for FFmpeg, moderation, storage, and publication until the
isolated Rust worker is deployed and verified.

The session policy endpoint is advisory and does not authenticate a user,
create a session, or read cookies. Rust owns opaque application-session
creation, persistence, resolution, and revocation, including revocation during
password changes. Password hashing, verification, and legacy-password upgrades
are performed by Rust. Node.js coordinates configured provider, email-verification,
and MFA routes, while OTP and one-time-grant storage and verification are Rust-owned.

## Local development

Install Rust through <https://rustup.rs>. On Windows, also install the Visual
C++ Build Tools workload for the MSVC linker. Start the full local stack with:

```bash
npm run dev
```

This starts the Rust backend alongside the Node.js server and client. The Rust
service listens on `127.0.0.1:7100` by default. To run only Rust:

```bash
cargo run --manifest-path server/rust-backend/Cargo.toml
```

Check the service health endpoint:

```bash
curl http://127.0.0.1:7100/health
```

Override the bind address with `TIWLO_RUST_BIND`. The Node.js compatibility
gateway calls this service at `TIWLO_RUST_BACKEND_URL`; keep the service on the
private application network. `TIWLO_RUST_RATE_LIMIT` defaults to 10,000
requests per minute because internal Node-to-Rust calls share the Node service
IP.

The PostgreSQL repository supports availability lookup, user domain listing,
an atomic free-domain claim transaction, and ownership-scoped DNS record CRUD.
It locks the account row, requires `email_verified`, enforces the existing
one-claim-per-account constraint, validates `A`, `CNAME`, `TXT`, and `NS`
records, and maps unique conflicts to explicit errors.

`POST /v1/domains/claim` accepts only a short-lived HMAC-signed internal
identity assertion in `x-tiwlo-identity`; it never trusts a caller-supplied
`user_id`. Set `TIWLO_INTERNAL_IDENTITY_SECRET` to the same long random value
in the Node.js and Rust services. The Node-side assertion helper is
`server/security/rustIdentity.js`.

The Rust claim transaction now enforces the same three-signal 24-hour limit
(`ip_hash`, optional `device_hash`, and `email_hash`) and records `success` or
`blocked` attempts in the existing audit table. Raw network, device, and email
values are never placed in the assertion.

The Node gateway calls the Rust service through `TIWLO_RUST_BACKEND_URL`. It
does not fall back to Node persistence if Rust is unavailable.

Auth-session endpoints are available at `/v1/auth/sessions` (issue),
`/v1/auth/sessions/resolve`, `/v1/auth/sessions/revoke`, and the per-user
session/password routes under `/v1/auth/users/{user_id}`. The Node gateway
always sends these operations to Rust and has no PostgreSQL fallback. New
opaque session tokens are stored as SHA-256 digests; resolution and revocation
also accept legacy plaintext session rows. The stored User-Agent fingerprint
matches the previous implementation so existing sessions remain usable after
cutover.

Login and email-correction brute-force lockout checks, failure counters, and
successful-login resets are also owned by Rust. Node sends only an HMAC-blinded
rate-limit key over the private service network. The five-failure,
15-minute-window, 15-minute-lockout policy remains enforced with atomic
PostgreSQL updates.

Password hashing, verification, and legacy plaintext-hash upgrades are owned by
Rust as well. Password verification reads the canonical account credential in
PostgreSQL and upgrades matching legacy values atomically; Node does not send
stored hashes to the Rust service. New hashes remain compatible with the
existing Node scrypt format.

OTP challenges, one-time grants, their HMACs, expiry checks, attempt counters,
and consumption are also Rust-owned. Email composition and SMTP delivery stay
in Node. The Rust service must receive the same `SECURITY_SECRET` as Node to
read existing OTP rows and retain valid outstanding challenges during rollout.
Single-use SSO ticket signing, app-trust assertions, replay-nonce persistence,
and verification are Rust-owned too; `TIWI_APP_TRUST_KEY` must be shared with
the Node deployment configuration.
