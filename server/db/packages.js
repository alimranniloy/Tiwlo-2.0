import { queryPg, isPgActive } from './postgres.js';

export const DEFAULT_ECOMMERCE_PACKAGES = [
  {
    planId: 'free',
    planName: 'Free Starter',
    badge: 'Free Forever',
    description: 'Ideal for independent store owners testing online retail & local stock management.',
    price: 0,
    productLimit: 10,
    warehouseLimit: 1,
    staffLimit: 1,
    monthlyOrderLimit: 50,
    hasPos: false,
    hasCustomDomain: false,
    enabled: true,
    features: [
      'Up to 10 Products',
      '1 Warehouse Location',
      '1 Staff Seat',
      'Up to 50 Monthly Orders',
      'Free *.tiwlo.com Subdomain'
    ]
  },
  {
    planId: 'growth',
    planName: 'Growth Retailer',
    badge: 'Popular',
    description: 'For growing retail brands needing higher inventory limits, POS, and a custom domain.',
    price: 19,
    productLimit: 150,
    warehouseLimit: 2,
    staffLimit: 3,
    monthlyOrderLimit: 1000,
    hasPos: true,
    hasCustomDomain: true,
    enabled: true,
    features: [
      'Up to 150 Products',
      '2 Warehouse Locations',
      '3 Staff Seats',
      'Up to 1,000 Monthly Orders',
      'POS System & Custom Domain'
    ]
  },
  {
    planId: 'pro',
    planName: 'Pro Business',
    badge: 'Best Value',
    description: 'Built for multi-branch e-commerce operations with high product and order volume.',
    price: 49,
    productLimit: 1000,
    warehouseLimit: 5,
    staffLimit: 10,
    monthlyOrderLimit: 5000,
    hasPos: true,
    hasCustomDomain: true,
    enabled: true,
    features: [
      'Up to 1,000 Products',
      '5 Warehouse Locations',
      '10 Staff Seats',
      'Up to 5,000 Monthly Orders',
      'POS System, Custom Domain & SSL'
    ]
  },
  {
    planId: 'enterprise',
    planName: 'Enterprise VIP',
    badge: 'Scale',
    description: 'Full-scale infrastructure for high-volume merchants and enterprise teams.',
    price: 129,
    productLimit: 10000,
    warehouseLimit: 25,
    staffLimit: 50,
    monthlyOrderLimit: 50000,
    hasPos: true,
    hasCustomDomain: true,
    enabled: true,
    features: [
      'Up to 10,000 Products',
      '25 Warehouse Locations',
      '50 Staff Seats',
      'Up to 50,000 Monthly Orders',
      'POS System & Dedicated Routing'
    ]
  }
];

export const DEFAULT_ECOMMERCE_ADDONS = [
  {
    addonId: 'extra_products_25',
    name: '+25 Product Slots',
    description: 'Add 25 extra product slots to your active store.',
    price: 5,
    type: 'product_slots',
    quantity: 25,
    enabled: true
  },
  {
    addonId: 'extra_products_100',
    name: '+100 Product Slots',
    description: 'Add 100 extra product slots to your active store.',
    price: 12,
    type: 'product_slots',
    quantity: 100,
    enabled: true
  },
  {
    addonId: 'pos_access',
    name: 'POS System Access',
    description: 'Unlock in-store Point of Sale terminal and cashbook.',
    price: 9,
    type: 'feature_pos',
    quantity: 1,
    enabled: true
  },
  {
    addonId: 'extra_staff_3',
    name: '+3 Staff Seats',
    description: 'Add 3 extra staff & payroll seats.',
    price: 6,
    type: 'staff_slots',
    quantity: 3,
    enabled: true
  }
];

