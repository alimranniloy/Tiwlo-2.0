import { AsyncLocalStorage } from 'node:async_hooks';
import { MasterDB, TenantDB } from './multiTenant.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';
import { RESERVED_STORE_SUBDOMAIN_LABELS } from './storeSubdomain.js';

// Request-local tenant identity.  This prevents the data adapter from falling
// back to the first store when a route omits an explicit tiwiId.
export const tenantContext = new AsyncLocalStorage();

export const PRODUCTS_FILE = 'products';
export const CATEGORIES_FILE = 'categories';
export const SUBCATEGORIES_FILE = 'subcategories';
export const PURCHASES_FILE = 'purchases';
export const SALES_FILE = 'sales';
export const CUSTOMERS_FILE = 'customers';
export const SUPPLIERS_FILE = 'suppliers';
export const ADJUSTMENTS_FILE = 'inventory_adjustments';
export const STORE_SETTINGS_FILE = 'store_settings';
export const SUBSCRIPTION_FILE = 'subscription';
export const ACTIVITIES_FILE = 'activities';
export const USERS_FILE = 'users';

export function getActiveTiwiId(req) {
  if (!req) return null;
  if (req.activeStore?.tiwiId) return req.activeStore.tiwiId;
  if (req.activeUser && (req.activeUser.tiwiId || req.activeUser.storeId)) {
    return req.activeUser.tiwiId || req.activeUser.storeId;
  }
  return null;
}

export async function resolveActiveStore(req, selectedTiwiId, masterDb = MasterDB) {
  if (!req?.activeUser || !selectedTiwiId) return null;
  const accountTiwiId = req.activeUser.tiwiId || req.activeUser.storeId;
  if (accountTiwiId && String(accountTiwiId) === String(selectedTiwiId)) {
    return {
      tiwiId: accountTiwiId,
      storeName: req.activeUser.storeName || req.activeUser.name || 'Your Store',
      subdomain: req.activeUser.subdomain || '',
      currency: req.activeUser.currency || ''
    };
  }
  const stores = await masterDb.getUserStores(req.activeUser.id || accountTiwiId);
  return stores.find(store =>
    String(store.tiwiId) === String(selectedTiwiId) &&
    String(store.ownerId) === String(req.activeUser.id) &&
    !['suspended', 'inactive', 'deleted'].includes(String(store.status || '').toLowerCase())
  ) || null;
}

export async function resolveStorefrontHost(hostname, masterDb = MasterDB) {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  const domain = PLATFORM_CONFIG.storeDomain;
  const suffix = `.${domain}`;
  if (!host.endsWith(suffix)) return null;

  const label = host.slice(0, -suffix.length);
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) return null;
  if (RESERVED_STORE_SUBDOMAIN_LABELS.includes(label)) return null;

  const directory = await masterDb.getMasterData();
  const bannedOwners = new Set((directory.users || [])
    .filter(user => user.isBanned)
    .flatMap(user => [user.id, user.tiwiId, user.storeId])
    .filter(Boolean)
    .map(String));
  const candidates = [
    ...(directory.stores || []).filter(store =>
      !bannedOwners.has(String(store.ownerId)) &&
      !['suspended', 'inactive', 'deleted'].includes(String(store.status || '').toLowerCase())
    ),
    ...(directory.users || []).filter(user => !user.isBanned)
  ];
  const matches = candidates.filter(store => {
    const subdomain = String(store.subdomain || '').trim().toLowerCase().replace(/\.$/, '');
    const canonicalSubdomain = subdomain.includes('.') ? subdomain : `${subdomain}.${domain}`;
    return canonicalSubdomain === host && (store.tiwiId || store.storeId);
  });
  const tenantIds = new Set(matches.map(store => String(store.tiwiId || store.storeId)));
  if (tenantIds.size !== 1) return null;

  const match = matches[0];
  return {
    tiwiId: match.tiwiId || match.storeId,
    storeName: match.storeName || match.name || 'Your Store',
    subdomain: host,
    currency: match.currency || ''
  };
}

async function requestStore(tiwiId) {
  const context = tenantContext.getStore();
  if (!context) throw new Error('Tenant data access requires a request context.');
  context.snapshots ||= new Map();
  if (!context.snapshots.has(tiwiId)) context.snapshots.set(tiwiId, await TenantDB.getStoreDb(tiwiId));
  return context.snapshots.get(tiwiId);
}

const collections = new Set(['products', 'categories', 'subcategories', 'purchases', 'sales', 'customers', 'suppliers', 'inventory_adjustments', 'store_settings', 'subscription', 'activities']);
export async function readData(collection, defaultVal = [], tiwiId = null) {
  const target = tiwiId || tenantContext.getStore()?.tiwiId;
  if (collection === 'users') return MasterDB.getUsers();
  if (!target) return defaultVal;
  if (!collections.has(collection)) throw new Error('Unknown tenant collection.');
  return (await requestStore(target))[collection] ?? defaultVal;
}

export async function writeData(collection, data, tiwiId = null) {
  const target = tiwiId || tenantContext.getStore()?.tiwiId;
  if (!target || !collections.has(collection)) throw new Error('A tenant and valid collection are required.');
  const store = await requestStore(target);
  store[collection] = data;
  await TenantDB.saveStoreDb(target, store);
}

export async function writeTenantData(entries, tiwiId = null) {
  const target = tiwiId || tenantContext.getStore()?.tiwiId;
  if (!target || !entries || typeof entries !== 'object' || Array.isArray(entries)) {
    throw new Error('A tenant and valid collection updates are required.');
  }
  const invalidCollection = Object.keys(entries).find(collection => !collections.has(collection));
  if (invalidCollection) throw new Error('Unknown tenant collection.');
  const store = await requestStore(target);
  Object.assign(store, entries);
  await TenantDB.saveStoreDb(target, store);
}

export async function logActivity(type, title, subtitle, tiwiId = null) {
  const target = tiwiId || tenantContext.getStore()?.tiwiId;
  if (!target) return null;
  const entry = await TenantDB.logActivity(target, type, title, subtitle);
  // Activity writes advance the tenant snapshot; subsequent reads must refresh.
  tenantContext.getStore()?.snapshots?.delete(target);
  return entry;
}
