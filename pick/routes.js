import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { MasterDB } from '../server/db/multiTenant.js';
import { SupportDB } from '../server/db/supportDb.js';
import { getPgPool, queryPg } from '../server/db/postgres.js';
import { getGoogleMapsApiKey } from '../server/db/googleMapsSettings.js';
import {
  reverseGeocodeAddress,
  isValidLiveLocation,
  verifyGoogleAddress
} from '../server/db/addressVerification.js';
import { PLATFORM_CONFIG } from '../server/config/platformConfig.js';
import adminRoutes from './adminRoutes.js';
import { findCoverageZone } from './coverage.js';
import { getPickGroceryDeliveryFee, parseGroceryDeliveryFee } from './pricing.js';
import { securityLimiters } from '../server/plugins/security/index.js';
import {
  getPickPaymentGateway,
  registerPickPaymentRoutes,
  startPickHostedPayment
} from './payments.js';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const express = require('express');
export const PICK_MOBILE_CALLBACK = 'pick://auth/callback';
const router = express.Router();
const PARCEL_CATEGORIES = {
  docs: { en: 'Documents & files', bn: 'কাগজপত্র ও ফাইল' },
  gadgets: { en: 'Electronics', bn: 'ইলেকট্রনিক্স' },
  clothes: { en: 'Clothes & gifts', bn: 'পোশাক ও উপহার' },
  fragile: { en: 'Fragile items', bn: 'ভঙ্গুর সামগ্রী' },
  box: { en: 'Box or carton', bn: 'কার্টন ও বক্স' }
};

export function isValidPickCodeChallenge(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function areValidParcelPins(sender, recipient) {
  return isValidLiveLocation({ ...sender, accuracy: 0 }) &&
    isValidLiveLocation({ ...recipient, accuracy: 0 });
}

export function hashPickCodeVerifier(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(value)) {
    throw new TypeError('Invalid sign-in verifier.');
  }
  return crypto.createHash('sha256').update(value).digest('base64url');
}

export function createPickCallbackUrl({ code, state }) {
  const callback = new URL(PICK_MOBILE_CALLBACK);
  callback.searchParams.set('code', code);
  callback.searchParams.set('state', state);
  return callback.toString();
}

export async function createPickMobileHandoff({
  userId,
  codeChallenge,
  state,
  query = queryPg
}) {
  if (!userId || !isValidPickCodeChallenge(codeChallenge) ||
      typeof state !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(state)) {
    throw new TypeError('Invalid PICK sign-in handoff.');
  }
  const code = crypto.randomBytes(32).toString('base64url');
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  await query(
    `INSERT INTO pick.mobile_sso_handoffs
       (code_hash, tiwlo_user_id, code_challenge, expires_at)
     VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '90 seconds')`,
    [codeHash, userId, codeChallenge]
  );
  return createPickCallbackUrl({ code, state });
}

