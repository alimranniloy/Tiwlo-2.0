import pg from 'pg';
import { randomBytes, randomUUID } from 'node:crypto';
import { STATE_SCHEMA_SQL } from './stateDocuments.js';
import { signupIdentitySchema } from './signupIdentitySchema.js';
import { ensureDiscordSchema } from '../discord/discordSchema.js';
import { ensurePlatformDnsSchema } from '../dns/platformDnsRecords.js';
const { Pool } = pg;

// PostgreSQL Connection Pool Configuration
const connectionConfig = {
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tiwlo_master',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 4000
};

let pool = null;
let isConnected = false;

export function getPgPool() {
  if (!pool) {
    try {
      pool = new Pool(connectionConfig);
      pool.on('error', (err) => {
        console.warn('⚠️ PostgreSQL Client Pool Error:', err.message);
        isConnected = false;
      });
    } catch (e) {
      console.warn('⚠️ Could not initialize PostgreSQL pool:', e.message);
    }
  }
  return pool;
}

export function getPgConnectionString() {
  return connectionConfig.connectionString;
}

export async function initPgSchema() {
  try {
    const p = getPgPool();
    if (!p) return;
    
    await p.query(`
      CREATE EXTENSION IF NOT EXISTS pgcrypto;

      -- 1. SYSTEM & AUTH TABLES
      CREATE TABLE IF NOT EXISTS system_users (
        id VARCHAR(64) PRIMARY KEY,
        tiwi_id VARCHAR(64),
        name VARCHAR(255),
        store_name VARCHAR(255),
        email VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        role VARCHAR(64) DEFAULT 'owner',
        plan_id VARCHAR(64) DEFAULT 'free',
        plan_name VARCHAR(64) DEFAULT 'Free Starter',
        avatar TEXT,
        cover_photo TEXT,
        phone VARCHAR(64),
        subdomain VARCHAR(128),
        is_banned BOOLEAN DEFAULT FALSE,
        ban_reason TEXT,
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret TEXT,
        email_verified BOOLEAN DEFAULT FALSE,
        auth_method VARCHAR(64) DEFAULT 'credentials',
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

      CREATE TABLE IF NOT EXISTS system_oauth_providers (
        provider VARCHAR(16) PRIMARY KEY CHECK (provider IN ('google', 'github')),
        client_id TEXT NOT NULL DEFAULT '',
        secret_ciphertext BYTEA,
        encryption_iv BYTEA,
        encryption_auth_tag BYTEA,
        enabled BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_social_identities (
        provider VARCHAR(16) NOT NULL CHECK (provider IN ('google', 'github')),
        provider_user_id TEXT NOT NULL,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        provider_email VARCHAR(255) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (provider, provider_user_id),
        UNIQUE (provider, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_social_identity_user ON system_social_identities(user_id);

      CREATE TABLE IF NOT EXISTS system_social_profile_challenges (
        token_hash BYTEA PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        return_to TEXT NOT NULL DEFAULT '',
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL
      );
      ALTER TABLE system_social_profile_challenges
        ADD COLUMN IF NOT EXISTS return_to TEXT NOT NULL DEFAULT '';

      -- Keep standalone initialization compatible with docker/init-db.sql and
      -- the fields used by MasterDB. ADD COLUMN is safe for existing installs.
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS date_of_birth DATE;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS city VARCHAR(100);
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Bangladesh';
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(32);
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS account_type VARCHAR(32) DEFAULT 'personal';
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS otp_disabled BOOLEAN DEFAULT FALSE;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS free_subdomain_claimed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS free_subdomain_id VARCHAR(64);
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS identity_verification_required BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE system_users ADD COLUMN IF NOT EXISTS address_verified_location JSONB;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tiwi_id_unique ON system_users(tiwi_id) WHERE tiwi_id IS NOT NULL;

      CREATE TABLE IF NOT EXISTS system_sessions (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        tiwi_id VARCHAR(64),
        email VARCHAR(255),
        ip VARCHAR(64),
        user_agent TEXT,
        device_fingerprint VARCHAR(128),
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON system_sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON system_sessions(expires_at);

      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS session_token VARCHAR(128);
      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(128);
      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS device_name TEXT;
      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS app_name VARCHAR(64);
      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_token_unique ON system_sessions(session_token);

      CREATE TABLE IF NOT EXISTS system_user_device_identities (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        identity_hash CHAR(64) NOT NULL,
        device_hash CHAR(64),
        ip_hash CHAR(64) NOT NULL,
        user_agent_hash CHAR(64) NOT NULL,
        client_hints_hash CHAR(64),
        platform_class VARCHAR(32) NOT NULL DEFAULT 'unknown',
        first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        login_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE (user_id, identity_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_user_device_identities_identity
        ON system_user_device_identities(identity_hash);
      CREATE INDEX IF NOT EXISTS idx_user_device_identities_ip
        ON system_user_device_identities(ip_hash, last_seen_at DESC);

      CREATE TABLE IF NOT EXISTS user_biometric_credentials (
        id VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL UNIQUE REFERENCES system_users(id) ON DELETE CASCADE,
        device_name VARCHAR(255),
        device_model VARCHAR(255),
        os_version VARCHAR(128),
        public_key_spki TEXT NOT NULL,
        key_fingerprint VARCHAR(128),
        ridge_svg_map TEXT,
        signing_cert_sha256 VARCHAR(128),
        main_country_code VARCHAR(8),
        last_login_country_code VARCHAR(8),
        hardware_backed BOOLEAN NOT NULL DEFAULT TRUE,
        enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP WITH TIME ZONE,
        revoked_at TIMESTAMP WITH TIME ZONE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_biometric_credentials_user_unique
        ON user_biometric_credentials(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_biometric_credentials_fp
        ON user_biometric_credentials(key_fingerprint);

      CREATE TABLE IF NOT EXISTS user_biometric_logs (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        credential_id VARCHAR(128),
        event_type VARCHAR(64) NOT NULL,
        device_name VARCHAR(255),
        ip_address VARCHAR(128),
        country_code VARCHAR(8),
        user_agent TEXT,
        success BOOLEAN NOT NULL DEFAULT TRUE,
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_user_biometric_logs_user_created
        ON user_biometric_logs(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_biometric_logs_credential
        ON user_biometric_logs(credential_id, created_at DESC);

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

      CREATE TABLE IF NOT EXISTS system_security_rate_limits (
        policy_id VARCHAR(64) NOT NULL,
        key_hash CHAR(64) NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0,
        window_started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (policy_id, key_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_security_rate_limits_expiry
        ON system_security_rate_limits(expires_at);

      CREATE TABLE IF NOT EXISTS system_sso_nonces (
        nonce_hash CHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sso_nonces_expiry ON system_sso_nonces(expires_at);

      CREATE TABLE IF NOT EXISTS system_sso_handoffs (
        code_hash CHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        return_to TEXT NOT NULL,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_sso_handoffs_expiry ON system_sso_handoffs(expires_at);

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

      CREATE TABLE IF NOT EXISTS system_user_mail_messages (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        folder VARCHAR(16) NOT NULL CHECK (folder IN ('inbox', 'drafts', 'sent', 'trash', 'archive', 'junk')),
        sender_name VARCHAR(255) NOT NULL,
        sender_email VARCHAR(255) NOT NULL,
        to_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
        cc_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
        bcc_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
        subject TEXT NOT NULL DEFAULT '',
        body_html TEXT NOT NULL DEFAULT '',
        body_text TEXT NOT NULL DEFAULT '',
        preview TEXT NOT NULL DEFAULT '',
        category VARCHAR(64) NOT NULL DEFAULT 'Work',
        is_unread BOOLEAN NOT NULL DEFAULT FALSE,
        is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        delivery_status VARCHAR(32),
        message_id VARCHAR(255),
        delivery_key CHAR(64),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE system_user_mail_messages ADD COLUMN IF NOT EXISTS delivery_key CHAR(64);
      CREATE INDEX IF NOT EXISTS idx_user_mail_folder
        ON system_user_mail_messages(user_id, folder, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_user_mail_flagged
        ON system_user_mail_messages(user_id, is_flagged, created_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mail_delivery_key
        ON system_user_mail_messages(user_id, delivery_key)
        WHERE delivery_key IS NOT NULL;

      CREATE TABLE IF NOT EXISTS system_user_mail_attachments (
        id VARCHAR(64) PRIMARY KEY,
        message_id VARCHAR(64) NOT NULL REFERENCES system_user_mail_messages(id) ON DELETE CASCADE,
        filename VARCHAR(255) NOT NULL,
        content_type VARCHAR(255) NOT NULL,
        size_bytes BIGINT NOT NULL,
        content BYTEA NOT NULL,
        content_id VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE system_user_mail_attachments ADD COLUMN IF NOT EXISTS content_id VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_user_mail_attachments_message
        ON system_user_mail_attachments(message_id);

      CREATE TABLE IF NOT EXISTS system_user_mailboxes (
        user_id VARCHAR(64) PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
        address VARCHAR(254) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_user_mailboxes_address
        ON system_user_mailboxes(LOWER(address));

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

      CREATE TABLE IF NOT EXISTS system_user_login_locations (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        session_key CHAR(64) NOT NULL UNIQUE,
        location_source VARCHAR(8) NOT NULL CHECK (location_source IN ('gps', 'ip')),
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        accuracy_meters DOUBLE PRECISION,
        formatted_address TEXT NOT NULL,
        area VARCHAR(255),
        postal_code VARCHAR(32),
        plus_code VARCHAR(64),
        captured_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_user_login_locations_latest
        ON system_user_login_locations(user_id, captured_at DESC);

      CREATE TABLE IF NOT EXISTS system_account_security (
        user_id VARCHAR(64) PRIMARY KEY,
        strikes INTEGER NOT NULL DEFAULT 0,
        cooldown_until TIMESTAMP WITH TIME ZONE,
        permanently_disabled BOOLEAN NOT NULL DEFAULT FALSE,
        last_reason TEXT,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_free_store_claims (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        store_id VARCHAR(64) NOT NULL,
        plan_id VARCHAR(64) NOT NULL DEFAULT 'free',
        device_fingerprint_hash CHAR(64),
        device_token_hash CHAR(64),
        browser_cookie_hash CHAR(64),
        ip_hash CHAR(64) NOT NULL,
        subnet_hash CHAR(64),
        user_agent_hash CHAR(64),
        platform_class VARCHAR(32) NOT NULL DEFAULT 'unknown',
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_free_claims_user ON system_free_store_claims(user_id);
      CREATE INDEX IF NOT EXISTS idx_free_claims_fp ON system_free_store_claims(device_fingerprint_hash);
      CREATE INDEX IF NOT EXISTS idx_free_claims_device ON system_free_store_claims(device_token_hash);
      CREATE INDEX IF NOT EXISTS idx_free_claims_cookie ON system_free_store_claims(browser_cookie_hash);
      CREATE INDEX IF NOT EXISTS idx_free_claims_ip ON system_free_store_claims(ip_hash);
      CREATE INDEX IF NOT EXISTS idx_free_claims_subnet ON system_free_store_claims(subnet_hash);

      CREATE TABLE IF NOT EXISTS system_blocked_identities (
        id BIGSERIAL PRIMARY KEY,
        signal_type VARCHAR(32) NOT NULL,
        signal_hash CHAR(64) NOT NULL,
        reason TEXT NOT NULL,
        source_user_id VARCHAR(64),
        strikes INTEGER NOT NULL DEFAULT 1,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (signal_type, signal_hash)
      );
      CREATE INDEX IF NOT EXISTS idx_blocked_identities_active
        ON system_blocked_identities(signal_type, signal_hash) WHERE is_active = TRUE;

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
        tiwi_id VARCHAR(64) UNIQUE,
        owner_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        store_name VARCHAR(255),
        subdomain VARCHAR(128) UNIQUE,
        plan_id VARCHAR(64) DEFAULT 'free',
        category VARCHAR(128),
        currency VARCHAR(32) DEFAULT 'USD ($)',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_subscriptions (
        id VARCHAR(64) PRIMARY KEY,
        tiwi_id VARCHAR(64) REFERENCES system_stores(tiwi_id) ON DELETE CASCADE,
        plan_id VARCHAR(64) NOT NULL,
        plan_name VARCHAR(100) NOT NULL,
        price NUMERIC(10, 2) DEFAULT 0,
        billing_cycle VARCHAR(32) DEFAULT 'monthly',
        product_limit INT DEFAULT 50,
        warehouse_limit INT DEFAULT 1,
        has_custom_domain BOOLEAN DEFAULT FALSE,
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

      CREATE TABLE IF NOT EXISTS system_free_subdomains (
        id VARCHAR(64) PRIMARY KEY,
        subdomain VARCHAR(63) NOT NULL UNIQUE,
        domain VARCHAR(253) NOT NULL UNIQUE,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL DEFAULT 'active'
          CHECK (status IN ('active', 'suspended', 'released')),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_free_subdomains_user
        ON system_free_subdomains(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_free_subdomains_status
        ON system_free_subdomains(status);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_free_subdomains_one_per_user
        ON system_free_subdomains(user_id);
      UPDATE system_users u
      SET free_subdomain_claimed_at = COALESCE(u.free_subdomain_claimed_at, d.created_at),
          free_subdomain_id = COALESCE(u.free_subdomain_id, d.id)
      FROM system_free_subdomains d
      WHERE d.user_id = u.id
        AND d.status = 'active'
        AND u.free_subdomain_claimed_at IS NULL;
      CREATE TABLE IF NOT EXISTS system_free_subdomain_records (
        id VARCHAR(64) PRIMARY KEY,
        subdomain_id VARCHAR(64) NOT NULL REFERENCES system_free_subdomains(id) ON DELETE CASCADE,
        type VARCHAR(8) NOT NULL CHECK (type IN ('A', 'AAAA', 'CNAME', 'TXT', 'NS')),
        name VARCHAR(253) NOT NULL,
        value TEXT NOT NULL,
        ttl INTEGER NOT NULL DEFAULT 300 CHECK (ttl BETWEEN 60 AND 86400),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (subdomain_id, type, name, value)
      );
      ALTER TABLE system_free_subdomain_records
        DROP CONSTRAINT IF EXISTS system_free_subdomain_records_type_check;
      ALTER TABLE system_free_subdomain_records
        ADD CONSTRAINT system_free_subdomain_records_type_check
        CHECK (type IN ('A', 'AAAA', 'CNAME', 'TXT', 'NS'));
      ALTER TABLE system_free_subdomain_records
        DROP CONSTRAINT IF EXISTS system_free_subdomain_records_subdomain_id_type_name_key;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_free_subdomain_records_unique_value
        ON system_free_subdomain_records(subdomain_id, type, name, value);
      CREATE INDEX IF NOT EXISTS idx_free_subdomain_records_domain
        ON system_free_subdomain_records(subdomain_id);

      CREATE TABLE IF NOT EXISTS system_free_subdomain_claim_attempts (
        id BIGSERIAL PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
        subdomain VARCHAR(63) NOT NULL,
        ip_hash CHAR(64) NOT NULL,
        device_hash CHAR(64),
        email_hash CHAR(64),
        outcome VARCHAR(32) NOT NULL,
        reason VARCHAR(128),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_free_claim_attempts_ip
        ON system_free_subdomain_claim_attempts(ip_hash, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_free_claim_attempts_device
        ON system_free_subdomain_claim_attempts(device_hash, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_free_claim_attempts_user
        ON system_free_subdomain_claim_attempts(user_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS system_oneprofile_profiles (
        user_id VARCHAR(64) PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
        headline VARCHAR(255),
        bio TEXT,
        public_slug VARCHAR(63) UNIQUE,
        profile_visibility VARCHAR(16) NOT NULL DEFAULT 'private'
          CHECK (profile_visibility IN ('private', 'public')),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_oneprofile_websites (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        domain VARCHAR(253) NOT NULL,
        title VARCHAR(255),
        template_id VARCHAR(128),
        status VARCHAR(32) NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'active', 'suspended')),
        view_count BIGINT NOT NULL DEFAULT 0 CHECK (view_count >= 0),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, domain)
      );
      CREATE INDEX IF NOT EXISTS idx_oneprofile_websites_user
        ON system_oneprofile_websites(user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS system_oneprofile_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        notification_type VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        read_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_oneprofile_notifications_user
        ON system_oneprofile_notifications(user_id, created_at DESC);

      -- 2. TIWI SOCIAL ECOSYSTEM TABLES
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
        privacy_settings JSONB DEFAULT '{"protectPosts":false,"photoTagging":true,"locationSharing":false,"discoverability":true}'::jsonb,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_social_handle ON social_profiles(handle);
      ALTER TABLE social_profiles ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{"protectPosts":false,"photoTagging":true,"locationSharing":false,"discoverability":true}'::jsonb;

      CREATE TABLE IF NOT EXISTS social_posts (
        id VARCHAR(64) PRIMARY KEY,
        author_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        caption TEXT,
        media_urls JSONB DEFAULT '[]'::jsonb,
        likes_count INT DEFAULT 0,
        comments_count INT DEFAULT 0,
        shares_count INT DEFAULT 0,
        views_count INT DEFAULT 0,
        is_pinned BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS views_count INT DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_posts_author ON social_posts(author_id);
      CREATE INDEX IF NOT EXISTS idx_posts_created ON social_posts(created_at DESC);

      CREATE TABLE IF NOT EXISTS social_post_views (
        post_id VARCHAR(64) REFERENCES social_posts(id) ON DELETE CASCADE,
        viewer_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, viewer_id)
      );

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

      CREATE TABLE IF NOT EXISTS social_follow_requests (
        id VARCHAR(64) PRIMARY KEY,
        requester_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        recipient_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(requester_id, recipient_id)
      );

      CREATE INDEX IF NOT EXISTS idx_social_follow_requests_recipient
        ON social_follow_requests(recipient_id, status, created_at DESC);

      CREATE TABLE IF NOT EXISTS social_likes (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        target_type VARCHAR(32) NOT NULL, -- 'post' | 'reel' | 'comment'
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
        type VARCHAR(32) DEFAULT 'direct',
        title VARCHAR(255),
        avatar TEXT,
        created_by VARCHAR(64),
        last_message_text TEXT,
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_archived BOOLEAN DEFAULT FALSE,
        is_pinned BOOLEAN DEFAULT FALSE,
        disappearing_ttl_seconds INT DEFAULT 0,
        participant_ids JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS type VARCHAR(32) DEFAULT 'direct';
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS avatar TEXT;
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS created_by VARCHAR(64);
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS last_message_text TEXT;
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT FALSE;
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS disappearing_ttl_seconds INT DEFAULT 0;
      ALTER TABLE social_conversations ADD COLUMN IF NOT EXISTS participant_ids JSONB DEFAULT '[]'::jsonb;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_tiwi_id_unique ON system_users(tiwi_id);

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
      ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS snippet TEXT;
      ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS thumbnail TEXT;
      ALTER TABLE social_notifications ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;

      -- 3. CLOUD & DROPLET TABLES
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
        access_username VARCHAR(64),
        access_password_hash TEXT,
        tenant_id VARCHAR(64),
        node_id VARCHAR(64),
        tags TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS access_username VARCHAR(64);
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS access_password_hash TEXT;
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64);
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS node_id VARCHAR(64);
      ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS tags TEXT;

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

      ALTER TABLE cloud_billing_accounts ADD COLUMN IF NOT EXISTS account_type VARCHAR(32);
      ALTER TABLE cloud_billing_accounts ADD COLUMN IF NOT EXISTS business_name VARCHAR(255);
      ALTER TABLE cloud_billing_accounts ADD COLUMN IF NOT EXISTS promotional_credits NUMERIC(12, 2) NOT NULL DEFAULT 0;
      ALTER TABLE cloud_billing_accounts ADD COLUMN IF NOT EXISTS promotional_expires_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE cloud_billing_accounts ADD COLUMN IF NOT EXISTS welcome_promo_claimed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE cloud_billing_accounts ADD COLUMN IF NOT EXISTS first_paid_topup_at TIMESTAMP WITH TIME ZONE;

      CREATE TABLE IF NOT EXISTS cloud_credit_topups (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        provider VARCHAR(32) NOT NULL,
        mode VARCHAR(16) NOT NULL,
        amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 1 AND amount <= 10000),
        currency VARCHAR(3) NOT NULL DEFAULT 'USD',
        provider_payment_id VARCHAR(255),
        transaction_id VARCHAR(255),
        return_origin TEXT NOT NULL DEFAULT 'https://uids.app',
        return_token_hash CHAR(64) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        expires_at TIMESTAMP WITH TIME ZONE,
        cancelled_at TIMESTAMP WITH TIME ZONE,
        cancel_reason VARCHAR(32),
        reminder_claimed_at TIMESTAMP WITH TIME ZONE,
        reminder_sent_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        paid_at TIMESTAMP WITH TIME ZONE,
        UNIQUE (provider, provider_payment_id)
      );
      ALTER TABLE cloud_credit_topups DROP CONSTRAINT IF EXISTS cloud_credit_topups_amount_check;
      ALTER TABLE cloud_credit_topups ADD CONSTRAINT cloud_credit_topups_amount_check CHECK (amount >= 1 AND amount <= 10000);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(32);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS reminder_claimed_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMP WITH TIME ZONE;
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS device_fingerprint_hash CHAR(64);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS device_token_hash CHAR(64);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS browser_cookie_hash CHAR(64);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS ip_hash CHAR(64);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS subnet_hash CHAR(64);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS user_agent_hash CHAR(64);
      UPDATE cloud_credit_topups
      SET expires_at = created_at + INTERVAL '24 hours'
      WHERE expires_at IS NULL;
      CREATE INDEX IF NOT EXISTS cloud_credit_topups_user_created_idx
        ON cloud_credit_topups(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS cloud_credit_topups_pending_expiry_idx
        ON cloud_credit_topups(expires_at) WHERE status = 'pending';
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS return_origin TEXT NOT NULL DEFAULT 'https://uids.app';
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS provider_amount NUMERIC(12, 2);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS provider_currency VARCHAR(3);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(18, 8);
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS rate_date DATE;
      ALTER TABLE cloud_credit_topups ADD COLUMN IF NOT EXISTS rate_source TEXT;

      CREATE TABLE IF NOT EXISTS whatsapp_auth_state (
        state_key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cloud_vouchers (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) UNIQUE NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        is_redeemed BOOLEAN DEFAULT FALSE,
        redeemed_by VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
        redeemed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS cloud_promo_codes (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(64) NOT NULL UNIQUE,
        description TEXT NOT NULL DEFAULT '',
        reward_type VARCHAR(32) NOT NULL DEFAULT 'promo_credit',
        amount_usd NUMERIC(12, 2) NOT NULL CHECK (amount_usd > 0),
        validity_days INTEGER NOT NULL DEFAULT 30 CHECK (validity_days > 0),
        min_topup_usd NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (min_topup_usd >= 0),
        target_type VARCHAR(32) NOT NULL DEFAULT 'all',
        target_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
        target_user_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        max_total_uses INTEGER,
        uses_count INTEGER NOT NULL DEFAULT 0,
        max_per_user INTEGER NOT NULL DEFAULT 1,
        one_per_device BOOLEAN NOT NULL DEFAULT TRUE,
        new_accounts_only BOOLEAN NOT NULL DEFAULT FALSE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_by VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_cloud_promo_codes_code ON cloud_promo_codes(UPPER(BTRIM(code)));

      CREATE TABLE IF NOT EXISTS system_promo_claims (
        id BIGSERIAL PRIMARY KEY,
        claim_type VARCHAR(32) NOT NULL,
        promo_code_id VARCHAR(64),
        promo_code VARCHAR(64),
        user_id VARCHAR(64) NOT NULL REFERENCES system_users(id) ON DELETE CASCADE,
        amount_usd NUMERIC(12, 2) NOT NULL DEFAULT 0,
        validity_days INTEGER NOT NULL DEFAULT 30,
        expires_at TIMESTAMP WITH TIME ZONE,
        device_fingerprint_hash CHAR(64),
        device_token_hash CHAR(64),
        browser_cookie_hash CHAR(64),
        ip_hash CHAR(64),
        subnet_hash CHAR(64),
        user_agent_hash CHAR(64),
        status VARCHAR(32) NOT NULL DEFAULT 'granted',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_promo_claims_user ON system_promo_claims(user_id, claim_type);
      CREATE INDEX IF NOT EXISTS idx_promo_claims_code ON system_promo_claims(promo_code_id, user_id);
      CREATE INDEX IF NOT EXISTS idx_promo_claims_fp ON system_promo_claims(device_fingerprint_hash);
      CREATE INDEX IF NOT EXISTS idx_promo_claims_device ON system_promo_claims(device_token_hash);
      CREATE INDEX IF NOT EXISTS idx_promo_claims_ip ON system_promo_claims(ip_hash);

      CREATE TABLE IF NOT EXISTS platform_billing_orders (
        id VARCHAR(64) PRIMARY KEY,
        order_number VARCHAR(64) UNIQUE NOT NULL,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
        tiwi_id VARCHAR(64),
        order_type VARCHAR(32) NOT NULL,
        plan_id VARCHAR(64),
        item_name TEXT,
        gross_amount_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
        cash_credit_used_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
        promo_credit_used_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
        net_cash_revenue_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
        provider VARCHAR(32),
        currency VARCHAR(8) NOT NULL DEFAULT 'USD',
        status VARCHAR(32) NOT NULL DEFAULT 'paid',
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_platform_billing_orders_user
        ON platform_billing_orders(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_platform_billing_orders_created
        ON platform_billing_orders(created_at DESC);

      -- 4. LIVE SUPPORT & TICKETING TABLES
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
        sender_type VARCHAR(32) DEFAULT 'user', -- 'user' | 'agent' | 'bot'
        message TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE support_tickets
        ADD COLUMN IF NOT EXISTS ticket_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS serial_number VARCHAR(64),
        ADD COLUMN IF NOT EXISTS user_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS user_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS requester_type VARCHAR(24) NOT NULL DEFAULT 'user',
        ADD COLUMN IF NOT EXISTS guest_session_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255),
        ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(64),
        ADD COLUMN IF NOT EXISTS guest_access_hash CHAR(64),
        ADD COLUMN IF NOT EXISTS tiwi_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS store_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS store_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS channel VARCHAR(32) NOT NULL DEFAULT 'web',
        ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
        ADD COLUMN IF NOT EXISTS department VARCHAR(64) NOT NULL DEFAULT 'general',
        ADD COLUMN IF NOT EXISTS escalation_tier SMALLINT NOT NULL DEFAULT 1,
        ADD COLUMN IF NOT EXISTS assigned_agent_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS assigned_agent_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS assigned_agent_avatar TEXT,
        ADD COLUMN IF NOT EXISTS assigned_agent_role VARCHAR(128),
        ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS watchers JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS sla_due_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS sla_response_due_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS sla_resolve_due_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS sla_breach_notified_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS auto_close_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS snoozed_until TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS csat_rating SMALLINT,
        ADD COLUMN IF NOT EXISTS csat_comment TEXT,
        ADD COLUMN IF NOT EXISTS merged_into_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS parent_ticket_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS unread_by_user BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS unread_by_staff BOOLEAN NOT NULL DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS resolution TEXT,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

      ALTER TABLE support_ticket_messages
        ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS sender_avatar TEXT,
        ADD COLUMN IF NOT EXISTS sender_role VARCHAR(128),
        ADD COLUMN IF NOT EXISTS is_internal BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

      CREATE TABLE IF NOT EXISTS support_guest_sessions (
        id VARCHAR(64) PRIMARY KEY,
        token_hash CHAR(64) NOT NULL UNIQUE,
        visitor_name VARCHAR(255) NOT NULL,
        visitor_email VARCHAR(255) NOT NULL,
        visitor_phone VARCHAR(64) NOT NULL,
        ip_hash CHAR(64),
        user_agent TEXT,
        device_hint VARCHAR(255),
        claimed_user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE SET NULL,
        claimed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days'),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      ALTER TABLE support_guest_sessions
        ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '30 days');

      CREATE TABLE IF NOT EXISTS support_ticket_events (
        id VARCHAR(64) PRIMARY KEY,
        ticket_id VARCHAR(64) NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
        actor_id VARCHAR(64),
        actor_name VARCHAR(255),
        actor_type VARCHAR(32) NOT NULL DEFAULT 'system',
        event_type VARCHAR(64) NOT NULL,
        summary TEXT NOT NULL,
        changes JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS support_macros (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(160) NOT NULL,
        category VARCHAR(128) DEFAULT 'General',
        body TEXT NOT NULL,
        default_status VARCHAR(64),
        default_tags JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_id ON support_tickets(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_guest_session ON support_tickets(guest_session_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_guest_email ON support_tickets(guest_email);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_status_updated ON support_tickets(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_agent ON support_tickets(assigned_agent_id);
      CREATE INDEX IF NOT EXISTS idx_support_tickets_auto_close ON support_tickets(auto_close_at) WHERE auto_close_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_support_tickets_snoozed ON support_tickets(snoozed_until) WHERE snoozed_until IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id, created_at ASC);
      CREATE INDEX IF NOT EXISTS idx_support_ticket_events_ticket ON support_ticket_events(ticket_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_guest_sessions_email ON support_guest_sessions(visitor_email);
      CREATE INDEX IF NOT EXISTS idx_support_guest_sessions_expires ON support_guest_sessions(expires_at);

      -- 5. TIWI ADVANCED ECOSYSTEM REAL DATABASE TABLES
      CREATE TABLE IF NOT EXISTS social_custom_lists (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_private BOOLEAN DEFAULT FALSE,
        is_pinned BOOLEAN DEFAULT FALSE,
        members_count INT DEFAULT 0,
        subscribers_count INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_drafts_scheduler (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        publish_at VARCHAR(128),
        audience VARCHAR(64) DEFAULT 'Public',
        media_type VARCHAR(32) DEFAULT 'text',
        status VARCHAR(32) DEFAULT 'draft', -- 'draft' | 'scheduled' | 'published'
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_bio_links (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        url TEXT NOT NULL,
        icon VARCHAR(64) DEFAULT 'link',
        clicks INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_wallet_accounts (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE UNIQUE,
        balance NUMERIC(12, 2) DEFAULT 0.00,
        currency VARCHAR(16) DEFAULT 'USD',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_wallet_transactions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        type VARCHAR(32) NOT NULL, -- 'received' | 'sent' | 'topup'
        amount NUMERIC(12, 2) NOT NULL,
        party_name VARCHAR(255),
        party_handle VARCHAR(128),
        note TEXT,
        status VARCHAR(32) DEFAULT 'completed',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_device_sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        device VARCHAR(255) NOT NULL,
        client VARCHAR(255),
        ip VARCHAR(64),
        location VARCHAR(128),
        is_current BOOLEAN DEFAULT FALSE,
        last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_referral_rewards (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        ref_code VARCHAR(64) NOT NULL,
        points INT DEFAULT 0,
        invited_user_id VARCHAR(64),
        invited_name VARCHAR(255),
        invited_handle VARCHAR(128),
        points_earned VARCHAR(32) DEFAULT '+150 pts',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_content_filters (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE UNIQUE,
        harassment_shield BOOLEAN DEFAULT TRUE,
        blur_sensitive BOOLEAN DEFAULT TRUE,
        hide_low_quality BOOLEAN DEFAULT TRUE,
        muted_words JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_creator_media_kits (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE UNIQUE,
        monthly_impressions VARCHAR(64) DEFAULT '0',
        engagement_rate VARCHAR(32) DEFAULT '0.0%',
        verified_metrics BOOLEAN DEFAULT TRUE,
        packages JSONB DEFAULT '[]'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_parental_controls (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE UNIQUE,
        screen_time_limit VARCHAR(64) DEFAULT '1 Hour',
        strict_content BOOLEAN DEFAULT TRUE,
        restrict_dms BOOLEAN DEFAULT TRUE,
        night_quiet_hours BOOLEAN DEFAULT TRUE,
        pairing_pin VARCHAR(32),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_polls (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        author_name VARCHAR(255),
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        total_votes INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_poll_votes (
        id VARCHAR(64) PRIMARY KEY,
        poll_id VARCHAR(64) REFERENCES social_polls(id) ON DELETE CASCADE,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        option_idx INT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(poll_id, user_id)
      );

      CREATE TABLE IF NOT EXISTS social_audio_spaces (
        id VARCHAR(64) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        topic VARCHAR(128) DEFAULT 'Open Discussion',
        host_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        host_username VARCHAR(128),
        listeners_count INT DEFAULT 1,
        speakers JSONB DEFAULT '[]'::jsonb,
        is_live BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_circles (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(128) DEFAULT 'General',
        creator_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        member_count INT DEFAULT 1,
        members JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_creator_tiers (
        id VARCHAR(64) PRIMARY KEY,
        creator_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        benefits JSONB DEFAULT '[]'::jsonb,
        subscribers_count INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_events (
        id VARCHAR(64) PRIMARY KEY,
        creator_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        event_date VARCHAR(64),
        event_time VARCHAR(64),
        location VARCHAR(255),
        category VARCHAR(128) DEFAULT 'Community',
        rsvp_count INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_coauthor_invitations (
        id VARCHAR(64) PRIMARY KEY,
        sender_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        recipient_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        post_id VARCHAR(64),
        status VARCHAR(32) DEFAULT 'pending', -- 'pending' | 'accepted' | 'declined'
        role VARCHAR(64) DEFAULT 'Co-Author',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_brand_briefs (
        id VARCHAR(64) PRIMARY KEY,
        brand_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        brand_name VARCHAR(255),
        title VARCHAR(255) NOT NULL,
        budget VARCHAR(64),
        description TEXT,
        category VARCHAR(128),
        deadline VARCHAR(64),
        proposals JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_freelance_gigs (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        username VARCHAR(128),
        title VARCHAR(255) NOT NULL,
        category VARCHAR(128) DEFAULT 'Video Editing',
        price NUMERIC(10, 2) NOT NULL,
        delivery_days INT DEFAULT 3,
        description TEXT,
        skills JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_trivia_questions (
        id VARCHAR(64) PRIMARY KEY,
        question TEXT NOT NULL,
        options JSONB NOT NULL,
        correct_index INT NOT NULL,
        category VARCHAR(128) DEFAULT 'General',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_trivia_scores (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE UNIQUE,
        score INT DEFAULT 0,
        streak INT DEFAULT 0,
        best_streak INT DEFAULT 0,
        total_games INT DEFAULT 0,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_secret_chats (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        peer_username VARCHAR(128) NOT NULL,
        ttl INT DEFAULT 300,
        messages JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_voice_notes (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        audio_url TEXT,
        duration_seconds INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_account_verifications (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        legal_name VARCHAR(255) NOT NULL,
        category VARCHAR(128) NOT NULL,
        doc_type VARCHAR(64) NOT NULL,
        doc_number VARCHAR(128) NOT NULL,
        portfolio_url TEXT,
        status VARCHAR(32) DEFAULT 'pending',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS social_account_appeals (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        reason TEXT NOT NULL,
        incident_ref VARCHAR(128),
        status VARCHAR(32) DEFAULT 'In Review',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- ====================================================================
      -- REAL-TIME MESSENGER & WEBRTC CALLING TABLES
      -- ====================================================================
      CREATE TABLE IF NOT EXISTS social_conversations (
        id VARCHAR(64) PRIMARY KEY,
        type VARCHAR(32) DEFAULT 'direct',
        title VARCHAR(255),
        avatar TEXT,
        created_by VARCHAR(64) REFERENCES system_users(id),
        last_message_text TEXT,
        last_message_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_archived BOOLEAN DEFAULT FALSE,
        is_pinned BOOLEAN DEFAULT FALSE,
        disappearing_ttl_seconds INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_social_conversations_type ON social_conversations(type);
      CREATE INDEX IF NOT EXISTS idx_social_conversations_archived ON social_conversations(is_archived);

      CREATE TABLE IF NOT EXISTS social_chat_members (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) REFERENCES social_conversations(id) ON DELETE CASCADE,
        user_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        role VARCHAR(32) DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        is_muted BOOLEAN DEFAULT FALSE,
        is_blocked BOOLEAN DEFAULT FALSE,
        last_read_message_id VARCHAR(64),
        last_read_at TIMESTAMP WITH TIME ZONE,
        UNIQUE(conversation_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_social_chat_members_convo ON social_chat_members(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_social_chat_members_user ON social_chat_members(user_id);

      CREATE TABLE IF NOT EXISTS social_chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) REFERENCES social_conversations(id) ON DELETE CASCADE,
        sender_id VARCHAR(64) REFERENCES system_users(id) ON DELETE CASCADE,
        message_type VARCHAR(32) DEFAULT 'text',
        content TEXT,
        media_url TEXT,
        reply_to_id VARCHAR(64),
        is_edited BOOLEAN DEFAULT FALSE,
        is_unsent BOOLEAN DEFAULT FALSE,
        unsent_at TIMESTAMP WITH TIME ZONE,
        reactions JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(32) DEFAULT 'sent',
        seen_by JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_social_chat_messages_convo ON social_chat_messages(conversation_id);
      CREATE INDEX IF NOT EXISTS idx_social_chat_messages_sender ON social_chat_messages(sender_id);
      CREATE INDEX IF NOT EXISTS idx_social_chat_messages_created ON social_chat_messages(created_at);

      CREATE TABLE IF NOT EXISTS social_chat_call_sessions (
        id VARCHAR(64) PRIMARY KEY,
        conversation_id VARCHAR(64) REFERENCES social_conversations(id) ON DELETE CASCADE,
        caller_id VARCHAR(64) REFERENCES system_users(id),
        receiver_id VARCHAR(64),
        call_type VARCHAR(32) DEFAULT 'video',
        session_key VARCHAR(128) NOT NULL,
        sdp_offer TEXT,
        sdp_answer TEXT,
        ice_candidates JSONB DEFAULT '[]'::jsonb,
        status VARCHAR(32) DEFAULT 'initiating',
        started_at TIMESTAMP WITH TIME ZONE,
        ended_at TIMESTAMP WITH TIME ZONE,
        duration_seconds INT DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_social_calls_caller ON social_chat_call_sessions(caller_id);
      CREATE INDEX IF NOT EXISTS idx_social_calls_receiver ON social_chat_call_sessions(receiver_id);

      CREATE TABLE IF NOT EXISTS social_user_presence (
        user_id VARCHAR(64) PRIMARY KEY REFERENCES system_users(id) ON DELETE CASCADE,
        is_online BOOLEAN DEFAULT FALSE,
        last_active_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        custom_status VARCHAR(128),
        device_info VARCHAR(128)
      );

    `);
    await ensureDiscordSchema(p);
    await ensurePlatformDnsSchema(p);
    await p.query(STATE_SCHEMA_SQL);
    await p.query(signupIdentitySchema);
    await p.query('DELETE FROM system_security_rate_limits WHERE expires_at <= CURRENT_TIMESTAMP');
    console.log('✅ Enterprise PostgreSQL Multi-Domain Schema Verified & Provisioned.');
  } catch (err) {
    console.error('PostgreSQL schema initialization failed:', err);
    throw err;
  }
}

