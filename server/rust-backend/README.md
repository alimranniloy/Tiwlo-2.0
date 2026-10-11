# Tiwlo Rust backend

This directory contains Tiwlo's Rust services. It is intentionally separate
from [`server/`](..), which currently contains the Node.js business
API and remains the production API until each Rust replacement is verified.

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
    ├── claim.rs       # atomic domain-claim policy decisions
    ├── dns.rs         # DNS record validation
    └── audit.rs       # structured audit-event contract
```

## Service boundary

| Rust service | Responsibility | Status |
| --- | --- | --- |
| `tiwlo-rust-backend` | Edge admission, rate limiting, health/readiness | Ready |
| Authoritative DNS | High-volume DNS, RRL, record cache | Next isolated service |
| Edge gateway | Connection limits and request filtering | Implemented foundation |
| Media worker | File validation and FFmpeg orchestration | Next isolated service |

Rust services must not write directly to business tables without an explicit
contract. PostgreSQL remains the source of truth; Redis is the preferred
cache/queue boundary. The Node.js API remains responsible for authentication,
domain claims, account policy, and business transactions.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness check |
| `GET` | `/ready` | Readiness/configuration check |
| `GET` | `/v1/edge/admission` | Lightweight edge admission response |
| `POST` | `/v1/domains/validate` | Validate/normalize a subdomain label |
| `POST` | `/v1/accounts/policy` | Validate account input policy (never handles passwords) |
| `POST` | `/v1/domains/claim-policy` | Evaluate claim preconditions |
| `POST` | `/v1/dns/record-policy` | Validate A/CNAME/TXT/NS records |

Every request receives security headers and an `x-request-id`. Requests are
limited per connected source IP (120 per minute by default) and bodies are
limited to 1 MiB. Change the limits with `TIWLO_RUST_RATE_LIMIT`.

This service is an edge/backend foundation, not yet a replacement for the
Node.js business API. It deliberately does not accept account, domain, or
database writes until those contracts are implemented and tested.

The domain endpoint only validates syntax and reserved names; PostgreSQL remains
the source of truth for availability and atomic claims. The account endpoint
does not receive or hash passwords. Node.js still owns sessions, password
authentication, email verification, domain claims, and database writes.

## Local development

Install Rust through <https://rustup.rs>, then run:

```bash
cargo run --manifest-path server/rust-backend/Cargo.toml
```

The service listens on `127.0.0.1:7100` by default:

```bash
curl http://127.0.0.1:7100/health
```

Override the bind address with `TIWLO_RUST_BIND`. Set
`TIWLO_NODE_BACKEND_URL` to document the internal Node.js target used by the
future gateway; the current service does not proxy requests yet. Keep it
private until authentication, proxy policy, and service contracts are
implemented.

## Migration rule

Do not delete or bypass the Node.js backend for a Rust service until the Rust
service has:

1. a documented request/response contract;
2. focused tests and load-test results;
3. observability and graceful shutdown;
4. a production deployment and rollback path;
5. a verified replacement route in staging.