export async function createPickAppealSession(userId) {
  const user = await MasterDB.findUserByIdentifier(userId);
  if (!user?.isBanned) throw new Error('An account review session can only be issued to a disabled account.');

  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await queryPg('DELETE FROM pick.account_appeal_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
  await queryPg(
    `INSERT INTO pick.account_appeal_sessions (token_hash, tiwlo_user_id, expires_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 days')`,
    [tokenHash, user.id]
  );
  return token;
}

function getSessionToken(req) {
  const authorization = req.headers.authorization;
  return (authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '') ||
    req.cookies?.tiwlo_host_session ||
    req.headers['x-session-token'] ||
    '';
}

async function getTiwloSession(req) {
  const token = getSessionToken(req);
  return token ? MasterDB.getSession(token, req) : null;
}

export function getPickMobileLoginUrl({ codeChallenge, state, mode }) {
  const authOrigin = PLATFORM_CONFIG.authDomain.startsWith('http')
    ? PLATFORM_CONFIG.authDomain
    : `https://${PLATFORM_CONFIG.authDomain}`;
  const loginUrl = new URL(mode === 'signup' ? '/create-account' : '/login', authOrigin);
  loginUrl.searchParams.set('return_to', PICK_MOBILE_CALLBACK);
  loginUrl.searchParams.set('sso_login', '1');
  loginUrl.searchParams.set('pick_code_challenge', codeChallenge);
  loginUrl.searchParams.set('pick_state', state);
  loginUrl.searchParams.set('pick_account', '1');
  return loginUrl.toString();
}

async function ensurePickUser(user) {
  const registrationSource = user.authMethod === 'pick_credentials' ? 'pick_app' : 'tiwlo';
  await queryPg(
    `INSERT INTO pick.users (tiwlo_user_id, registration_source)
     VALUES ($1, $2)
     ON CONFLICT (tiwlo_user_id) DO NOTHING`,
    [user.id, registrationSource]
  );
  await queryPg(
    `INSERT INTO pick.profiles (tiwlo_user_id, display_name, phone, delivery_address)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tiwlo_user_id) DO NOTHING`,
    [
      user.id,
      user.name || user.storeName || '',
      user.phone || '',
      user.address || user.billingDetails?.address || ''
    ]
  );
}

function serializeUser(user, profile) {
  return {
    id: user.id,
    tiwiId: user.tiwiId || user.storeId || '',
    name: profile?.display_name || user.name || user.storeName || '',
    email: user.email || '',
    phone: profile?.phone || user.phone || '',
    avatar: user.avatar || null,
    deliveryAddress: profile?.delivery_address || user.address || user.billingDetails?.address || '',
    deliveryAddressVerified: user.addressVerified === true,
    deliveryLatitude: profile?.delivery_latitude ?? null,
    deliveryLongitude: profile?.delivery_longitude ?? null,
    deliveryArea: profile?.delivery_area || '',
    deliveryPostalCode: profile?.delivery_postal_code || '',
    deliveryPlusCode: profile?.delivery_plus_code || '',
    isBanned: Boolean(user.isBanned),
    banReason: user.banReason || ''
  };
}

async function requireUser(req, res, next) {
  try {
    const session = await getTiwloSession(req);
    if (!session?.user) return res.status(401).json({ error: 'Tiwlo sign-in required.' });
    if (session.user.isBanned) {
      const profile = await queryPg(
        'SELECT * FROM pick.profiles WHERE tiwlo_user_id = $1',
        [session.user.id]
      );
      return res.status(403).json({
        error: 'This Tiwlo account is disabled.',
        isBanned: true,
        banReason: session.user.banReason || '',
        user: serializeUser(session.user, profile.rows[0])
      });
    }
    req.tiwloSession = session;
    await ensurePickUser(session.user);
    return next();
  } catch (error) {
    return next(error);
  }
}

router.get('/auth/mobile-start', async (req, res, next) => {
  try {
    const codeChallenge = String(req.query.code_challenge || '');
    const state = String(req.query.state || '');
    const mode = req.query.mode === 'signup' ? 'signup' : 'login';
    if (!isValidPickCodeChallenge(codeChallenge) ||
        !/^[A-Za-z0-9_-]{32,128}$/.test(state)) {
      return res.status(400).json({ error: 'Invalid PICK sign-in request.' });
    }

    return res.redirect(303, getPickMobileLoginUrl({ codeChallenge, state, mode }));
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/verify-address', requireUser, securityLimiters.addressVerification, async (req, res, next) => {
  try {
    const address = typeof req.body?.address === 'string' ? req.body.address.trim() : '';
    const verified = await verifyGoogleAddress({
      address,
      apiKey: await getGoogleMapsApiKey()
    });
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await queryPg(
      `DELETE FROM pick.address_verifications
       WHERE expires_at <= CURRENT_TIMESTAMP`
    );
    await queryPg(
      `INSERT INTO pick.address_verifications
         (token_hash, tiwlo_user_id, input_address, formatted_address, latitude, longitude,
          area, postal_code, plus_code, place_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
               CURRENT_TIMESTAMP + INTERVAL '15 minutes')`,
      [
        tokenHash,
        req.tiwloSession.user.id,
        address,
        verified.formattedAddress,
        verified.latitude,
        verified.longitude,
        verified.area,
        verified.postalCode,
        verified.plusCode,
        verified.placeId
      ]
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      verified: true,
      verificationToken: token,
      address: {
        formattedAddress: verified.formattedAddress,
        area: verified.area,
        postalCode: verified.postalCode,
        plusCode: verified.plusCode,
        latitude: verified.latitude,
        longitude: verified.longitude,
        placeId: verified.placeId
      }
    });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    return next(error);
  }
});

router.post('/auth/mobile-handoff', async (req, res, next) => {
  try {
    const session = await getTiwloSession(req);
    if (!session?.user) return res.status(401).json({ error: 'Tiwlo sign-in required.' });
    if (session.user.isBanned) return res.status(403).json({ error: 'This Tiwlo account is disabled.' });
    const callbackUrl = await createPickMobileHandoff({
      userId: session.user.id,
      codeChallenge: req.body?.codeChallenge,
      state: req.body?.state
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ callbackUrl });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/mobile-token', async (req, res, next) => {
  try {
    const code = typeof req.body?.code === 'string' ? req.body.code : '';
    const verifier = typeof req.body?.codeVerifier === 'string' ? req.body.codeVerifier : '';
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid or expired PICK sign-in code.' });
    }
    const codeHash = crypto.createHash('sha256').update(code).digest('hex');
    const codeChallenge = hashPickCodeVerifier(verifier);
    const { rows } = await queryPg(
      `DELETE FROM pick.mobile_sso_handoffs
       WHERE code_hash = $1 AND code_challenge = $2 AND expires_at > CURRENT_TIMESTAMP
       RETURNING tiwlo_user_id`,
      [codeHash, codeChallenge]
    );
    const handoff = rows[0];
    if (!handoff) return res.status(401).json({ error: 'PICK sign-in link expired or already used.' });

    const user = await MasterDB.findUserByIdentifier(handoff.tiwlo_user_id);
    if (!user) return res.status(403).json({ error: 'This Tiwlo account is unavailable.' });
    await ensurePickUser(user);
    const profileResult = await queryPg(
      'SELECT * FROM pick.profiles WHERE tiwlo_user_id = $1',
      [user.id]
    );
    res.setHeader('Cache-Control', 'no-store');
    if (user.isBanned) {
      const appealSessionToken = await createPickAppealSession(user.id);
      return res.json({
        success: true,
        appealSessionToken,
        isBanned: true,
        banReason: user.banReason || '',
        user: serializeUser(user, profileResult.rows[0])
      });
    }
    const { sessionToken } = await MasterDB.createSession(
      user.id,
      user.tiwiId || user.storeId || null,
      user.email,
      req
    );
    return res.json({
      success: true,
      sessionToken,
      user: serializeUser(user, profileResult.rows[0])
    });

  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    return next(error);
  }
});

async function requireAppealSession(req, res, next) {
  try {
    const session = await getTiwloSession(req);
    if (session?.user?.isBanned) {
      req.tiwloSession = session;
      return next();
    }
    if (session?.user) {
      return res.status(403).json({ error: 'Account review requests are only available for disabled accounts.' });
    }

    const token = getSessionToken(req);
    if (!token) return res.status(401).json({ error: 'Tiwlo sign-in required.' });
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const { rows } = await queryPg(
      `SELECT tiwlo_user_id FROM pick.account_appeal_sessions
       WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Account review session expired. Sign in again.' });

    const user = await MasterDB.findUserByIdentifier(rows[0].tiwlo_user_id);
    if (!user?.isBanned) {
      await queryPg('DELETE FROM pick.account_appeal_sessions WHERE token_hash = $1', [tokenHash]);
      return res.status(403).json({ error: 'Account review requests are only available for disabled accounts.' });
    }
    req.tiwloSession = { user };
    return next();
  } catch (error) {
    return next(error);
  }
}

const PICK_APPEAL_CATEGORY = 'PICK Account Appeal';

router.get('/account-appeals', requireAppealSession, async (req, res, next) => {
  try {
    const tickets = await SupportDB.getTickets(req.tiwloSession.user.id);
    const appeal = tickets
      .filter((ticket) => ticket.category === PICK_APPEAL_CATEGORY)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))[0] || null;
    const profile = await queryPg(
      'SELECT * FROM pick.profiles WHERE tiwlo_user_id = $1',
      [req.tiwloSession.user.id]
    );
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      appeal,
      user: serializeUser(req.tiwloSession.user, profile.rows[0])
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/account-appeals', requireAppealSession, securityLimiters.pickAccountAppeal, async (req, res, next) => {
  try {
    const description = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (description.length < 20 || description.length > 5000) {
      return res.status(400).json({ error: 'Describe your account review request in 20 to 5000 characters.' });
    }

    const user = req.tiwloSession.user;
    const tickets = await SupportDB.getTickets(user.id);
    const latestAppeal = tickets
      .filter((ticket) => ticket.category === PICK_APPEAL_CATEGORY)
      .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0))[0];
    if (latestAppeal && String(latestAppeal.status).toUpperCase() !== 'REJECTED') {
      return res.status(409).json({
        error: 'Your account review request is already being handled.',
        appeal: latestAppeal
      });
    }

    const appeal = await SupportDB.createTicket({
      id: `pick_appeal_${crypto.randomUUID()}`,
      ticketId: `PICK-AP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      userId: user.id,
      userEmail: user.email || '',
      userName: user.name || user.storeName || 'PICK customer',
      subject: 'PICK disabled account review',
      description,
      category: PICK_APPEAL_CATEGORY,
      clientSource: 'pick_app',
      priority: 'HIGH',
      status: 'OPEN'
    });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(201).json({ appeal });
  } catch (error) {
    return next(error);
  }
});

