import fsSync from 'node:fs';
import { randomUUID } from 'node:crypto';
import { normalizeSignupEmail, signupEmailKey, duplicateAccountError } from '../security/signupIdentity.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPgPool, isPgActive, queryPg } from './postgres.js';
import { PasswordSecurity, SessionSecurity } from '../security/cryptoSecurity.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { recordSecurityEvent } from './securityPersistence.js';

const DATA_DIR = process.env.TIWLO_DATA_DIR ||
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../data');
const STORES_STORAGE_DIR = path.join(DATA_DIR, 'db', 'stores');
const STORE_REGISTRY_PATH = path.join(STORES_STORAGE_DIR, 'registry.json');
const TENANT_ARRAY_FIELDS = [
  'products',
  'categories',
  'subcategories',
  'customers',
  'suppliers',
  'purchases',
  'sales',
  'inventory_adjustments',
  'activities'
];

function readJsonFile(filePath) {
  try {
    return JSON.parse(fsSync.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    if (error instanceof SyntaxError) {
      throw new Error('Persisted tenant data contains invalid JSON.', { cause: error });
    }
    throw error;
  }
}

function writeJsonFile(filePath, data) {
  fsSync.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fsSync.writeFileSync(temporaryPath, JSON.stringify(data), { encoding: 'utf8', mode: 0o600 });
  fsSync.renameSync(temporaryPath, filePath);
}

function validateTenantStore(store, storeId) {
  if (!store || typeof store !== 'object' || Array.isArray(store) ||
      (store.tiwiId && String(store.tiwiId) !== storeId)) {
    throw new Error('Persisted tenant store has an invalid format or tenant identifier.');
  }
  for (const field of TENANT_ARRAY_FIELDS) {
    if (store[field] !== undefined && !Array.isArray(store[field])) {
      throw new Error('Persisted tenant store contains an invalid collection.');
    }
  }
  if (store.store_settings !== undefined &&
      (!store.store_settings || typeof store.store_settings !== 'object' || Array.isArray(store.store_settings))) {
    throw new Error('Persisted tenant store settings have an invalid format.');
  }
}

function readStoreRegistry() {
  const stores = readJsonFile(STORE_REGISTRY_PATH);
  if (stores === null) return [];
  if (!Array.isArray(stores) || stores.some(store => !store || typeof store !== 'object' || !store.tiwiId)) {
    throw new Error('Persisted store registry has an invalid format.');
  }
  return stores;
}

function persistStoreRegistry(stores) {
  if (!Array.isArray(stores) || stores.some(store => !store || typeof store !== 'object' || !store.tiwiId)) {
    throw new Error('Store registry cannot be persisted because an entry has no tenant identifier.');
  }
  const registry = stores.map(store => ({
    id: store.id,
    tiwiId: store.tiwiId,
    ownerId: store.ownerId || null,
    storeName: store.storeName || 'Store',
    subdomain: store.subdomain || null,
    planId: store.planId || null,
    category: store.category || null,
    currency: store.currency || 'USD ($)',
    status: store.status || 'active',
    createdAt: store.createdAt || null
  }));
  writeJsonFile(STORE_REGISTRY_PATH, registry);
}

let masterRuntimeData = {
  users: [],
  sessions: [],
  stores: readStoreRegistry(),
  subscriptions: []
};

let tenantStoresRuntimeData = {};

const makeStoreSubdomain = (name) => {
  const slug = String(name || 'store').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'store';
  return `${slug}.${PLATFORM_CONFIG.storeDomain}`;
};

function createEmptyTenantStore(tiwiId) {
  return {
    tiwiId,
    storeName: 'Tiwlo Store',
    products: [],
    categories: [],
    subcategories: [],
    customers: [],
    suppliers: [],
    purchases: [],
    sales: [],
    inventory_adjustments: [],
    activities: [],
    store_settings: {
      storeName: 'Tiwlo Store',
      tiwiId,
      currency: 'USD ($)',
      timezone: 'UTC+6 (Asia/Dhaka)'
    }
  };
}

function readLegacyPrimaryStore() {
  const fields = {
    products: 'products.json',
    categories: 'categories.json',
    subcategories: 'subcategories.json',
    customers: 'customers.json',
    suppliers: 'suppliers.json',
    purchases: 'purchases.json',
    sales: 'sales.json',
    inventory_adjustments: 'inventory_adjustments.json',
    activities: 'activities.json',
    store_settings: 'store_settings.json'
  };
  const legacyDirectories = [DATA_DIR, path.join(DATA_DIR, 'migration_backup')];
  let store = createEmptyTenantStore('TIW-PRIMARY');
  let foundLegacyData = false;

  for (const [field, filename] of Object.entries(fields)) {
    const filePath = legacyDirectories
      .map(directory => path.join(directory, filename))
      .find(candidate => fsSync.existsSync(candidate));
    if (!filePath) continue;

    const value = readJsonFile(filePath);
    const isSettings = field === 'store_settings';
    if (isSettings
      ? !value || typeof value !== 'object' || Array.isArray(value)
      : !Array.isArray(value)) {
      throw new Error(`Legacy tenant data file "${filename}" has an invalid format.`);
    }
    store[field] = value;
    foundLegacyData = true;
  }

  if (!foundLegacyData) return null;
  store.store_settings = {
    ...createEmptyTenantStore('TIW-PRIMARY').store_settings,
    ...store.store_settings,
    tiwiId: 'TIW-PRIMARY'
  };
  store.storeName = store.store_settings.storeName || store.storeName;
  return store;
}

function hasLegacyPrimaryStoreData() {
  const legacyFiles = [
    'products.json',
    'categories.json',
    'subcategories.json',
    'customers.json',
    'suppliers.json',
    'purchases.json',
    'sales.json',
    'inventory_adjustments.json',
    'activities.json',
    'store_settings.json'
  ];
  return [DATA_DIR, path.join(DATA_DIR, 'migration_backup')]
    .some(directory => legacyFiles.some(filename => fsSync.existsSync(path.join(directory, filename))));
}

// ====================================================================
// 1. MASTER DATABASE ENGINE
// Manages: system_users, system_sessions, system_stores, subscriptions
// ====================================================================
export const MasterDB = {
  getMasterData() {
    return masterRuntimeData;
  },

  saveMasterData(data) {
    persistStoreRegistry(data.stores || []);
    masterRuntimeData = data;
  },

  async getSystemSettings(defaultSettings = {}) {
    await queryPg(
      `INSERT INTO system_settings (setting_key, settings)
       VALUES ('platform', $1::jsonb)
       ON CONFLICT (setting_key) DO NOTHING`,
      [JSON.stringify(defaultSettings)]
    );
    const result = await queryPg(
      "SELECT settings FROM system_settings WHERE setting_key = 'platform'"
    );
    if (!result.rows[0]) throw new Error('Platform settings row is missing');
    return result.rows[0].settings;
  },

  async saveSystemSettings(settings) {
    const result = await queryPg(
      `INSERT INTO system_settings (setting_key, settings, updated_at)
       VALUES ('platform', $1::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (setting_key) DO UPDATE
       SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP
       RETURNING settings`,
      [JSON.stringify(settings)]
    );
    if (!result.rows[0]) throw new Error('Platform settings could not be saved');
    return result.rows[0].settings;
  },

  // Users
  async getUsers() {
    if (!isPgActive()) throw new Error('PostgreSQL is unavailable; account lookup is disabled.');
    const res = await queryPg('SELECT * FROM system_users ORDER BY created_at DESC');
    return res.rows.map(r => ({
          id: r.id,
          tiwiId: r.tiwi_id,
          storeId: r.tiwi_id,
          storeName: r.store_name,
          email: r.email,
          password: r.password_hash || r.password,
          role: r.role,
          dateOfBirth: r.date_of_birth,
          birthday: r.date_of_birth,
          accountType: r.account_type || (r.role === 'owner' ? 'business' : 'personal'),
          billingDetails: {
            address: r.address,
            city: r.city,
            country: r.country,
            phone: r.phone,
            postalCode: r.postal_code
          },
          phone: r.phone,
          address: r.address,
          planId: r.plan_id,
          planName: r.plan_name,
          subdomain: r.subdomain,
          avatar: r.avatar,
          coverPhoto: r.cover_photo,
          name: r.name || r.store_name,
          isBanned: r.is_banned === true,
          banReason: r.ban_reason || null,
          emailVerified: r.email_verified === true,
          twoFactorEnabled: r.two_factor_enabled === true,
          authMethod: r.auth_method || 'credentials',
          createdAt: r.created_at
    }));
  },

  async findUserByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    const users = await this.getUsers();

    return users.find(u =>
      (u.id && String(u.id).toLowerCase() === clean) ||
      (u.email && String(u.email).toLowerCase() === clean) ||
      (u.tiwiId && String(u.tiwiId).toLowerCase() === clean) ||
      (u.storeId && String(u.storeId).toLowerCase() === clean)
    );
  },

  async isSignupEmailTaken(email, excludeUserId = null) {
    const key = signupEmailKey(email);
    if (!key) return false;
    const result = await queryPg(
      `SELECT 1 FROM system_users
       WHERE tiwlo_signup_email_key(email) = $1
         AND ($2::text IS NULL OR (id <> $2 AND tiwi_id IS DISTINCT FROM $2))
       LIMIT 1`,
      [key, excludeUserId]
    );
    return result.rows.length > 0;
  },

  async updateUser(userId, updates = {}) {
    if (updates.email !== undefined) {
      if (!isPgActive()) throw new Error('PostgreSQL is unavailable; email changes are disabled.');
      const email = normalizeSignupEmail(updates.email);
      if (!email) throw new Error('A valid email address is required.');
      if (await this.isSignupEmailTaken(email, userId)) throw duplicateAccountError();
      updates = { ...updates, email };
    }
    const clean = String(userId || '').trim().toLowerCase();
    const master = this.getMasterData();
    const idx = (master.users || []).findIndex(
      (u) =>
        (u.id && String(u.id).toLowerCase() === clean) ||
        (u.tiwiId && String(u.tiwiId).toLowerCase() === clean) ||
        (u.storeId && String(u.storeId).toLowerCase() === clean) ||
        (u.email && u.email.toLowerCase() === clean)
    );
    const cachedUserBefore = idx !== -1 ? { ...master.users[idx] } : null;
    let updatedStoreIndex = -1;
    let cachedStoreBefore = null;
    if (idx !== -1) {
      master.users[idx] = {
        ...master.users[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (updates.storeName) {
        updatedStoreIndex = (master.stores || []).findIndex(
          (s) => s.ownerId === master.users[idx].id || s.tiwiId === master.users[idx].tiwiId
        );
        if (updatedStoreIndex !== -1) {
          cachedStoreBefore = { ...master.stores[updatedStoreIndex] };
          master.stores[updatedStoreIndex].storeName = updates.storeName;
        }
      }

      this.saveMasterData(master);
    }

    let persistedToPg = false;
    if (isPgActive()) {
      try {
        const fields = [];
        const values = [];
        let valIndex = 1;

        if (updates.storeName) {
          fields.push(`store_name = $${valIndex++}`);
          values.push(updates.storeName);
        }
        if (updates.name) {
          fields.push(`name = $${valIndex++}`);
          values.push(updates.name);
        }
        if (updates.password) {
          fields.push(`password_hash = $${valIndex++}`);
          values.push(updates.password);
        }
        if (updates.avatar) {
          fields.push(`avatar = $${valIndex++}`);
          values.push(updates.avatar);
        }
        if (updates.coverPhoto) {
          fields.push(`cover_photo = $${valIndex++}`);
          values.push(updates.coverPhoto);
        }
        if (updates.emailVerified !== undefined) {
          fields.push(`email_verified = $${valIndex++}`);
          values.push(Boolean(updates.emailVerified));
        }
        if (updates.email !== undefined) {
          fields.push(`email = $${valIndex++}`);
          values.push(String(updates.email).trim().toLowerCase());
        }
        if (updates.role !== undefined) {
          fields.push(`role = $${valIndex++}`);
          values.push(updates.role);
        }
        if (updates.planId !== undefined) {
          fields.push(`plan_id = $${valIndex++}`);
          values.push(updates.planId);
        }
        if (updates.planName !== undefined) {
          fields.push(`plan_name = $${valIndex++}`);
          values.push(updates.planName);
        }
        if (updates.phone !== undefined) {
          fields.push(`phone = $${valIndex++}`);
          values.push(String(updates.phone));
        }
        if (updates.address !== undefined) {
          fields.push(`address = $${valIndex++}`);
          values.push(String(updates.address));
        }
        if (updates.twoFactorEnabled !== undefined) {
          fields.push(`two_factor_enabled = $${valIndex++}`);
          values.push(Boolean(updates.twoFactorEnabled));
        }
        if (updates.isBanned !== undefined) {
          fields.push(`is_banned = $${valIndex++}`);
          values.push(Boolean(updates.isBanned));
        }
        if (updates.banReason !== undefined) {
          fields.push(`ban_reason = $${valIndex++}`);
          values.push(updates.banReason);
        }
        if (fields.length > 0) {
          fields.push(`updated_at = NOW()`);
          values.push(userId);
          await queryPg(
            `UPDATE system_users SET ${fields.join(', ')} WHERE id::text = $${valIndex} OR tiwi_id = $${valIndex} OR LOWER(email) = LOWER($${valIndex})`,
            values
          );
          persistedToPg = true;
        }
      } catch (e) {
        console.error('[PostgreSQL User Update Error]', e.message);
        if (cachedUserBefore) master.users[idx] = cachedUserBefore;
        if (cachedStoreBefore) master.stores[updatedStoreIndex] = cachedStoreBefore;
        if (cachedUserBefore) this.saveMasterData(master);
        throw e;
      }
    }

    if (updates.isBanned === false) {
      await queryPg(
        `UPDATE system_account_security
         SET strikes = 0, cooldown_until = NULL, permanently_disabled = FALSE,
             last_reason = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = (
           SELECT id FROM system_users
           WHERE id::text = $1 OR tiwi_id = $1 OR LOWER(email) = LOWER($1)
           LIMIT 1
         )`,
        [userId]
      );
      await recordSecurityEvent({
        eventType: 'moderation.account_restored',
        severity: 'info',
        userId: idx >= 0 ? master.users[idx].id : userId
      });
    }

    if (persistedToPg) {
      return await this.findUserByIdentifier(updates.email || userId);
    }
    return idx !== -1 ? master.users[idx] : null;
  },

  async createUser(userData) {
    const tiwiId = userData.tiwiId || userData.storeId;
    const master = this.getMasterData();

    const normalizedEmail = normalizeSignupEmail(userData.email);
    if (!normalizedEmail) throw new Error('A valid email address is required.');
    if (await this.isSignupEmailTaken(normalizedEmail)) throw duplicateAccountError();
    if (tiwiId && (master.users || []).some((user) => user.tiwiId === tiwiId || user.storeId === tiwiId)) {
      throw new Error('Could not reserve a unique account ID. Please try again.');
    }

    // Cryptographic Password Hashing (scrypt + random salt)
    const passwordHash = PasswordSecurity.hash(userData.password);

    // Account creation never grants administrative privileges. Administrators
    // must be provisioned explicitly through a trusted administrative process.
    const assignedRole = 'owner';

    const newUser = {
      id: userData.id || `usr_${randomUUID()}`,
      tiwiId,
      storeId: tiwiId,
      storeName: userData.storeName,
      name: userData.name || userData.storeName,
      avatar: userData.avatar || (userData.name ? `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0B57D0&color=fff&size=200&bold=true` : ''),
      coverPhoto: userData.coverPhoto || '',
      email: normalizedEmail,
      password: passwordHash,
      role: assignedRole,
      dateOfBirth: userData.dateOfBirth || userData.birthday || '',
      birthday: userData.birthday || userData.dateOfBirth || '',
      gender: userData.gender || '',
      billingDetails: userData.billingDetails || {
        address: '',
        city: '',
        country: '',
        phone: '',
        postalCode: ''
      },
      planId: userData.planId || 'free',
      planName: userData.planName || 'Free Starter',
      accountType: userData.accountType || 'personal',
      businessName: userData.businessName || '',
      address: userData.address || '',
      phone: userData.phone || '',
      authMethod: userData.authMethod || 'credentials',
      emailVerified: userData.emailVerified || false,
      twoFactorEnabled: userData.twoFactorEnabled || false,
      subdomain: userData.subdomain || makeStoreSubdomain(userData.storeName),
      createdAt: new Date().toISOString()
    };

    // Persist first. A failed insert must never publish a runtime account or
    // provision a tenant. Plain INSERT prevents ID collisions overwriting users.
    await queryPg(`
      WITH created_user AS (INSERT INTO system_users (
        id, tiwi_id, store_name, name, email, password_hash, role, date_of_birth, phone, city, country, address, postal_code, plan_id, plan_name, subdomain, auth_method, email_verified, two_factor_enabled, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING id)
      INSERT INTO system_signup_browsers (key_hash, user_id)
      SELECT $21::text, id FROM created_user WHERE $21::text IS NOT NULL
    `, [
      newUser.id,
      newUser.tiwiId,
      newUser.storeName,
      newUser.name || newUser.storeName,
      newUser.email,
      newUser.password,
      newUser.role,
      newUser.dateOfBirth || null,
      newUser.billingDetails?.phone || newUser.phone || '',
      newUser.billingDetails?.city || '',
      newUser.billingDetails?.country || 'Bangladesh',
      newUser.billingDetails?.address || newUser.address || '',
      newUser.billingDetails?.postalCode || '',
      newUser.planId,
      newUser.planName,
      newUser.subdomain,
      newUser.authMethod || 'credentials',
      newUser.emailVerified || false,
      newUser.twoFactorEnabled || false,
      newUser.createdAt,
      userData.signupBrowserKey || null
    ]);

    master.users = master.users || [];
    master.users.push(newUser);

    // Only register store in master stores directory if accountType is 'business'
    if (newUser.accountType === 'business') {
      master.stores = master.stores || [];
      master.stores.push({
        id: `store_${Date.now()}`,
        tiwiId,
        storeName: newUser.storeName || newUser.businessName || 'Business Store',
        subdomain: newUser.subdomain,
        ownerId: newUser.id,
        planId: newUser.planId,
        dbSchema: `store_${tiwiId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        status: 'active',
        createdAt: newUser.createdAt
      });
    }

    this.saveMasterData(master);

    // Provision dedicated isolated database / schema only for business accounts
    if (newUser.accountType === 'business') {
      await TenantDB.provisionStore(tiwiId, newUser.storeName || newUser.businessName || 'Business Store', newUser.planId);
    }
    return newUser;
  },

  // Sessions with 384-bit token entropy and a persisted client consistency check.
  async createSession(userId, tiwiId, email, req = null) {
    if (!isPgActive()) throw new Error('PostgreSQL is unavailable; sessions cannot be created.');
    await queryPg('DELETE FROM system_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
    const sessionToken = SessionSecurity.generateToken();
    const fingerprint = req ? SessionSecurity.createFingerprint(req) : null;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await queryPg(`
        INSERT INTO system_sessions
          (token, session_token, user_id, tiwi_id, email, ip, user_agent, device_fingerprint, expires_at)
        VALUES ($1, $1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (session_token) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          tiwi_id = EXCLUDED.tiwi_id,
          email = EXCLUDED.email,
          ip = EXCLUDED.ip,
          user_agent = EXCLUDED.user_agent,
          device_fingerprint = EXCLUDED.device_fingerprint,
          expires_at = EXCLUDED.expires_at
    `, [
        sessionToken,
        userId,
        tiwiId,
        email,
        req?.ip || null,
        req?.headers?.['user-agent'] || null,
        fingerprint,
        expiresAt
    ]);
    try {
        await recordSecurityEvent({
          eventType: 'auth.session_created',
          severity: 'info',
          userId,
          subject: email,
          ip: req?.ip,
          userAgent: req?.get?.('user-agent') || req?.headers?.['user-agent']
        });
    } catch (error) {
        await queryPg('DELETE FROM system_sessions WHERE session_token = $1', [sessionToken]);
        throw error;
    }

    return { sessionToken, expiresAt };
  },

  async getSession(token, req = null) {
    if (!token) return null;
    if (!isPgActive()) throw new Error('PostgreSQL is unavailable; session validation is disabled.');
    const res = await queryPg(
      'SELECT * FROM system_sessions WHERE session_token = $1 AND expires_at > NOW()',
      [token]
    );
    const row = res.rows[0];
    const session = row ? {
      sessionToken: row.session_token,
      userId: row.user_id,
      tiwiId: row.tiwi_id,
      storeId: row.tiwi_id,
      email: row.email,
      fingerprint: row.device_fingerprint || null,
      expiresAt: row.expires_at.toISOString()
    } : null;
    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) return null;

    // Reject sessions presented with a different client User-Agent.
    if (req && session.fingerprint) {
      const isValid = SessionSecurity.validateFingerprint(req, session.fingerprint);
      if (!isValid) {
        await recordSecurityEvent({
          eventType: 'auth.session_fingerprint_mismatch',
          severity: 'warning',
          userId: session.userId,
          ip: req.ip,
          userAgent: req.get?.('user-agent')
        });
        return null;
      }
    }

    const user = await this.findUserByIdentifier(session.userId || session.email);
    return { session, user };
  },

  async deleteSession(token) {
    if (!token) return;
    if (!isPgActive()) throw new Error('PostgreSQL is unavailable; session revocation cannot be completed.');
    const { rows } = await queryPg(
      `DELETE FROM system_sessions
       WHERE session_token = $1 OR token = $1
       RETURNING user_id, email`,
      [token]
    );
    if (rows[0]) {
      await recordSecurityEvent({
        eventType: 'auth.session_revoked',
        userId: rows[0].user_id,
        subject: rows[0].email
      });
    }
  },

  async updatePasswordAndRevokeSessions(userId, passwordHash, exceptToken = null) {
    if (!userId || !passwordHash) throw new Error('User ID and password hash are required.');
    if (!isPgActive()) throw new Error('PostgreSQL is unavailable; password reset cannot be completed.');

    const pool = getPgPool();
    if (!pool) throw new Error('PostgreSQL pool is not available.');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const updated = await client.query(
        'UPDATE system_users SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
        [passwordHash, userId]
      );
      if (!updated.rowCount) throw new Error('User account not found.');
      await client.query(`
        DELETE FROM system_sessions
        WHERE user_id = $1
          AND ($2::VARCHAR IS NULL OR COALESCE(session_token, token) <> $2)
      `, [userId, exceptToken]);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Subscriptions
  async getSubscription(tiwiId) {
    const master = this.getMasterData();
    const sub = (master.subscriptions || []).find(s => s.tiwiId === tiwiId);
    return sub || {
      planId: 'free',
      planName: 'Free Starter',
      price: '$0',
      billingCycle: 'forever',
      productLimit: 50,
      warehouseLimit: 1,
      hasCustomDomain: false,
      tiwiId
    };
  },

  async updateSubscription(tiwiId, planData) {
    const master = this.getMasterData();
    master.subscriptions = master.subscriptions || [];
    const index = master.subscriptions.findIndex(s => s.tiwiId === tiwiId);
    const updated = {
      tiwiId,
      ...planData,
      updatedAt: new Date().toISOString()
    };
    if (index >= 0) {
      master.subscriptions[index] = updated;
    } else {
      master.subscriptions.push(updated);
    }
    this.saveMasterData(master);
    return updated;
  },

  // Multi-Store Directory Management ("My Online Store") - Strictly Isolated per User
  async getUserStores(userIdOrEmail) {
    const master = this.getMasterData();
    const stores = master.stores || [];
    if (!userIdOrEmail) return [];
    const clean = userIdOrEmail.toString().trim().toLowerCase();
    const user = (master.users || []).find(u =>
      u.id === userIdOrEmail ||
      (u.email && u.email.toLowerCase() === clean) ||
      (u.tiwiId && u.tiwiId.toLowerCase() === clean)
    );
    const targetUserId = user ? user.id : userIdOrEmail;
    const userTiwiId = user ? user.tiwiId : null;

    // Strict security isolation: only return stores owned by this user
    return stores.filter(s =>
      s.ownerId === targetUserId ||
      (userTiwiId && s.tiwiId === userTiwiId)
    );
  },

  async createStoreForUser({
    userId,
    storeName,
    subdomain,
    planId = 'free',
    category = 'General Retail',
    currency = 'USD ($)',
    billingDetails = {}
  }) {
    if (!storeName || !storeName.trim()) {
      throw new Error('Store name is required');
    }
    const master = this.getMasterData();
    master.stores = master.stores || [];

    const clean = userId.toString().trim().toLowerCase();
    const user = (master.users || []).find(u =>
      u.id === userId ||
      (u.email && u.email.toLowerCase() === clean) ||
      (u.tiwiId && u.tiwiId.toLowerCase() === clean)
    );
    const ownerId = user ? user.id : userId;

    // Calculate next TIW-XXXXX sequence
    const existingNums = master.stores.map(s => {
      const m = (s.tiwiId || '').match(/TIW-(\d+)/);
      return m ? parseInt(m[1], 10) : 10000;
    });
    const nextSeq = Math.max(10001, ...existingNums) + 1;
    const newTiwiId = `TIW-${nextSeq}`;

    const cleanSubdomain = subdomain?.trim().toLowerCase() || makeStoreSubdomain(storeName);
    if (!cleanSubdomain.endsWith(`.${getPlatformDomain()}`)) {
      throw new Error(`Store subdomain must use .${getPlatformDomain()}`);
    }
    if ((master.stores || []).some((store) => store.subdomain?.toLowerCase() === cleanSubdomain)) {
      throw new Error('That store subdomain is already in use');
    }
    const newStore = {
      id: `store_${Date.now()}`,
      tiwiId: newTiwiId,
      storeName: storeName.trim(),
      subdomain: cleanSubdomain,
      ownerId,
      planId,
      category: category || 'General Retail',
      currency: currency || 'USD ($)',
      billingDetails: {
        address: billingDetails?.address || '',
        city: billingDetails?.city || 'Dhaka',
        country: billingDetails?.country || 'Bangladesh',
        phone: billingDetails?.phone || '',
        postalCode: billingDetails?.postalCode || ''
      },
      dbSchema: `store_${newTiwiId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
      status: 'active',
      createdAt: new Date().toISOString()
    };

    master.stores.push(newStore);
    this.saveMasterData(master);

    // Provision isolated tenant database for this store
    await TenantDB.provisionStore(newTiwiId, newStore.storeName, planId);

    return newStore;
  }
};

// ====================================================================
// 2. ISOLATED TENANT STORE DATABASE ENGINE
// Each store receives its own dedicated database/schema: store_<tiwiId>
// ====================================================================
export const TenantDB = {
  getAllStoreData() {
    const registeredStores = MasterDB.getMasterData().stores || [];
    const storesById = new Map();
    for (const store of registeredStores) {
      const id = String(store.tiwiId || store.id || '');
      if (!id) continue;
      if (!tenantStoresRuntimeData[id]) this.getStoreDb(id);
      storesById.set(id, {
        tiwiId: id,
        storeId: id,
        ownerId: store.ownerId || null,
        storeName: store.storeName || 'Store',
        planId: store.planId || null,
        createdAt: store.createdAt || null,
        store_settings: { storeName: store.storeName, subdomain: store.subdomain, currency: store.currency }
      });
    }
    const primaryStorePath = this.getStoreFilePath('TIW-PRIMARY');
    if (!storesById.has('TIW-PRIMARY') &&
        (fsSync.existsSync(primaryStorePath) || hasLegacyPrimaryStoreData())) {
      const primaryStore = this.getStoreDb('TIW-PRIMARY');
      storesById.set('TIW-PRIMARY', {
        tiwiId: 'TIW-PRIMARY',
        storeId: 'TIW-PRIMARY',
        ownerId: null,
        storeName: primaryStore.storeName || 'Tiwlo Main Store',
        store_settings: primaryStore.store_settings,
        createdAt: primaryStore.createdAt || null
      });
    }
    for (const [id, store] of Object.entries(tenantStoresRuntimeData)) {
      storesById.set(String(store.tiwiId || id), {
        ...(storesById.get(String(store.tiwiId || id)) || {}),
        ...store,
        ownerId: store.ownerId || storesById.get(String(store.tiwiId || id))?.ownerId || null
      });
    }
    return [...storesById.values()];
  },

  getStoreFilePath(tiwiId) {
    const storeId = String(tiwiId || '').trim();
    if (!storeId) throw new Error('Store tiwiId is required');
    const cleanId = storeId.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return path.join(STORES_STORAGE_DIR, `store_${cleanId}.json`);
  },

  getStoreDb(tiwiId) {
    if (!tiwiId) return null;
    const storeId = String(tiwiId).trim();
    if (!storeId) throw new Error('Store tiwiId is required');
    if (!tenantStoresRuntimeData[storeId]) {
      const storePath = this.getStoreFilePath(storeId);
      const hasPersistedStore = fsSync.existsSync(storePath);
      const persistedStore = hasPersistedStore ? readJsonFile(storePath) : null;
      if (hasPersistedStore) validateTenantStore(persistedStore, storeId);
      const initialStore = hasPersistedStore
        ? persistedStore
        : storeId === 'TIW-PRIMARY' ? readLegacyPrimaryStore() : null;
      if (initialStore !== null) {
        validateTenantStore(initialStore, storeId);
        const emptyStore = createEmptyTenantStore(storeId);
        tenantStoresRuntimeData[storeId] = {
          ...emptyStore,
          ...initialStore,
          tiwiId: storeId,
          store_settings: {
            ...emptyStore.store_settings,
            ...(initialStore.store_settings || {}),
            tiwiId: storeId
          }
        };
        if (!persistedStore) this.saveStoreDb(storeId, tenantStoresRuntimeData[storeId]);
      } else {
        tenantStoresRuntimeData[storeId] = createEmptyTenantStore(storeId);
      }
    }
    return tenantStoresRuntimeData[storeId];
  },

  saveStoreDb(tiwiId, data) {
    const storeId = String(tiwiId || '').trim();
    if (!storeId) {
      throw new TypeError('A valid tenant identifier and store data object are required.');
    }
    validateTenantStore(data, storeId);
    if (!data.tiwiId) data.tiwiId = storeId;
    const store = data;
    writeJsonFile(this.getStoreFilePath(storeId), store);
    tenantStoresRuntimeData[storeId] = store;
  },

  // Dynamic Store Provisioning
  async provisionStore(tiwiId, storeName, planId = 'free') {
    const storeId = String(tiwiId || '').trim();
    if (!storeId) throw new TypeError('Store tiwiId is required');
    if (!tenantStoresRuntimeData[storeId] && fsSync.existsSync(this.getStoreFilePath(storeId))) {
      this.getStoreDb(storeId);
    }
    if (!tenantStoresRuntimeData[storeId]) {
      const initialStoreData = {
        tiwiId: storeId,
        storeName,
        planId,
        createdAt: new Date().toISOString(),
        products: [],
        categories: [],
        subcategories: [],
        customers: [],
        suppliers: [],
        purchases: [],
        sales: [],
        inventory_adjustments: [],
        activities: [
          {
            id: `act_${Date.now()}`,
            type: 'auth',
            action: `Store "${storeName}" Created`,
            details: `Isolated database provisioned with Tiwi ID: ${storeId}`,
            timestamp: new Date().toISOString()
          }
        ],
        store_settings: {
          storeName,
          tiwiId: storeId,
          subdomain: makeStoreSubdomain(storeName),
          currency: 'USD ($)',
          timezone: 'Asia/Dhaka',
          taxRate: 5
        }
      };
      this.saveStoreDb(storeId, initialStoreData);
      console.log(`📦 Provisioned tenant store: ${tiwiId}`);
    }

    // Provision PostgreSQL Schema if connected
    if (isPgActive()) {
      try {
        const schemaName = `store_${storeId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
        await queryPg(`SELECT provision_store_schema($1)`, [schemaName]);
        console.log(`🐘 Provisioned PostgreSQL schema: ${schemaName}`);
      } catch (e) {
        console.warn('PostgreSQL schema provisioning error:', e.message);
      }
    }
  },

  // Products
  async getProducts(tiwiId) {
    const store = this.getStoreDb(tiwiId);
    return store.products || [];
  },

  async getProductById(id, tiwiId) {
    const products = await this.getProducts(tiwiId);
    return products.find(p => p.id === id);
  },

  async saveProducts(tiwiId, products) {
    const store = this.getStoreDb(tiwiId);
    store.products = products;
    this.saveStoreDb(tiwiId, store);
  },

  async addProduct(tiwiId, productData) {
    const store = this.getStoreDb(tiwiId);
    const newProduct = {
      id: productData.id || `prod_${Date.now()}`,
      name: productData.name,
      sku: productData.sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
      category: productData.category || 'General',
      subCategory: productData.subCategory || '',
      price: parseFloat(productData.price) || 0,
      costPrice: parseFloat(productData.costPrice) || 0,
      stock: parseInt(productData.stock) || 0,
      minStock: parseInt(productData.minStock) || 20,
      unit: productData.unit || 'Pcs',
      status: (parseInt(productData.stock) || 0) === 0 ? 'Out of Stock' : ((parseInt(productData.stock) || 0) < 20 ? 'Low Stock' : 'In Stock'),
      image: productData.image || '/default-product.svg',
      supplier: productData.supplier || 'Global Tech Ltd',
      warehouse: productData.warehouse || 'Main Warehouse',
      barcode: productData.barcode || `880${Date.now().toString().slice(-9)}`,
      description: productData.description || '',
      isNew: productData.isNew ?? true,
      badge: productData.badge || 'New Arrival',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    store.products.unshift(newProduct);
    this.saveStoreDb(tiwiId, store);
    await this.logActivity(tiwiId, 'product', `New product added: ${newProduct.name}`, `SKU: ${newProduct.sku} • Stock: ${newProduct.stock}`);
    return newProduct;
  },

  async updateProduct(tiwiId, id, updateData) {
    const store = this.getStoreDb(tiwiId);
    const index = store.products.findIndex(p => p.id === id);
    if (index === -1) return null;

    const existing = store.products[index];
    const updated = {
      ...existing,
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    if (updateData.stock !== undefined) {
      const stock = parseInt(updateData.stock) || 0;
      updated.stock = stock;
      const min = updated.minStock || 20;
      updated.status = stock === 0 ? 'Out of Stock' : (stock < min ? 'Low Stock' : 'In Stock');
    }

    store.products[index] = updated;
    this.saveStoreDb(tiwiId, store);
    await this.logActivity(tiwiId, 'product', `Product updated: ${updated.name}`, `SKU: ${updated.sku} • Price: $${updated.price}`);
    return updated;
  },

  async deleteProduct(tiwiId, id) {
    const store = this.getStoreDb(tiwiId);
    const index = store.products.findIndex(p => p.id === id);
    if (index === -1) return null;
    const [deleted] = store.products.splice(index, 1);
    this.saveStoreDb(tiwiId, store);
    await this.logActivity(tiwiId, 'alert', `Product deleted: ${deleted.name}`, `SKU: ${deleted.sku}`);
    return deleted;
  },

  // Categories & Subcategories
  async getCategories(tiwiId) {
    return this.getStoreDb(tiwiId).categories || [];
  },

  async saveCategories(tiwiId, categories) {
    const store = this.getStoreDb(tiwiId);
    store.categories = categories;
    this.saveStoreDb(tiwiId, store);
  },

  async getSubcategories(tiwiId) {
    return this.getStoreDb(tiwiId).subcategories || [];
  },

  async saveSubcategories(tiwiId, subcategories) {
    const store = this.getStoreDb(tiwiId);
    store.subcategories = subcategories;
    this.saveStoreDb(tiwiId, store);
  },

  // Customers & Suppliers
  async getCustomers(tiwiId) {
    return this.getStoreDb(tiwiId).customers || [];
  },

  async saveCustomers(tiwiId, customers) {
    const store = this.getStoreDb(tiwiId);
    store.customers = customers;
    this.saveStoreDb(tiwiId, store);
  },

  async getSuppliers(tiwiId) {
    return this.getStoreDb(tiwiId).suppliers || [];
  },

  async saveSuppliers(tiwiId, suppliers) {
    const store = this.getStoreDb(tiwiId);
    store.suppliers = suppliers;
    this.saveStoreDb(tiwiId, store);
  },

  // Purchases & Sales
  async getPurchases(tiwiId) {
    return this.getStoreDb(tiwiId).purchases || [];
  },

  async addPurchase(tiwiId, purchaseData) {
    const store = this.getStoreDb(tiwiId);
    const newPurchase = {
      id: `po-${Date.now()}`,
      orderNumber: purchaseData.orderNumber || `PO-${Math.floor(10000 + Math.random() * 90000)}`,
      supplier: purchaseData.supplier || 'Unknown Supplier',
      productId: purchaseData.productId || null,
      productName: purchaseData.productName || 'Stock Purchase',
      sku: purchaseData.sku || '',
      quantity: parseInt(purchaseData.quantity) || 1,
      unitCost: parseFloat(purchaseData.unitCost) || 0,
      totalCost: (parseInt(purchaseData.quantity) || 1) * (parseFloat(purchaseData.unitCost) || 0),
      status: purchaseData.status || 'Received',
      date: new Date().toISOString(),
      notes: purchaseData.notes || ''
    };

    store.purchases = store.purchases || [];
    store.purchases.unshift(newPurchase);

    // Increase product stock if product ID matched
    if (newPurchase.productId) {
      const prod = store.products.find(p => p.id === newPurchase.productId);
      if (prod) {
        prod.stock = (prod.stock || 0) + newPurchase.quantity;
        const min = prod.minStock || 20;
        prod.status = prod.stock === 0 ? 'Out of Stock' : (prod.stock < min ? 'Low Stock' : 'In Stock');
      }
    }

    this.saveStoreDb(tiwiId, store);
    await this.logActivity(tiwiId, 'purchase', `Purchase Order Restocked: ${newPurchase.orderNumber}`, `${newPurchase.productName} (+${newPurchase.quantity} units)`);
    return newPurchase;
  },

  async getSales(tiwiId) {
    return this.getStoreDb(tiwiId).sales || [];
  },

  async addSale(tiwiId, saleData) {
    const store = this.getStoreDb(tiwiId);
    const invoiceNumber = saleData.invoiceNumber || `INV-${Date.now().toString().slice(-6)}`;
    const items = saleData.items || [];

    // Deduct stock for each item sold
    items.forEach(item => {
      const prod = store.products.find(p => p.id === item.id || p.id === item.productId);
      if (prod) {
        prod.stock = Math.max(0, (prod.stock || 0) - (parseInt(item.quantity) || 1));
        const min = prod.minStock || 20;
        prod.status = prod.stock === 0 ? 'Out of Stock' : (prod.stock < min ? 'Low Stock' : 'In Stock');
      }
    });

    const newSale = {
      id: `sale-${Date.now()}`,
      invoiceNumber,
      customerName: saleData.customerName || 'Walk-in Customer',
      customerPhone: saleData.customerPhone || '',
      items,
      subtotal: parseFloat(saleData.subtotal) || 0,
      discount: parseFloat(saleData.discount) || 0,
      tax: parseFloat(saleData.tax) || 0,
      totalAmount: parseFloat(saleData.totalAmount) || 0,
      paymentMethod: saleData.paymentMethod || 'Cash',
      paymentStatus: 'Paid',
      date: new Date().toISOString()
    };

    store.sales = store.sales || [];
    store.sales.unshift(newSale);
    this.saveStoreDb(tiwiId, store);
    await this.logActivity(tiwiId, 'sale', `Sale Completed: ${invoiceNumber}`, `${newSale.customerName} • Total: $${newSale.totalAmount}`);
    return newSale;
  },

  // Adjustments & Activities
  async getAdjustments(tiwiId) {
    return this.getStoreDb(tiwiId).inventory_adjustments || [];
  },

  async saveAdjustments(tiwiId, adjustments) {
    const store = this.getStoreDb(tiwiId);
    store.inventory_adjustments = adjustments;
    this.saveStoreDb(tiwiId, store);
  },

  async getActivities(tiwiId) {
    return this.getStoreDb(tiwiId).activities || [];
  },

  async logActivity(tiwiId, type, action, details) {
    const store = this.getStoreDb(tiwiId);
    const newActivity = {
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      action,
      details,
      timestamp: new Date().toISOString()
    };
    store.activities = store.activities || [];
    store.activities.unshift(newActivity);
    if (store.activities.length > 100) store.activities = store.activities.slice(0, 100);
    this.saveStoreDb(tiwiId, store);
    return newActivity;
  },

  // Store Settings
  async getStoreSettings(tiwiId) {
    const store = this.getStoreDb(tiwiId);
    return store.store_settings || {
      storeName: store.storeName || 'Tiwlo Main Store',
      tiwiId,
      currency: 'USD ($)',
      timezone: 'Asia/Dhaka'
    };
  },

  async updateStoreSettings(tiwiId, settings) {
    const store = this.getStoreDb(tiwiId);
    store.store_settings = {
      ...store.store_settings,
      ...settings,
      tiwiId,
      updatedAt: new Date().toISOString()
    };
    if (settings.storeName) store.storeName = settings.storeName;
    this.saveStoreDb(tiwiId, store);
    return store.store_settings;
  }
};
