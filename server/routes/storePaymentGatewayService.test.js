import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  createHostedPayment,
  createHostedRefund,
  verifyHostedPaymentReturn,
  verifyStripeWebhook
} from './storePaymentGatewayService.js';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body)
  };
}

async function withMockFetch(handler, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = handler;
  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function makeOrder(provider, overrides = {}) {
  return {
    id: 'order-123',
    invoiceNumber: 'INV-123',
    currency: provider === 'bkash' || provider === 'sslcommerz' ? 'BDT' : 'USD',
    totalAmount: 123.45,
    customerName: 'Test Customer',
    customerPhone: '+8801700000000',
    customerEmail: 'customer@example.com',
    paymentGateway: {
      provider,
      tiwiId: 'tenant-123',
      amount: 123.45,
      amountMinor: 12345,
      currency: provider === 'bkash' || provider === 'sslcommerz' ? 'BDT' : 'USD',
      providerPaymentId: provider === 'stripe' ? 'cs_test_123' : 'payment-123',
      ...overrides
    },
    shippingAddress: {
      street: '1 Test Road',
      city: 'Dhaka',
      postalCode: '1200',
      country: 'Bangladesh'
    }
  };
}

test('creates a Stripe hosted checkout for the exact server-calculated amount', async () => {
  const order = makeOrder('stripe');
  await withMockFetch(async (url, options) => {
    assert.match(String(url), /api\.stripe\.com\/v1\/checkout\/sessions$/);
    assert.equal(options.headers.Authorization, 'Bearer sk_test_value');
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('line_items[0][price_data][unit_amount]'), '12345');
    assert.equal(form.get('line_items[0][price_data][currency]'), 'usd');
    assert.equal(form.get('metadata[order_id]'), order.id);
    return jsonResponse({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/pay/cs_test_123' });
  }, async () => {
    const result = await createHostedPayment({
      provider: 'stripe',
      credentials: { secretKey: 'sk_test_value' },
      mode: 'sandbox',
      order,
      successUrl: 'https://shop.example/#/return',
      cancelUrl: 'https://shop.example/#/cancel'
    });
    assert.equal(result.checkoutUrl, 'https://checkout.stripe.com/c/pay/cs_test_123');
    assert.equal(result.providerPaymentId, 'cs_test_123');
  });
});

test('verifies Stripe returns against the stored session, order, amount, and currency', async () => {
  const order = makeOrder('stripe');
  await withMockFetch(async () => jsonResponse({
    id: 'cs_test_123',
    payment_status: 'paid',
    client_reference_id: order.id,
    metadata: { order_id: order.id, tenant_id: order.paymentGateway.tiwiId },
    amount_total: 12345,
    currency: 'usd',
    payment_intent: 'pi_test_123'
  }), async () => {
    const result = await verifyHostedPaymentReturn({
      provider: 'stripe',
      credentials: { secretKey: 'sk_test_value' },
      mode: 'sandbox',
      order,
      query: { session_id: 'cs_test_123' },
      body: {}
    });
    assert.equal(result.paid, true);
    assert.equal(result.amount, 123.45);
    assert.equal(result.transactionId, 'pi_test_123');
  });

  await withMockFetch(async () => jsonResponse({
    id: 'cs_test_123',
    payment_status: 'paid',
    client_reference_id: order.id,
    metadata: { order_id: order.id, tenant_id: order.paymentGateway.tiwiId },
    amount_total: 12344,
    currency: 'usd',
    payment_intent: 'pi_test_123'
  }), async () => {
    await assert.rejects(verifyHostedPaymentReturn({
      provider: 'stripe',
      credentials: { secretKey: 'sk_test_value' },
      order,
      query: { session_id: 'cs_test_123' },
      body: {}
    }), /did not match the order/);
  });
});

test('bKash checkout and return use the provider API before reporting payment', async () => {
  const order = makeOrder('bkash');
  let executeSeen = false;
  await withMockFetch(async (url, options) => {
    if (String(url).endsWith('/auth/grant-token')) {
      return jsonResponse({ id_token: 'token-test', expires_in: 3600 });
    }
    if (String(url).endsWith('/payment/create')) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.amount, '123.45');
      return jsonResponse({
        paymentId: 'payment-123',
        bKashURL: 'https://checkout.sandbox.bka.sh/checkout/payment-123'
      });
    }
    if (String(url).endsWith('/payment/execute')) {
      executeSeen = true;
      return jsonResponse({
        transactionStatus: 'Completed',
        merchantInvoiceNumber: order.invoiceNumber,
        amount: '123.45',
        currency: 'BDT',
        trxId: 'trx-123'
      });
    }
    throw new Error(`Unexpected bKash request: ${url}`);
  }, async () => {
    const credentials = {
      appKey: 'app-key',
      appSecret: 'app-secret',
      username: 'merchant',
      password: 'password'
    };
    const checkout = await createHostedPayment({
      provider: 'bkash',
      tiwiId: 'tenant-bkash-test',
      credentials,
      mode: 'sandbox',
      order,
      callbackUrl: 'https://shop.example/api/public/payments/bkash/return'
    });
    assert.equal(checkout.providerPaymentId, 'payment-123');

    const result = await verifyHostedPaymentReturn({
      provider: 'bkash',
      tiwiId: 'tenant-bkash-test',
      credentials,
      mode: 'sandbox',
      order,
      query: { status: 'success', paymentID: 'payment-123' },
      body: {}
    });
    assert.equal(executeSeen, true);
    assert.equal(result.transactionId, 'trx-123');
    assert.equal(result.paid, true);
  });
});

