import { randomUUID } from 'node:crypto';
import { isPgActive, queryPg, recordPlatformBillingOrder } from './postgres.js';
import { recordSecurityEvent } from './securityPersistence.js';
import {
  activateBanAndBlockSignals,
  checkActiveBlockForRequest,
  extractClientSignals
} from '../security/freeTierAbuseGuard.js';

const SETTING_KEY = 'cloud_promotions_settings';

export const DEFAULT_WELCOME_PROMO = Object.freeze({
  enabled: true,
  title: 'New Account $50.00 Gift Offer',
  headline: 'Get $50.00 promotional credit for 30 days',
  description: 'Load at least $1.00 USD on your new account to unlock $50.00 in gift credits valid for 30 days.',
  badgeText: 'New Account Offer',
  minDepositUsd: 1,
  bonusAmountUsd: 50,
  validityDays: 30,
  newAccountsOnly: true,
  onePerDevice: true
});

/** Format default dynamic welcome offer headline & description for numeric settings. */
export function buildDefaultWelcomeCopy({ minDepositUsd = 1, bonusAmountUsd = 50, validityDays = 30 } = {}) {
  const minText = `$${Number(minDepositUsd || 1).toFixed(2)}`;
  const bonusText = `$${Number(bonusAmountUsd || 0).toFixed(2)}`;
  const days = Number(validityDays || 30);
  return {
    title: `New Account ${bonusText} Gift Offer`,
    headline: `Load ${minText} credit to get ${bonusText} gift for ${days} days`,
    description: `New accounts that load at least ${minText} USD receive ${bonusText} USD in gift credits valid for ${days} days.`
  };
}

/** Normalize and bound welcome credit-load promotion settings. */
export function normalizeWelcomePromoConfig(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const rawMin = Number(src.minDepositUsd ?? DEFAULT_WELCOME_PROMO.minDepositUsd);
  const rawBonus = Number(src.bonusAmountUsd ?? DEFAULT_WELCOME_PROMO.bonusAmountUsd);
  const rawDays = Number.parseInt(src.validityDays ?? DEFAULT_WELCOME_PROMO.validityDays, 10);

  const minDepositUsd = Number.isFinite(rawMin) && rawMin >= 1 ? Number(rawMin.toFixed(2)) : 1;
  const bonusAmountUsd = Number.isFinite(rawBonus) && rawBonus >= 0 ? Number(rawBonus.toFixed(2)) : 50;
  const validityDays = Number.isFinite(rawDays) && rawDays >= 1 ? Math.min(365, rawDays) : 30;
  const autoCopy = buildDefaultWelcomeCopy({ minDepositUsd, bonusAmountUsd, validityDays });

  const rawTitle = String(src.title || '').trim();
  const rawHeadline = String(src.headline || '').trim();
  const rawDescription = String(src.description || '').trim();

  const isAutoTitle = !rawTitle || /^New Account \$\d+(?:\.\d+)? Gift Offer$/i.test(rawTitle);
  const isAutoHeadline =
    !rawHeadline ||
    /^Get \$\d+(?:\.\d+)? (?:promotional|gift) credit for \d+ days$/i.test(rawHeadline) ||
    /^Load \$\d+(?:\.\d+)? credit to get \$\d+(?:\.\d+)? gift for \d+ days$/i.test(rawHeadline);
  const isAutoDescription =
    !rawDescription ||
    /^Load at least \$\d+(?:\.\d+)? USD on your new account to unlock \$\d+(?:\.\d+)? in gift credits valid for \d+ days\.$/i.test(rawDescription) ||
    /^New accounts that load at least \$\d+(?:\.\d+)? USD receive \$\d+(?:\.\d+)? USD in gift credits valid for \d+ days\.$/i.test(rawDescription);

  return {
    enabled: src.enabled !== false,
    title: (isAutoTitle ? autoCopy.title : rawTitle).slice(0, 120),
    headline: (isAutoHeadline ? autoCopy.headline : rawHeadline).slice(0, 180),
    description: (isAutoDescription ? autoCopy.description : rawDescription).slice(0, 400),
    badgeText: String(src.badgeText || DEFAULT_WELCOME_PROMO.badgeText).trim().slice(0, 48) || DEFAULT_WELCOME_PROMO.badgeText,
    minDepositUsd,
    bonusAmountUsd,
    validityDays,
    newAccountsOnly: src.newAccountsOnly !== false,
    onePerDevice: src.onePerDevice !== false
  };
}

function normalizeEmailList(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[\s,;]+/)
      : [];
  return [...new Set(list.map((v) => String(v || '').trim().toLowerCase()).filter((v) => v.includes('@')))];
}

function normalizeIdList(raw) {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[\s,;]+/)
      : [];
  return [...new Set(list.map((v) => String(v || '').trim()).filter(Boolean))];
}

function findOtherDeviceCollisions(userId, signals = {}, priorClaims = []) {
  const otherClaims = (priorClaims || []).filter((c) => c && c.user_id !== userId && c.status !== 'rejected');
  if (otherClaims.length === 0) return { hardwareMatched: [], ipMatched: [], sameWifiMatched: [] };

  const hardwareMatched = otherClaims.filter((c) =>
    (signals.fingerprintHash && c.device_fingerprint_hash === signals.fingerprintHash) ||
    (signals.deviceTokenHash && c.device_token_hash === signals.deviceTokenHash) ||
    (signals.browserCookieHash && c.browser_cookie_hash === signals.browserCookieHash)
  );
  const ipMatched = signals.ipHash
    ? otherClaims.filter((c) => c.ip_hash === signals.ipHash)
    : [];
  const sameWifiMatched = (signals.subnetHash && signals.userAgentHash)
    ? otherClaims.filter((c) => c.subnet_hash === signals.subnetHash && c.user_agent_hash === signals.userAgentHash)
    : [];

  return { hardwareMatched, ipMatched, sameWifiMatched };
}

