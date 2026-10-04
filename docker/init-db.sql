-- ====================================================================
-- TIWLO STOCKPRO - ENTERPRISE MULTI-TENANT POSTGRESQL SCHEMA
-- Master Database: tiwlo_master
-- Isolated Tenant Store Database / Schemas: store_<tiwi_id>
-- ====================================================================

-- 1. MASTER DATABASE SYSTEM TABLES
CREATE TABLE IF NOT EXISTS system_users (
    id VARCHAR(64) PRIMARY KEY,
    tiwi_id VARCHAR(32) UNIQUE NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(32) DEFAULT 'owner',
    date_of_birth DATE,
    phone VARCHAR(64),
    city VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Bangladesh',
    address TEXT,
    postal_code VARCHAR(32),
    plan_id VARCHAR(64) DEFAULT 'free',
    plan_name VARCHAR(100) DEFAULT 'Free Starter',
    subdomain VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON system_users(email);
CREATE INDEX IF NOT EXISTS idx_users_tiwi_id ON system_users(tiwi_id);

CREATE TABLE IF NOT EXISTS system_settings (
    setting_key VARCHAR(64) PRIMARY KEY,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_sessions (
    session_token VARCHAR(128) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    tiwi_id VARCHAR(32) NOT NULL,
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON system_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_tiwi_id ON system_sessions(tiwi_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON system_sessions(expires_at);

CREATE TABLE IF NOT EXISTS system_otp_challenges (
    token_hash CHAR(64) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    challenge_type VARCHAR(32) NOT NULL,
    code_hash CHAR(64) NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0,
    max_attempts SMALLINT NOT NULL DEFAULT 5,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_otp_challenges_expiry ON system_otp_challenges(expires_at);

CREATE TABLE IF NOT EXISTS system_auth_rate_limits (
    key_hash CHAR(64) PRIMARY KEY,
    failure_count INTEGER NOT NULL DEFAULT 0,
    first_failure_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_updated ON system_auth_rate_limits(updated_at);

CREATE TABLE IF NOT EXISTS system_sso_nonces (
    nonce_hash CHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sso_nonces_expiry ON system_sso_nonces(expires_at);

CREATE TABLE IF NOT EXISTS system_email_outbox (
    id BIGSERIAL PRIMARY KEY,
    recipient VARCHAR(255) NOT NULL,
    sender VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    email_type VARCHAR(64) NOT NULL,
    delivery_status VARCHAR(32) NOT NULL,
    message_id VARCHAR(255),
    error_message TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_created ON system_email_outbox(created_at DESC);

CREATE TABLE IF NOT EXISTS system_security_events (
    id BIGSERIAL PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(16) NOT NULL DEFAULT 'info',
    user_id VARCHAR(64),
    subject_hash CHAR(64),
    remote_ip INET,
    user_agent VARCHAR(512),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON system_security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON system_security_events(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS system_account_security (
    user_id VARCHAR(64) PRIMARY KEY,
    strikes INTEGER NOT NULL DEFAULT 0,
    cooldown_until TIMESTAMP WITH TIME ZONE,
    permanently_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_reason TEXT,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_media (
    id VARCHAR(64) PRIMARY KEY,
    content_type VARCHAR(128) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
    sha256 CHAR(64) NOT NULL,
    owner_id VARCHAR(64),
    purpose VARCHAR(64) NOT NULL DEFAULT 'general',
    review_status VARCHAR(16) NOT NULL DEFAULT 'approved',
    storage_backend VARCHAR(16) NOT NULL DEFAULT 'postgres',
    drive_file_id VARCHAR(255),
    drive_account_id VARCHAR(64),
    data BYTEA,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE system_media ADD COLUMN IF NOT EXISTS review_status VARCHAR(16) NOT NULL DEFAULT 'approved';
ALTER TABLE system_media ADD COLUMN IF NOT EXISTS storage_backend VARCHAR(16) NOT NULL DEFAULT 'postgres';
ALTER TABLE system_media ADD COLUMN IF NOT EXISTS drive_file_id VARCHAR(255);
ALTER TABLE system_media ADD COLUMN IF NOT EXISTS drive_account_id VARCHAR(64);
ALTER TABLE system_media ALTER COLUMN data DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_system_media_created ON system_media(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_media_sha256 ON system_media(sha256);
CREATE INDEX IF NOT EXISTS idx_system_media_review_status ON system_media(review_status, content_type);

CREATE TABLE IF NOT EXISTS system_media_aliases (
    storage_path TEXT PRIMARY KEY,
    media_id VARCHAR(64) NOT NULL REFERENCES system_media(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_system_media_aliases_media ON system_media_aliases(media_id);

CREATE TABLE IF NOT EXISTS system_google_drive_accounts (
    id VARCHAR(64) PRIMARY KEY,
    display_name VARCHAR(120) NOT NULL,
    project_id VARCHAR(128) NOT NULL,
    client_email VARCHAR(255) NOT NULL UNIQUE,
    root_folder_id VARCHAR(255) NOT NULL,
    credentials_ciphertext BYTEA NOT NULL,
    encryption_iv BYTEA NOT NULL,
    encryption_auth_tag BYTEA NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'configured',
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_google_drive_accounts_created
    ON system_google_drive_accounts(created_at DESC);
ALTER TABLE system_google_drive_accounts ADD COLUMN IF NOT EXISTS root_folder_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS system_platform_storage (
    id VARCHAR(32) PRIMARY KEY,
    backend VARCHAR(16) NOT NULL DEFAULT 'postgres',
    google_drive_account_id VARCHAR(64)
      REFERENCES system_google_drive_accounts(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (backend IN ('postgres', 'local', 'google_drive'))
);
ALTER TABLE system_platform_storage DROP CONSTRAINT IF EXISTS system_platform_storage_backend_check;
ALTER TABLE system_platform_storage
    ADD CONSTRAINT system_platform_storage_backend_check CHECK (backend IN ('postgres', 'local', 'google_drive'));

CREATE TABLE IF NOT EXISTS system_storage_sync_state (
    id VARCHAR(32) PRIMARY KEY DEFAULT 'primary',
    direction VARCHAR(24) NOT NULL DEFAULT 'idle',
    status VARCHAR(24) NOT NULL DEFAULT 'idle',
    processed_files BIGINT NOT NULL DEFAULT 0,
    total_files BIGINT NOT NULL DEFAULT 0,
    failed_files BIGINT NOT NULL DEFAULT 0,
    current_file TEXT,
    last_error TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    CHECK (direction IN ('idle', 'to_drive', 'to_server')),
    CHECK (status IN ('idle', 'running', 'failed', 'complete'))
);
ALTER TABLE system_storage_sync_state
    ADD COLUMN IF NOT EXISTS total_files BIGINT NOT NULL DEFAULT 0;
ALTER TABLE system_storage_sync_state
    ADD COLUMN IF NOT EXISTS current_file TEXT;
INSERT INTO system_storage_sync_state (id, direction, status)
VALUES ('primary', 'idle', 'idle')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS system_stores (
    id VARCHAR(64) PRIMARY KEY,
    tiwi_id VARCHAR(32) UNIQUE NOT NULL,
    store_name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(255) UNIQUE NOT NULL,
    owner_id VARCHAR(64) REFERENCES system_users(id),
    plan_id VARCHAR(64) DEFAULT 'free',
    db_schema_name VARCHAR(64) NOT NULL,
    status VARCHAR(32) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    tiwi_id VARCHAR(32) REFERENCES system_stores(tiwi_id) ON DELETE CASCADE,
    plan_id VARCHAR(64) NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    price VARCHAR(32) DEFAULT '$0',
    billing_cycle VARCHAR(32) DEFAULT 'monthly',
    product_limit INT DEFAULT 50,
    warehouse_limit INT DEFAULT 1,
    has_custom_domain BOOLEAN DEFAULT false,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_custom_domains (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
    tiwi_id VARCHAR(64) NOT NULL,
    domain VARCHAR(253) NOT NULL UNIQUE,
    verification_token VARCHAR(128) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending_verification',
    ssl_status VARCHAR(32) NOT NULL DEFAULT 'not_requested',
    ssl_error TEXT,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_custom_domains_user ON system_custom_domains(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_domains_status ON system_custom_domains(status, ssl_status);

-- ====================================================================
-- 2. TIWI SOCIAL ECOSYSTEM TABLES
-- ====================================================================
CREATE TABLE IF NOT EXISTS social_profiles (
    id VARCHAR(64) PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
    tiwi_id VARCHAR(64),
    name VARCHAR(255),
    handle VARCHAR(128) UNIQUE,
    bio TEXT,
    avatar TEXT,
    cover_photo TEXT,
    account_type VARCHAR(64) DEFAULT 'personal',
    website VARCHAR(255),
    location VARCHAR(255),
    phone VARCHAR(64),
    gender VARCHAR(32),
    birthday VARCHAR(64),
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_social_handle ON social_profiles(handle);

CREATE TABLE IF NOT EXISTS social_posts (
    id VARCHAR(64) PRIMARY KEY,
    author_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    caption TEXT,
    media_urls JSONB DEFAULT '[]'::jsonb,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    shares_count INT DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_author ON social_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON social_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS social_reels (
    id VARCHAR(64) PRIMARY KEY,
    author_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    video_url TEXT NOT NULL,
    caption TEXT,
    sound_title VARCHAR(255),
    likes_count INT DEFAULT 0,
    views_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_stories (
    id VARCHAR(64) PRIMARY KEY,
    author_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    media_url TEXT NOT NULL,
    media_type VARCHAR(32) DEFAULT 'image',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_follows (
    id VARCHAR(64) PRIMARY KEY,
    follower_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    following_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS social_likes (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    target_type VARCHAR(32) NOT NULL,
    target_id VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS social_comments (
    id VARCHAR(64) PRIMARY KEY,
    post_id VARCHAR(64) REFERENCES social_posts(id) ON DELETE CASCADE,
    author_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_conversations (
    id VARCHAR(64) PRIMARY KEY,
    participant_ids JSONB NOT NULL,
    last_message TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_messages (
    id VARCHAR(64) PRIMARY KEY,
    conversation_id VARCHAR(64) REFERENCES social_conversations(id) ON DELETE CASCADE,
    sender_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    text TEXT,
    media_url TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_notifications (
    id VARCHAR(64) PRIMARY KEY,
    recipient_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    sender_id VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
    type VARCHAR(64) NOT NULL,
    content TEXT,
    entity_id VARCHAR(64),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- 3. CLOUD & DROPLET TABLES
-- ====================================================================
CREATE TABLE IF NOT EXISTS cloud_droplets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    specs VARCHAR(255),
    vcpus INT DEFAULT 1,
    memory VARCHAR(64),
    storage VARCHAR(64),
    ip VARCHAR(64),
    region VARCHAR(128),
    region_code VARCHAR(32),
    status VARCHAR(64) DEFAULT 'active',
    image VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cloud_activities (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
    action VARCHAR(255) NOT NULL,
    target VARCHAR(255),
    type VARCHAR(64) DEFAULT 'droplet',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cloud_billing_accounts (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE UNIQUE,
    credits NUMERIC(12, 2) DEFAULT 0,
    monthly_spend NUMERIC(12, 2) DEFAULT 0,
    currency VARCHAR(32) DEFAULT 'USD',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cloud_vouchers (
    id VARCHAR(64) PRIMARY KEY,
    code VARCHAR(64) UNIQUE NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    is_redeemed BOOLEAN DEFAULT FALSE,
    redeemed_by VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMP WITH TIME ZONE
);

-- ====================================================================
-- 4. LIVE SUPPORT & TICKETING TABLES
-- ====================================================================
CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    category VARCHAR(128),
    status VARCHAR(64) DEFAULT 'open',
    priority VARCHAR(32) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_ticket_messages (
    id VARCHAR(64) PRIMARY KEY,
    ticket_id VARCHAR(64) REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id VARCHAR(64),
    sender_type VARCHAR(32) DEFAULT 'user',
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ====================================================================
-- TEMPLATE DDL FOR ISOLATED TENANT STORE SCHEMAS
-- When a new store is registered with Tiwi ID (e.g. TIW-10001),
-- this schema and its dedicated tables are provisioned automatically.
-- ====================================================================

-- Function to provision an isolated store schema with dedicated tables
CREATE OR REPLACE FUNCTION provision_store_schema(schema_name TEXT) 
RETURNS VOID AS $$
BEGIN
    -- Create isolated schema for tenant
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

    -- 1. Products Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.products (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            sku VARCHAR(64) UNIQUE NOT NULL,
            category VARCHAR(100) NOT NULL,
            sub_category VARCHAR(100),
            price NUMERIC(12, 2) NOT NULL DEFAULT 0,
            cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
            stock INT NOT NULL DEFAULT 0,
            min_stock INT DEFAULT 20,
            unit VARCHAR(32) DEFAULT ''Pcs'',
            status VARCHAR(32) DEFAULT ''In Stock'',
            image TEXT,
            supplier VARCHAR(255),
            warehouse VARCHAR(100) DEFAULT ''Main Warehouse'',
            barcode VARCHAR(128),
            description TEXT,
            is_new BOOLEAN DEFAULT false,
            badge VARCHAR(64),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- 2. Categories Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.categories (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(100) NOT NULL,
            icon VARCHAR(64) DEFAULT ''Package'',
            color VARCHAR(32) DEFAULT ''#3B82F6'',
            description TEXT,
            item_count INT DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- 3. Subcategories Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.subcategories (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            parent_category VARCHAR(100) NOT NULL,
            item_count INT DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- 4. Customers Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.customers (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(64),
            address TEXT,
            city VARCHAR(100),
            total_orders INT DEFAULT 0,
            total_spent NUMERIC(12, 2) DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- 5. Suppliers Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.suppliers (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            contact_person VARCHAR(255),
            email VARCHAR(255),
            phone VARCHAR(64),
            address TEXT,
            category VARCHAR(100),
            status VARCHAR(32) DEFAULT ''Active'',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- 6. Purchases Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.purchases (
            id VARCHAR(64) PRIMARY KEY,
            order_number VARCHAR(64) NOT NULL,
            supplier VARCHAR(255) NOT NULL,
            product_id VARCHAR(64),
            product_name VARCHAR(255) NOT NULL,
            sku VARCHAR(64),
            quantity INT NOT NULL,
            unit_cost NUMERIC(12, 2) NOT NULL,
            total_cost NUMERIC(12, 2) NOT NULL,
            status VARCHAR(32) DEFAULT ''Received'',
            date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            notes TEXT
        )', schema_name);

    -- 7. Sales Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.sales (
            id VARCHAR(64) PRIMARY KEY,
            invoice_number VARCHAR(64) NOT NULL,
            customer_name VARCHAR(255) NOT NULL,
            customer_phone VARCHAR(64),
            items JSONB NOT NULL DEFAULT ''[]'',
            subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
            discount NUMERIC(12, 2) DEFAULT 0,
            tax NUMERIC(12, 2) DEFAULT 0,
            total_amount NUMERIC(12, 2) NOT NULL,
            payment_method VARCHAR(64) DEFAULT ''Cash'',
            payment_status VARCHAR(32) DEFAULT ''Paid'',
            date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- 8. Inventory Adjustments Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.inventory_adjustments (
            id VARCHAR(64) PRIMARY KEY,
            product_id VARCHAR(64) NOT NULL,
            product_name VARCHAR(255) NOT NULL,
            sku VARCHAR(64),
            type VARCHAR(64) NOT NULL,
            quantity INT NOT NULL,
            previous_stock INT NOT NULL,
            new_stock INT NOT NULL,
            reason TEXT,
            adjusted_by VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- 9. Activities Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.activities (
            id VARCHAR(64) PRIMARY KEY,
            type VARCHAR(64) NOT NULL,
            action VARCHAR(255) NOT NULL,
            details TEXT,
            timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

    -- 10. Store Settings Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I.store_settings (
            key VARCHAR(64) PRIMARY KEY,
            value JSONB NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )', schema_name);

END;
$$ LANGUAGE plpgsql;

-- Provision the default primary store schema for TIW-10001
SELECT provision_store_schema('store_tiw_10001');

-- Initial Admin User (Disabled plaintext seed; configure via secure setup or environment variables)
-- INSERT INTO system_users (
--     id, tiwi_id, store_name, email, password_hash, role, plan_id, plan_name, subdomain
-- ) VALUES (
--     'usr_tiw_10001',
--     'TIW-10001',
--     'Tiwlo Main Store',
--     'admin@tiwlo.com',
--     'scrypt$16384:8:1$ef14984cd8f2d95a5747fa5342f9f1c4$c08847696fba63d66dce5b000cddcdf5f49d43dffa3400b65acf96c9d0e68d5378d1044f4fb31b05e7bb49536f1ae15624c9f51dc731a2b8c8b21e12f44ca31c',
--     'owner',
--     'enterprise',
--     'Enterprise Unlimited',
--     'main.tiwlo.shop'
-- ) ON CONFLICT (tiwi_id) DO NOTHING;
