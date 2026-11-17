import { randomUUID } from 'node:crypto';
import { getPgPool, isPgActive, queryPg } from './postgres.js';
import { BillingDB } from './billing.js';
import { sendServicePaymentFailureEmail } from './emailService.js';
import {
  getDiscordPackageById,
  getDiscordPackages,
  getWhatsappPackageById,
  getWhatsappPackages
} from './packages.js';

export const SERVICE_TYPES = new Set(['discord', 'whatsapp']);
const BILLING_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export const SERVICE_SUBSCRIPTIONS_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS platform_service_subscriptions (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    service_type VARCHAR(32) NOT NULL CHECK (service_type IN ('discord', 'whatsapp')),
    plan_id VARCHAR(64) NOT NULL,
    plan_name VARCHAR(128) NOT NULL,
    price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    limits_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    usage_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    auto_renew BOOLEAN NOT NULL DEFAULT TRUE,
    renewal_failure_count INTEGER NOT NULL DEFAULT 0,
    last_renewal_error TEXT,
    last_renewal_attempt_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, service_type)
  );
  ALTER TABLE platform_service_subscriptions ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE;
  ALTER TABLE platform_service_subscriptions ADD COLUMN IF NOT EXISTS renewal_failure_count INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE platform_service_subscriptions ADD COLUMN IF NOT EXISTS last_renewal_error TEXT;
  ALTER TABLE platform_service_subscriptions ADD COLUMN IF NOT EXISTS last_renewal_attempt_at TIMESTAMP WITH TIME ZONE;
  CREATE INDEX IF NOT EXISTS idx_platform_service_subs_user ON platform_service_subscriptions(user_id, service_type);
  CREATE INDEX IF NOT EXISTS idx_platform_service_subs_type ON platform_service_subscriptions(service_type, updated_at DESC);

  CREATE TABLE IF NOT EXISTS platform_service_notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    service_type VARCHAR(32) NOT NULL CHECK (service_type IN ('discord', 'whatsapp')),
    kind VARCHAR(48) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_platform_service_notifications_user
    ON platform_service_notifications(user_id, service_type, created_at DESC);