test('accepts bKash live checkout URLs from its official checkout hosts', async () => {
  for (const host of ['checkout.pay.bka.sh', 'payment.bkash.com']) {
    await withMockFetch(async url => {
      if (String(url).endsWith('/auth/grant-token')) {
        return jsonResponse({ id_token: 'token-live-host-test', expires_in: 3600 });
      }
      if (String(url).endsWith('/payment/create')) {
        return jsonResponse({
          paymentID: 'payment-live-host-test',
          bKashURL: `https://${host}/checkout/payment-live-host-test`
        });
      }
      throw new Error(`Unexpected bKash request: ${url}`);
    }, async () => {
      const checkout = await createHostedPayment({
        provider: 'bkash',
        tiwiId: 'tenant-bkash-live-host-test',
        credentials: {
          appKey: 'app-key',
          appSecret: 'app-secret',
          username: 'merchant',
          password: 'password'
        },
        mode: 'live',
        order: makeOrder('bkash'),
        callbackUrl: 'https://shop.example/api/public/payments/bkash/return'
      });
      assert.equal(checkout.checkoutUrl, `https://${host}/checkout/payment-live-host-test`);
    });
  }
});

test('rejects bKash checkout URLs on lookalike domains', async () => {
  await withMockFetch(async url => {
    if (String(url).endsWith('/auth/grant-token')) {
      return jsonResponse({ id_token: 'token-lookalike-host-test', expires_in: 3600 });
    }
    if (String(url).endsWith('/payment/create')) {
      return jsonResponse({
        paymentID: 'payment-lookalike-host-test',
        bKashURL: 'https://payment.bkash.com.attacker.example/checkout/payment-lookalike-host-test'
      });
    }
    throw new Error(`Unexpected bKash request: ${url}`);
  }, async () => {
    await assert.rejects(createHostedPayment({
      provider: 'bkash',
      tiwiId: 'tenant-bkash-lookalike-host-test',
      credentials: {
        appKey: 'app-key',
        appSecret: 'app-secret',
        username: 'merchant',
        password: 'password'
      },
      mode: 'live',
      order: makeOrder('bkash'),
      callbackUrl: 'https://shop.example/api/public/payments/bkash/return'
    }), /untrusted checkout host: payment\.bkash\.com\.attacker\.example/);
  });
});

