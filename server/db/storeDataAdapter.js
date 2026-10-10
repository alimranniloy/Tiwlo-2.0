import { AsyncLocalStorage } from 'node:async_hooks';
import { MasterDB, TenantDB } from './multiTenant.js';

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
export const SESSIONS_FILE = 'sessions';

export function getActiveTiwiId(req) {
  if (!req) return null;
  // Never let a client-selected header/query/body tenant override the tenant
  // resolved from its verified session.
  if (req.activeUser && (req.activeUser.tiwiId || req.activeUser.storeId)) {
    return req.activeUser.tiwiId || req.activeUser.storeId;
  }
  return null;
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
  if (collection === 'sessions') return (await MasterDB.getMasterData()).sessions;
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

export async function logActivity(type, title, subtitle, tiwiId = null) {
  const target = tiwiId || tenantContext.getStore()?.tiwiId;
  if (!target) return null;
  const entry = await TenantDB.logActivity(target, type, title, subtitle);
  // Activity writes advance the tenant snapshot; subsequent reads must refresh.
  tenantContext.getStore()?.snapshots?.delete(target);
  return entry;
}