export async function testPgConnection() {
  let client;
  try {
    const p = getPgPool();
    if (!p) return false;
    client = await p.connect();
    const res = await client.query('SELECT NOW() as now, current_database() as db');
    isConnected = true;
    console.log(`🐘 Connected to PostgreSQL Database: ${res.rows[0].db} (${res.rows[0].now})`);
    await initPgSchema();
    return true;
  } catch (err) {
    isConnected = false;
    console.error('PostgreSQL connection or schema initialization failed:', err.message);
    return false;
  } finally {
    client?.release();
  }
}

export function isPgActive() {
  return isConnected;
}

export async function queryPg(sql, params = []) {
  const p = getPgPool();
  if (!p) throw new Error('PostgreSQL pool not available');
  return await p.query(sql, params);
}

export function buildPlatformOrderNumber(now = new Date()) {
  const datePart = new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = randomBytes(3).toString('hex').toUpperCase();
  return `ORD-${datePart}-${randPart}`;
}

/**
 * Safely append an immutable row to platform_billing_orders.
 * Wrapped in try/catch so unit tests without PG or without the table never break.
 */
export async function recordPlatformBillingOrder({
  userId = null,
  tiwiId = null,
  orderType,
  planId = null,
  itemName = null,
  grossAmountUsd = 0,
  cashCreditUsedUsd = 0,
  promoCreditUsedUsd = 0,
  netCashRevenueUsd = 0,
  provider = null,
  currency = 'USD',
  status = 'paid',
  metadata = {},
  orderNumber = null
} = {}) {
  try {
    const p = getPgPool();
    if (!p) return null;
    const id = `ord_${randomUUID()}`;
    const resolvedOrderNumber = orderNumber || buildPlatformOrderNumber();
    const { rows } = await queryPg(
      `INSERT INTO platform_billing_orders
         (id, order_number, user_id, tiwi_id, order_type, plan_id, item_name,
          gross_amount_usd, cash_credit_used_usd, promo_credit_used_usd, net_cash_revenue_usd,
          provider, currency, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
       RETURNING id, order_number`,
      [
        id,
        resolvedOrderNumber,
        userId ? String(userId).slice(0, 64) : null,
        tiwiId ? String(tiwiId).slice(0, 64) : null,
        String(orderType || 'subscription_charge').slice(0, 32),
        planId ? String(planId).slice(0, 64) : null,
        itemName ? String(itemName).slice(0, 500) : null,
        Number(Number(grossAmountUsd || 0).toFixed(2)),
        Number(Number(cashCreditUsedUsd || 0).toFixed(2)),
        Number(Number(promoCreditUsedUsd || 0).toFixed(2)),
        Number(Number(netCashRevenueUsd || 0).toFixed(2)),
        provider ? String(provider).slice(0, 32) : null,
        String(currency || 'USD').slice(0, 8),
        String(status || 'paid').slice(0, 32),
        JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {})
      ]
    );
    return rows[0] ? { id: rows[0].id, orderNumber: rows[0].order_number } : null;
  } catch {
    return null;
  }
}

