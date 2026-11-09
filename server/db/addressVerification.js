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

export async function verifyGoogleAddress({
  address,
  apiKey,
  fetchImpl = globalThis.fetch
}) {
  const cleanAddress = typeof address === 'string' ? address.trim() : '';
  if (cleanAddress.length < 8 || cleanAddress.length > 1000) {
    throw new TypeError('Enter a complete delivery address.');
  }
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new Error('Google Maps API key is not configured.');
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', cleanAddress);
  url.searchParams.set('region', 'bd');
  url.searchParams.set('key', apiKey.trim());

  let lastError = new Error('Google could not verify this delivery address.');
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(6000) });
      if (!response.ok) {
        throw new Error(`Google Geocoding API returned HTTP ${response.status}.`);
      }

      const result = await response.json();
      const match = result.status === 'OK' && Array.isArray(result.results)
        ? result.results.find(item =>
          Number.isFinite(item.geometry?.location?.lat) &&
          Number.isFinite(item.geometry?.location?.lng) &&
          ['ROOFTOP', 'RANGE_INTERPOLATED', 'GEOMETRIC_CENTER', 'APPROXIMATE']
            .includes(item.geometry?.location_type)
        )
        : null;
      if (!match) {
        throw new Error(`Google could not verify this address (${result.status || 'UNKNOWN_ERROR'}).`);
      }

      const resolved = await reverseGeocodeAddress({
        latitude: match.geometry.location.lat,
        longitude: match.geometry.location.lng,
        apiKey,
        fetchImpl
      });
      return {
        ...resolved,
        latitude: match.geometry.location.lat,
        longitude: match.geometry.location.lng,
        placeId: match.place_id || resolved.placeId
      };
    } catch (error) {
      lastError = error;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
    }
  }

  throw lastError;
}
