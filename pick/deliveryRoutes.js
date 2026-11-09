import { createRequire } from 'node:module';
import { getPgPool, queryPg } from '../server/db/postgres.js';
import { findCoverageZone } from './coverage.js';
import {
  canTransitionDeliveryJob,
  DEFAULT_DELIVERY_VEHICLE_POLICIES,
  getDeliveryOrderStatus,
  isDeliveryJobEligible,
  isValidDriverLocation,
  normalizeDeliveryVehicleType,
  validateVehicleCapacity
} from './deliveryLogic.js';

const require = createRequire(new URL('../server/package.json', import.meta.url));
const express = require('express');
const LOCATION_MAX_AGE_MS = 120_000;

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeProfile(row) {
  if (!row) return null;
  return {
    vehicleType: row.vehicleType,
    vehicleName: row.vehicleName,
    vehicleCapacityKg: Number(row.vehicleCapacityKg),
    vehicleRegistration: row.vehicleRegistration || '',
    applicationStatus: row.applicationStatus,
    applicationNote: row.applicationNote || '',
    reviewedAt: row.reviewedAt,
    isOnDuty: Boolean(row.isOnDuty),
    currentLatitude: row.currentLatitude === null ? null : Number(row.currentLatitude),
    currentLongitude: row.currentLongitude === null ? null : Number(row.currentLongitude),
    currentAccuracy: row.currentAccuracy === null ? null : Number(row.currentAccuracy),
    currentLocationAt: row.currentLocationAt,
    lastSeenAt: row.lastSeenAt,
    policy: {
      maxCapacityKg: Number(row.maxCapacityKg),
      pickupRangeMeters: Number(row.pickupRangeMeters),
      deliveryRangeMeters: Number(row.deliveryRangeMeters)
    }
  };
}

async function loadDriverProfile(userId, executor = queryPg) {
  const { rows } = await executor(
    `SELECT d.vehicle_type AS "vehicleType", p.name_en AS "vehicleName",
            d.vehicle_capacity_kg::float8 AS "vehicleCapacityKg",
            d.vehicle_registration AS "vehicleRegistration",
            d.application_status AS "applicationStatus",
            d.application_note AS "applicationNote",
            d.reviewed_at AS "reviewedAt", d.is_on_duty AS "isOnDuty",
            d.current_latitude AS "currentLatitude",
            d.current_longitude AS "currentLongitude",
            d.current_accuracy AS "currentAccuracy",
            d.current_location_at AS "currentLocationAt",
            d.last_seen_at AS "lastSeenAt",
            p.max_capacity_kg::float8 AS "maxCapacityKg",
            p.pickup_range_meters AS "pickupRangeMeters",
            p.delivery_range_meters AS "deliveryRangeMeters"
     FROM pick.delivery_profiles d
     JOIN pick.delivery_vehicle_policies p ON p.vehicle_type = d.vehicle_type
     WHERE d.tiwlo_user_id = $1`,
    [userId]
  );
  return normalizeProfile(rows[0]);
}

async function loadCoverageZones(executor = queryPg) {
  const { rows } = await executor(
    `SELECT id, name_en AS "nameEn", name_bn AS "nameBn",
            center_latitude AS "centerLatitude", center_longitude AS "centerLongitude",
            radius_meters AS "radiusMeters", active
     FROM pick.coverage_zones WHERE active = TRUE`
  );
  return rows;
}