export const DEFAULT_DISCORD_PACKAGES = [
  {
    planId: 'discord_starter',
    planName: 'Discord Starter',
    badge: 'Starter',
    description: 'Connect the Official Tiwlo AI Bot to your primary Discord community with auto-moderation.',
    price: 9,
    maxBots: 1,
    maxServersPerBot: 1,
    monthlyCommandsLimit: 2500,
    autoModEnabled: true,
    webhookLimit: 2,
    customBranding: false,
    enabled: true,
    features: [
      'Official Tiwlo AI Bot Access',
      '1 Connected Discord Server',
      '2,500 Monthly AI Commands',
      'Auto-Moderation & Welcome Flows',
      '2 Webhooks Included'
    ]
  },
  {
    planId: 'discord_pro',
    planName: 'Discord Pro',
    badge: 'Popular',
    description: 'Multi-server AI persona routing, custom slash commands, and higher monthly command quotas.',
    price: 24,
    maxBots: 2,
    maxServersPerBot: 5,
    monthlyCommandsLimit: 15000,
    autoModEnabled: true,
    webhookLimit: 10,
    customBranding: true,
    enabled: true,
    features: [
      'Official Tiwlo AI Bot Access',
      'Up to 5 Discord Servers',
      '15,000 Monthly AI Commands',
      'Custom AI Persona & Branding',
      '10 Webhooks Included'
    ]
  },
  {
    planId: 'discord_scale',
    planName: 'Discord Scale',
    badge: 'Scale',
    description: 'High-throughput Discord AI automation for creator networks, support hubs, and large communities.',
    price: 59,
    maxBots: 5,
    maxServersPerBot: 20,
    monthlyCommandsLimit: 75000,
    autoModEnabled: true,
    webhookLimit: 50,
    customBranding: true,
    enabled: true,
    features: [
      'Official Tiwlo AI Bot Priority Fleet',
      'Up to 20 Discord Servers',
      '75,000 Monthly AI Commands',
      'Full Auto-Mod & Raid Shield',
      '50 Webhooks & Custom Branding'
    ]
  }
];

export const DEFAULT_WHATSAPP_PACKAGES = [
  {
    planId: 'wa_starter',
    planName: 'WhatsApp Starter',
    badge: 'Starter',
    description: 'Link 1 WhatsApp Business number with Tiwi 2.0 AI sales & support auto-replies.',
    price: 12,
    maxSessions: 1,
    monthlyMessagesLimit: 2000,
    dailyBroadcastLimit: 100,
    autoReplyFlowsLimit: 3,
    contactLimit: 1000,
    webhookEnabled: false,
    enabled: true,
    features: [
      '1 WhatsApp Business Session',
      '2,000 Monthly Messages',
      '100 Daily Broadcast Cap',
      '3 Auto-Reply Flows',
      'Up to 1,000 Contacts'
    ]
  },
  {
    planId: 'wa_business',
    planName: 'WhatsApp Business',
    badge: 'Popular',
    description: 'Multi-number AI store assistant with catalog sync, webhooks, and higher daily broadcast caps.',
    price: 29,
    maxSessions: 3,
    monthlyMessagesLimit: 15000,
    dailyBroadcastLimit: 500,
    autoReplyFlowsLimit: 15,
    contactLimit: 10000,
    webhookEnabled: true,
    enabled: true,
    features: [
      'Up to 3 WhatsApp Sessions',
      '15,000 Monthly Messages',
      '500 Daily Broadcast Cap',
      '15 Auto-Reply Flows',
      'Up to 10,000 Contacts & Webhooks'
    ]
  },
  {
    planId: 'wa_enterprise',
    planName: 'WhatsApp Enterprise',
    badge: 'Scale',
    description: 'High-volume multi-store WhatsApp automation with maximum throughput and webhook pipelines.',
    price: 69,
    maxSessions: 10,
    monthlyMessagesLimit: 75000,
    dailyBroadcastLimit: 2500,
    autoReplyFlowsLimit: 50,
    contactLimit: 50000,
    webhookEnabled: true,
    enabled: true,
    features: [
      'Up to 10 WhatsApp Sessions',
      '75,000 Monthly Messages',
      '2,500 Daily Broadcast Cap',
      '50 Auto-Reply Flows',
      '50,000 Contacts & Webhooks'
    ]
  }
];

const SUPPORTED_ADDON_TYPES = new Set(['product_slots', 'staff_slots', 'feature_pos']);

function cloneDefaultPackages() {
  return DEFAULT_ECOMMERCE_PACKAGES.map((pkg) => ({ ...pkg, features: [...pkg.features] }));
}

function cloneDefaultAddons() {
  return DEFAULT_ECOMMERCE_ADDONS.map((addon) => ({ ...addon }));
}

function cloneDefaultDiscordPackages() {
  return DEFAULT_DISCORD_PACKAGES.map((pkg) => ({ ...pkg, features: [...pkg.features] }));
}

function cloneDefaultWhatsappPackages() {
  return DEFAULT_WHATSAPP_PACKAGES.map((pkg) => ({ ...pkg, features: [...pkg.features] }));
}

function normalizePositiveInt(value, fallback) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.round(parsed) : fallback;
}

function normalizePaidPrice(value, fallbackPrice = 9) {
  const parsed = Number(value ?? fallbackPrice);
  const safeFallback = Number(fallbackPrice) > 0 ? Number(fallbackPrice) : 9;
  return Number.isFinite(parsed) && parsed >= 1 ? Number(parsed.toFixed(2)) : safeFallback;
}