router.post('/auth/logout', async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    if (token && await MasterDB.getSession(token, req)) {
      await MasterDB.deleteSession(token);
    }
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      await queryPg('DELETE FROM pick.account_appeal_sessions WHERE token_hash = $1', [tokenHash]);
    }
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireUser, async (req, res, next) => {
  try {
    const profile = await queryPg(
      'SELECT * FROM pick.profiles WHERE tiwlo_user_id = $1',
      [req.tiwloSession.user.id]
    );
    return res.json({ user: serializeUser(req.tiwloSession.user, profile.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.get('/account-status', async (req, res, next) => {
  try {
    let user;
    let appealTokenHash = '';
    const session = await getTiwloSession(req);
    if (session?.user) {
      user = session.user;
    } else {
      const token = getSessionToken(req);
      if (!token) return res.status(401).json({ error: 'PICK session expired.' });
      appealTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const appealSession = await queryPg(
        `SELECT tiwlo_user_id FROM pick.account_appeal_sessions
         WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP`,
        [appealTokenHash]
      );
      if (!appealSession.rows[0]) {
        return res.status(401).json({ error: 'Account status session expired. Sign in again.' });
      }
      user = await MasterDB.findUserByIdentifier(appealSession.rows[0].tiwlo_user_id);
    }

    if (!user) return res.status(404).json({ error: 'The Tiwlo account could not be found.' });
    const profile = await queryPg(
      'SELECT * FROM pick.profiles WHERE tiwlo_user_id = $1',
      [user.id]
    );
    if (user.isBanned) {
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        status: 'disabled',
        user: serializeUser(user, profile.rows[0])
      });
    }

    if (appealTokenHash) {
      await queryPg(
        'DELETE FROM pick.account_appeal_sessions WHERE token_hash = $1',
        [appealTokenHash]
      );
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        status: 'restored',
        user: serializeUser(user, profile.rows[0])
      });
    }
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      status: 'active',
      sessionToken: getSessionToken(req),
      user: serializeUser(user, profile.rows[0])
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/coverage/status', requireUser, async (req, res, next) => {
  try {
    const profileResult = await queryPg(
      `SELECT delivery_address AS "deliveryAddress",
              delivery_latitude AS latitude, delivery_longitude AS longitude
       FROM pick.profiles
       WHERE tiwlo_user_id = $1`,
      [req.tiwloSession.user.id]
    );
    const profile = profileResult.rows[0];
    if (
      !profile ||
      typeof profile.latitude !== 'number' ||
      !Number.isFinite(profile.latitude) ||
      typeof profile.longitude !== 'number' ||
      !Number.isFinite(profile.longitude)
    ) {
      return res.json({ hasLocation: false, coverage: null });
    }

    const zonesResult = await queryPg(
      `SELECT id, name_en AS "nameEn", name_bn AS "nameBn",
              center_latitude AS "centerLatitude",
              center_longitude AS "centerLongitude",
              radius_meters AS "radiusMeters", active
       FROM pick.coverage_zones
       WHERE active = TRUE
       ORDER BY radius_meters, name_en`
    );
    return res.json({
      hasLocation: true,
      address: profile.deliveryAddress || '',
      coverage: findCoverageZone(profile.latitude, profile.longitude, zonesResult.rows)
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/address-verification', requireUser, async (req, res, next) => {
  const token = typeof req.body?.verificationToken === 'string'
    ? req.body.verificationToken
    : '';
  if (token && !/^[A-Za-z0-9_-]{40,50}$/.test(token)) {
    return res.status(400).json({ error: 'Verify your delivery address before continuing.' });
  }

  const pool = getPgPool();
  let client;
  try {
    if (!pool) throw new Error('PostgreSQL is unavailable.');
    client = await pool.connect();
    await client.query('BEGIN');
    let verified;
    if (token) {
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const verifiedResult = await client.query(
        `DELETE FROM pick.address_verifications
         WHERE token_hash = $1 AND tiwlo_user_id = $2
           AND expires_at > CURRENT_TIMESTAMP
         RETURNING formatted_address, latitude, longitude, area, postal_code,
                   plus_code, place_id`,
        [tokenHash, req.tiwloSession.user.id]
      );
      verified = verifiedResult.rows[0];
    } else {
      const sharedVerification = await client.query(
        `SELECT address_verified_at, address_verified_location
         FROM system_users
         WHERE id = $1
         FOR SHARE`,
        [req.tiwloSession.user.id]
      );
      const location = sharedVerification.rows[0]?.address_verified_location;
      if (!sharedVerification.rows[0]?.address_verified_at || !location) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'Verify your address in Tiwlo before continuing.',
          code: 'ADDRESS_VERIFICATION_REQUIRED'
        });
      }
      verified = {
        formatted_address: location.formattedAddress,
        latitude: location.latitude,
        longitude: location.longitude,
        area: location.area,
        postal_code: location.postalCode,
        plus_code: location.plusCode,
        place_id: location.placeId || ''
      };
    }
    if (!verified) {
      await client.query('ROLLBACK');
      return res.status(token ? 400 : 409).json({
        error: token
          ? 'Address verification expired. Verify your address again.'
          : 'Tiwlo address verification is unavailable. Try again.'
      });
    }
    if (
      typeof verified.formatted_address !== 'string' ||
      !verified.formatted_address.trim() ||
      typeof verified.latitude !== 'number' ||
      !Number.isFinite(verified.latitude) ||
      verified.latitude < -90 ||
      verified.latitude > 90 ||
      typeof verified.longitude !== 'number' ||
      !Number.isFinite(verified.longitude) ||
      verified.longitude < -180 ||
      verified.longitude > 180 ||
      typeof verified.area !== 'string' ||
      !verified.area.trim() ||
      typeof verified.postal_code !== 'string' ||
      !verified.postal_code.trim() ||
      typeof verified.plus_code !== 'string' ||
      !verified.plus_code.trim()
    ) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Tiwlo has not saved a complete verified address for this account.'
      });
    }

    const zonesResult = await client.query(
      `SELECT id, name_en AS "nameEn", name_bn AS "nameBn",
              center_latitude AS "centerLatitude",
              center_longitude AS "centerLongitude",
              radius_meters AS "radiusMeters", active
       FROM pick.coverage_zones
       WHERE active = TRUE
       ORDER BY radius_meters, name_en`
    );
    const coverage = findCoverageZone(verified.latitude, verified.longitude, zonesResult.rows);
    const profileResult = await client.query(
      `UPDATE pick.profiles
       SET delivery_address = $2, delivery_latitude = $3, delivery_longitude = $4,
           delivery_area = $5, delivery_postal_code = $6, delivery_plus_code = $7,
           delivery_place_id = $8, delivery_address_verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE tiwlo_user_id = $1
       RETURNING *`,
      [
        req.tiwloSession.user.id,
        verified.formatted_address,
        verified.latitude,
        verified.longitude,
        verified.area,
        verified.postal_code,
        verified.plus_code,
        verified.place_id
      ]
    );
    if (!profileResult.rows[0]) throw new Error('PICK profile is unavailable.');
    if (coverage.available) {
      await client.query(
        'DELETE FROM pick.coverage_waitlist WHERE tiwlo_user_id = $1',
        [req.tiwloSession.user.id]
      );
    }
    await client.query('COMMIT');
    return res.json({
      user: serializeUser(req.tiwloSession.user, profileResult.rows[0]),
      coverage
    });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client?.release();
  }
});