async function loadEligibleOffers(driver, executor = queryPg) {
  const [{ rows: policyRows }, { rows: orderRows }, zones] = await Promise.all([
    executor(
      `SELECT vehicle_type AS "vehicleType", name_en AS "nameEn",
              max_capacity_kg::float8 AS "maxCapacityKg",
              pickup_range_meters AS "pickupRangeMeters",
              delivery_range_meters AS "deliveryRangeMeters"
       FROM pick.delivery_vehicle_policies WHERE vehicle_type = $1 AND active = TRUE`,
      [driver.vehicleType]
    ),
    executor(
      `SELECT o.id, o.status, o.payment_method AS "paymentMethod",
              o.payment_status AS "paymentStatus", o.total::float8 AS total,
              o.created_at AS "createdAt", o.parcel_details AS "parcelDetails",
              o.delivery_address AS "deliveryAddress",
              v.id AS "requestedVehicleId", v.name_en AS "requestedVehicleName"
       FROM pick.orders o
       JOIN pick.parcel_vehicles v
         ON v.id = COALESCE(o.parcel_details->'vehicle'->>'id', '')
       WHERE o.order_type = 'parcel'
         AND o.status IN ('placed', 'preparing')
         AND (o.payment_method = 'cod' OR o.payment_status = 'paid')
         AND v.active = TRUE
         AND NOT EXISTS (
           SELECT 1 FROM pick.delivery_assignments a
           WHERE a.order_id = o.id AND a.status <> 'cancelled'
         )
       ORDER BY o.created_at ASC
       LIMIT 250`
    ),
    loadCoverageZones(executor)
  ]);
  const policy = policyRows[0];
  if (!policy) return [];
  return orderRows.filter((order) => {
    const parcelDetails = typeof order.parcelDetails === 'string'
      ? JSON.parse(order.parcelDetails)
      : order.parcelDetails;
    const requestedType = normalizeDeliveryVehicleType(
      `${order.requestedVehicleId || ''} ${order.requestedVehicleName || ''}`
    );
    return requestedType === driver.vehicleType && isDeliveryJobEligible({
      driver: {
        ...driver,
        latitude: driver.currentLatitude,
        longitude: driver.currentLongitude,
        accuracy: driver.currentAccuracy
      },
      order: { ...order, parcelDetails },
      policy,
      coverageZones: zones
    });
  }).map((order) => ({
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    total: order.total,
    deliveryAddress: order.deliveryAddress,
    pickupAddress: order.parcelDetails?.sender?.address || '',
    pickupLatitude: Number(order.parcelDetails?.sender?.latitude),
    pickupLongitude: Number(order.parcelDetails?.sender?.longitude),
    recipientAddress: order.parcelDetails?.recipient?.address || '',
    recipientLatitude: Number(order.parcelDetails?.recipient?.latitude),
    recipientLongitude: Number(order.parcelDetails?.recipient?.longitude),
    recipientName: order.parcelDetails?.recipient?.name || '',
    weightKg: Number(order.parcelDetails?.package?.weight),
    category: order.parcelDetails?.package?.categoryNameEn || '',
    vehicleName: order.requestedVehicleName
  }));
}

async function sendExpoPushNotifications(tokens, orderId) {
  const messages = tokens.map((to) => ({
    to,
    title: 'New PICK parcel nearby',
    body: 'A parcel that matches your vehicle is ready to accept.',
    sound: 'default',
    priority: 'high',
    channelId: 'pick-delivery-orders',
    ttl: 30,
    data: { type: 'parcel_offer', orderId }
  }));
  for (let offset = 0; offset < messages.length; offset += 100) {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messages.slice(offset, offset + 100))
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result) {
      throw new Error(`Expo push service returned ${response.status}.`);
    }
    const errors = Array.isArray(result.data)
      ? result.data.filter((ticket) => ticket?.status === 'error')
      : [];
    if (errors.length) {
      console.error('PICK Delivery push tickets failed:', errors);
    }
  }
}