function normalizePackage(pkg, fallback = {}) {
  const planId = String(pkg?.planId || fallback.planId || '').trim().toLowerCase();
  if (!planId) return null;
  const parsedPrice = Number(pkg?.price ?? fallback.price ?? 0);
  return {
    planId,
    planName: String(pkg?.planName || fallback.planName || planId).trim(),
    badge: String(pkg?.badge ?? fallback.badge ?? '').trim(),
    description: String(pkg?.description ?? fallback.description ?? '').trim(),
    price: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? Number(parsedPrice.toFixed(2)) : 0,
    productLimit: normalizePositiveInt(pkg?.productLimit, fallback.productLimit ?? 10),
    warehouseLimit: normalizePositiveInt(pkg?.warehouseLimit, fallback.warehouseLimit ?? 1),
    staffLimit: normalizePositiveInt(pkg?.staffLimit, fallback.staffLimit ?? 1),
    monthlyOrderLimit: normalizePositiveInt(pkg?.monthlyOrderLimit, fallback.monthlyOrderLimit ?? 50),
    hasPos: pkg?.hasPos !== undefined ? Boolean(pkg.hasPos) : Boolean(fallback.hasPos),
    hasCustomDomain: pkg?.hasCustomDomain !== undefined ? Boolean(pkg.hasCustomDomain) : Boolean(fallback.hasCustomDomain),
    enabled: pkg?.enabled !== undefined ? Boolean(pkg.enabled) : (fallback.enabled !== undefined ? Boolean(fallback.enabled) : true),
    features: Array.isArray(pkg?.features)
      ? pkg.features.map((f) => String(f || '').trim()).filter(Boolean)
      : (Array.isArray(fallback.features) ? [...fallback.features] : [])
  };
}

function normalizeDiscordPackage(pkg, fallback = {}) {
  const planId = String(pkg?.planId || fallback.planId || '').trim().toLowerCase();
  if (!planId) return null;
  return {
    planId,
    planName: String(pkg?.planName || fallback.planName || planId).trim(),
    badge: String(pkg?.badge ?? fallback.badge ?? '').trim(),
    description: String(pkg?.description ?? fallback.description ?? '').trim(),
    price: normalizePaidPrice(pkg?.price, fallback.price ?? 9),
    maxBots: normalizePositiveInt(pkg?.maxBots, fallback.maxBots ?? 1),
    maxServersPerBot: normalizePositiveInt(pkg?.maxServersPerBot, fallback.maxServersPerBot ?? 1),
    monthlyCommandsLimit: normalizePositiveInt(pkg?.monthlyCommandsLimit, fallback.monthlyCommandsLimit ?? 2500),
    autoModEnabled: pkg?.autoModEnabled !== undefined ? Boolean(pkg.autoModEnabled) : (fallback.autoModEnabled !== undefined ? Boolean(fallback.autoModEnabled) : true),
    webhookLimit: normalizePositiveInt(pkg?.webhookLimit, fallback.webhookLimit ?? 2),
    customBranding: pkg?.customBranding !== undefined ? Boolean(pkg.customBranding) : Boolean(fallback.customBranding),
    enabled: pkg?.enabled !== undefined ? Boolean(pkg.enabled) : (fallback.enabled !== undefined ? Boolean(fallback.enabled) : true),
    features: Array.isArray(pkg?.features)
      ? pkg.features.map((f) => String(f || '').trim()).filter(Boolean)
      : (Array.isArray(fallback.features) ? [...fallback.features] : [])
  };
}

function normalizeWhatsappPackage(pkg, fallback = {}) {
  const planId = String(pkg?.planId || fallback.planId || '').trim().toLowerCase();
  if (!planId) return null;
  return {
    planId,
    planName: String(pkg?.planName || fallback.planName || planId).trim(),
    badge: String(pkg?.badge ?? fallback.badge ?? '').trim(),
    description: String(pkg?.description ?? fallback.description ?? '').trim(),
    price: normalizePaidPrice(pkg?.price, fallback.price ?? 12),
    maxSessions: normalizePositiveInt(pkg?.maxSessions, fallback.maxSessions ?? 1),
    monthlyMessagesLimit: normalizePositiveInt(pkg?.monthlyMessagesLimit, fallback.monthlyMessagesLimit ?? 2000),
    dailyBroadcastLimit: normalizePositiveInt(pkg?.dailyBroadcastLimit, fallback.dailyBroadcastLimit ?? 100),
    autoReplyFlowsLimit: normalizePositiveInt(pkg?.autoReplyFlowsLimit, fallback.autoReplyFlowsLimit ?? 3),
    contactLimit: normalizePositiveInt(pkg?.contactLimit, fallback.contactLimit ?? 1000),
    webhookEnabled: pkg?.webhookEnabled !== undefined ? Boolean(pkg.webhookEnabled) : Boolean(fallback.webhookEnabled),
    enabled: pkg?.enabled !== undefined ? Boolean(pkg.enabled) : (fallback.enabled !== undefined ? Boolean(fallback.enabled) : true),
    features: Array.isArray(pkg?.features)
      ? pkg.features.map((f) => String(f || '').trim()).filter(Boolean)
      : (Array.isArray(fallback.features) ? [...fallback.features] : [])
  };
}

