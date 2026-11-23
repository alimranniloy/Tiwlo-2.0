import { Platform } from 'react-native';
import { TIWLO_API_BASE } from './tiwloAuth';

export interface StoreProductRecord {
  id: string;
  name: string;
  sku?: string;
  category?: string;
  sellingPrice: number;
  buyingPrice?: number;
  stock: number;
  minStock?: number;
  description?: string;
  barcode?: string;
  image?: string;
}

export interface StoreCategoryRecord {
  id: string;
  name: string;
  description?: string;
  productCount?: number;
}

export interface StoreSaleRecord {
  id: string;
  invoiceNumber?: string;
  customerName?: string;
  customerPhone?: string;
  totalAmount?: number;
  paidAmount?: number;
  dueAmount?: number;
  status?: string;
  paymentStatus?: string;
  createdAt?: string;
}

export interface StoreCustomerRecord {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  totalDue?: number;
  ordersCount?: number;
}

export interface StoreSupplierRecord {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface StorePackageRecord {
  planId: string;
  planName: string;
  price: number;
  description?: string;
  productLimit?: number;
  warehouseLimit?: number;
  staffLimit?: number;
  monthlyOrderLimit?: number;
  hasCustomDomain?: boolean;
  hasPos?: boolean;
  enabled?: boolean;
}

export interface StoreAddonRecord {
  addonId: string;
  name: string;
  price: number;
  quantity?: number;
  type?: string;
  description?: string;
  enabled?: boolean;
}

export interface StoreSubscriptionRecord {
  planId: string;
  planName: string;
  price: number;
  billingCycle?: string;
  status?: string;
  subdomain?: string;
  productLimit: number;
  warehouseLimit: number;
  staffLimit: number;
  monthlyOrderLimit: number;
  hasPos: boolean;
  hasCustomDomain: boolean;
  usage?: {
    products?: number;
    staff?: number;
    monthlyOrders?: number;
  };
  nextBillingDate?: string;
}

export interface StoreSettingsRecord {
  storeName?: string;
  phone?: string;
  email?: string;
  address?: string;
  currency?: string;
  taxRate?: number;
  receiptFooter?: string;
}

export interface StoreFinanceSummary {
  totalRevenue?: number;
  totalSalesCount?: number;
  cashBalance?: number;
  totalExpenses?: number;
  totalReceivable?: number;
}

export interface StoreInventorySummary {
  totalProducts?: number;
  totalStockUnits?: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  valuationCost?: number;
}

function headers(token?: string, json = false): Record<string, string> {
  return {
    Accept: 'application/json',
    'X-Device-Platform': Platform.OS === 'ios' ? 'iOS' : 'Android',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function storeFetch<T>(
  path: string,
  options: {
    method?: string;
    token?: string;
    body?: unknown;
  } = {}
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${TIWLO_API_BASE}${path}`, {
      method: options.method || 'GET',
      headers: headers(options.token, options.body !== undefined),
      credentials: 'include',
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
      signal: controller.signal,
    });
    const text = await res.text();
    let parsed: Record<string, unknown> = {};
    if (text.trim()) {
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }
    if (!res.ok) {
      const errMsg =
        (typeof parsed.error === 'string' && parsed.error) ||
        (typeof parsed.message === 'string' && parsed.message) ||
        `Request failed (${res.status})`;
      const err = new Error(errMsg) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }
    return parsed as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function activateStoreContext(
  tiwiId: string,
  token?: string
): Promise<void> {
  if (!tiwiId || !token) return;
  await storeFetch('/stores/active', {
    method: 'POST',
    token,
    body: { tiwiId },
  });
}

export async function fetchStorePackages(token?: string): Promise<{
  packages: StorePackageRecord[];
  addons: StoreAddonRecord[];
}> {
  const data = await storeFetch<{
    packages?: StorePackageRecord[];
    addons?: StoreAddonRecord[];
  }>('/packages', { token });
  return {
    packages: Array.isArray(data.packages) ? data.packages : [],
    addons: Array.isArray(data.addons) ? data.addons : [],
  };
}

export async function fetchStoreSubscription(
  tiwiId: string,
  token?: string
): Promise<StoreSubscriptionRecord | null> {
  await activateStoreContext(tiwiId, token);
  return storeFetch<StoreSubscriptionRecord>('/subscription', { token });
}

export async function upgradeStorePlan(
  tiwiId: string,
  planId: string,
  token?: string
): Promise<{ subscription?: StoreSubscriptionRecord; message?: string }> {
  await activateStoreContext(tiwiId, token);
  return storeFetch('/subscription/upgrade', {
    method: 'POST',
    token,
    body: { planId, billingCycle: 'monthly' },
  });
}

export async function purchaseStoreAddon(
  tiwiId: string,
  addonId: string,
  token?: string
): Promise<{ subscription?: StoreSubscriptionRecord; message?: string }> {
  await activateStoreContext(tiwiId, token);
  return storeFetch('/subscription/addons/purchase', {
    method: 'POST',
    token,
    body: { addonId },
  });
}

export async function fetchStoreAdminSnapshot(tiwiId: string, token?: string) {
  await activateStoreContext(tiwiId, token);
  const [
    productsRes,
    categoriesRes,
    salesRes,
    customersRes,
    suppliersRes,
    financeRes,
    inventoryRes,
    subscriptionRes,
    settingsRes,
  ] = await Promise.allSettled([
    storeFetch<StoreProductRecord[] | { products?: StoreProductRecord[] }>('/products', { token }),
    storeFetch<StoreCategoryRecord[] | { categories?: StoreCategoryRecord[] }>('/categories', { token }),
    storeFetch<StoreSaleRecord[] | { sales?: StoreSaleRecord[] }>('/sales', { token }),
    storeFetch<StoreCustomerRecord[] | { customers?: StoreCustomerRecord[] }>('/customers', { token }),
    storeFetch<StoreSupplierRecord[] | { suppliers?: StoreSupplierRecord[] }>('/suppliers', { token }),
    storeFetch<StoreFinanceSummary>('/finance/summary', { token }),
    storeFetch<StoreInventorySummary>('/inventory/summary', { token }),
    storeFetch<StoreSubscriptionRecord>('/subscription', { token }),
    storeFetch<StoreSettingsRecord>('/store/settings', { token }),
  ]);

  const unwrapArray = <T,>(
    res: PromiseSettledResult<T[] | Record<string, unknown>>,
    key: string
  ): T[] => {
    if (res.status !== 'fulfilled' || !res.value) return [];
    if (Array.isArray(res.value)) return res.value;
    const nested = (res.value as Record<string, unknown>)[key];
    return Array.isArray(nested) ? (nested as T[]) : [];
  };

  return {
    products: unwrapArray<StoreProductRecord>(productsRes, 'products'),
    categories: unwrapArray<StoreCategoryRecord>(categoriesRes, 'categories'),
    sales: unwrapArray<StoreSaleRecord>(salesRes, 'sales'),
    customers: unwrapArray<StoreCustomerRecord>(customersRes, 'customers'),
    suppliers: unwrapArray<StoreSupplierRecord>(suppliersRes, 'suppliers'),
    finance: financeRes.status === 'fulfilled' ? financeRes.value : {},
    inventory: inventoryRes.status === 'fulfilled' ? inventoryRes.value : {},
    subscription: subscriptionRes.status === 'fulfilled' ? subscriptionRes.value : null,
    settings: settingsRes.status === 'fulfilled' ? settingsRes.value : {},
  };
}

export async function createStoreProduct(
  tiwiId: string,
  payload: {
    name: string;
    sku?: string;
    category?: string;
    sellingPrice: number;
    buyingPrice?: number;
    stock: number;
    minStock?: number;
    description?: string;
  },
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch('/products', { method: 'POST', token, body: payload });
}

export async function updateStoreProduct(
  tiwiId: string,
  productId: string,
  payload: Partial<StoreProductRecord>,
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch(`/products/${encodeURIComponent(productId)}`, {
    method: 'PUT',
    token,
    body: payload,
  });
}

export async function deleteStoreProduct(
  tiwiId: string,
  productId: string,
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch(`/products/${encodeURIComponent(productId)}`, {
    method: 'DELETE',
    token,
  });
}

export async function createStoreCategory(
  tiwiId: string,
  name: string,
  description: string,
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch('/categories', {
    method: 'POST',
    token,
    body: { name, description },
  });
}

export async function deleteStoreCategory(
  tiwiId: string,
  categoryId: string,
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch(`/categories/${encodeURIComponent(categoryId)}`, {
    method: 'DELETE',
    token,
  });
}

export async function adjustStoreInventory(
  tiwiId: string,
  payload: { productId: string; quantityChange: number; reason: string },
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch('/inventory/adjustments', {
    method: 'POST',
    token,
    body: payload,
  });
}

export async function updateStoreOrderStatus(
  tiwiId: string,
  saleId: string,
  status: string,
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch(`/sales/${encodeURIComponent(saleId)}`, {
    method: 'PATCH',
    token,
    body: { status },
  });
}

export async function recordStoreSalePayment(
  tiwiId: string,
  saleId: string,
  amount: number,
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch(`/sales/${encodeURIComponent(saleId)}/payments`, {
    method: 'POST',
    token,
    body: { amount, method: 'cash' },
  });
}

export async function createStoreCustomer(
  tiwiId: string,
  payload: { name: string; phone?: string; email?: string; address?: string },
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch('/customers', { method: 'POST', token, body: payload });
}

export async function createStoreSupplier(
  tiwiId: string,
  payload: { name: string; phone?: string; email?: string; address?: string },
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch('/suppliers', { method: 'POST', token, body: payload });
}

export async function saveStoreSettings(
  tiwiId: string,
  payload: StoreSettingsRecord,
  token?: string
) {
  await activateStoreContext(tiwiId, token);
  return storeFetch('/store/settings', { method: 'PUT', token, body: payload });
}