/** Pure evaluator for new-account credit-load welcome gift eligibility and anti-abuse. */
export function evaluateWelcomeBonusEligibility({
  userId,
  config = DEFAULT_WELCOME_PROMO,
  accountState = {},
  depositAmountUsd = 0,
  signals = {},
  priorWelcomeClaims = [],
  blockedSignals = [],
  isAdmin = false
}) {
  if (!config?.enabled || Number(config.bonusAmountUsd || 0) <= 0) {
    return { eligible: false, code: 'PROMO_DISABLED', reason: 'Welcome gift offer is currently disabled.' };
  }
  if (!isAdmin && blockedSignals.length > 0) {
    return {
      eligible: false,
      code: 'PROMO_DEVICE_BLOCKED',
      reason: 'Promotional gift withheld due to blocked device or network activity.',
      shouldBanAccount: false
    };
  }
  if (accountState?.welcomePromoClaimedAt) {
    return { eligible: false, code: 'ALREADY_CLAIMED', reason: 'Welcome gift has already been claimed on this account.' };
  }
  if (config.newAccountsOnly && (accountState?.firstPaidTopupAt || accountState?.hasPaidTopupsBefore)) {
    return {
      eligible: false,
      code: 'NEW_ACCOUNTS_ONLY',
      reason: `This $${Number(config.bonusAmountUsd || 50).toFixed(2)} gift offer applies to first-time credit loads on new accounts.`
    };
  }
  if (Number(depositAmountUsd || 0) < Number(config.minDepositUsd || 1)) {
    return {
      eligible: false,
      code: 'MIN_DEPOSIT_NOT_MET',
      reason: `Load at least $${Number(config.minDepositUsd || 1).toFixed(2)} to qualify for the gift.`
    };
  }

  if (config.onePerDevice && !isAdmin) {
    const { hardwareMatched, ipMatched, sameWifiMatched } = findOtherDeviceCollisions(userId, signals, priorWelcomeClaims);
    if (hardwareMatched.length > 0) {
      return {
        eligible: false,
        code: 'PROMO_DEVICE_ABUSE',
        reason: 'Suspended: Multiple accounts detected claiming welcome gift credits from the same device fingerprint or browser.',
        shouldBanAccount: true,
        blockSignalTypes: ['user', 'fingerprint', 'device_token', 'browser_cookie', 'ip'],
        matchedUsers: [...new Set(hardwareMatched.map((c) => c.user_id))]
      };
    }
    const distinctIpUsers = [...new Set(ipMatched.map((c) => c.user_id))];
    const distinctWifiUsers = [...new Set(sameWifiMatched.map((c) => c.user_id))];
    if (distinctIpUsers.length >= 2 || distinctWifiUsers.length >= 1) {
      return {
        eligible: false,
        code: 'PROMO_NETWORK_ABUSE',
        reason: 'Suspended: Multiple accounts detected attempting to claim new-account gift credits on the same Wi-Fi/IP.',
        shouldBanAccount: true,
        blockSignalTypes: ['user', 'fingerprint', 'device_token', 'ip'],
        matchedUsers: [...new Set([...distinctIpUsers, ...distinctWifiUsers])]
      };
    }
    if (distinctIpUsers.length >= 1) {
      return {
        eligible: false,
        code: 'PROMO_NETWORK_LIMIT_REACHED',
        reason: 'A new-account welcome gift has already been claimed from this IP/Wi-Fi network.',
        shouldBanAccount: false,
        matchedUsers: distinctIpUsers
      };
    }
  }

  return {
    eligible: true,
    code: 'ELIGIBLE',
    bonusAmountUsd: Number(config.bonusAmountUsd || 50),
    validityDays: Number(config.validityDays || 30)
  };
}

