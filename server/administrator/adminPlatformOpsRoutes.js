import fs from 'node:fs';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { formatPeriodLabel, getSalesPeriod } from './adminAnalytics.js';
import { computeRiskClusters, isSuperAdminAccount } from './identityRiskGraph.js';
import {
  computePlatformFinancialSummary,
  computeStoreTierBreakdown
} from './platformAccounting.js';
import { getFleetLiveStatus, listServerNodes } from './serverFleetService.js';
import { BillingDB } from '../db/billing.js';
import { getEcommercePackageById } from '../db/packages.js';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import { queryPg, recordPlatformBillingOrder } from '../db/postgres.js';
import { recordSecurityEvent } from '../db/securityPersistence.js';
import {
  purgeStoreMediaAssets,
  SUSPENSION_RETENTION_DAYS,
  syncStoreLifecycleOnPlanChange
} from '../db/storeLifecycle.js';
import { normalizeCurrencyCode, normalizeUsdRates } from '../routes/currencyHelpers.js';
import { getMarketUsdRates } from '../routes/marketCurrencyRates.js';

const VALID_SUBSCRIPTION_PLANS = new Set(['free', 'growth', 'pro', 'enterprise']);
const VALID_SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;
const CURRENCY_SETTING_KEY = 'admin_currency_settings';

function defaultNoopMiddleware(_req, _res, next) {
  return next();
}

function isSuperAdminRequester(user) {
  return user?.role === 'super_admin' || isSuperAdminAccount(user);
}

