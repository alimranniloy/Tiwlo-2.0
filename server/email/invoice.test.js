import assert from 'node:assert/strict';
import test from 'node:test';
import { renderInvoiceEmail } from './invoice.js';

test('invoice email includes its date, payment state, and escaped order details', () => {
  const html = renderInvoiceEmail({
    to: 'buyer@example.com',
    invoiceNumber: 'INV-20260318-<tag>',
    date: 'Mar 18, 2026',
    amount: 125.5,
    paidAmount: 25,
    dueAmount: 100.5,
    currency: 'EUR',
    paymentStatus: 'Pending',
    paymentMethod: 'Cash on Delivery',
    storeName: 'A <b>Store</b>',
    items: [{ description: '<img src=x onerror=alert(1)>', qty: 2, amount: 125.5 }]
  });

  assert.match(html, /Mar 18, 2026/);
  assert.match(html, /Invoice Total/);
  assert.match(html, /Amount paid<\/td>\s*<td[^>]*>EUR 25\.00/);
  assert.match(html, /Outstanding due<\/td>\s*<td[^>]*>EUR 100\.50/);
  assert.ok(html.includes('Pending'));
  assert.match(html, /EUR 125\.50/);
  assert.match(html, /INV-20260318-&lt;tag&gt;/);
  assert.match(html, /A &lt;b&gt;Store&lt;\/b&gt;/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=/);
});