`;

const memorySubscriptions = new Map();
const memoryServiceNotifications = new Map();
let schemaEnsured = false;
let isRenewalSweepRunning = false;
let serviceRenewalTimer = null;

export function resetMemoryServiceSubscriptions() {
  memorySubscriptions.clear();
  memoryServiceNotifications.clear();
}

export async function ensureServiceSubscriptionsSchema(queryable = null) {
  if (queryable) {
    if (typeof queryable.exec === 'function') {
      await queryable.exec(SERVICE_SUBSCRIPTIONS_SCHEMA_SQL);
    } else {
      await queryable.query(SERVICE_SUBSCRIPTIONS_SCHEMA_SQL);
    }
    schemaEnsured = true;
    return true;
  }
  if (!isPgActive() || schemaEnsured) return false;
  await queryPg(SERVICE_SUBSCRIPTIONS_SCHEMA_SQL);
  schemaEnsured = true;
  return true;
}

function getMemKey(userId, serviceType) {
  return `${String(userId)}::${String(serviceType)}`;
}

function todayDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function currentMonthKey(now = new Date()) {
  return now.toISOString().slice(0, 7);
}

function normalizeServiceType(serviceType) {
  const normalized = String(serviceType || '').trim().toLowerCase();
  if (!SERVICE_TYPES.has(normalized)) {
    throw new Error('Unsupported service type. Must be "discord" or "whatsapp".');
  }
  return normalized;
}

function extractPlanLimits(serviceType, plan) {
  if (serviceType === 'discord') {
    return {
      maxBots: Number(plan.maxBots ?? 1),
      maxServersPerBot: Number(plan.maxServersPerBot ?? 1),
      monthlyCommandsLimit: Number(plan.monthlyCommandsLimit ?? 2500),
      autoModEnabled: Boolean(plan.autoModEnabled),
      webhookLimit: Number(plan.webhookLimit ?? 2),
      customBranding: Boolean(plan.customBranding)
    };
  }
  return {
    maxSessions: Number(plan.maxSessions ?? 1),
    monthlyMessagesLimit: Number(plan.monthlyMessagesLimit ?? 2000),
    dailyBroadcastLimit: Number(plan.dailyBroadcastLimit ?? 100),
    autoReplyFlowsLimit: Number(plan.autoReplyFlowsLimit ?? 3),
    contactLimit: Number(plan.contactLimit ?? 1000),
    webhookEnabled: Boolean(plan.webhookEnabled)
  };
}

function normalizeUsage(rawUsage = {}, now = new Date()) {
  const monthKey = currentMonthKey(now);
  const dateKey = todayDateKey(now);
  const sameMonth = rawUsage?.monthKey === monthKey;
  const sameDay = rawUsage?.dailyBroadcastDate === dateKey;
  return {
    monthKey,
    monthlyCommands: sameMonth ? Math.max(0, Number(rawUsage.monthlyCommands || 0)) : 0,
    monthlyMessages: sameMonth ? Math.max(0, Number(rawUsage.monthlyMessages || 0)) : 0,
    dailyBroadcastDate: dateKey,
    dailyBroadcasts: sameDay ? Math.max(0, Number(rawUsage.dailyBroadcasts || 0)) : 0
  };
}

function mapSubscriptionRow(row, now = new Date()) {
  if (!row) return null;
  const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
  const isExpired = Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
  const effectiveStatus = isExpired && row.status === 'active' ? 'expired' : (row.status || 'active');
  const limits = row.limits_json && typeof row.limits_json === 'object' ? row.limits_json : (row.limits || {});
  const usage = normalizeUsage(row.usage_json && typeof row.usage_json === 'object' ? row.usage_json : (row.usage || {}), now);
  const autoRenew = row.auto_renew !== undefined
    ? Boolean(row.auto_renew)
    : (row.autoRenew !== undefined ? Boolean(row.autoRenew) : true);
  const lastRenewalAttemptRaw = row.last_renewal_attempt_at ?? row.lastRenewalAttemptAt;
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    serviceType: row.service_type ?? row.serviceType,
    planId: row.plan_id ?? row.planId,
    planName: row.plan_name ?? row.planName,
    price: Number(row.price || 0),
    limits,
    usage,
    status: effectiveStatus,
    isActive: effectiveStatus === 'active' && !isExpired && Number(row.price || 0) > 0,
    autoRenew,
    renewalFailureCount: Number(row.renewal_failure_count ?? row.renewalFailureCount ?? 0),
    lastRenewalError: row.last_renewal_error ?? row.lastRenewalError ?? null,
    lastRenewalAttemptAt: lastRenewalAttemptRaw ? new Date(lastRenewalAttemptRaw).toISOString() : null,
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : row.startedAt,
    expiresAt: expiresAt ? expiresAt.toISOString() : row.expiresAt,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt
  };
}

function mapNotificationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    serviceType: row.service_type ?? row.serviceType,
    kind: row.kind,
    title: row.title,
    message: row.message,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : {},
    readAt: row.read_at ? new Date(row.read_at).toISOString() : (row.readAt || null),
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : (row.createdAt || new Date().toISOString())
  };
}

export async function recordServiceNotification({
  userId,
  serviceType,
  kind = 'payment_failed',
  title,
  message,
  metadata = {},
  now = new Date()
} = {}) {
  if (!userId) return null;
  const normalizedType = normalizeServiceType(serviceType);
  const id = `snotif_${randomUUID()}`;
  const createdAtIso = (now instanceof Date ? now : new Date(now)).toISOString();
  const safeMetadata = metadata && typeof metadata === 'object' ? metadata : {};

  if (!isPgActive()) {
    const record = {
      id,
      user_id: String(userId),
      service_type: normalizedType,
      kind: String(kind || 'payment_failed'),
      title: String(title || 'Service Notification'),
      message: String(message || ''),
      metadata: safeMetadata,
      read_at: null,
      created_at: createdAtIso
    };
    const existing = memoryServiceNotifications.get(String(userId)) || [];
    existing.unshift(record);
    memoryServiceNotifications.set(String(userId), existing.slice(0, 200));
    return mapNotificationRow(record);
  }

  await ensureServiceSubscriptionsSchema();
  const { rows } = await queryPg(
    `INSERT INTO platform_service_notifications
       (id, user_id, service_type, kind, title, message, metadata, read_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NULL, $8)
     RETURNING *`,
    [
      id,
      String(userId),
      normalizedType,
      String(kind || 'payment_failed').slice(0, 48),
      String(title || 'Service Notification').slice(0, 255),
      String(message || ''),
      JSON.stringify(safeMetadata),
      createdAtIso
    ]
  );
  return mapNotificationRow(rows?.[0]);
}

export async function listServiceNotifications(userId, { serviceType = null, unreadOnly = false, limit = 50 } = {}) {
  if (!userId) return [];
  const normalizedType = serviceType ? normalizeServiceType(serviceType) : null;
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 50));

  if (!isPgActive()) {
    let items = (memoryServiceNotifications.get(String(userId)) || []).map(mapNotificationRow);
    if (normalizedType) items = items.filter((n) => n.serviceType === normalizedType);
    if (unreadOnly) items = items.filter((n) => !n.readAt);
    return items
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, safeLimit);
  }

  await ensureServiceSubscriptionsSchema();
  const values = [String(userId)];
  const conditions = ['user_id = $1'];
  if (normalizedType) {
    values.push(normalizedType);
    conditions.push(`service_type = $${values.length}`);
  }
  if (unreadOnly) {
    conditions.push('read_at IS NULL');
  }
  values.push(safeLimit);
  const { rows } = await queryPg(
    `SELECT * FROM platform_service_notifications
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${values.length}`,
    values
  );
  return (rows || []).map(mapNotificationRow);
}

export async function markServiceNotificationsRead(userId, { serviceType = null, notificationId = null, now = new Date() } = {}) {
  if (!userId) return { success: false, updatedCount: 0 };
  const normalizedType = serviceType ? normalizeServiceType(serviceType) : null;
  const readAtIso = (now instanceof Date ? now : new Date(now)).toISOString();

  if (!isPgActive()) {
    const items = memoryServiceNotifications.get(String(userId)) || [];
    let updatedCount = 0;
    for (const item of items) {
      if (item.read_at) continue;
      if (normalizedType && item.service_type !== normalizedType) continue;
      if (notificationId && item.id !== String(notificationId)) continue;
      item.read_at = readAtIso;
      updatedCount++;
    }
    return { success: true, updatedCount };
  }

  await ensureServiceSubscriptionsSchema();
  const values = [readAtIso, String(userId)];
  const conditions = ['user_id = $2', 'read_at IS NULL'];
  if (normalizedType) {
    values.push(normalizedType);
    conditions.push(`service_type = $${values.length}`);
  }
  if (notificationId) {
    values.push(String(notificationId));
    conditions.push(`id = $${values.length}`);
  }
  const { rows } = await queryPg(
    `UPDATE platform_service_notifications
     SET read_at = $1
     WHERE ${conditions.join(' AND ')}
     RETURNING id`,
    values
  );
  return { success: true, updatedCount: rows?.length || 0 };
}

async function resolveUserContactInfo(userId) {
  if (!userId || !getPgPool()) return null;
  try {
    const { rows } = await queryPg(
      `SELECT email, name, store_name FROM system_users WHERE id = $1 LIMIT 1`,
      [String(userId)]
    );
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

async function notifyPaymentFailure({
  userId,
  serviceType,
  planId,
  planName,
  amountDue,
  reason,
  failureCount = 1,
  source = 'purchase',
  userEmail = null,
  userName = null,
  sendFailureEmailFn = sendServicePaymentFailureEmail,
  now = new Date()
} = {}) {
  const serviceLabel = serviceType === 'whatsapp' ? 'WhatsApp Automation' : 'Discord Bot Manager';
  const notification = await recordServiceNotification({
    userId,
    serviceType,
    kind: 'payment_failed',
    title: source === 'auto_renewal'
      ? `${serviceLabel} auto-renewal payment failed`
      : `${serviceLabel} payment failed`,
    message: `Could not charge $${Number(amountDue || 0).toFixed(2)} USD for ${planName}: ${reason}`,
    metadata: {
      planId,
      planName,
      amountDue: Number(amountDue || 0),
      reason,
      failureCount,
      source
    },
    now
  }).catch(() => null);

  if (typeof sendFailureEmailFn === 'function') {
    try {
      let recipient = userEmail;
      let recipientName = userName;
      if (!recipient) {
        const contact = await resolveUserContactInfo(userId);
        recipient = contact?.email || null;
        recipientName = recipientName || contact?.store_name || contact?.name || null;
      }
      if (recipient) {
        await sendFailureEmailFn({
          to: recipient,
          name: recipientName || 'Customer',
          serviceType,
          planName,
          amountDue: Number(amountDue || 0),
          currency: 'USD',
          reason,
          failureCount
        });
      }
    } catch {
      // Never let email transport failures disrupt billing or renewal flow
    }
  }

  return notification;
}

async function getPackagesForService(serviceType) {
  const packages = serviceType === 'discord'
    ? await getDiscordPackages()
    : await getWhatsappPackages();
  return packages.filter((pkg) => pkg.enabled !== false && Number(pkg.price || 0) > 0);
}

async function getPackageByIdForService(serviceType, planId) {
  const pkg = serviceType === 'discord'
    ? await getDiscordPackageById(planId)
    : await getWhatsappPackageById(planId);
  return pkg;
}

export async function getServiceSubscription(userId, serviceType) {
  if (!userId) return null;
  const normalizedType = normalizeServiceType(serviceType);
  if (!isPgActive()) {
    const existing = memorySubscriptions.get(getMemKey(userId, normalizedType));
    return existing ? mapSubscriptionRow(existing) : null;
  }
  await ensureServiceSubscriptionsSchema();
  const { rows } = await queryPg(
    `SELECT * FROM platform_service_subscriptions
     WHERE user_id = $1 AND service_type = $2
     LIMIT 1`,
    [String(userId), normalizedType]
  );
  return mapSubscriptionRow(rows?.[0]);
}

export async function subscribeServiceWithCredits({
  userId,
  userRole = 'owner',
  serviceType,
  planId,
  autoRenew,
  billingDB = BillingDB,
  customPlan = null,
  userEmail = null,
  userName = null,
  sendFailureEmailFn = sendServicePaymentFailureEmail
} = {}) {
  if (!userId) {
    return {
      success: false,
      statusCode: 401,
      code: 'AUTH_REQUIRED',
      error: 'Authentication required.'
    };
  }
  const normalizedType = normalizeServiceType(serviceType);
  const normalizedPlanId = String(planId || '').trim().toLowerCase();
  if (!normalizedPlanId) {
    const packages = await getPackagesForService(normalizedType);
    return {
      success: false,
      statusCode: 400,
      code: 'PLAN_REQUIRED',
      error: 'Please select a paid subscription plan.',
      packages
    };
  }

  const planInfo = customPlan || (await getPackageByIdForService(normalizedType, normalizedPlanId));
  if (!planInfo || planInfo.enabled === false) {
    const packages = await getPackagesForService(normalizedType);
    return {
      success: false,
      statusCode: 400,
      code: 'INVALID_PLAN',
      error: 'Selected subscription plan is invalid or disabled.',
      packages
    };
  }

  const effectivePrice = Number(planInfo.price || 0);
  if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) {
    const packages = await getPackagesForService(normalizedType);
    return {
      success: false,
      statusCode: 402,
      code: 'SUBSCRIPTION_REQUIRED',
      error: 'Free plans are not permitted for this service. Please select a paid subscription plan.',
      packages
    };
  }

  const existing = await getServiceSubscription(userId, normalizedType);
  const resolvedAutoRenew = typeof autoRenew === 'boolean'
    ? autoRenew
    : (existing ? Boolean(existing.autoRenew) : true);
  const isAdminBypass = userRole === 'admin' || userRole === 'super_admin';
  let chargeResult = {
    success: true,
    chargedAmount: 0,
    cashCreditUsed: 0,
    promoCreditUsed: 0,
    orderNumber: null,
    invoice: null,
    remainingCredits: null
  };

  if (!isAdminBypass) {
    chargeResult = await billingDB.chargeSubscriptionPlan(userId, effectivePrice, planInfo.planName, {
      orderType: `${normalizedType}_subscription`,
      planId: planInfo.planId,
      metadata: {
        serviceType: normalizedType,
        planId: planInfo.planId,
        planName: planInfo.planName,
        autoRenew: resolvedAutoRenew
      }
    });
    if (!chargeResult?.success) {
      const packages = await getPackagesForService(normalizedType);
      const failureReason = chargeResult?.error || `Insufficient verified billing credits ($${effectivePrice.toFixed(2)} USD required for ${planInfo.planName}).`;
      await notifyPaymentFailure({
        userId,
        serviceType: normalizedType,
        planId: planInfo.planId,
        planName: planInfo.planName,
        amountDue: effectivePrice,
        reason: failureReason,
        failureCount: Number(existing?.renewalFailureCount || 0) + 1,
        source: 'purchase',
        userEmail,
        userName,
        sendFailureEmailFn
      });
      return {
        success: false,
        statusCode: chargeResult?.statusCode || 402,
        code: 'INSUFFICIENT_CREDITS',
        error: failureReason,
        requiredCredits: effectivePrice,
        requiredAmount: chargeResult?.requiredAmount ?? effectivePrice,
        availableCredits: chargeResult?.availableCredits,
        shortfall: chargeResult?.shortfall,
        packages
      };
    }
  } else if (typeof billingDB?.recordSubscriptionInvoice === 'function') {
    const adminInvoice = await billingDB.recordSubscriptionInvoice(userId, {
      amountUsd: 0,
      cashCreditUsedUsd: 0,
      promoCreditUsedUsd: 0,
      planName: `${planInfo.planName} (Admin)`,
      orderType: `${normalizedType}_subscription`,
      planId: planInfo.planId,
      provider: 'admin_grant',
      status: 'free',
      metadata: {
        serviceType: normalizedType,
        planId: planInfo.planId,
        planName: planInfo.planName,
        adminBypass: true
      }
    }).catch(() => null);
    chargeResult = {
      ...chargeResult,
      orderNumber: adminInvoice?.orderNumber || null,
      invoice: adminInvoice || null
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + BILLING_PERIOD_MS);
  const limits = extractPlanLimits(normalizedType, planInfo);
  const nextUsage = existing?.isActive
    ? normalizeUsage(existing.usage, now)
    : normalizeUsage({}, now);
  const orderNumber = chargeResult?.orderNumber || chargeResult?.invoice?.orderNumber || null;
  const invoice = chargeResult?.invoice || null;

  if (!isPgActive()) {
    const record = {
      id: existing?.id || `sub_${randomUUID()}`,
      user_id: String(userId),
      service_type: normalizedType,
      plan_id: planInfo.planId,
      plan_name: planInfo.planName,
      price: effectivePrice,
      limits_json: limits,
      usage_json: nextUsage,
      status: 'active',
      auto_renew: resolvedAutoRenew,
      renewal_failure_count: 0,
      last_renewal_error: null,
      last_renewal_attempt_at: now.toISOString(),
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString()
    };
    memorySubscriptions.set(getMemKey(userId, normalizedType), record);
    return {
      success: true,
      subscription: mapSubscriptionRow(record, now),
      chargeResult,
      orderNumber,
      invoice
    };
  }

  await ensureServiceSubscriptionsSchema();
  const id = existing?.id || `sub_${randomUUID()}`;
  const { rows } = await queryPg(
    `INSERT INTO platform_service_subscriptions
       (id, user_id, service_type, plan_id, plan_name, price, limits_json, usage_json, status,
        auto_renew, renewal_failure_count, last_renewal_error, last_renewal_attempt_at,
        started_at, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'active', $9, 0, NULL, $10, $10, $11, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, service_type) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       plan_name = EXCLUDED.plan_name,
       price = EXCLUDED.price,
       limits_json = EXCLUDED.limits_json,
       usage_json = EXCLUDED.usage_json,
       status = 'active',
       auto_renew = EXCLUDED.auto_renew,
       renewal_failure_count = 0,
       last_renewal_error = NULL,
       last_renewal_attempt_at = EXCLUDED.last_renewal_attempt_at,
       started_at = EXCLUDED.started_at,
       expires_at = EXCLUDED.expires_at,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [
      id,
      String(userId),
      normalizedType,
      planInfo.planId,
      planInfo.planName,
      effectivePrice,
      JSON.stringify(limits),
      JSON.stringify(nextUsage),
      resolvedAutoRenew,
      now.toISOString(),
      expiresAt.toISOString()
    ]
  );

  return {
    success: true,
    subscription: mapSubscriptionRow(rows[0], now),
    chargeResult,
    orderNumber,
    invoice
  };
}

