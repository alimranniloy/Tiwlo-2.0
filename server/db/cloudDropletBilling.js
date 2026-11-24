import { randomBytes, randomUUID } from 'node:crypto';
import { isPgActive, queryPg } from './postgres.js';
import { BillingDB } from './billing.js';
import { sendTiwloEmail } from './emailService.js';
import { renderBaseEmail } from '../email/index.js';
import { getPlatformUrl } from '../config/platformConfig.js';
import { reclaimUbuntuTenant, updateUbuntuTenantStatus } from '../ubuntu/tenantLayout.js';
import { adjustNodeActiveDroplets } from '../administrator/serverFleetService.js';

export const DROPLET_BILLING_PERIOD_DAYS = 30;
export const DROPLET_GRACE_PERIOD_DAYS = 3;
export const DROPLET_SUSPEND_BEFORE_DELETE_DAYS = 7;
export const DROPLET_RENEWAL_LOOKAHEAD_DAYS = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

export const DROPLET_BILLING_SCHEMA_SQL = `
  ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(12,2);
  ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(32) DEFAULT 'monthly';
  ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ;
  ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS grace_until TIMESTAMPTZ;
  ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
  ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS purge_at TIMESTAMPTZ;
  ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS last_invoice_id VARCHAR(64);
  ALTER TABLE cloud_droplets ADD COLUMN IF NOT EXISTS pre_renewal_warning_at TIMESTAMPTZ;

  CREATE INDEX IF NOT EXISTS idx_cloud_droplets_next_billing
    ON cloud_droplets(status, next_billing_at);
  CREATE INDEX IF NOT EXISTS idx_cloud_droplets_grace_until
    ON cloud_droplets(status, grace_until);
  CREATE INDEX IF NOT EXISTS idx_cloud_droplets_purge_at
    ON cloud_droplets(status, purge_at);

  CREATE TABLE IF NOT EXISTS cloud_droplet_invoices (
    id VARCHAR(64) PRIMARY KEY,
    invoice_number VARCHAR(64) UNIQUE NOT NULL,
    user_id VARCHAR(64),
    droplet_id VARCHAR(64),
    droplet_name VARCHAR(255),
    billing_period_start TIMESTAMPTZ,
    billing_period_end TIMESTAMPTZ,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'USD',
    status VARCHAR(32) NOT NULL DEFAULT 'paid' CHECK (status IN ('paid', 'past_due', 'failed', 'void')),
    line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_cloud_droplet_invoices_user
    ON cloud_droplet_invoices(user_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_cloud_droplet_invoices_droplet
    ON cloud_droplet_invoices(droplet_id, created_at DESC);
`;

// ==========================================
// IN-MEMORY STORE FOR DETERMINISTIC TESTS
// ==========================================

const memoryDroplets = new Map();
const memoryInvoices = new Map();
const memoryWallets = new Map();
const memoryUsers = new Map();
const memoryNotifications = [];
const memoryActivities = [];

let schemaEnsured = false;
let schemaPromise = null;
let isSweepRunning = false;

export function resetInMemoryDropletBillingForTests() {
  memoryDroplets.clear();
  memoryInvoices.clear();
  memoryWallets.clear();
  memoryUsers.clear();
  memoryNotifications.length = 0;
  memoryActivities.length = 0;
  schemaEnsured = false;
  schemaPromise = null;
}

export function setInMemoryWalletBalanceForTests(userId, credits = 0, promotionalCredits = 0) {
  if (!userId) throw new TypeError('userId is required');
  memoryWallets.set(String(userId), {
    userId: String(userId),
    credits: roundMoney(Math.max(0, Number(credits) || 0)),
    promotionalCredits: roundMoney(Math.max(0, Number(promotionalCredits) || 0)),
    monthlySpend: memoryWallets.get(String(userId))?.monthlySpend || 0
  });
}

export function getInMemoryWalletBalanceForTests(userId) {
  const rec = memoryWallets.get(String(userId));
  if (!rec) return { credits: 0, promotionalCredits: 0, total: 0, monthlySpend: 0 };
  return {
    credits: rec.credits,
    promotionalCredits: rec.promotionalCredits,
    total: roundMoney(rec.credits + rec.promotionalCredits),
    monthlySpend: rec.monthlySpend || 0
  };
}

export function setInMemoryUserForTests(user = {}) {
  if (!user?.id) throw new TypeError('user.id is required');
  memoryUsers.set(String(user.id), {
    id: String(user.id),
    email: user.email || '',
    name: user.name || '',
    store_name: user.storeName || user.store_name || '',
    email_verified: user.emailVerified !== undefined ? Boolean(user.emailVerified) : true
  });
}

export function seedInMemoryDropletForTests(droplet = {}) {
  if (!droplet?.id) throw new TypeError('droplet.id is required');
  const normalized = normalizeDropletRecord(droplet);
  memoryDroplets.set(normalized.id, normalized);
  return mapDropletBillingRow(normalized);
}

export function getInMemoryDropletBillingStateForTests() {
  return {
    droplets: [...memoryDroplets.values()].map(mapDropletBillingRow),
    invoices: [...memoryInvoices.values()].map(mapInvoiceRow),
    wallets: Object.fromEntries(memoryWallets.entries()),
    users: Object.fromEntries(memoryUsers.entries()),
    notifications: [...memoryNotifications],
    activities: [...memoryActivities]
  };
}

// ==========================================
// INTERNAL HELPERS
// ==========================================

function roundMoney(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

function toDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function addDays(date, days) {
  const base = toDate(date) || new Date();
  return new Date(base.getTime() + days * DAY_MS);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);
}

function safeUrl(value, fallback = getPlatformUrl()) {
  try {
    const parsed = new URL(String(value || ''));
    return ['http:', 'https:'].includes(parsed.protocol) ? esc(parsed.href) : esc(fallback);
  } catch {
    return esc(fallback);
  }
}

function formatUtc(value) {
  const d = toDate(value);
  return d ? d.toUTCString() : 'N/A';
}

function formatShortDate(value) {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : 'N/A';
}

function normalizeDropletRecord(raw = {}) {
  const nowIso = new Date().toISOString();
  return {
    id: String(raw.id),
    user_id: String(raw.user_id ?? raw.userId ?? ''),
    name: String(raw.name ?? raw.hostname ?? ''),
    specs: raw.specs || `${Number(raw.vcpus) || 1} vCPU · ${raw.memory || '1 GB'} · ${raw.storage || '25 GB NVMe'}`,
    vcpus: Number(raw.vcpus ?? 1),
    memory: raw.memory || '1 GB',
    storage: raw.storage || '25 GB NVMe',
    ip: raw.ip ?? raw.ipv4 ?? null,
    ipv6: raw.ipv6 ?? null,
    region: raw.region || '',
    region_code: raw.region_code ?? raw.regionCode ?? null,
    status: String(raw.status || 'active').toLowerCase(),
    image: raw.image || 'Ubuntu 24.04 LTS',
    access_username: raw.access_username ?? raw.accessUsername ?? 'root',
    ssh_port: raw.ssh_port ?? raw.sshPort ?? null,
    tenant_id: raw.tenant_id ?? raw.tenantId ?? null,
    node_id: raw.node_id ?? raw.nodeId ?? null,
    tags: raw.tags ?? '',
    monthly_price: raw.monthly_price !== undefined
      ? (raw.monthly_price === null ? null : roundMoney(raw.monthly_price))
      : (raw.monthlyPrice !== undefined && raw.monthlyPrice !== null ? roundMoney(raw.monthlyPrice) : null),
    billing_cycle: String(raw.billing_cycle ?? raw.billingCycle ?? 'monthly').toLowerCase(),
    next_billing_at: toDate(raw.next_billing_at ?? raw.nextBillingAt)?.toISOString() || null,
    grace_until: toDate(raw.grace_until ?? raw.graceUntil)?.toISOString() || null,
    suspended_at: toDate(raw.suspended_at ?? raw.suspendedAt)?.toISOString() || null,
    purge_at: toDate(raw.purge_at ?? raw.purgeAt)?.toISOString() || null,
    last_invoice_id: raw.last_invoice_id ?? raw.lastInvoiceId ?? null,
    pre_renewal_warning_at: toDate(raw.pre_renewal_warning_at ?? raw.preRenewalWarningAt)?.toISOString() || null,
    created_at: toDate(raw.created_at ?? raw.createdAt)?.toISOString() || nowIso
  };
}

function mapDropletBillingRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id ?? row.userId,
    name: row.name,
    hostname: row.name,
    specs: row.specs,
    vcpus: Number(row.vcpus ?? 1),
    memory: row.memory || '1 GB',
    storage: row.storage || '25 GB NVMe',
    ip: row.ip || null,
    ipv4: row.ip || null,
    ipv6: row.ipv6 || null,
    region: row.region || '',
    regionCode: row.region_code ?? row.regionCode ?? null,
    status: String(row.status || 'active').toLowerCase(),
    image: row.image || 'Ubuntu 24.04 LTS',
    accessUsername: row.access_username ?? row.accessUsername ?? 'root',
    sshPort: row.ssh_port !== null && row.ssh_port !== undefined ? Number(row.ssh_port) : null,
    tenantId: row.tenant_id ?? row.tenantId ?? null,
    nodeId: row.node_id ?? row.nodeId ?? null,
    monthlyPrice: row.monthly_price !== null && row.monthly_price !== undefined ? roundMoney(row.monthly_price) : 0,
    billingCycle: row.billing_cycle || 'monthly',
    nextBillingAt: toDate(row.next_billing_at ?? row.nextBillingAt)?.toISOString() || null,
    graceUntil: toDate(row.grace_until ?? row.graceUntil)?.toISOString() || null,
    suspendedAt: toDate(row.suspended_at ?? row.suspendedAt)?.toISOString() || null,
    purgeAt: toDate(row.purge_at ?? row.purgeAt)?.toISOString() || null,
    lastInvoiceId: row.last_invoice_id ?? row.lastInvoiceId ?? null,
    preRenewalWarningAt: toDate(row.pre_renewal_warning_at ?? row.preRenewalWarningAt)?.toISOString() || null,
    createdAt: toDate(row.created_at ?? row.createdAt)?.toISOString() || null
  };
}

