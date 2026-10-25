import { createHmac, timingSafeEqual } from 'node:crypto';

const bkashTokens = new Map();

function gatewayBase(provider, mode) {
  const sandbox = mode !== 'live';
  if (provider === 'bkash') {
    return sandbox
      ? 'https://tokenized.sandbox.bka.sh/v2/tokenized-checkout'
      : 'https://tokenized.pay.bka.sh/v2/tokenized-checkout';
  }
  if (provider === 'sslcommerz') {
    return sandbox ? 'https://sandbox.sslcommerz.com' : 'https://securepay.sslcommerz.com';
  }
  if (provider === 'paypal') {
    return sandbox ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  }
  if (provider === 'stripe') return 'https://api.stripe.com';
  throw new TypeError('This payment provider is not available for online checkout.');
}

async function requestJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let result = {};
    if (text) {
      try {
        result = JSON.parse(text);
      } catch {
        throw new Error('Payment provider returned an invalid response.');
      }
    }
    if (!response.ok) {
      throw new Error(`Payment provider request failed with HTTP ${response.status}.`);
    }
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function jsonHeaders() {
  return { Accept: 'application/json', 'Content-Type': 'application/json' };
}

async function getBkashToken(tiwiId, credentials, mode) {
  const cacheKey = `${tiwiId}:${mode || 'sandbox'}:${credentials.appKey}`;
  const cached = bkashTokens.get(cacheKey);
  if (cached?.token && cached.expiresAt > Date.now() + 60000) return cached.token;
  if (cached?.pending) return cached.pending;

  const pending = requestJson(`${gatewayBase('bkash', mode)}/auth/grant-token`, {
    method: 'POST',
    headers: {
      ...jsonHeaders(),
      username: credentials.username,
      password: credentials.password
    },
    body: JSON.stringify({
      app_key: credentials.appKey,
      app_secret: credentials.appSecret
    })
  }).then(result => {
    if (!result.id_token) throw new Error('bKash did not issue an authorization token.');
    bkashTokens.set(cacheKey, {
      token: result.id_token,
      expiresAt: Date.now() + Math.max(60, Number(result.expires_in) || 3600) * 1000
    });
    return result.id_token;
  }).catch(error => {
    bkashTokens.delete(cacheKey);
    throw error;
  });
  bkashTokens.set(cacheKey, { pending });
  return pending;
}

async function createBkashCheckout({ tiwiId, credentials, mode, order, callbackUrl }) {
  const token = await getBkashToken(tiwiId, credentials, mode);
  const result = await requestJson(`${gatewayBase('bkash', mode)}/payment/create`, {
    method: 'POST',
    headers: { ...jsonHeaders(), Authorization: token, 'X-App-Key': credentials.appKey },
    body: JSON.stringify({
      payerReference: order.id,
      callbackURL: callbackUrl,
      amount: Number(order.paymentGateway.amount).toFixed(2),
      currency: order.currency,
      intent: 'sale',
      merchantInvoiceNumber: order.invoiceNumber
    })
  });
  if (!result.paymentId || !result.bKashURL) {
    throw new Error('bKash did not return a checkout payment link.');
  }
  return { checkoutUrl: result.bKashURL, providerPaymentId: result.paymentId };
}

async function createStripeCheckout({ credentials, order, successUrl, cancelUrl }) {
  const params = new URLSearchParams({
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: order.id,
    customer_email: order.customerEmail || '',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': order.currency.toLowerCase(),
    'line_items[0][price_data][unit_amount]': String(order.paymentGateway.amountMinor),
    'line_items[0][price_data][product_data][name]': `Order ${order.invoiceNumber}`,
    'metadata[order_id]': order.id,
    'metadata[tenant_id]': order.paymentGateway.tiwiId,
    'payment_intent_data[metadata][order_id]': order.id,
    'payment_intent_data[metadata][tenant_id]': order.paymentGateway.tiwiId
  });
  if (!order.customerEmail) params.delete('customer_email');
  const result = await requestJson(`${gatewayBase('stripe')}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });
  if (!result.id || !result.url) throw new Error('Stripe did not return a hosted checkout link.');
  return { checkoutUrl: result.url, providerPaymentId: result.id };
}

async function getPayPalAccessToken(credentials, mode) {
  const encoded = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
  const result = await requestJson(`${gatewayBase('paypal', mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${encoded}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json'
    },
    body: 'grant_type=client_credentials'
  });
  if (!result.access_token) throw new Error('PayPal did not issue an access token.');
  return result.access_token;
}