export async function setServiceAutoRenew({ userId, serviceType, autoRenew } = {}) {
  if (!userId) {
    return { success: false, statusCode: 401, code: 'AUTH_REQUIRED', error: 'Authentication required.' };
  }
  const normalizedType = normalizeServiceType(serviceType);
  if (typeof autoRenew !== 'boolean') {
    return { success: false, statusCode: 400, code: 'INVALID_AUTO_RENEW', error: 'autoRenew must be a boolean.' };
  }
  const existing = await getServiceSubscription(userId, normalizedType);
  if (!existing) {
    return {
      success: false,
      statusCode: 404,
      code: 'SUBSCRIPTION_NOT_FOUND',
      error: `No ${normalizedType} subscription found to update.`
    };
  }
  const now = new Date();
  if (!isPgActive()) {
    const key = getMemKey(userId, normalizedType);
    const record = memorySubscriptions.get(key);
    record.auto_renew = autoRenew;
    record.updated_at = now.toISOString();
    return {
      success: true,
      subscription: mapSubscriptionRow(record, now)
    };
  }
  await ensureServiceSubscriptionsSchema();
  const { rows } = await queryPg(
    `UPDATE platform_service_subscriptions
     SET auto_renew = $3, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND service_type = $2
     RETURNING *`,
    [String(userId), normalizedType, autoRenew]
  );
  return {
    success: true,
    subscription: mapSubscriptionRow(rows?.[0], now)
  };
}