/** Pure evaluator for coupon/promo code redemption eligibility & targeting. */
export function evaluatePromoCodeRedemption({
  promo,
  user = {},
  accountState = {},
  totalPaidTopupUsd = 0,
  existingUserClaimsCount = 0,
  priorCodeClaims = [],
  signals = {},
  blockedSignals = [],
  now = Date.now()
}) {
  if (!promo || promo.is_active === false) {
    return { eligible: false, statusCode: 404, code: 'PROMO_NOT_FOUND', reason: 'Promotional code is invalid or inactive.' };
  }
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= now) {
    return { eligible: false, statusCode: 410, code: 'PROMO_EXPIRED', reason: 'This promotional code has expired.' };
  }
  if (promo.max_total_uses != null && Number(promo.uses_count || 0) >= Number(promo.max_total_uses)) {
    return { eligible: false, statusCode: 409, code: 'PROMO_MAX_USES', reason: 'This promotional code has reached its redemption limit.' };
  }
  if (existingUserClaimsCount >= Number(promo.max_per_user || 1)) {
    return { eligible: false, statusCode: 409, code: 'PROMO_ALREADY_REDEEMED', reason: 'You have already redeemed this promotional code.' };
  }

  const targetType = String(promo.target_type || 'all');
  if (targetType === 'specific_users') {
    const allowedEmails = Array.isArray(promo.target_emails) ? promo.target_emails.map((e) => String(e).toLowerCase()) : [];
    const allowedIds = Array.isArray(promo.target_user_ids) ? promo.target_user_ids.map(String) : [];
    const userEmail = String(user.email || '').trim().toLowerCase();
    const matchesUser =
      (userEmail && allowedEmails.includes(userEmail)) ||
      (user.id && allowedIds.includes(String(user.id))) ||
      (user.tiwiId && allowedIds.includes(String(user.tiwiId)));
    if (!matchesUser) {
      return {
        eligible: false,
        statusCode: 403,
        code: 'PROMO_NOT_ASSIGNED',
        reason: 'This promotional code is assigned to specific accounts only.'
      };
    }
  }

  if (targetType === 'new_accounts' || promo.new_accounts_only) {
    if (accountState?.welcomePromoClaimedAt || accountState?.firstPaidTopupAt || accountState?.hasPaidTopupsBefore) {
      return {
        eligible: false,
        statusCode: 403,
        code: 'PROMO_NEW_ACCOUNTS_ONLY',
        reason: 'This promotional code is valid for new accounts only.'
      };
    }
  }

  const minTopupUsd = Number(promo.min_topup_usd || 0);
  if (minTopupUsd > 0 && Number(totalPaidTopupUsd || 0) < minTopupUsd) {
    return {
      eligible: false,
      statusCode: 402,
      code: 'PROMO_MIN_TOPUP_REQUIRED',
      reason: `Load at least $${minTopupUsd.toFixed(2)} USD credit first before redeeming this promotional code.`
    };
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  if (!isAdmin && blockedSignals.length > 0) {
    return {
      eligible: false,
      statusCode: 403,
      code: 'PROMO_DEVICE_BLOCKED',
      reason: blockedSignals[0]?.reason || 'Access restricted due to promotional abuse protection.',
      shouldBanAccount: false
    };
  }

  if (promo.one_per_device !== false && !isAdmin) {
    const { hardwareMatched, ipMatched, sameWifiMatched } = findOtherDeviceCollisions(user.id, signals, priorCodeClaims);
    if (hardwareMatched.length > 0) {
      return {
        eligible: false,
        statusCode: 403,
        code: 'PROMO_DEVICE_ABUSE',
        reason: 'Suspended: Multiple accounts detected claiming promotional codes from the same device or browser.',
        shouldBanAccount: true,
        blockSignalTypes: ['user', 'fingerprint', 'device_token', 'browser_cookie', 'ip'],
        matchedUsers: [...new Set(hardwareMatched.map((c) => c.user_id))]
      };
    }
    const distinctIpUsers = [...new Set(ipMatched.map((c) => c.user_id))];
    const distinctWifiUsers = [...new Set(sameWifiMatched.map((c) => c.user_id))];
    if (distinctIpUsers.length >= 2 || distinctWifiUsers.length >= 1) {
      return {
        eligible: false,
        statusCode: 403,
        code: 'PROMO_NETWORK_ABUSE',
        reason: 'Suspended: Multiple accounts detected claiming promotions on the same Wi-Fi/IP.',
        shouldBanAccount: true,
        blockSignalTypes: ['user', 'fingerprint', 'device_token', 'ip'],
        matchedUsers: [...new Set([...distinctIpUsers, ...distinctWifiUsers])]
      };
    }
    if (distinctIpUsers.length >= 1) {
      return {
        eligible: false,
        statusCode: 403,
        code: 'PROMO_NETWORK_LIMIT_REACHED',
        reason: 'This promotional code has already been redeemed from this IP/Wi-Fi network.',
        shouldBanAccount: false,
        matchedUsers: distinctIpUsers
      };
    }
  }

  return {
    eligible: true,
    statusCode: 200,
    code: 'ELIGIBLE',
    amountUsd: Number(promo.amount_usd || 0),
    validityDays: Number(promo.validity_days || 30),
    rewardType: String(promo.reward_type || 'promo_credit')
  };
}

/** Load Welcome Gift Promo configuration from PostgreSQL system_settings. */
export async function getWelcomePromoSettings() {
  if (!isPgActive()) return { ...DEFAULT_WELCOME_PROMO };
  try {
    const { rows } = await queryPg(
      'SELECT setting_value FROM system_settings WHERE setting_key = $1 LIMIT 1',
      [SETTING_KEY]
    );
    return normalizeWelcomePromoConfig(rows[0]?.setting_value || {});
  } catch {
    return { ...DEFAULT_WELCOME_PROMO };
  }
}

/** Persist Welcome Gift Promo configuration in PostgreSQL system_settings. */
export async function saveWelcomePromoSettings(input) {
  const normalized = normalizeWelcomePromoConfig(input);
  if (!isPgActive()) return normalized;
  await queryPg(
    `INSERT INTO system_settings (setting_key, setting_value, updated_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (setting_key) DO UPDATE SET
       setting_value = EXCLUDED.setting_value,
       updated_at = CURRENT_TIMESTAMP`,
    [SETTING_KEY, JSON.stringify(normalized)]
  );
  return normalized;
}