async function createPayPalCheckout({ credentials, mode, order, successUrl, cancelUrl }) {
  const accessToken = await getPayPalAccessToken(credentials, mode);
  const result = await requestJson(`${gatewayBase('paypal', mode)}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      ...jsonHeaders(),
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': order.id
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.id,
        custom_id: order.id,
        invoice_id: order.invoiceNumber,
        amount: {
          currency_code: order.currency,
          value: Number(order.paymentGateway.amount).toFixed(2)
        }
      }],
      application_context: {
        return_url: successUrl,
        cancel_url: cancelUrl,
        user_action: 'PAY_NOW'
      }
    })
  });
  const approval = (result.links || []).find(link => link.rel === 'approve');
  if (!result.id || !approval?.href) throw new Error('PayPal did not return a checkout approval link.');
  return { checkoutUrl: approval.href, providerPaymentId: result.id };
}

async function createSslCommerzCheckout({ credentials, mode, order, callbackUrl, cancelUrl }) {
  const form = new URLSearchParams({
    store_id: credentials.storeId,
    store_passwd: credentials.storePassword,
    total_amount: Number(order.paymentGateway.amount).toFixed(2),
    currency: order.currency,
    tran_id: order.invoiceNumber,
    success_url: callbackUrl,
    fail_url: `${callbackUrl}&result=failed`,
    cancel_url: `${callbackUrl}&result=cancelled`,
    ipn_url: callbackUrl.replace('/return?', '/ipn?'),
    shipping_method: 'YES',
    product_name: `Order ${order.invoiceNumber}`,
    product_category: 'ecommerce',
    product_profile: 'general',
    cus_name: order.customerName,
    cus_email: order.customerEmail || 'customer@invalid.tiwlo',
    cus_add1: order.shippingAddress?.street || order.deliveryAddress || 'Not provided',
    cus_city: order.shippingAddress?.city || 'Not provided',
    cus_postcode: order.shippingAddress?.postalCode || '0000',
    cus_country: order.shippingAddress?.country || 'Bangladesh',
    cus_phone: order.customerPhone,
    value_a: order.id
  });
  const result = await requestJson(`${gatewayBase('sslcommerz', mode)}/gwprocess/v4/api.php`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  const checkoutUrl = result.GatewayPageURL || result.redirectGatewayURL;
  if (result.status !== 'SUCCESS' || !checkoutUrl) {
    throw new Error('SSLCOMMERZ did not create a hosted checkout session.');
  }
  return {
    checkoutUrl: validateCheckoutUrl('sslcommerz', checkoutUrl, mode),
    providerPaymentId: result.sessionkey || result.session_id || order.invoiceNumber
  };
}

function validateCheckoutUrl(provider, value, mode) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Payment provider returned an invalid checkout link.');
  }
  if (url.protocol !== 'https:') throw new Error('Payment provider returned an insecure checkout link.');
  const host = url.hostname.toLowerCase();
  const allowedHosts = {
    bkash: mode === 'live' ? ['tokenized.pay.bka.sh'] : ['tokenized.sandbox.bka.sh'],
    paypal: mode === 'live'
      ? ['paypal.com', 'www.paypal.com']
      : ['sandbox.paypal.com', 'www.sandbox.paypal.com'],
    sslcommerz: mode === 'live' ? ['securepay.sslcommerz.com'] : ['sandbox.sslcommerz.com'],
    stripe: ['checkout.stripe.com']
  }[provider] || [];
  if (!allowedHosts.includes(host)) {
    throw new Error('Payment provider returned an untrusted checkout host.');
  }
  return url.toString();
}

export async function createHostedPayment({
  provider,
  tiwiId,
  credentials,
  mode,
  order,
  callbackUrl,
  successUrl,
  cancelUrl
}) {
  if (provider === 'bkash') {
    const checkout = await createBkashCheckout({ tiwiId, credentials, mode, order, callbackUrl });
    return { ...checkout, checkoutUrl: validateCheckoutUrl(provider, checkout.checkoutUrl, mode) };
  }
  if (provider === 'stripe') {
    const checkout = await createStripeCheckout({ credentials, order, successUrl, cancelUrl });
    return { ...checkout, checkoutUrl: validateCheckoutUrl(provider, checkout.checkoutUrl, mode) };
  }
  if (provider === 'paypal') {
    const checkout = await createPayPalCheckout({ credentials, mode, order, successUrl, cancelUrl });
    return { ...checkout, checkoutUrl: validateCheckoutUrl(provider, checkout.checkoutUrl, mode) };
  }
  if (provider === 'sslcommerz') {
    const checkout = await createSslCommerzCheckout({ credentials, mode, order, callbackUrl, cancelUrl });
    return { ...checkout, checkoutUrl: validateCheckoutUrl(provider, checkout.checkoutUrl, mode) };
  }
  throw new TypeError('This payment provider is not available for online checkout.');
}

async function executeBkashReturn({ tiwiId, credentials, mode, order, query }) {
  const paymentId = String(query.paymentID || '');
  if (!paymentId || String(query.status || '').toLowerCase() !== 'success' ||
      paymentId !== order.paymentGateway.providerPaymentId) {
    return { paid: false, rawStatus: String(query.status || 'cancelled') };
  }
  const token = await getBkashToken(tiwiId, credentials, mode);
  const result = await requestJson(`${gatewayBase('bkash', mode)}/payment/execute`, {
    method: 'POST',
    headers: { ...jsonHeaders(), Authorization: token, 'X-App-Key': credentials.appKey },
    body: JSON.stringify({ paymentID: paymentId })
  });
  if (result.transactionStatus !== 'Completed' ||
      String(result.merchantInvoiceNumber) !== String(order.invoiceNumber) ||
      Number(result.amount) !== Number(order.paymentGateway.amount) ||
      String(result.currency).toUpperCase() !== order.currency) {
    throw new Error('bKash payment details did not match the order.');
  }
  return {
    paid: true,
    rawStatus: result.transactionStatus,
    transactionId: result.trxId,
    providerPaymentId: paymentId,
    amount: Number(result.amount),
    currency: result.currency
  };
}

async function retrieveStripeSession(credentials, sessionId) {
  return requestJson(`${gatewayBase('stripe')}/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${credentials.secretKey}` }
  });
}

async function verifyStripeReturn({ credentials, order, query }) {
  const sessionId = String(query.session_id || '');
  if (!sessionId || sessionId !== order.paymentGateway.providerPaymentId) {
    return { paid: false, rawStatus: 'session_mismatch' };
  }
  const session = await retrieveStripeSession(credentials, sessionId);
  if (session.payment_status !== 'paid') return { paid: false, rawStatus: session.payment_status || session.status };
  if (session.client_reference_id !== order.id || session.metadata?.order_id !== order.id ||
      session.metadata?.tenant_id !== order.paymentGateway.tiwiId ||
      Number(session.amount_total) !== Number(order.paymentGateway.amountMinor) ||
      String(session.currency).toUpperCase() !== order.currency) {
    throw new Error('Stripe payment details did not match the order.');
  }
  return {
    paid: true,
    rawStatus: session.payment_status,
    transactionId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    providerPaymentId: session.id,
    amount: Number(session.amount_total) / 100,
    currency: session.currency
  };
}

export function verifyStripeWebhookSignature(rawBody, header, secret, now = Date.now()) {
  const parts = String(header || '').split(',').map(item => item.split('=', 2));
  const timestamp = parts.find(([key]) => key === 't')?.[1];
  const signatures = parts.filter(([key]) => key === 'v1').map(([, value]) => value);
  if (!Buffer.isBuffer(rawBody) || !timestamp || !/^\d+$/.test(timestamp) || !signatures.length) return false;
  if (Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  return signatures.some(signature => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const candidate = Buffer.from(signature, 'hex');
    return candidate.length === expected.length && timingSafeEqual(candidate, expected);
  });
}

async function validateSslCommerz({ credentials, mode, order, body }) {
  const valId = String(body.val_id || '');
  if (!valId || String(body.tran_id || '') !== String(order.invoiceNumber)) {
    return { paid: false, rawStatus: String(body.status || 'invalid') };
  }
  const params = new URLSearchParams({
    val_id: valId,
    store_id: credentials.storeId,
    store_passwd: credentials.storePassword,
    v: '1',
    format: 'json'
  });
  const result = await requestJson(`${gatewayBase('sslcommerz', mode)}/validator/api/validationserverAPI.php?${params}`, {
    headers: { Accept: 'application/json' }
  });
  if (!['VALID', 'VALIDATED'].includes(String(result.status || '').toUpperCase()) ||
      String(result.tran_id || '') !== String(order.invoiceNumber) ||
      String(result.value_a || body.value_a || '') !== String(order.id) ||
      Number(result.amount) !== Number(order.paymentGateway.amount) ||
      String(result.currency).toUpperCase() !== order.currency ||
      String(result.risk_level || '0') !== '0') {
    throw new Error('SSLCOMMERZ validation did not match the order or returned a risky transaction.');
  }
  return {
    paid: true,
    rawStatus: result.status,
    transactionId: result.bank_tran_id || result.tran_id,
    providerPaymentId: result.val_id,
    amount: Number(result.amount),
    currency: result.currency
  };
}

async function capturePayPalReturn({ credentials, mode, order, query }) {
  const paypalOrderId = String(query.token || '');
  if (!paypalOrderId || paypalOrderId !== order.paymentGateway.providerPaymentId) {
    return { paid: false, rawStatus: 'order_mismatch' };
  }
  const accessToken = await getPayPalAccessToken(credentials, mode);
  const result = await requestJson(`${gatewayBase('paypal', mode)}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    headers: {
      ...jsonHeaders(),
      Authorization: `Bearer ${accessToken}`,
      'PayPal-Request-Id': `${order.id}-capture`
    },
    body: '{}'
  });
  const capture = result.purchase_units?.[0]?.payments?.captures?.[0];
  if (result.status !== 'COMPLETED' || !capture || result.purchase_units?.[0]?.custom_id !== order.id ||
      Number(capture.amount?.value) !== Number(order.paymentGateway.amount) ||
      String(capture.amount?.currency_code).toUpperCase() !== order.currency) {
    throw new Error('PayPal payment details did not match the order.');
  }
  return {
    paid: true,
    rawStatus: result.status,
    transactionId: capture.id,
    providerPaymentId: paypalOrderId,
    amount: Number(capture.amount.value),
    currency: capture.amount.currency_code
  };
}