export async function checkServiceLimit(userId, serviceType, usageCounts = {}) {
  const normalizedType = normalizeServiceType(serviceType);
  const packages = await getPackagesForService(normalizedType);

  if (!userId) {
    return {
      allowed: false,
      statusCode: 401,
      code: 'AUTH_REQUIRED',
      error: 'Authentication required.',
      serviceType: normalizedType,
      packages
    };
  }

  const subscription = await getServiceSubscription(userId, normalizedType);
  if (!subscription || !subscription.isActive) {
    return {
      allowed: false,
      statusCode: 402,
      code: 'SUBSCRIPTION_REQUIRED',
      error: `An active paid ${normalizedType === 'discord' ? 'Discord Bot' : 'WhatsApp Automation'} subscription is required.`,
      serviceType: normalizedType,
      subscription,
      packages
    };
  }

  const limits = subscription.limits || {};
  const usage = subscription.usage || {};

  if (normalizedType === 'discord') {
    if (usageCounts.botsCount !== undefined && Number(usageCounts.botsCount) >= Number(limits.maxBots ?? 1)) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        metric: 'maxBots',
        limit: Number(limits.maxBots ?? 1),
        current: Number(usageCounts.botsCount),
        error: `Plan limit reached: your ${subscription.planName} plan allows up to ${limits.maxBots} bot instance(s). Upgrade to add more.`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
    if (usageCounts.serversCount !== undefined && Number(usageCounts.serversCount) >= Number(limits.maxServersPerBot ?? 1)) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        metric: 'maxServersPerBot',
        limit: Number(limits.maxServersPerBot ?? 1),
        current: Number(usageCounts.serversCount),
        error: `Server limit reached: your ${subscription.planName} plan allows up to ${limits.maxServersPerBot} connected Discord server(s). Upgrade your plan to connect more servers.`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
    const monthlyCommands = usageCounts.monthlyCommands !== undefined
      ? Number(usageCounts.monthlyCommands)
      : Number(usage.monthlyCommands || 0);
    const incrementCommands = Number(usageCounts.incrementCommands || 0);
    const commandsLimit = Number(limits.monthlyCommandsLimit ?? 2500);
    if (usageCounts.checkCommands && (monthlyCommands >= commandsLimit || monthlyCommands + incrementCommands > commandsLimit)) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        metric: 'monthlyCommandsLimit',
        limit: commandsLimit,
        current: monthlyCommands,
        error: `Monthly command quota reached (${monthlyCommands}/${commandsLimit}). Upgrade your Discord Bot plan for higher monthly throughput.`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
    if (usageCounts.requireAutoMod && !limits.autoModEnabled) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'FEATURE_DISABLED',
        metric: 'autoModEnabled',
        error: `Auto-moderation is not included in ${subscription.planName}. Upgrade your plan to enable Auto-Mod.`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
    if (usageCounts.webhooksCount !== undefined && Number(usageCounts.webhooksCount) >= Number(limits.webhookLimit ?? 2)) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        metric: 'webhookLimit',
        limit: Number(limits.webhookLimit ?? 2),
        current: Number(usageCounts.webhooksCount),
        error: `Webhook limit reached (${limits.webhookLimit}). Upgrade your plan for more webhooks.`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
  } else {
    if (usageCounts.sessionsCount !== undefined && Number(usageCounts.sessionsCount) >= Number(limits.maxSessions ?? 1)) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        metric: 'maxSessions',
        limit: Number(limits.maxSessions ?? 1),
        current: Number(usageCounts.sessionsCount),
        error: `Session limit reached: your ${subscription.planName} plan allows up to ${limits.maxSessions} WhatsApp session(s). Upgrade to link more numbers.`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
    const monthlyMessages = usageCounts.monthlyMessages !== undefined
      ? Number(usageCounts.monthlyMessages)
      : Number(usage.monthlyMessages || 0);
    const incrementMessages = Number(usageCounts.incrementMessages || 0);
    const messagesLimit = Number(limits.monthlyMessagesLimit ?? 2000);
    if ((usageCounts.checkMessages || usageCounts.monthlyMessages !== undefined) &&
        (monthlyMessages >= messagesLimit || monthlyMessages + incrementMessages > messagesLimit)) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        metric: 'monthlyMessagesLimit',
        limit: messagesLimit,
        current: monthlyMessages,
        error: `Monthly message limit reached (${monthlyMessages}/${messagesLimit}). Upgrade your WhatsApp plan to send more messages.`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
    const dailyBroadcasts = usageCounts.dailyBroadcasts !== undefined
      ? Number(usageCounts.dailyBroadcasts)
      : Number(usage.dailyBroadcasts || 0);
    const incrementBroadcasts = Number(usageCounts.incrementBroadcasts || 0);
    const broadcastLimit = Number(limits.dailyBroadcastLimit ?? 100);
    if ((usageCounts.checkBroadcasts || usageCounts.checkBroadcast || usageCounts.dailyBroadcasts !== undefined) &&
        (dailyBroadcasts >= broadcastLimit || dailyBroadcasts + incrementBroadcasts > broadcastLimit)) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        metric: 'dailyBroadcastLimit',
        limit: broadcastLimit,
        current: dailyBroadcasts,
        error: `Daily broadcast limit reached (${dailyBroadcasts}/${broadcastLimit}).`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
    if (usageCounts.autoReplyFlowsCount !== undefined && Number(usageCounts.autoReplyFlowsCount) >= Number(limits.autoReplyFlowsLimit ?? 3)) {
      return {
        allowed: false,
        statusCode: 403,
        code: 'LIMIT_EXCEEDED',
        metric: 'autoReplyFlowsLimit',
        limit: Number(limits.autoReplyFlowsLimit ?? 3),
        current: Number(usageCounts.autoReplyFlowsCount),
        error: `Auto-reply flows limit exceeded (${limits.autoReplyFlowsLimit} allowed on ${subscription.planName}).`,
        serviceType: normalizedType,
        subscription,
        packages
      };
    }
  }

  return {
    allowed: true,
    subscription,
    limits,
    usage
  };
}