function mapInvoiceRow(row) {
  if (!row) return null;
  const lineItems = Array.isArray(row.line_items)
    ? row.line_items
    : (Array.isArray(row.lineItems) ? row.lineItems : []);
  const primaryItem = lineItems[0] || {};
  const amount = roundMoney(row.amount ?? 0);
  const tax = roundMoney(primaryItem.tax ?? 0);
  const subtotal = roundMoney(primaryItem.subtotal ?? Math.max(0, amount - tax));
  return {
    id: row.id,
    invoiceNumber: row.invoice_number ?? row.invoiceNumber,
    userId: row.user_id ?? row.userId,
    dropletId: row.droplet_id ?? row.dropletId,
    dropletName: row.droplet_name ?? row.dropletName,
    hostname: primaryItem.hostname || row.droplet_name || row.dropletName,
    region: primaryItem.region || null,
    regionCode: primaryItem.regionCode || null,
    ipv4: primaryItem.ipv4 || null,
    ipv6: primaryItem.ipv6 || null,
    specs: primaryItem.specs || null,
    billingCycle: primaryItem.billingCycle || 'monthly',
    billingPeriodStart: toDate(row.billing_period_start ?? row.billingPeriodStart)?.toISOString() || null,
    billingPeriodEnd: toDate(row.billing_period_end ?? row.billingPeriodEnd)?.toISOString() || null,
    subtotal,
    tax,
    amount,
    total: amount,
    currency: String(row.currency || 'USD'),
    status: String(row.status || 'paid'),
    lineItems,
    emailSentAt: toDate(row.email_sent_at ?? row.emailSentAt)?.toISOString() || null,
    createdAt: toDate(row.created_at ?? row.createdAt)?.toISOString() || null
  };
}

export function buildDropletInvoiceNumber(now = new Date()) {
  const d = toDate(now) || new Date();
  const datePart = d.toISOString().slice(0, 10).replace(/-/g, '');
  const randPart = randomBytes(3).toString('hex').toUpperCase();
  return `INV-VPS-${datePart}-${randPart}`;
}

export function buildDropletInvoiceLineItems({
  droplet,
  monthlyPrice,
  periodStart,
  periodEnd,
  taxRate = 0
} = {}) {
  const unitPrice = roundMoney(Math.max(0, Number(monthlyPrice) || 0));
  const tax = roundMoney(unitPrice * Math.max(0, Number(taxRate) || 0));
  const total = roundMoney(unitPrice + tax);
  const hostname = droplet?.name || droplet?.hostname || 'vps-instance';
  const vcpus = Number(droplet?.vcpus ?? 1);
  const memory = droplet?.memory || '1 GB';
  const storage = droplet?.storage || '25 GB NVMe';
  const specs = droplet?.specs || `${vcpus} vCPU · ${memory} · ${storage}`;
  const region = droplet?.region || droplet?.regionCode || droplet?.region_code || 'Default Region';
  const regionCode = droplet?.regionCode || droplet?.region_code || null;
  const ipv4 = droplet?.ipv4 || droplet?.ip || null;
  const ipv6 = droplet?.ipv6 || null;
  const image = droplet?.image || 'Ubuntu 24.04 LTS';
  const startIso = (toDate(periodStart) || new Date()).toISOString();
  const endIso = (toDate(periodEnd) || addDays(startIso, DROPLET_BILLING_PERIOD_DAYS)).toISOString();

  const lineItems = [
    {
      description: `Monthly Cloud VPS — ${hostname} (${specs})`,
      dropletId: droplet?.id || null,
      hostname,
      region,
      regionCode,
      image,
      specs,
      vcpus,
      memory,
      storage,
      ipv4,
      ipv6,
      billingCycle: 'monthly',
      periodStart: startIso,
      periodEnd: endIso,
      qty: 1,
      unitPrice,
      subtotal: unitPrice,
      tax,
      amount: unitPrice
    }
  ];

  return {
    lineItems,
    subtotal: unitPrice,
    tax,
    total,
    specs,
    hostname,
    region,
    regionCode,
    ipv4,
    ipv6,
    periodStart: startIso,
    periodEnd: endIso
  };
}

// ==========================================
// SCHEMA INITIALIZATION
// ==========================================

export async function ensureDropletBillingSchema(queryable = null) {
  if (queryable) {
    if (typeof queryable.exec === 'function') {
      await queryable.exec(DROPLET_BILLING_SCHEMA_SQL);
    } else {
      await queryable.query(DROPLET_BILLING_SCHEMA_SQL);
    }
    schemaEnsured = true;
    return { ok: true, mode: 'queryable' };
  }
  if (!isPgActive()) {
    return { ok: true, mode: 'memory' };
  }
  if (schemaEnsured) {
    return { ok: true, mode: 'postgres', cached: true };
  }
  if (schemaPromise) {
    return schemaPromise;
  }

  schemaPromise = (async () => {
    await queryPg(DROPLET_BILLING_SCHEMA_SQL);
    schemaEnsured = true;
    return { ok: true, mode: 'postgres' };
  })().finally(() => {
    schemaPromise = null;
  });

  return schemaPromise;
}

// ==========================================
// WALLET, ACTIVITY, NOTIFICATION & USER HELPERS
// ==========================================

async function getUserContactInfo(userId, explicit = {}) {
  const fallbackName = explicit.recipientName || explicit.name || 'Tiwlo Cloud Customer';
  if (explicit.recipientEmail) {
    return { email: String(explicit.recipientEmail).trim(), name: fallbackName };
  }
  if (!userId) return { email: null, name: fallbackName };

  if (!isPgActive()) {
    const memUser = memoryUsers.get(String(userId));
    return {
      email: memUser?.email ? String(memUser.email).trim() : null,
      name: memUser?.store_name || memUser?.name || fallbackName
    };
  }

  try {
    const { rows } = await queryPg(
      'SELECT email, name, store_name, email_verified FROM system_users WHERE id = $1 LIMIT 1',
      [String(userId)]
    );
    const u = rows?.[0];
    if (!u) return { email: null, name: fallbackName };
    return {
      email: u.email ? String(u.email).trim() : null,
      name: u.store_name || u.name || fallbackName
    };
  } catch {
    return { email: null, name: fallbackName };
  }
}

async function getAvailableWalletBalance(userId, { now = new Date(), billingDB = BillingDB } = {}) {
  if (!userId) return 0;

  if (!isPgActive() && billingDB === BillingDB) {
    const rec = memoryWallets.get(String(userId));
    return rec ? roundMoney(rec.credits + rec.promotionalCredits) : 0;
  }

  if (billingDB && billingDB !== BillingDB && typeof billingDB.getBillingAccount === 'function') {
    const acct = await billingDB.getBillingAccount(userId);
    return roundMoney(Number(acct?.credits || 0) + Number(acct?.promotionalCredits || 0));
  }

  const nowIso = (toDate(now) || new Date()).toISOString();
  const { rows } = await queryPg(
    `SELECT
       COALESCE(credits, 0) AS credits,
       CASE
         WHEN promotional_expires_at IS NOT NULL AND promotional_expires_at <= $2::timestamptz THEN 0
         ELSE COALESCE(promotional_credits, 0)
       END AS promo_credits
     FROM cloud_billing_accounts
     WHERE user_id = $1
     LIMIT 1`,
    [String(userId), nowIso]
  );
  if (!rows?.[0]) return 0;
  return roundMoney(Number(rows[0].credits || 0) + Number(rows[0].promo_credits || 0));
}

async function attemptAtomicWalletCharge(userId, amountUsd, description, context = {}, billingDB = BillingDB) {
  const chargeAmount = roundMoney(amountUsd);
  if (chargeAmount <= 0) {
    return { success: true, chargedAmount: 0, cashCreditUsed: 0, promoCreditUsed: 0 };
  }

  if (!isPgActive() && billingDB === BillingDB) {
    const wallet = memoryWallets.get(String(userId));
    if (!wallet) {
      return {
        success: false,
        statusCode: 402,
        error: `Insufficient verified billing credits ($${chargeAmount.toFixed(2)} USD required for ${description}).`
      };
    }
    const available = roundMoney(wallet.credits + wallet.promotionalCredits);
    if (available < chargeAmount) {
      return {
        success: false,
        statusCode: 402,
        error: `Insufficient verified billing credits ($${chargeAmount.toFixed(2)} USD required for ${description}).`
      };
    }
    const promoUsed = roundMoney(Math.min(wallet.promotionalCredits, chargeAmount));
    const cashUsed = roundMoney(Math.max(0, chargeAmount - promoUsed));
    wallet.promotionalCredits = roundMoney(wallet.promotionalCredits - promoUsed);
    wallet.credits = roundMoney(wallet.credits - cashUsed);
    wallet.monthlySpend = roundMoney((wallet.monthlySpend || 0) + chargeAmount);
    return {
      success: true,
      chargedAmount: chargeAmount,
      cashCreditUsed: cashUsed,
      promoCreditUsed: promoUsed,
      remainingCredits: roundMoney(wallet.credits + wallet.promotionalCredits)
    };
  }

  // Reuse Tiwlo's canonical FOR UPDATE wallet deduction in BillingDB
  return billingDB.chargeSubscriptionPlan(String(userId), chargeAmount, description, {
    orderType: context.orderType || 'vps_droplet_monthly',
    planId: context.planId || context.dropletId || null,
    metadata: context
  });
}

