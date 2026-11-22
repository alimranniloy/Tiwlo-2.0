const AREA_COMPONENT_TYPES = [
  'neighborhood',
  'sublocality',
  'sublocality_level_1',
  'sublocality_level_2',
  'locality',
  'administrative_area_level_3',
  'administrative_area_level_4',
  'administrative_area_level_5',
  'administrative_area_level_2',
  'administrative_area_level_1',
  'colloquial_area',
  'route',
  'country'
];

function getAddressComponent(components, acceptedTypes) {
  for (const acceptedType of acceptedTypes) {
    const component = components.find(row =>
      Array.isArray(row.types) && row.types.includes(acceptedType)
    );
    const name = component?.long_name?.trim();
    if (name) return name;
  }
  return '';
}

function pickBestFormattedAddress(results) {
  const streetCandidate = results.find(item => {
    const addr = item?.formatted_address?.trim();
    const types = Array.isArray(item?.types) ? item.types : [];
    return Boolean(addr) && !types.includes('plus_code');
  });
  return streetCandidate?.formatted_address?.trim() ||
    results.find(item => item?.formatted_address?.trim())?.formatted_address?.trim() ||
    '';
}

function resolveGoogleAddress(result, response) {
  const results = Array.isArray(response?.results) && response.results.length
    ? response.results
    : [result];

  const allComponents = results.flatMap(item =>
    Array.isArray(item?.address_components) ? item.address_components : []
  );
  const directComponents = Array.isArray(result?.address_components)
    ? result.address_components
    : [];

  const area = getAddressComponent(directComponents, AREA_COMPONENT_TYPES) ||
    getAddressComponent(allComponents, AREA_COMPONENT_TYPES);
  const postalCode = getAddressComponent(directComponents, ['postal_code']) ||
    getAddressComponent(allComponents, ['postal_code']);
  const plusCode = result?.plus_code?.global_code ||
    response?.plus_code?.global_code ||
    results.find(item => item?.plus_code?.global_code)?.plus_code?.global_code ||
    '';
  const compoundPlusCode = result?.plus_code?.compound_code ||
    response?.plus_code?.compound_code ||
    results.find(item => item?.plus_code?.compound_code)?.plus_code?.compound_code ||
    '';
  const formattedAddress = result?.formatted_address?.trim() || pickBestFormattedAddress(results);

  if (!formattedAddress || !area || !plusCode) {
    throw new Error('Google did not return a complete address, area, and Plus Code.');
  }

  return {
    formattedAddress,
    area,
    postalCode,
    plusCode,
    compoundPlusCode,
    placeId: result?.place_id || results.find(item => item?.place_id)?.place_id || ''
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
