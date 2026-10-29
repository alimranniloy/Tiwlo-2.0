import crypto from 'node:crypto';
import { getPgPool } from '../db/postgres.js';
import { MasterDB } from '../db/multiTenant.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { signupEmailKey } from './signupIdentity.js';

const ENCRYPTION_CONTEXT = Buffer.from('tiwlo-social-oauth-provider-v1');
const PROVIDERS = new Set(['google', 'github']);

export function getSocialStateCookieOptions(req) {
  const host = String(req?.headers?.host || req?.hostname || '')
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
  const cookieDomain = [PLATFORM_CONFIG.primaryDomain, PLATFORM_CONFIG.freeSubdomainDomain]
    .find(domain => host === domain || host.endsWith(`.${domain}`));
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || req?.secure ||
      req?.headers?.['x-forwarded-proto'] === 'https',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 10 * 60 * 1000,
    ...(cookieDomain ? { domain: `.${cookieDomain}` } : {})
  };
}

function getEncryptionKey() {
  const secret = process.env.SECURITY_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('A stable SECURITY_SECRET of at least 32 characters is required for social login settings.');
  }
  return Buffer.from(crypto.hkdfSync(
    'sha256',
    Buffer.from(secret),
    ENCRYPTION_CONTEXT,
    ENCRYPTION_CONTEXT,
    32
  ));
}

export function encryptSocialProviderSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv);
  cipher.setAAD(ENCRYPTION_CONTEXT);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

export function decryptSocialProviderSecret(record) {
  if (!record.secret_ciphertext || !record.encryption_iv || !record.encryption_auth_tag) return '';
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncryptionKey(), record.encryption_iv);
  decipher.setAAD(ENCRYPTION_CONTEXT);
  decipher.setAuthTag(record.encryption_auth_tag);
  return Buffer.concat([
    decipher.update(record.secret_ciphertext),
    decipher.final()
  ]).toString('utf8');
}