export async function incrementServiceUsage(userId, serviceType, metric, amount = 1) {
  if (!userId) return null;
  const normalizedType = normalizeServiceType(serviceType);
  const delta = Math.max(0, Number(amount || 0));
  const now = new Date();
  const existing = await getServiceSubscription(userId, normalizedType);
  if (!existing) return null;

  const nextUsage = normalizeUsage(existing.usage, now);
  if (metric === 'monthlyCommands') {
    nextUsage.monthlyCommands += delta;
  } else if (metric === 'monthlyMessages') {
    nextUsage.monthlyMessages += delta;
  } else if (metric === 'dailyBroadcasts') {
    nextUsage.dailyBroadcasts += delta;
  }

  if (!isPgActive()) {
    const key = getMemKey(userId, normalizedType);
    const record = memorySubscriptions.get(key);
    if (!record) return null;
    record.usage_json = nextUsage;
    record.updated_at = now.toISOString();
    return mapSubscriptionRow(record, now);
  }

  await ensureServiceSubscriptionsSchema();
  const { rows } = await queryPg(
    `UPDATE platform_service_subscriptions
     SET usage_json = $3::jsonb, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND service_type = $2
     RETURNING *`,
    [String(userId), normalizedType, JSON.stringify(nextUsage)]
  );
  return mapSubscriptionRow(rows?.[0], now);
}

export async function listAllServiceSubscriptions({ serviceType = 'discord', page = 1, limit = 25, search = '' } = {}) {
  const normalizedType = normalizeServiceType(serviceType);
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const offset = (safePage - 1) * safeLimit;
  const queryText = String(search || '').trim().toLowerCase();

  if (!isPgActive()) {
    let items = [...memorySubscriptions.values()]
      .filter((r) => r.service_type === normalizedType)
      .map((r) => mapSubscriptionRow(r));
    if (queryText) {
      items = items.filter((item) =>
        [item.userId, item.planId, item.planName, item.status].some((v) => String(v || '').toLowerCase().includes(queryText))
      );
    }
    const total = items.length;
    return {
      items: items.slice(offset, offset + safeLimit),
      total,
      page: safePage,
      limit: safeLimit
    };
  }

  await ensureServiceSubscriptionsSchema();
  const values = [normalizedType];
  let searchFilter = '';
  if (queryText) {
    values.push(`%${queryText}%`);
    searchFilter = `AND (
      s.user_id ILIKE $2 OR
      s.plan_id ILIKE $2 OR
      s.plan_name ILIKE $2 OR
      COALESCE(u.email, '') ILIKE $2 OR
      COALESCE(u.name, '') ILIKE $2 OR
      COALESCE(u.tiwi_id, '') ILIKE $2
    )`;
  }

  const countRes = await queryPg(
    `SELECT COUNT(*)::int AS total
     FROM platform_service_subscriptions s
     LEFT JOIN system_users u ON u.id = s.user_id
     WHERE s.service_type = $1 ${searchFilter}`,
    values
  );
  const total = countRes.rows?.[0]?.total || 0;

  const listValues = [...values, safeLimit, offset];
  const { rows } = await queryPg(
    `SELECT s.*, u.name AS user_name, u.email AS user_email, u.tiwi_id
     FROM platform_service_subscriptions s
     LEFT JOIN system_users u ON u.id = s.user_id
     WHERE s.service_type = $1 ${searchFilter}
     ORDER BY s.updated_at DESC
     LIMIT $${listValues.length - 1} OFFSET $${listValues.length}`,
    listValues
  );

  const items = (rows || []).map((row) => ({
    ...mapSubscriptionRow(row),
    userName: row.user_name || '',
    userEmail: row.user_email || '',
    tiwiId: row.tiwi_id || ''
  }));

  return { items, total, page: safePage, limit: safeLimit };
}

