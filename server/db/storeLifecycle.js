import { MasterDB, TenantDB } from './multiTenant.js';
import { BillingDB } from './billing.js';
import { deleteMedia, normalizeMediaPath } from './mediaStorage.js';
import { getEcommercePackageById } from './packages.js';
import { queryPg } from './postgres.js';
import { getPlatformUrl } from '../config/platformConfig.js';
import {
  sendStoreDeletedEmail,
  sendStoreGracePeriodEmail,
  sendStoreSuspendedEmail
} from './emailService.js';

export const GRACE_PERIOD_DAYS = 3;
export const SUSPENSION_RETENTION_DAYS = 180;
export const BILLING_PERIOD_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

let isSweepRunning = false;
let lifecycleTimer = null;

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
  return new Date(base.getTime() + days * DAY_MS).toISOString();
}

function parsePrice(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  }
  return 0;
}

function getMapOrObjectValue(container, key) {
  if (!container || !key) return undefined;
  if (container instanceof Map) return container.get(key);
  if (typeof container.get === 'function') return container.get(key);
  return container[key];
}

function countCurrentMonthSales(sales = [], now = new Date()) {
  if (!Array.isArray(sales)) return 0;
  const nowDate = toDate(now) || new Date();
  const currentYear = nowDate.getUTCFullYear();
  const currentMonth = nowDate.getUTCMonth();
  return sales.filter((sale) => {
    const parsed = toDate(sale?.date || sale?.createdAt);
    if (!parsed) return false;
    return parsed.getUTCFullYear() === currentYear && parsed.getUTCMonth() === currentMonth;
  }).length;
}

function resolveEmailHandlers(emailFns = {}) {
  return {
    sendGraceEmail: emailFns?.sendStoreGracePeriodEmail || emailFns?.sendGracePeriodEmail || sendStoreGracePeriodEmail,
    sendSuspendedEmail: emailFns?.sendStoreSuspendedEmail || emailFns?.sendSuspendedEmail || sendStoreSuspendedEmail,
    sendDeletedEmail: emailFns?.sendStoreDeletedEmail || emailFns?.sendDeletedEmail || sendStoreDeletedEmail
  };
}

function applyLifecycleToTenantStore(tenantStore, { tiwiId, planId, planName, price, billingCycle, lifecycleFields, status, updatedAt }) {
  if (!tenantStore || typeof tenantStore !== 'object') return null;
  tenantStore.planId = planId;
  tenantStore.status = status;
  tenantStore.lifecycleStatus = lifecycleFields.lifecycleStatus;
  tenantStore.subscriptionStatus = lifecycleFields.subscriptionStatus;
  tenantStore.expiresAt = lifecycleFields.expiresAt;
  tenantStore.subscription = {
    ...(tenantStore.subscription || {}),
    tiwiId,
    planId,
    planName,
    price,
    billingCycle: billingCycle || tenantStore.subscription?.billingCycle || 'monthly',
    status,
    ...lifecycleFields,
    updatedAt
  };
  return tenantStore;
}

export function extractStoreMediaPaths(tenantStore) {
  if (!tenantStore || typeof tenantStore !== 'object') return [];
  const paths = new Set();

  const collect = (candidate) => {
    const normalized = normalizeMediaPath(candidate);
    if (normalized) paths.add(normalized);
  };

  const settings = tenantStore.store_settings;
  if (settings && typeof settings === 'object') {
    collect(settings.storeLogo);
    collect(settings.storeFavicon);
    if (Array.isArray(settings.heroBanners)) {
      for (const banner of settings.heroBanners) {
        collect(typeof banner === 'string' ? banner : banner?.image);
      }
    }
  }

  if (Array.isArray(tenantStore.products)) {
    for (const product of tenantStore.products) {
      if (!product || typeof product !== 'object') continue;
      collect(product.image);
      if (Array.isArray(product.images)) {
        for (const img of product.images) {
          collect(typeof img === 'string' ? img : img?.image || img?.url);
        }
      }
    }
  }

  if (Array.isArray(tenantStore.categories)) {
    for (const category of tenantStore.categories) {
      collect(category?.image);
    }
  }

  if (Array.isArray(tenantStore.subcategories)) {
    for (const subcategory of tenantStore.subcategories) {
      collect(subcategory?.image);
    }
  }

  if (Array.isArray(tenantStore.store_reviews)) {
    for (const review of tenantStore.store_reviews) {
      if (Array.isArray(review?.images)) {
        for (const img of review.images) {
          collect(typeof img === 'string' ? img : img?.image || img?.url);
        }
      }
    }
  }

  return [...paths];
}