async function recordCloudActivity({ userId, action, target, now = new Date() } = {}) {
  if (!userId || !action) return null;
  const id = `act_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const createdAt = (toDate(now) || new Date()).toISOString();
  const record = {
    id,
    userId: String(userId),
    action: String(action).slice(0, 255),
    target: target ? String(target).slice(0, 255) : null,
    type: 'droplet',
    createdAt
  };

  if (!isPgActive()) {
    memoryActivities.unshift(record);
    return record;
  }

  try {
    await queryPg(
      `INSERT INTO cloud_activities (id, user_id, action, target, type, created_at)
       VALUES ($1, $2, $3, $4, 'droplet', $5)`,
      [id, record.userId, record.action, record.target, createdAt]
    );
  } catch {
    // Non-fatal activity log
  }
  return record;
}

async function recordSocialNotification({
  userId,
  type,
  title,
  message,
  snippet = null,
  entityId = null,
  meta = {},
  now = new Date(),
  notifyFn = null
} = {}) {
  if (!userId) return null;
  const id = `notif_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const createdAt = (toDate(now) || new Date()).toISOString();
  const notif = {
    id,
    recipientId: String(userId),
    userId: String(userId),
    senderId: null,
    type: String(type || 'cloud_vps_billing').slice(0, 64),
    title: String(title || 'Tiwlo Cloud VPS Notice').slice(0, 255),
    message: String(message || ''),
    content: String(message || ''),
    snippet: snippet ? String(snippet) : String(message || '').slice(0, 160),
    entityId: entityId ? String(entityId).slice(0, 64) : null,
    thumbnail: null,
    meta: meta && typeof meta === 'object' ? meta : {},
    isRead: false,
    createdAt
  };

  if (!isPgActive()) {
    memoryNotifications.unshift(notif);
  } else {
    try {
      await queryPg(
        `INSERT INTO social_notifications
           (id, recipient_id, sender_id, type, content, entity_id, title, snippet, thumbnail, meta, is_read, created_at)
         VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, NULL, $8::jsonb, FALSE, $9)`,
        [
          notif.id,
          notif.recipientId,
          notif.type,
          notif.content,
          notif.entityId,
          notif.title,
          notif.snippet,
          JSON.stringify(notif.meta),
          createdAt
        ]
      );
    } catch {
      // Non-fatal notification insert
    }
  }

  if (typeof notifyFn === 'function') {
    await notifyFn(notif);
  }
  return notif;
}

async function persistNewInvoice({
  id,
  invoiceNumber,
  userId,
  dropletId,
  dropletName,
  periodStart,
  periodEnd,
  amount,
  currency = 'USD',
  status = 'paid',
  lineItems = [],
  now = new Date()
} = {}) {
  const createdAt = (toDate(now) || new Date()).toISOString();
  const row = {
    id: id || `inv_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    invoice_number: invoiceNumber || buildDropletInvoiceNumber(now),
    user_id: String(userId),
    droplet_id: String(dropletId),
    droplet_name: String(dropletName || ''),
    billing_period_start: (toDate(periodStart) || new Date()).toISOString(),
    billing_period_end: (toDate(periodEnd) || addDays(now, DROPLET_BILLING_PERIOD_DAYS)).toISOString(),
    amount: roundMoney(amount),
    currency: String(currency || 'USD').slice(0, 8),
    status,
    line_items: lineItems,
    email_sent_at: null,
    created_at: createdAt
  };

  if (!isPgActive()) {
    memoryInvoices.set(row.id, row);
    return mapInvoiceRow(row);
  }

  const { rows } = await queryPg(
    `INSERT INTO cloud_droplet_invoices (
       id, invoice_number, user_id, droplet_id, droplet_name,
       billing_period_start, billing_period_end, amount, currency,
       status, line_items, email_sent_at, created_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, NULL, $12)
     RETURNING *`,
    [
      row.id,
      row.invoice_number,
      row.user_id,
      row.droplet_id,
      row.droplet_name,
      row.billing_period_start,
      row.billing_period_end,
      row.amount,
      row.currency,
      row.status,
      JSON.stringify(row.line_items),
      row.created_at
    ]
  );
  return mapInvoiceRow(rows?.[0] || row);
}

async function markInvoiceEmailSent(invoiceId, sentAt = new Date()) {
  if (!invoiceId) return;
  const sentIso = (toDate(sentAt) || new Date()).toISOString();
  if (!isPgActive()) {
    const rec = memoryInvoices.get(invoiceId);
    if (rec) rec.email_sent_at = sentIso;
    return;
  }
  await queryPg(
    'UPDATE cloud_droplet_invoices SET email_sent_at = $2 WHERE id = $1',
    [invoiceId, sentIso]
  ).catch(() => {});
}

async function settleOrCreatePaidInvoice({ droplet, userId, amount, periodStart, periodEnd, now = new Date() }) {
  const nowDate = toDate(now) || new Date();
  if (droplet.last_invoice_id) {
    if (!isPgActive()) {
      const prev = memoryInvoices.get(droplet.last_invoice_id);
      if (prev && prev.status === 'past_due') {
        prev.status = 'paid';
        prev.billing_period_start = (toDate(periodStart) || nowDate).toISOString();
        prev.billing_period_end = (toDate(periodEnd) || addDays(nowDate, DROPLET_BILLING_PERIOD_DAYS)).toISOString();
        prev.amount = roundMoney(amount);
        return mapInvoiceRow(prev);
      }
    } else {
      const { rows } = await queryPg(
        `UPDATE cloud_droplet_invoices
         SET status = 'paid',
             billing_period_start = $2,
             billing_period_end = $3,
             amount = $4
         WHERE id = $1 AND status = 'past_due'
         RETURNING *`,
        [
          droplet.last_invoice_id,
          (toDate(periodStart) || nowDate).toISOString(),
          (toDate(periodEnd) || addDays(nowDate, DROPLET_BILLING_PERIOD_DAYS)).toISOString(),
          roundMoney(amount)
        ]
      );
      if (rows?.[0]) return mapInvoiceRow(rows[0]);
    }
  }

  const built = buildDropletInvoiceLineItems({
    droplet: mapDropletBillingRow(droplet),
    monthlyPrice: amount,
    periodStart,
    periodEnd
  });
  return persistNewInvoice({
    userId,
    dropletId: droplet.id,
    dropletName: droplet.name,
    periodStart: built.periodStart,
    periodEnd: built.periodEnd,
    amount: built.total,
    currency: 'USD',
    status: 'paid',
    lineItems: built.lineItems,
    now: nowDate
  });
}

async function updateDropletFields(dropletId, patch = {}) {
  const columns = {
    status: 'status',
    monthlyPrice: 'monthly_price',
    monthly_price: 'monthly_price',
    billingCycle: 'billing_cycle',
    billing_cycle: 'billing_cycle',
    nextBillingAt: 'next_billing_at',
    next_billing_at: 'next_billing_at',
    graceUntil: 'grace_until',
    grace_until: 'grace_until',
    suspendedAt: 'suspended_at',
    suspended_at: 'suspended_at',
    purgeAt: 'purge_at',
    purge_at: 'purge_at',
    lastInvoiceId: 'last_invoice_id',
    last_invoice_id: 'last_invoice_id',
    preRenewalWarningAt: 'pre_renewal_warning_at',
    pre_renewal_warning_at: 'pre_renewal_warning_at'
  };

  if (!isPgActive()) {
    const rec = memoryDroplets.get(String(dropletId));
    if (!rec) return null;
    for (const [key, value] of Object.entries(patch)) {
      const col = columns[key];
      if (col) rec[col] = value;
    }
    return mapDropletBillingRow(rec);
  }

  const sets = [];
  const params = [String(dropletId)];
  for (const [key, value] of Object.entries(patch)) {
    const col = columns[key];
    if (!col) continue;
    params.push(value);
    sets.push(`${col} = $${params.length}`);
  }
  if (sets.length === 0) return null;
  const { rows } = await queryPg(
    `UPDATE cloud_droplets SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params
  );
  return mapDropletBillingRow(rows?.[0] || null);
}

async function defaultStopDroplet(droplet) {
  if (!droplet?.tenant_id) return;
  await updateUbuntuTenantStatus({
    tenantId: droplet.tenant_id,
    status: 'suspended',
    userId: droplet.user_id
  }).catch(() => {});
}

async function defaultResumeDroplet(droplet) {
  if (!droplet?.tenant_id) return;
  await updateUbuntuTenantStatus({
    tenantId: droplet.tenant_id,
    status: 'active',
    userId: droplet.user_id
  }).catch(() => {});
}

async function defaultReclaimDroplet(droplet) {
  if (droplet?.tenant_id) {
    await reclaimUbuntuTenant({
      tenantId: droplet.tenant_id,
      userId: droplet.user_id
    }).catch(() => {});
  }
  if (isPgActive() && droplet?.node_id) {
    await adjustNodeActiveDroplets(droplet.node_id, -1).catch(() => {});
  }
  if (!isPgActive()) {
    memoryDroplets.delete(String(droplet.id));
    return true;
  }
  await queryPg('DELETE FROM cloud_droplets WHERE id = $1', [String(droplet.id)]);
  return true;
}

// ==========================================
// EMAIL BUILDERS (REUSING emailService.js STYLING)
// ==========================================

