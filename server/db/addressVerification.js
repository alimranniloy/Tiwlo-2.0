function getAddressComponent(components, acceptedTypes) {
  const component = components.find(row =>
    Array.isArray(row.types) && row.types.some(type => acceptedTypes.includes(type))
  );
  return component?.long_name?.trim() || '';
}

function resolveGoogleAddress(result, response) {
  const components = result.address_components || [];
  const area = getAddressComponent(components, [
    'neighborhood',
    'sublocality',
    'sublocality_level_1',
    'locality',
    'administrative_area_level_2',
    'administrative_area_level_1'
  ]);
  const postalCode = getAddressComponent(components, ['postal_code']);
  const plusCode = result.plus_code?.global_code ||
    response.plus_code?.global_code ||
    '';
  const formattedAddress = result.formatted_address?.trim() || '';

  if (!formattedAddress || !area || !postalCode || !plusCode) {
    throw new Error('Google did not return a complete address, area, postcode, and Plus Code.');
  }

  return {
    formattedAddress,
    area,
    postalCode,
    plusCode,
    compoundPlusCode: result.plus_code?.compound_code ||
      response.plus_code?.compound_code ||
      '',
    placeId: result.place_id || ''
  };
}

export function isValidLiveLocation({ latitude, longitude, accuracy }) {
  return typeof latitude === 'number' && Number.isFinite(latitude) &&
    latitude >= -90 && latitude <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) &&
    longitude >= -180 && longitude <= 180 &&
    typeof accuracy === 'number' && Number.isFinite(accuracy) &&
    accuracy >= 0;
}

export async function reverseGeocodeAddress({
  latitude,
  longitude,
  apiKey,
  fetchImpl = globalThis.fetch
}) {
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('Google Maps API key is not configured.');
  }
  if (
    typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
    typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180
  ) {
    throw new TypeError('A valid GPS location is required.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('latlng', `${latitude},${longitude}`);
  url.searchParams.set('key', apiKey.trim());

  let lastError = new Error('Google could not resolve this GPS location.');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) {
        throw new Error(`Google Geocoding API returned HTTP ${response.status}.`);
      }

      const result = await response.json();
      if (result.status !== 'OK' || !Array.isArray(result.results) || !result.results[0]) {
        throw new Error(`Google Geocoding API status: ${result.status || 'UNKNOWN_ERROR'}.`);
      }

      let lastIncompleteResult = null;
      for (const addressResult of result.results) {
        try {
          return resolveGoogleAddress(addressResult, result);
        } catch (error) {
          lastIncompleteResult = error;
        }
      }
      throw lastIncompleteResult || new Error('Google returned no complete address result.');
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
    }
  }

  throw lastError;
}