/** List all promotional coupon codes created by administrators. */
export async function listPromoCodes() {
  if (!isPgActive()) return [];
  const { rows } = await queryPg(
    `SELECT * FROM cloud_promo_codes ORDER BY created_at DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    description: row.description || '',
    rewardType: row.reward_type,
    amountUsd: Number(row.amount_usd),
    validityDays: Number(row.validity_days),
    minTopupUsd: Number(row.min_topup_usd || 0),
    targetType: row.target_type,
    targetEmails: Array.isArray(row.target_emails) ? row.target_emails : [],
    targetUserIds: Array.isArray(row.target_user_ids) ? row.target_user_ids : [],
    maxTotalUses: row.max_total_uses === null ? null : Number(row.max_total_uses),
    usesCount: Number(row.uses_count || 0),
    maxPerUser: Number(row.max_per_user || 1),
    onePerDevice: row.one_per_device !== false,
    newAccountsOnly: row.new_accounts_only === true,
    isActive: row.is_active !== false,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    createdBy: row.created_by || '',
    createdAt: new Date(row.created_at).toISOString()
  }));
}

/** Create a new promotional code with optional user/email target assignment. */
export async function createPromoCode(input, adminId = null) {
  const code = String(input?.code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  if (!code || code.length < 3 || code.length > 64) {
    throw new TypeError('Promo code must be 3-64 alphanumeric characters.');
  }
  const amountUsd = Number(input?.amountUsd);
  if (!Number.isFinite(amountUsd) || amountUsd <= 0 || amountUsd > 10000) {
    throw new TypeError('Promo gift amount must be between $0.01 and $10,000.');
  }
  const validityDays = Number.parseInt(input?.validityDays ?? 30, 10);
  if (!Number.isFinite(validityDays) || validityDays < 1 || validityDays > 3650) {
    throw new TypeError('Validity days must be at least 1.');
  }
  const minTopupUsd = Number(input?.minTopupUsd || 0);
  const rewardType = input?.rewardType === 'standard_credit' ? 'standard_credit' : 'promo_credit';
  const targetType = ['all', 'new_accounts', 'specific_users'].includes(input?.targetType) ? input.targetType : 'all';
  const targetEmails = normalizeEmailList(input?.targetEmails);
  const targetUserIds = normalizeIdList(input?.targetUserIds);
  if (targetType === 'specific_users' && targetEmails.length === 0 && targetUserIds.length === 0) {
    throw new TypeError('Specify at least one target email or user ID for targeted promotion.');
  }
  const maxTotalUses = input?.maxTotalUses === '' || input?.maxTotalUses == null
    ? null
    : Math.max(1, Number.parseInt(input.maxTotalUses, 10) || 1);
  const maxPerUser = Math.max(1, Number.parseInt(input?.maxPerUser ?? 1, 10) || 1);
  const expiresAt = input?.expiresAt ? new Date(input.expiresAt).toISOString() : null;

  const id = `promo_${randomUUID()}`;
  await queryPg(
    `INSERT INTO cloud_promo_codes
       (id, code, description, reward_type, amount_usd, validity_days, min_topup_usd,
        target_type, target_emails, target_user_ids, max_total_uses, max_per_user,
        one_per_device, new_accounts_only, is_active, expires_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14, $15, $16, $17)`,
    [
      id,
      code,
      String(input?.description || '').trim().slice(0, 300),
      rewardType,
      Number(amountUsd.toFixed(2)),
      validityDays,
      Number.isFinite(minTopupUsd) && minTopupUsd >= 0 ? Number(minTopupUsd.toFixed(2)) : 0,
      targetType,
      JSON.stringify(targetEmails),
      JSON.stringify(targetUserIds),
      maxTotalUses,
      maxPerUser,
      input?.onePerDevice !== false,
      input?.newAccountsOnly === true || targetType === 'new_accounts',
      input?.isActive !== false,
      expiresAt,
      adminId ? String(adminId).slice(0, 64) : null
    ]
  );

  const all = await listPromoCodes();
  return all.find((p) => p.id === id);
}

/** Update or toggle an existing promo code. */
export async function updatePromoCode(id, patch = {}) {
  const { rows } = await queryPg('SELECT * FROM cloud_promo_codes WHERE id = $1 LIMIT 1', [id]);
  const existing = rows[0];
  if (!existing) return null;

  const amountUsd = patch.amountUsd !== undefined ? Number(patch.amountUsd) : Number(existing.amount_usd);
  const validityDays = patch.validityDays !== undefined ? Number.parseInt(patch.validityDays, 10) : Number(existing.validity_days);
  const minTopupUsd = patch.minTopupUsd !== undefined ? Number(patch.minTopupUsd) : Number(existing.min_topup_usd || 0);
  const targetType = ['all', 'new_accounts', 'specific_users'].includes(patch.targetType) ? patch.targetType : existing.target_type;
  const targetEmails = patch.targetEmails !== undefined ? normalizeEmailList(patch.targetEmails) : existing.target_emails;
  const targetUserIds = patch.targetUserIds !== undefined ? normalizeIdList(patch.targetUserIds) : existing.target_user_ids;
  const isActive = patch.isActive !== undefined ? Boolean(patch.isActive) : existing.is_active;
  const onePerDevice = patch.onePerDevice !== undefined ? Boolean(patch.onePerDevice) : existing.one_per_device;
  const newAccountsOnly = patch.newAccountsOnly !== undefined ? Boolean(patch.newAccountsOnly) : existing.new_accounts_only;
  const description = patch.description !== undefined ? String(patch.description).trim().slice(0, 300) : existing.description;
  const maxTotalUses = patch.maxTotalUses === '' || patch.maxTotalUses === null
    ? (patch.maxTotalUses === undefined ? existing.max_total_uses : null)
    : Math.max(1, Number.parseInt(patch.maxTotalUses, 10) || 1);

  await queryPg(
    `UPDATE cloud_promo_codes
     SET description = $2,
         amount_usd = $3,
         validity_days = $4,
         min_topup_usd = $5,
         target_type = $6,
         target_emails = $7::jsonb,
         target_user_ids = $8::jsonb,
         max_total_uses = $9,
         one_per_device = $10,
         new_accounts_only = $11,
         is_active = $12,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [
      id,
      description,
      Number(amountUsd.toFixed(2)),
      validityDays,
      Number(minTopupUsd.toFixed(2)),
      targetType,
      JSON.stringify(targetEmails),
      JSON.stringify(targetUserIds),
      maxTotalUses,
      onePerDevice,
      newAccountsOnly,
      isActive
    ]
  );

  const all = await listPromoCodes();
  return all.find((p) => p.id === id);
}