function getActiveBiometricPgPool() {
  const p = getPgPool();
  if (!p) return null;
  if (isConnected) return p;
  if (p.query?.mock || Object.prototype.hasOwnProperty.call(p, 'query')) return p;
  return null;
}

function normalizeIso2CountryCode(value) {
  if (value === null || value === undefined) return null;
  const code = String(value).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function formatBiometricCredentialRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    deviceName: row.device_name || null,
    deviceModel: row.device_model || null,
    osVersion: row.os_version || null,
    publicKeySpki: row.public_key_spki || null,
    keyFingerprint: row.key_fingerprint || null,
    ridgeSvgMap: row.ridge_svg_map || null,
    signingCertSha256: row.signing_cert_sha256 || null,
    mainCountryCode: row.main_country_code || null,
    lastLoginCountryCode: row.last_login_country_code || null,
    hardwareBacked: row.hardware_backed !== false,
    enrolledAt: row.enrolled_at || null,
    updatedAt: row.updated_at || null,
    lastUsedAt: row.last_used_at || null,
    revokedAt: row.revoked_at || null
  };
}

function formatBiometricLogRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id || null,
    eventType: row.event_type,
    deviceName: row.device_name || null,
    ipAddress: row.ip_address || null,
    countryCode: row.country_code || null,
    userAgent: row.user_agent || null,
    success: row.success !== false,
    details: row.details && typeof row.details === 'object' ? row.details : {},
    createdAt: row.created_at || null
  };
}