function normalizeAddon(addon, fallback = {}) {
  const addonId = String(addon?.addonId || fallback.addonId || '').trim().toLowerCase();
  if (!addonId) return null;
  const rawType = String(addon?.type || fallback.type || '').trim();
  const type = SUPPORTED_ADDON_TYPES.has(rawType) ? rawType : (fallback.type || 'product_slots');
  const parsedPrice = Number(addon?.price ?? fallback.price ?? 0);
  return {
    addonId,
    name: String(addon?.name || fallback.name || addonId).trim(),
    description: String(addon?.description ?? fallback.description ?? '').trim(),
    price: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? Number(parsedPrice.toFixed(2)) : 0,
    type,
    quantity: normalizePositiveInt(addon?.quantity, fallback.quantity ?? 1),
    enabled: addon?.enabled !== undefined ? Boolean(addon.enabled) : (fallback.enabled !== undefined ? Boolean(fallback.enabled) : true)
  };
}

function normalizePackageList(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const defaultsById = new Map(DEFAULT_ECOMMERCE_PACKAGES.map((p) => [p.planId, p]));
  return items
    .map((item) => normalizePackage(item, defaultsById.get(String(item?.planId || '').trim().toLowerCase())))
    .filter(Boolean);
}

export function normalizeDiscordPackageList(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const defaultsById = new Map(DEFAULT_DISCORD_PACKAGES.map((p) => [p.planId, p]));
  return items
    .map((item) => normalizeDiscordPackage(item, defaultsById.get(String(item?.planId || '').trim().toLowerCase())))
    .filter(Boolean);
}

export function normalizeWhatsappPackageList(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const defaultsById = new Map(DEFAULT_WHATSAPP_PACKAGES.map((p) => [p.planId, p]));
  return items
    .map((item) => normalizeWhatsappPackage(item, defaultsById.get(String(item?.planId || '').trim().toLowerCase())))
    .filter(Boolean);
}

function normalizeAddonList(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const defaultsById = new Map(DEFAULT_ECOMMERCE_ADDONS.map((a) => [a.addonId, a]));
  return items
    .map((item) => normalizeAddon(item, defaultsById.get(String(item?.addonId || '').trim().toLowerCase())))
    .filter(Boolean);
}

export async function getEcommerceCatalog() {
  if (!isPgActive()) {
    return {
      packages: cloneDefaultPackages(),
      addons: cloneDefaultAddons(),
      discordPackages: cloneDefaultDiscordPackages(),
      whatsappPackages: cloneDefaultWhatsappPackages()
    };
  }
  try {
    const res = await queryPg(
      `SELECT settings FROM system_settings WHERE setting_key = 'ecommerce_packages' LIMIT 1`
    );
    const saved = res.rows?.[0]?.settings || {};
    const normalizedPackages = normalizePackageList(saved.packages);
    const normalizedAddons = normalizeAddonList(saved.addons);
    const normalizedDiscord = normalizeDiscordPackageList(saved.discordPackages);
    const normalizedWhatsapp = normalizeWhatsappPackageList(saved.whatsappPackages);
    return {
      packages: normalizedPackages.length > 0 ? normalizedPackages : cloneDefaultPackages(),
      addons: normalizedAddons.length > 0 ? normalizedAddons : cloneDefaultAddons(),
      discordPackages: normalizedDiscord.length > 0 ? normalizedDiscord : cloneDefaultDiscordPackages(),
      whatsappPackages: normalizedWhatsapp.length > 0 ? normalizedWhatsapp : cloneDefaultWhatsappPackages()
    };
  } catch {
    return {
      packages: cloneDefaultPackages(),
      addons: cloneDefaultAddons(),
      discordPackages: cloneDefaultDiscordPackages(),
      whatsappPackages: cloneDefaultWhatsappPackages()
    };
  }
}