export function getSocialCallbackUrl(provider) {
  if (!PROVIDERS.has(provider)) throw new TypeError('Unsupported social login provider.');
  const authHost = PLATFORM_CONFIG.authDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${authHost}/api/auth/${provider}/callback`;
}

export async function getSocialProviderStatuses() {
  const { rows } = await getPgPool().query(
    `SELECT provider, client_id, enabled, secret_ciphertext
     FROM system_oauth_providers WHERE provider IN ('google', 'github')`
  );
  const byProvider = new Map(rows.map(row => [row.provider, row]));
  return Object.fromEntries([...PROVIDERS].map(provider => {
    const row = byProvider.get(provider);
    const configured = Boolean(row?.client_id && row.secret_ciphertext);
    return [provider, {
      enabled: Boolean(row?.enabled && configured),
      configured,
      clientId: row?.client_id || '',
      secretConfigured: Boolean(row?.secret_ciphertext),
      callbackUrl: getSocialCallbackUrl(provider)
    }];
  }));
}

export async function getSocialProviderCredentials(provider) {
  if (!PROVIDERS.has(provider)) throw new TypeError('Unsupported social login provider.');
  const { rows } = await getPgPool().query(
    `SELECT client_id, secret_ciphertext, encryption_iv, encryption_auth_tag, enabled
     FROM system_oauth_providers WHERE provider = $1`,
    [provider]
  );
  const row = rows[0];
  if (!row?.enabled || !row.client_id || !row.secret_ciphertext) return null;
  return { clientId: row.client_id, clientSecret: decryptSocialProviderSecret(row) };
}

export async function saveSocialProviderSettings(provider, { clientId, clientSecret, enabled }) {
  if (!PROVIDERS.has(provider)) throw new TypeError('Unsupported social login provider.');
  const normalizedClientId = typeof clientId === 'string' ? clientId.trim() : '';
  const normalizedSecret = typeof clientSecret === 'string' ? clientSecret.trim() : '';
  if (normalizedClientId.length > 512) throw new TypeError('Provider client ID is too long.');
  if (normalizedSecret.length > 4096) throw new TypeError('Provider client secret is too long.');
  if (typeof enabled !== 'boolean') throw new TypeError('Provider enabled must be true or false.');

  const existing = await getSocialProviderCredentialsForSave(provider);
  const secretChanged = normalizedSecret.length > 0;
  const clientIdChanged = normalizedClientId !== (existing?.clientId || '');
  const clearSecret = !normalizedClientId || (clientIdChanged && !secretChanged);
  if (enabled && (!normalizedClientId || (!secretChanged && (!existing?.secretConfigured || clientIdChanged)))) {
    throw new TypeError('A client ID and matching client secret are required to enable this provider.');
  }
  if (secretChanged && !normalizedClientId) {
    throw new TypeError('Enter the provider client ID before saving its client secret.');
  }
  if (secretChanged && normalizedSecret.length < 8) {
    throw new TypeError('Provider client secret is too short.');
  }
  const encrypted = secretChanged ? encryptSocialProviderSecret(normalizedSecret) : null;

  await getPgPool().query(
    `INSERT INTO system_oauth_providers
       (provider, client_id, secret_ciphertext, encryption_iv, encryption_auth_tag, enabled, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
     ON CONFLICT (provider) DO UPDATE SET
       client_id = EXCLUDED.client_id,
       secret_ciphertext = CASE WHEN $7::boolean THEN NULL ELSE COALESCE(EXCLUDED.secret_ciphertext, system_oauth_providers.secret_ciphertext) END,
       encryption_iv = CASE WHEN $7::boolean THEN NULL ELSE COALESCE(EXCLUDED.encryption_iv, system_oauth_providers.encryption_iv) END,
       encryption_auth_tag = CASE WHEN $7::boolean THEN NULL ELSE COALESCE(EXCLUDED.encryption_auth_tag, system_oauth_providers.encryption_auth_tag) END,
       enabled = EXCLUDED.enabled,
       updated_at = CURRENT_TIMESTAMP`,
    [
      provider,
      normalizedClientId,
      encrypted?.ciphertext || null,
      encrypted?.iv || null,
      encrypted?.authTag || null,
      enabled,
      clearSecret
    ]
  );
}

async function getSocialProviderCredentialsForSave(provider) {
  const { rows } = await getPgPool().query(
    `SELECT client_id, secret_ciphertext
     FROM system_oauth_providers WHERE provider = $1`,
    [provider]
  );
  return rows[0] ? {
    clientId: rows[0].client_id,
    secretConfigured: Boolean(rows[0].secret_ciphertext)
  } : null;
}

function normalizeVerifiedEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? email.trim().toLowerCase()
    : null;
}

function normalizeProviderBirthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value &&
    parsed <= new Date()
    ? value
    : null;
}

export async function findOrCreateSocialUser({
  provider,
  providerUserId,
  email,
  name,
  avatar,
  dateOfBirth,
  address
}) {
  if (!PROVIDERS.has(provider) || typeof providerUserId !== 'string' || !providerUserId.trim()) {
    throw new TypeError('The provider identity is invalid.');
  }
  const normalizedEmail = normalizeVerifiedEmail(email);
  if (!normalizedEmail) throw new TypeError('A verified provider email is required.');
  const normalizedBirthDate = normalizeProviderBirthDate(dateOfBirth);
  const normalizedAddress = typeof address === 'string' ? address.trim().slice(0, 2000) : '';

  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`social-login:${signupEmailKey(normalizedEmail)}`]
    );

    const identityResult = await client.query(
      `SELECT user_id FROM system_social_identities
       WHERE provider = $1 AND provider_user_id = $2`,
      [provider, providerUserId]
    );
    let userId = identityResult.rows[0]?.user_id || null;
    let user = userId ? await MasterDB.findUserByIdentifier(userId) : null;
    if (!user) {
      const accountResult = await client.query(
        `SELECT id FROM system_users
         WHERE tiwlo_signup_email_key(email) = $1
         ORDER BY created_at ASC LIMIT 1`,
        [signupEmailKey(normalizedEmail)]
      );
      userId = accountResult.rows[0]?.id || null;
      if (userId) user = await MasterDB.findUserByIdentifier(userId);
    }

    if (!userId) {
      const safeName = typeof name === 'string' ? name.trim().slice(0, 255) : '';
      const displayName = safeName || normalizedEmail.split('@')[0];
      const avatarUrl = typeof avatar === 'string' && avatar.startsWith('https://') ? avatar : '';
      const id = `usr_${crypto.randomUUID()}`;
      const tiwiId = `TIW-${crypto.randomInt(10000, 1000000)}`;
      const subdomainLabel = displayName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 24) ||
        crypto.randomBytes(5).toString('hex');
      const subdomain = `${subdomainLabel}-${crypto.randomBytes(3).toString('hex')}.${PLATFORM_CONFIG.storeDomain}`;
      await client.query('SAVEPOINT social_user_create');
      try {
        const inserted = await client.query(
          `INSERT INTO system_users
             (id, tiwi_id, store_name, name, email, role, plan_id, plan_name, avatar,
              subdomain, auth_method, email_verified, two_factor_enabled, date_of_birth, address, created_at)
           VALUES ($1, $2, $3, $3, $4, 'owner', 'free', 'Free Starter', $5,
                   $6, $7, TRUE, FALSE, $8, $9, CURRENT_TIMESTAMP)
           ON CONFLICT (email) DO NOTHING
           RETURNING id`,
          [id, tiwiId, displayName, normalizedEmail, avatarUrl, subdomain, provider, normalizedBirthDate, normalizedAddress]
        );
        userId = inserted.rows[0]?.id || null;
        if (userId) {
          user = {
            id: userId,
            tiwiId,
            storeId: tiwiId,
            email: normalizedEmail,
            name: displayName,
            storeName: displayName,
            avatar: avatarUrl,
            dateOfBirth: normalizedBirthDate,
            address: normalizedAddress,
            role: 'owner',
            planId: 'free',
            planName: 'Free Starter',
            subdomain,
            emailVerified: true,
            twoFactorEnabled: false,
            isBanned: false
          };
        }
      } catch (error) {
        await client.query('ROLLBACK TO SAVEPOINT social_user_create');
        const concurrentAccount = await client.query(
          `SELECT id FROM system_users
           WHERE tiwlo_signup_email_key(email) = $1
           ORDER BY created_at ASC LIMIT 1`,
          [signupEmailKey(normalizedEmail)]
        );
        userId = concurrentAccount.rows[0]?.id || null;
        if (userId) user = await MasterDB.findUserByIdentifier(userId);
        if (!userId) throw error;
      }
      await client.query('RELEASE SAVEPOINT social_user_create');
      if (!userId) {
        const concurrentAccount = await client.query(
          `SELECT id FROM system_users
           WHERE tiwlo_signup_email_key(email) = $1
           ORDER BY created_at ASC LIMIT 1`,
          [signupEmailKey(normalizedEmail)]
        );
        userId = concurrentAccount.rows[0]?.id || null;
        if (userId) user = await MasterDB.findUserByIdentifier(userId);
      }
    }

    if (!userId) throw new Error('Could not create or link the Tiwlo account.');
    user = user || await MasterDB.findUserByIdentifier(userId);
    if (!user) throw new Error('Could not resolve the Tiwlo account for this social identity.');
    const avatarUrl = typeof avatar === 'string' && avatar.startsWith('https://') ? avatar : '';
    const shouldSetAvatar = avatarUrl && (
      !user.avatar || user.avatar.startsWith('https://ui-avatars.com/')
    );
    const shouldSetBirthDate = normalizedBirthDate && !user.dateOfBirth;
    const shouldSetAddress = normalizedAddress && !user.address?.trim();
    if (shouldSetAvatar || shouldSetBirthDate || shouldSetAddress) {
      await client.query(
        `UPDATE system_users SET
           avatar = CASE WHEN $2::boolean THEN $3 ELSE avatar END,
           date_of_birth = COALESCE(date_of_birth, $4::date),
           address = CASE WHEN COALESCE(BTRIM(address), '') = '' THEN $5 ELSE address END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id, Boolean(shouldSetAvatar), avatarUrl, normalizedBirthDate, normalizedAddress]
      );
      if (shouldSetAvatar) user.avatar = avatarUrl;
      if (shouldSetBirthDate) user.dateOfBirth = normalizedBirthDate;
      if (shouldSetAddress) user.address = normalizedAddress;
    }
    if (!user.emailVerified) {
      await client.query(
        'UPDATE system_users SET email_verified = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [user.id]
      );
      user.emailVerified = true;
    }

    if (user.isBanned) {
      const error = new Error('This Tiwlo account has been disabled.');
      error.code = 'ACCOUNT_DISABLED';
      throw error;
    }

    const identityWrite = await client.query(
      `INSERT INTO system_social_identities (provider, provider_user_id, user_id, provider_email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, provider_user_id) DO UPDATE
       SET provider_email = EXCLUDED.provider_email
       WHERE system_social_identities.user_id = EXCLUDED.user_id`,
      [provider, providerUserId, user.id, normalizedEmail]
    );
    if (identityWrite.rowCount !== 1) {
      throw new Error('This social identity is already linked to a different Tiwlo account.');
    }
    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
