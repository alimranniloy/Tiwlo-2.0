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
