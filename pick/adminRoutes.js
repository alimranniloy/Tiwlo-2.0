import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { queryPg } from '../server/db/postgres.js';
import { requireAdmin } from '../server/administrator/adminRoutes.js';
import { getAvailablePickPaymentProviders } from './payments.js';
import { getPickGroceryDeliveryFee } from './pricing.js';
import { findCoverageZone, normalizeCoverageZone } from './coverage.js';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const express = require('express');
const router = express.Router();

const PRODUCT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORDER_STATUSES = new Set(['preparing', 'in_transit', 'delivered']);

router.use(requireAdmin);

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredText(value, label, maxLength = 255) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new TypeError(`Enter a valid ${label}.`);
  }
  return value.trim();
}

function optionalText(value, label, maxLength = 1000) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new TypeError(`Enter a valid ${label}.`);
  }
  return value.trim();
}

function finiteNumber(value, label, { min = 0, max = 100000000 } = {}) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new TypeError(`Enter a valid ${label}.`);
  }
  return parsed;
}

function stringArray(value, label, { maxLength = 128, maxItems = 30 } = {}) {
  if (!Array.isArray(value) || value.length < 1 || value.length > maxItems ||
      value.some(item => typeof item !== 'string' || !item.trim() || item.length > maxLength)) {
    throw new TypeError(`Enter valid ${label}.`);
  }
  return value.map(item => item.trim());
}

export function normalizePickAdminProduct(input) {
  if (!isRecord(input)) throw new TypeError('Enter valid product details.');
  const nameEn = requiredText(input.nameEn, 'English product name');
  const nameBn = requiredText(input.nameBn, 'Bangla product name');
  const unitsEn = stringArray(input.unitsEn, 'English units');
  const unitsBn = stringArray(input.unitsBn, 'Bangla units');
  if (unitsEn.length !== unitsBn.length) throw new TypeError('English and Bangla unit counts must match.');
  if (!Array.isArray(input.unitPrices) || input.unitPrices.length !== unitsEn.length) {
    throw new TypeError('Enter a price for every product unit.');
  }
  const unitPrices = input.unitPrices.map((value, index) =>
    finiteNumber(value, `price for unit ${index + 1}`)
  );
  const categoryId = optionalText(input.categoryId, 'category', 64);
  return {
    categoryId: categoryId || null,
    sku: optionalText(input.sku, 'SKU', 128) || null,
    nameEn,
    nameBn,
    descriptionEn: optionalText(input.descriptionEn, 'English description'),
    descriptionBn: optionalText(input.descriptionBn, 'Bangla description'),
    price: unitPrices[0],
    oldPrice: input.oldPrice === null || input.oldPrice === '' || input.oldPrice === undefined
      ? null
      : finiteNumber(input.oldPrice, 'previous price'),
    unitEn: unitsEn[0],
    unitBn: unitsBn[0],
    unitsEn,
    unitsBn,
    unitPrices,
    imageUrl: optionalText(input.imageUrl, 'image URL', 2000),
    origin: optionalText(input.origin, 'origin', 255),
    deliveryTime: optionalText(input.deliveryTime, 'delivery time', 64),
    reviewsCount: optionalText(input.reviewsCount, 'reviews count', 32),
    badge: optionalText(input.badge, 'badge', 64) || null,
    rating: input.rating === undefined ? 0 : finiteNumber(input.rating, 'rating', { max: 5 }),
    stockQuantity: finiteNumber(input.stockQuantity, 'stock quantity', { max: 100000000 })
  };
}

function sendInputError(res, error) {
  if (!(error instanceof TypeError)) return false;
  res.status(400).json({ error: error.message });
  return true;
}