export async function purgeStoreMediaAssets({
  tiwiId,
  ownerId,
  tenantStore,
  allUserStores = [],
  readStoreFn,
  deleteMediaFn = deleteMedia
} = {}) {
  const storePaths = extractStoreMediaPaths(tenantStore);
  const otherStorePaths = new Set();

  const remainingStores = (Array.isArray(allUserStores) ? allUserStores : []).filter((other) => {
    if (!other || String(other.tiwiId) === String(tiwiId)) return false;
    if (ownerId && other.ownerId && String(other.ownerId) !== String(ownerId)) return false;
    return true;
  });

  for (const other of remainingStores) {
    for (const p of extractStoreMediaPaths(other)) {
      otherStorePaths.add(p);
    }
    let fullOther = null;
    if (typeof readStoreFn === 'function' && other.tiwiId) {
      try {
        fullOther = await readStoreFn(other.tiwiId);
      } catch {
        fullOther = null;
      }
    } else if (other.tiwiId && other.products === undefined && other.store_settings === undefined) {
      try {
        fullOther = await TenantDB.getStoreDb(other.tiwiId);
      } catch {
        fullOther = null;
      }
    }
    if (fullOther) {
      for (const p of extractStoreMediaPaths(fullOther)) {
        otherStorePaths.add(p);
      }
    }
  }

  const deletedPaths = [];
  const skippedSharedPaths = [];

  for (const mediaPath of storePaths) {
    if (otherStorePaths.has(mediaPath)) {
      skippedSharedPaths.push(mediaPath);
      continue;
    }
    try {
      await deleteMediaFn(mediaPath);
      deletedPaths.push(mediaPath);
    } catch (error) {
      console.warn(`[StoreLifecycle] Failed to delete media ${mediaPath} for store ${tiwiId}:`, error.message);
    }
  }

  if (tiwiId) {
    try {
      const purposePrefix = `store:${String(tiwiId)}:%`;
      if (otherStorePaths.size > 0) {
        await queryPg(
          `DELETE FROM system_media m
           WHERE m.purpose LIKE $1
             AND NOT EXISTS (
               SELECT 1 FROM system_media_aliases a
               WHERE a.media_id = m.id
                 AND a.storage_path = ANY($2::text[])
             )`,
          [purposePrefix, [...otherStorePaths]]
        );
      } else {
        await queryPg(
          `DELETE FROM system_media WHERE purpose LIKE $1`,
          [purposePrefix]
        );
      }
    } catch {
      // Non-fatal orphan media cleanup
    }
  }

  return {
    deletedPaths,
    skippedSharedPaths,
    totalPaths: storePaths.length
  };
}

export function syncStoreLifecycleOnPlanChange({
  tiwiId,
  planId,
  price,
  billingCycle = 'monthly',
  now = new Date()
} = {}) {
  const nowDate = toDate(now) || new Date();
  const normalizedPlanId = String(planId || 'free').trim().toLowerCase();
  const numericPrice = parsePrice(price);
  const isPaid = numericPrice > 0 && normalizedPlanId !== 'free';

  return {
    ...(tiwiId ? { tiwiId } : {}),
    lifecycleStatus: 'active',
    subscriptionStatus: 'active',
    billingCycle: isPaid ? (billingCycle || 'monthly') : (billingCycle || 'forever'),
    currentPeriodStart: nowDate.toISOString(),
    expiresAt: isPaid ? addDays(nowDate, BILLING_PERIOD_DAYS) : null,
    graceStartedAt: null,
    graceEndsAt: null,
    suspendedAt: null,
    scheduledDeletionAt: null,
    graceEmailSentAt: null,
    suspendedEmailSentAt: null
  };
}