/**
 * Upsert a user's mobile biometric credential in PostgreSQL.
 * Gracefully no-ops and returns null when pgPool is not active.
 */
export async function upsertUserBiometricCredential({
  id = null,
  userId,
  deviceName = null,
  deviceModel = null,
  osVersion = null,
  publicKeySpki,
  keyFingerprint = null,
  ridgeSvgMap = null,
  signingCertSha256 = null,
  mainCountryCode = null,
  lastLoginCountryCode = null,
  hardwareBacked = true,
  enrolledAt = null,
  updatedAt = null,
  lastUsedAt = null,
  revokedAt = null
} = {}) {
  try {
    const p = getActiveBiometricPgPool();
    const uid = userId ? String(userId).trim().slice(0, 64) : '';
    const spki = publicKeySpki ? String(publicKeySpki).trim() : '';
    if (!p || !uid || !spki) return null;

    const credId = id ? String(id).trim().slice(0, 128) : `bio_${randomUUID()}`;
    const nowIso = new Date().toISOString();
    const { rows } = await p.query(
      `INSERT INTO user_biometric_credentials (
         id, user_id, device_name, device_model, os_version, public_key_spki,
         key_fingerprint, ridge_svg_map, signing_cert_sha256,
         main_country_code, last_login_country_code, hardware_backed,
         enrolled_at, updated_at, last_used_at, revoked_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9,
         $10, $11, $12,
         COALESCE($13::timestamptz, CURRENT_TIMESTAMP),
         COALESCE($14::timestamptz, CURRENT_TIMESTAMP),
         $15::timestamptz,
         $16::timestamptz
       )
       ON CONFLICT (user_id) DO UPDATE SET
         id = COALESCE(EXCLUDED.id, user_biometric_credentials.id),
         device_name = COALESCE(EXCLUDED.device_name, user_biometric_credentials.device_name),
         device_model = COALESCE(EXCLUDED.device_model, user_biometric_credentials.device_model),
         os_version = COALESCE(EXCLUDED.os_version, user_biometric_credentials.os_version),
         public_key_spki = EXCLUDED.public_key_spki,
         key_fingerprint = COALESCE(EXCLUDED.key_fingerprint, user_biometric_credentials.key_fingerprint),
         ridge_svg_map = COALESCE(EXCLUDED.ridge_svg_map, user_biometric_credentials.ridge_svg_map),
         signing_cert_sha256 = COALESCE(EXCLUDED.signing_cert_sha256, user_biometric_credentials.signing_cert_sha256),
         main_country_code = COALESCE(EXCLUDED.main_country_code, user_biometric_credentials.main_country_code),
         last_login_country_code = COALESCE(EXCLUDED.last_login_country_code, user_biometric_credentials.last_login_country_code),
         hardware_backed = EXCLUDED.hardware_backed,
         updated_at = COALESCE(EXCLUDED.updated_at, CURRENT_TIMESTAMP),
         last_used_at = COALESCE(EXCLUDED.last_used_at, user_biometric_credentials.last_used_at),
         revoked_at = EXCLUDED.revoked_at
       RETURNING *`,
      [
        credId,
        uid,
        deviceName ? String(deviceName).trim().slice(0, 255) : null,
        deviceModel ? String(deviceModel).trim().slice(0, 255) : null,
        osVersion ? String(osVersion).trim().slice(0, 128) : null,
        spki,
        keyFingerprint ? String(keyFingerprint).trim().slice(0, 128) : null,
        ridgeSvgMap ? String(ridgeSvgMap) : null,
        signingCertSha256 ? String(signingCertSha256).trim().slice(0, 128) : null,
        normalizeIso2CountryCode(mainCountryCode),
        normalizeIso2CountryCode(lastLoginCountryCode),
        hardwareBacked !== false,
        enrolledAt || nowIso,
        updatedAt || nowIso,
        lastUsedAt || null,
        revokedAt || null
      ]
    );
    return formatBiometricCredentialRow(rows?.[0]);
  } catch {
    return null;
  }
}

