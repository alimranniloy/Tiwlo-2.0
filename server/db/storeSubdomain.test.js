import test from 'node:test';
import assert from 'node:assert/strict';
import { isStoreSubdomainAvailable, normalizeStoreSubdomain } from './storeSubdomain.js';

const domain = 'stores.example.test';

test('normalizes manually entered store labels and hostnames', () => {
  assert.equal(normalizeStoreSubdomain('New-Store', 'Fallback', domain), `new-store.${domain}`);
  assert.equal(normalizeStoreSubdomain(`HTTPS://MyShop.${domain}/catalog`, 'Fallback', domain), `myshop.${domain}`);
});

test('generates a subdomain when no manual value is provided', () => {
  assert.equal(normalizeStoreSubdomain('', 'Demo Store', domain), `demostore.${domain}`);
});

test('explains invalid domain and DNS label input', () => {
  assert.throws(
    () => normalizeStoreSubdomain('shop.other.test', 'Fallback', domain),
    new RegExp(`Use a subdomain of ${domain}`)
  );
  assert.throws(
    () => normalizeStoreSubdomain('-invalid', 'Fallback', domain),
    /single DNS label/
  );
});

test('checks normalized subdomains against both stores and account storefronts', () => {
  assert.equal(isStoreSubdomainAvailable(
    'my-shop.tiwlo.com',
    [{ subdomain: 'other-shop.tiwlo.com' }],
    [{ subdomain: 'my-shop' }]
  ), false);
  assert.equal(isStoreSubdomainAvailable(
    'new-shop.tiwlo.com',
    [{ subdomain: 'other-shop.tiwlo.com' }],
    [{ subdomain: 'my-shop' }]
  ), true);
});