test('SSLCOMMERZ validates its transaction server-side before accepting payment', async () => {
  const order = makeOrder('sslcommerz');
  await withMockFetch(async (url, options) => {
    if (String(url).endsWith('/gwprocess/v4/api.php')) {
      const form = new URLSearchParams(options.body);
      assert.equal(form.get('total_amount'), '123.45');
      assert.match(form.get('ipn_url'), /\/sslcommerz\/ipn\?/);
      return jsonResponse({
        status: 'SUCCESS',
        GatewayPageURL: 'https://sandbox.sslcommerz.com/gwprocess/v4/gateway.php?session=123',
        sessionkey: 'session-123'
      });
    }
    assert.match(String(url), /validator\/api\/validationserverAPI\.php/);
    return jsonResponse({
      status: 'VALID',
      tran_id: order.invoiceNumber,
      amount: '123.45',
      currency: 'BDT',
      risk_level: '0',
      val_id: 'validation-123',
      value_a: order.id,
      bank_tran_id: 'bank-123'
    });
  }, async () => {
    const credentials = { storeId: 'merchant-id', storePassword: 'merchant-secret' };
    const checkout = await createHostedPayment({
      provider: 'sslcommerz',
      credentials,
      mode: 'sandbox',
      order,
      callbackUrl: 'https://shop.example/api/public/payments/sslcommerz/return?orderId=order-123&token=secret',
      cancelUrl: 'https://shop.example/api/public/payments/sslcommerz/return?orderId=order-123&token=secret&result=cancelled'
    });
    assert.equal(checkout.providerPaymentId, 'session-123');
    const result = await verifyHostedPaymentReturn({
      provider: 'sslcommerz',
      credentials,
      mode: 'sandbox',
      order,
      query: {},
      body: { val_id: 'validation-123', tran_id: order.invoiceNumber, value_a: order.id }
    });
    assert.equal(result.paid, true);
    assert.equal(result.transactionId, 'bank-123');
  });
});