async function getOrders({ orderType = null, limit = 500 } = {}) {
  const { rows } = await queryPg(
    `SELECT o.id, o.order_type AS "orderType", o.status,
            o.delivery_address AS "deliveryAddress",
            o.subtotal::float8 AS subtotal, o.delivery_fee::float8 AS "deliveryFee",
            o.total::float8 AS total, o.payment_method AS "paymentMethod",
            o.payment_status AS "paymentStatus", o.payment_provider AS "paymentProvider",
            o.payment_transaction_id AS "transactionId", o.created_at AS "createdAt",
            u.name AS "customerName", u.email AS "customerEmail",
            COALESCE(p.phone, u.phone, '') AS "customerPhone",
            COALESCE(p.delivery_area, '') AS "deliveryArea",
            o.parcel_details AS "parcelDetails",
            COALESCE(items.items, '[]'::json) AS items
     FROM pick.orders o
     JOIN system_users u ON u.id = o.tiwlo_user_id
     LEFT JOIN pick.profiles p ON p.tiwlo_user_id = o.tiwlo_user_id
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'name', i.product_name_en,
         'nameBn', i.product_name_bn,
         'quantity', i.quantity::float8,
         'unit', i.unit_en,
         'unitBn', i.unit_bn,
         'unitPrice', i.unit_price::float8,
         'lineTotal', i.line_total::float8
       ) ORDER BY i.id) AS items
       FROM pick.order_items i WHERE i.order_id = o.id
     ) items ON TRUE
     WHERE ($1::text IS NULL OR o.order_type = $1)
     ORDER BY o.created_at DESC
     LIMIT $2`,
    [orderType, limit]
  );
  return rows;
}

router.get('/session', (req, res) => {
  const user = req.adminUser;
  return res.json({
    user: {
      id: user.id,
      name: user.name || user.storeName || '',
      email: user.email || '',
      role: user.role
    }
  });
});

