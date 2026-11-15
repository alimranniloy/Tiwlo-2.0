import { randomUUID } from 'node:crypto';
import { isPgActive, queryPg } from './postgres.js';
import { BillingDB } from './billing.js';
import {
  getDiscordPackageById,
  getDiscordPackages,
  getWhatsappPackageById,
  getWhatsappPackages
} from './packages.js';

export const SERVICE_TYPES = new Set(['discord', 'whatsapp']);

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
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, service_type)
  );
  CREATE INDEX IF NOT EXISTS idx_platform_service_subs_user ON platform_service_subscriptions(user_id, service_type);
  CREATE INDEX IF NOT EXISTS idx_platform_service_subs_type ON platform_service_subscriptions(service_type, updated_at DESC);
`;

const memorySubscriptions = new Map();
let schemaEnsured = false;

export function resetMemoryServiceSubscriptions() {
  memorySubscriptions.clear();
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
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : row.startedAt,
    expiresAt: expiresAt ? expiresAt.toISOString() : row.expiresAt,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : row.updatedAt
  };
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
  billingDB = BillingDB,
  customPlan = null
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

  const isAdminBypass = userRole === 'admin' || userRole === 'super_admin';
  let chargeResult = {
    success: true,
    chargedAmount: 0,
    cashCreditUsed: 0,
    promoCreditUsed: 0,
    orderNumber: null,
    remainingCredits: null
  };

  if (!isAdminBypass) {
    chargeResult = await billingDB.chargeSubscriptionPlan(userId, effectivePrice, planInfo.planName, {
      orderType: `${normalizedType}_subscription`,
      planId: planInfo.planId,
      metadata: {
        serviceType: normalizedType,
        planId: planInfo.planId,
        planName: planInfo.planName
      }
    });
    if (!chargeResult?.success) {
      const packages = await getPackagesForService(normalizedType);
      return {
        success: false,
        statusCode: chargeResult?.statusCode || 402,
        code: 'INSUFFICIENT_CREDITS',
        error: chargeResult?.error || `Insufficient verified billing credits ($${effectivePrice.toFixed(2)} USD required for ${planInfo.planName}).`,
        requiredCredits: effectivePrice,
        packages
      };
    }
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const existing = await getServiceSubscription(userId, normalizedType);
  const limits = extractPlanLimits(normalizedType, planInfo);
  const nextUsage = existing?.isActive
    ? normalizeUsage(existing.usage, now)
    : normalizeUsage({}, now);

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
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString()
    };
    memorySubscriptions.set(getMemKey(userId, normalizedType), record);
    return {
      success: true,
      subscription: mapSubscriptionRow(record, now),
      chargeResult
    };
  }

  await ensureServiceSubscriptionsSchema();
  const id = existing?.id || `sub_${randomUUID()}`;
  const { rows } = await queryPg(
    `INSERT INTO platform_service_subscriptions
       (id, user_id, service_type, plan_id, plan_name, price, limits_json, usage_json, status, started_at, expires_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'active', $9, $10, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id, service_type) DO UPDATE SET
       plan_id = EXCLUDED.plan_id,
       plan_name = EXCLUDED.plan_name,
       price = EXCLUDED.price,
       limits_json = EXCLUDED.limits_json,
       usage_json = EXCLUDED.usage_json,
       status = 'active',
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
      now.toISOString(),
      expiresAt.toISOString()
    ]
  );

  return {
    success: true,
    subscription: mapSubscriptionRow(rows[0], now),
    chargeResult
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