export async function deletePromoCode(id) {
  const { rowCount } = await queryPg('DELETE FROM cloud_promo_codes WHERE id = $1', [id]);
  return rowCount > 0;
}

/** Return recent promotional gift & coupon claim audit records for admin review. */
export async function listPromoClaims({ limit = 100 } = {}) {
  if (!isPgActive()) return [];
  const { rows } = await queryPg(
    `SELECT c.id, c.claim_type, c.promo_code, c.user_id, c.amount_usd, c.validity_days,
            c.expires_at, c.status, c.created_at,
            u.email AS user_email, u.name AS user_name, u.tiwi_id, u.is_banned
     FROM system_promo_claims c
     LEFT JOIN system_users u ON u.id = c.user_id
     ORDER BY c.created_at DESC
     LIMIT $1`,
    [Math.min(250, Math.max(1, Number.parseInt(limit, 10) || 100))]
  );
  return rows.map((r) => ({
    id: Number(r.id),
    claimType: r.claim_type,
    promoCode: r.promo_code || null,
    userId: r.user_id,
    userEmail: r.user_email || '',
    userName: r.user_name || '',
    tiwiId: r.tiwi_id || '',
    isBanned: r.is_banned === true,
    amountUsd: Number(r.amount_usd || 0),
    validityDays: Number(r.validity_days || 30),
    expiresAt: r.expires_at ? new Date(r.expires_at).toISOString() : null,
    status: r.status,
    createdAt: new Date(r.created_at).toISOString()
  }));
}

async function queryMatchingPromoClaims({ claimType = null, promoCodeId = null, signals = {} }) {
  if (!isPgActive()) return [];
  const clauses = [];
  const params = [];
  const push = (col, val) => {
    if (!val) return;
    params.push(val);
    clauses.push(`${col} = $${params.length}`);
  };
  push('device_fingerprint_hash', signals.fingerprintHash);
  push('device_token_hash', signals.deviceTokenHash);
  push('browser_cookie_hash', signals.browserCookieHash);
  push('ip_hash', signals.ipHash);
  push('subnet_hash', signals.subnetHash);

  if (clauses.length === 0) return [];
  let scopeSql = '';
  if (claimType) {
    params.push(claimType);
    scopeSql += ` AND claim_type = $${params.length}`;
  }
  if (promoCodeId) {
    params.push(promoCodeId);
    scopeSql += ` AND promo_code_id = $${params.length}`;
  }

  const { rows } = await queryPg(
    `SELECT user_id, claim_type, promo_code_id, device_fingerprint_hash, device_token_hash,
            browser_cookie_hash, ip_hash, subnet_hash, user_agent_hash, status
     FROM system_promo_claims
     WHERE status = 'granted'${scopeSql} AND (${clauses.join(' OR ')})
     ORDER BY created_at DESC LIMIT 100`,
    params
  );
  return rows;
}