function formatRelativeTime(value, now = Date.now()) {
  const ts = value ? Date.parse(String(value)) : NaN;
  if (!Number.isFinite(ts)) return 'Time unavailable';
  const mins = Math.max(0, Math.floor((now - ts) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatFormattedUptime() {
  const uptimeSec = Math.floor(process.uptime());
  const days = Math.floor(uptimeSec / 86400);
  const hours = Math.floor((uptimeSec % 86400) / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${uptimeSec % 60}s`;
}

function formatBytesPretty(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num < 0) return null;
  if (num < 1024) return `${Math.round(num)} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = num / 1024;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx += 1;
  }
  return `${val.toFixed(val >= 100 ? 0 : 1)} ${units[idx]}`;
}

function roundUsd(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

async function safeQueryRows(queryFn, sql, params = []) {
  try {
    const result = await queryFn(sql, params);
    return Array.isArray(result?.rows) ? result.rows : [];
  } catch (error) {
    // Missing optional tables should degrade cleanly only if not initialized yet
    if (error?.code === '42P01' || error?.code === '42703') {
      return [];
    }
    throw error;
  }
}

function collectSuperAdminIds(users = []) {
  const ids = new Set();
  for (const user of users) {
    if (user?.id && isSuperAdminAccount(user)) {
      ids.add(String(user.id));
    }
  }
  return ids;
}

function findStoreInMaster(master, tiwiId) {
  const target = String(tiwiId || '').trim();
  const stores = Array.isArray(master?.stores) ? master.stores : [];
  const index = stores.findIndex(
    (s) => String(s?.tiwiId || s?.storeId || s?.id || '').trim() === target
  );
  return { store: index >= 0 ? stores[index] : null, index };
}

function resolveUserLookup(users = [], identifier) {
  const raw = String(identifier || '').trim();
  const lower = raw.toLowerCase();
  return (
    users.find(
      (u) =>
        String(u.id) === raw ||
        String(u.tiwiId || '').toLowerCase() === lower ||
        String(u.email || '').toLowerCase() === lower
    ) || null
  );
}

export function createAdminPlatformOpsRouter({
  requireAdmin = defaultNoopMiddleware,
  requireRecentReauth = defaultNoopMiddleware,
  deps = {}
} = {}) {
  const router = express.Router();

  const d = {
    get queryPg() { return deps.queryPg || queryPg; },
    get MasterDB() { return deps.MasterDB || MasterDB; },
    get TenantDB() { return deps.TenantDB || TenantDB; },
    get BillingDB() { return deps.BillingDB || BillingDB; },
    get getEcommercePackageById() { return deps.getEcommercePackageById || getEcommercePackageById; },
    get syncStoreLifecycleOnPlanChange() { return deps.syncStoreLifecycleOnPlanChange || syncStoreLifecycleOnPlanChange; },
    get purgeStoreMediaAssets() { return deps.purgeStoreMediaAssets || purgeStoreMediaAssets; },
    get getMarketUsdRates() { return deps.getMarketUsdRates || getMarketUsdRates; },
    get recordSecurityEvent() { return deps.recordSecurityEvent || recordSecurityEvent; },
    get computePlatformFinancialSummary() { return deps.computePlatformFinancialSummary || computePlatformFinancialSummary; },
    get computeStoreTierBreakdown() { return deps.computeStoreTierBreakdown || computeStoreTierBreakdown; },
    get getFleetLiveStatus() { return deps.getFleetLiveStatus || getFleetLiveStatus; },
    get listServerNodes() { return deps.listServerNodes || listServerNodes; },
    get computeRiskClusters() { return deps.computeRiskClusters || computeRiskClusters; },
    get recordPlatformBillingOrder() { return deps.recordPlatformBillingOrder || recordPlatformBillingOrder; },
    get os() { return deps.os || os; },
    get fs() { return deps.fs || fs; }
  };

  async function loadCurrencySettings() {
    const rows = await safeQueryRows(
      d.queryPg,
      `SELECT settings, updated_at FROM system_settings WHERE setting_key = $1 LIMIT 1`,
      [CURRENCY_SETTING_KEY]
    );
    const raw = rows[0]?.settings || {};
    let manualRates = {};
    if (raw.manualRates && typeof raw.manualRates === 'object') {
      try {
        manualRates = normalizeUsdRates(raw.manualRates);
      } catch {
        manualRates = { USD: 1 };
      }
    } else {
      manualRates = { USD: 1 };
    }
    const defaultCurrency = normalizeCurrencyCode(raw.defaultCurrency) || 'USD';
    return {
      defaultCurrency,
      manualRates,
      updatedAt: rows[0]?.updated_at || null
    };
  }

  // GET /api/admin/overview - Real SaaS cash accounting, store lifecycle & infra telemetry
  router.get('/overview', requireAdmin, async (req, res) => {
    try {
      const requesterIsSuperAdmin = isSuperAdminRequester(req.adminUser);
      const period = getSalesPeriod(String(req.query.range || '7days'));

      const [
        master,
        topups,
        billingOrders,
        promoClaims,
        redeemedVouchers,
        billingAccounts,
        customDomains,
        freeSubdomains,
        securityEvents,
        loginLocations,
        deviceIdentities,
        dbVersionRows,
        dbSizeRows,
        dbConnRows,
        fleetLive
      ] = await Promise.all([
        d.MasterDB.getMasterData(),
        safeQueryRows(d.queryPg, 'SELECT * FROM cloud_credit_topups ORDER BY created_at DESC LIMIT 5000'),
        safeQueryRows(d.queryPg, 'SELECT * FROM platform_billing_orders ORDER BY created_at DESC LIMIT 5000'),
        safeQueryRows(d.queryPg, 'SELECT * FROM system_promo_claims ORDER BY created_at DESC LIMIT 5000'),
        safeQueryRows(d.queryPg, 'SELECT * FROM cloud_vouchers WHERE is_redeemed = TRUE ORDER BY redeemed_at DESC LIMIT 5000'),
        safeQueryRows(d.queryPg, 'SELECT * FROM cloud_billing_accounts'),
        safeQueryRows(d.queryPg, 'SELECT * FROM system_custom_domains'),
        safeQueryRows(d.queryPg, 'SELECT * FROM system_free_subdomains'),
        safeQueryRows(
          d.queryPg,
          `SELECT id, event_type, severity, user_id, subject, ip, details, created_at
           FROM system_security_events
           ORDER BY created_at DESC
           LIMIT 30`
        ),
        safeQueryRows(
          d.queryPg,
          `SELECT user_id, ip, location_source, area, formatted_address, captured_at
           FROM system_user_login_locations
           ORDER BY captured_at DESC
           LIMIT 2000`
        ),
        safeQueryRows(
          d.queryPg,
          `SELECT user_id, identity_hash, device_hash, ip_hash, user_agent_hash, last_seen_at
           FROM system_user_device_identities`
        ),
        safeQueryRows(d.queryPg, 'SHOW server_version'),
        safeQueryRows(d.queryPg, 'SELECT pg_database_size(current_database())::bigint AS size_bytes'),
        safeQueryRows(
          d.queryPg,
          'SELECT count(*)::int AS active_connections FROM pg_stat_activity WHERE datname = current_database()'
        ),
        Promise.resolve(d.getFleetLiveStatus()).catch(() => ({
          totalNodes: 0,
          onlineNodes: 0,
          offlineNodes: 0,
          unknownNodes: 0
        }))
      ]);

      const allUsers = Array.isArray(master?.users) ? master.users : [];
      const superAdminIds = collectSuperAdminIds(allUsers);

      const summary = d.computePlatformFinancialSummary({
        topups,
        billingOrders,
        promoClaims,
        redeemedVouchers,
        billingAccounts,
        periodStart: period.start,
        periodEnd: period.end,
        previousStart: period.previousStart,
        previousEnd: period.previousEnd,
        bucketStarts: period.bucketStarts,
        bucketUnit: period.bucketUnit
      });

      const storeBreakdown = d.computeStoreTierBreakdown(
        master?.stores || [],
        customDomains,
        freeSubdomains,
        master?.subscriptions || []
      );

      // Real order type counters in selected window
      const startMs = period.start.getTime();
      const endMs = period.end.getTime();
      const inWindow = (v) => {
        const ts = v ? Date.parse(String(v)) : NaN;
        return Number.isFinite(ts) && ts >= startMs && ts < endMs;
      };

      let upgradeOrdersCount = 0;
      let addonOrdersCount = 0;
      let promoOrdersCount = 0;
      for (const order of billingOrders) {
        if (!inWindow(order.created_at)) continue;
        if (String(order.status || 'paid').toLowerCase() !== 'paid') continue;
        const t = String(order.order_type || '').toLowerCase();
        if (t.includes('upgrade') || t.includes('subscription') || t.includes('renew') || t.includes('creat')) {
          upgradeOrdersCount += 1;
        } else if (t.includes('addon')) {
          addonOrdersCount += 1;
        } else if (t.includes('promo') || t.includes('voucher')) {
          promoOrdersCount += 1;
        }
      }
      promoOrdersCount += promoClaims.filter((c) => inWindow(c.created_at) && c.status !== 'rejected').length;
      promoOrdersCount += redeemedVouchers.filter((v) => inWindow(v.redeemed_at)).length;

      // Identity risk clusters (excluding super_admin for non-super-admins)
      const visibleUsersForRisk = requesterIsSuperAdmin
        ? allUsers
        : allUsers.filter((u) => !isSuperAdminAccount(u));
      const riskResult = d.computeRiskClusters({
        users: visibleUsersForRisk,
        deviceIdentities: requesterIsSuperAdmin
          ? deviceIdentities
          : deviceIdentities.filter((row) => !superAdminIds.has(String(row.user_id))),
        loginLocations: requesterIsSuperAdmin
          ? loginLocations
          : loginLocations.filter((row) => !superAdminIds.has(String(row.user_id))),
        promoClaims: requesterIsSuperAdmin
          ? promoClaims
          : promoClaims.filter((row) => !superAdminIds.has(String(row.user_id)))
      });

      const riskSummary = riskResult?.summary || {};
      const flaggedRiskUsers = Number(
        riskSummary.flaggedUsers ?? riskSummary.highRiskUsers ?? riskResult?.flaggedUsersCount ?? 0
      );
      const banEvasionRiskCount = Number(
        riskSummary.banEvasionClusters ?? riskSummary.multiAccountClusters ?? (Array.isArray(riskResult?.clusters) ? riskResult.clusters.filter((c) => c.hasBannedMember).length : 0)
      );

      // Revenue & Subsidy Breakdown
      const breakdownItems = [];
      for (const prov of summary.revenueByProvider || []) {
        breakdownItems.push({
          name: `${String(prov.provider || 'Gateway').toUpperCase()} Cash Top-ups`,
          amountUsd: prov.amountUsd,
          isSubsidy: false
        });
      }
      if (summary.freeCreditsUsedUsd > 0) {
        breakdownItems.push({
          name: 'Free Promo Credits Used (Subsidy)',
          amountUsd: summary.freeCreditsUsedUsd,
          color: '#f59e0b',
          isSubsidy: true
        });
      }
      const totalMixUsd = breakdownItems.reduce((sum, item) => sum + item.amountUsd, 0);
      const revenueBreakdown = {
        totalUsd: roundUsd(totalMixUsd),
        categories: breakdownItems.map((item) => ({
          ...item,
          percentage: totalMixUsd > 0 ? Math.round((item.amountUsd / totalMixUsd) * 1000) / 10 : 0
        }))
      };

      // Recent Platform Activity (with Super Admin isolation)
      const userById = new Map(allUsers.map((u) => [String(u.id), u]));
      const activities = [];

      for (const topup of topups.slice(0, 15)) {
        if (String(topup.status || '').toLowerCase() !== 'paid') continue;
        if (!requesterIsSuperAdmin && superAdminIds.has(String(topup.user_id))) continue;
        const owner = userById.get(String(topup.user_id));
        if (!requesterIsSuperAdmin && isSuperAdminAccount(owner)) continue;
        const ts = topup.paid_at || topup.created_at;
        activities.push({
          id: `topup:${topup.id}`,
          type: 'topup',
          icon: 'topup',
          title: `Cash Wallet Top-up (${String(topup.provider || 'Gateway').toUpperCase()})`,
          target: owner?.email || topup.user_id,
          amountUsd: roundUsd(topup.amount),
          timestamp: ts,
          timeAgo: formatRelativeTime(ts)
        });
      }

      for (const order of billingOrders.slice(0, 15)) {
        if (!requesterIsSuperAdmin && superAdminIds.has(String(order.user_id))) continue;
        const owner = userById.get(String(order.user_id));
        if (!requesterIsSuperAdmin && isSuperAdminAccount(owner)) continue;
        const cashVal = Number(order.cash_credit_used_usd || 0);
        const promoVal = Number(order.promo_credit_used_usd || 0);
        activities.push({
          id: `order:${order.id}`,
          type: 'upgrade',
          icon: 'upgrade',
          title: order.item_name || `Plan order (${order.order_type})`,
          target: owner?.email || order.tiwi_id || order.user_id || 'Tenant store',
          amountUsd: cashVal > 0 ? roundUsd(cashVal) : roundUsd(promoVal),
          timestamp: order.created_at,
          timeAgo: formatRelativeTime(order.created_at)
        });
      }

      for (const evt of securityEvents) {
        if (!requesterIsSuperAdmin) {
          if (superAdminIds.has(String(evt.user_id))) continue;
          if (isSuperAdminAccount({ email: evt.subject })) continue;
          const detailsRole = String(evt.details?.role || evt.details?.targetRole || '').toLowerCase();
          if (detailsRole === 'super_admin') continue;
        }
        activities.push({
          id: `sec:${evt.id}`,
          type: 'security',
          icon: 'security',
          title: String(evt.event_type || 'security.event'),
          target: evt.subject || evt.ip || 'System security',
          userId: evt.user_id || null,
          subject: evt.subject || null,
          timestamp: evt.created_at,
          timeAgo: formatRelativeTime(evt.created_at)
        });
      }

      const recentActivities = activities
        .filter((a) => a.timestamp)
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
        .slice(0, 10);

      // Host hardware & PostgreSQL live metrics
      const totalMemBytes = d.os.totalmem();
      const freeMemBytes = d.os.freemem();
      const usedMemBytes = Math.max(0, totalMemBytes - freeMemBytes);
      const hostRamTotalMb = Math.round(totalMemBytes / (1024 * 1024));
      const hostRamUsedMb = Math.round(usedMemBytes / (1024 * 1024));
      const ramUsagePercent = totalMemBytes > 0 ? Math.round((usedMemBytes / totalMemBytes) * 100) : null;
      const cpuLoad = d.os.loadavg();

      let mediaDiskUsed = null;
      let mediaDiskTotal = null;
      let mediaDiskUsage = null;
      try {
        if (typeof d.fs.statfsSync === 'function') {
          const stat = d.fs.statfsSync(process.cwd());
          const totalBytes = Number(stat.blocks) * Number(stat.bsize);
          const availBytes = Number(stat.bavail) * Number(stat.bsize);
          const usedBytes = Math.max(0, totalBytes - availBytes);
          mediaDiskUsed = formatBytesPretty(usedBytes);
          mediaDiskTotal = formatBytesPretty(totalBytes);
          if (mediaDiskUsed && mediaDiskTotal) {
            const pct = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0;
            mediaDiskUsage = `${mediaDiskUsed} / ${mediaDiskTotal} (${pct}%)`;
          }
        }
      } catch {
        // Optional disk metric on restricted hosts
      }

      const totalNodes = Number(fleetLive?.totalNodes ?? 0);
      const onlineNodes = Number(fleetLive?.onlineNodes ?? 0);
      const dbSizeBytes = Number(dbSizeRows[0]?.size_bytes);
      const dbSizePretty = Number.isFinite(dbSizeBytes) ? formatBytesPretty(dbSizeBytes) : null;

      return res.json({
        success: true,
        data: {
          range: period.range,
          metrics: {
            netCashProfitUsd: summary.netCashProfitUsd,
            grossCashTopupsUsd: summary.grossCashTopupsUsd,
            cashRefundsUsd: summary.cashRefundsUsd,
            unspentWalletLiabilityUsd: summary.unspentCashWalletLiabilityUsd,
            freeCreditsIssuedUsd: summary.freeCreditsIssuedUsd,
            freeCreditsUsedUsd: summary.freeCreditsUsedUsd,
            subscriptionCashRecognizedUsd: summary.subscriptionCashRecognizedUsd,
            totalStores: storeBreakdown.totalStores,
            freeStores: storeBreakdown.freeStores,
            paidStores: storeBreakdown.paidStores,
            gracePeriodStores: storeBreakdown.gracePeriodStores,
            suspendedStores: storeBreakdown.suspendedStores,
            graceOrSuspendedStores: storeBreakdown.gracePeriodStores + storeBreakdown.suspendedStores,
            totalSystemOrders: summary.totalSystemOrdersCount,
            upgradeOrdersCount,
            topupOrdersCount: summary.paidTopupCount,
            addonOrdersCount,
            promoOrdersCount,
            flaggedRiskUsers,
            banEvasionRiskCount,
            cloudServersOnline: onlineNodes,
            cloudServersTotal: totalNodes
          },
          salesOverview: summary.series,
          revenueBreakdown,
          storesOverview: {
            totalStores: storeBreakdown.totalStores,
            freeStores: storeBreakdown.freeStores,
            paidStores: storeBreakdown.paidStores,
            gracePeriodStores: storeBreakdown.gracePeriodStores,
            suspendedStores: storeBreakdown.suspendedStores,
            customDomains: storeBreakdown.customDomainsCount,
            freeSubdomains: storeBreakdown.freeSubdomainsCount,
            planBreakdown: storeBreakdown.byPlan
          },
          cloudOverview: {
            providerConnected: totalNodes > 0,
            totalServers: totalNodes,
            activeServers: onlineNodes,
            offlineServers: Number(fleetLive?.offlineNodes ?? 0),
            hostRamUsedMb,
            hostRamTotalMb,
            ramUsagePercent,
            ramUsedFormatted: formatBytesPretty(usedMemBytes),
            ramTotalFormatted: formatBytesPretty(totalMemBytes),
            cpuLoad,
            mediaDiskUsed,
            mediaDiskTotal,
            mediaDiskUsage
          },
          systemInfo: {
            nodeVersion: process.version,
            database: `PostgreSQL ${dbVersionRows[0]?.server_version || 'connected'}`,
            dbSize: dbSizePretty,
            dbActiveConnections: dbConnRows[0]?.active_connections ?? null,
            serverUptime: formatFormattedUptime(),
            hostRamUsedMb,
            hostRamTotalMb,
            ramUsagePercent,
            cpuLoad,
            mediaDiskUsage,
            status: 'Application and database connected',
            operational: true
          },
          recentActivities
        }
      });
    } catch (error) {
      console.error('[Admin Platform Overview Error]', error.message);
      return res.status(503).json({ error: 'Failed to load live platform overview metrics.' });
    }
  });

  // GET /api/admin/orders - Real SaaS cash top-ups, subscription upgrades, add-ons & promo grants
  router.get('/orders', requireAdmin, async (req, res) => {
    try {
      const requesterIsSuperAdmin = isSuperAdminRequester(req.adminUser);
      const [master, topups, billingOrders, promoClaims, redeemedVouchers, billingAccounts] = await Promise.all([
        d.MasterDB.getMasterData(),
        safeQueryRows(d.queryPg, 'SELECT * FROM cloud_credit_topups ORDER BY created_at DESC LIMIT 2000'),
        safeQueryRows(d.queryPg, 'SELECT * FROM platform_billing_orders ORDER BY created_at DESC LIMIT 2000'),
        safeQueryRows(d.queryPg, 'SELECT * FROM system_promo_claims ORDER BY created_at DESC LIMIT 2000'),
        safeQueryRows(d.queryPg, 'SELECT * FROM cloud_vouchers WHERE is_redeemed = TRUE ORDER BY redeemed_at DESC LIMIT 2000'),
        safeQueryRows(d.queryPg, 'SELECT * FROM cloud_billing_accounts')
      ]);

      const users = Array.isArray(master?.users) ? master.users : [];
      const stores = Array.isArray(master?.stores) ? master.stores : [];
      const userById = new Map(users.map((u) => [String(u.id), u]));
      const storeByTiwi = new Map(stores.map((s) => [String(s.tiwiId || s.id), s]));
      const superAdminIds = collectSuperAdminIds(users);

      const isVisibleUser = (userId) => {
        if (requesterIsSuperAdmin) return true;
        if (!userId) return true;
        if (superAdminIds.has(String(userId))) return false;
        const owner = userById.get(String(userId));
        return !isSuperAdminAccount(owner);
      };

      const orders = [];

      for (const topup of topups) {
        if (!isVisibleUser(topup.user_id)) continue;
        const owner = userById.get(String(topup.user_id));
        const status = String(topup.status || 'pending').toLowerCase();
        const amountUsd = roundUsd(topup.amount);
        const isPaid = status === 'paid';
        const isRefunded = status === 'refunded';
        const refundAmt = roundUsd(topup.refunded_amount ?? (isRefunded ? amountUsd : 0));

        orders.push({
          id: topup.id,
          rowKey: `topup:${topup.id}`,
          orderNumber: topup.id,
          type: 'topup',
          createdAt: topup.paid_at || topup.created_at || null,
          merchantEmail: owner?.email || '',
          merchantName: owner?.name || owner?.storeName || '',
          storeName: 'Cloud Wallet',
          storeId: null,
          planId: null,
          planName: `Cloud Wallet Top-up (${String(topup.provider || 'Gateway').toUpperCase()})`,
          itemName: `Cloud Wallet Top-up`,
          grossAmountUsd: amountUsd,
          paidCashUsd: isPaid ? amountUsd : isRefunded ? roundUsd(amountUsd - refundAmt) : 0,
          freeCreditUsedUsd: 0,
          netProfitUsd: isPaid ? amountUsd : isRefunded ? roundUsd(amountUsd - refundAmt) : 0,
          provider: topup.provider || 'gateway',
          originalCurrency: topup.provider_currency || topup.currency || 'USD',
          originalAmount: topup.provider_amount != null ? Number(topup.provider_amount) : amountUsd,
          status
        });
      }

      for (const order of billingOrders) {
        if (!isVisibleUser(order.user_id)) continue;
        const owner = userById.get(String(order.user_id));
        const store = order.tiwi_id ? storeByTiwi.get(String(order.tiwi_id)) : null;
        const paidCash = roundUsd(order.cash_credit_used_usd ?? order.net_cash_revenue_usd ?? 0);
        const freeUsed = roundUsd(order.promo_credit_used_usd ?? 0);
        const rawType = String(order.order_type || '').toLowerCase();
        const normType = rawType.includes('upgrade')
          ? 'upgrade'
          : rawType.includes('renew')
            ? 'renewal'
            : rawType.includes('creat')
              ? 'creation'
              : rawType.includes('addon')
                ? 'addon'
                : rawType.includes('promo') || rawType.includes('voucher')
                  ? 'promo'
                  : rawType || 'order';

        orders.push({
          id: order.id,
          rowKey: `billing:${order.id}`,
          orderNumber: order.order_number || order.id,
          type: normType,
          createdAt: order.created_at || null,
          merchantEmail: owner?.email || '',
          merchantName: owner?.name || owner?.storeName || '',
          storeName: store?.storeName || order.tiwi_id || '',
          tiwiId: order.tiwi_id || null,
          planId: order.plan_id || null,
          planName: order.item_name || order.plan_id || 'Subscription',
          itemName: order.item_name || order.plan_id || 'Subscription',
          grossAmountUsd: roundUsd(order.gross_amount_usd),
          paidCashUsd: paidCash,
          freeCreditUsedUsd: freeUsed,
          // Cash is already recognized at wallet top-up/refund level; promo usage creates zero profit
          netProfitUsd: paidCash,
          provider: order.provider || (freeUsed > 0 && paidCash === 0 ? 'Promo Credit' : 'Wallet'),
          originalCurrency: order.currency || 'USD',
          originalAmount: roundUsd(order.gross_amount_usd),
          status: order.status || 'paid'
        });
      }

      for (const claim of promoClaims) {
        if (!isVisibleUser(claim.user_id)) continue;
        const owner = userById.get(String(claim.user_id));
        orders.push({
          id: `promo:${claim.id}`,
          rowKey: `promo:${claim.id}`,
          orderNumber: `PROMO-${claim.id}`,
          type: 'promo',
          createdAt: claim.created_at || null,
          merchantEmail: owner?.email || '',
          merchantName: owner?.name || owner?.storeName || '',
          storeName: 'Promo Balance',
          planId: null,
          planName: claim.promo_code ? `Promo (${claim.promo_code})` : `Promo Grant (${claim.claim_type})`,
          itemName: claim.promo_code || claim.claim_type || 'Promotional Grant',
          grossAmountUsd: roundUsd(claim.amount_usd),
          paidCashUsd: 0,
          freeCreditUsedUsd: roundUsd(claim.amount_usd),
          netProfitUsd: 0,
          provider: 'Promo Grant',
          originalCurrency: 'USD',
          originalAmount: roundUsd(claim.amount_usd),
          status: claim.status || 'granted'
        });
      }

      for (const voucher of redeemedVouchers) {
        if (!isVisibleUser(voucher.redeemed_by)) continue;
        const owner = voucher.redeemed_by ? userById.get(String(voucher.redeemed_by)) : null;
        orders.push({
          id: `voucher:${voucher.id}`,
          rowKey: `voucher:${voucher.id}`,
          orderNumber: `VOUCH-${voucher.code}`,
          type: 'promo',
          createdAt: voucher.redeemed_at || null,
          merchantEmail: owner?.email || '',
          merchantName: owner?.name || owner?.storeName || '',
          storeName: 'Voucher Credit',
          planId: null,
          planName: `Voucher (${voucher.code})`,
          itemName: `Voucher (${voucher.code})`,
          grossAmountUsd: roundUsd(voucher.amount),
          paidCashUsd: 0,
          freeCreditUsedUsd: roundUsd(voucher.amount),
          netProfitUsd: 0,
          provider: 'Voucher',
          originalCurrency: 'USD',
          originalAmount: roundUsd(voucher.amount),
          status: 'redeemed'
        });
      }

      orders.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      const summary = d.computePlatformFinancialSummary({
        topups,
        billingOrders,
        promoClaims,
        redeemedVouchers,
        billingAccounts
      });

      return res.json({
        success: true,
        orders,
        summary,
        liveCount: orders.length
      });
    } catch (error) {
      console.error('[Admin Platform Orders Error]', error.message);
      return res.status(503).json({ error: 'Failed to retrieve platform orders.' });
    }
  });

  // GET /api/admin/alerts - Real operational alerts without super-admin leakage
  router.get('/alerts', requireAdmin, async (req, res) => {
    try {
      const requesterIsSuperAdmin = isSuperAdminRequester(req.adminUser);
      const [master, appeals, domainIssues, secEvents, fleetLive] = await Promise.all([
        d.MasterDB.getMasterData(),
        safeQueryRows(
          d.queryPg,
          `SELECT id, subject, status, created_at FROM support_tickets
           WHERE status IN ('OPEN', 'IN_PROGRESS')
           ORDER BY created_at DESC LIMIT 10`
        ),
        safeQueryRows(
          d.queryPg,
          `SELECT id, domain, status, ssl_status, updated_at FROM system_custom_domains
           WHERE ssl_status IN ('failed', 'error') OR status = 'failed'
           ORDER BY updated_at DESC LIMIT 10`
        ),
        safeQueryRows(
          d.queryPg,
          `SELECT id, event_type, severity, user_id, subject, details, created_at
           FROM system_security_events
           WHERE severity IN ('warning', 'critical', 'error')
           ORDER BY created_at DESC LIMIT 15`
        ),
        Promise.resolve(d.getFleetLiveStatus()).catch(() => ({ totalNodes: 0, offlineNodes: 0 }))
      ]);

      const superAdminIds = collectSuperAdminIds(master?.users || []);
      const alerts = [];

      for (const appeal of appeals) {
        alerts.push({
          id: `appeal:${appeal.id}`,
          view: 'pick-account-appeals',
          title: appeal.subject || 'Open Support / Appeal Ticket',
          message: `Ticket status: ${appeal.status}`,
          severity: 'warning',
          createdAt: appeal.created_at
        });
      }

      for (const store of master?.stores || []) {
        const lifecycle = String(store?.lifecycleStatus || store?.status || '').toLowerCase();
        if (lifecycle === 'grace_period' || lifecycle === 'suspended') {
          if (!requesterIsSuperAdmin && superAdminIds.has(String(store.ownerId))) continue;
          alerts.push({
            id: `store:${store.tiwiId || store.id}`,
            view: 'customers',
            title: `${store.storeName || store.tiwiId} (${lifecycle.replace('_', ' ')})`,
            message: lifecycle === 'grace_period' ? 'Store in 3-day billing grace period' : 'Store suspended — retention timer active',
            severity: lifecycle === 'suspended' ? 'critical' : 'warning',
            createdAt: store.updatedAt || store.createdAt || null
          });
        }
      }

      for (const dom of domainIssues) {
        alerts.push({
          id: `domain:${dom.id}`,
          view: 'domains',
          title: `Domain SSL/DNS Issue: ${dom.domain}`,
          message: `Status: ${dom.status} · SSL: ${dom.ssl_status}`,
          severity: 'warning',
          createdAt: dom.updated_at
        });
      }

      if (Number(fleetLive?.offlineNodes || 0) > 0) {
        alerts.push({
          id: 'fleet:offline',
          view: 'servers',
          title: `${fleetLive.offlineNodes} Fleet Server(s) Offline`,
          message: 'Real-time probe detected unreachable managed nodes.',
          severity: 'critical',
          createdAt: new Date().toISOString()
        });
      }

      for (const evt of secEvents) {
        if (!requesterIsSuperAdmin) {
          if (superAdminIds.has(String(evt.user_id))) continue;
          if (isSuperAdminAccount({ email: evt.subject })) continue;
          if (String(evt.details?.role || evt.details?.targetRole || '').toLowerCase() === 'super_admin') continue;
        }
        alerts.push({
          id: `sec:${evt.id}`,
          view: 'logs',
          title: evt.event_type,
          message: evt.subject || 'Security event logged',
          severity: evt.severity,
          userId: evt.user_id || null,
          subject: evt.subject || null,
          createdAt: evt.created_at
        });
      }

      return res.json({
        success: true,
        alerts: alerts.slice(0, 25),
        unreadCount: alerts.length
      });
    } catch (error) {
      console.error('[Admin Alerts Error]', error.message);
      return res.status(503).json({ error: 'Could not load admin alerts.' });
    }
  });

  // GET /api/admin/currency-rates - Live USD rates + saved admin manual overrides (no fake BDT numbers)
  router.get('/currency-rates', requireAdmin, async (_req, res) => {
    try {
      const saved = await loadCurrencySettings();
      let liveRates = { USD: 1 };
      let liveSource = null;
      let observedAt = null;
      let feedError = '';

      try {
        const market = await d.getMarketUsdRates();
        if (market?.rates && typeof market.rates === 'object') {
          liveRates = { USD: 1, ...market.rates };
          liveSource = market.source || 'Frankfurter central-bank reference rates';
          observedAt = market.observedAt || null;
        }
      } catch (err) {
        feedError = err.message || 'Live market rate feed unavailable.';
      }

      const mergedRates = {
        ...liveRates,
        ...saved.manualRates,
        USD: 1
      };
      const bdtRate =
        typeof mergedRates.BDT === 'number' && Number.isFinite(mergedRates.BDT) && mergedRates.BDT > 0
          ? mergedRates.BDT
          : null;

      let warning = '';
      if (feedError) {
        warning = bdtRate
          ? `${feedError} Using saved admin manual overrides where configured.`
          : `${feedError} Live market rate feed is currently unavailable.`;
      } else if (!bdtRate) {
        warning = 'Live feed does not publish USD -> BDT and no manual BDT override is configured.';
      }

      const rateSource =
        Object.keys(saved.manualRates).filter((k) => k !== 'USD').length > 0
          ? liveSource
            ? `${liveSource} + Admin Overrides`
            : 'Admin Manual Override'
          : liveSource;

      return res.json({
        success: true,
        data: {
          defaultCurrency: saved.defaultCurrency,
          rates: mergedRates,
          bdtRate,
          rateSource,
          observedAt: observedAt || saved.updatedAt,
          warning
        }
      });
    } catch (error) {
      console.error('[Admin Currency Rates Error]', error.message);
      return res.status(503).json({ error: 'Could not load exchange rates.' });
    }
  });

  // PUT /api/admin/currency-settings
  router.put('/currency-settings', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const body = req.body || {};
      const defaultCurrency = normalizeCurrencyCode(body.defaultCurrency || body.displayCurrency || 'USD');
      if (!defaultCurrency) {
        return res.status(400).json({ error: 'Enter a valid 3-letter ISO currency code.' });
      }

      const existing = await loadCurrencySettings();
      let nextManualRates = { ...existing.manualRates, USD: 1 };

      if (body.manualRates && typeof body.manualRates === 'object') {
        const validated = normalizeUsdRates(body.manualRates);
        nextManualRates = { ...nextManualRates, ...validated, USD: 1 };
      }

      if (body.bdtRateOverride !== undefined && body.bdtRateOverride !== null && body.bdtRateOverride !== '') {
        const parsedBdt = Number(body.bdtRateOverride);
        if (!Number.isFinite(parsedBdt) || parsedBdt <= 0) {
          return res.status(400).json({ error: 'BDT exchange rate override must be a positive number.' });
        }
        nextManualRates.BDT = parsedBdt;
      }

      const payload = {
        defaultCurrency,
        manualRates: nextManualRates,
        updatedBy: req.adminUser?.id || null
      };

      await d.queryPg(
        `INSERT INTO system_settings (setting_key, settings, updated_at)
         VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (setting_key)
         DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP`,
        [CURRENCY_SETTING_KEY, JSON.stringify(payload)]
      );

      await d.recordSecurityEvent({
        eventType: 'admin.currency_settings_updated',
        severity: 'info',
        userId: req.adminUser?.id || null,
        subject: req.adminUser?.email || null,
        details: { defaultCurrency, bdtRateOverride: nextManualRates.BDT || null }
      });

      return res.json({
        success: true,
        message: `Currency settings updated (${defaultCurrency}).`,
        data: payload
      });
    } catch (error) {
      return res.status(400).json({ error: error.message || 'Could not update currency settings.' });
    }
  });

  // GET /api/admin/domains - All custom domains and free platform subdomains
  router.get('/domains', requireAdmin, async (req, res) => {
    try {
      const requesterIsSuperAdmin = isSuperAdminRequester(req.adminUser);
      const [customRows, subdomainRows] = await Promise.all([
        safeQueryRows(
          d.queryPg,
          `SELECT d.id, d.user_id, d.tiwi_id, d.domain, d.status, d.ssl_status, d.ssl_error,
                  d.verified_at, d.created_at, d.updated_at,
                  u.name AS owner_name, u.email AS owner_email, u.role AS owner_role,
                  s.store_name
           FROM system_custom_domains d
           LEFT JOIN system_users u ON u.id = d.user_id
           LEFT JOIN system_stores s ON s.tiwi_id = d.tiwi_id
           ORDER BY d.created_at DESC`
        ),
        safeQueryRows(
          d.queryPg,
          `SELECT f.id, f.subdomain, f.domain, f.user_id, f.status, f.created_at, f.updated_at,
                  u.name AS owner_name, u.email AS owner_email, u.role AS owner_role,
                  s.tiwi_id, s.store_name
           FROM system_free_subdomains f
           LEFT JOIN system_users u ON u.id = f.user_id
           LEFT JOIN system_stores s ON s.owner_id = f.user_id
           ORDER BY f.created_at DESC`
        )
      ]);

      const visibleCustom = customRows
        .filter((r) => requesterIsSuperAdmin || !isSuperAdminAccount({ role: r.owner_role, email: r.owner_email }))
        .map((r) => ({
          id: r.id,
          userId: r.user_id,
          tiwiId: r.tiwi_id,
          domain: r.domain,
          status: r.status,
          sslStatus: r.ssl_status,
          sslError: r.ssl_error || null,
          verifiedAt: r.verified_at || null,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          ownerName: r.owner_name || null,
          ownerEmail: r.owner_email || null,
          storeName: r.store_name || null
        }));

      const visibleSubdomains = subdomainRows
        .filter((r) => requesterIsSuperAdmin || !isSuperAdminAccount({ role: r.owner_role, email: r.owner_email }))
        .map((r) => ({
          id: r.id,
          subdomain: r.subdomain,
          host: r.domain,
          domain: r.domain,
          userId: r.user_id,
          tiwiId: r.tiwi_id || null,
          storeName: r.store_name || null,
          ownerName: r.owner_name || null,
          ownerEmail: r.owner_email || null,
          status: r.status,
          createdAt: r.created_at,
          updatedAt: r.updated_at
        }));

      return res.json({
        success: true,
        customDomains: visibleCustom,
        freeSubdomains: visibleSubdomains
      });
    } catch (error) {
      console.error('[Admin Domains Error]', error.message);
      return res.status(503).json({ error: 'Could not load store domains.' });
    }
  });

  // GET /api/admin/servers - Bridge to managed Server Fleet engine
  router.get('/servers', requireAdmin, async (_req, res) => {
    try {
      const [live, list] = await Promise.all([
        Promise.resolve(d.getFleetLiveStatus()),
        d.listServerNodes({ page: 1, limit: 50 })
      ]);
      const items = Array.isArray(list?.items) ? list.items : [];
      return res.json({
        success: true,
        providerConnected: (live?.totalNodes ?? items.length) > 0,
        droplets: items,
        liveStatus: live
      });
    } catch (error) {
      console.error('[Admin Servers Bridge Error]', error.message);
      return res.json({
        success: true,
        providerConnected: false,
        droplets: [],
        message: 'Server fleet could not be loaded.'
      });
    }
  });

  // GET /api/admin/customers - Merchants + Wallet & Promo Credit Balances + Store Lifecycle Fields
  router.get('/customers', requireAdmin, async (req, res) => {
    try {
      const requesterIsSuperAdmin = isSuperAdminRequester(req.adminUser);
      const [master, billingRows, loginRows, locationRows] = await Promise.all([
        d.MasterDB.getMasterData(),
        safeQueryRows(
          d.queryPg,
          `SELECT user_id, credits, promotional_credits, promotional_expires_at
           FROM cloud_billing_accounts`
        ),
        safeQueryRows(
          d.queryPg,
          `SELECT user_id, MAX(created_at) AS last_login_at
           FROM system_sessions
           GROUP BY user_id`
        ),
        safeQueryRows(
          d.queryPg,
          `SELECT DISTINCT ON (user_id)
                  user_id, location_source, formatted_address, area, captured_at
           FROM system_user_login_locations
           ORDER BY user_id, captured_at DESC, id DESC`
        )
      ]);

      const rawUsers = Array.isArray(master?.users) ? master.users : [];
      const users = requesterIsSuperAdmin ? rawUsers : rawUsers.filter((u) => !isSuperAdminAccount(u));
      const masterStores = Array.isArray(master?.stores) ? master.stores : [];
      const masterSubs = Array.isArray(master?.subscriptions) ? master.subscriptions : [];
      const subByTiwi = new Map(masterSubs.map((s) => [String(s.tiwiId), s]));
      const billingByUser = new Map(billingRows.map((b) => [String(b.user_id), b]));
      const loginByUser = new Map(loginRows.map((l) => [String(l.user_id), l.last_login_at]));
      const locationByUser = new Map(locationRows.map((l) => [String(l.user_id), l]));

      const nowMs = Date.now();
      const query = String(req.query.q || req.query.search || '').trim().toLowerCase();

      let customers = users.map((u) => {
        const userStores = masterStores.filter(
          (s) =>
            String(s.ownerId || '') === String(u.id) ||
            (u.tiwiId && String(s.tiwiId) === String(u.tiwiId)) ||
            (u.storeId && String(s.tiwiId) === String(u.storeId))
        );
        const billing = billingByUser.get(String(u.id));
        const promoExpMs = billing?.promotional_expires_at
          ? Date.parse(String(billing.promotional_expires_at))
          : NaN;
        const promoActive =
          billing &&
          Number(billing.promotional_credits || 0) > 0 &&
          (!Number.isFinite(promoExpMs) || promoExpMs > nowMs);

        const mappedStores = userStores.map((s) => {
          const sub = subByTiwi.get(String(s.tiwiId)) || {};
          return {
            id: s.id || s.tiwiId,
            tiwiId: s.tiwiId,
            name: s.storeName,
            storeName: s.storeName,
            subdomain: s.subdomain,
            category: s.category || '',
            currency: s.currency || 'USD',
            status: s.status || sub.status || 'active',
            lifecycleStatus: s.lifecycleStatus || sub.lifecycleStatus || (s.status === 'suspended' ? 'suspended' : 'active'),
            subscriptionStatus: s.subscriptionStatus || sub.subscriptionStatus || 'active',
            planId: sub.planId || s.planId || 'free',
            planName: sub.planName || s.planName || undefined,
            extraProductSlots: Number(sub.extraProductSlots ?? s.extraProductSlots ?? 0),
            extraStaffSlots: Number(sub.extraStaffSlots ?? s.extraStaffSlots ?? 0),
            posAddon: Boolean(sub.posAddon ?? sub.hasPosAddon ?? s.posAddon ?? false),
            expiresAt: sub.expiresAt || s.expiresAt || null,
            graceEndsAt: sub.graceEndsAt || s.graceEndsAt || null,
            scheduledDeletionAt: sub.scheduledDeletionAt || s.scheduledDeletionAt || null,
            createdAt: s.createdAt || null
          };
        });

        const loc = locationByUser.get(String(u.id));
        return {
          id: u.id,
          tiwiId: u.tiwiId || u.storeId || '',
          name: u.name || u.storeName || 'Tiwlo User',
          email: u.email,
          avatar: u.avatar && !u.avatar.includes('unsplash.com') ? u.avatar : '/tiwlo-icon.png',
          role: u.role || 'owner',
          cashBalance: roundUsd(billing?.credits ?? 0),
          promoCreditBalance: promoActive ? roundUsd(billing.promotional_credits) : 0,
          promotionalExpiresAt: billing?.promotional_expires_at || null,
          storeCount: mappedStores.length,
          stores: mappedStores,
          storeNames: mappedStores.map((s) => s.storeName).filter(Boolean),
          primaryStoreName: mappedStores[0]?.storeName || '—',
          subdomain: mappedStores[0]?.subdomain || u.subdomain || null,
          planName: u.planName || u.planId || 'Free Starter',
          planId: u.planId || 'free',
          isBanned: !!u.isBanned,
          identityVerified: u.identityVerified === true,
          identityVerificationRequired: u.identityVerificationRequired === true,
          banReason: u.banReason || '',
          status: u.isBanned
            ? 'Suspended'
            : u.identityVerificationRequired && !u.identityVerified
              ? 'Identity required'
              : 'Active',
          createdAt: u.createdAt || null,
          lastLoginAt: loginByUser.get(String(u.id)) || null,
          latestLocation: loc
            ? {
                source: loc.location_source,
                address: loc.formatted_address,
                area: loc.area,
                capturedAt: loc.captured_at
              }
            : null
        };
      });

      if (query) {
        customers = customers.filter(
          (c) =>
            c.name.toLowerCase().includes(query) ||
            String(c.email || '').toLowerCase().includes(query) ||
            c.tiwiId.toLowerCase().includes(query) ||
            c.storeNames.some((sn) => sn.toLowerCase().includes(query))
        );
      }

      customers.sort((a, b) => b.storeCount - a.storeCount || Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));

      return res.json({
        success: true,
        customers,
        total: customers.length,
        totalStores: requesterIsSuperAdmin
          ? masterStores.length
          : customers.reduce((sum, c) => sum + c.storeCount, 0)
      });
    } catch (error) {
      console.error('[Admin Customers Error]', error.message);
      return res.status(503).json({ error: 'Failed to retrieve customers.' });
    }
  });

  function guardStoreOwnerAccess(req, res, master, store) {
    const owner = (master?.users || []).find((u) => String(u.id) === String(store.ownerId));
    if (owner && isSuperAdminAccount(owner) && !isSuperAdminRequester(req.adminUser)) {
      res.status(403).json({ error: 'Access restricted: Super Administrator stores cannot be modified here.' });
      return { blocked: true, owner };
    }
    return { blocked: false, owner };
  }

  // PATCH /api/admin/stores/:tiwiId - Edit store details
  router.patch('/stores/:tiwiId', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const tiwiId = String(req.params.tiwiId || '').trim();
      const master = await d.MasterDB.getMasterData();
      const { store } = findStoreInMaster(master, tiwiId);
      if (!store) return res.status(404).json({ error: 'Store not found.' });
      if (guardStoreOwnerAccess(req, res, master, store).blocked) return;

      const nextName = req.body?.storeName ?? req.body?.name;
      const nextSubdomain = req.body?.subdomain;
      const nextCategory = req.body?.category;
      const nextCurrency = req.body?.currency;

      if (nextName !== undefined) {
        const trimmed = String(nextName).trim();
        if (!trimmed || trimmed.length > 120) {
          return res.status(400).json({ error: 'Store name must be between 1 and 120 characters.' });
        }
        store.storeName = trimmed;
      }

      if (nextSubdomain !== undefined) {
        const slug = String(nextSubdomain).trim().toLowerCase();
        if (!VALID_SUBDOMAIN_RE.test(slug)) {
          return res.status(400).json({ error: 'Enter a valid lowercase subdomain slug.' });
        }
        const collision = (master.stores || []).some(
          (s) => String(s.tiwiId) !== tiwiId && String(s.subdomain || '').toLowerCase() === slug
        );
        if (collision) {
          return res.status(409).json({ error: `Subdomain "${slug}" is already in use.` });
        }
        store.subdomain = slug;
      }

      if (nextCategory !== undefined) {
        store.category = String(nextCategory).trim().slice(0, 128);
      }

      if (nextCurrency !== undefined) {
        const cur = String(nextCurrency).trim().slice(0, 32);
        if (!cur) return res.status(400).json({ error: 'Currency cannot be empty.' });
        store.currency = cur;
      }

      await d.MasterDB.saveMasterData(master);

      const tenantStore = await d.TenantDB.getStoreDb(tiwiId).catch(() => null);
      if (tenantStore) {
        if (nextName !== undefined) tenantStore.storeName = store.storeName;
        if (nextSubdomain !== undefined) tenantStore.subdomain = store.subdomain;
        if (nextCategory !== undefined) tenantStore.category = store.category;
        tenantStore.store_settings = {
          ...(tenantStore.store_settings || {}),
          ...(nextName !== undefined ? { storeName: store.storeName } : {}),
          ...(nextSubdomain !== undefined ? { subdomain: store.subdomain } : {}),
          ...(nextCurrency !== undefined ? { currency: store.currency } : {})
        };
        await d.TenantDB.saveStoreDb(tiwiId, tenantStore);
      }

      await d.queryPg(
        `UPDATE system_stores
         SET store_name = $2, subdomain = $3, category = $4, currency = $5
         WHERE tiwi_id = $1`,
        [tiwiId, store.storeName, store.subdomain, store.category || null, store.currency || 'USD']
      );

      await d.recordSecurityEvent({
        eventType: 'admin.store_updated',
        severity: 'info',
        userId: req.adminUser?.id || null,
        subject: tiwiId,
        details: { administrator: req.adminUser?.email, storeName: store.storeName, subdomain: store.subdomain }
      });

      return res.json({ success: true, message: 'Store details updated.', store });
    } catch (error) {
      console.error('[Admin Edit Store Error]', error.message);
      return res.status(500).json({ error: 'Failed to update store details.' });
    }
  });

  // POST /api/admin/stores/:tiwiId/plan - Upgrade/downgrade plan & slots
  router.post('/stores/:tiwiId/plan', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const tiwiId = String(req.params.tiwiId || '').trim();
      const master = await d.MasterDB.getMasterData();
      const { store } = findStoreInMaster(master, tiwiId);
      if (!store) return res.status(404).json({ error: 'Store not found.' });
      if (guardStoreOwnerAccess(req, res, master, store).blocked) return;

      const requestedPlanId = String(req.body?.planId || store.planId || 'free').trim().toLowerCase();
      if (!VALID_SUBSCRIPTION_PLANS.has(requestedPlanId)) {
        return res.status(400).json({ error: 'Unsupported subscription plan requested.' });
      }

      const pkg = await d.getEcommercePackageById(requestedPlanId);
      const planName = pkg?.planName || requestedPlanId;
      const planPrice = Number(pkg?.price ?? 0);
      const extraProductSlots = Math.max(0, Math.floor(Number(req.body?.extraProductSlots ?? 0) || 0));
      const extraStaffSlots = Math.max(0, Math.floor(Number(req.body?.extraStaffSlots ?? 0) || 0));
      const posAddon = req.body?.posAddon !== undefined ? Boolean(req.body.posAddon) : Boolean(pkg?.hasPos);

      if (req.body?.chargeWallet === true && planPrice > 0 && store.ownerId) {
        const charge = await d.BillingDB.chargeSubscriptionPlan(store.ownerId, planPrice, `${planName} (Admin Upgrade)`, {
          tiwiId,
          orderType: 'store_upgrade',
          planId: requestedPlanId
        });
        if (!charge?.success) {
          return res.status(charge?.statusCode || 402).json({ error: charge?.error || 'Insufficient user balance.' });
        }
      }

      const nowIso = new Date().toISOString();
      const lifecycleFields = d.syncStoreLifecycleOnPlanChange({
        tiwiId,
        planId: requestedPlanId,
        price: planPrice
      });

      Object.assign(store, {
        planId: requestedPlanId,
        planName,
        status: 'active',
        extraProductSlots,
        extraStaffSlots,
        posAddon,
        ...lifecycleFields
      });

      master.subscriptions = Array.isArray(master.subscriptions) ? master.subscriptions : [];
      const subPatch = {
        tiwiId,
        planId: requestedPlanId,
        planName,
        price: planPrice,
        productLimit: Number(pkg?.productLimit ?? 10),
        warehouseLimit: Number(pkg?.warehouseLimit ?? 1),
        staffLimit: Number(pkg?.staffLimit ?? 1),
        monthlyOrderLimit: Number(pkg?.monthlyOrderLimit ?? 50),
        hasPos: Boolean(pkg?.hasPos || posAddon),
        hasCustomDomain: Boolean(pkg?.hasCustomDomain),
        extraProductSlots,
        extraStaffSlots,
        posAddon,
        status: 'active',
        ...lifecycleFields,
        updatedAt: nowIso
      };
      const subIdx = master.subscriptions.findIndex((s) => String(s.tiwiId) === tiwiId);
      if (subIdx >= 0) {
        master.subscriptions[subIdx] = { ...master.subscriptions[subIdx], ...subPatch };
      } else {
        master.subscriptions.push(subPatch);
      }

      await d.MasterDB.saveMasterData(master);

      const tenantStore = await d.TenantDB.getStoreDb(tiwiId).catch(() => null);
      if (tenantStore) {
        tenantStore.planId = requestedPlanId;
        tenantStore.status = 'active';
        tenantStore.lifecycleStatus = lifecycleFields.lifecycleStatus;
        tenantStore.subscriptionStatus = lifecycleFields.subscriptionStatus;
        tenantStore.expiresAt = lifecycleFields.expiresAt;
        tenantStore.subscription = {
          ...(tenantStore.subscription || {}),
          ...subPatch
        };
        await d.TenantDB.saveStoreDb(tiwiId, tenantStore);
      }

      await d.queryPg('UPDATE system_stores SET plan_id = $2 WHERE tiwi_id = $1', [tiwiId, requestedPlanId]);

      await d.recordSecurityEvent({
        eventType: 'admin.store_plan_updated',
        severity: 'info',
        userId: req.adminUser?.id || null,
        subject: tiwiId,
        details: {
          administrator: req.adminUser?.email,
          planId: requestedPlanId,
          extraProductSlots,
          extraStaffSlots,
          posAddon,
          chargedWallet: Boolean(req.body?.chargeWallet)
        }
      });

      return res.json({
        success: true,
        message: `Store updated to ${planName}.`,
        store,
        subscription: subPatch
      });
    } catch (error) {
      console.error('[Admin Store Plan Error]', error.message);
      return res.status(500).json({ error: 'Failed to update store plan.' });
    }
  });

  // POST /api/admin/stores/:tiwiId/migrate-owner - Transfer store ownership safely
  router.post('/stores/:tiwiId/migrate-owner', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const tiwiId = String(req.params.tiwiId || '').trim();
      const targetEmail = String(req.body?.newOwnerEmail || req.body?.email || '').trim().toLowerCase();
      if (!targetEmail || !targetEmail.includes('@')) {
        return res.status(400).json({ error: 'A valid target user email is required.' });
      }

      const master = await d.MasterDB.getMasterData();
      const { store } = findStoreInMaster(master, tiwiId);
      if (!store) return res.status(404).json({ error: 'Store not found.' });
      if (guardStoreOwnerAccess(req, res, master, store).blocked) return;

      const targetUser = (master.users || []).find(
        (u) => String(u.email || '').trim().toLowerCase() === targetEmail
      );
      if (!targetUser) {
        return res.status(404).json({ error: `Target user "${targetEmail}" was not found.` });
      }
      if (targetUser.isBanned) {
        return res.status(409).json({ error: 'Cannot migrate store ownership to a banned account.' });
      }
      if (isSuperAdminAccount(targetUser) && !isSuperAdminRequester(req.adminUser)) {
        return res.status(403).json({ error: 'Only a super administrator can migrate ownership to that account.' });
      }

      const previousOwnerId = store.ownerId;
      store.ownerId = targetUser.id;
      await d.MasterDB.saveMasterData(master);

      const tenantStore = await d.TenantDB.getStoreDb(tiwiId).catch(() => null);
      if (tenantStore) {
        tenantStore.ownerId = targetUser.id;
        await d.TenantDB.saveStoreDb(tiwiId, tenantStore);
      }

      await d.queryPg('UPDATE system_stores SET owner_id = $2 WHERE tiwi_id = $1', [tiwiId, targetUser.id]);
      await d.queryPg('UPDATE system_custom_domains SET user_id = $2 WHERE tiwi_id = $1', [tiwiId, targetUser.id]);

      await d.recordSecurityEvent({
        eventType: 'admin.store_owner_migrated',
        severity: 'warning',
        userId: targetUser.id,
        subject: tiwiId,
        details: {
          administrator: req.adminUser?.email,
          previousOwnerId,
          newOwnerId: targetUser.id,
          newOwnerEmail: targetUser.email
        }
      });

      return res.json({
        success: true,
        message: `Store migrated to ${targetUser.email}.`,
        store
      });
    } catch (error) {
      console.error('[Admin Migrate Store Error]', error.message);
      return res.status(500).json({ error: 'Failed to migrate store ownership.' });
    }
  });

  // POST /api/admin/stores/:tiwiId/status - Suspend or reactivate store
  router.post('/stores/:tiwiId/status', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const tiwiId = String(req.params.tiwiId || '').trim();
      const nextStatus = String(req.body?.status || '').trim().toLowerCase();
      if (!['active', 'suspended'].includes(nextStatus)) {
        return res.status(400).json({ error: 'Status must be "active" or "suspended".' });
      }

      const master = await d.MasterDB.getMasterData();
      const { store } = findStoreInMaster(master, tiwiId);
      if (!store) return res.status(404).json({ error: 'Store not found.' });
      if (guardStoreOwnerAccess(req, res, master, store).blocked) return;

      const now = new Date();
      const nowIso = now.toISOString();
      const scheduledDeletionAt =
        nextStatus === 'suspended'
          ? new Date(now.getTime() + SUSPENSION_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString()
          : null;

      store.status = nextStatus;
      store.lifecycleStatus = nextStatus;
      store.subscriptionStatus = nextStatus;
      store.suspendedAt = nextStatus === 'suspended' ? nowIso : null;
      store.scheduledDeletionAt = scheduledDeletionAt;
      if (req.body?.reason) {
        store.statusReason = String(req.body.reason).trim().slice(0, 500);
      }

      const sub = (master.subscriptions || []).find((s) => String(s.tiwiId) === tiwiId);
      if (sub) {
        sub.status = nextStatus;
        sub.lifecycleStatus = nextStatus;
        sub.subscriptionStatus = nextStatus;
        sub.suspendedAt = store.suspendedAt;
        sub.scheduledDeletionAt = scheduledDeletionAt;
        sub.updatedAt = nowIso;
      }

      await d.MasterDB.saveMasterData(master);

      const tenantStore = await d.TenantDB.getStoreDb(tiwiId).catch(() => null);
      if (tenantStore) {
        tenantStore.status = nextStatus;
        tenantStore.lifecycleStatus = nextStatus;
        tenantStore.subscriptionStatus = nextStatus;
        if (tenantStore.subscription) {
          tenantStore.subscription.status = nextStatus;
          tenantStore.subscription.lifecycleStatus = nextStatus;
          tenantStore.subscription.suspendedAt = store.suspendedAt;
          tenantStore.subscription.scheduledDeletionAt = scheduledDeletionAt;
          tenantStore.subscription.updatedAt = nowIso;
        }
        await d.TenantDB.saveStoreDb(tiwiId, tenantStore);
      }

      await d.recordSecurityEvent({
        eventType: nextStatus === 'suspended' ? 'admin.store_suspended' : 'admin.store_reactivated',
        severity: nextStatus === 'suspended' ? 'warning' : 'info',
        userId: req.adminUser?.id || null,
        subject: tiwiId,
        details: { administrator: req.adminUser?.email, reason: store.statusReason || null }
      });

      return res.json({
        success: true,
        message: nextStatus === 'suspended' ? 'Store suspended.' : 'Store reactivated.',
        store
      });
    } catch (error) {
      console.error('[Admin Store Status Error]', error.message);
      return res.status(500).json({ error: 'Failed to update store status.' });
    }
  });

  // DELETE /api/admin/stores/:tiwiId - Permanently delete store (keeps user account intact)
  router.delete('/stores/:tiwiId', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const tiwiId = String(req.params.tiwiId || '').trim();
      const master = await d.MasterDB.getMasterData();
      const { store } = findStoreInMaster(master, tiwiId);
      if (!store) return res.status(404).json({ error: 'Store not found.' });
      if (guardStoreOwnerAccess(req, res, master, store).blocked) return;

      const tenantStore = await d.TenantDB.getStoreDb(tiwiId).catch(() => null);
      const otherStores = (master.stores || []).filter(
        (s) => String(s.ownerId) === String(store.ownerId) && String(s.tiwiId) !== tiwiId
      );

      await d.purgeStoreMediaAssets({
        tiwiId,
        ownerId: store.ownerId,
        tenantStore,
        allUserStores: otherStores,
        readStoreFn: (id) => d.TenantDB.getStoreDb(id)
      });

      const deleted = await d.MasterDB.deleteStoreForUser(store.ownerId, tiwiId);
      if (!deleted) {
        return res.status(404).json({ error: 'Store could not be deleted or was already removed.' });
      }

      await d.recordSecurityEvent({
        eventType: 'admin.store_deleted',
        severity: 'warning',
        userId: req.adminUser?.id || null,
        subject: tiwiId,
        details: {
          administrator: req.adminUser?.email,
          ownerId: store.ownerId,
          storeName: store.storeName
        }
      });

      return res.json({
        success: true,
        message: `Store "${store.storeName || tiwiId}" permanently deleted. Tiwlo account preserved.`
      });
    } catch (error) {
      console.error('[Admin Delete Store Error]', error.message);
      return res.status(500).json({ error: 'Failed to delete store permanently.' });
    }
  });

  // POST /api/admin/users/:id/credits - Adjust merchant cash or promotional credits
  router.post('/users/:id/credits', requireAdmin, requireRecentReauth, async (req, res) => {
    try {
      const targetUser = await d.MasterDB.findUserByIdentifier(req.params.id);
      if (!targetUser) return res.status(404).json({ error: 'Tiwlo account not found.' });

      if (isSuperAdminAccount(targetUser) && !isSuperAdminRequester(req.adminUser)) {
        return res.status(403).json({ error: 'Super Administrator balances cannot be modified here.' });
      }

      const creditType = String(req.body?.creditType || 'promo').trim().toLowerCase();
      if (!['cash', 'promo'].includes(creditType)) {
        return res.status(400).json({ error: 'creditType must be "cash" or "promo".' });
      }
      const operation = String(req.body?.operation || 'add').trim().toLowerCase();
      if (!['add', 'deduct', 'set'].includes(operation)) {
        return res.status(400).json({ error: 'operation must be "add", "deduct", or "set".' });
      }

      const rawAmount = Number(req.body?.amountUsd ?? req.body?.amount);
      if (!Number.isFinite(rawAmount) || (operation === 'set' ? rawAmount < 0 : rawAmount === 0)) {
        return res.status(400).json({ error: 'Enter a valid USD credit adjustment amount.' });
      }

      const delta = operation === 'deduct' ? -Math.abs(rawAmount) : operation === 'add' ? Math.abs(rawAmount) : rawAmount;
      const reason = String(req.body?.reason || 'Admin credit adjustment').trim().slice(0, 250);
      const validityDays = Math.max(1, Math.min(3650, Math.floor(Number(req.body?.validityDays || 30) || 30)));
      const newAcctId = `bill_${randomUUID().replace(/-/g, '')}`;

      // Ensure billing account exists
      await d.queryPg(
        `INSERT INTO cloud_billing_accounts (id, user_id, credits, monthly_spend, currency)
         VALUES ($1, $2, 0, 0, 'USD')
         ON CONFLICT (user_id) DO NOTHING`,
        [newAcctId, targetUser.id]
      );

      let updatedRow;
      if (creditType === 'cash') {
        const sql =
          operation === 'set'
            ? `UPDATE cloud_billing_accounts
               SET credits = GREATEST(0, $2::numeric), updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $1
               RETURNING credits, promotional_credits, promotional_expires_at`
            : `UPDATE cloud_billing_accounts
               SET credits = GREATEST(0, COALESCE(credits, 0) + $2::numeric), updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $1
               RETURNING credits, promotional_credits, promotional_expires_at`;
        const { rows } = await d.queryPg(sql, [targetUser.id, roundUsd(delta)]);
        updatedRow = rows[0];
      } else {
        const expiresAt = new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000).toISOString();
        const sql =
          operation === 'set'
            ? `UPDATE cloud_billing_accounts
               SET promotional_credits = GREATEST(0, $2::numeric),
                   promotional_expires_at = $3::timestamptz,
                   updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $1
               RETURNING credits, promotional_credits, promotional_expires_at`
            : `UPDATE cloud_billing_accounts
               SET promotional_credits = GREATEST(0, COALESCE(promotional_credits, 0) + $2::numeric),
                   promotional_expires_at = CASE WHEN $2::numeric > 0 THEN $3::timestamptz ELSE promotional_expires_at END,
                   updated_at = CURRENT_TIMESTAMP
               WHERE user_id = $1
               RETURNING credits, promotional_credits, promotional_expires_at`;
        const { rows } = await d.queryPg(sql, [targetUser.id, roundUsd(delta), expiresAt]);
        updatedRow = rows[0];

        if (delta > 0) {
          await d.recordPlatformBillingOrder({
            userId: targetUser.id,
            orderType: 'promo_grant',
            itemName: `Admin Promo Grant (${validityDays}d)`,
            grossAmountUsd: roundUsd(delta),
            cashCreditUsedUsd: 0,
            promoCreditUsedUsd: 0,
            netCashRevenueUsd: 0,
            provider: 'admin_promo',
            currency: 'USD',
            status: 'paid',
            metadata: { reason, administrator: req.adminUser?.email }
          });
        }
      }

      await d.recordSecurityEvent({
        eventType: 'admin.credits_adjusted',
        severity: 'warning',
        userId: targetUser.id,
        subject: targetUser.email,
        details: {
          administrator: req.adminUser?.email,
          creditType,
          operation,
          amountUsd: roundUsd(Math.abs(rawAmount)),
          reason
        }
      });

      return res.json({
        success: true,
        message: `Updated ${creditType} credits for ${targetUser.email}.`,
        balance: {
          cashBalance: roundUsd(updatedRow?.credits ?? 0),
          promoCreditBalance: roundUsd(updatedRow?.promotional_credits ?? 0),
          promotionalExpiresAt: updatedRow?.promotional_expires_at || null
        }
      });
    } catch (error) {
      console.error('[Admin Credit Adjust Error]', error.message);
      return res.status(500).json({ error: 'Failed to adjust user credits.' });
    }
  });

  // Expose helper for clean user resolution in tests
  router.resolveUserLookup = resolveUserLookup;
  return router;
}

export default createAdminPlatformOpsRouter;