export async function listServiceOrders({ serviceType = 'discord', page = 1, limit = 25, search = '' } = {}) {
  const normalizedType = normalizeServiceType(serviceType);
  const orderType = `${normalizedType}_subscription`;
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 25));
  const offset = (safePage - 1) * safeLimit;
  const queryText = String(search || '').trim().toLowerCase();

  if (!isPgActive()) {
    const subs = await listAllServiceSubscriptions({ serviceType: normalizedType, page: safePage, limit: safeLimit, search });
    return {
      items: subs.items.map((sub) => ({
        id: sub.id,
        orderNumber: `SUB-${String(sub.id).slice(-8).toUpperCase()}`,
        userId: sub.userId,
        userName: sub.userName || '',
        userEmail: sub.userEmail || '',
        tiwiId: sub.tiwiId || '',
        planId: sub.planId,
        planName: sub.planName,
        amountUsd: sub.price,
        billingCycle: 'monthly',
        startedAt: sub.startedAt,
        expiresAt: sub.expiresAt,
        status: sub.status
      })),
      total: subs.total,
      page: safePage,
      limit: safeLimit
    };
  }

  await ensureServiceSubscriptionsSchema();
  try {
    const values = [orderType];
    let searchFilter = '';
    if (queryText) {
      values.push(`%${queryText}%`);
      searchFilter = `AND (
        o.order_number ILIKE $2 OR
        COALESCE(o.user_id, '') ILIKE $2 OR
        COALESCE(o.plan_id, '') ILIKE $2 OR
        COALESCE(o.item_name, '') ILIKE $2 OR
        COALESCE(u.email, '') ILIKE $2 OR
        COALESCE(u.name, '') ILIKE $2
      )`;
    }

    const countRes = await queryPg(
      `SELECT COUNT(*)::int AS total
       FROM platform_billing_orders o
       LEFT JOIN system_users u ON u.id = o.user_id
       WHERE o.order_type = $1 ${searchFilter}`,
      values
    );
    const total = countRes.rows?.[0]?.total || 0;

    if (total > 0) {
      const listParams = [orderType, normalizedType];
      let listSearchFilter = '';
      if (queryText) {
        listParams.push(`%${queryText}%`);
        listSearchFilter = `AND (
          o.order_number ILIKE $3 OR
          COALESCE(o.user_id, '') ILIKE $3 OR
          COALESCE(o.plan_id, '') ILIKE $3 OR
          COALESCE(o.item_name, '') ILIKE $3 OR
          COALESCE(u.email, '') ILIKE $3 OR
          COALESCE(u.name, '') ILIKE $3
        )`;
      }
      listParams.push(safeLimit, offset);
      const limitParam = `$${listParams.length - 1}`;
      const offsetParam = `$${listParams.length}`;
      const { rows } = await queryPg(
        `SELECT o.*, u.name AS user_name, u.email AS user_email, COALESCE(o.tiwi_id, u.tiwi_id) AS resolved_tiwi_id,
                s.started_at AS sub_started_at, s.expires_at AS sub_expires_at, s.status AS sub_status
         FROM platform_billing_orders o
         LEFT JOIN system_users u ON u.id = o.user_id
         LEFT JOIN platform_service_subscriptions s ON s.user_id = o.user_id AND s.service_type = $2
         WHERE o.order_type = $1 ${listSearchFilter}
         ORDER BY o.created_at DESC
         LIMIT ${limitParam} OFFSET ${offsetParam}`,
        listParams
      );
      return {
        items: (rows || []).map((row) => ({
          id: row.id,
          orderNumber: row.order_number,
          userId: row.user_id,
          userName: row.user_name || '',
          userEmail: row.user_email || '',
          tiwiId: row.resolved_tiwi_id || '',
          planId: row.plan_id,
          planName: row.item_name,
          amountUsd: Number(row.gross_amount_usd || 0),
          cashCreditUsedUsd: Number(row.cash_credit_used_usd || 0),
          promoCreditUsedUsd: Number(row.promo_credit_used_usd || 0),
          billingCycle: 'monthly',
          startedAt: row.sub_started_at ? new Date(row.sub_started_at).toISOString() : new Date(row.created_at).toISOString(),
          expiresAt: row.sub_expires_at ? new Date(row.sub_expires_at).toISOString() : null,
          createdAt: new Date(row.created_at).toISOString(),
          status: row.sub_status || row.status || 'paid'
        })),
        total,
        page: safePage,
        limit: safeLimit
      };
    }
  } catch {
    // Fall back to subscription list when billing orders table is unavailable
  }

  const subs = await listAllServiceSubscriptions({ serviceType: normalizedType, page: safePage, limit: safeLimit, search });
  return {
    items: subs.items.map((sub) => ({
      id: sub.id,
      orderNumber: `SUB-${String(sub.id).slice(-8).toUpperCase()}`,
      userId: sub.userId,
      userName: sub.userName || '',
      userEmail: sub.userEmail || '',
      tiwiId: sub.tiwiId || '',
      planId: sub.planId,
      planName: sub.planName,
      amountUsd: sub.price,
      cashCreditUsedUsd: sub.price,
      promoCreditUsedUsd: 0,
      billingCycle: 'monthly',
      startedAt: sub.startedAt,
      expiresAt: sub.expiresAt,
      createdAt: sub.startedAt,
      status: sub.status
    })),
    total: subs.total,
    page: safePage,
    limit: safeLimit
  };
}