export async function sendDropletProvisionedEmail({
  to,
  name,
  droplet = {},
  invoice = {},
  sendEmailFn = sendTiwloEmail,
  dashboardUrl = getPlatformUrl('dashboard'),
  billingUrl = getPlatformUrl('billing')
} = {}) {
  const cleanTo = typeof to === 'string' ? to.trim() : '';
  if (!cleanTo) {
    return { success: false, skipped: true, reason: 'missing_recipient' };
  }

  const hostname = esc(droplet.name || droplet.hostname || invoice.hostname || 'vps-instance');
  const dropletId = esc(droplet.id || invoice.dropletId || 'N/A');
  const region = esc(droplet.region || invoice.region || droplet.regionCode || 'N/A');
  const image = esc(droplet.image || 'Ubuntu 24.04 LTS');
  const specs = esc(droplet.specs || invoice.specs || `${droplet.vcpus || 1} vCPU · ${droplet.memory || '1 GB'} · ${droplet.storage || '25 GB NVMe'}`);
  const ipv4 = esc(droplet.ipv4 || droplet.ip || invoice.ipv4 || 'Pending');
  const ipv6 = esc(droplet.ipv6 || invoice.ipv6 || 'Not assigned');
  const sshUser = esc(droplet.accessUsername || droplet.access_username || 'root');
  const sshPort = droplet.sshPort || droplet.ssh_port ? esc(String(droplet.sshPort || droplet.ssh_port)) : '22';

  const invoiceNumber = esc(invoice.invoiceNumber || invoice.invoice_number || 'INV-VPS-001');
  const currency = esc(invoice.currency || 'USD');
  const prefix = currency === 'USD' ? '$' : `${currency} `;
  const subtotal = roundMoney(invoice.subtotal ?? invoice.amount ?? droplet.monthlyPrice ?? 0).toFixed(2);
  const tax = roundMoney(invoice.tax ?? 0).toFixed(2);
  const total = roundMoney(invoice.total ?? invoice.amount ?? droplet.monthlyPrice ?? 0).toFixed(2);
  const rawStatus = String(invoice.status || 'paid').toLowerCase();
  const statusLabel = rawStatus === 'paid' ? 'Paid' : rawStatus === 'past_due' ? 'Past Due' : 'Pending';
  const chipStyle = rawStatus === 'paid'
    ? 'background-color: #e6f4ea; color: #137333;'
    : 'background-color: #fef7e0; color: #8a4b00;';

  const periodStart = esc(formatShortDate(invoice.billingPeriodStart || invoice.billing_period_start || new Date()));
  const periodEnd = esc(formatShortDate(invoice.billingPeriodEnd || invoice.billing_period_end || addDays(new Date(), DROPLET_BILLING_PERIOD_DAYS)));
  const safeDashUrl = safeUrl(dashboardUrl);
  const safeBillingUrl = safeUrl(billingUrl);

  const contentHtml = `
    <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
      Your Cloud VPS is provisioned
    </h1>
    <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
      Hello ${esc(name || 'Customer')}, your monthly Cloud VPS <strong>${hostname}</strong> is active. Below are your server details and monthly invoice.
    </p>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 20px;">
      <tr>
        <td style="padding: 18px 20px; text-align: center;">
          <div style="font-size: 11px; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Monthly VPS Invoice · ${invoiceNumber}</div>
          <div style="font-size: 30px; font-weight: 500; color: #202124; line-height: 36px; margin-bottom: 8px;">${prefix}${total}</div>
          <span style="display: inline-block; ${chipStyle} font-size: 12px; font-weight: 500; padding: 2px 10px; border-radius: 4px;">
            ${statusLabel} · Monthly Billing
          </span>
        </td>
      </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 20px; font-size: 13px; line-height: 20px;">
      <tr>
        <td style="padding: 14px 18px;">
          <div style="font-size: 12px; font-weight: 600; color: #5f6368; text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px;">Server Specifications</div>
          <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr><td style="padding: 3px 0; color: #70757a; width: 130px;">Hostname</td><td style="padding: 3px 0; color: #202124; font-weight: 500;">${hostname}</td></tr>
            <tr><td style="padding: 3px 0; color: #70757a;">Droplet ID</td><td style="padding: 3px 0; color: #202124; font-family: Consolas, monospace;">${dropletId}</td></tr>
            <tr><td style="padding: 3px 0; color: #70757a;">Region</td><td style="padding: 3px 0; color: #202124;">${region}</td></tr>
            <tr><td style="padding: 3px 0; color: #70757a;">OS Image</td><td style="padding: 3px 0; color: #202124;">${image}</td></tr>
            <tr><td style="padding: 3px 0; color: #70757a;">Configuration</td><td style="padding: 3px 0; color: #202124;">${specs}</td></tr>
            <tr><td style="padding: 3px 0; color: #70757a;">IPv4 Address</td><td style="padding: 3px 0; color: #202124; font-family: Consolas, monospace;">${ipv4}</td></tr>
            <tr><td style="padding: 3px 0; color: #70757a;">IPv6 Address</td><td style="padding: 3px 0; color: #202124; font-family: Consolas, monospace;">${ipv6}</td></tr>
            <tr><td style="padding: 3px 0; color: #70757a;">SSH Access</td><td style="padding: 3px 0; color: #202124; font-family: Consolas, monospace;">${sshUser} (port ${sshPort})</td></tr>
          </table>
        </td>
      </tr>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; font-size: 13px; margin-bottom: 22px;">
      <thead>
        <tr style="border-bottom: 1px solid #dadce0;">
          <th align="left" style="padding: 8px 0; color: #70757a; font-weight: 500;">Description</th>
          <th align="right" style="padding: 8px 0; color: #70757a; font-weight: 500;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #f1f3f4;">
          <td style="padding: 10px 0; color: #202124;">Monthly VPS (${hostname}) · ${periodStart} - ${periodEnd}</td>
          <td align="right" style="padding: 10px 0; color: #202124;">${prefix}${subtotal}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f3f4;">
          <td style="padding: 8px 0; color: #5f6368;">Subtotal</td>
          <td align="right" style="padding: 8px 0; color: #202124;">${prefix}${subtotal}</td>
        </tr>
        <tr style="border-bottom: 1px solid #f1f3f4;">
          <td style="padding: 8px 0; color: #5f6368;">Tax</td>
          <td align="right" style="padding: 8px 0; color: #202124;">${prefix}${tax}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0 0 0; color: #202124; font-weight: 600;">Total (${currency})</td>
          <td align="right" style="padding: 10px 0 0 0; color: #202124; font-weight: 600;">${prefix}${total}</td>
        </tr>
      </tbody>
    </table>

    <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${safeDashUrl}" target="_blank" style="display: inline-block; background-color: #137333; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 22px; border-radius: 4px; margin-right: 8px;">
            Open Cloud Console
          </a>
          <a href="${safeBillingUrl}" target="_blank" style="display: inline-block; background-color: #ffffff; color: #202124; border: 1px solid #dadce0; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 18px; border-radius: 4px;">
            View Billing
          </a>
        </td>
      </tr>
    </table>
  `;

  const html = renderBaseEmail({
    title: `Cloud VPS Provisioned & Invoice [${invoiceNumber}]`,
    recipientEmail: cleanTo,
    contentHtml,
    preheader: `Your VPS ${droplet.name || droplet.hostname || ''} is active. Invoice ${invoiceNumber} (${prefix}${total} - ${statusLabel}).`
  });

  const subject = `Cloud VPS Provisioned: ${droplet.name || droplet.hostname || 'VPS'} [${invoice.invoiceNumber || invoice.invoice_number || 'INV'}]`;
  const text = `Your Tiwlo Cloud VPS ${droplet.name || ''} (${droplet.specs || ''}, IP: ${droplet.ipv4 || droplet.ip || 'Pending'}, Region: ${droplet.region || ''}) is active. Invoice ${invoice.invoiceNumber || ''} (${prefix}${total}, ${statusLabel}) for ${periodStart} - ${periodEnd}.`;

  return sendEmailFn({
    to: cleanTo,
    subject,
    html,
    text,
    type: 'cloud_vps_provisioned',
    metadata: {
      dropletId: droplet.id || null,
      invoiceNumber: invoice.invoiceNumber || invoice.invoice_number || null,
      amount: Number(total),
      status: rawStatus
    }
  });
}

