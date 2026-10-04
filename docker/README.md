# Tiwlo StockPro - Docker & PostgreSQL Multi-Tenant Architecture

This directory contains the production-grade Docker and PostgreSQL 16 infrastructure for Tiwlo StockPro.

## 🚀 Services Overview

| Service | Port | Description |
| :--- | :--- | :--- |
| **`postgres`** | `5432` | PostgreSQL 16 Alpine Multi-Tenant Engine |
| **`pgadmin`** | `5050` | pgAdmin 4 Web GUI (http://localhost:5050) |
| **`app`** | `5000` / `5173` | Tiwlo Node.js Backend & Client |

## 📦 Quick Start with Docker

```bash
# 1. Start PostgreSQL 16 and pgAdmin in detached mode
docker-compose -f docker/docker-compose.yml up -d postgres pgadmin

# 2. Start all services including the full Tiwlo application
docker-compose -f docker/docker-compose.yml up -d --build

# 3. View live database logs
docker-compose -f docker/docker-compose.yml logs -f postgres

# 4. Stop all services
docker-compose -f docker/docker-compose.yml down
```

## 🗄️ Multi-Tenant Database Architecture

1. **Master Database (`tiwlo_master`)**:
   - `system_users`: Global accounts (Email, Tiwi ID, Password hash, Role, Plan).
   - `system_sessions`: Cryptographic 30-day session tokens.
   - `system_stores`: Store registry, subdomains, and isolated schema names.
   - `system_subscriptions`: Tier limits, pricing, and custom domain configuration.

2. **Isolated Tenant Store Database / Schema (`store_<tiwi_id>`)**:
   - Each registered store receives its own dedicated, isolated schema: `store_tiw_XXXXX`.
   - Contains:
     - `products`: Isolated catalog for that store
     - `categories` & `subcategories`: Custom store categories
     - `purchases`: Supplier orders and inventory restocks
     - `sales`: Store sales receipts, invoices, and POS transactions
     - `customers`: Dedicated customer directory
     - `suppliers`: Vendor ledger
     - `inventory_adjustments`: Stock audit logs
     - `activities`: Timestamped store audit log
     - `store_settings`: Store metadata, currency, logo, and policies

When a store is registered via `POST /api/auth/register`, the backend automatically calls `provision_store_schema('store_tiw_XXXXX')` to initialize all tenant tables instantly.