async function refundBkash({ tiwiId, credentials, mode, order, refund }) {
  const paymentId = order.paymentGateway?.providerPaymentId;
  const transactionId = order.paymentGateway?.transactionId;
  if (!paymentId || !transactionId) throw new TypeError('The original bKash transaction reference is unavailable.');
  const paidAt = Date.parse(order.paymentGateway?.completedAt || order.date || '');
  if (!Number.isFinite(paidAt) || Date.now() - paidAt > 60 * 24 * 60 * 60 * 1000) {
    throw new TypeError('bKash refunds must be issued within 60 days of the original payment.');
  }
  const existingRefunds = (order.refundHistory || []).filter(entry =>
    entry.id !== refund.id &&
    ['gateway_processing', 'gateway_pending', 'gateway_unknown', 'gateway_confirmed'].includes(entry.status)
  );
  if (existingRefunds.length >= 10) {
    throw new TypeError('bKash allows up to 10 refund attempts per original payment.');
  }
  const token = await getBkashToken(tiwiId, credentials, mode);
  const result = await requestJson(
    `${gatewayBase('bkash', mode)}/refund/payment/transaction`,
    {
      method: 'POST',
      headers: { ...jsonHeaders(), Authorization: token, 'X-App-Key': credentials.appKey },
      body: JSON.stringify({
        paymentId,
        trxId: transactionId,
        refundAmount: Number(refund.amount).toFixed(2),
        sku: String(order.invoiceNumber).slice(0, 255),
        reason: String(refund.reason || 'Customer refund').slice(0, 255)
      })
    }
  );
  if (result.refundTransactionStatus !== 'Completed' ||
      String(result.originalTrxId) !== String(transactionId) ||
      Math.abs(Number(result.refundAmount) - Number(refund.amount)) > 0.005 ||
      String(result.currency).toUpperCase() !== String(order.currency).toUpperCase() ||
      !result.refundTrxId) {
    throw new Error('bKash did not confirm the requested refund amount.');
  }
  return {
    status: 'succeeded',
    providerRefundId: result.refundTrxId,
    amount: Number(result.refundAmount),
    currency: result.currency
  };
}

