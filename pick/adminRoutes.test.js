import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePickAdminProduct } from './adminRoutes.js';

test('normalizes an admin product while preserving a price for every sellable unit', () => {
  const product = normalizePickAdminProduct({
    nameEn: 'Potatoes',
    nameBn: 'আলু',
    unitsEn: ['500 g', '1 kg'],
    unitsBn: ['৫০০ গ্রাম', '১ কেজি'],
    unitPrices: [25, 45],
    stockQuantity: 18
  });

  assert.equal(product.price, 25);
  assert.deepEqual(product.unitsEn, ['500 g', '1 kg']);
  assert.deepEqual(product.unitsBn, ['৫০০ গ্রাম', '১ কেজি']);
  assert.deepEqual(product.unitPrices, [25, 45]);
  assert.equal(product.stockQuantity, 18);
  assert.equal(product.rating, 0);
});

test('rejects admin product data that could create a mobile checkout without valid pricing', () => {
  assert.throws(() => normalizePickAdminProduct({
    nameEn: 'Potatoes',
    nameBn: 'আলু',
    unitsEn: ['500 g', '1 kg'],
    unitsBn: ['৫০০ গ্রাম'],
    unitPrices: [25, 45],
    stockQuantity: 18
  }), /unit counts must match/);

  assert.throws(() => normalizePickAdminProduct({
    nameEn: 'Potatoes',
    nameBn: 'আলু',
    unitsEn: ['500 g'],
    unitsBn: ['৫০০ গ্রাম'],
    unitPrices: [-1],
    stockQuantity: 18
  }), /price for unit 1/);
});