export async function getEcommercePackages() {
  const { packages } = await getEcommerceCatalog();
  return packages;
}

export async function getEcommerceAddons() {
  const { addons } = await getEcommerceCatalog();
  return addons;
}

export async function getDiscordPackages({ includeDisabled = false } = {}) {
  const { discordPackages } = await getEcommerceCatalog();
  return includeDisabled ? discordPackages : discordPackages.filter((pkg) => pkg.enabled !== false);
}

export async function getWhatsappPackages({ includeDisabled = false } = {}) {
  const { whatsappPackages } = await getEcommerceCatalog();
  return includeDisabled ? whatsappPackages : whatsappPackages.filter((pkg) => pkg.enabled !== false);
}

export async function saveEcommerceCatalog({ packages, addons, discordPackages, whatsappPackages } = {}) {
  const current = await getEcommerceCatalog();

  let nextPackages = current.packages;
  if (packages !== undefined) {
    if (!Array.isArray(packages) || packages.length === 0) {
      throw new Error('At least one e-commerce package is required.');
    }
    const normalizedPackages = normalizePackageList(packages);
    if (normalizedPackages.length === 0) {
      throw new Error('No valid e-commerce packages provided.');
    }
    nextPackages = normalizedPackages;
  }

  let nextAddons = current.addons;
  if (addons !== undefined) {
    if (!Array.isArray(addons)) {
      throw new Error('Add-ons must be an array.');
    }
    nextAddons = normalizeAddonList(addons);
  }

  let nextDiscordPackages = current.discordPackages;
  if (discordPackages !== undefined) {
    if (!Array.isArray(discordPackages) || discordPackages.length === 0) {
      throw new Error('At least one Discord bot package is required.');
    }
    const normalizedDiscord = normalizeDiscordPackageList(discordPackages);
    if (normalizedDiscord.length === 0) {
      throw new Error('No valid Discord bot packages provided.');
    }
    nextDiscordPackages = normalizedDiscord;
  }

  let nextWhatsappPackages = current.whatsappPackages;
  if (whatsappPackages !== undefined) {
    if (!Array.isArray(whatsappPackages) || whatsappPackages.length === 0) {
      throw new Error('At least one WhatsApp bot package is required.');
    }
    const normalizedWhatsapp = normalizeWhatsappPackageList(whatsappPackages);
    if (normalizedWhatsapp.length === 0) {
      throw new Error('No valid WhatsApp bot packages provided.');
    }
    nextWhatsappPackages = normalizedWhatsapp;
  }

  await queryPg(
    `INSERT INTO system_settings (setting_key, settings, updated_at)
     VALUES ('ecommerce_packages', $1::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (setting_key)
     DO UPDATE SET settings = EXCLUDED.settings, updated_at = CURRENT_TIMESTAMP`,
    [
      JSON.stringify({
        packages: nextPackages,
        addons: nextAddons,
        discordPackages: nextDiscordPackages,
        whatsappPackages: nextWhatsappPackages
      })
    ]
  );
  return {
    packages: nextPackages,
    addons: nextAddons,
    discordPackages: nextDiscordPackages,
    whatsappPackages: nextWhatsappPackages
  };
}

export async function saveEcommercePackages(packages) {
  const { packages: savedPackages } = await saveEcommerceCatalog({ packages });
  return savedPackages;
}

export async function saveDiscordPackages(discordPackages) {
  const { discordPackages: savedDiscordPackages } = await saveEcommerceCatalog({ discordPackages });
  return savedDiscordPackages;
}

export async function saveWhatsappPackages(whatsappPackages) {
  const { whatsappPackages: savedWhatsappPackages } = await saveEcommerceCatalog({ whatsappPackages });
  return savedWhatsappPackages;
}

export async function getEcommercePackageById(planId) {
  const target = String(planId || '').trim().toLowerCase();
  const packages = await getEcommercePackages();
  return packages.find((pkg) => pkg.planId === target) || null;
}

export async function getEcommerceAddonById(addonId) {
  const target = String(addonId || '').trim().toLowerCase();
  const addons = await getEcommerceAddons();
  return addons.find((addon) => addon.addonId === target) || null;
}

export async function getDiscordPackageById(planId) {
  const target = String(planId || '').trim().toLowerCase();
  const packages = await getDiscordPackages();
  return packages.find((pkg) => pkg.planId === target) || null;
}

export async function getWhatsappPackageById(planId) {
  const target = String(planId || '').trim().toLowerCase();
  const packages = await getWhatsappPackages();
  return packages.find((pkg) => pkg.planId === target) || null;
}
