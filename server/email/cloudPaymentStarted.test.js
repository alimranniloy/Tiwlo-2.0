import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCloudPaymentStartedEmail } from './cloudPaymentStarted.js';

test('checkout notification confirms session creation without claiming payment status', () => {
  const html = renderCloudPaymentStartedEmail({
    to: 'verified@example.com',
    name: '<Account>',
    provider: 'bkash',
    amount: 1250,
    currency: 'BDT',
    reference: 'ctu-123',
    checkoutUrl: 'https://payment.example/checkout?ref=abc&source=mail',
    expiresAt: '2026-03-16T12:00:00.000Z'
  });

  assert.match(html, /Continue to secure checkout/);
  assert.match(html, /BDT 1250\.00/);
  assert.match(html, /ctu-123/);
  assert.match(html, /&amp;source=mail/);
  assert.match(html, /&lt;Account&gt;/);
  assert.match(html, /it is not a payment receipt/i);
  assert.doesNotMatch(html, /\b(paid|pending)\b/i);
});
