import pg from 'pg';
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

export async function initPgSchema() {
  try {
    const p = getPgPool();
    if (!p) return;
    
    await p.query(`
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

      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS session_token VARCHAR(128);
      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS device_fingerprint VARCHAR(128);
      ALTER TABLE system_sessions ADD COLUMN IF NOT EXISTS user_agent TEXT;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_token_unique ON system_sessions(session_token);

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
    console.log('✅ Enterprise PostgreSQL Multi-Domain Schema Verified & Provisioned.');
  } catch (err) {
    console.warn('⚠️ PostgreSQL Schema Provision notice:', err.message);
  }
}

export async function testPgConnection() {
  try {
    const p = getPgPool();
    if (!p) return false;
    const client = await p.connect();
    const res = await client.query('SELECT NOW() as now, current_database() as db');
    client.release();
    isConnected = true;
    console.log(`🐘 Connected to PostgreSQL Database: ${res.rows[0].db} (${res.rows[0].now})`);
    await initPgSchema();
    return true;
  } catch (err) {
    isConnected = false;
    return false;
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
