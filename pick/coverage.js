const EARTH_RADIUS_METERS = 6_371_000;

export function distanceBetweenCoordinatesMeters(latitude, longitude, otherLatitude, otherLongitude) {
  const toRadians = (degrees) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(otherLatitude - latitude);
  const longitudeDelta = toRadians(otherLongitude - longitude);
  const rawHaversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(latitude)) *
    Math.cos(toRadians(otherLatitude)) *
    Math.sin(longitudeDelta / 2) ** 2;
  const haversine = Math.min(1, Math.max(0, rawHaversine));
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export async function isWorldwideCoverageEnabled(executor) {
  if (typeof executor !== 'function') return false;
  try {
    const { rows } = await executor(
      `SELECT value FROM pick.settings WHERE key = 'coverage_worldwide' LIMIT 1`
    );
    return String(rows?.[0]?.value || '').toLowerCase() === 'true';
  } catch {
    return false;
  }
}

export async function isGuestLoginEnabled(executor) {
  if (typeof executor !== 'function') return true;
  try {
    const { rows } = await executor(
      `SELECT value FROM pick.settings WHERE key = 'guest_login_enabled' LIMIT 1`
    );
    if (!rows || rows.length === 0) return true;
    return String(rows[0]?.value ?? '').trim().toLowerCase() !== 'false';
  } catch {
    return true;
  }
}

export async function setGuestLoginEnabled(enabled, adminUserId, executor) {
  if (typeof executor !== 'function') {
    throw new TypeError('Database executor is required to update guest login setting.');
  }
  const normalized = Boolean(enabled);
  await executor(
    `INSERT INTO pick.settings (key, value, updated_by, updated_at)
     VALUES ('guest_login_enabled', $1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
    [normalized ? 'true' : 'false', adminUserId || null]
  );
  return normalized;
}

export function findCoverageZone(latitude, longitude, zones, options = {}) {
  const worldwide = Boolean(options?.worldwide);
  const matches = zones
    .filter((zone) => zone.active !== false)
    .map((zone) => ({
      zone,
      distanceMeters: distanceBetweenCoordinatesMeters(
        latitude,
        longitude,
        Number(zone.centerLatitude ?? zone.center_latitude),
        Number(zone.centerLongitude ?? zone.center_longitude)
      )
    }))
    .filter(({ zone, distanceMeters }) =>
      Number.isFinite(distanceMeters) && distanceMeters <= Number(zone.radiusMeters ?? zone.radius_meters)
    )
    .sort((left, right) =>
      Number(left.zone.radiusMeters ?? left.zone.radius_meters) -
      Number(right.zone.radiusMeters ?? right.zone.radius_meters)
    );

  if (!matches.length) {
    if (worldwide && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))) {
      return {
        available: true,
        worldwide: true,
        zone: {
          id: 'worldwide',
          nameEn: 'Worldwide (Testing Mode)',
          nameBn: 'সারা বিশ্ব (টেস্টিং মোড)',
          centerLatitude: Number(latitude),
          centerLongitude: Number(longitude),
          radiusMeters: 20_007_500
        },
        distanceMeters: 0
      };
    }
    return { available: false, zone: null, distanceMeters: null };
  }
  const { zone, distanceMeters } = matches[0];
  return {
    available: true,
    zone: {
      id: zone.id,
      nameEn: zone.nameEn ?? zone.name_en,
      nameBn: zone.nameBn ?? zone.name_bn,
      centerLatitude: Number(zone.centerLatitude ?? zone.center_latitude),
      centerLongitude: Number(zone.centerLongitude ?? zone.center_longitude),
      radiusMeters: Number(zone.radiusMeters ?? zone.radius_meters)
    },
    distanceMeters: Math.round(distanceMeters)
  };
}

export function normalizeCoverageZone(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Enter valid coverage-area details.');
  }
  const nameEn = typeof input.nameEn === 'string' ? input.nameEn.trim() : '';
  const nameBn = typeof input.nameBn === 'string' ? input.nameBn.trim() : '';
  const centerLatitude = Number(input.centerLatitude);
  const centerLongitude = Number(input.centerLongitude);
  const radiusMeters = Number(input.radiusMeters);
  if (!nameEn || nameEn.length > 128 || !nameBn || nameBn.length > 128) {
    throw new TypeError('Enter the coverage-area name in English and Bangla.');
  }
  if (!Number.isFinite(centerLatitude) || centerLatitude < -90 || centerLatitude > 90 ||
      !Number.isFinite(centerLongitude) || centerLongitude < -180 || centerLongitude > 180) {
    throw new TypeError('Choose a valid point on the map.');
  }
  if (!Number.isInteger(radiusMeters) || radiusMeters < 100 || radiusMeters > 50000) {
    throw new TypeError('Coverage radius must be between 100 and 50,000 metres.');
  }
  return { nameEn, nameBn, centerLatitude, centerLongitude, radiusMeters };
}