export async function notifyDeliveryPartnersForOrder(orderId, executor = queryPg) {
  const { rows: drivers } = await executor(
    `SELECT d.tiwlo_user_id AS "userId",
            d.vehicle_type AS "vehicleType",
            d.vehicle_capacity_kg::float8 AS "vehicleCapacityKg",
            d.application_status AS "applicationStatus",
            d.is_on_duty AS "isOnDuty",
            d.current_latitude AS latitude, d.current_longitude AS longitude,
            d.current_accuracy AS accuracy,
            d.current_location_at AS "currentLocationAt",
            d.expo_push_token AS "pushToken",
            p.name_en AS "vehicleName",
            p.max_capacity_kg::float8 AS "maxCapacityKg",
            p.pickup_range_meters AS "pickupRangeMeters",
            p.delivery_range_meters AS "deliveryRangeMeters"
     FROM pick.delivery_profiles d
     JOIN system_users u ON u.id = d.tiwlo_user_id AND u.is_banned = FALSE
     JOIN pick.delivery_vehicle_policies p
       ON p.vehicle_type = d.vehicle_type AND p.active = TRUE
     WHERE d.application_status = 'approved'
       AND d.is_on_duty = TRUE
       AND d.current_location_at >= CURRENT_TIMESTAMP - INTERVAL '2 minutes'
       AND d.expo_push_token IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM pick.delivery_assignments a
         WHERE a.rider_user_id = d.tiwlo_user_id
           AND a.status IN ('accepted', 'picked_up')
       )`
  );
  if (!drivers.length) return;
  const { rows: orderRows } = await executor(
    `SELECT o.id, o.status, o.payment_method AS "paymentMethod",
            o.payment_status AS "paymentStatus", o.parcel_details AS "parcelDetails",
            v.id AS "requestedVehicleId", v.name_en AS "requestedVehicleName"
     FROM pick.orders o
     JOIN pick.parcel_vehicles v
       ON v.id = COALESCE(o.parcel_details->'vehicle'->>'id', '')
     WHERE o.id = $1 AND o.order_type = 'parcel'
       AND o.status IN ('placed', 'preparing')
       AND (o.payment_method = 'cod' OR o.payment_status = 'paid')
       AND v.active = TRUE`,
    [orderId]
  );
  const order = orderRows[0];
  if (!order) return;
  const parcelDetails = typeof order.parcelDetails === 'string'
    ? JSON.parse(order.parcelDetails)
    : order.parcelDetails;
  const zones = await loadCoverageZones(executor);
  const tokens = drivers.filter((driver) =>
    normalizeDeliveryVehicleType(`${order.requestedVehicleId} ${order.requestedVehicleName}`) === driver.vehicleType &&
    isDeliveryJobEligible({
      driver: { ...driver, currentLatitude: driver.latitude, currentLongitude: driver.longitude },
      order: { ...order, parcelDetails },
      policy: driver,
      coverageZones: zones
    })
  ).map((driver) => driver.pushToken);
  if (tokens.length) await sendExpoPushNotifications(tokens, order.id);
}

function sendInputError(res, error) {
  if (!(error instanceof TypeError)) return false;
  res.status(400).json({ error: error.message });
  return true;
}