router.get('/overview', async (_req, res, next) => {
  try {
    const [summary, hourly, recentOrders] = await Promise.all([
      queryPg(
        `SELECT
           COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS "ordersToday",
           COALESCE(SUM(total) FILTER (
             WHERE created_at >= CURRENT_DATE AND status NOT IN ('cancelled', 'payment_failed')
           ), 0)::float8 AS "orderValueToday",
           COALESCE(SUM(total) FILTER (
             WHERE created_at >= CURRENT_DATE AND payment_status = 'paid'
           ), 0)::float8 AS "paidToday",
           COUNT(*) FILTER (WHERE status IN ('placed', 'preparing', 'in_transit'))::int AS "openOrders",
           COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS "pendingPayments"
         FROM pick.orders`
      ),
      queryPg(
        `SELECT date_trunc('hour', created_at) AS hour,
                COUNT(*)::int AS orders,
                COALESCE(SUM(total), 0)::float8 AS value
         FROM pick.orders
         WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
           AND status NOT IN ('cancelled', 'payment_failed')
         GROUP BY 1 ORDER BY 1`
      ),
      getOrders({ limit: 6 })
    ]);
    return res.json({
      metrics: summary.rows[0],
      hourly: hourly.rows,
      recentOrders,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/categories', async (_req, res, next) => {
  try {
    const { rows } = await queryPg(
      `SELECT c.id, c.name_en AS "nameEn", c.name_bn AS "nameBn",
              c.group_en AS "groupEn", c.group_bn AS "groupBn",
              c.sort_order AS "sortOrder", c.active,
              COUNT(p.id)::int AS "itemCount"
       FROM pick.categories c
       LEFT JOIN pick.products p ON p.category_id = c.id AND p.active = TRUE
       GROUP BY c.id ORDER BY c.sort_order, c.name_en`
    );
    return res.json({ categories: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const nameEn = requiredText(req.body?.nameEn, 'English category name');
    const nameBn = requiredText(req.body?.nameBn, 'Bangla category name');
    const groupEn = optionalText(req.body?.groupEn, 'category group', 128);
    const groupBn = optionalText(req.body?.groupBn, 'Bangla category group', 128);
    const slug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    const id = `cat-${slug || 'category'}-${crypto.randomBytes(4).toString('hex')}`;
    const { rows } = await queryPg(
      `INSERT INTO pick.categories (id, name_en, name_bn, group_en, group_bn)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name_en AS "nameEn", name_bn AS "nameBn",
                 group_en AS "groupEn", group_bn AS "groupBn",
                 sort_order AS "sortOrder", active`,
      [id, nameEn, nameBn, groupEn, groupBn]
    );
    return res.status(201).json({ category: { ...rows[0], itemCount: 0 } });
  } catch (error) {
    if (sendInputError(res, error)) return;
    return next(error);
  }
});

router.patch('/categories/:id', async (req, res, next) => {
  try {
    if (typeof req.body?.active !== 'boolean') {
      return res.status(400).json({ error: 'Category active status is required.' });
    }
    if (!req.body.active) {
      const { rows: products } = await queryPg(
        'SELECT 1 FROM pick.products WHERE category_id = $1 AND active = TRUE LIMIT 1',
        [req.params.id]
      );
      if (products.length) {
        return res.status(409).json({ error: 'Move or deactivate active products before deactivating this category.' });
      }
    }
    const { rows } = await queryPg(
      `UPDATE pick.categories SET active = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name_en AS "nameEn", name_bn AS "nameBn",
                 group_en AS "groupEn", group_bn AS "groupBn",
                 sort_order AS "sortOrder", active`,
      [req.params.id, req.body.active]
    );
    if (!rows[0]) return res.status(404).json({ error: 'PICK category not found.' });
    return res.json({ category: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/products', async (_req, res, next) => {
  try {
    const { rows } = await queryPg(
      `SELECT p.id, p.sku, p.category_id AS "categoryId",
              c.name_en AS "categoryEn", c.name_bn AS category,
              p.name_en AS "nameEn", p.name_bn AS "name",
              p.description_en AS "descriptionEn", p.description_bn AS description,
              p.price::float8 AS price, p.old_price::float8 AS "oldPrice",
              p.unit_en AS "unitEn", p.unit_bn AS unit,
              p.units_en AS "unitsEn", p.units_bn AS units,
              p.unit_prices AS "unitPrices", p.image_url AS image,
              p.origin, p.delivery_time AS "deliveryTime",
              p.reviews_count AS reviews, p.badge,
              p.rating::float8 AS rating, p.stock_quantity::float8 AS "stockCount",
              (p.stock_quantity > 0) AS "inStock", p.active,
              p.created_at AS "createdAt", p.updated_at AS "updatedAt"
       FROM pick.products p
       LEFT JOIN pick.categories c ON c.id = p.category_id
       ORDER BY p.updated_at DESC, p.name_en
       LIMIT 1000`
    );
    return res.json({ products: rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/products', async (req, res, next) => {
  try {
    const product = normalizePickAdminProduct(req.body);
    const { rows } = await queryPg(
      `INSERT INTO pick.products
         (category_id, sku, name_en, name_bn, description_en, description_bn,
          price, old_price, unit_en, unit_bn, units_en, units_bn, unit_prices,
          image_url, origin, delivery_time, reviews_count, badge, rating, stock_quantity, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb,
               $13::jsonb, $14, $15, $16, $17, $18, $19, $20, TRUE)
       RETURNING id`,
      [
        product.categoryId, product.sku, product.nameEn, product.nameBn,
        product.descriptionEn, product.descriptionBn, product.price, product.oldPrice,
        product.unitEn, product.unitBn, JSON.stringify(product.unitsEn),
        JSON.stringify(product.unitsBn), JSON.stringify(product.unitPrices),
        product.imageUrl, product.origin, product.deliveryTime, product.reviewsCount,
        product.badge, product.rating, product.stockQuantity
      ]
    );
    const saved = await queryPg('SELECT * FROM pick.products WHERE id = $1', [rows[0].id]);
    return res.status(201).json({ product: saved.rows[0] });
  } catch (error) {
    if (sendInputError(res, error)) return;
    return next(error);
  }
});

router.patch('/products/:id', async (req, res, next) => {
  try {
    if (!PRODUCT_UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid product ID.' });
    const product = normalizePickAdminProduct(req.body);
    const { rows } = await queryPg(
      `UPDATE pick.products
       SET category_id = $2, sku = $3, name_en = $4, name_bn = $5,
           description_en = $6, description_bn = $7, price = $8, old_price = $9,
           unit_en = $10, unit_bn = $11, units_en = $12::jsonb, units_bn = $13::jsonb,
           unit_prices = $14::jsonb, image_url = $15, origin = $16,
           delivery_time = $17, reviews_count = $18, badge = $19, rating = $20,
           stock_quantity = $21, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND active = TRUE
       RETURNING id, name_en AS "nameEn"`,
      [
        req.params.id, product.categoryId, product.sku, product.nameEn, product.nameBn,
        product.descriptionEn, product.descriptionBn, product.price, product.oldPrice,
        product.unitEn, product.unitBn, JSON.stringify(product.unitsEn),
        JSON.stringify(product.unitsBn), JSON.stringify(product.unitPrices),
        product.imageUrl, product.origin, product.deliveryTime, product.reviewsCount,
        product.badge, product.rating, product.stockQuantity
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Active PICK product not found.' });
    return res.json({ product: rows[0] });
  } catch (error) {
    if (sendInputError(res, error)) return;
    return next(error);
  }
});

router.delete('/products/:id', async (req, res, next) => {
  try {
    if (!PRODUCT_UUID.test(req.params.id)) return res.status(400).json({ error: 'Invalid product ID.' });
    const { rowCount } = await queryPg(
      `UPDATE pick.products SET active = FALSE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND active = TRUE`,
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Active PICK product not found.' });
    return res.sendStatus(204);
  } catch (error) {
    return next(error);
  }
});

router.get('/orders', async (_req, res, next) => {
  try {
    return res.json({ orders: await getOrders() });
  } catch (error) {
    return next(error);
  }
});

router.patch('/orders/:id/status', async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!ORDER_STATUSES.has(status)) {
      return res.status(400).json({ error: 'Choose a supported order status.' });
    }
    const { rows } = await queryPg(
      `UPDATE pick.orders SET status = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
         AND order_type = 'grocery'
         AND status IN ('placed', 'preparing', 'in_transit')
         AND payment_status NOT IN ('pending', 'failed', 'expired', 'cancelled')
         AND (
           ($2 = 'preparing' AND status = 'placed') OR
           ($2 = 'in_transit' AND status = 'preparing') OR
           ($2 = 'delivered' AND status = 'in_transit')
         )
       RETURNING id, status`,
      [req.params.id, status]
    );
    if (!rows[0]) {
      return res.status(409).json({ error: 'This order cannot move to the requested status.' });
    }
    return res.json({ order: rows[0] });
  } catch (error) {
    return next(error);
  }
});

router.get('/users', async (_req, res, next) => {
  try {
    const { rows } = await queryPg(
      `SELECT u.id, u.name, u.email, COALESCE(p.phone, u.phone, '') AS phone,
              COALESCE(p.delivery_address, '') AS address,
              COALESCE(p.delivery_area, '') AS area,
              COUNT(o.id)::int AS "totalOrders",
              COALESCE(SUM(o.total) FILTER (WHERE o.status NOT IN ('cancelled', 'payment_failed')), 0)::float8 AS "orderValue",
              MIN(u.created_at) AS "joinedAt"
       FROM pick.users pu
       JOIN system_users u ON u.id = pu.tiwlo_user_id
       LEFT JOIN pick.profiles p ON p.tiwlo_user_id = u.id
       LEFT JOIN pick.orders o ON o.tiwlo_user_id = u.id
       GROUP BY u.id, p.phone, p.delivery_address, p.delivery_area
       ORDER BY "joinedAt" DESC
       LIMIT 1000`
    );
    return res.json({ users: rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/parcels', async (_req, res, next) => {
  try {
    const [orders, vehicles] = await Promise.all([
      getOrders({ orderType: 'parcel' }),
      queryPg(
        `SELECT id, name_en AS "nameEn", name_bn AS "nameBn",
                eta_minutes AS "etaMinutes", max_weight_kg::float8 AS "maxWeightKg",
                price::float8 AS price, icon, sort_order AS "sortOrder", active
         FROM pick.parcel_vehicles ORDER BY sort_order, id`
      )
    ]);
    return res.json({ orders, vehicles: vehicles.rows });
  } catch (error) {
    return next(error);
  }
});

router.post('/parcel/vehicles', async (req, res, next) => {
  try {
    const id = requiredText(req.body?.id, 'vehicle ID', 64).toLowerCase();
    const nameEn = requiredText(req.body?.nameEn, 'English vehicle name');
    const nameBn = requiredText(req.body?.nameBn, 'Bangla vehicle name');
    const etaMinutes = Math.round(finiteNumber(req.body?.etaMinutes, 'ETA minutes', { min: 1, max: 10080 }));
    const maxWeightKg = finiteNumber(req.body?.maxWeightKg, 'maximum parcel weight', { min: 0.01, max: 100000 });
    const price = finiteNumber(req.body?.price, 'vehicle price');
    const icon = optionalText(req.body?.icon, 'vehicle icon', 32) || 'scooter';
    const { rows } = await queryPg(
      `INSERT INTO pick.parcel_vehicles
         (id, name_en, name_bn, eta_minutes, max_weight_kg, price, icon, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING id, name_en AS "nameEn", name_bn AS "nameBn",
                 eta_minutes AS "etaMinutes", max_weight_kg::float8 AS "maxWeightKg",
                 price::float8 AS price, icon, sort_order AS "sortOrder", active`,
      [id, nameEn, nameBn, etaMinutes, maxWeightKg, price, icon]
    );
    return res.status(201).json({ vehicle: rows[0] });
  } catch (error) {
    if (sendInputError(res, error)) return;
    return next(error);
  }
});

router.patch('/parcel/vehicles/:id', async (req, res, next) => {
  try {
    if (typeof req.body?.active === 'boolean' && Object.keys(req.body).length === 1) {
      const { rows } = await queryPg(
        `UPDATE pick.parcel_vehicles SET active = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 RETURNING id, active`,
        [req.params.id, req.body.active]
      );
      if (!rows[0]) return res.status(404).json({ error: 'PICK parcel vehicle not found.' });
      return res.json({ vehicle: rows[0] });
    }
    const nameEn = requiredText(req.body?.nameEn, 'English vehicle name');
    const nameBn = requiredText(req.body?.nameBn, 'Bangla vehicle name');
    const etaMinutes = Math.round(finiteNumber(req.body?.etaMinutes, 'ETA minutes', { min: 1, max: 10080 }));
    const maxWeightKg = finiteNumber(req.body?.maxWeightKg, 'maximum parcel weight', { min: 0.01, max: 100000 });
    const price = finiteNumber(req.body?.price, 'vehicle price');
    const { rows } = await queryPg(
      `UPDATE pick.parcel_vehicles
       SET name_en = $2, name_bn = $3, eta_minutes = $4, max_weight_kg = $5,
           price = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name_en AS "nameEn", name_bn AS "nameBn",
                 eta_minutes AS "etaMinutes", max_weight_kg::float8 AS "maxWeightKg",
                 price::float8 AS price, icon, sort_order AS "sortOrder", active`,
      [req.params.id, nameEn, nameBn, etaMinutes, maxWeightKg, price]
    );
    if (!rows[0]) return res.status(404).json({ error: 'PICK parcel vehicle not found.' });
    return res.json({ vehicle: rows[0] });
  } catch (error) {
    if (sendInputError(res, error)) return;
    return next(error);
  }
});

router.get('/finance', async (_req, res, next) => {
  try {
    const [summary, transactions] = await Promise.all([
      queryPg(
        `SELECT COUNT(*) FILTER (WHERE payment_status = 'paid')::int AS "paidCount",
                COALESCE(SUM(total) FILTER (WHERE payment_status = 'paid'), 0)::float8 AS "paidTotal",
                COUNT(*) FILTER (WHERE payment_status = 'pending')::int AS "pendingCount",
                COALESCE(SUM(total) FILTER (WHERE payment_status = 'pending'), 0)::float8 AS "pendingTotal",
                COUNT(*) FILTER (WHERE payment_method = 'cod')::int AS "cashOrders",
                COALESCE(SUM(total) FILTER (WHERE payment_method = 'cod' AND status = 'delivered'), 0)::float8 AS "deliveredCodTotal"
         FROM pick.orders`
      ),
      queryPg(
        `SELECT id AS "orderId", order_type AS "orderType",
                payment_method AS "paymentMethod", payment_provider AS "paymentProvider",
                payment_status AS "paymentStatus", payment_transaction_id AS "transactionId",
                total::float8 AS amount, created_at AS "createdAt"
         FROM pick.orders ORDER BY created_at DESC LIMIT 500`
      )
    ]);
    return res.json({ summary: summary.rows[0], transactions: transactions.rows });
  } catch (error) {
    return next(error);
  }
});

router.get('/settings', async (_req, res, next) => {
  try {
    const [deliveryFee, providers] = await Promise.all([
      getPickGroceryDeliveryFee(),
      getAvailablePickPaymentProviders()
    ]);
    return res.json({
      groceryDeliveryFee: deliveryFee,
      paymentProviders: providers
    });
  } catch (error) {
    return next(error);
  }
});

router.put('/settings/grocery-delivery-fee', async (req, res, next) => {
  try {
    const fee = finiteNumber(req.body?.deliveryFee, 'grocery delivery fee', { max: 1000000 });
    const { rows } = await queryPg(
      `INSERT INTO pick.settings (key, value, updated_by)
       VALUES ('grocery_delivery_fee', $1, $2)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
           updated_at = CURRENT_TIMESTAMP
       RETURNING value`,
      [fee.toFixed(2), req.adminUser.id]
    );
    return res.json({ groceryDeliveryFee: Number(rows[0].value) });
  } catch (error) {
    if (sendInputError(res, error)) return;
    return next(error);
  }
});

router.get('/riders', (_req, res) => res.json({
  riders: [],
  connected: false,
  message: 'PICK has no rider account or live fleet service connected yet.'
}));

router.get('/coverage', async (_req, res, next) => {
  try {
    const [zonesResult, locationsResult, waitlistResult] = await Promise.all([
      queryPg(
        `SELECT id, name_en AS "nameEn", name_bn AS "nameBn",
                center_latitude AS "centerLatitude",
                center_longitude AS "centerLongitude",
                radius_meters AS "radiusMeters", active,
                created_at AS "createdAt", updated_at AS "updatedAt"
         FROM pick.coverage_zones ORDER BY active DESC, name_en`
      ),
      queryPg(
        `SELECT u.id AS "userId", u.name, u.email,
                COALESCE(p.phone, u.phone, '') AS phone,
                p.delivery_address AS address, p.delivery_area AS area,
                p.delivery_latitude AS latitude, p.delivery_longitude AS longitude,
                p.updated_at AS "updatedAt"
         FROM pick.profiles p
         JOIN system_users u ON u.id = p.tiwlo_user_id
         WHERE p.delivery_latitude IS NOT NULL AND p.delivery_longitude IS NOT NULL
         ORDER BY p.updated_at DESC LIMIT 1000`
      ),
      queryPg(
        `SELECT w.tiwlo_user_id AS "userId", w.display_name AS name,
                u.email, w.phone, w.delivery_address AS address,
                w.delivery_area AS area, w.delivery_latitude AS latitude,
                w.delivery_longitude AS longitude, w.created_at AS "createdAt",
                w.updated_at AS "updatedAt"
         FROM pick.coverage_waitlist w
         JOIN system_users u ON u.id = w.tiwlo_user_id
         ORDER BY w.updated_at DESC LIMIT 1000`
      )
    ]);
    const zones = zonesResult.rows;
    const locations = locationsResult.rows.map((location) => ({
      ...location,
      coverage: findCoverageZone(location.latitude, location.longitude, zones)
    }));
    const areas = new Map();
    for (const location of locations) {
      const area = location.area || 'Area not provided by Google';
      const summary = areas.get(area) || { area, customers: 0, covered: 0, uncovered: 0 };
      summary.customers += 1;
      summary[location.coverage.available ? 'covered' : 'uncovered'] += 1;
      areas.set(area, summary);
    }
    return res.json({
      zones,
      locations,
      waitlist: waitlistResult.rows,
      areas: [...areas.values()].sort((a, b) => a.area.localeCompare(b.area)),
      summary: {
        activeZones: zones.filter((zone) => zone.active).length,
        coveredLocations: locations.filter((location) => location.coverage.available).length,
        uncoveredLocations: locations.filter((location) => !location.coverage.available).length,
        waitlistCount: waitlistResult.rows.length
      }
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/coverage/zones', async (req, res, next) => {
  try {
    const zone = normalizeCoverageZone(req.body);
    const { rows } = await queryPg(
      `INSERT INTO pick.coverage_zones
         (name_en, name_bn, center_latitude, center_longitude, radius_meters)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name_en AS "nameEn", name_bn AS "nameBn",
                 center_latitude AS "centerLatitude",
                 center_longitude AS "centerLongitude",
                 radius_meters AS "radiusMeters", active,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [zone.nameEn, zone.nameBn, zone.centerLatitude, zone.centerLongitude, zone.radiusMeters]
    );
    return res.status(201).json({ zone: rows[0] });
  } catch (error) {
    if (sendInputError(res, error)) return;
    return next(error);
  }
});

router.patch('/coverage/zones/:id', async (req, res, next) => {
  try {
    if (typeof req.body?.active === 'boolean' && Object.keys(req.body).length === 1) {
      const { rows } = await queryPg(
        `UPDATE pick.coverage_zones SET active = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, name_en AS "nameEn", name_bn AS "nameBn",
                   center_latitude AS "centerLatitude",
                   center_longitude AS "centerLongitude",
                   radius_meters AS "radiusMeters", active,
                   created_at AS "createdAt", updated_at AS "updatedAt"`,
        [req.params.id, req.body.active]
      );
      if (!rows[0]) return res.status(404).json({ error: 'PICK coverage area not found.' });
      return res.json({ zone: rows[0] });
    }
    const zone = normalizeCoverageZone(req.body);
    const { rows } = await queryPg(
      `UPDATE pick.coverage_zones
       SET name_en = $2, name_bn = $3, center_latitude = $4,
           center_longitude = $5, radius_meters = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, name_en AS "nameEn", name_bn AS "nameBn",
                 center_latitude AS "centerLatitude",
                 center_longitude AS "centerLongitude",
                 radius_meters AS "radiusMeters", active,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [req.params.id, zone.nameEn, zone.nameBn, zone.centerLatitude, zone.centerLongitude, zone.radiusMeters]
    );
    if (!rows[0]) return res.status(404).json({ error: 'PICK coverage area not found.' });
    return res.json({ zone: rows[0] });
  } catch (error) {
    if (sendInputError(res, error)) return;
    return next(error);
  }
});

router.get('/promotions', (_req, res) => res.json({
  promotions: [],
  connected: false,
  message: 'PICK checkout does not have a promotion or coupon service connected yet.'
}));

router.get('/broadcasts', (_req, res) => res.json({
  broadcasts: [],
  connected: false,
  message: 'PICK push notification delivery is not configured yet.'
}));

export default router;