/** Check whether the current user is eligible to see/claim the Welcome Gift Offer on the Billing page. */
export async function getUserWelcomePromoStatus(userId, req = null) {
  const config = await getWelcomePromoSettings();
  if (!isPgActive() || !userId) {
    return { config, eligible: false, alreadyClaimed: false, hasPriorTopup: false };
  }

  const [{ rows: billingRows }, { rows: topupRows }, { rows: userRows }, { rows: claimRows }] = await Promise.all([
    queryPg(
      `SELECT welcome_promo_claimed_at, first_paid_topup_at, promotional_credits, promotional_expires_at
       FROM cloud_billing_accounts WHERE user_id = $1 LIMIT 1`,
      [userId]
    ),
    queryPg(
      `SELECT COUNT(*)::int AS paid_count FROM cloud_credit_topups WHERE user_id = $1 AND status = 'paid'`,
      [userId]
    ),
    queryPg(
      `SELECT role, is_banned FROM system_users WHERE id = $1 LIMIT 1`,
      [userId]
    ),
    queryPg(
      `SELECT c.id, c.claim_type, c.promo_code, c.amount_usd, c.validity_days, c.expires_at, c.created_at,
              p.reward_type
       FROM system_promo_claims c
       LEFT JOIN cloud_promo_codes p ON p.id = c.promo_code_id
       WHERE c.user_id = $1 AND c.status = 'granted'
       ORDER BY c.created_at DESC
       LIMIT 25`,
      [userId]
    )
  ]);

  const acct = billingRows[0] || {};
  const paidCount = Number(topupRows[0]?.paid_count || 0);
  const alreadyClaimed = Boolean(acct.welcome_promo_claimed_at);
  const hasPriorTopup = Boolean(acct.first_paid_topup_at) || paidCount > 0;
  const blocked = req ? await checkActiveBlockForRequest(req, userId) : null;
  const signals = req ? extractClientSignals(req) : {};
  const priorClaims = config.onePerDevice && !alreadyClaimed && !hasPriorTopup && req
    ? await queryMatchingPromoClaims({ claimType: 'welcome_bonus', signals })
    : [];

  const decision = evaluateWelcomeBonusEligibility({
    userId,
    config,
    accountState: {
      welcomePromoClaimedAt: acct.welcome_promo_claimed_at,
      firstPaidTopupAt: acct.first_paid_topup_at,
      hasPaidTopupsBefore: paidCount > 0
    },
    depositAmountUsd: config.minDepositUsd,
    signals,
    priorWelcomeClaims: priorClaims,
    blockedSignals: blocked ? [blocked] : [],
    isAdmin: ['admin', 'super_admin'].includes(userRows[0]?.role)
  });

  return {
    config,
    eligible: decision.eligible,
    ineligibleReason: decision.eligible ? null : decision.reason,
    alreadyClaimed,
    hasPriorTopup,
    promotionalCredits: Number(acct.promotional_credits || 0),
    promotionalExpiresAt: acct.promotional_expires_at ? new Date(acct.promotional_expires_at).toISOString() : null,
    claimedCoupons: (claimRows || []).map((row) => ({
      id: row.id,
      claimType: row.claim_type,
      promoCode: row.promo_code,
      rewardType: row.reward_type || (row.claim_type === 'welcome_bonus' ? 'promotional_credit' : 'standard_credit'),
      amountUsd: Number(row.amount_usd || 0),
      validityDays: Number(row.validity_days || 0),
      expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
    }))
  };
}

/**
 * Atomically evaluate and grant the New Account Credit-Load Welcome Bonus ($50 / 30 days)
 * when a verified payment completes. Enforces strict multi-device & multi-account bans.
 */
export async function tryGrantWelcomeDepositBonus({ userId, topup, hadPaidTopupsBefore = false }) {
  const config = await getWelcomePromoSettings();
  if (!config.enabled || !isPgActive() || !userId || !topup) {
    return { granted: false, reason: 'disabled' };
  }

  const [{ rows: billingRows }, { rows: userRows }] = await Promise.all([
    queryPg(
      `SELECT welcome_promo_claimed_at, first_paid_topup_at
       FROM cloud_billing_accounts WHERE user_id = $1 LIMIT 1`,
      [userId]
    ),
    queryPg(
      `SELECT id, email, name, store_name, role, is_banned FROM system_users WHERE id = $1 LIMIT 1`,
      [userId]
    )
  ]);

  const user = userRows[0];
  const acct = billingRows[0] || {};
  const signals = {
    fingerprintHash: topup.device_fingerprint_hash || null,
    deviceTokenHash: topup.device_token_hash || null,
    browserCookieHash: topup.browser_cookie_hash || null,
    ipHash: topup.ip_hash || null,
    subnetHash: topup.subnet_hash || null,
    userAgentHash: topup.user_agent_hash || null
  };

  const priorClaims = config.onePerDevice
    ? await queryMatchingPromoClaims({ claimType: 'welcome_bonus', signals })
    : [];

  const decision = evaluateWelcomeBonusEligibility({
    userId,
    config,
    accountState: {
      welcomePromoClaimedAt: acct.welcome_promo_claimed_at,
      firstPaidTopupAt: acct.first_paid_topup_at,
      hasPaidTopupsBefore: hadPaidTopupsBefore
    },
    depositAmountUsd: Number(topup.amount || 0),
    signals,
    priorWelcomeClaims: priorClaims,
    isAdmin: ['admin', 'super_admin'].includes(user?.role)
  });

  await queryPg(
    `UPDATE cloud_billing_accounts
     SET first_paid_topup_at = COALESCE(first_paid_topup_at, CURRENT_TIMESTAMP),
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1`,
    [userId]
  );

  if (!decision.eligible) {
    if (decision.matchedUsers?.length || decision.shouldBanAccount) {
      await recordSecurityEvent({
        eventType: `security.${String(decision.code || 'promo_abuse').toLowerCase()}`,
        severity: decision.shouldBanAccount ? 'critical' : 'warning',
        userId,
        subject: user?.email || userId,
        details: {
          code: decision.code,
          reason: decision.reason,
          matchedUsers: (decision.matchedUsers || []).join(',')
        }
      }).catch(() => {});

      await queryPg(
        `INSERT INTO system_promo_claims
           (claim_type, promo_code, user_id, amount_usd, validity_days,
            device_fingerprint_hash, device_token_hash, browser_cookie_hash, ip_hash, subnet_hash, user_agent_hash, status)
         VALUES ('welcome_bonus', 'WELCOME_DEPOSIT_GIFT', $1, 0, $2, $3, $4, $5, $6, $7, $8, 'rejected')`,
        [
          userId,
          config.validityDays,
          signals.fingerprintHash,
          signals.deviceTokenHash,
          signals.browserCookieHash,
          signals.ipHash,
          signals.subnetHash,
          signals.userAgentHash
        ]
      ).catch(() => {});

      if (decision.shouldBanAccount) {
        await activateBanAndBlockSignals({
          userId,
          user,
          reason: decision.reason,
          signals,
          blockSignalTypes: decision.blockSignalTypes || ['user', 'fingerprint', 'device_token', 'browser_cookie', 'ip'],
          banAccount: true
        }).catch(() => {});
      }
    }
    return { granted: false, code: decision.code, reason: decision.reason };
  }

  const bonusAmount = decision.bonusAmountUsd;
  const validityDays = decision.validityDays;
  const { rows: updated } = await queryPg(
    `UPDATE cloud_billing_accounts
     SET promotional_credits = COALESCE(promotional_credits, 0) + $2,
         promotional_expires_at = CURRENT_TIMESTAMP + ($3 * INTERVAL '1 day'),
         welcome_promo_claimed_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND welcome_promo_claimed_at IS NULL
     RETURNING promotional_credits, promotional_expires_at`,
    [userId, bonusAmount, validityDays]
  );

  if (!updated[0]) {
    return { granted: false, code: 'ALREADY_CLAIMED', reason: 'Welcome gift already claimed.' };
  }

  await queryPg(
    `INSERT INTO system_promo_claims
       (claim_type, promo_code, user_id, amount_usd, validity_days, expires_at,
        device_fingerprint_hash, device_token_hash, browser_cookie_hash, ip_hash, subnet_hash, user_agent_hash, status)
     VALUES ('welcome_bonus', 'WELCOME_DEPOSIT_GIFT', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'granted')`,
    [
      userId,
      bonusAmount,
      validityDays,
      updated[0].promotional_expires_at,
      signals.fingerprintHash,
      signals.deviceTokenHash,
      signals.browserCookieHash,
      signals.ipHash,
      signals.subnetHash,
      signals.userAgentHash
    ]
  );

  await recordPlatformBillingOrder({
    userId,
    orderType: 'promo_grant',
    itemName: 'Welcome Deposit Gift (WELCOME_DEPOSIT_GIFT)',
    grossAmountUsd: bonusAmount,
    cashCreditUsedUsd: 0,
    promoCreditUsedUsd: 0,
    netCashRevenueUsd: 0,
    provider: 'promotion',
    currency: 'USD',
    status: 'paid',
    metadata: { claimType: 'welcome_bonus', promoCode: 'WELCOME_DEPOSIT_GIFT', validityDays }
  });

  return {
    granted: true,
    bonusAmountUsd: bonusAmount,
    validityDays,
    promotionalCredits: Number(updated[0].promotional_credits),
    promotionalExpiresAt: updated[0].promotional_expires_at
  };
}

