import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderCloudPaymentCancelledEmail,
  renderCloudPaymentReminderEmail,
  renderCloudPaymentStartedEmail
} from './cloudPaymentStarted.js';

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

test('checkout reminder states the six-hour deadline without implying payment failed', () => {
  const html = renderCloudPaymentReminderEmail({
    to: 'verified@example.com',
    name: 'Cloud Account',
    provider: 'stripe',
    amount: 25,
    currency: 'USD',
    creditAmount: 25,
    reference: 'ctu-reminder',
    invoiceUrl: 'https://uids.app/billing/invoices/ctu-reminder',
    expiresAt: '2026-10-28T18:00:00.000Z'
  });

  assert.match(html, /expires in 6 hours/i);
  assert.match(html, /Review invoice/);
  assert.match(html, /If you have already paid/i);
  assert.match(html, /ctu-reminder/);
  assert.doesNotMatch(html, /payment has failed/i);
});

test('cancellation confirmation describes the Tiwlo session and provider limitation', () => {
  const html = renderCloudPaymentCancelledEmail({
    to: 'verified@example.com',
    name: 'Cloud Account',
    provider: 'paypal',
    amount: 25,
    currency: 'USD',
    reference: 'ctu-cancelled',
    invoiceUrl: 'https://uids.app/billing/invoices/ctu-cancelled'
  });

  assert.match(html, /billing session has been cancelled/i);
  assert.match(html, /may not close the payment provider/i);
  assert.match(html, /verified confirmation will still be applied/i);
  assert.match(html, /ctu-cancelled/);
});
