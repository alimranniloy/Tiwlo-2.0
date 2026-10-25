import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorePages } from './storePageHelpers.js';

test('normalizes page slugs, ordering, and placement and sanitizes active content', () => {
  const [page] = normalizeStorePages([{
    id: 'privacy',
    title: 'Privacy Policy',
    slug: 'Privacy Policy',
    content: '<h1>Privacy</h1><script>alert(1)</script><p onclick="evil()">We protect data.</p><a href="javascript:evil()">Unsafe</a><a href="https://example.com">Policy</a>',
    placement: 'both',
    order: 0
  }]);
  assert.equal(page.slug, 'privacy-policy');
  assert.equal(page.placement, 'both');
  assert.equal(page.enabled, true);
  assert.match(page.content, /<h1>Privacy<\/h1>/);
  assert.doesNotMatch(page.content, /script|onclick|javascript:/i);
  assert.match(page.content, /rel="noopener noreferrer"/);
});

test('rejects duplicate or reserved slugs, unsafe image paths, and oversized content', () => {
  assert.throws(() => normalizeStorePages([
    { id: 'one', title: 'Privacy', slug: 'privacy' },
    { id: 'two', title: 'Another Privacy', slug: 'privacy' }
  ]), /unique/);
  assert.throws(() => normalizeStorePages([{ id: 'checkout', title: 'Checkout', slug: 'checkout' }]), /reserved/);
  assert.throws(() => normalizeStorePages([{ id: 'x', title: 'Image', slug: 'image', image: 'javascript:alert(1)' }]), /HTTPS URL/);
  assert.throws(() => normalizeStorePages([{ id: 'x', title: 'Image', slug: 'image', image: '//example.com/image.png' }]), /HTTPS URL/);
  assert.throws(() => normalizeStorePages([{ id: 'x', title: 'Long', slug: 'long', content: 'x'.repeat(100001) }]), /no longer than/);
});