export async function sendDropletLifecycleEmail({
  event,
  to,
  name,
  droplet = {},
  invoice = null,
  amountDue = 0,
  currency = 'USD',
  graceUntil = null,
  suspendedAt = null,
  purgeAt = null,
  nextBillingAt = null,
  availableBalance = 0,
  totalUpcomingAmount = 0,
  shortfall = 0,
  upcomingDroplets = [],
  sendEmailFn = sendTiwloEmail,
  billingUrl = getPlatformUrl('billing'),
  dashboardUrl = getPlatformUrl('dashboard')
} = {}) {
  const cleanTo = typeof to === 'string' ? to.trim() : '';
  if (!cleanTo) {
    return { success: false, skipped: true, reason: 'missing_recipient' };
  }

  const normalizedEvent = String(event || '').trim().toLowerCase();
  const safeName = esc(name || 'Customer');
  const hostname = esc(droplet.name || droplet.hostname || 'your Cloud VPS');
  const region = esc(droplet.region || droplet.regionCode || 'N/A');
  const ipv4 = esc(droplet.ipv4 || droplet.ip || 'N/A');
  const prefix = currency === 'USD' ? '$' : `${esc(currency)} `;
  const invoiceNum = esc(invoice?.invoiceNumber || invoice?.invoice_number || '');
  const safeBillingUrl = safeUrl(billingUrl);
  const safeDashUrl = safeUrl(dashboardUrl);

  let title = 'Tiwlo Cloud VPS Update';
  let subject = `Tiwlo Cloud VPS Notification: ${droplet.name || 'VPS'}`;
  let text = '';
  let contentHtml = '';
  let mailType = `cloud_vps_${normalizedEvent || 'notice'}`;

  if (normalizedEvent === 'renewal_paid' || normalizedEvent === 'paid') {
    const amountStr = roundMoney(invoice?.amount ?? amountDue ?? droplet.monthlyPrice ?? 0).toFixed(2);
    const periodStart = esc(formatShortDate(invoice?.billingPeriodStart));
    const periodEnd = esc(formatShortDate(invoice?.billingPeriodEnd || nextBillingAt));
    title = `Monthly VPS Invoice Paid [${invoiceNum}]`;
    subject = `Cloud VPS Renewal Receipt: ${droplet.name || 'VPS'} [${invoice?.invoiceNumber || 'INV'}]`;
    text = `Your monthly Cloud VPS ${droplet.name || ''} renewed for ${prefix}${amountStr} (${periodStart} - ${periodEnd}). Invoice ${invoice?.invoiceNumber || ''} is Paid.`;
    contentHtml = `
      <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
        Monthly VPS renewal paid
      </h1>
      <p style="margin: 0 0 22px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
        Hello ${safeName}, your monthly subscription for <strong>${hostname}</strong> has been renewed successfully.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border: 1px solid #dadce0; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 18px 20px; text-align: center;">
            <div style="font-size: 11px; color: #5f6368; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Invoice ${invoiceNum}</div>
            <div style="font-size: 28px; font-weight: 500; color: #202124; margin-bottom: 8px;">${prefix}${amountStr}</div>
            <span style="display: inline-block; background-color: #e6f4ea; color: #137333; font-size: 12px; font-weight: 500; padding: 2px 10px; border-radius: 4px;">Paid</span>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; line-height: 20px; margin-bottom: 22px;">
        <tr><td style="padding: 4px 0; color: #70757a; width: 130px;">VPS Hostname</td><td style="padding: 4px 0; color: #202124;">${hostname}</td></tr>
        <tr><td style="padding: 4px 0; color: #70757a;">Region / IPv4</td><td style="padding: 4px 0; color: #202124;">${region} (${ipv4})</td></tr>
        <tr><td style="padding: 4px 0; color: #70757a;">Billing Period</td><td style="padding: 4px 0; color: #202124;">${periodStart} - ${periodEnd}</td></tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center"><a href="${safeBillingUrl}" target="_blank" style="display: inline-block; background-color: #137333; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 22px; border-radius: 4px;">View Invoice</a></td></tr>
      </table>
    `;
  } else if (normalizedEvent === 'grace_period' || normalizedEvent === 'past_due') {
    const dueStr = roundMoney(amountDue ?? invoice?.amount ?? droplet.monthlyPrice ?? 0).toFixed(2);
    const deadlineStr = esc(formatUtc(graceUntil));
    title = `Action required: Payment reminder for ${hostname}`;
    subject = `Action required: Monthly VPS payment past due for ${droplet.name || 'VPS'} (Grace period active)`;
    text = `Hello ${name || 'Customer'}, your monthly renewal of ${prefix}${dueStr} for VPS ${droplet.name || ''} (${invoice?.invoiceNumber || ''}) could not be charged due to insufficient credits. Your VPS remains active during the grace period until ${formatUtc(graceUntil)}. Recharge credits at ${billingUrl} to prevent suspension.`;
    contentHtml = `
      <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
        Payment reminder: grace period active
      </h1>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
        Hello ${safeName}, we could not deduct <strong>${prefix}${dueStr}</strong> for your monthly Cloud VPS <strong>${hostname}</strong> due to insufficient wallet credits.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef7e0; border: 1px solid #f6d57a; border-radius: 8px; margin-bottom: 22px;">
        <tr>
          <td style="padding: 16px 20px; font-size: 13px; line-height: 20px; color: #3c4043;">
            <div><strong>VPS Hostname:</strong> ${hostname} (${ipv4})</div>
            ${invoiceNum ? `<div><strong>Invoice:</strong> ${invoiceNum} (Past Due)</div>` : ''}
            <div><strong>Amount Due:</strong> ${prefix}${dueStr}</div>
            <div><strong>Grace Period Ends:</strong> ${deadlineStr}</div>
            <div style="margin-top: 8px; color: #5f6368;">
              Your VPS remains online during this grace period. Please top up your billing credits before the deadline to avoid service suspension.
            </div>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center"><a href="${safeBillingUrl}" target="_blank" style="display: inline-block; background-color: #1ed760; color: #000000; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 24px; border-radius: 6px;">Add Credits Now</a></td></tr>
      </table>
    `;
  } else if (normalizedEvent === 'suspended') {
    const dueStr = roundMoney(amountDue ?? droplet.monthlyPrice ?? 0).toFixed(2);
    const suspendedStr = esc(formatUtc(suspendedAt));
    const purgeStr = esc(formatUtc(purgeAt));
    title = `VPS Suspended: ${hostname}`;
    subject = `Cloud VPS Suspended: ${droplet.name || 'VPS'} (Permanent deletion on ${formatShortDate(purgeAt)})`;
    text = `Your Cloud VPS ${droplet.name || ''} was suspended on ${formatUtc(suspendedAt)} after the grace period expired without payment (${prefix}${dueStr} due). Your VPS runtime is stopped and IP is on hold. Recharge credits at ${billingUrl} before ${formatUtc(purgeAt)} to automatically restore your VPS before permanent deletion.`;
    contentHtml = `
      <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
        Cloud VPS suspended due to unpaid invoice
      </h1>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
        Hello ${safeName}, the grace period for <strong>${hostname}</strong> expired without sufficient wallet balance. Your VPS runtime has been stopped.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fce8e6; border: 1px solid #f6aea9; border-radius: 8px; margin-bottom: 22px;">
        <tr>
          <td style="padding: 16px 20px; font-size: 13px; line-height: 20px; color: #3c4043;">
            <div><strong>VPS Hostname:</strong> ${hostname} (${ipv4})</div>
            <div><strong>Suspended On:</strong> ${suspendedStr}</div>
            <div><strong>Amount Due to Restore:</strong> ${prefix}${dueStr}</div>
            <div><strong>Scheduled Permanent Deletion:</strong> ${purgeStr}</div>
            <div style="margin-top: 8px; color: #5f6368;">
              Add at least ${prefix}${dueStr} to your Tiwlo Billing Wallet before ${purgeStr} to automatically reactivate your VPS and restore its runtime and IP allocation. After that date, all VPS data and backups will be permanently purged.
            </div>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center"><a href="${safeBillingUrl}" target="_blank" style="display: inline-block; background-color: #1ed760; color: #000000; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 24px; border-radius: 6px;">Recharge Credits to Restore VPS</a></td></tr>
      </table>
    `;
  } else if (normalizedEvent === 'unsuspended' || normalizedEvent === 'reactivated') {
    const paidStr = roundMoney(invoice?.amount ?? amountDue ?? droplet.monthlyPrice ?? 0).toFixed(2);
    const nextStr = esc(formatShortDate(nextBillingAt || invoice?.billingPeriodEnd));
    title = `Cloud VPS Reactivated: ${hostname}`;
    subject = `Cloud VPS Restored & Invoice Paid: ${droplet.name || 'VPS'} [${invoice?.invoiceNumber || 'INV'}]`;
    text = `Good news! Your payment of ${prefix}${paidStr} (${invoice?.invoiceNumber || ''}) was processed and your Cloud VPS ${droplet.name || ''} is active again. Next billing date: ${formatShortDate(nextBillingAt || invoice?.billingPeriodEnd)}.`;
    contentHtml = `
      <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
        Cloud VPS restored and active
      </h1>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
        Hello ${safeName}, thank you for topping up your Tiwlo Credits. Your Cloud VPS <strong>${hostname}</strong> has been automatically reactivated and its runtime has resumed.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #e6f4ea; border: 1px solid #ceead6; border-radius: 8px; margin-bottom: 22px;">
        <tr>
          <td style="padding: 16px 20px; font-size: 13px; line-height: 20px; color: #202124;">
            <div><strong>VPS Hostname:</strong> ${hostname} (${ipv4})</div>
            ${invoiceNum ? `<div><strong>Invoice Paid:</strong> ${invoiceNum} (${prefix}${paidStr})</div>` : ''}
            <div><strong>Status:</strong> Active</div>
            <div><strong>Next Monthly Renewal:</strong> ${nextStr}</div>
          </td>
        </tr>
      </table>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center"><a href="${safeDashUrl}" target="_blank" style="display: inline-block; background-color: #137333; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 22px; border-radius: 4px;">Open Cloud Console</a></td></tr>
      </table>
    `;
  } else if (normalizedEvent === 'terminated' || normalizedEvent === 'purged') {
    const purgedStr = esc(formatUtc(purgeAt || new Date()));
    title = `Cloud VPS Permanently Terminated: ${hostname}`;
    subject = `Cloud VPS Terminated & Data Purged: ${droplet.name || 'VPS'}`;
    text = `Your suspended Cloud VPS ${droplet.name || ''} (${ipv4}) reached its deletion deadline (${formatUtc(purgeAt || new Date())}) without renewal and has been permanently terminated. All tenant data, backups, and IP allocations have been cleared. Your Tiwlo account remains intact.`;
    contentHtml = `
      <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
        Cloud VPS permanently terminated
      </h1>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
        Hello ${safeName}, after completing the 7-day suspension window without renewal, your Cloud VPS <strong>${hostname}</strong> (${region}, ${ipv4}) was permanently terminated on ${purgedStr}.
      </p>
      <p style="margin: 0 0 22px 0; font-size: 13px; line-height: 20px; color: #5f6368; text-align: center;">
        Its container filesystem, tenant quota, stale backups, and IP allocation have been permanently cleared. Your Tiwlo account remains active and you may deploy a new VPS at any time.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center"><a href="${safeDashUrl}" target="_blank" style="display: inline-block; background-color: #202124; color: #ffffff; font-size: 14px; font-weight: 500; text-decoration: none; padding: 10px 22px; border-radius: 6px;">Go to Tiwlo Cloud</a></td></tr>
      </table>
    `;
  } else if (normalizedEvent === 'pre_renewal_warning' || normalizedEvent === 'low_balance_warning') {
    const upcomingStr = roundMoney(totalUpcomingAmount).toFixed(2);
    const balanceStr = roundMoney(availableBalance).toFixed(2);
    const shortfallStr = roundMoney(shortfall).toFixed(2);
    const itemsRows = (Array.isArray(upcomingDroplets) ? upcomingDroplets : []).map((d) => `
      <tr style="border-bottom: 1px solid #f1f3f4;">
        <td style="padding: 6px 0; color: #202124;">${esc(d.name || d.hostname || d.id)}</td>
        <td style="padding: 6px 0; color: #5f6368;">${esc(formatShortDate(d.nextBillingAt || d.next_billing_at))}</td>
        <td align="right" style="padding: 6px 0; color: #202124; font-weight: 500;">${prefix}${roundMoney(d.monthlyPrice ?? d.monthly_price ?? 0).toFixed(2)}</td>
      </tr>
    `).join('');
    title = 'Low Balance Runway Warning: Upcoming VPS Renewals';
    subject = `Low balance warning: ${prefix}${shortfallStr} shortfall for upcoming Cloud VPS renewals`;
    text = `Proactive billing alert: Your upcoming Cloud VPS monthly renewals total ${prefix}${upcomingStr}, while your current wallet balance is ${prefix}${balanceStr} (predicted shortfall: ${prefix}${shortfallStr}). Top up at ${billingUrl} to prevent service interruption.`;
    contentHtml = `
      <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 500; line-height: 28px; color: #202124; text-align: center;">
        Low balance runway warning
      </h1>
      <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 22px; color: #3c4043; text-align: center;">
        Hello ${safeName}, you have upcoming monthly Cloud VPS renewals that exceed your current Tiwlo wallet balance.
      </p>
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef7e0; border: 1px solid #f6d57a; border-radius: 8px; margin-bottom: 20px;">
        <tr>
          <td style="padding: 16px 20px; font-size: 13px; line-height: 20px; color: #3c4043;">
            <div><strong>Upcoming Renewals Total:</strong> ${prefix}${upcomingStr}</div>
            <div><strong>Current Wallet Balance:</strong> ${prefix}${balanceStr}</div>
            <div><strong>Predicted Shortfall:</strong> ${prefix}${shortfallStr}</div>
          </td>
        </tr>
      </table>
      ${itemsRows ? `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 1px solid #dadce0;">
            <th align="left" style="padding: 6px 0; color: #70757a; font-weight: 500;">VPS</th>
            <th align="left" style="padding: 6px 0; color: #70757a; font-weight: 500;">Renewal Date</th>
            <th align="right" style="padding: 6px 0; color: #70757a; font-weight: 500;">Monthly Fee</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>` : ''}
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr><td align="center"><a href="${safeBillingUrl}" target="_blank" style="display: inline-block; background-color: #1ed760; color: #000000; font-size: 14px; font-weight: 600; text-decoration: none; padding: 11px 24px; border-radius: 6px;">Top Up Wallet Credits</a></td></tr>
      </table>
    `;
  } else {
    throw new TypeError(`Unsupported droplet lifecycle email event: ${event}`);
  }

  const html = renderBaseEmail({
    title,
    recipientEmail: cleanTo,
    contentHtml,
    preheader: text.slice(0, 140)
  });

  return sendEmailFn({
    to: cleanTo,
    subject,
    html,
    text,
    type: mailType,
    metadata: {
      event: normalizedEvent,
      dropletId: droplet.id || null,
      invoiceNumber: invoice?.invoiceNumber || invoice?.invoice_number || null
    }
  });
}

