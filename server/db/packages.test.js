import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ECOMMERCE_PACKAGES,
  DEFAULT_ECOMMERCE_ADDONS,
  getEcommerceCatalog,
  getEcommercePackages,
  getEcommerceAddons,
  getEcommercePackageById,
  getEcommerceAddonById,
} from './packages.js';

test('DEFAULT_ECOMMERCE_PACKAGES enforces strict Free limits, POS gating, and realistic Enterprise caps', () => {
  const byId = new Map(DEFAULT_ECOMMERCE_PACKAGES.map((pkg) => [pkg.planId, pkg]));
  assert.deepEqual([...byId.keys()], ['free', 'growth', 'pro', 'enterprise']);

  const free = byId.get('free');
  assert.equal(free.price, 0);
  assert.equal(free.productLimit, 10);
  assert.equal(free.warehouseLimit, 1);
  assert.equal(free.staffLimit, 1);
  assert.equal(free.monthlyOrderLimit, 50);
  assert.equal(free.hasPos, false);
  assert.equal(free.hasCustomDomain, false);
  assert.equal(free.enabled, true);

  const growth = byId.get('growth');
  assert.equal(growth.price, 19);
  assert.equal(growth.productLimit, 150);
  assert.equal(growth.warehouseLimit, 2);
  assert.equal(growth.staffLimit, 3);
  assert.equal(growth.monthlyOrderLimit, 1000);
  assert.equal(growth.hasPos, true);
  assert.equal(growth.hasCustomDomain, true);

  const pro = byId.get('pro');
  assert.equal(pro.price, 49);
  assert.equal(pro.productLimit, 1000);
  assert.equal(pro.warehouseLimit, 5);
  assert.equal(pro.staffLimit, 10);
  assert.equal(pro.monthlyOrderLimit, 5000);
  assert.equal(pro.hasPos, true);
  assert.equal(pro.hasCustomDomain, true);

  const enterprise = byId.get('enterprise');
  assert.equal(enterprise.price, 129);
  assert.equal(enterprise.productLimit, 10000);
  assert.equal(enterprise.warehouseLimit, 25);
  assert.equal(enterprise.staffLimit, 50);
  assert.equal(enterprise.monthlyOrderLimit, 50000);
  assert.equal(enterprise.hasPos, true);
  assert.equal(enterprise.hasCustomDomain, true);
  assert.ok(enterprise.productLimit < 999999, 'Enterprise productLimit should be a realistic non-unlimited cap');
  assert.ok(enterprise.warehouseLimit < 99, 'Enterprise warehouseLimit should be a realistic non-unlimited cap');
  assert.notEqual(enterprise.badge.toLowerCase(), 'unlimited');
  for (const feature of enterprise.features) {
    assert.equal(/unlimited/i.test(feature), false, `Enterprise feature should not claim unlimited: ${feature}`);
  }
});

test('DEFAULT_ECOMMERCE_PACKAGES limits scale monotonically across tiers', () => {
  for (let i = 1; i < DEFAULT_ECOMMERCE_PACKAGES.length; i += 1) {
    const prev = DEFAULT_ECOMMERCE_PACKAGES[i - 1];
    const curr = DEFAULT_ECOMMERCE_PACKAGES[i];
    assert.ok(curr.price > prev.price, `${curr.planId} price should exceed ${prev.planId}`);
    assert.ok(curr.productLimit > prev.productLimit, `${curr.planId} productLimit should exceed ${prev.planId}`);
    assert.ok(curr.warehouseLimit > prev.warehouseLimit, `${curr.planId} warehouseLimit should exceed ${prev.planId}`);
    assert.ok(curr.staffLimit > prev.staffLimit, `${curr.planId} staffLimit should exceed ${prev.planId}`);
    assert.ok(curr.monthlyOrderLimit > prev.monthlyOrderLimit, `${curr.planId} monthlyOrderLimit should exceed ${prev.planId}`);
  }
});