export async function processStoreSubscriptionLifecycle({
  now = new Date(),
  masterDb = MasterDB,
  tenantDb = TenantDB,
  billingDb = BillingDB,
  emailFns = {},
  deleteMediaFn = deleteMedia,
  purgeMediaFn = purgeStoreMediaAssets
} = {}) {
  if (isSweepRunning) {
    return { skipped: true, reason: 'sweep_already_running', processed: 0, renewed: 0, enteredGrace: 0, suspended: 0, deleted: 0 };
  }

  isSweepRunning = true;
  const summary = {
    skipped: false,
    processed: 0,
    renewed: 0,
    enteredGrace: 0,
    suspended: 0,
    deleted: 0
  };

  try {
    const nowDate = toDate(now) || new Date();
    const nowIso = nowDate.toISOString();
    const { sendGraceEmail, sendSuspendedEmail, sendDeletedEmail } = resolveEmailHandlers(emailFns);

    const master = await masterDb.getMasterData();
    master.stores = Array.isArray(master?.stores) ? master.stores : [];
    master.subscriptions = Array.isArray(master?.subscriptions) ? master.subscriptions : [];
    const users = Array.isArray(master?.users)
      ? master.users
      : (typeof masterDb.getUsers === 'function' ? await masterDb.getUsers() : []);

    const findOwner = (store) => users.find((u) =>
      String(u.id) === String(store.ownerId) ||
      (store.tiwiId && String(u.tiwiId) === String(store.tiwiId))
    ) || null;

    const upsertDirSubscription = (tiwiId, patch) => {
      const idx = master.subscriptions.findIndex((s) => String(s.tiwiId) === String(tiwiId));
      if (idx >= 0) {
        master.subscriptions[idx] = { ...master.subscriptions[idx], ...patch, tiwiId, updatedAt: nowIso };
      } else {
        master.subscriptions.push({ tiwiId, ...patch, updatedAt: nowIso });
      }
    };

    let masterDirty = false;
    const storesToDelete = [];

    for (const store of master.stores) {
      const tiwiId = store?.tiwiId;
      if (!tiwiId) continue;

      const dirSub = master.subscriptions.find((s) => String(s.tiwiId) === String(tiwiId)) || null;
      let tenantStore = null;
      if (typeof tenantDb?.getStoreDb === 'function') {
        try {
          tenantStore = await tenantDb.getStoreDb(tiwiId);
        } catch {
          tenantStore = null;
        }
      }
      const tenantSub = tenantStore?.subscription || null;

      const planId = String(dirSub?.planId || tenantSub?.planId || store.planId || 'free').trim().toLowerCase();
      const planName = dirSub?.planName || tenantSub?.planName || store.planName || planId;
      const subPrice = parsePrice(dirSub?.price ?? tenantSub?.price ?? store.price ?? 0);
      const billingCycle = dirSub?.billingCycle || tenantSub?.billingCycle || 'monthly';
      const isPaidStore = planId !== 'free' && subPrice > 0;

      const storeStatus = String(store.status || 'active').toLowerCase();
      const lifecycleStatus = String(
        store.lifecycleStatus ||
        dirSub?.lifecycleStatus ||
        tenantSub?.lifecycleStatus ||
        (storeStatus === 'suspended' ? 'suspended' : 'active')
      ).toLowerCase();

      const expiresAt = toDate(store.expiresAt || dirSub?.expiresAt || tenantSub?.expiresAt);
      const graceEndsAt = toDate(store.graceEndsAt || dirSub?.graceEndsAt || tenantSub?.graceEndsAt);
      const scheduledDeletionAt = toDate(
        store.scheduledDeletionAt || dirSub?.scheduledDeletionAt || tenantSub?.scheduledDeletionAt
      );

      let graceEmailSentAt = store.graceEmailSentAt || dirSub?.graceEmailSentAt || tenantSub?.graceEmailSentAt || null;
      let suspendedEmailSentAt = store.suspendedEmailSentAt || dirSub?.suspendedEmailSentAt || tenantSub?.suspendedEmailSentAt || null;

      // Stage C: 180-day suspended retention expired -> permanently delete store & isolated media only
      if ((lifecycleStatus === 'suspended' || storeStatus === 'suspended') && scheduledDeletionAt && scheduledDeletionAt <= nowDate) {
        summary.processed++;
        storesToDelete.push({ store, tenantStore, owner: findOwner(store) });
        continue;
      }

      // Never retroactively bill free stores or stores without a valid paid subscription price / expiresAt
      if (!isPaidStore) {
        continue;
      }

      // Stage B: Grace period expired -> retry once; if still unfunded, suspend with 180-day retention
      if (lifecycleStatus === 'grace_period' && graceEndsAt && graceEndsAt <= nowDate) {
        summary.processed++;
        const chargeResult = await billingDb.chargeSubscriptionPlan(
          store.ownerId,
          subPrice,
          `${planName} Auto-Renewal`,
          {
            tiwiId,
            orderType: 'ecommerce_subscription',
            planId,
            metadata: { tiwiId, planId, planName, renewal: true, stage: 'grace_retry' }
          }
        );

        if (chargeResult?.success) {
          const nextFields = syncStoreLifecycleOnPlanChange({
            tiwiId,
            planId,
            price: subPrice,
            billingCycle,
            now: nowDate
          });
          Object.assign(store, { status: 'active', planId, ...nextFields });
          upsertDirSubscription(tiwiId, { planId, planName, price: subPrice, ...nextFields });
          if (tenantStore && typeof tenantDb?.saveStoreDb === 'function') {
            applyLifecycleToTenantStore(tenantStore, {
              tiwiId,
              planId,
              planName,
              price: subPrice,
              billingCycle,
              lifecycleFields: nextFields,
              status: 'active',
              updatedAt: nowIso
            });
            await tenantDb.saveStoreDb(tiwiId, tenantStore);
          }
          masterDirty = true;
          summary.renewed++;
        } else {
          const deletionAt = addDays(nowDate, SUSPENSION_RETENTION_DAYS);
          const owner = findOwner(store);
          if (owner?.email && !suspendedEmailSentAt && typeof sendSuspendedEmail === 'function') {
            try {
              await sendSuspendedEmail({
                to: owner.email,
                name: owner.name || owner.storeName || 'Merchant',
                storeName: store.storeName,
                subdomain: store.subdomain,
                planName,
                suspendedAt: nowIso,
                scheduledDeletionAt: deletionAt,
                billingUrl: getPlatformUrl('dashboard')
              });
              suspendedEmailSentAt = nowIso;
            } catch (emailErr) {
              console.error(`[StoreLifecycle] Failed to send suspension email for ${tiwiId}:`, emailErr.message);
            }
          }

          const suspendedFields = {
            lifecycleStatus: 'suspended',
            subscriptionStatus: 'suspended',
            suspendedAt: nowIso,
            scheduledDeletionAt: deletionAt,
            graceEmailSentAt,
            suspendedEmailSentAt
          };
          Object.assign(store, { status: 'suspended', planId, ...suspendedFields });
          upsertDirSubscription(tiwiId, { planId, planName, price: subPrice, billingCycle, ...suspendedFields });
          if (tenantStore && typeof tenantDb?.saveStoreDb === 'function') {
            applyLifecycleToTenantStore(tenantStore, {
              tiwiId,
              planId,
              planName,
              price: subPrice,
              billingCycle,
              lifecycleFields: suspendedFields,
              status: 'suspended',
              updatedAt: nowIso
            });
            await tenantDb.saveStoreDb(tiwiId, tenantStore);
          }
          masterDirty = true;
          summary.suspended++;
        }
        continue;
      }

      // Stage A: Active paid store reached expiration -> attempt auto-renewal or enter 3-day grace window
      if (lifecycleStatus === 'active' && storeStatus !== 'suspended' && expiresAt && expiresAt <= nowDate) {
        summary.processed++;
        const chargeResult = await billingDb.chargeSubscriptionPlan(
          store.ownerId,
          subPrice,
          `${planName} Auto-Renewal`,
          {
            tiwiId,
            orderType: 'ecommerce_subscription',
            planId,
            metadata: { tiwiId, planId, planName, renewal: true, stage: 'expiry_renewal' }
          }
        );

        if (chargeResult?.success) {
          const nextFields = syncStoreLifecycleOnPlanChange({
            tiwiId,
            planId,
            price: subPrice,
            billingCycle,
            now: nowDate
          });
          Object.assign(store, { status: 'active', planId, ...nextFields });
          upsertDirSubscription(tiwiId, { planId, planName, price: subPrice, ...nextFields });
          if (tenantStore && typeof tenantDb?.saveStoreDb === 'function') {
            applyLifecycleToTenantStore(tenantStore, {
              tiwiId,
              planId,
              planName,
              price: subPrice,
              billingCycle,
              lifecycleFields: nextFields,
              status: 'active',
              updatedAt: nowIso
            });
            await tenantDb.saveStoreDb(tiwiId, tenantStore);
          }
          masterDirty = true;
          summary.renewed++;
        } else {
          const graceEndIso = addDays(nowDate, GRACE_PERIOD_DAYS);
          const owner = findOwner(store);
          if (owner?.email && !graceEmailSentAt && typeof sendGraceEmail === 'function') {
            try {
              await sendGraceEmail({
                to: owner.email,
                name: owner.name || owner.storeName || 'Merchant',
                storeName: store.storeName,
                subdomain: store.subdomain,
                planName,
                amountDue: subPrice,
                currency: 'USD',
                graceEndsAt: graceEndIso,
                billingUrl: getPlatformUrl('dashboard')
              });
              graceEmailSentAt = nowIso;
            } catch (emailErr) {
              console.error(`[StoreLifecycle] Failed to send grace period email for ${tiwiId}:`, emailErr.message);
            }
          }

          const graceFields = {
            lifecycleStatus: 'grace_period',
            subscriptionStatus: 'grace_period',
            graceStartedAt: nowIso,
            graceEndsAt: graceEndIso,
            suspendedAt: null,
            scheduledDeletionAt: null,
            graceEmailSentAt,
            suspendedEmailSentAt
          };
          Object.assign(store, { status: 'active', planId, ...graceFields });
          upsertDirSubscription(tiwiId, { planId, planName, price: subPrice, billingCycle, ...graceFields });
          if (tenantStore && typeof tenantDb?.saveStoreDb === 'function') {
            applyLifecycleToTenantStore(tenantStore, {
              tiwiId,
              planId,
              planName,
              price: subPrice,
              billingCycle,
              lifecycleFields: graceFields,
              status: 'active',
              updatedAt: nowIso
            });
            await tenantDb.saveStoreDb(tiwiId, tenantStore);
          }
          masterDirty = true;
          summary.enteredGrace++;
        }
      }
    }

    if (masterDirty) {
      await masterDb.saveMasterData(master);
    }

    for (const { store, tenantStore, owner } of storesToDelete) {
      const otherStores = master.stores.filter(
        (s) => String(s.ownerId) === String(store.ownerId) && String(s.tiwiId) !== String(store.tiwiId)
      );

      await purgeMediaFn({
        tiwiId: store.tiwiId,
        ownerId: store.ownerId,
        tenantStore,
        allUserStores: otherStores,
        readStoreFn: typeof tenantDb?.getStoreDb === 'function' ? (id) => tenantDb.getStoreDb(id) : undefined,
        deleteMediaFn
      });

      const deleted = await masterDb.deleteStoreForUser(store.ownerId, store.tiwiId);
      if (deleted) {
        master.stores = master.stores.filter((s) => String(s.tiwiId) !== String(store.tiwiId));
        master.subscriptions = master.subscriptions.filter((s) => String(s.tiwiId) !== String(store.tiwiId));
        summary.deleted++;
        if (owner?.email && typeof sendDeletedEmail === 'function') {
          try {
            await sendDeletedEmail({
              to: owner.email,
              name: owner.name || owner.storeName || 'Merchant',
              storeName: store.storeName,
              subdomain: store.subdomain,
              deletedAt: nowIso,
              dashboardUrl: getPlatformUrl('dashboard')
            });
          } catch (emailErr) {
            console.error(`[StoreLifecycle] Failed to send deletion email for ${store.tiwiId}:`, emailErr.message);
          }
        }
      }
    }

    return summary;
  } finally {
    isSweepRunning = false;
  }
}