test('PayPal captures the approved provider order and checks its final amount', async () => {
  const order = makeOrder('paypal');
  await withMockFetch(async (url, options) => {
    if (String(url).endsWith('/v1/oauth2/token')) {
      assert.equal(options.headers.Authorization, `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
      return jsonResponse({ access_token: 'paypal-access-token' });
    }
    if (String(url).endsWith('/v2/checkout/orders')) {
      const payload = JSON.parse(options.body);
      assert.equal(payload.purchase_units[0].amount.value, '123.45');
      assert.equal(payload.purchase_units[0].custom_id, order.id);
      return jsonResponse({
        id: 'payment-123',
        links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=payment-123' }]
      });
    }
    if (String(url).endsWith('/v2/checkout/orders/payment-123/capture')) {
      return jsonResponse({
        id: 'payment-123',
        status: 'COMPLETED',
        purchase_units: [{
          custom_id: order.id,
          payments: {
            captures: [{
              id: 'capture-123',
              amount: { value: '123.45', currency_code: 'USD' }
            }]
          }
        }]
      });
    }
    throw new Error(`Unexpected PayPal request: ${url}`);
  }, async () => {
    const credentials = { clientId: 'client-id', clientSecret: 'client-secret' };
    const checkout = await createHostedPayment({
      provider: 'paypal',
      credentials,
      mode: 'sandbox',
      order,
      successUrl: 'https://shop.example/api/public/payments/paypal/return?orderId=order-123',
      cancelUrl: 'https://shop.example/api/public/payments/paypal/return?orderId=order-123&result=cancelled'
    });
    assert.equal(checkout.checkoutUrl, 'https://www.sandbox.paypal.com/checkoutnow?token=payment-123');
    const result = await verifyHostedPaymentReturn({
      provider: 'paypal',
      credentials,
      mode: 'sandbox',
      order,
      query: { token: 'payment-123' },
      body: {}
    });
    assert.equal(result.paid, true);
    assert.equal(result.transactionId, 'capture-123');
  });
});

test('creates a partial Stripe refund with stable idempotency and validates its response', async () => {
  const order = makeOrder('stripe');
  const refund = { id: 'refund-123', amount: 23.45, reason: 'Returned item' };
  await withMockFetch(async (url, options) => {
    assert.match(String(url), /api\.stripe\.com\/v1\/refunds$/);
    assert.equal(options.headers['Idempotency-Key'], 'tiwlo-refund-refund-123');
    const params = new URLSearchParams(options.body);
    assert.equal(params.get('payment_intent'), 'pi_test_123');
    assert.equal(params.get('amount'), '2345');
    assert.equal(params.get('metadata[refund_id]'), refund.id);
    return jsonResponse({
      id: 're_test_123',
      amount: 2345,
      currency: 'usd',
      status: 'succeeded'
    });
  }, async () => {
    order.paymentGateway.transactionId = 'pi_test_123';
    const result = await createHostedRefund({
      provider: 'stripe',
      credentials: { secretKey: 'sk_test_value' },
      mode: 'sandbox',
      order,
      refund
    });
    assert.equal(result.status, 'succeeded');
    assert.equal(result.providerRefundId, 're_test_123');
    assert.equal(result.amount, 23.45);
  });
});

test('creates a bKash refund using its original payment and transaction references', async () => {
  const order = makeOrder('bkash');
  order.date = new Date().toISOString();
  order.paymentGateway.transactionId = 'original-transaction';
  const refund = { id: 'refund-bkash-1', amount: 23.45, reason: 'Returned item' };
  await withMockFetch(async (url, options) => {
    if (String(url).endsWith('/auth/grant-token')) {
      return jsonResponse({ id_token: 'token-refund', expires_in: 3600 });
    }
    assert.match(String(url), /\/refund\/payment\/transaction$/);
    const body = JSON.parse(options.body);
    assert.equal(body.paymentId, order.paymentGateway.providerPaymentId);
    assert.equal(body.trxId, 'original-transaction');
    assert.equal(body.refundAmount, '23.45');
    return jsonResponse({
      originalTrxId: 'original-transaction',
      refundTrxId: 'refund-transaction',
      refundTransactionStatus: 'Completed',
      refundAmount: '23.45',
      currency: 'BDT'
    });
  }, async () => {
    const result = await createHostedRefund({
      provider: 'bkash',
      tiwiId: 'tenant-bkash-refund-test',
      credentials: {
        appKey: 'app-key',
        appSecret: 'app-secret',
        username: 'merchant',
        password: 'password'
      },
      mode: 'sandbox',
      order,
      refund
    });
    assert.equal(result.status, 'succeeded');
    assert.equal(result.providerRefundId, 'refund-transaction');
  });
});

test('enforces bKash refund age and per-payment attempt limits before calling the provider', async () => {
  const credentials = {
    appKey: 'app-key',
    appSecret: 'app-secret',
    username: 'merchant',
    password: 'password'
  };
  const refund = { id: 'refund-bkash-limit', amount: 5, reason: 'Returned item' };
  const oldOrder = makeOrder('bkash');
  oldOrder.date = new Date(Date.now() - 61 * 24 * 60 * 60 * 1000).toISOString();
  oldOrder.paymentGateway.transactionId = 'original-transaction';
  await assert.rejects(createHostedRefund({
    provider: 'bkash',
    tiwiId: 'tenant-bkash-limit-test',
    credentials,
    mode: 'sandbox',
    order: oldOrder,
    refund
  }), /within 60 days/);

  const cappedOrder = makeOrder('bkash');
  cappedOrder.date = new Date().toISOString();
  cappedOrder.paymentGateway.transactionId = 'original-transaction';
  cappedOrder.refundHistory = Array.from({ length: 10 }, (_, index) => ({
    id: `prior-${index}`,
    status: 'gateway_confirmed'
  }));
  await assert.rejects(createHostedRefund({
    provider: 'bkash',
    tiwiId: 'tenant-bkash-limit-test',
    credentials,
    mode: 'sandbox',
    order: cappedOrder,
    refund
  }), /up to 10/);
});

test('creates a PayPal partial capture refund and accepts only matching provider totals', async () => {
  const order = makeOrder('paypal');
  order.paymentGateway.transactionId = 'capture-original';
  const refund = { id: 'refund-paypal-1', amount: 23.45, reason: 'Returned item' };
  await withMockFetch(async (url, options) => {
    if (String(url).endsWith('/v1/oauth2/token')) {
      return jsonResponse({ access_token: 'paypal-access-token' });
    }
    assert.match(String(url), /\/v2\/payments\/captures\/capture-original\/refund$/);
    assert.equal(options.headers['PayPal-Request-Id'], 'tiwlo-refund-refund-paypal-1');
    assert.equal(JSON.parse(options.body).amount.value, '23.45');
    return jsonResponse({
      id: 'paypal-refund-123',
      status: 'COMPLETED',
      amount: { value: '23.45', currency_code: 'USD' }
    });
  }, async () => {
    const result = await createHostedRefund({
      provider: 'paypal',
      credentials: { clientId: 'client-id', clientSecret: 'client-secret' },
      mode: 'sandbox',
      order,
      refund
    });
    assert.equal(result.status, 'succeeded');
    assert.equal(result.providerRefundId, 'paypal-refund-123');
  });
});

test('does not claim automatic refunds for gateways without a verified adapter', async () => {
  await assert.rejects(createHostedRefund({
    provider: 'sslcommerz',
    credentials: {},
    mode: 'sandbox',
    order: makeOrder('sslcommerz'),
    refund: { id: 'refund-ssl-1', amount: 10 }
  }), /not available for this payment provider/);
  await assert.rejects(createHostedRefund({
    provider: 'nagad',
    credentials: {},
    mode: 'sandbox',
    order: makeOrder('nagad'),
    refund: { id: 'refund-nagad-1', amount: 10 }
  }), /not available for this payment provider/);
});

test('validates Stripe webhook signatures before matching its order details', async () => {
  const order = makeOrder('stripe');
  const event = {
    id: 'evt_test_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_123',
        payment_status: 'paid',
        metadata: { order_id: order.id, tenant_id: order.paymentGateway.tiwiId },
        amount_total: 12345,
        currency: 'usd',
        payment_intent: 'pi_test_123'
      }
    }
  };
  const rawBody = Buffer.from(JSON.stringify(event));
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = 'whsec_test_value';
  const digest = createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
  const signature = `t=${timestamp},v1=${digest}`;

  const result = await verifyStripeWebhook({
    credentials: { webhookSecret: secret },
    rawBody,
    signature,
    order
  });
  assert.equal(result.paid, true);
  assert.equal(result.eventId, event.id);
  await assert.rejects(verifyStripeWebhook({
    credentials: { webhookSecret: secret },
    rawBody,
    signature: 't=1,v1=00',
    order
  }), /signature is invalid/);
});

test('rejects provider checkout links outside the provider-owned HTTPS domains', async () => {
  await withMockFetch(async () => jsonResponse({
    id: 'cs_test_123',
    url: 'https://attacker.example/fake-checkout'
  }), async () => {
    await assert.rejects(createHostedPayment({
      provider: 'stripe',
      credentials: { secretKey: 'sk_test_value' },
      mode: 'sandbox',
      order: makeOrder('stripe'),
      successUrl: 'https://shop.example/#/return',
      cancelUrl: 'https://shop.example/#/cancel'
    }), /untrusted checkout host: attacker\.example/);
  });
});