test('DEFAULT_ECOMMERCE_ADDONS defines valid product slots, staff slots, and POS access add-ons', () => {
  const validTypes = new Set(['product_slots', 'staff_slots', 'feature_pos']);
  const byId = new Map(DEFAULT_ECOMMERCE_ADDONS.map((addon) => [addon.addonId, addon]));

  assert.equal(DEFAULT_ECOMMERCE_ADDONS.length, 4);
  assert.deepEqual([...byId.keys()], [
    'extra_products_25',
    'extra_products_100',
    'pos_access',
    'extra_staff_3',
  ]);

  for (const addon of DEFAULT_ECOMMERCE_ADDONS) {
    assert.ok(addon.name.length > 0);
    assert.ok(addon.description.length > 0);
    assert.ok(Number.isFinite(addon.price) && addon.price > 0);
    assert.ok(validTypes.has(addon.type), `Unsupported addon type: ${addon.type}`);
    assert.ok(Number.isInteger(addon.quantity) && addon.quantity >= 1);
    assert.equal(addon.enabled, true);
  }

  assert.deepEqual(byId.get('extra_products_25'), {
    addonId: 'extra_products_25',
    name: '+25 Product Slots',
    description: 'Add 25 extra product slots to your active store.',
    price: 5,
    type: 'product_slots',
    quantity: 25,
    enabled: true,
  });
  assert.deepEqual(byId.get('extra_products_100'), {
    addonId: 'extra_products_100',
    name: '+100 Product Slots',
    description: 'Add 100 extra product slots to your active store.',
    price: 12,
    type: 'product_slots',
    quantity: 100,
    enabled: true,
  });
  assert.deepEqual(byId.get('pos_access'), {
    addonId: 'pos_access',
    name: 'POS System Access',
    description: 'Unlock in-store Point of Sale terminal and cashbook.',
    price: 9,
    type: 'feature_pos',
    quantity: 1,
    enabled: true,
  });
  assert.deepEqual(byId.get('extra_staff_3'), {
    addonId: 'extra_staff_3',
    name: '+3 Staff Seats',
    description: 'Add 3 extra staff & payroll seats.',
    price: 6,
    type: 'staff_slots',
    quantity: 3,
    enabled: true,
  });
});

test('catalog, package, and addon getters return cloned defaults when Postgres is inactive', async () => {
  const catalog = await getEcommerceCatalog();
  assert.equal(catalog.packages.length, DEFAULT_ECOMMERCE_PACKAGES.length);
  assert.equal(catalog.addons.length, DEFAULT_ECOMMERCE_ADDONS.length);

  // Mutating returned copies must not mutate exported defaults
  catalog.packages[0].productLimit = 999;
  catalog.packages[0].features.push('Mutated');
  catalog.addons[0].price = 999;
  assert.equal(DEFAULT_ECOMMERCE_PACKAGES[0].productLimit, 10);
  assert.equal(DEFAULT_ECOMMERCE_PACKAGES[0].features.includes('Mutated'), false);
  assert.equal(DEFAULT_ECOMMERCE_ADDONS[0].price, 5);

  const packages = await getEcommercePackages();
  assert.equal(packages.find((p) => p.planId === 'free')?.hasPos, false);

  const addons = await getEcommerceAddons();
  assert.equal(addons.find((a) => a.addonId === 'pos_access')?.type, 'feature_pos');

  const freePkg = await getEcommercePackageById(' FREE ');
  assert.equal(freePkg?.planId, 'free');
  assert.equal(freePkg?.productLimit, 10);
  assert.equal(await getEcommercePackageById('nonexistent'), null);

  const posAddon = await getEcommerceAddonById(' POS_ACCESS ');
  assert.equal(posAddon?.addonId, 'pos_access');
  assert.equal(posAddon?.price, 9);
  assert.equal(await getEcommerceAddonById('nonexistent'), null);
});
