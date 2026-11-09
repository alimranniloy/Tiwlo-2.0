import crypto from 'node:crypto';
import { getPgPool, queryPg } from '../server/db/postgres.js';
import { getPlatformPaymentGatewaysRaw } from '../server/administrator/adminRoutes.js';
import {
  CHECKOUT_READY_PROVIDERS,
  PAYMENT_PROVIDER_DEFINITIONS
} from '../server/routes/paymentProviderHelpers.js';
import {
  createHostedPayment,
  verifyHostedPaymentReturn
} from '../server/routes/storePaymentGatewayService.js';
import { getPlatformUrl } from '../server/config/platformConfig.js';
import { notifyDeliveryPartnersForOrder } from './deliveryRoutes.js';

export const PICK_MOBILE_PAYMENT_CALLBACK = 'pick://payment/callback';
const PICK_PAYMENT_CURRENCIES = Object.freeze({ bkash: 'BDT', sslcommerz: 'BDT' });
let expiryTimer = null;

export function getPickPaymentProviders(gateways) {
  return Object.entries(PICK_PAYMENT_CURRENCIES).flatMap(([id, currency]) => {
    const gateway = gateways?.[id];
    const credentialsReady = id === 'bkash'
      ? Boolean(gateway?.appKey && gateway?.appSecret && gateway?.username && gateway?.password)
      : Boolean(gateway?.storeId && gateway?.storePassword);
    if (!CHECKOUT_READY_PROVIDERS.has(id) || !gateway?.enabled ||
        gateway.mode !== 'live' || !credentialsReady ||
        !Array.isArray(gateway.currencies) || !gateway.currencies.includes(currency)) {
      return [];
    }
    return [{ id, name: PAYMENT_PROVIDER_DEFINITIONS[id].name, currency }];
  });
}

export async function getAvailablePickPaymentProviders() {
  return getPickPaymentProviders(await getPlatformPaymentGatewaysRaw());
}