export async function renewStoreSubscriptionForUser({
  userId,
  tiwiId,
  now = new Date(),
  masterDb = MasterDB,
  tenantDb = TenantDB,
  billingDb = BillingDB,
  getPackageFn = getEcommercePackageById
} = {}) {
  if (!userId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }
  if (!tiwiId) {
    const err = new Error('Store ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const nowDate = toDate(now) || new Date();
  const nowIso = nowDate.toISOString();

  const master = await masterDb.getMasterData();
  master.stores = Array.isArray(master?.stores) ? master.stores : [];
  master.subscriptions = Array.isArray(master?.subscriptions) ? master.subscriptions : [];

  const store = master.stores.find((s) => String(s.tiwiId) === String(tiwiId));
  if (!store) {
    const err = new Error('Store not found.');
    err.statusCode = 404;
    throw err;
  }
  if (String(store.ownerId) !== String(userId)) {
    const err = new Error('Forbidden: You do not own this store.');
    err.statusCode = 403;
    throw err;
  }

  const dirSubIdx = master.subscriptions.findIndex((s) => String(s.tiwiId) === String(tiwiId));
  const dirSub = dirSubIdx >= 0 ? master.subscriptions[dirSubIdx] : null;
  const tenantStore = typeof tenantDb?.getStoreDb === 'function'
    ? await tenantDb.getStoreDb(tiwiId)
    : null;
  const tenantSub = tenantStore?.subscription || null;

  const planId = String(dirSub?.planId || tenantSub?.planId || store.planId || 'free').trim().toLowerCase();
  let pkg = null;
  if (typeof getPackageFn === 'function') {
    try {
      pkg = await getPackageFn(planId);
    } catch {
      pkg = null;
    }
  }

  const planName = pkg?.planName || dirSub?.planName || tenantSub?.planName || store.planName || planId;
  const price = parsePrice(pkg?.price ?? dirSub?.price ?? tenantSub?.price ?? store.price ?? 0);
  const billingCycle = dirSub?.billingCycle || tenantSub?.billingCycle || 'monthly';

  let billingInvoice = null;
  let orderNumber = null;
  if (price > 0) {
    const chargeResult = await billingDb.chargeSubscriptionPlan(
      userId,
      price,
      `${planName} Renewal`,
      {
        tiwiId,
        orderType: 'ecommerce_subscription',
        planId,
        metadata: { tiwiId, planId, planName, renewal: true, manualRenewal: true }
      }
    );
    if (!chargeResult?.success) {
      const err = new Error(chargeResult?.error || 'Insufficient cloud credits to renew store subscription.');
      err.statusCode = chargeResult?.statusCode || 402;
      throw err;
    }
    billingInvoice = chargeResult?.invoice || null;
    orderNumber = chargeResult?.orderNumber || billingInvoice?.orderNumber || null;
  } else if (typeof billingDb.recordSubscriptionInvoice === 'function') {
    billingInvoice = await billingDb.recordSubscriptionInvoice(userId, {
      amountUsd: 0,
      planName,
      tiwiId,
      orderType: planId === 'free' ? 'ecommerce_free_trial' : 'ecommerce_subscription',
      planId,
      provider: 'free_trial',
      status: planId === 'free' ? 'trial' : 'free',
      metadata: { tiwiId, planId, planName, renewal: true, isFreeTrial: true }
    }).catch(() => null);
    orderNumber = billingInvoice?.orderNumber || null;
  }

  const lifecycleFields = syncStoreLifecycleOnPlanChange({
    tiwiId,
    planId,
    price,
    billingCycle,
    now: nowDate
  });

  Object.assign(store, {
    status: 'active',
    planId,
    ...lifecycleFields
  });

  const nextSubscription = {
    ...(tenantSub || {}),
    ...(dirSub || {}),
    tiwiId,
    planId,
    planName,
    price,
    billingCycle,
    ...(pkg ? {
      productLimit: Number(pkg.productLimit ?? tenantSub?.productLimit ?? dirSub?.productLimit ?? 10),
      warehouseLimit: Number(pkg.warehouseLimit ?? tenantSub?.warehouseLimit ?? dirSub?.warehouseLimit ?? 1),
      staffLimit: Number(pkg.staffLimit ?? tenantSub?.staffLimit ?? dirSub?.staffLimit ?? 1),
      monthlyOrderLimit: Number(pkg.monthlyOrderLimit ?? tenantSub?.monthlyOrderLimit ?? dirSub?.monthlyOrderLimit ?? 50),
      hasPos: Boolean(pkg.hasPos ?? tenantSub?.hasPos ?? dirSub?.hasPos),
      hasCustomDomain: Boolean(pkg.hasCustomDomain ?? tenantSub?.hasCustomDomain ?? dirSub?.hasCustomDomain)
    } : {}),
    status: 'active',
    ...lifecycleFields,
    updatedAt: nowIso
  };

  if (dirSubIdx >= 0) {
    master.subscriptions[dirSubIdx] = nextSubscription;
  } else {
    master.subscriptions.push(nextSubscription);
  }

  await masterDb.saveMasterData(master);

  if (tenantStore && typeof tenantDb?.saveStoreDb === 'function') {
    applyLifecycleToTenantStore(tenantStore, {
      tiwiId,
      planId,
      planName,
      price,
      billingCycle,
      lifecycleFields,
      status: 'active',
      updatedAt: nowIso
    });
    await tenantDb.saveStoreDb(tiwiId, tenantStore);
  }

  return {
    success: true,
    store,
    subscription: nextSubscription,
    orderNumber,
    invoice: billingInvoice
  };
}

export function buildStoreDashboardNotifications({
  userStores = [],
  tenantStoresMap = new Map(),
  subscriptionByStore = new Map(),
  now = new Date()
} = {}) {
  const nowDate = toDate(now) || new Date();
  const notifications = [];

  for (const store of (Array.isArray(userStores) ? userStores : [])) {
    if (!store) continue;
    const tiwiId = store.tiwiId;
    const tenantStore = getMapOrObjectValue(tenantStoresMap, tiwiId) || {};
    const sub = getMapOrObjectValue(subscriptionByStore, tiwiId) || tenantStore.subscription || {};
    const storeName = store.storeName || tenantStore.storeName || tiwiId;
    const storeStatus = String(store.status || 'active').toLowerCase();
    const lifecycleStatus = String(
      sub.lifecycleStatus ||
      store.lifecycleStatus ||
      (storeStatus === 'suspended' ? 'suspended' : 'active')
    ).toLowerCase();

    if (lifecycleStatus === 'grace_period') {
      const graceEndsAt = toDate(sub.graceEndsAt || store.graceEndsAt);
      const msLeft = graceEndsAt ? Math.max(0, graceEndsAt.getTime() - nowDate.getTime()) : 0;
      const hoursLeft = Math.ceil(msLeft / HOUR_MS);
      const daysLeft = Math.ceil(msLeft / DAY_MS);

      notifications.push({
        id: `grace_${tiwiId}`,
        tiwiId,
        storeName,
        type: 'grace_period',
        severity: 'warning',
        title: `Grace period active for ${storeName}`,
        message: hoursLeft <= 24
          ? `${hoursLeft} hour(s) remaining before ${storeName} is suspended.`
          : `${daysLeft} day(s) (${hoursLeft} hours) remaining before ${storeName} is suspended.`,
        daysRemaining: daysLeft,
        hoursRemaining: hoursLeft,
        graceEndsAt: graceEndsAt ? graceEndsAt.toISOString() : null,
        ctaLabel: 'Add Funds & Renew',
        actions: [
          { id: 'renew', label: 'Add Funds & Renew', action: 'renew', tiwiId }
        ]
      });
    }

    if (lifecycleStatus === 'suspended' || storeStatus === 'suspended') {
      const suspendedAt = toDate(sub.suspendedAt || store.suspendedAt);
      let scheduledDeletionAt = toDate(sub.scheduledDeletionAt || store.scheduledDeletionAt);
      if (!scheduledDeletionAt && suspendedAt) {
        scheduledDeletionAt = new Date(suspendedAt.getTime() + SUSPENSION_RETENTION_DAYS * DAY_MS);
      }
      const msLeft = scheduledDeletionAt ? Math.max(0, scheduledDeletionAt.getTime() - nowDate.getTime()) : 0;
      const daysRemaining = scheduledDeletionAt ? Math.ceil(msLeft / DAY_MS) : SUSPENSION_RETENTION_DAYS;

      notifications.push({
        id: `suspended_${tiwiId}`,
        tiwiId,
        storeName,
        type: 'suspended_deletion_countdown',
        severity: 'critical',
        title: `${storeName} is suspended`,
        message: `${daysRemaining} day(s) remaining in the 180-day window before permanent deletion${scheduledDeletionAt ? ` on ${scheduledDeletionAt.toUTCString()}` : ''}.`,
        daysRemaining,
        suspendedAt: suspendedAt ? suspendedAt.toISOString() : null,
        scheduledDeletionAt: scheduledDeletionAt ? scheduledDeletionAt.toISOString() : null,
        ctaLabel: 'Renew & Reactivate',
        actions: [
          { id: 'renew', label: 'Renew & Reactivate', action: 'renew', tiwiId }
        ]
      });
    }

    const baseProductLimit = Number(sub.productLimit) > 0 ? Number(sub.productLimit) : 10;
    const baseStaffLimit = Number(sub.staffLimit) > 0 ? Number(sub.staffLimit) : 1;
    const productLimit = baseProductLimit + Math.max(0, Number(sub.extraProductSlots) || 0);
    const staffLimit = baseStaffLimit + Math.max(0, Number(sub.extraStaffSlots) || 0);
    const monthlyOrderLimit = Number(sub.monthlyOrderLimit) > 0 ? Number(sub.monthlyOrderLimit) : 50;

    const currentProducts = Number.isFinite(Number(sub.currentProducts))
      ? Number(sub.currentProducts)
      : (Array.isArray(tenantStore.products) ? tenantStore.products.length : 0);
    const currentStaff = Number.isFinite(Number(sub.currentStaff))
      ? Number(sub.currentStaff)
      : (Array.isArray(tenantStore.staff) ? tenantStore.staff.length : 0);
    const currentMonthlyOrders = Number.isFinite(Number(sub.currentMonthlyOrders))
      ? Number(sub.currentMonthlyOrders)
      : countCurrentMonthSales(tenantStore.sales || [], nowDate);

    const metrics = [
      { key: 'productLimit', label: 'Product Limit', used: currentProducts, limit: productLimit },
      { key: 'staffLimit', label: 'Staff Limit', used: currentStaff, limit: staffLimit },
      { key: 'monthlyOrderLimit', label: 'Monthly Order Limit', used: currentMonthlyOrders, limit: monthlyOrderLimit }
    ];

    for (const metric of metrics) {
      if (metric.limit <= 0) continue;
      const ratio = metric.used / metric.limit;
      if (ratio >= 0.8) {
        const usagePercent = Math.min(100, Math.round(ratio * 100));
        notifications.push({
          id: `slot_limit_${metric.key}_${tiwiId}`,
          tiwiId,
          storeName,
          type: 'slot_limit_warning',
          metric: metric.key,
          severity: ratio >= 1 ? 'critical' : 'warning',
          used: metric.used,
          limit: metric.limit,
          usagePercent,
          title: `${metric.label} at ${usagePercent}% (${metric.used}/${metric.limit})`,
          message: ratio >= 1
            ? `${storeName} has reached its ${metric.label.toLowerCase()} (${metric.used}/${metric.limit}).`
            : `${storeName} has used ${metric.used} of ${metric.limit} (${usagePercent}%) ${metric.label.toLowerCase()} slots.`,
          actions: [
            { id: 'addon', label: 'Add Slots', action: 'addon', tiwiId },
            { id: 'upgrade', label: 'Upgrade Plan', action: 'upgrade', tiwiId }
          ]
        });
      }
    }
  }

  const activeUserStores = (Array.isArray(userStores) ? userStores : []).filter(
    (s) => s && String(s.status || 'active').toLowerCase() !== 'deleted'
  );
  const freeStores = activeUserStores.filter((s) => {
    const tenantStore = getMapOrObjectValue(tenantStoresMap, s.tiwiId) || {};
    const sub = getMapOrObjectValue(subscriptionByStore, s.tiwiId) || tenantStore.subscription || {};
    const plan = String(sub.planId || s.planId || 'free').trim().toLowerCase();
    return plan === 'free';
  });
  const hasPaidStore = activeUserStores.some((s) => {
    const tenantStore = getMapOrObjectValue(tenantStoresMap, s.tiwiId) || {};
    const sub = getMapOrObjectValue(subscriptionByStore, s.tiwiId) || tenantStore.subscription || {};
    const plan = String(sub.planId || s.planId || 'free').trim().toLowerCase();
    const price = parsePrice(sub.price ?? s.price ?? 0);
    return plan !== 'free' || price > 0;
  });

  if (freeStores.length >= 1 && !hasPaidStore) {
    const primaryFree = freeStores[0];
    notifications.push({
      id: `free_store_slot_${primaryFree.tiwiId || 'account'}`,
      tiwiId: primaryFree.tiwiId || null,
      storeName: primaryFree.storeName || primaryFree.tiwiId || 'Free Store',
      type: 'slot_limit_warning',
      metric: 'freeStoreSlot',
      severity: 'warning',
      used: freeStores.length,
      limit: 1,
      usagePercent: 100,
      title: '1 / 1 Free Store Slot used',
      message: 'You have used 1 / 1 Free Store Slot on your free account. Add slots or upgrade your plan to create more stores.',
      actions: [
        { id: 'addon', label: 'Add Slots', action: 'addon', tiwiId: primaryFree.tiwiId || null },
        { id: 'upgrade', label: 'Upgrade Plan', action: 'upgrade', tiwiId: primaryFree.tiwiId || null }
      ]
    });
  }

  return notifications;
}

export function startStoreLifecycleScheduler(intervalMs = 60_000) {
  if (lifecycleTimer) return lifecycleTimer;
  const runSweep = () => {
    processStoreSubscriptionLifecycle().catch((error) => {
      console.error('[StoreLifecycle] Subscription lifecycle sweep failed:', error.message);
    });
  };
  runSweep();
  lifecycleTimer = setInterval(runSweep, intervalMs);
  lifecycleTimer.unref?.();
  return lifecycleTimer;
}

export function stopStoreLifecycleScheduler() {
  if (lifecycleTimer) {
    clearInterval(lifecycleTimer);
    lifecycleTimer = null;
  }
}