// ==========================================
// CORE MONTHLY SUBSCRIPTION & BILLING LIFECYCLE
// ==========================================

export async function initializeMonthlyDropletSubscription({
  userId,
  droplet,
  monthlyPrice,
  now = new Date(),
  graceDays = DROPLET_GRACE_PERIOD_DAYS,
  taxRate = 0,
  sendEmailFn = sendTiwloEmail,
  notifyFn = null,
  billingDB = BillingDB,
  recipientEmail = null,
  recipientName = null
} = {}) {
  if (!userId) throw new TypeError('userId is required');
  if (!droplet?.id) throw new TypeError('droplet.id is required');
  const price = roundMoney(Number(monthlyPrice ?? droplet.monthlyPrice ?? droplet.monthly_price ?? 0));
  if (!Number.isFinite(price) || price < 0) {
    throw new TypeError('monthlyPrice must be a non-negative number');
  }

  await ensureDropletBillingSchema();

  const nowDate = toDate(now) || new Date();
  const nextBillingDate = addDays(nowDate, DROPLET_BILLING_PERIOD_DAYS);
  const built = buildDropletInvoiceLineItems({
    droplet,
    monthlyPrice: price,
    periodStart: nowDate,
    periodEnd: nextBillingDate,
    taxRate
  });

  const chargeRes = price > 0
    ? await attemptAtomicWalletCharge(
        userId,
        built.total,
        `Monthly Cloud VPS (${built.hostname})`,
        { dropletId: droplet.id, hostname: built.hostname, billingCycle: 'monthly', initialProvision: true },
        billingDB
      )
    : { success: true, chargedAmount: 0, cashCreditUsed: 0, promoCreditUsed: 0 };

  const charged = Boolean(chargeRes?.success);
  const invoiceStatus = charged ? 'paid' : 'past_due';
  const graceUntilIso = charged ? null : addDays(nowDate, graceDays).toISOString();

  const invoice = await persistNewInvoice({
    userId,
    dropletId: droplet.id,
    dropletName: built.hostname,
    periodStart: built.periodStart,
    periodEnd: built.periodEnd,
    amount: built.total,
    currency: 'USD',
    status: invoiceStatus,
    lineItems: built.lineItems,
    now: nowDate
  });

  if (!isPgActive()) {
    const existing = memoryDroplets.get(String(droplet.id));
    const merged = normalizeDropletRecord({
      ...(existing || {}),
      ...droplet,
      user_id: String(userId),
      monthly_price: price,
      billing_cycle: 'monthly',
      next_billing_at: nextBillingDate.toISOString(),
      grace_until: graceUntilIso,
      suspended_at: null,
      purge_at: null,
      last_invoice_id: invoice.id,
      created_at: existing?.created_at || droplet.createdAt || droplet.created_at || nowDate.toISOString()
    });
    memoryDroplets.set(merged.id, merged);
  } else {
    await updateDropletFields(droplet.id, {
      monthly_price: price,
      billing_cycle: 'monthly',
      next_billing_at: nextBillingDate.toISOString(),
      grace_until: graceUntilIso,
      suspended_at: null,
      purge_at: null,
      last_invoice_id: invoice.id
    });
  }

  const activity = await recordCloudActivity({
    userId,
    action: charged
      ? `Monthly VPS subscription initialized (${invoice.invoiceNumber} · $${built.total.toFixed(2)} USD paid)`
      : `Monthly VPS subscription initialized (${invoice.invoiceNumber} · $${built.total.toFixed(2)} USD past due)`,
    target: built.hostname,
    now: nowDate
  });

  const notification = await recordSocialNotification({
    userId,
    type: 'cloud_vps_provisioned',
    title: `Cloud VPS ${built.hostname} provisioned`,
    message: charged
      ? `Monthly VPS ${built.hostname} is active. Invoice ${invoice.invoiceNumber} ($${built.total.toFixed(2)} USD) was paid.`
      : `Monthly VPS ${built.hostname} was provisioned with invoice ${invoice.invoiceNumber} ($${built.total.toFixed(2)} USD past due). Top up credits to clear balance.`,
    entityId: droplet.id,
    meta: {
      dropletId: droplet.id,
      dropletName: built.hostname,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      amount: built.total,
      status: invoiceStatus,
      nextBillingAt: nextBillingDate.toISOString()
    },
    now: nowDate,
    notifyFn
  });

  const contact = await getUserContactInfo(userId, {
    recipientEmail: recipientEmail || droplet.userEmail,
    recipientName: recipientName || droplet.userName
  });

  const updatedDroplet = !isPgActive()
    ? mapDropletBillingRow(memoryDroplets.get(String(droplet.id)))
    : {
        ...droplet,
        userId: String(userId),
        monthlyPrice: price,
        billingCycle: 'monthly',
        nextBillingAt: nextBillingDate.toISOString(),
        graceUntil: graceUntilIso,
        suspendedAt: null,
        purgeAt: null,
        lastInvoiceId: invoice.id
      };

  const emailResult = await sendDropletProvisionedEmail({
    to: contact.email,
    name: contact.name,
    droplet: updatedDroplet,
    invoice,
    sendEmailFn
  });

  if (emailResult?.success) {
    await markInvoiceEmailSent(invoice.id, nowDate);
    invoice.emailSentAt = nowDate.toISOString();
  }

  return {
    success: true,
    charged,
    droplet: updatedDroplet,
    invoice,
    emailResult,
    notification,
    activity
  };
}

export async function predictUpcomingRenewalRisks({
  now = new Date(),
  lookaheadDays = DROPLET_RENEWAL_LOOKAHEAD_DAYS,
  sendEmailFn = sendTiwloEmail,
  notifyFn = null,
  billingDB = BillingDB
} = {}) {
  await ensureDropletBillingSchema();
  const nowDate = toDate(now) || new Date();
  const horizonDate = addDays(nowDate, Math.max(1, Number(lookaheadDays) || DROPLET_RENEWAL_LOOKAHEAD_DAYS));
  const nowIso = nowDate.toISOString();
  const horizonIso = horizonDate.toISOString();

  let upcomingRows = [];
  if (!isPgActive()) {
    upcomingRows = [...memoryDroplets.values()].filter((d) => {
      if (d.status !== 'active') return false;
      if (!(Number(d.monthly_price) > 0)) return false;
      const nextAt = toDate(d.next_billing_at);
      return Boolean(nextAt && nextAt > nowDate && nextAt <= horizonDate);
    });
  } else {
    const { rows } = await queryPg(
      `SELECT * FROM cloud_droplets
       WHERE status = 'active'
         AND COALESCE(monthly_price, 0) > 0
         AND next_billing_at > $1::timestamptz
         AND next_billing_at <= $2::timestamptz
       ORDER BY next_billing_at ASC, id ASC`,
      [nowIso, horizonIso]
    );
    upcomingRows = rows || [];
  }

  const byUser = new Map();
  for (const row of upcomingRows) {
    const uid = String(row.user_id || '');
    if (!uid) continue;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(row);
  }

  const risks = [];
  let warningsSent = 0;

  for (const [userId, droplets] of byUser.entries()) {
    const totalUpcomingAmount = roundMoney(
      droplets.reduce((sum, d) => sum + Number(d.monthly_price || 0), 0)
    );
    const availableBalance = await getAvailableWalletBalance(userId, { now: nowDate, billingDB });
    if (availableBalance >= totalUpcomingAmount) continue;

    const shortfall = roundMoney(totalUpcomingAmount - availableBalance);

    // Deduplicate: skip if every upcoming droplet was already warned within this lookahead window
    const unwarnedDroplets = droplets.filter((d) => {
      const warnedAt = toDate(d.pre_renewal_warning_at);
      if (!warnedAt) return true;
      const nextAt = toDate(d.next_billing_at);
      if (!nextAt) return false;
      const cycleWindowStart = addDays(nextAt, -Math.max(1, Number(lookaheadDays) || DROPLET_RENEWAL_LOOKAHEAD_DAYS));
      return warnedAt < cycleWindowStart;
    });

    if (unwarnedDroplets.length === 0) {
      risks.push({
        userId,
        totalUpcomingAmount,
        availableBalance,
        shortfall,
        droplets: droplets.map(mapDropletBillingRow),
        warned: false,
        deduplicated: true
      });
      continue;
    }

    const mappedDroplets = droplets.map(mapDropletBillingRow);
    const contact = await getUserContactInfo(userId);

    const emailResult = await sendDropletLifecycleEmail({
      event: 'pre_renewal_warning',
      to: contact.email,
      name: contact.name,
      droplet: mappedDroplets[0],
      availableBalance,
      totalUpcomingAmount,
      shortfall,
      upcomingDroplets: mappedDroplets,
      sendEmailFn
    });

    const notification = await recordSocialNotification({
      userId,
      type: 'pre_renewal_warning',
      title: 'Low balance warning for upcoming VPS renewals',
      message: `Upcoming monthly VPS renewals total $${totalUpcomingAmount.toFixed(2)} USD, but your balance is $${availableBalance.toFixed(2)} USD (shortfall $${shortfall.toFixed(2)} USD). Top up to prevent suspension.`,
      entityId: mappedDroplets[0]?.id || null,
      meta: {
        totalUpcomingAmount,
        availableBalance,
        shortfall,
        dropletIds: mappedDroplets.map((d) => d.id)
      },
      now: nowDate,
      notifyFn
    });

    for (const d of droplets) {
      await updateDropletFields(d.id, { pre_renewal_warning_at: nowIso });
    }

    warningsSent += 1;
    risks.push({
      userId,
      totalUpcomingAmount,
      availableBalance,
      shortfall,
      droplets: mappedDroplets,
      warned: true,
      deduplicated: false,
      emailResult,
      notification
    });
  }

  return {
    lookaheadDays,
    checkedUsers: byUser.size,
    atRiskUsers: risks.length,
    warningsSent,
    risks
  };
}

