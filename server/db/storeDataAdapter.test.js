import test from 'node:test';
import assert from 'node:assert/strict';
import { getActiveTiwiId, resolveActiveStore, resolveStorefrontHost } from './storeDataAdapter.js';
import { normalizeStoreSubdomain } from './storeSubdomain.js';

test('active store selection is limited to the authenticated account', async () => {
  const req = {
    activeUser: { id: 'owner-1', tiwiId: 'TIW-BASE', storeName: 'Base Store' }
  };
  const masterDb = {
    async getUserStores(userId) {
      assert.equal(userId, 'owner-1');
      return [
        { tiwiId: 'TIW-OWNED', ownerId: 'owner-1', storeName: 'Owned Store' },
        { tiwiId: 'TIW-OTHER', ownerId: 'owner-2', storeName: 'Other Store' }
      ];
    }
  };

  const ownedStore = await resolveActiveStore(req, 'TIW-OWNED', masterDb);
  assert.equal(ownedStore.storeName, 'Owned Store');
  req.activeStore = ownedStore;
  assert.equal(getActiveTiwiId(req), 'TIW-OWNED');

  assert.equal(await resolveActiveStore(req, 'TIW-OTHER', masterDb), null);
  assert.equal((await resolveActiveStore(req, 'TIW-BASE', masterDb)).storeName, 'Base Store');
  assert.equal(await resolveActiveStore({}, 'TIW-OWNED', masterDb), null);
});

test('storefront host resolution matches a unique registered tenant', async () => {
  const masterDb = {
    async getMasterData() {
      return {
        stores: [
          { tiwiId: 'TIW-CHILD', ownerId: 'owner-1', storeName: 'Child Store', subdomain: 'child-store.tiwlo.com', currency: 'BDT (৳)' }
        ],
        users: [
          { tiwiId: 'TIW-BASE', id: 'owner-1', storeName: 'Base Store', subdomain: 'base-store' },
          { tiwiId: 'TIW-BANNED', id: 'owner-2', subdomain: 'banned-store.tiwlo.com', isBanned: true }
        ]
      };
    }
  };

  assert.deepEqual(await resolveStorefrontHost('child-store.tiwlo.com', masterDb), {
    tiwiId: 'TIW-CHILD',
    storeName: 'Child Store',
    subdomain: 'child-store.tiwlo.com',
    currency: 'BDT (৳)'
  });

  test('reserved service names cannot be assigned to storefronts', () => {
    assert.throws(() => normalizeStoreSubdomain('api', 'Store'), /reserved/);
    assert.throws(() => normalizeStoreSubdomain('auth.tiwlo.com', 'Store'), /reserved/);
    assert.equal(normalizeStoreSubdomain('my-store', 'Store'), 'my-store.tiwlo.com');
  });
  assert.equal((await resolveStorefrontHost('base-store.tiwlo.com', masterDb)).tiwiId, 'TIW-BASE');
  assert.equal(await resolveStorefrontHost('unknown.tiwlo.com', masterDb), null);
  assert.equal(await resolveStorefrontHost('child-store.other.com', masterDb), null);
  assert.equal(await resolveStorefrontHost('deep.child-store.tiwlo.com', masterDb), null);
  assert.equal(await resolveStorefrontHost('banned-store.tiwlo.com', masterDb), null);
  assert.equal(await resolveStorefrontHost('auth.tiwlo.com', masterDb), null);

  const ambiguousMasterDb = {
    async getMasterData() {
      return {
        stores: [
          { tiwiId: 'TIW-ONE', ownerId: 'owner-1', subdomain: 'shared.tiwlo.com' },
          { tiwiId: 'TIW-TWO', ownerId: 'owner-2', subdomain: 'shared.tiwlo.com' }
        ],
        users: []
      };
    }
  };
  assert.equal(await resolveStorefrontHost('shared.tiwlo.com', ambiguousMasterDb), null);
});
