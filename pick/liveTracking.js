const DEFAULT_ROUTING_BASE_URL = 'https://router.project-osrm.org';
const ROUTING_TIMEOUT_MS = 8000;

function isValidCoordinate(point) {
  return point &&
    Number.isFinite(point.latitude) &&
    Number.isFinite(point.longitude) &&
    point.latitude >= -90 && point.latitude <= 90 &&
    point.longitude >= -180 && point.longitude <= 180;
}

export async function getOpenDrivingEstimate({
  origin,
  destination,
  baseUrl = process.env.PICK_OSRM_BASE_URL || DEFAULT_ROUTING_BASE_URL,
  fetchImpl = globalThis.fetch
}) {
  if (!isValidCoordinate(origin) || !isValidCoordinate(destination)) {
    throw new Error('OSRM route coordinates are invalid.');
  }

  const routingBase = new URL(baseUrl);
  if (!['http:', 'https:'].includes(routingBase.protocol)) {
    throw new Error('PICK_OSRM_BASE_URL must use HTTP or HTTPS.');
  }
  routingBase.pathname = `${routingBase.pathname.replace(/\/+$/, '')}/`;
  const coordinates = [
    `${origin.longitude},${origin.latitude}`,
    `${destination.longitude},${destination.latitude}`
  ].join(';');
  const url = new URL(`route/v1/driving/${coordinates}`, routingBase);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'polyline');
  url.searchParams.set('steps', 'false');

  let response;
  try {
    response = await fetchImpl(url, {
      headers: { 'User-Agent': 'Tiwlo-PICK/1.0 (delivery routing)' },
      signal: AbortSignal.timeout(ROUTING_TIMEOUT_MS)
    });
  } catch (error) {
    throw new Error(`OSRM routing request failed: ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`OSRM routing service returned HTTP ${response.status}.`);
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('OSRM routing service returned invalid JSON.');
  }
  const route = result.code === 'Ok' ? result.routes?.[0] : null;
  if (!route || !Number.isFinite(route.duration) || route.duration < 0 ||
      !Number.isFinite(route.distance) || route.distance < 0 ||
      typeof route.geometry !== 'string') {
    throw new Error(`OSRM route status: ${result.code || 'INVALID_RESPONSE'}.`);
  }

  return {
    durationSeconds: route.duration,
    distanceMeters: route.distance,
    etaMinutes: Math.ceil(route.duration / 60),
    encodedPolyline: route.geometry
  };
}