export async function runMonthlyDropletBillingSweep({
  now = new Date(),
  graceDays = DROPLET_GRACE_PERIOD_DAYS,
  suspendBeforeDeleteDays = DROPLET_SUSPEND_BEFORE_DELETE_DAYS,
  lookaheadDays = DROPLET_RENEWAL_LOOKAHEAD_DAYS,
  enablePredictiveWarnings = true,
  sendEmailFn = sendTiwloEmail,
  notifyFn = null,
  stopDropletFn = null,
  holdIpFn = null,
  reclaimDropletFn = null,
  billingDB = BillingDB
} = {}) {
  if (isSweepRunning) {
    return {
      skipped: true,
      reason: 'sweep_already_running',
      processed: 0,
      renewed: 0,
      enteredGrace: 0,
      suspended: 0,
      purged: 0,
      warningsSent: 0
    };
  }

  isSweepRunning = true;
  const summary = {
    skipped: false,
    processed: 0,
    renewed: 0,
    enteredGrace: 0,
    inGraceDeduplicated: 0,
    suspended: 0,
    purged: 0,
    warningsSent: 0,
    predictiveRisks: null
  };

  try {
    await ensureDropletBillingSchema();
    const nowDate = toDate(now) || new Date();
    const nowIso = nowDate.toISOString();

    if (enablePredictiveWarnings !== false) {
      const riskReport = await predictUpcomingRenewalRisks({
        now: nowDate,
        lookaheadDays,
        sendEmailFn,
        notifyFn,
        billingDB
      });
      summary.warningsSent = riskReport.warningsSent;
      summary.predictiveRisks = riskReport;
    }

    let candidateRows = [];
    if (!isPgActive()) {
      candidateRows = [...memoryDroplets.values()]
        .filter((d) => Number(d.monthly_price) > 0)
        .sort((a, b) => Date.parse(a.created_at || 0) - Date.parse(b.created_at || 0));
    } else {
      const { rows } = await queryPg(
        `SELECT * FROM cloud_droplets
         WHERE COALESCE(monthly_price, 0) > 0
           AND (
             (status = 'active' AND (next_billing_at <= $1::timestamptz OR grace_until <= $1::timestamptz))
             OR (status = 'suspended' AND purge_at <= $1::timestamptz)
           )
         ORDER BY created_at ASC, id ASC`,
        [nowIso]
      );
      candidateRows = rows || [];
    }

    for (const rawRow of candidateRows) {
      const droplet = { ...rawRow };
      const monthlyPrice = roundMoney(droplet.monthly_price);
      if (!(monthlyPrice > 0)) continue;

      const status = String(droplet.status || 'active').toLowerCase();
      const nextBillingAt = toDate(droplet.next_billing_at);
      const graceUntil = toDate(droplet.grace_until);
      const purgeAt = toDate(droplet.purge_at);

      // 1. Hard termination & complete data clear after suspension purge window expires
      if (status === 'suspended' && purgeAt && purgeAt <= nowDate) {
        summary.processed += 1;
        const mappedBeforePurge = mapDropletBillingRow(droplet);
        const contact = await getUserContactInfo(droplet.user_id);

        if (typeof reclaimDropletFn === 'function') {
          await reclaimDropletFn(mappedBeforePurge, { now: nowDate, reason: 'billing_purge_expired' });
          if (!isPgActive()) {
            memoryDroplets.delete(String(droplet.id));
          } else {
            await queryPg('DELETE FROM cloud_droplets WHERE id = $1', [String(droplet.id)]).catch(() => {});
          }
        } else {
          await defaultReclaimDroplet(droplet);
        }

        await recordCloudActivity({
          userId: droplet.user_id,
          action: `Terminated suspended VPS and purged tenant data (${droplet.storage || 'storage'})`,
          target: droplet.name,
          now: nowDate
        });

        await recordSocialNotification({
          userId: droplet.user_id,
          type: 'cloud_vps_terminated',
          title: `Cloud VPS ${droplet.name} permanently terminated`,
          message: `Suspended VPS ${droplet.name} was permanently deleted after the ${suspendBeforeDeleteDays}-day grace retention window expired.`,
          entityId: droplet.id,
          meta: {
            dropletId: droplet.id,
            dropletName: droplet.name,
            purgeAt: purgeAt.toISOString(),
            terminatedAt: nowIso
          },
          now: nowDate,
          notifyFn
        });

        await sendDropletLifecycleEmail({
          event: 'terminated',
          to: contact.email,
          name: contact.name,
          droplet: mappedBeforePurge,
          purgeAt: nowDate,
          sendEmailFn
        });

        summary.purged += 1;
        continue;
      }

      // 2. Grace period expired on active droplet -> retry once, otherwise suspend
      if (status === 'active' && graceUntil && graceUntil <= nowDate) {
        summary.processed += 1;
        const contact = await getUserContactInfo(droplet.user_id);
        const retryCharge = await attemptAtomicWalletCharge(
          droplet.user_id,
          monthlyPrice,
          `Monthly Cloud VPS Renewal (${droplet.name})`,
          { dropletId: droplet.id, hostname: droplet.name, billingCycle: 'monthly', phase: 'grace_expiry_retry' },
          billingDB
        );

        if (retryCharge?.success) {
          const nextPeriodEnd = addDays(nowDate, DROPLET_BILLING_PERIOD_DAYS);
          const invoice = await settleOrCreatePaidInvoice({
            droplet,
            userId: droplet.user_id,
            amount: monthlyPrice,
            periodStart: nowDate,
            periodEnd: nextPeriodEnd,
            now: nowDate
          });
          const updated = await updateDropletFields(droplet.id, {
            next_billing_at: nextPeriodEnd.toISOString(),
            grace_until: null,
            pre_renewal_warning_at: null,
            last_invoice_id: invoice.id
          });
          await recordCloudActivity({
            userId: droplet.user_id,
            action: `Monthly VPS renewed before suspension (${invoice.invoiceNumber} · $${monthlyPrice.toFixed(2)} USD)`,
            target: droplet.name,
            now: nowDate
          });
          await recordSocialNotification({
            userId: droplet.user_id,
            type: 'cloud_vps_invoice_paid',
            title: `Cloud VPS ${droplet.name} renewed`,
            message: `Monthly VPS ${droplet.name} renewed for $${monthlyPrice.toFixed(2)} USD (${invoice.invoiceNumber}).`,
            entityId: droplet.id,
            meta: { dropletId: droplet.id, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber },
            now: nowDate,
            notifyFn
          });
          const emailRes = await sendDropletLifecycleEmail({
            event: 'renewal_paid',
            to: contact.email,
            name: contact.name,
            droplet: updated || mapDropletBillingRow(droplet),
            invoice,
            nextBillingAt: nextPeriodEnd,
            sendEmailFn
          });
          if (emailRes?.success) await markInvoiceEmailSent(invoice.id, nowDate);
          summary.renewed += 1;
          continue;
        }

        // Still insufficient -> suspend runtime, hold IP, set 7-day purge countdown
        const scheduledPurgeAt = addDays(nowDate, suspendBeforeDeleteDays);
        const updatedSuspended = await updateDropletFields(droplet.id, {
          status: 'suspended',
          suspended_at: nowIso,
          purge_at: scheduledPurgeAt.toISOString()
        });
        const mappedSuspended = updatedSuspended || mapDropletBillingRow({
          ...droplet,
          status: 'suspended',
          suspended_at: nowIso,
          purge_at: scheduledPurgeAt.toISOString()
        });

        if (typeof stopDropletFn === 'function') {
          await stopDropletFn(mappedSuspended, { now: nowDate, reason: 'grace_expired' });
        } else {
          await defaultStopDroplet(droplet);
        }

        if (typeof holdIpFn === 'function') {
          await holdIpFn(mappedSuspended, { now: nowDate, reason: 'billing_suspended' });
        }

        await recordCloudActivity({
          userId: droplet.user_id,
          action: `Suspended VPS due to unpaid monthly invoice (purge scheduled ${scheduledPurgeAt.toISOString().slice(0, 10)})`,
          target: droplet.name,
          now: nowDate
        });

        await recordSocialNotification({
          userId: droplet.user_id,
          type: 'cloud_vps_suspended',
          title: `Cloud VPS ${droplet.name} suspended`,
          message: `Your VPS ${droplet.name} was suspended after the ${graceDays}-day grace period. Recharge credits before ${scheduledPurgeAt.toISOString().slice(0, 10)} to avoid permanent deletion.`,
          entityId: droplet.id,
          meta: {
            dropletId: droplet.id,
            dropletName: droplet.name,
            amountDue: monthlyPrice,
            suspendedAt: nowIso,
            purgeAt: scheduledPurgeAt.toISOString()
          },
          now: nowDate,
          notifyFn
        });

        await sendDropletLifecycleEmail({
          event: 'suspended',
          to: contact.email,
          name: contact.name,
          droplet: mappedSuspended,
          amountDue: monthlyPrice,
          suspendedAt: nowDate,
          purgeAt: scheduledPurgeAt,
          sendEmailFn
        });

        summary.suspended += 1;
        continue;
      }

      // 3. Due renewal on active droplet (next_billing_at <= now)
      if (status === 'active' && nextBillingAt && nextBillingAt <= nowDate) {
        summary.processed += 1;
        const contact = await getUserContactInfo(droplet.user_id);
        const alreadyInGrace = Boolean(graceUntil && graceUntil > nowDate);

        const chargeRes = await attemptAtomicWalletCharge(
          droplet.user_id,
          monthlyPrice,
          `Monthly Cloud VPS Renewal (${droplet.name})`,
          { dropletId: droplet.id, hostname: droplet.name, billingCycle: 'monthly', renewal: true },
          billingDB
        );

        if (chargeRes?.success) {
          const nextPeriodEnd = addDays(nowDate, DROPLET_BILLING_PERIOD_DAYS);
          const invoice = alreadyInGrace
            ? await settleOrCreatePaidInvoice({
                droplet,
                userId: droplet.user_id,
                amount: monthlyPrice,
                periodStart: nowDate,
                periodEnd: nextPeriodEnd,
                now: nowDate
              })
            : await (() => {
                const built = buildDropletInvoiceLineItems({
                  droplet: mapDropletBillingRow(droplet),
                  monthlyPrice,
                  periodStart: nowDate,
                  periodEnd: nextPeriodEnd
                });
                return persistNewInvoice({
                  userId: droplet.user_id,
                  dropletId: droplet.id,
                  dropletName: droplet.name,
                  periodStart: built.periodStart,
                  periodEnd: built.periodEnd,
                  amount: built.total,
                  currency: 'USD',
                  status: 'paid',
                  lineItems: built.lineItems,
                  now: nowDate
                });
              })();

          const updated = await updateDropletFields(droplet.id, {
            next_billing_at: nextPeriodEnd.toISOString(),
            grace_until: null,
            pre_renewal_warning_at: null,
            last_invoice_id: invoice.id
          });

          await recordCloudActivity({
            userId: droplet.user_id,
            action: `Monthly VPS renewed (${invoice.invoiceNumber} · $${monthlyPrice.toFixed(2)} USD)`,
            target: droplet.name,
            now: nowDate
          });

          await recordSocialNotification({
            userId: droplet.user_id,
            type: 'cloud_vps_invoice_paid',
            title: `Cloud VPS ${droplet.name} renewed`,
            message: `Monthly renewal of $${monthlyPrice.toFixed(2)} USD succeeded for ${droplet.name} (${invoice.invoiceNumber}).`,
            entityId: droplet.id,
            meta: {
              dropletId: droplet.id,
              dropletName: droplet.name,
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              amount: monthlyPrice,
              nextBillingAt: nextPeriodEnd.toISOString()
            },
            now: nowDate,
            notifyFn
          });

          const emailRes = await sendDropletLifecycleEmail({
            event: 'renewal_paid',
            to: contact.email,
            name: contact.name,
            droplet: updated || mapDropletBillingRow(droplet),
            invoice,
            nextBillingAt: nextPeriodEnd,
            sendEmailFn
          });
          if (emailRes?.success) await markInvoiceEmailSent(invoice.id, nowDate);

          summary.renewed += 1;
          continue;
        }

        // Insufficient funds: if already in grace window, deduplicate (do not re-create invoice or re-notify)
        if (alreadyInGrace) {
          summary.inGraceDeduplicated += 1;
          continue;
        }

        const graceDeadline = addDays(nowDate, graceDays);
        const built = buildDropletInvoiceLineItems({
          droplet: mapDropletBillingRow(droplet),
          monthlyPrice,
          periodStart: nowDate,
          periodEnd: addDays(nowDate, DROPLET_BILLING_PERIOD_DAYS)
        });
        const pastDueInvoice = await persistNewInvoice({
          userId: droplet.user_id,
          dropletId: droplet.id,
          dropletName: droplet.name,
          periodStart: built.periodStart,
          periodEnd: built.periodEnd,
          amount: built.total,
          currency: 'USD',
          status: 'past_due',
          lineItems: built.lineItems,
          now: nowDate
        });

        const updatedGrace = await updateDropletFields(droplet.id, {
          grace_until: graceDeadline.toISOString(),
          last_invoice_id: pastDueInvoice.id
        });

        await recordCloudActivity({
          userId: droplet.user_id,
          action: `Monthly VPS renewal past due (${pastDueInvoice.invoiceNumber}) · ${graceDays}-day grace period started`,
          target: droplet.name,
          now: nowDate
        });

        await recordSocialNotification({
          userId: droplet.user_id,
          type: 'cloud_vps_grace_period',
          title: `Payment reminder: ${droplet.name} in ${graceDays}-day grace period`,
          message: `Monthly renewal of $${monthlyPrice.toFixed(2)} USD failed due to insufficient credits. Add funds before ${graceDeadline.toISOString().slice(0, 10)} to prevent suspension.`,
          entityId: droplet.id,
          meta: {
            dropletId: droplet.id,
            dropletName: droplet.name,
            invoiceId: pastDueInvoice.id,
            invoiceNumber: pastDueInvoice.invoiceNumber,
            amountDue: monthlyPrice,
            graceUntil: graceDeadline.toISOString()
          },
          now: nowDate,
          notifyFn
        });

        const emailRes = await sendDropletLifecycleEmail({
          event: 'grace_period',
          to: contact.email,
          name: contact.name,
          droplet: updatedGrace || mapDropletBillingRow(droplet),
          invoice: pastDueInvoice,
          amountDue: monthlyPrice,
          graceUntil: graceDeadline,
          sendEmailFn
        });
        if (emailRes?.success) await markInvoiceEmailSent(pastDueInvoice.id, nowDate);

        summary.enteredGrace += 1;
      }
    }

    return summary;
  } finally {
    isSweepRunning = false;
  }
}