/** Redeem a targeted/configurable admin promo code for a user with multi-device protection. */
export async function redeemPromoCodeForUser({ userId, rawCode, req = null }) {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!isPgActive() || !code) return { found: false };

  const { rows: promoRows } = await queryPg(
    `SELECT * FROM cloud_promo_codes WHERE UPPER(BTRIM(code)) = $1 LIMIT 1`,
    [code]
  );
  const promo = promoRows[0];
  if (!promo) return { found: false };

  const [{ rows: userRows }, { rows: billingRows }, { rows: topupRows }, { rows: claimCountRows }] = await Promise.all([
    queryPg('SELECT id, tiwi_id, email, name, store_name, role, is_banned FROM system_users WHERE id = $1 LIMIT 1', [userId]),
    queryPg('SELECT welcome_promo_claimed_at, first_paid_topup_at FROM cloud_billing_accounts WHERE user_id = $1 LIMIT 1', [userId]),
    queryPg(`SELECT COALESCE(SUM(amount), 0)::numeric AS total_paid FROM cloud_credit_topups WHERE user_id = $1 AND status = 'paid'`, [userId]),
    queryPg(`SELECT COUNT(*)::int AS cnt FROM system_promo_claims WHERE promo_code_id = $1 AND user_id = $2 AND status = 'granted'`, [promo.id, userId])
  ]);

  const user = userRows[0];
  if (!user) return { found: true, success: false, error: 'Account unavailable.' };
  const totalPaidTopupUsd = Number(topupRows[0]?.total_paid || 0);
  const existingUserClaimsCount = Number(claimCountRows[0]?.cnt || 0);
  const acct = billingRows[0] || {};
  const signals = extractClientSignals(req);
  const blocked = await checkActiveBlockForRequest(req, userId);
  const priorCodeClaims = promo.one_per_device !== false
    ? await queryMatchingPromoClaims({ promoCodeId: promo.id, signals })
    : [];

  const decision = evaluatePromoCodeRedemption({
    promo,
    user: { id: user.id, tiwiId: user.tiwi_id, email: user.email, role: user.role },
    accountState: {
      welcomePromoClaimedAt: acct.welcome_promo_claimed_at,
      firstPaidTopupAt: acct.first_paid_topup_at,
      hasPaidTopupsBefore: totalPaidTopupUsd > 0
    },
    totalPaidTopupUsd,
    existingUserClaimsCount,
    priorCodeClaims,
    signals,
    blockedSignals: blocked ? [blocked] : []
  });

  if (!decision.eligible) {
    if (decision.matchedUsers?.length || decision.shouldBanAccount) {
      await recordSecurityEvent({
        eventType: `security.${String(decision.code || 'promo_code_abuse').toLowerCase()}`,
        severity: decision.shouldBanAccount ? 'critical' : 'warning',
        userId,
        subject: user.email,
        ip: signals.ip,
        userAgent: req?.get?.('user-agent'),
        details: { promoCode: promo.code, matchedUsers: (decision.matchedUsers || []).join(',') }
      }).catch(() => {});

      await queryPg(
        `INSERT INTO system_promo_claims
           (claim_type, promo_code_id, promo_code, user_id, amount_usd, validity_days,
            device_fingerprint_hash, device_token_hash, browser_cookie_hash, ip_hash, subnet_hash, user_agent_hash, status)
         VALUES ('promo_code', $1, $2, $3, 0, $4, $5, $6, $7, $8, $9, $10, 'rejected')`,
        [
          promo.id, promo.code, userId, Number(promo.validity_days || 30),
          signals.fingerprintHash, signals.deviceTokenHash, signals.browserCookieHash,
          signals.ipHash, signals.subnetHash, signals.userAgentHash
        ]
      ).catch(() => {});

      if (decision.shouldBanAccount) {
        await activateBanAndBlockSignals({
          userId,
          user,
          reason: decision.reason,
          signals,
          blockSignalTypes: decision.blockSignalTypes || ['user', 'fingerprint', 'device_token', 'browser_cookie', 'ip'],
          banAccount: true
        }).catch(() => {});
      }
    }

    return {
      found: true,
      success: false,
      statusCode: decision.statusCode || 403,
      code: decision.code,
      banned: Boolean(decision.shouldBanAccount),
      error: decision.reason
    };
  }

  const { rows: updatedPromo } = await queryPg(
    `UPDATE cloud_promo_codes
     SET uses_count = uses_count + 1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND is_active = TRUE
       AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
       AND (max_total_uses IS NULL OR uses_count < max_total_uses)
     RETURNING id`,
    [promo.id]
  );

  if (!updatedPromo[0]) {
    return { found: true, success: false, statusCode: 409, error: 'This promotional code has reached its redemption limit.' };
  }

  const isStandard = decision.rewardType === 'standard_credit';
  const amountUsd = decision.amountUsd;
  const validityDays = decision.validityDays;
  const { rows: updatedAcct } = isStandard
    ? await queryPg(
      `INSERT INTO cloud_billing_accounts (id, user_id, credits, monthly_spend, currency)
       VALUES ($1, $2, $3, 0, 'USD')
       ON CONFLICT (user_id) DO UPDATE SET
         credits = COALESCE(cloud_billing_accounts.credits, 0) + $3,
         updated_at = CURRENT_TIMESTAMP
       RETURNING credits, promotional_credits, promotional_expires_at`,
      [randomUUID(), userId, amountUsd]
    )
    : await queryPg(
      `INSERT INTO cloud_billing_accounts (id, user_id, credits, promotional_credits, promotional_expires_at, monthly_spend, currency)
       VALUES ($1, $2, 0, $3, CURRENT_TIMESTAMP + ($4 * INTERVAL '1 day'), 0, 'USD')
       ON CONFLICT (user_id) DO UPDATE SET
         promotional_credits = COALESCE(cloud_billing_accounts.promotional_credits, 0) + $3,
         promotional_expires_at = GREATEST(
           COALESCE(cloud_billing_accounts.promotional_expires_at, CURRENT_TIMESTAMP),
           CURRENT_TIMESTAMP + ($4 * INTERVAL '1 day')
         ),
         updated_at = CURRENT_TIMESTAMP
       RETURNING credits, promotional_credits, promotional_expires_at`,
      [randomUUID(), userId, amountUsd, validityDays]
    );

  const expiresAt = isStandard ? null : updatedAcct[0]?.promotional_expires_at || null;
  await queryPg(
    `INSERT INTO system_promo_claims
       (claim_type, promo_code_id, promo_code, user_id, amount_usd, validity_days, expires_at,
        device_fingerprint_hash, device_token_hash, browser_cookie_hash, ip_hash, subnet_hash, user_agent_hash, status)
     VALUES ('promo_code', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'granted')`,
    [
      promo.id, promo.code, userId, amountUsd, validityDays, expiresAt,
      signals.fingerprintHash, signals.deviceTokenHash, signals.browserCookieHash,
      signals.ipHash, signals.subnetHash, signals.userAgentHash
    ]
  );

  await recordPlatformBillingOrder({
    userId,
    orderType: 'promo_grant',
    itemName: `Promo Code (${promo.code})`,
    grossAmountUsd: amountUsd,
    cashCreditUsedUsd: 0,
    promoCreditUsedUsd: 0,
    netCashRevenueUsd: 0,
    provider: 'promotion',
    currency: 'USD',
    status: 'paid',
    metadata: {
      claimType: 'promo_code',
      promoCodeId: promo.id,
      promoCode: promo.code,
      rewardType: decision.rewardType,
      validityDays
    }
  });

  return {
    found: true,
    success: true,
    promoCode: promo.code,
    rewardType: decision.rewardType,
    addedCredits: amountUsd,
    validityDays,
    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    balance: Number(updatedAcct[0]?.credits || 0),
    promotionalBalance: Number(updatedAcct[0]?.promotional_credits || 0)
  };
}