export function createPickDeliveryRouter({ requireUser }) {
  const router = express.Router();

  router.get('/options', requireUser, async (_req, res, next) => {
    try {
      const { rows } = await queryPg(
        `SELECT vehicle_type AS "vehicleType", name_en AS "nameEn",
                max_capacity_kg::float8 AS "maxCapacityKg",
                pickup_range_meters AS "pickupRangeMeters",
                delivery_range_meters AS "deliveryRangeMeters"
         FROM pick.delivery_vehicle_policies WHERE active = TRUE
         ORDER BY pickup_range_meters, vehicle_type`
      );
      return res.json({
        vehicles: rows.length ? rows : DEFAULT_DELIVERY_VEHICLE_POLICIES,
        addressVerified: req.tiwloSession.user.addressVerified === true
      });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/profile', requireUser, async (req, res, next) => {
    try {
      return res.json({
        profile: await loadDriverProfile(req.tiwloSession.user.id),
        addressVerified: req.tiwloSession.user.addressVerified === true
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/profile', requireUser, async (req, res, next) => {
    try {
      if (req.tiwloSession.user.addressVerified !== true) {
        return res.status(403).json({ error: 'Verify your Tiwlo address before applying to deliver.' });
      }
      if (!req.tiwloSession.user.phone?.trim()) {
        return res.status(400).json({ error: 'Add a phone number to your Tiwlo account before applying.' });
      }
      const body = req.body || {};
      if (!isRecord(body)) return res.status(400).json({ error: 'Enter valid delivery-partner details.' });
      const vehicleType = normalizeDeliveryVehicleType(body.vehicleType);
      if (!vehicleType) return res.status(400).json({ error: 'Choose a supported delivery vehicle.' });
      const { rows: policies } = await queryPg(
        `SELECT vehicle_type AS "vehicleType", max_capacity_kg::float8 AS "maxCapacityKg"
         FROM pick.delivery_vehicle_policies
         WHERE vehicle_type = $1 AND active = TRUE`,
        [vehicleType]
      );
      const policy = policies[0];
      if (!policy) return res.status(400).json({ error: 'This delivery vehicle is not currently supported.' });
      const capacityKg = validateVehicleCapacity(body.vehicleCapacityKg, policy);
      const registration = typeof body.vehicleRegistration === 'string'
        ? body.vehicleRegistration.trim()
        : '';
      if (registration.length > 80) {
        return res.status(400).json({ error: 'Vehicle registration details are too long.' });
      }
      if (['motorbike', 'car', 'pickup'].includes(vehicleType) && !registration) {
        return res.status(400).json({ error: 'Enter the vehicle registration number for review.' });
      }
      await queryPg(
        `INSERT INTO pick.delivery_profiles
           (tiwlo_user_id, vehicle_type, vehicle_capacity_kg, vehicle_registration,
            application_status, is_on_duty)
         VALUES ($1, $2, $3, $4, 'pending', FALSE)
         ON CONFLICT (tiwlo_user_id) DO UPDATE
         SET vehicle_type = EXCLUDED.vehicle_type,
             vehicle_capacity_kg = EXCLUDED.vehicle_capacity_kg,
             vehicle_registration = EXCLUDED.vehicle_registration,
             application_status = 'pending', application_note = '',
             reviewed_by = NULL, reviewed_at = NULL, is_on_duty = FALSE,
             updated_at = CURRENT_TIMESTAMP`,
        [req.tiwloSession.user.id, vehicleType, capacityKg, registration]
      );
      return res.status(201).json({ profile: await loadDriverProfile(req.tiwloSession.user.id) });
    } catch (error) {
      if (sendInputError(res, error)) return;
      return next(error);
    }
  });

  router.patch('/duty', requireUser, async (req, res, next) => {
    try {
      const isOnDuty = req.body?.isOnDuty;
      if (typeof isOnDuty !== 'boolean') {
        return res.status(400).json({ error: 'Choose whether you want to go on duty.' });
      }
      const profile = await loadDriverProfile(req.tiwloSession.user.id);
      if (!profile) return res.status(409).json({ error: 'Complete your delivery-partner application first.' });
      if (isOnDuty && req.tiwloSession.user.addressVerified !== true) {
        return res.status(403).json({ error: 'Verify your Tiwlo address before starting delivery duty.' });
      }
      if (!isOnDuty) {
        const { rows: activeJobs } = await queryPg(
          `SELECT 1 FROM pick.delivery_assignments
           WHERE rider_user_id = $1 AND status IN ('accepted', 'picked_up')
           LIMIT 1`,
          [req.tiwloSession.user.id]
        );
        if (activeJobs.length) {
          return res.status(409).json({ error: 'Complete your active parcel before ending duty.' });
        }
      }
      if (isOnDuty) {
        if (profile.applicationStatus !== 'approved') {
          return res.status(403).json({ error: 'Your delivery-partner application must be approved before duty starts.' });
        }
        if (!isValidDriverLocation({
          latitude: profile.currentLatitude,
          longitude: profile.currentLongitude,
          accuracy: profile.currentAccuracy
        }) || !profile.currentLocationAt ||
            Date.now() - Date.parse(profile.currentLocationAt) > LOCATION_MAX_AGE_MS) {
          return res.status(409).json({ error: 'Get a fresh, accurate GPS location before going on duty.' });
        }
        const coverage = findCoverageZone(
          profile.currentLatitude,
          profile.currentLongitude,
          await loadCoverageZones()
        );
        if (!coverage.available) {
          return res.status(409).json({ error: 'PICK Delivery is not available at your current location.' });
        }
      }
      await queryPg(
        `UPDATE pick.delivery_profiles
         SET is_on_duty = $2, updated_at = CURRENT_TIMESTAMP,
             last_seen_at = CURRENT_TIMESTAMP
         WHERE tiwlo_user_id = $1`,
        [req.tiwloSession.user.id, isOnDuty]
      );
      return res.json({ isOnDuty });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/location', requireUser, async (req, res, next) => {
    try {
      const location = req.body || {};
      if (!isValidDriverLocation(location)) {
        return res.status(400).json({ error: 'Send a valid GPS location with accuracy within 200 metres.' });
      }
      const { rows: profileRows } = await queryPg(
        `SELECT application_status AS "applicationStatus", is_on_duty AS "isOnDuty"
         FROM pick.delivery_profiles WHERE tiwlo_user_id = $1`,
        [req.tiwloSession.user.id]
      );
      const profile = profileRows[0];
      if (!profile) return res.status(409).json({ error: 'Complete your delivery-partner application first.' });
      if (profile.applicationStatus !== 'approved') {
        return res.status(403).json({ error: 'Your delivery-partner application is not approved yet.' });
      }
      if (req.tiwloSession.user.addressVerified !== true) {
        await queryPg(
          `UPDATE pick.delivery_profiles
           SET is_on_duty = FALSE, updated_at = CURRENT_TIMESTAMP
           WHERE tiwlo_user_id = $1`,
          [req.tiwloSession.user.id]
        );
        return res.status(403).json({ error: 'Verify your Tiwlo address before sharing delivery location.' });
      }
      const coverage = findCoverageZone(location.latitude, location.longitude, await loadCoverageZones());
      const { rows } = await queryPg(
        `UPDATE pick.delivery_profiles
         SET current_latitude = $2, current_longitude = $3, current_accuracy = $4,
             current_location_at = CURRENT_TIMESTAMP, last_seen_at = CURRENT_TIMESTAMP,
             is_on_duty = CASE WHEN $5 THEN is_on_duty ELSE FALSE END,
             updated_at = CURRENT_TIMESTAMP
         WHERE tiwlo_user_id = $1
         RETURNING is_on_duty AS "isOnDuty"`,
        [req.tiwloSession.user.id, Number(location.latitude), Number(location.longitude),
          Number(location.accuracy), coverage.available]
      );
      return res.json({
        saved: true,
        isOnDuty: Boolean(rows[0]?.isOnDuty),
        coverageAvailable: coverage.available,
        coverageArea: coverage.zone?.nameEn || null
      });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/push-token', requireUser, async (req, res, next) => {
    try {
      const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
      if (!/^Expo(nent)?PushToken\[[A-Za-z0-9._-]{8,200}\]$/.test(token)) {
        return res.status(400).json({ error: 'The notification token is invalid.' });
      }
      const { rowCount } = await queryPg(
        `UPDATE pick.delivery_profiles
         SET expo_push_token = $2, updated_at = CURRENT_TIMESTAMP
         WHERE tiwlo_user_id = $1`,
        [req.tiwloSession.user.id, token]
      );
      if (!rowCount) return res.status(409).json({ error: 'Complete your delivery-partner application first.' });
      return res.json({ registered: true });
    } catch (error) {
      return next(error);
    }
  });

  router.delete('/push-token', requireUser, async (req, res, next) => {
    try {
      await queryPg(
        `UPDATE pick.delivery_profiles
         SET expo_push_token = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE tiwlo_user_id = $1`,
        [req.tiwloSession.user.id]
      );
      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  router.get('/offers', requireUser, async (req, res, next) => {
    try {
      const profile = await loadDriverProfile(req.tiwloSession.user.id);
      if (req.tiwloSession.user.addressVerified !== true) {
        await queryPg(
          `UPDATE pick.delivery_profiles
           SET is_on_duty = FALSE, updated_at = CURRENT_TIMESTAMP
           WHERE tiwlo_user_id = $1`,
          [req.tiwloSession.user.id]
        );
        return res.json({ offers: [] });
      }
      if (!profile || profile.applicationStatus !== 'approved' || !profile.isOnDuty) {
        return res.json({ offers: [] });
      }
      const driver = {
        ...profile,
        latitude: profile.currentLatitude,
        longitude: profile.currentLongitude,
        accuracy: profile.currentAccuracy
      };
      return res.json({ offers: await loadEligibleOffers(driver) });
    } catch (error) {
      return next(error);
    }
  });

  router.get('/jobs', requireUser, async (req, res, next) => {
    try {
      const { rows } = await queryPg(
        `SELECT a.id AS "assignmentId", a.status, a.accepted_at AS "acceptedAt",
                a.picked_up_at AS "pickedUpAt", a.updated_at AS "updatedAt",
                o.id AS "orderId", o.total::float8 AS total,
                o.parcel_details AS "parcelDetails",
                o.delivery_address AS "deliveryAddress"
         FROM pick.delivery_assignments a
         JOIN pick.orders o ON o.id = a.order_id
         WHERE a.rider_user_id = $1 AND a.status IN ('accepted', 'picked_up')
         ORDER BY a.accepted_at DESC`,
        [req.tiwloSession.user.id]
      );
      return res.json({ jobs: rows });
    } catch (error) {
      return next(error);
    }
  });

  router.post('/offers/:orderId/accept', requireUser, async (req, res, next) => {
    const pool = getPgPool();
    let client;
    try {
      if (!pool) throw new Error('PostgreSQL is unavailable.');
      client = await pool.connect();
      await client.query('BEGIN');
      const orderResult = await client.query(
        `SELECT o.id, o.status, o.payment_method AS "paymentMethod",
                o.payment_status AS "paymentStatus", o.parcel_details AS "parcelDetails",
                v.id AS "requestedVehicleId", v.name_en AS "requestedVehicleName"
         FROM pick.orders o
         JOIN pick.parcel_vehicles v
           ON v.id = COALESCE(o.parcel_details->'vehicle'->>'id', '')
         WHERE o.id = $1 AND o.order_type = 'parcel'
           AND o.status IN ('placed', 'preparing')
           AND (o.payment_method = 'cod' OR o.payment_status = 'paid')
           AND v.active = TRUE
         FOR UPDATE OF o`,
        [req.params.orderId]
      );
      const order = orderResult.rows[0];
      if (!order) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'This parcel is no longer available.' });
      }
      const profileResult = await client.query(
        `SELECT d.tiwlo_user_id AS "userId",
                d.vehicle_type AS "vehicleType",
                d.vehicle_capacity_kg::float8 AS "vehicleCapacityKg",
                d.application_status AS "applicationStatus",
                d.is_on_duty AS "isOnDuty",
                d.current_latitude AS "currentLatitude",
                d.current_longitude AS "currentLongitude",
                d.current_accuracy AS "currentAccuracy",
                d.current_location_at AS "currentLocationAt",
                p.name_en AS "vehicleName",
                p.max_capacity_kg::float8 AS "maxCapacityKg",
                p.pickup_range_meters AS "pickupRangeMeters",
                p.delivery_range_meters AS "deliveryRangeMeters"
         FROM pick.delivery_profiles d
         JOIN pick.delivery_vehicle_policies p
           ON p.vehicle_type = d.vehicle_type AND p.active = TRUE
         WHERE d.tiwlo_user_id = $1
         FOR UPDATE OF d`,
        [req.tiwloSession.user.id]
      );
      const driver = profileResult.rows[0];
      const { rows: activeJobs } = await client.query(
        `SELECT id FROM pick.delivery_assignments
         WHERE rider_user_id = $1 AND status IN ('accepted', 'picked_up')
         LIMIT 1`,
        [req.tiwloSession.user.id]
      );
      const parcelDetails = typeof order.parcelDetails === 'string'
        ? JSON.parse(order.parcelDetails)
        : order.parcelDetails;
      const eligible = driver &&
        normalizeDeliveryVehicleType(`${order.requestedVehicleId} ${order.requestedVehicleName}`) === driver.vehicleType &&
        !activeJobs.length &&
        isDeliveryJobEligible({
          driver: {
            ...driver,
            latitude: driver.currentLatitude,
            longitude: driver.currentLongitude,
            accuracy: driver.currentAccuracy
          },
          order: { ...order, parcelDetails },
          policy: driver,
          coverageZones: await loadCoverageZones(client)
        });
      if (!eligible) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'This parcel no longer matches your vehicle, location, or availability.' });
      }
      const { rows: assignments } = await client.query(
        `INSERT INTO pick.delivery_assignments (order_id, rider_user_id, status)
         VALUES ($1, $2, 'accepted')
         RETURNING id AS "assignmentId", status`,
        [order.id, req.tiwloSession.user.id]
      );
      await client.query(
        `UPDATE pick.orders SET status = 'preparing', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [order.id]
      );
      await client.query('COMMIT');
      return res.status(201).json({ job: { ...assignments[0], orderId: order.id } });
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('PICK Delivery offer rollback failed:', rollbackError);
        }
      }
      if (error?.code === '23505') {
        return res.status(409).json({ error: 'This parcel or another delivery has already been accepted.' });
      }
      return next(error);
    } finally {
      client?.release();
    }
  });

  router.patch('/jobs/:assignmentId/status', requireUser, async (req, res, next) => {
    const nextStatus = req.body?.status;
    if (!['picked_up', 'delivered', 'cancelled'].includes(nextStatus)) {
      return res.status(400).json({ error: 'Choose a valid delivery status.' });
    }
    const pool = getPgPool();
    let client;
    try {
      if (!pool) throw new Error('PostgreSQL is unavailable.');
      client = await pool.connect();
      await client.query('BEGIN');
      const { rows } = await client.query(
        `SELECT id, order_id AS "orderId", status
         FROM pick.delivery_assignments
         WHERE id = $1 AND rider_user_id = $2
         FOR UPDATE`,
        [req.params.assignmentId, req.tiwloSession.user.id]
      );
      const assignment = rows[0];
      if (!assignment) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'This delivery job was not found.' });
      }
      if (!canTransitionDeliveryJob(assignment.status, nextStatus)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: `A delivery cannot move from ${assignment.status} to ${nextStatus}.` });
      }
      await client.query(
        `UPDATE pick.delivery_assignments
         SET status = $2,
             picked_up_at = CASE WHEN $2 = 'picked_up' THEN CURRENT_TIMESTAMP ELSE picked_up_at END,
             delivered_at = CASE WHEN $2 = 'delivered' THEN CURRENT_TIMESTAMP ELSE delivered_at END,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [assignment.id, nextStatus]
      );
      const orderStatus = getDeliveryOrderStatus(nextStatus) ||
        (nextStatus === 'cancelled' ? 'placed' : null);
      if (orderStatus) {
        await client.query(
          `UPDATE pick.orders SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [assignment.orderId, orderStatus]
        );
      }
      await client.query('COMMIT');
      return res.json({ assignmentId: assignment.id, status: nextStatus, orderStatus });
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          console.error('PICK Delivery job status rollback failed:', rollbackError);
        }
      }
      return next(error);
    } finally {
      client?.release();
    }
  });

  return router;
}
