import test from 'node:test';
import assert from 'node:assert/strict';
import { rootValue } from './index.js';
import { TenantDB } from '../db/multiTenant.js';

test('GraphQL addProduct and updateProduct sanitize product description HTML', async (t) => {
  const originalAdd = TenantDB.addProduct;
  const originalUpdate = TenantDB.updateProduct;
  t.after(() => {
    TenantDB.addProduct = originalAdd;
    TenantDB.updateProduct = originalUpdate;
  });

  let capturedAddInput = null;
  let capturedUpdateInput = null;
  TenantDB.addProduct = async (_tiwiId, input) => {
    capturedAddInput = input;
    return { id: 'prod-1', ...input };
  };
  TenantDB.updateProduct = async (_tiwiId, id, input) => {
    capturedUpdateInput = input;
    return { id, ...input };
  };

  const created = await rootValue.addProduct({
    tiwiId: 'TIW-1001',
    input: {
      name: 'Widget',
      category: 'General',
      price: 10,
      stock: 5,
      description: '<p>Safe</p><script>alert(1)</script><img src=x onerror=alert(2)>'
    }
  });

  assert.equal(capturedAddInput.description, '<p>Safe</p><img src="x" />');
  assert.doesNotMatch(created.description, /script|onerror/i);

  const updated = await rootValue.updateProduct({
    tiwiId: 'TIW-1001',
    id: 'prod-1',
    input: {
      name: 'Widget v2',
      description: '<svg onload=alert(1)></svg><strong>Updated</strong>'
    }
  });

  assert.equal(capturedUpdateInput.description, '<strong>Updated</strong>');
  assert.equal(updated.description, '<strong>Updated</strong>');
});