function buildMetricUtilization(key, label, usedValue, limitValue) {
  const used = Math.max(0, Number(usedValue || 0));
  const limit = Math.max(0, Number(limitValue || 0));
  const ratio = limit > 0 ? Number((used / limit).toFixed(4)) : 0;
  const percent = limit > 0 ? Math.min(100, Math.round(ratio * 100)) : 0;
  const status = limit > 0
    ? (used >= limit ? 'exceeded' : ratio >= 0.75 ? 'warning' : 'ok')
    : 'ok';
  return { key, label, used, limit, ratio, percent, status };
}

function buildLimitsDelta(serviceType, pkgLimits, currentLimits = null) {
  const keys = serviceType === 'discord'
    ? ['maxBots', 'maxServersPerBot', 'monthlyCommandsLimit', 'webhookLimit']
    : ['maxSessions', 'monthlyMessagesLimit', 'dailyBroadcastLimit', 'autoReplyFlowsLimit', 'contactLimit'];
  const delta = {};
  for (const key of keys) {
    const targetVal = Number(pkgLimits?.[key] || 0);
    const currentVal = currentLimits ? Number(currentLimits?.[key] || 0) : 0;
    delta[key] = targetVal - currentVal;
  }
  return delta;
}

export async function evaluateServiceTierInsight({
  serviceType,
  subscription = null,
  packages = null,
  usage = {}
} = {}) {
  const normalizedType = normalizeServiceType(serviceType);
  const rawPackages = Array.isArray(packages)
    ? packages.filter((pkg) => pkg && pkg.enabled !== false && Number(pkg.price || 0) > 0)
    : await getPackagesForService(normalizedType);
  const sortedPackages = [...rawPackages].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  const isActive = Boolean(subscription?.isActive);
  const limits = subscription?.limits || {};
  const subUsage = subscription?.usage || {};

  let metrics = {};
  if (isActive) {
    if (normalizedType === 'discord') {
      metrics = {
        servers: buildMetricUtilization('servers', 'Connected Servers', usage.serversCount ?? 0, limits.maxServersPerBot ?? 1),
        bots: buildMetricUtilization('bots', 'Bot Instances', usage.botsCount ?? 0, limits.maxBots ?? 1),
        monthlyCommands: buildMetricUtilization('monthlyCommands', 'Monthly AI Commands', usage.monthlyCommands ?? subUsage.monthlyCommands ?? 0, limits.monthlyCommandsLimit ?? 2500)
      };
    } else {
      metrics = {
        sessions: buildMetricUtilization('sessions', 'WhatsApp Sessions', usage.sessionsCount ?? 0, limits.maxSessions ?? 1),
        autoReplyFlows: buildMetricUtilization('autoReplyFlows', 'Auto-Reply Flows', usage.autoReplyFlowsCount ?? 0, limits.autoReplyFlowsLimit ?? 3),
        monthlyMessages: buildMetricUtilization('monthlyMessages', 'Monthly Messages', usage.monthlyMessages ?? subUsage.monthlyMessages ?? 0, limits.monthlyMessagesLimit ?? 2000),
        dailyBroadcasts: buildMetricUtilization('dailyBroadcasts', 'Daily Broadcasts', usage.dailyBroadcasts ?? subUsage.dailyBroadcasts ?? 0, limits.dailyBroadcastLimit ?? 100)
      };
    }
  }

  const metricValues = Object.values(metrics);
  let tierActionRequired = 'inactive';
  if (isActive) {
    if (metricValues.some((m) => m.status === 'exceeded')) {
      tierActionRequired = 'limit_reached';
    } else if (metricValues.some((m) => m.status === 'warning')) {
      tierActionRequired = 'upgrade_recommended';
    } else {
      tierActionRequired = 'healthy';
    }
  }

  let recommendedPlan = null;
  if (!isActive) {
    recommendedPlan = sortedPackages[0] || null;
  } else if (tierActionRequired === 'upgrade_recommended' || tierActionRequired === 'limit_reached') {
    const currentPrice = Number(subscription?.price || 0);
    recommendedPlan = sortedPackages.find(
      (pkg) => pkg.planId !== subscription?.planId && Number(pkg.price || 0) > currentPrice
    ) || sortedPackages[sortedPackages.length - 1] || null;
  }

  const currentTier = isActive
    ? {
        planId: subscription.planId,
        planName: subscription.planName,
        price: Number(subscription.price || 0),
        status: subscription.status,
        limits,
        metrics,
        highestUtilizationPercent: Math.max(0, ...metricValues.map((m) => m.percent))
      }
    : null;

  const tiers = sortedPackages.map((pkg) => {
    const pkgLimits = extractPlanLimits(normalizedType, pkg);
    const pkgPrice = Number(pkg.price || 0);
    return {
      planId: pkg.planId,
      planName: pkg.planName,
      badge: pkg.badge || '',
      description: pkg.description || '',
      price: pkgPrice,
      isCurrent: Boolean(isActive && pkg.planId === subscription?.planId),
      recommended: Boolean(recommendedPlan && pkg.planId === recommendedPlan.planId),
      limits: pkgLimits,
      features: Array.isArray(pkg.features) ? pkg.features : [],
      priceDelta: isActive ? Number((pkgPrice - Number(subscription?.price || 0)).toFixed(2)) : pkgPrice,
      limitsDelta: buildLimitsDelta(normalizedType, pkgLimits, isActive ? limits : null)
    };
  });

  return {
    serviceType: normalizedType,
    currentTier,
    tierActionRequired,
    recommendedPlan: recommendedPlan
      ? {
          planId: recommendedPlan.planId,
          planName: recommendedPlan.planName,
          price: Number(recommendedPlan.price || 0),
          limits: extractPlanLimits(normalizedType, recommendedPlan)
        }
      : null,
    tiers
  };
}

