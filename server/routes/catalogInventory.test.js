import test from 'node:test';
import assert from 'node:assert/strict';
import { getStockStatus, isLowStock } from '../../shared/inventoryRules.js';
import {
  createStockAdjustment,
  deleteCategoryReferences,
  deleteSubcategoryReferences,
  getCategoryMetrics,
  renameCategoryReferences,
  renameSubcategoryReferences,
  validateSellingPrice,
  validateStock
} from './catalogHelpers.js';

test('stock classification applies one default and honors explicit zero thresholds', () => {
  assert.equal(getStockStatus({ stock: 0, minStock: 0 }), 'Out of Stock');
  assert.equal(getStockStatus({ stock: 10 }), 'Low Stock');
  assert.equal(getStockStatus({ stock: 20 }), 'In Stock');
  assert.equal(getStockStatus({ stock: 2, minStock: 0 }), 'In Stock');
  assert.equal(isLowStock({ stock: 3, minStock: 4 }), true);
});

test('category metrics count products and units from the product records', () => {
  assert.deepEqual(
    getCategoryMetrics({ name: 'Accessories' }, [
      { category: 'accessories', stock: 5 },
      { category: 'Other', stock: 9 },
      { category: 'Accessories', stock: 2 }
    ]),
    { itemCount: 2, productCount: 2, totalUnits: 7 }
  );
});

test('renaming a category updates product and subcategory references', () => {
  const updated = renameCategoryReferences(
    [{ id: 'p1', category: 'Old', subCategory: 'Audio' }, { id: 'p2', category: 'Other' }],
    [{ id: 's1', categoryName: 'Old' }, { id: 's2', categoryName: 'Other' }],
    'Old',
    'New'
  );
  assert.equal(updated.products[0].category, 'New');
  assert.equal(updated.products[1].category, 'Other');
  assert.equal(updated.subcategories[0].categoryName, 'New');
  assert.equal(updated.subcategories[1].categoryName, 'Other');
});

test('deleting a category clears product classifications and removes its child categories only', () => {
  const products = [
    { id: 'p1', category: 'Old', subCategory: 'Audio', stock: 4 },
    { id: 'p2', category: 'Other', subCategory: 'Audio', stock: 2 }
  ];
  const subcategories = [
    { id: 's1', categoryId: 'c1', categoryName: 'Old', name: 'Audio' },
    { id: 's2', categoryId: 'c2', categoryName: 'Other', name: 'Audio' }
  ];
  const updated = deleteCategoryReferences(products, subcategories, { id: 'c1', name: 'Old' });
  assert.deepEqual(updated.products[0], { ...products[0], category: '', subCategory: '' });
  assert.deepEqual(updated.products[1], products[1]);
  assert.deepEqual(updated.subcategories, [subcategories[1]]);
});

test('renaming or deleting a subcategory keeps product assignments valid', () => {
  const products = [
    { id: 'p1', category: 'Clothing', subCategory: 'Shirts' },
    { id: 'p2', category: 'Other', subCategory: 'Shirts' }
  ];
  const renamed = renameSubcategoryReferences(products, 'Shirts', 'Tops', 'Clothing');
  assert.equal(renamed[0].subCategory, 'Tops');
  assert.equal(renamed[1].subCategory, 'Shirts');
  const deleted = deleteSubcategoryReferences(renamed, { name: 'Tops', categoryName: 'Clothing' });
  assert.equal(deleted[0].subCategory, '');
  assert.equal(deleted[1].subCategory, 'Shirts');
});

test('stock changes create audit records with signed deltas and before/after values', () => {
  const record = createStockAdjustment({ id: 'p1', name: 'Widget', sku: 'W-1' }, 7, 8);
  assert.equal(record.productId, 'p1');
  assert.equal(record.quantity, 1);
  assert.equal(record.previousStock, 7);
  assert.equal(record.newStock, 8);
  assert.match(record.type, /Stock/);
  assert.ok(record.createdAt);
});

test('selling price validation rejects negative or nonnumeric values', () => {
  assert.deepEqual(validateSellingPrice(-0.01), { valid: false, price: -0.01 });
  assert.equal(validateSellingPrice('not-a-price').valid, false);
  assert.deepEqual(validateSellingPrice(undefined), { valid: true, price: 0 });
  assert.deepEqual(validateSellingPrice(12.5), { valid: true, price: 12.5 });
});

test('stock validation accepts non-negative whole units and rejects invalid inventory values', () => {
  assert.deepEqual(validateStock(0), { valid: true, stock: 0 });
  assert.deepEqual(validateStock('12'), { valid: true, stock: 12 });
  assert.deepEqual(validateStock(undefined, 5), { valid: true, stock: 5 });
  assert.equal(validateStock(-1).valid, false);
  assert.equal(validateStock(1.5).valid, false);
  assert.equal(validateStock('not-a-number').valid, false);
});