function getTerminalStatus(rawStatus) {
  const status = String(rawStatus || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (status === 'expired') return 'expired';
  if (['cancel', 'cancelled', 'canceled'].includes(status)) return 'cancelled';
  if (['fail', 'failed', 'failure', 'declined', 'invalid'].includes(status)) return 'failed';
  return null;
}

function resultFromStatus(status) {
  if (status === 'paid') return 'success';
  if (status === 'pending') return 'pending';
  if (status === 'failed') return 'failed';
  if (status === 'expired') return 'expired';
  return 'cancelled';
}

export async function getPickPaymentGateway(provider, { requireEnabled = true } = {}) {
  const currency = PICK_PAYMENT_CURRENCIES[provider];
  if (!currency || !CHECKOUT_READY_PROVIDERS.has(provider)) {
    throw new TypeError('Choose an available PICK payment method.');
  }
  const gateways = await getPlatformPaymentGatewaysRaw();
  const gateway = gateways[provider];
  const isConfigured = getPickPaymentProviders(gateways).some(item => item.id === provider);
  const credentialsPresent = provider === 'bkash'
    ? Boolean(gateway?.appKey && gateway?.appSecret && gateway?.username && gateway?.password)
    : Boolean(gateway?.storeId && gateway?.storePassword);
  if (!credentialsPresent || gateway?.mode !== 'live' || (requireEnabled && !isConfigured)) {
    throw new TypeError('This payment method is not enabled for PICK checkout.');
  }
  return { gateway, currency };
}

async function releaseOrderInventory(client, orderId) {
  const { rows } = await client.query(
    `UPDATE pick.orders SET inventory_released = TRUE
     WHERE id = $1 AND order_type = 'grocery' AND inventory_released = FALSE
     RETURNING id`,
    [orderId]
  );
  if (!rows.length) return;
  await client.query(
    `UPDATE pick.products p
     SET stock_quantity = p.stock_quantity + i.quantity, updated_at = CURRENT_TIMESTAMP
     FROM pick.order_items i
     WHERE i.order_id = $1 AND i.product_id = p.id`,
    [orderId]
  );
}

export async function setPickPaymentStatus(orderId, paymentStatus, transactionId = null) {
  const pool = getPgPool();
  if (!pool) throw new Error('PostgreSQL is unavailable.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT payment_status, order_type FROM pick.orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    const order = rows[0];
    if (!order) {
      await client.query('ROLLBACK');
      return null;
    }
    if (order.payment_status === 'paid') {
      await client.query('COMMIT');
      return { paymentStatus: 'paid' };
    }
    if (paymentStatus === 'paid') {
      const latePayment = order.payment_status !== 'pending';
      await client.query(
        `UPDATE pick.orders
         SET payment_status = 'paid', payment_transaction_id = $2,
             status = CASE WHEN $3 THEN 'payment_review' ELSE 'placed' END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId, transactionId, latePayment]
      );
    } else if (['pending', 'unpaid'].includes(order.payment_status)) {
      await client.query(
        `UPDATE pick.orders
         SET payment_status = $2,
             status = CASE WHEN $2 = 'failed' THEN 'payment_failed' ELSE 'cancelled' END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId, paymentStatus]
      );
      await releaseOrderInventory(client, orderId);
    }
    const { rows: updated } = await client.query(
      'SELECT payment_status AS "paymentStatus", status FROM pick.orders WHERE id = $1',
      [orderId]
    );
    await client.query('COMMIT');
    if (paymentStatus === 'paid' && order.order_type === 'parcel' &&
        updated[0]?.status === 'placed') {
      notifyDeliveryPartnersForOrder(orderId).catch((notificationError) => {
        console.error('PICK Delivery paid-parcel notification failed:', notificationError);
      });
    }
    return updated[0] || null;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('PICK payment rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function startPickHostedPayment({ order, provider, user, profile }) {
  let gateway;
  let currency;
  try {
    ({ gateway, currency } = await getPickPaymentGateway(provider));
    if (provider === 'sslcommerz' && !String(profile?.phone || user?.phone || '').trim()) {
      throw new TypeError('Add a phone number to your Tiwlo profile before using SSLCOMMERZ.');
    }
  } catch (error) {
    await setPickPaymentStatus(order.id, 'failed');
    throw error;
  }
  const returnToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(returnToken).digest('hex');
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
  const saved = await queryPg(
    `UPDATE pick.orders
     SET payment_status = 'pending', payment_provider = $2, payment_mode = $3,
         payment_method = $2, payment_return_token_hash = $4,
         payment_expires_at = $5, status = 'pending_payment',
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 AND payment_status = 'unpaid'
     RETURNING id`,
    [order.id, provider, gateway.mode, tokenHash, expiresAt]
  );
  if (!saved.rows.length) throw new Error('The PICK order is no longer available for payment.');

  const callbackUrl = new URL(
    `/api/pick/payments/return/${provider}`,
    getPlatformUrl()
  );
  callbackUrl.searchParams.set('orderId', order.id);
  callbackUrl.searchParams.set('returnToken', returnToken);
  const paymentOrder = {
    id: order.id,
    invoiceNumber: order.id,
    currency,
    customerEmail: user.email || '',
    customerName: profile?.display_name || user.name || 'PICK customer',
    customerPhone: profile?.phone || user.phone || '',
    deliveryAddress: order.deliveryAddress,
    shippingAddress: { street: order.deliveryAddress, city: 'Dhaka', country: 'Bangladesh' },
    paymentGateway: {
      amount: Number(order.total),
      amountMinor: Math.round(Number(order.total) * 100),
      tiwiId: 'pick-platform'
    }
  };
  try {
    const checkout = await createHostedPayment({
      provider,
      tiwiId: 'pick-platform',
      credentials: gateway,
      mode: gateway.mode,
      order: paymentOrder,
      callbackUrl: callbackUrl.toString(),
      successUrl: `${callbackUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${callbackUrl}&result=cancelled`
    });
    await queryPg(
      `UPDATE pick.orders
       SET provider_payment_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND payment_status = 'pending'`,
      [order.id, checkout.providerPaymentId]
    );
    return { checkoutUrl: checkout.checkoutUrl, expiresAt };
  } catch (error) {
    await setPickPaymentStatus(order.id, 'failed');
    throw error;
  }
}

async function handlePickPaymentReturn(req, res, { ipn = false, providerOverride } = {}) {
  const provider = String(providerOverride || req.params.provider || '').toLowerCase();
  const orderId = String(req.query?.orderId || '');
  const returnToken = String(req.query?.returnToken || '');
  const redirect = result => {
    const callback = new URL(PICK_MOBILE_PAYMENT_CALLBACK);
    if (orderId) callback.searchParams.set('orderId', orderId);
    callback.searchParams.set('result', result);
    return ipn
      ? res.json({ received: true, status: result })
      : res.redirect(303, callback.toString());
  };

  try {
    const { rows } = await queryPg(
      `SELECT id, total::float8 AS total, delivery_address AS "deliveryAddress",
              payment_status AS "paymentStatus", payment_mode AS "paymentMode",
              provider_payment_id AS "providerPaymentId",
              payment_return_token_hash AS "returnTokenHash"
       FROM pick.orders WHERE id = $1 AND payment_provider = $2 LIMIT 1`,
      [orderId, provider]
    );
    const order = rows[0];
    const suppliedHash = crypto.createHash('sha256').update(returnToken).digest();
    const expectedHash = Buffer.from(String(order?.returnTokenHash || ''), 'hex');
    if (!order || !returnToken || expectedHash.length !== suppliedHash.length ||
        !crypto.timingSafeEqual(expectedHash, suppliedHash)) {
      return ipn ? res.status(404).json({ error: 'PICK payment not found.' }) : redirect('failed');
    }
    if (order.paymentStatus === 'paid') return redirect('success');

    const terminalHint = getTerminalStatus(
      req.query?.result || req.query?.status || req.body?.status
    );
    if (terminalHint) {
      const status = await setPickPaymentStatus(order.id, terminalHint);
      return redirect(resultFromStatus(status?.paymentStatus));
    }

    const { gateway } = await getPickPaymentGateway(provider, { requireEnabled: false });
    const verification = await verifyHostedPaymentReturn({
      provider,
      tiwiId: 'pick-platform',
      credentials: gateway,
      mode: order.paymentMode,
      order: {
        id: order.id,
        invoiceNumber: order.id,
        currency: PICK_PAYMENT_CURRENCIES[provider],
        paymentGateway: {
          amount: Number(order.total),
          amountMinor: Math.round(Number(order.total) * 100),
          tiwiId: 'pick-platform',
          providerPaymentId: order.providerPaymentId
        }
      },
      query: req.query || {},
      body: req.body || {}
    });
    if (!verification.paid) {
      const terminalStatus = getTerminalStatus(verification.rawStatus);
      if (terminalStatus) {
        const status = await setPickPaymentStatus(order.id, terminalStatus);
        return redirect(resultFromStatus(status?.paymentStatus));
      }
      return redirect('pending');
    }
    if (Math.abs(Number(verification.amount) - Number(order.total)) > 0.005 ||
        String(verification.currency).toUpperCase() !== PICK_PAYMENT_CURRENCIES[provider] ||
        String(verification.providerPaymentId) !== String(order.providerPaymentId)) {
      throw new Error('Verified PICK payment did not match the stored order.');
    }
    const status = await setPickPaymentStatus(order.id, 'paid', verification.transactionId || null);
    return redirect(resultFromStatus(status?.paymentStatus));
  } catch (error) {
    console.error('[PICK payment] Payment return verification failed:', error.message);
    return ipn
      ? res.status(400).json({ error: 'PICK payment could not be verified.' })
      : redirect('pending');
  }
}

export function registerPickPaymentRoutes(router, requireUser) {
  router.get('/payments/providers', requireUser, async (_req, res, next) => {
    try {
      const gateways = await getPlatformPaymentGatewaysRaw();
      return res.json({ providers: getPickPaymentProviders(gateways) });
    } catch (error) {
      return next(error);
    }
  });
  router.get('/payments/return/:provider', (req, res) => handlePickPaymentReturn(req, res));
  router.post('/payments/return/:provider', (req, res) => handlePickPaymentReturn(req, res));
  router.post('/payments/ipn/sslcommerz', (req, res) =>
    handlePickPaymentReturn(req, res, { ipn: true, providerOverride: 'sslcommerz' }));
  router.get('/payments/:orderId', requireUser, async (req, res, next) => {
    try {
      const result = await queryPg(
        `SELECT id, status, payment_status AS "paymentStatus",
                payment_method AS "paymentMethod", payment_expires_at AS "expiresAt"
         FROM pick.orders WHERE id = $1 AND tiwlo_user_id = $2 LIMIT 1`,
        [req.params.orderId, req.tiwloSession.user.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'PICK order not found.' });
      return res.json({ payment: result.rows[0] });
    } catch (error) {
      return next(error);
    }
  });
}

export async function expirePendingPickPayments() {
  const pool = getPgPool();
  if (!pool) return 0;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT id FROM pick.orders
       WHERE payment_status = 'pending' AND payment_expires_at <= CURRENT_TIMESTAMP
       ORDER BY payment_expires_at
       LIMIT 100 FOR UPDATE SKIP LOCKED`
    );
    for (const { id } of rows) {
      await client.query(
        `UPDATE pick.orders SET payment_status = 'expired', status = 'cancelled',
                updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND payment_status = 'pending'`,
        [id]
      );
      await releaseOrderInventory(client, id);
    }
    await client.query('COMMIT');
    return rows.length;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('PICK payment expiry rollback failed:', rollbackError);
    }
    throw error;
  } finally {
    client.release();
  }
}

export function startPickPaymentExpiry() {
  if (expiryTimer) return;
  const run = () => expirePendingPickPayments().catch(error => {
    console.error('[PICK payment] Pending payment expiry failed:', error.message);
  });
  run();
  expiryTimer = setInterval(run, 60_000);
  expiryTimer.unref?.();
}