router.patch('/profile', requireUser, async (req, res, next) => {
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : undefined;
    const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : undefined;
    const address = typeof req.body?.deliveryAddress === 'string'
      ? req.body.deliveryAddress.trim()
      : undefined;
    if (name !== undefined && (!name || name.length > 255)) {
      return res.status(400).json({ error: 'Enter a valid name.' });
    }
    if (phone !== undefined && phone.length > 64) {
      return res.status(400).json({ error: 'Enter a valid phone number.' });
    }
    if (address !== undefined && address.length > 1000) {
      return res.status(400).json({ error: 'Delivery address is too long.' });
    }
    const result = await queryPg(
      `UPDATE pick.profiles
       SET display_name = COALESCE($2, display_name),
           phone = COALESCE($3, phone),
           delivery_address = COALESCE($4, delivery_address),
           delivery_address_verified_at = CASE
             WHEN $4 IS NOT NULL AND delivery_address IS DISTINCT FROM $4
             THEN NULL ELSE delivery_address_verified_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE tiwlo_user_id = $1
       RETURNING *`,
      [req.tiwloSession.user.id, name ?? null, phone ?? null, address ?? null]
    );
    return res.json({ user: serializeUser(req.tiwloSession.user, result.rows[0]) });
  } catch (error) {
    return next(error);
  }
});

