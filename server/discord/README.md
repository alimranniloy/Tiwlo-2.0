# Discord persistence

Discord data uses PostgreSQL tables defined in `discordSchema.js`; `discordDb.js`
is the PostgreSQL-only data adapter. It does not read or write runtime JSON files.
Marketplace products are published rows in `discord_marketplace_products`.
Workspace rows are persisted separately from bots, servers, automations, tickets,
activities, and bot/server assignments.

Before deploying this change to an environment that has legacy files under
`server/data/db/discord`, run the idempotent importer against that environment's
PostgreSQL database:

```powershell
cd server
npm run migrate:discord
```

The importer preserves every source JSON file, skips known demo records and
records whose owning user is absent from `system_users`, and ignores IDs already
present in PostgreSQL. Review its imported/skipped counts before removing any
legacy files manually. The importer does not seed Marketplace products.

Marketplace activation remains disabled until a real deployment provider is
configured; products must not appear as active Workspace services before then.