/**
 * Retrieve a user's biometric credential from PostgreSQL.
 * Gracefully no-ops and returns null when pgPool is not active.
 */
export async function getUserBiometricCredential(userId, { includeRevoked = false } = {}) {
  try {
    const p = getActiveBiometricPgPool();
    const uid = userId ? String(userId).trim().slice(0, 64) : '';
    if (!p || !uid) return null;

    const sql = includeRevoked
      ? 'SELECT * FROM user_biometric_credentials WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1'
      : 'SELECT * FROM user_biometric_credentials WHERE user_id = $1 AND revoked_at IS NULL ORDER BY updated_at DESC LIMIT 1';
    const { rows } = await p.query(sql, [uid]);
    return formatBiometricCredentialRow(rows?.[0]);
  } catch {
    return null;
  }
}

/**
 * Revoke a user's active biometric credential in PostgreSQL.
 * Gracefully no-ops and returns null when pgPool is not active.
 */
export async function revokeUserBiometricCredential(userId, { revokedAt = null } = {}) {
  try {
    const p = getActiveBiometricPgPool();
    const uid = userId ? String(userId).trim().slice(0, 64) : '';
    if (!p || !uid) return null;

    const { rows } = await p.query(
      `UPDATE user_biometric_credentials
       SET revoked_at = COALESCE($2::timestamptz, CURRENT_TIMESTAMP),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND revoked_at IS NULL
       RETURNING *`,
      [uid, revokedAt || new Date().toISOString()]
    );
    return formatBiometricCredentialRow(rows?.[0]);
  } catch {
    return null;
  }
}