async function refundStripe({ credentials, order, refund }) {
  const paymentIntent = order.paymentGateway?.transactionId;
  if (!paymentIntent) throw new TypeError('The original Stripe payment reference is unavailable.');
  const params = new URLSearchParams({
    payment_intent: paymentIntent,
    amount: String(Math.round(Number(refund.amount) * 100)),
    'metadata[order_id]': order.id,
    'metadata[refund_id]': refund.id,
    'metadata[tenant_id]': order.paymentGateway.tiwiId,
    reason: 'requested_by_customer'
  });
  const result = await requestJson(`${gatewayBase('stripe')}/v1/refunds`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credentials.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `tiwlo-refund-${refund.id}`
    },
    body: params
  });
  if (Number(result.amount) !== Math.round(Number(refund.amount) * 100) ||
      String(result.currency).toUpperCase() !== String(order.currency).toUpperCase() ||
      !result.id || !['succeeded', 'pending'].includes(result.status)) {
    throw new Error('Stripe did not confirm the requested refund details.');
  }
  return {
    status: result.status,
    providerRefundId: result.id,
    amount: Number(result.amount) / 100,
    currency: result.currency
  };
}

async function refundPayPal({ credentials, mode, order, refund }) {
  const captureId = order.paymentGateway?.transactionId;
  if (!captureId) throw new TypeError('The original PayPal capture reference is unavailable.');
  const accessToken = await getPayPalAccessToken(credentials, mode);
  const result = await requestJson(
    `${gatewayBase('paypal', mode)}/v2/payments/captures/${encodeURIComponent(captureId)}/refund`,
    {
      method: 'POST',
      headers: {
        ...jsonHeaders(),
        Authorization: `Bearer ${accessToken}`,
        'PayPal-Request-Id': `tiwlo-refund-${refund.id}`
      },
      body: JSON.stringify({
        amount: {
          value: Number(refund.amount).toFixed(2),
          currency_code: order.currency
        },
        invoice_id: String(order.invoiceNumber).slice(0, 127),
        note_to_payer: String(refund.reason || 'Customer refund').slice(0, 255)
      })
    }
  );
  const amount = Number(result.amount?.value);
  const currency = String(result.amount?.currency_code || '').toUpperCase();
  if (!result.id || !['COMPLETED', 'PENDING'].includes(String(result.status).toUpperCase()) ||
      Math.abs(amount - Number(refund.amount)) > 0.005 ||
      currency !== String(order.currency).toUpperCase()) {
    throw new Error('PayPal did not confirm the requested refund details.');
  }
  return {
    status: String(result.status).toUpperCase() === 'COMPLETED' ? 'succeeded' : 'pending',
    providerRefundId: result.id,
    amount,
    currency
  };
}