router.get('/catalog/categories', async (_req, res, next) => {
  try {
    const result = await queryPg(
      `SELECT id, name_en AS "titleEn", name_bn AS "titleBn"
       FROM pick.categories WHERE active = TRUE ORDER BY sort_order, id`
    );
    return res.json({ categories: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/catalog/products', async (req, res, next) => {
  try {
    const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const result = await queryPg(
      `SELECT p.id, p.category_id AS "categoryId", c.name_bn AS category,
              c.name_en AS "categoryEn", p.name_en AS "nameEn", p.name_bn AS "name",
              p.description_en AS "descriptionEn", p.description_bn AS description,
              p.price::float8 AS price, p.old_price::float8 AS "oldPrice",
              p.unit_en AS "unitEn", p.unit_bn AS unit,
              CASE WHEN jsonb_typeof(p.units_en) = 'array'
                   THEN CASE WHEN jsonb_array_length(p.units_en) > 0 THEN p.units_en ELSE jsonb_build_array(p.unit_en) END
                   ELSE jsonb_build_array(p.unit_en) END AS "unitsEn",
              CASE WHEN jsonb_typeof(p.units_bn) = 'array'
                   THEN CASE WHEN jsonb_array_length(p.units_bn) > 0 THEN p.units_bn ELSE jsonb_build_array(p.unit_bn) END
                   ELSE jsonb_build_array(p.unit_bn) END AS units,
              CASE WHEN jsonb_typeof(p.unit_prices) = 'array'
                   THEN CASE WHEN jsonb_array_length(p.unit_prices) > 0 THEN p.unit_prices ELSE jsonb_build_array(p.price) END
                   ELSE jsonb_build_array(p.price) END AS "unitPrices",
              p.image_url AS image,
              p.rating::float8 AS rating, p.origin,
              p.delivery_time AS "deliveryTime", p.reviews_count AS reviews,
              p.badge, (p.stock_quantity > 0) AS "inStock"
       FROM pick.products p
       LEFT JOIN pick.categories c ON c.id = p.category_id
       WHERE p.active = TRUE
         AND ($1 = '' OR p.category_id = $1)
         AND ($2 = '' OR p.name_en ILIKE '%' || $2 || '%' OR p.name_bn ILIKE '%' || $2 || '%')
       ORDER BY p.name_en
       LIMIT 250`,
      [categoryId, search]
    );
    return res.json({ products: result.rows });
  } catch (error) {
    return next(error);
  }
});

export { parseGroceryDeliveryFee };

router.get('/checkout/config', requireUser, async (_req, res, next) => {
  try {
    const deliveryFee = await getPickGroceryDeliveryFee();
    if (deliveryFee === null) {
      return res.status(503).json({ error: 'Grocery delivery pricing is not configured.' });
    }
    return res.json({ deliveryFee });
  } catch (error) {
    return next(error);
  }
});

router.get('/parcel/vehicles', requireUser, async (_req, res, next) => {
  try {
    const result = await queryPg(
      `SELECT id, name_en AS "nameEn", name_bn AS "nameBn",
              eta_minutes AS "etaMinutes", max_weight_kg::float8 AS "maxWeightKg",
              price::float8 AS price, icon
       FROM pick.parcel_vehicles
       WHERE active = TRUE
       ORDER BY sort_order, id`
    );
    return res.json({ vehicles: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/orders/parcel', requireUser, async (req, res, next) => {
  const body = req.body || {};
  const parcel = body.parcel;
  const recipient = body.recipient;
  const vehicleId = typeof body.vehicleId === 'string' ? body.vehicleId : '';
  const paymentMethod = typeof body.paymentMethod === 'string' ? body.paymentMethod : 'cod';
  if (paymentMethod !== 'cod') {
    try {
      await getPickPaymentGateway(paymentMethod);
    } catch (error) {
      return res.status(503).json({ error: error.message });
    }
  }
  if (!parcel || !recipient || !vehicleId) {
    return res.status(400).json({ error: 'Complete the parcel, recipient, and vehicle details.' });
  }
  const weight = Number(parcel.weight);
  const declaredValue = Number(parcel.value);
  const categoryId = typeof parcel.categoryId === 'string' ? parcel.categoryId : '';
  const category = Object.prototype.hasOwnProperty.call(PARCEL_CATEGORIES, categoryId)
    ? PARCEL_CATEGORIES[categoryId]
    : null;
  const recipientName = typeof recipient.name === 'string' ? recipient.name.trim() : '';
  const recipientPhone = typeof recipient.phone === 'string' ? recipient.phone.trim() : '';
  const recipientAddress = typeof recipient.address === 'string' ? recipient.address.trim() : '';
  const requestedSenderName = typeof recipient.senderName === 'string' ? recipient.senderName.trim() : '';
  const requestedSenderPhone = typeof recipient.senderPhone === 'string' ? recipient.senderPhone.trim() : '';
  const senderAddress = typeof recipient.senderAddress === 'string' ? recipient.senderAddress.trim() : '';
  const senderLatitude = recipient.senderLatitude;
  const senderLongitude = recipient.senderLongitude;
  const recipientLatitude = recipient.latitude;
  const recipientLongitude = recipient.longitude;
  if (!Number.isFinite(weight) || weight <= 0 || weight > 1000 ||
      !Number.isFinite(declaredValue) || declaredValue < 0 || declaredValue > 10000000 ||
      !category ||
      !recipientName || recipientName.length > 255 ||
      !recipientPhone || recipientPhone.length > 64 ||
      requestedSenderName.length > 255 || requestedSenderPhone.length > 64 ||
      !senderAddress || senderAddress.length > 1000 ||
      !recipientAddress || recipientAddress.length > 1000 ||
      !areValidParcelPins(
        { latitude: senderLatitude, longitude: senderLongitude },
        { latitude: recipientLatitude, longitude: recipientLongitude }
      )) {
    return res.status(400).json({ error: 'Enter valid parcel and recipient details.' });
  }
  const pool = getPgPool();
  let client;
  try {
    if (!pool) throw new Error('PostgreSQL is unavailable.');
    client = await pool.connect();
    await client.query('BEGIN');
    const profileResult = await client.query(
      `SELECT display_name, phone, delivery_address
       FROM pick.profiles WHERE tiwlo_user_id = $1 FOR UPDATE`,
      [req.tiwloSession.user.id]
    );
    const profile = profileResult.rows[0];
    const senderName = requestedSenderName || profile?.display_name || req.tiwloSession.user.name || '';
    const senderPhone = requestedSenderPhone || profile?.phone || req.tiwloSession.user.phone || '';
    if (!senderName || !senderPhone) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Complete your Tiwlo profile before sending a parcel.' });
    }
    if (paymentMethod === 'sslcommerz' && !String(profile?.phone || req.tiwloSession.user.phone || '').trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Add a phone number to your Tiwlo profile before using SSLCOMMERZ.' });
    }

    const vehicleResult = await client.query(
      `SELECT id, name_en, name_bn, price::float8 AS price, max_weight_kg::float8 AS "maxWeightKg"
       FROM pick.parcel_vehicles WHERE id = $1 AND active = TRUE FOR UPDATE`,
      [vehicleId]
    );
    const vehicle = vehicleResult.rows[0];
    if (!vehicle) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The selected parcel vehicle is unavailable.' });
    }
    if (weight > vehicle.maxWeightKg) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The parcel exceeds this vehicle’s weight limit.' });
    }

    const parcelDetails = {
      sender: {
        name: senderName,
        phone: senderPhone,
        address: senderAddress,
        latitude: senderLatitude,
        longitude: senderLongitude,
        floor: typeof recipient.senderFloor === 'string' ? recipient.senderFloor.slice(0, 255) : ''
      },
      recipient: {
        name: recipientName,
        phone: recipientPhone,
        address: recipientAddress,
        latitude: recipientLatitude,
        longitude: recipientLongitude,
        floor: typeof recipient.floor === 'string' ? recipient.floor.slice(0, 255) : ''
      },
      package: {
        categoryId,
        categoryName: category.en,
        categoryNameEn: category.en,
        categoryNameBn: category.bn,
        weight,
        declaredValue,
        handleWithCare: parcel.handleWithCare === true,
        notes: typeof parcel.notes === 'string' ? parcel.notes.slice(0, 1000) : ''
      },
      vehicle: { id: vehicle.id, nameEn: vehicle.name_en, nameBn: vehicle.name_bn },
      requirePin: recipient.requirePin === true,
      whoPays: recipient.whoPays === 'recipient' ? 'recipient' : 'sender',
      photoProof: recipient.photoProof === true
    };
    const orderResult = await client.query(
      `INSERT INTO pick.orders
         (tiwlo_user_id, order_type, status, delivery_address, subtotal, delivery_fee,
          total, payment_method, parcel_details)
       VALUES ($1, 'parcel', 'placed', $2, 0, $3, $3, $4, $5::jsonb)
       RETURNING id, order_type AS "orderType", status, delivery_address AS "deliveryAddress",
                 subtotal::float8 AS subtotal, delivery_fee::float8 AS "deliveryFee",
                 total::float8 AS total, payment_method AS "paymentMethod",
                 parcel_details AS "parcelDetails", created_at AS "createdAt"`,
      [req.tiwloSession.user.id, recipientAddress, vehicle.price, paymentMethod, JSON.stringify(parcelDetails)]
    );
    await client.query('COMMIT');
    if (paymentMethod !== 'cod') {
      client.release();
      client = null;
    }
    if (paymentMethod !== 'cod') {
      try {
        const payment = await startPickHostedPayment({
          order: orderResult.rows[0],
          provider: paymentMethod,
          user: req.tiwloSession.user,
          profile
        });
        return res.status(201).json({
          order: {
            ...orderResult.rows[0],
            status: 'pending_payment',
            paymentStatus: 'pending',
            paymentProvider: paymentMethod,
            paymentExpiresAt: payment.expiresAt
          },
          ...payment
        });
      } catch (error) {
        return res.status(502).json({
          error: error.message || 'The payment checkout could not be started.',
          orderId: orderResult.rows[0].id
        });
      }
    }
    return res.status(201).json({ order: orderResult.rows[0] });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('PICK parcel order rollback failed:', rollbackError);
      }
    }
    return next(error);
  } finally {
    client?.release();
  }
});

router.post('/orders', requireUser, async (req, res, next) => {
  let deliveryFee;
  try {
    deliveryFee = await getPickGroceryDeliveryFee();
  } catch (error) {
    return next(error);
  }
  if (deliveryFee === null) {
    return res.status(503).json({ error: 'Grocery delivery pricing is not configured.' });
  }

  const requestedItems = req.body?.items;
  const paymentMethod = typeof req.body?.paymentMethod === 'string'
    ? req.body.paymentMethod
    : 'cod';
  if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 100) {
    return res.status(400).json({ error: 'Add between 1 and 100 products to your order.' });
  }
  if (paymentMethod !== 'cod') {
    try {
      await getPickPaymentGateway(paymentMethod);
    } catch (error) {
      return res.status(503).json({ error: error.message });
    }
  }

  const mergedItems = new Map();
  for (const item of requestedItems) {
    if (!item || typeof item.productId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.productId) ||
        !Number.isInteger(item.unitIndex) || item.unitIndex < 0 ||
        !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      return res.status(400).json({ error: 'One or more order items are invalid.' });
    }
    const key = `${item.productId}:${item.unitIndex}`;
    const previous = mergedItems.get(key);
    const quantity = (previous?.quantity || 0) + item.quantity;
    if (quantity > 100) return res.status(400).json({ error: 'An item quantity cannot exceed 100.' });
    mergedItems.set(key, { productId: item.productId, unitIndex: item.unitIndex, quantity });
  }

  const pool = getPgPool();
  let client;
  try {
    if (!pool) throw new Error('PostgreSQL is unavailable.');
    client = await pool.connect();
    await client.query('BEGIN');
    const profileResult = await client.query(
      `SELECT display_name, phone, delivery_address
       FROM pick.profiles WHERE tiwlo_user_id = $1 FOR UPDATE`,
      [req.tiwloSession.user.id]
    );
    const deliveryAddress = profileResult.rows[0]?.delivery_address?.trim();
    if (!deliveryAddress) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Set a delivery address before placing an order.' });
    }
    if (paymentMethod === 'sslcommerz' &&
        !String(profileResult.rows[0]?.phone || req.tiwloSession.user.phone || '').trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Add a phone number to your Tiwlo profile before using SSLCOMMERZ.' });
    }

    const productIds = [...new Set([...mergedItems.values()].map((item) => item.productId))];
    const productsResult = await client.query(
      `SELECT id, name_en, name_bn, unit_en, unit_bn, units_en, units_bn,
              unit_prices, stock_quantity, active
       FROM pick.products
       WHERE id = ANY($1::uuid[])
       FOR UPDATE`,
      [productIds]
    );
    const products = new Map(productsResult.rows.map((product) => [product.id, product]));
    const orderItems = [];
    const quantitiesByProduct = new Map();
    let subtotal = 0;
    for (const item of mergedItems.values()) {
      const product = products.get(item.productId);
      if (!product || !product.active) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'A selected product is no longer available.' });
      }
      const prices = Array.isArray(product.unit_prices) ? product.unit_prices : [];
      const unitsEn = Array.isArray(product.units_en) ? product.units_en : [];
      const unitsBn = Array.isArray(product.units_bn) ? product.units_bn : [];
      const unitPrice = prices[item.unitIndex];
      if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) ||
          !unitsEn[item.unitIndex] || !unitsBn[item.unitIndex]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'A selected product has no valid price for that unit.' });
      }
      quantitiesByProduct.set(item.productId,
        (quantitiesByProduct.get(item.productId) || 0) + item.quantity);
      const lineTotal = Math.round(unitPrice * item.quantity * 100) / 100;
      subtotal += lineTotal;
      orderItems.push({
        ...item,
        product,
        unitPrice,
        unitEn: unitsEn[item.unitIndex],
        unitBn: unitsBn[item.unitIndex],
        lineTotal
      });
    }
    for (const [productId, quantity] of quantitiesByProduct) {
      const product = products.get(productId);
      if (Number(product.stock_quantity) < quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `${product.name_en} is out of stock.` });
      }
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const total = Math.round((subtotal + deliveryFee) * 100) / 100;
    const orderResult = await client.query(
      `INSERT INTO pick.orders
         (tiwlo_user_id, order_type, status, delivery_address, subtotal, delivery_fee, total, payment_method)
       VALUES ($1, 'grocery', 'placed', $2, $3, $4, $5, $6)
       RETURNING id, order_type AS "orderType", status, delivery_address AS "deliveryAddress",
                 subtotal::float8 AS subtotal, delivery_fee::float8 AS "deliveryFee",
                 total::float8 AS total, payment_method AS "paymentMethod", created_at AS "createdAt"`,
      [req.tiwloSession.user.id, deliveryAddress, subtotal, deliveryFee, total, paymentMethod]
    );
    const order = orderResult.rows[0];
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO pick.order_items
           (order_id, product_id, product_name_en, product_name_bn, unit_en, unit_bn,
            quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          order.id, item.product.id, item.product.name_en, item.product.name_bn,
          item.unitEn, item.unitBn, item.quantity, item.unitPrice, item.lineTotal
        ]
      );
    }
    for (const [productId, quantity] of quantitiesByProduct) {
      await client.query(
        `UPDATE pick.products
         SET stock_quantity = stock_quantity - $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [productId, quantity]
      );
    }
    await client.query('COMMIT');
    if (paymentMethod !== 'cod') {
      client.release();
      client = null;
    }
    if (paymentMethod !== 'cod') {
      try {
        const payment = await startPickHostedPayment({
          order,
          provider: paymentMethod,
          user: req.tiwloSession.user,
          profile: profileResult.rows[0]
        });
        return res.status(201).json({
          order: {
            ...order,
            paymentStatus: 'pending',
            status: 'pending_payment',
            paymentProvider: paymentMethod,
            paymentExpiresAt: payment.expiresAt
          },
          ...payment
        });
      } catch (error) {
        return res.status(502).json({
          error: error.message || 'The payment checkout could not be started.',
          orderId: order.id
        });
      }
    }
    return res.status(201).json({ order });
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('PICK grocery order rollback failed:', rollbackError);
      }
    }
    return next(error);
  } finally {
    client?.release();
  }
});

router.get('/orders', requireUser, async (req, res, next) => {
  try {
    const result = await queryPg(
      `SELECT o.id, o.order_type AS "orderType", o.status,
              o.delivery_address AS "deliveryAddress", o.subtotal::float8 AS subtotal,
              o.delivery_fee::float8 AS "deliveryFee", o.total::float8 AS total,
              o.payment_method AS "paymentMethod", o.created_at AS "createdAt",
              o.payment_status AS "paymentStatus", o.payment_provider AS "paymentProvider",
              o.payment_expires_at AS "paymentExpiresAt",
              o.parcel_details AS "parcelDetails",
              COALESCE(jsonb_agg(jsonb_build_object(
                'id', i.id, 'productId', i.product_id,
                'nameEn', i.product_name_en, 'nameBn', i.product_name_bn,
                'unitEn', i.unit_en, 'unitBn', i.unit_bn,
                'quantity', i.quantity, 'unitPrice', i.unit_price, 'lineTotal', i.line_total
              )) FILTER (WHERE i.id IS NOT NULL), '[]'::jsonb) AS items
       FROM pick.orders o
       LEFT JOIN pick.order_items i ON i.order_id = o.id
       WHERE o.tiwlo_user_id = $1
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 100`,
      [req.tiwloSession.user.id]
    );
    return res.json({ orders: result.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/location/parcel-geocode', requireUser, securityLimiters.addressVerification, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body || {};
    if (!isValidLiveLocation({ latitude, longitude, accuracy: 0 })) {
      return res.status(400).json({ error: 'A valid map pin is required.' });
    }
    const address = await reverseGeocodeAddress({
      latitude,
      longitude,
      apiKey: await getGoogleMapsApiKey()
    });
    return res.json({ address: address.formattedAddress });
  } catch (error) {
    return next(error);
  }
});

router.post('/location/reverse-geocode', requireUser, async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy } = req.body || {};
    if (!isValidLiveLocation({ latitude, longitude, accuracy })) {
      return res.status(400).json({ error: 'A valid GPS location is required.' });
    }
    const address = await reverseGeocodeAddress({
      latitude,
      longitude,
      apiKey: await getGoogleMapsApiKey()
    });
    const zonesResult = await queryPg(
      `SELECT id, name_en AS "nameEn", name_bn AS "nameBn",
              center_latitude AS "centerLatitude",
              center_longitude AS "centerLongitude",
              radius_meters AS "radiusMeters", active
       FROM pick.coverage_zones
       WHERE active = TRUE
       ORDER BY radius_meters, name_en`
    );
    const coverage = findCoverageZone(latitude, longitude, zonesResult.rows);
    await queryPg(
      `UPDATE pick.profiles
       SET delivery_address = $2, delivery_latitude = $3, delivery_longitude = $4,
           delivery_accuracy = $5, delivery_area = $6, delivery_postal_code = $7,
           delivery_plus_code = $8, delivery_place_id = $9,
           delivery_address_verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE tiwlo_user_id = $1`,
      [
        req.tiwloSession.user.id,
        address.formattedAddress,
        latitude,
        longitude,
        accuracy,
        address.area,
        address.postalCode,
        address.plusCode,
        address.placeId
      ]
    );
    if (coverage.available) {
      await queryPg(
        'DELETE FROM pick.coverage_waitlist WHERE tiwlo_user_id = $1',
        [req.tiwloSession.user.id]
      );
    }
    return res.json({ address, coverage });
  } catch (error) {
    if (error instanceof TypeError) return res.status(400).json({ error: error.message });
    return next(error);
  }
});

router.post('/coverage/waitlist', requireUser, async (req, res, next) => {
  try {
    const { rows } = await queryPg(
      `SELECT display_name AS "displayName", phone, delivery_address AS "deliveryAddress",
              delivery_area AS "deliveryArea", delivery_latitude AS latitude,
              delivery_longitude AS longitude
       FROM pick.profiles
       WHERE tiwlo_user_id = $1`,
      [req.tiwloSession.user.id]
    );
    const profile = rows[0];
    if (!profile?.deliveryAddress || !Number.isFinite(profile.latitude) ||
        !Number.isFinite(profile.longitude)) {
      return res.status(400).json({ error: 'Share your location before joining the coverage waitlist.' });
    }

    const zones = await queryPg(
      `SELECT id, name_en AS "nameEn", name_bn AS "nameBn",
              center_latitude AS "centerLatitude",
              center_longitude AS "centerLongitude",
              radius_meters AS "radiusMeters", active
       FROM pick.coverage_zones
       WHERE active = TRUE`
    );
    const coverage = findCoverageZone(profile.latitude, profile.longitude, zones.rows);
    if (coverage.available) {
      return res.status(409).json({ error: 'PICK already serves this location. Please refresh your location.' });
    }

    await queryPg(
      `INSERT INTO pick.coverage_waitlist
         (tiwlo_user_id, display_name, phone, delivery_address, delivery_area,
          delivery_latitude, delivery_longitude)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (tiwlo_user_id) DO UPDATE
       SET display_name = EXCLUDED.display_name, phone = EXCLUDED.phone,
           delivery_address = EXCLUDED.delivery_address, delivery_area = EXCLUDED.delivery_area,
           delivery_latitude = EXCLUDED.delivery_latitude,
           delivery_longitude = EXCLUDED.delivery_longitude,
           updated_at = CURRENT_TIMESTAMP`,
      [
        req.tiwloSession.user.id,
        profile.displayName || req.tiwloSession.user.name || '',
        profile.phone || req.tiwloSession.user.phone || '',
        profile.deliveryAddress,
        profile.deliveryArea,
        profile.latitude,
        profile.longitude
      ]
    );
    return res.status(201).json({ joined: true });
  } catch (error) {
    return next(error);
  }
});

registerPickPaymentRoutes(router, requireUser);
router.use('/admin', adminRoutes);

export default router;