export async function attemptAutoUnsuspendForUser({
  userId,
  now = new Date(),
  sendEmailFn = sendTiwloEmail,
  notifyFn = null,
  resumeDropletFn = null,
  restoreIpFn = null,
  billingDB = BillingDB
} = {}) {
  if (!userId) throw new TypeError('userId is required');
  await ensureDropletBillingSchema();

  const nowDate = toDate(now) || new Date();
  const nowIso = nowDate.toISOString();
  const cleanUserId = String(userId);

  let candidates = [];
  if (!isPgActive()) {
    candidates = [...memoryDroplets.values()]
      .filter((d) => {
        if (d.user_id !== cleanUserId) return false;
        if (!(Number(d.monthly_price) > 0)) return false;
        if (d.status === 'suspended') {
          const purgeAt = toDate(d.purge_at);
          return !purgeAt || purgeAt > nowDate;
        }
        return d.status === 'active' && Boolean(d.grace_until);
      })
      .sort((a, b) => Date.parse(a.suspended_at || a.created_at || 0) - Date.parse(b.suspended_at || b.created_at || 0));
  } else {
    const { rows } = await queryPg(
      `SELECT * FROM cloud_droplets
       WHERE user_id = $1
         AND COALESCE(monthly_price, 0) > 0
         AND (
           (status = 'suspended' AND (purge_at IS NULL OR purge_at > $2::timestamptz))
           OR (status = 'active' AND grace_until IS NOT NULL)
         )
       ORDER BY suspended_at ASC NULLS LAST, created_at ASC, id ASC`,
      [cleanUserId, nowIso]
    );
    candidates = rows || [];
  }

  const contact = await getUserContactInfo(cleanUserId);
  const results = [];
  let reactivated = 0;
  let failed = 0;

  for (const droplet of candidates) {
    const wasSuspended = String(droplet.status || '').toLowerCase() === 'suspended';
    const monthlyPrice = roundMoney(droplet.monthly_price);
    const chargeRes = await attemptAtomicWalletCharge(
      cleanUserId,
      monthlyPrice,
      `Monthly Cloud VPS Reactivation (${droplet.name})`,
      { dropletId: droplet.id, hostname: droplet.name, billingCycle: 'monthly', reactivation: true },
      billingDB
    );

    if (!chargeRes?.success) {
      failed += 1;
      results.push({
        dropletId: droplet.id,
        dropletName: droplet.name,
        reactivated: false,
        reason: chargeRes?.error || 'insufficient_credits'
      });
      continue;
    }

    const nextPeriodEnd = addDays(nowDate, DROPLET_BILLING_PERIOD_DAYS);
    const invoice = await settleOrCreatePaidInvoice({
      droplet,
      userId: cleanUserId,
      amount: monthlyPrice,
      periodStart: nowDate,
      periodEnd: nextPeriodEnd,
      now: nowDate
    });

    const updatedDroplet = await updateDropletFields(droplet.id, {
      status: 'active',
      grace_until: null,
      suspended_at: null,
      purge_at: null,
      pre_renewal_warning_at: null,
      next_billing_at: nextPeriodEnd.toISOString(),
      last_invoice_id: invoice.id
    });

    if (wasSuspended) {
      if (typeof resumeDropletFn === 'function') {
        await resumeDropletFn(updatedDroplet || mapDropletBillingRow(droplet), { now: nowDate });
      } else {
        await defaultResumeDroplet(droplet);
      }

      if (typeof restoreIpFn === 'function') {
        await restoreIpFn(updatedDroplet || mapDropletBillingRow(droplet), { now: nowDate });
      }
    }

    await recordCloudActivity({
      userId: cleanUserId,
      action: wasSuspended
        ? `Auto-unsuspended VPS on top-up (${invoice.invoiceNumber} · $${monthlyPrice.toFixed(2)} USD paid)`
        : `Cleared grace-period balance on top-up (${invoice.invoiceNumber} · $${monthlyPrice.toFixed(2)} USD paid)`,
      target: droplet.name,
      now: nowDate
    });

    const notification = await recordSocialNotification({
      userId: cleanUserId,
      type: 'cloud_vps_reactivated',
      title: wasSuspended ? `Cloud VPS ${droplet.name} restored` : `Cloud VPS ${droplet.name} invoice paid`,
      message: wasSuspended
        ? `Your balance top-up paid ${invoice.invoiceNumber} ($${monthlyPrice.toFixed(2)} USD) and your VPS ${droplet.name} is active again.`
        : `Your balance top-up paid ${invoice.invoiceNumber} ($${monthlyPrice.toFixed(2)} USD) and cleared the grace period for ${droplet.name}.`,
      entityId: droplet.id,
      meta: {
        dropletId: droplet.id,
        dropletName: droplet.name,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        wasSuspended,
        nextBillingAt: nextPeriodEnd.toISOString()
      },
      now: nowDate,
      notifyFn
    });

    const emailResult = await sendDropletLifecycleEmail({
      event: wasSuspended ? 'unsuspended' : 'renewal_paid',
      to: contact.email,
      name: contact.name,
      droplet: updatedDroplet || mapDropletBillingRow(droplet),
      invoice,
      nextBillingAt: nextPeriodEnd,
      sendEmailFn
    });
    if (emailResult?.success) await markInvoiceEmailSent(invoice.id, nowDate);

    reactivated += 1;
    results.push({
      dropletId: droplet.id,
      dropletName: droplet.name,
      reactivated: true,
      wasSuspended,
      droplet: updatedDroplet,
      invoice,
      emailResult,
      notification
    });
  }

  return {
    userId: cleanUserId,
    attempted: candidates.length,
    reactivated,
    failed,
    results
  };
}