export async function createHostedRefund({ provider, tiwiId, credentials, mode, order, refund }) {
  if (provider === 'bkash') return refundBkash({ tiwiId, credentials, mode, order, refund });
  if (provider === 'stripe') return refundStripe({ credentials, order, refund });
  if (provider === 'paypal') return refundPayPal({ credentials, mode, order, refund });
  throw new TypeError('Automatic refunds are not available for this payment provider.');
}

export async function verifyHostedPaymentReturn({ provider, tiwiId, credentials, mode, order, query, body }) {
  if (provider === 'bkash') return executeBkashReturn({ tiwiId, credentials, mode, order, query });
  if (provider === 'stripe') return verifyStripeReturn({ credentials, order, query });
  if (provider === 'paypal') return capturePayPalReturn({ credentials, mode, order, query });
  if (provider === 'sslcommerz') return validateSslCommerz({ credentials, mode, order, body });
  throw new TypeError('This payment provider is not available for online checkout.');
}

export async function verifyStripeWebhook({ credentials, rawBody, signature, order }) {
  if (!verifyStripeWebhookSignature(rawBody, signature, credentials.webhookSecret)) {
    throw new TypeError('Stripe webhook signature is invalid.');
  }
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new TypeError('Stripe webhook payload is invalid.');
  }
  const session = event.data?.object;
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) ||
      session?.payment_status !== 'paid') {
    return { paid: false, rawStatus: event.type || 'ignored', eventId: event.id };
  }
  if (session.metadata?.order_id !== order.id || session.metadata?.tenant_id !== order.paymentGateway.tiwiId ||
      session.id !== order.paymentGateway.providerPaymentId ||
      Number(session.amount_total) !== Number(order.paymentGateway.amountMinor) ||
      String(session.currency).toUpperCase() !== order.currency) {
    throw new Error('Stripe webhook payment details did not match the order.');
  }
  return {
    paid: true,
    rawStatus: event.type,
    eventId: event.id,
    transactionId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
    providerPaymentId: session.id,
    amount: Number(session.amount_total) / 100,
    currency: session.currency
  };
}
