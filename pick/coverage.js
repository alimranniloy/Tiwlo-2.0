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

export function findCoverageZone(latitude, longitude, zones) {
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

  if (!matches.length) return { available: false, zone: null, distanceMeters: null };
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