export async function processDueServiceRenewals({
  now = new Date(),
  billingDB = BillingDB,
  sendFailureEmailFn = sendServicePaymentFailureEmail
} = {}) {
  if (isRenewalSweepRunning) {
    return { skipped: true, reason: 'sweep_already_running', processed: 0, renewed: 0, failed: 0 };
  }
  isRenewalSweepRunning = true;
  const summary = { skipped: false, processed: 0, renewed: 0, failed: 0 };

  try {
    const nowDate = now instanceof Date ? now : new Date(now);
    const nowIso = nowDate.toISOString();
    let dueRows = [];

    if (!isPgActive()) {
      for (const rec of memorySubscriptions.values()) {
        if (rec.auto_renew !== false && rec.status === 'active' && rec.expires_at && new Date(rec.expires_at) <= nowDate) {
          dueRows.push(rec);
        }
      }
    } else {
      await ensureServiceSubscriptionsSchema();
      const { rows } = await queryPg(
        `SELECT s.*, u.email AS user_email, u.name AS user_name, u.store_name AS user_store_name
         FROM platform_service_subscriptions s
         LEFT JOIN system_users u ON u.id = s.user_id
         WHERE s.auto_renew = TRUE
           AND s.status = 'active'
           AND s.expires_at <= $1`,
        [nowIso]
      );
      dueRows = rows || [];
    }

    for (const row of dueRows) {
      summary.processed++;
      const sub = mapSubscriptionRow(row, nowDate);
      const serviceType = sub.serviceType;
      const pkg = await getPackageByIdForService(serviceType, sub.planId).catch(() => null);
      const effectivePrice = Number(pkg?.enabled !== false && pkg?.price > 0 ? pkg.price : sub.price);
      if (!Number.isFinite(effectivePrice) || effectivePrice <= 0) {
        continue;
      }

      const planName = pkg?.planName || sub.planName;
      const chargeResult = await billingDB.chargeSubscriptionPlan(
        sub.userId,
        effectivePrice,
        `${planName} Auto-Renewal`,
        {
          orderType: `${serviceType}_subscription`,
          planId: sub.planId,
          metadata: {
            serviceType,
            planId: sub.planId,
            planName,
            renewal: true
          }
        }
      );

      if (chargeResult?.success) {
        const nextExpiresAt = new Date(nowDate.getTime() + BILLING_PERIOD_MS).toISOString();
        const resetUsage = normalizeUsage({}, nowDate);
        const nextLimits = pkg ? extractPlanLimits(serviceType, pkg) : sub.limits;

        if (!isPgActive()) {
          const memRec = memorySubscriptions.get(getMemKey(sub.userId, serviceType));
          if (memRec) {
            memRec.plan_name = planName;
            memRec.price = effectivePrice;
            memRec.limits_json = nextLimits;
            memRec.usage_json = resetUsage;
            memRec.status = 'active';
            memRec.renewal_failure_count = 0;
            memRec.last_renewal_error = null;
            memRec.last_renewal_attempt_at = nowIso;
            memRec.expires_at = nextExpiresAt;
            memRec.updated_at = nowIso;
          }
        } else {
          await queryPg(
            `UPDATE platform_service_subscriptions
             SET plan_name = $3,
                 price = $4,
                 limits_json = $5::jsonb,
                 usage_json = $6::jsonb,
                 status = 'active',
                 renewal_failure_count = 0,
                 last_renewal_error = NULL,
                 last_renewal_attempt_at = $7,
                 expires_at = $8,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND service_type = $2`,
            [
              String(sub.userId),
              serviceType,
              planName,
              effectivePrice,
              JSON.stringify(nextLimits),
              JSON.stringify(resetUsage),
              nowIso,
              nextExpiresAt
            ]
          );
        }

        const serviceLabel = serviceType === 'whatsapp' ? 'WhatsApp Automation' : 'Discord Bot Manager';
        await recordServiceNotification({
          userId: sub.userId,
          serviceType,
          kind: 'renewal_succeeded',
          title: `${serviceLabel} auto-renewal succeeded`,
          message: `Your ${planName} subscription renewed for $${effectivePrice.toFixed(2)} USD until ${nextExpiresAt.slice(0, 10)}.`,
          metadata: {
            planId: sub.planId,
            planName,
            amountUsd: effectivePrice,
            orderNumber: chargeResult?.orderNumber || chargeResult?.invoice?.orderNumber || null,
            invoice: chargeResult?.invoice || null,
            expiresAt: nextExpiresAt
          },
          now: nowDate
        });
        summary.renewed++;
      } else {
        const nextFailureCount = Number(sub.renewalFailureCount || 0) + 1;
        const failureError = chargeResult?.error || `Insufficient verified billing credits ($${effectivePrice.toFixed(2)} USD required for ${planName}).`;

        if (!isPgActive()) {
          const memRec = memorySubscriptions.get(getMemKey(sub.userId, serviceType));
          if (memRec) {
            memRec.status = 'past_due';
            memRec.renewal_failure_count = nextFailureCount;
            memRec.last_renewal_error = failureError;
            memRec.last_renewal_attempt_at = nowIso;
            memRec.updated_at = nowIso;
          }
        } else {
          await queryPg(
            `UPDATE platform_service_subscriptions
             SET status = 'past_due',
                 renewal_failure_count = $3,
                 last_renewal_error = $4,
                 last_renewal_attempt_at = $5,
                 updated_at = CURRENT_TIMESTAMP
             WHERE user_id = $1 AND service_type = $2`,
            [String(sub.userId), serviceType, nextFailureCount, failureError, nowIso]
          );
        }

        await notifyPaymentFailure({
          userId: sub.userId,
          serviceType,
          planId: sub.planId,
          planName,
          amountDue: effectivePrice,
          reason: failureError,
          failureCount: nextFailureCount,
          source: 'auto_renewal',
          userEmail: row.user_email || null,
          userName: row.user_store_name || row.user_name || null,
          sendFailureEmailFn,
          now: nowDate
        });
        summary.failed++;
      }
    }

    return summary;
  } finally {
    isRenewalSweepRunning = false;
  }
}

export function startServiceRenewalScheduler(intervalMs = 5 * 60 * 1000) {
  if (serviceRenewalTimer) return serviceRenewalTimer;
  const runSweep = () => {
    processDueServiceRenewals().catch((error) => {
      console.error('[ServiceSubscriptions] Auto-renewal sweep failed:', error.message);
    });
  };
  runSweep();
  serviceRenewalTimer = setInterval(runSweep, intervalMs);
  serviceRenewalTimer.unref?.();
  return serviceRenewalTimer;
}

export function stopServiceRenewalScheduler() {
  if (serviceRenewalTimer) {
    clearInterval(serviceRenewalTimer);
    serviceRenewalTimer = null;
  }
}
