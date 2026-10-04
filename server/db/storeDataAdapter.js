import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import { MasterDB, TenantDB } from './multiTenant.js';

// Request-local tenant identity.  This prevents the data adapter from falling
// back to the first store when a route omits an explicit tiwiId.
export const tenantContext = new AsyncLocalStorage();

export const PRODUCTS_FILE = 'products.json';
export const CATEGORIES_FILE = 'categories.json';
export const SUBCATEGORIES_FILE = 'subcategories.json';
export const PURCHASES_FILE = 'purchases.json';
export const SALES_FILE = 'sales.json';
export const CUSTOMERS_FILE = 'customers.json';
export const SUPPLIERS_FILE = 'suppliers.json';
export const ADJUSTMENTS_FILE = 'inventory_adjustments.json';
export const SETTINGS_FILE = 'system_settings.json';
export const STORE_SETTINGS_FILE = 'store_settings.json';
export const SUBSCRIPTION_FILE = 'subscription.json';
export const ACTIVITIES_FILE = 'activities.json';
export const USERS_FILE = 'users.json';
export const SESSIONS_FILE = 'sessions.json';

export function getActiveTiwiId(req) {
  if (!req) return null;
  // Never let a client-selected header/query/body tenant override the tenant
  // resolved from its verified session.
  if (req.activeUser && (req.activeUser.tiwiId || req.activeUser.storeId)) {
    return req.activeUser.tiwiId || req.activeUser.storeId;
  }
  if (req.headers && req.headers['x-tiwi-id']) return req.headers['x-tiwi-id'];
  if (req.query && req.query.tiwiId) return req.query.tiwiId;
  if (req.body && req.body.tiwiId) return req.body.tiwiId;
  return null;
}

export function readData(filePath, defaultVal = [], tiwiId = null) {
  const base = path.basename(filePath);
  const master = MasterDB.getMasterData();
  const targetTiwiId = tiwiId || tenantContext.getStore()?.tiwiId || null;

  if (base === 'users.json') return master.users || defaultVal;
  if (base === 'sessions.json') return master.sessions || defaultVal;
  if (base === 'system_settings.json') return master.system_settings || defaultVal;

  if (!targetTiwiId) return defaultVal;

  const store = TenantDB.getStoreDb(targetTiwiId);
  if (base === 'products.json') return store.products || defaultVal;
  if (base === 'categories.json') return store.categories || defaultVal;
  if (base === 'subcategories.json') return store.subcategories || defaultVal;
  if (base === 'customers.json') return store.customers || defaultVal;
  if (base === 'suppliers.json') return store.suppliers || defaultVal;
  if (base === 'purchases.json') return store.purchases || defaultVal;
  if (base === 'sales.json') return store.sales || defaultVal;
  if (base === 'inventory_adjustments.json') return store.inventory_adjustments || defaultVal;
  if (base === 'activities.json') return store.activities || defaultVal;
  if (base === 'store_settings.json') return store.store_settings || defaultVal;
  if (base === 'subscription.json') return store.subscription || defaultVal;

  return defaultVal;
}

export function writeData(filePath, data, tiwiId = null) {
  const base = path.basename(filePath);
  const master = MasterDB.getMasterData();
  const targetTiwiId = tiwiId || tenantContext.getStore()?.tiwiId || null;
  const store = targetTiwiId ? TenantDB.getStoreDb(targetTiwiId) : null;

  if (base === 'users.json') {
    master.users = data;
    MasterDB.saveMasterData(master);
    return;
  }
  if (base === 'sessions.json') {
    master.sessions = data;
    MasterDB.saveMasterData(master);
    return;
  }
  if (base === 'system_settings.json') {
    master.system_settings = data;
    MasterDB.saveMasterData(master);
    return;
  }

  if (!store) return;

  if (base === 'products.json') store.products = data;
  else if (base === 'categories.json') store.categories = data;
  else if (base === 'subcategories.json') store.subcategories = data;
  else if (base === 'customers.json') store.customers = data;
  else if (base === 'suppliers.json') store.suppliers = data;
  else if (base === 'purchases.json') store.purchases = data;
  else if (base === 'sales.json') store.sales = data;
  else if (base === 'inventory_adjustments.json') store.inventory_adjustments = data;
  else if (base === 'activities.json') store.activities = data;
  else if (base === 'store_settings.json') store.store_settings = data;
  else if (base === 'subscription.json') store.subscription = data;

  TenantDB.saveStoreDb(targetTiwiId, store);
}

export function logActivity(type, title, subtitle, tiwiId = null) {
  tiwiId = tiwiId || tenantContext.getStore()?.tiwiId || null;
  if (!tiwiId) return { id: `act-${Date.now()}`, type, title, subtitle, time: 'Just now' };
  TenantDB.logActivity(tiwiId, type, title, subtitle);
  return { id: `act-${Date.now()}`, type, title, subtitle, time: 'Just now' };
}
