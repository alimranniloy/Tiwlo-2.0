import { queryPg, isPgActive } from './postgres.js';

export const DEFAULT_ECOMMERCE_PACKAGES = [
  {
    planId: 'free',
    planName: 'Free Starter',
    badge: 'Free Forever',
    description: 'Ideal for independent store owners testing online retail & local stock management.',
    price: 0,
    productLimit: 50,
    warehouseLimit: 1,
    hasCustomDomain: false,
    enabled: true,
    features: [
      'Up to 50 Products',
      '1 Warehouse Location',
      'Free *.tiwlo.com Subdomain',
      'Standard POS & Inventory Tracking'
    ]
  },
  {
    planId: 'growth',
    planName: 'Growth Retailer',
    badge: 'Popular',
    description: 'For growing retail brands needing higher inventory limits and a custom domain.',
    price: 19,
    productLimit: 500,
    warehouseLimit: 2,
    hasCustomDomain: true,
    enabled: true,
    features: [
      'Up to 500 Products',
      '2 Warehouse Locations',
      'Custom Domain Support',
      'Automated WhatsApp Alerts'
    ]
  },
  {
    planId: 'pro',
    planName: 'Pro Business',
    badge: 'Best Value',
    description: 'Built for multi-branch e-commerce operations with high product volume.',
    price: 49,
    productLimit: 5000,
    warehouseLimit: 5,
    hasCustomDomain: true,
    enabled: true,
    features: [
      'Up to 5,000 Products',
      '5 Warehouse Locations',
      'Custom Domain & SSL',
      'Priority Support & Analytics'
    ]
  },
  {
    planId: 'enterprise',
    planName: 'Enterprise VIP',
    badge: 'Unlimited',
    description: 'Full-scale infrastructure for high-volume merchants and enterprise teams.',
    price: 129,
    productLimit: 999999,
    warehouseLimit: 99,
    hasCustomDomain: true,
    enabled: true,
    features: [
      'Unlimited Products',
      '99 Warehouse Locations',
      'Custom Domain & Dedicated Routing',
      'Dedicated Account Management'
    ]
  }
];

function normalizePackage(pkg, fallback = {}) {
  const planId = String(pkg?.planId || fallback.planId || '').trim().toLowerCase();
  if (!planId) return null;
  const parsedPrice = Number(pkg?.price ?? fallback.price ?? 0);
  const parsedProducts = Number(pkg?.productLimit ?? fallback.productLimit ?? 50);
  const parsedWarehouses = Number(pkg?.warehouseLimit ?? fallback.warehouseLimit ?? 1);
  return {
    planId,
    planName: String(pkg?.planName || fallback.planName || planId).trim(),
    badge: String(pkg?.badge ?? fallback.badge ?? '').trim(),
    description: String(pkg?.description ?? fallback.description ?? '').trim(),
    price: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? Number(parsedPrice.toFixed(2)) : 0,
    productLimit: Number.isFinite(parsedProducts) && parsedProducts >= 1 ? Math.round(parsedProducts) : 50,
    warehouseLimit: Number.isFinite(parsedWarehouses) && parsedWarehouses >= 1 ? Math.round(parsedWarehouses) : 1,
    hasCustomDomain: pkg?.hasCustomDomain !== undefined ? Boolean(pkg.hasCustomDomain) : Boolean(fallback.hasCustomDomain),
    enabled: pkg?.enabled !== undefined ? Boolean(pkg.enabled) : (fallback.enabled !== undefined ? Boolean(fallback.enabled) : true),
    features: Array.isArray(pkg?.features)
      ? pkg.features.map((f) => String(f || '').trim()).filter(Boolean)
      : (Array.isArray(fallback.features) ? fallback.features : [])
  };
}

export async function getEcommercePackages() {
  if (!isPgActive()) {
    return DEFAULT_ECOMMERCE_PACKAGES.map((pkg) => ({ ...pkg, features: [...pkg.features] }));
  }
  try {
    const res = await queryPg(
      `SELECT settings FROM system_settings WHERE setting_key = 'ecommerce_packages' LIMIT 1`
    );
    const saved = res.rows?.[0]?.settings?.packages;
    if (!Array.isArray(saved) || saved.length === 0) {
      return DEFAULT_ECOMMERCE_PACKAGES.map((pkg) => ({ ...pkg, features: [...pkg.features] }));
    }
    const defaultsById = new Map(DEFAULT_ECOMMERCE_PACKAGES.map((p) => [p.planId, p]));
    const normalized = saved
      .map((item) => normalizePackage(item, defaultsById.get(String(item?.planId || '').toLowerCase())))
      .filter(Boolean);
    return normalized.length > 0
      ? normalized
      : DEFAULT_ECOMMERCE_PACKAGES.map((pkg) => ({ ...pkg, features: [...pkg.features] }));
  } catch {
    return DEFAULT_ECOMMERCE_PACKAGES.map((pkg) => ({ ...pkg, features: [...pkg.features] }));
  }
}

export async function saveEcommercePackages(packages) {
  if (!Array.isArray(packages) || packages.length === 0) {
    throw new Error('At least one e-commerce package is required.');
  }
  const defaultsById = new Map(DEFAULT_ECOMMERCE_PACKAGES.map((p) => [p.planId, p]));
  const normalized = packages
    .map((item) => normalizePackage(item, defaultsById.get(String(item?.planId || '').toLowerCase())))
    .filter(Boolean);
  if (normalized.length === 0) {
    throw new Error('No valid e-commerce packages provided.');
  }
  await queryPg(
    `INSERT INTO system_settings (setting_key, settings, updated_at)
     VALUES ('ecommerce_packages', $1::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (setting_key)
     DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP`,
    [JSON.stringify({ packages: normalized })]
  );
  return normalized;
}

export async function getEcommercePackageById(planId) {
  const target = String(planId || '').trim().toLowerCase();
  const packages = await getEcommercePackages();
  return packages.find((pkg) => pkg.planId === target) || null;
}