/**
 * Append a biometric audit log row in PostgreSQL.
 * Gracefully no-ops and returns null when pgPool is not active.
 */
export async function appendUserBiometricLog({
  userId,
  credentialId = null,
  eventType,
  deviceName = null,
  ipAddress = null,
  countryCode = null,
  userAgent = null,
  success = true,
  details = {}
} = {}) {
  try {
    const p = getActiveBiometricPgPool();
    const uid = userId ? String(userId).trim().slice(0, 64) : '';
    const evt = eventType ? String(eventType).trim().slice(0, 64) : '';
    if (!p || !uid || !evt) return null;

    const { rows } = await p.query(
      `INSERT INTO user_biometric_logs (
         user_id, credential_id, event_type, device_name, ip_address,
         country_code, user_agent, success, details
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       RETURNING *`,
      [
        uid,
        credentialId ? String(credentialId).trim().slice(0, 128) : null,
        evt,
        deviceName ? String(deviceName).trim().slice(0, 255) : null,
        ipAddress ? String(ipAddress).trim().slice(0, 128) : null,
        normalizeIso2CountryCode(countryCode),
        userAgent ? String(userAgent).slice(0, 1024) : null,
        success !== false,
        JSON.stringify(details && typeof details === 'object' ? details : {})
      ]
    );
    return formatBiometricLogRow(rows?.[0]);
  } catch {
    return null;
  }
}

/**
 * Fetch recent biometric audit logs for a user from PostgreSQL.
 * Gracefully no-ops and returns [] when pgPool is not active.
 */
export async function getUserBiometricLogs(userId, { limit = 50 } = {}) {
  try {
    const p = getActiveBiometricPgPool();
    const uid = userId ? String(userId).trim().slice(0, 64) : '';
    if (!p || !uid) return [];

    const safeLimit = Math.min(200, Math.max(1, Number.parseInt(limit, 10) || 50));
    const { rows } = await p.query(
      `SELECT * FROM user_biometric_logs
       WHERE user_id = $1
       ORDER BY created_at DESC, id DESC
       LIMIT $2`,
      [uid, safeLimit]
    );
    return Array.isArray(rows) ? rows.map(formatBiometricLogRow) : [];
  } catch {
    return [];
  }
}
