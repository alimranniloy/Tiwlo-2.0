export async function getGoogleDrivingEstimate({
  origin,
  destination,
  apiKey,
  fetchImpl = globalThis.fetch
}) {
  if (!apiKey) throw new Error('Google Maps API key is not configured.');

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', `${origin.latitude},${origin.longitude}`);
  url.searchParams.set('destination', `${destination.latitude},${destination.longitude}`);
  url.searchParams.set('mode', 'driving');
  url.searchParams.set('departure_time', 'now');
  url.searchParams.set('traffic_model', 'best_guess');
  url.searchParams.set('key', apiKey);

  let response;
  try {
    response = await fetchImpl(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new Error('Google Directions API request failed.');
  }
  if (!response.ok) {
    throw new Error(`Google Directions API returned HTTP ${response.status}.`);
  }

  const result = await response.json();
  const leg = result.status === 'OK' ? result.routes?.[0]?.legs?.[0] : null;
  const durationSeconds = leg?.duration_in_traffic?.value ?? leg?.duration?.value;
  const distanceMeters = leg?.distance?.value;
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0 ||
      !Number.isFinite(distanceMeters) || distanceMeters < 0) {
    throw new Error(`Google Directions API status: ${result.status || 'INVALID_RESPONSE'}.`);
  }

  return {
    durationSeconds,
    distanceMeters,
    etaMinutes: Math.ceil(durationSeconds / 60)
  };
}
