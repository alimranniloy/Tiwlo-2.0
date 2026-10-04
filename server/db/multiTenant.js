import { getPgPool, isPgActive, queryPg } from './postgres.js';
import { PasswordSecurity, SessionSecurity } from '../security/cryptoSecurity.js';

let masterRuntimeData = {
  users: [],
  sessions: [],
  stores: [],
  subscriptions: [],
  system_settings: {
    serverPort: 5000,
    httpsEnabled: true,
    multiTenantEnabled: true,
    version: '3.2.0-enterprise'
  }
};

let tenantStoresRuntimeData = {};

const getPlatformDomain = () => String(process.env.PRIMARY_DOMAIN || 'tiwlo.com')
  .trim().toLowerCase().replace(/^\*\./, '');

const makeStoreSubdomain = (name) => {
  const slug = String(name || 'store').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30) || 'store';
  return `${slug}.${getPlatformDomain()}`;
};

function readDbFile(filePath, defaultData) {
  return defaultData;
}

function writeDbFile(filePath, data) {
  // Persistence via PostgreSQL / in-memory runtime
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
    masterRuntimeData = data;
  },

  // Users
  async getUsers() {
    if (isPgActive()) {
      try {
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
      } catch (e) {
        console.warn('PostgreSQL query fallback to local DB:', e.message);
      }
    }
    return this.getMasterData().users || [];
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

  async updateUser(userId, updates = {}) {
    const clean = String(userId || '').trim().toLowerCase();
    const master = this.getMasterData();
    const idx = (master.users || []).findIndex(
      (u) =>
        (u.id && String(u.id).toLowerCase() === clean) ||
        (u.tiwiId && String(u.tiwiId).toLowerCase() === clean) ||
        (u.storeId && String(u.storeId).toLowerCase() === clean) ||
        (u.email && u.email.toLowerCase() === clean)
    );
    if (idx !== -1) {
      master.users[idx] = {
        ...master.users[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      if (updates.storeName) {
        const storeIdx = (master.stores || []).findIndex(
          (s) => s.ownerId === master.users[idx].id || s.tiwiId === master.users[idx].tiwiId
        );
        if (storeIdx !== -1) {
          master.stores[storeIdx].storeName = updates.storeName;
        }
      }

      this.saveMasterData(master);
    }

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
        }
      } catch (e) {
        console.warn('PostgreSQL update error:', e.message);
      }
    }

    return idx !== -1 ? master.users[idx] : await this.findUserByIdentifier(userId);
  },

  async createUser(userData) {
    const tiwiId = userData.tiwiId || userData.storeId;
    const master = this.getMasterData();
    const isFirstUser = (!master.users || master.users.length === 0);

    if (!userData.email || !userData.email.trim()) {
      throw new Error('A valid email address is required.');
    }
    const normalizedEmail = userData.email.trim().toLowerCase();
    const existingEmailUser = (master.users || []).find(
      (user) => user.email?.trim().toLowerCase() === normalizedEmail
    );
    if (existingEmailUser) {
      throw new Error('That email is already in use. Please sign in or use another email.');
    }
    if (tiwiId && (master.users || []).some((user) => user.tiwiId === tiwiId || user.storeId === tiwiId)) {
      throw new Error('Could not reserve a unique account ID. Please try again.');
    }

    // Cryptographic Password Hashing (scrypt + random salt)
    const passwordHash = (userData.password && userData.password.startsWith('scrypt$'))
      ? userData.password
      : PasswordSecurity.hash(userData.password || 'default123');

    const isAdminEmail = userData.email?.toLowerCase().trim() === 'tiwloltd@gmail.com';
    const assignedRole = isAdminEmail ? 'super_admin' : (userData.role && userData.role !== 'super_admin' ? userData.role : 'owner');

    const newUser = {
      id: userData.id || `usr_${Date.now()}`,
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

    // Sync to PostgreSQL if online
    if (isPgActive()) {
      try {
        await queryPg(`
          INSERT INTO system_users (
            id, tiwi_id, store_name, name, email, password_hash, role, date_of_birth, phone, city, country, address, postal_code, plan_id, plan_name, subdomain, auth_method, email_verified, two_factor_enabled, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          ON CONFLICT (id) DO UPDATE SET
            store_name = EXCLUDED.store_name,
            name = EXCLUDED.name,
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            updated_at = NOW()
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
          newUser.createdAt
        ]);
      } catch (e) {
        console.warn('PostgreSQL user sync warning:', e.message);
      }
    }

    return newUser;
  },

  // Sessions with 384-bit token entropy and a persisted client consistency check.
  async createSession(userId, tiwiId, email, req = null) {
    const sessionToken = SessionSecurity.generateToken();
    const fingerprint = req ? SessionSecurity.createFingerprint(req) : null;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    if (isPgActive()) {
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
    }

    const master = this.getMasterData();
    master.sessions = master.sessions || [];
    master.sessions.push({
      sessionToken,
      userId,
      tiwiId,
      storeId: tiwiId,
      email,
      fingerprint,
      createdAt: new Date().toISOString(),
      expiresAt
    });
    this.saveMasterData(master);

    return { sessionToken, expiresAt };
  },

  async getSession(token, req = null) {
    if (!token) return null;
    const master = this.getMasterData();
    let session = (master.sessions || []).find(s => s.sessionToken === token);

    // If not in runtime memory (e.g. after server reload), restore from PostgreSQL
    if (!session && isPgActive()) {
      try {
        const res = await queryPg('SELECT * FROM system_sessions WHERE session_token = $1 AND expires_at > NOW()', [token]);
        if (res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          session = {
            sessionToken: row.session_token,
            userId: row.user_id,
            tiwiId: row.tiwi_id,
            storeId: row.tiwi_id,
            email: row.email,
            fingerprint: row.device_fingerprint || null,
            expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : new Date(Date.now() + 86400000).toISOString()
          };
          // Cache in runtime memory
          master.sessions = master.sessions || [];
          master.sessions.push(session);
        }
      } catch (e) {}
    }

    if (!session) return null;
    if (new Date(session.expiresAt) < new Date()) return null;

    // Reject sessions presented with a different client User-Agent.
    if (req && session.fingerprint) {
      const isValid = SessionSecurity.validateFingerprint(req, session.fingerprint);
      if (!isValid) {
        console.warn(`[SECURITY] Session client fingerprint mismatch for Tiwi ID: ${session.tiwiId}.`);
        return null;
      }
    }

    const user = await this.findUserByIdentifier(session.userId || session.email);
    return { session, user };
  },

  async deleteSession(token) {
    if (!token) return;
    if (isPgActive()) {
      await queryPg('DELETE FROM system_sessions WHERE session_token = $1 OR token = $1', [token]);
    }
    const master = this.getMasterData();
    master.sessions = (master.sessions || []).filter(s => s.sessionToken !== token);
    this.saveMasterData(master);
  },

  async updatePasswordAndRevokeSessions(userId, passwordHash, exceptToken = null) {
    if (!userId || !passwordHash) throw new Error('User ID and password hash are required.');

    if (isPgActive()) {
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
    } else {
      const updated = await this.updateUser(userId, { password: passwordHash });
      if (!updated) throw new Error('User account not found.');
    }

    const master = this.getMasterData();
    const user = (master.users || []).find((item) => item.id === userId);
    if (user) {
      user.password = passwordHash;
      user.updatedAt = new Date().toISOString();
      this.saveMasterData(master);
    }

    master.sessions = (master.sessions || []).filter(
      (session) =>
        session.userId !== userId ||
        (exceptToken && session.sessionToken === exceptToken)
    );
    this.saveMasterData(master);
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
  getStoreFilePath(tiwiId) {
    if (!tiwiId) throw new Error('Store tiwiId is required');
    const cleanId = String(tiwiId).trim().toLowerCase().replace(/[^a-z0-9]/g, '_');
    return path.join(STORES_STORAGE_DIR, `store_${cleanId}.json`);
  },

  getStoreDb(tiwiId) {
    if (!tiwiId) return null;
    if (!tenantStoresRuntimeData[tiwiId]) {
      tenantStoresRuntimeData[tiwiId] = {
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
    return tenantStoresRuntimeData[tiwiId];
  },

  saveStoreDb(tiwiId, data) {
    tenantStoresRuntimeData[tiwiId] = data;
  },

  // Dynamic Store Provisioning
  async provisionStore(tiwiId, storeName, planId = 'free') {
    if (!tenantStoresRuntimeData[tiwiId]) {
      const initialStoreData = {
        tiwiId,
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
            details: `Isolated database provisioned with Tiwi ID: ${tiwiId}`,
            timestamp: new Date().toISOString()
          }
        ],
        store_settings: {
          storeName,
          tiwiId,
          subdomain: makeStoreSubdomain(storeName),
          currency: 'USD ($)',
          timezone: 'Asia/Dhaka',
          taxRate: 5
        }
      };
      tenantStoresRuntimeData[tiwiId] = initialStoreData;
      console.log(`📦 Provisioned isolated store in memory: ${tiwiId}`);
    }

    // Provision PostgreSQL Schema if connected
    if (isPgActive()) {
      try {
        const schemaName = `store_${tiwiId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
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
