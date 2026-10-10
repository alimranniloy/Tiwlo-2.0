export const DISCORD_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS discord_bots (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    token TEXT,
    client_id VARCHAR(128),
    avatar TEXT,
    prefix VARCHAR(16) DEFAULT '!',
    status VARCHAR(32) DEFAULT 'offline',
    description TEXT,
    commands_today INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE discord_bots ALTER COLUMN status SET DEFAULT 'offline';
  CREATE INDEX IF NOT EXISTS idx_discord_bots_user ON discord_bots(user_id);

  CREATE TABLE IF NOT EXISTS discord_servers (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    icon TEXT,
    member_count INTEGER DEFAULT 0,
    guild_id VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_discord_servers_user ON discord_servers(user_id);

  CREATE TABLE IF NOT EXISTS discord_bot_servers (
    id VARCHAR(64) PRIMARY KEY,
    bot_id VARCHAR(64) NOT NULL REFERENCES discord_bots(id) ON DELETE CASCADE,
    server_id VARCHAR(64) NOT NULL REFERENCES discord_servers(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(bot_id, server_id)
  );

  CREATE TABLE IF NOT EXISTS discord_activities (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    bot_id VARCHAR(64),
    server_id VARCHAR(64),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    action_type VARCHAR(64) DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_discord_activities_user ON discord_activities(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS discord_automations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    bot_id VARCHAR(64),
    server_id VARCHAR(64),
    type VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_discord_automations_user ON discord_automations(user_id);

  CREATE TABLE IF NOT EXISTS discord_tickets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    server_id VARCHAR(64),
    channel_name VARCHAR(255),
    author_name VARCHAR(255),
    subject VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'open',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_discord_tickets_user ON discord_tickets(user_id);

  CREATE TABLE IF NOT EXISTS discord_marketplace_products (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    developer VARCHAR(255) NOT NULL,
    category VARCHAR(128) NOT NULL,
    description TEXT NOT NULL,
    rating NUMERIC(3, 1),
    reviews_count INTEGER,
    pricing_type VARCHAR(64),
    pricing_label VARCHAR(128),
    icon_type VARCHAR(64),
    icon_bg VARCHAR(64),
    icon_color VARCHAR(64),
    logo_url TEXT,
    install_count INTEGER,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE discord_marketplace_products ADD COLUMN IF NOT EXISTS logo_url TEXT;
  ALTER TABLE discord_marketplace_products ADD COLUMN IF NOT EXISTS install_count INTEGER;
  ALTER TABLE discord_marketplace_products ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT TRUE;

  CREATE TABLE IF NOT EXISTS discord_workspace_services (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    service_id VARCHAR(64),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(128) NOT NULL,
    icon_type VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'Active',
    server_id VARCHAR(64),
    server_name VARCHAR(255) NOT NULL,
    plan VARCHAR(64),
    usage_current INTEGER,
    usage_limit INTEGER,
    usage_label VARCHAR(128),
    renewal_date VARCHAR(64),
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  ALTER TABLE discord_workspace_services ADD COLUMN IF NOT EXISTS logo_url TEXT;
  CREATE INDEX IF NOT EXISTS idx_discord_workspace_services_user ON discord_workspace_services(user_id);

  CREATE TABLE IF NOT EXISTS discord_workspace_operations (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    operation VARCHAR(255) NOT NULL,
    service_id VARCHAR(64),
    service_name VARCHAR(255) NOT NULL,
    result VARCHAR(64) NOT NULL DEFAULT 'Completed',
    time_ago VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_discord_workspace_operations_user ON discord_workspace_operations(user_id, created_at DESC);
`;

export async function ensureDiscordSchema(queryable) {
  if (typeof queryable.exec === 'function') {
    await queryable.exec(DISCORD_SCHEMA_SQL);
  } else {
    await queryable.query(DISCORD_SCHEMA_SQL);
  }
}
