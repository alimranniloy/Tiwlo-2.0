const MAX_SHIPPING_ZONES = 50;
const MAX_COUNTRIES_PER_ZONE = 100;
const MAX_DESTINATIONS_PER_ZONE = 250;
const MAX_CITIES_PER_DESTINATION = 5000;

function normalizeCountry(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeStorefrontAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Enter your delivery address using the checkout address fields.');
  }
  const address = {
    street: String(input.street || '').trim(),
    city: String(input.city || '').trim(),
    region: String(input.region || '').trim(),
    postalCode: String(input.postalCode || '').trim(),
    country: String(input.country || '').trim(),
    countryCode: String(input.countryCode || '').trim().toUpperCase()
  };
  if (!address.street || !address.country) {
    throw new TypeError('Street address and country are required for delivery.');
  }
  if (address.street.length > 300 || address.city.length > 100 ||
      address.region.length > 100 || address.postalCode.length > 24 ||
      address.country.length > 100 || (address.countryCode && !/^[A-Z]{2}$/.test(address.countryCode))) {
    throw new TypeError('Enter a valid delivery address within the allowed field lengths.');
  }
  const deliveryAddress = [
    address.street,
    address.city,
    address.region,
    address.postalCode,
    address.country
  ].filter(Boolean).join(', ');
  if (deliveryAddress.length > 500) {
    throw new TypeError('Delivery address must be no longer than 500 characters.');
  }
  return { ...address, deliveryAddress };
}

export function normalizeShippingZones(input) {
  if (!Array.isArray(input) || input.length > MAX_SHIPPING_ZONES) {
    throw new TypeError(`Shipping zones must be a list of no more than ${MAX_SHIPPING_ZONES} entries.`);
  }

  const ids = new Set();
  const normalizedZones = input.map((zone, index) => {
    if (!zone || typeof zone !== 'object' || Array.isArray(zone)) {
      throw new TypeError('Each shipping zone must be an object.');
    }
    const id = String(zone.id || `shipping-zone-${index + 1}`).trim();
    const name = String(zone.name || '').trim();
    const countries = Array.isArray(zone.countries)
      ? zone.countries.map(normalizeCountry).filter(Boolean)
      : String(zone.countries || '').split(',').map(normalizeCountry).filter(Boolean);
    const destinations = Array.isArray(zone.destinations)
      ? zone.destinations.map(destination => {
        if (!destination || typeof destination !== 'object' || Array.isArray(destination)) {
          throw new TypeError('Each shipping destination must be an object.');
        }
        const countryCode = String(destination.countryCode || '').trim().toUpperCase();
        const countryName = String(destination.countryName || '').trim();
        const cities = Array.isArray(destination.cities)
          ? [...new Set(destination.cities.map(city => String(city || '').trim()).filter(Boolean))]
          : [];
        if (!/^[A-Z]{2}$/.test(countryCode) || !countryName || countryName.length > 100) {
          throw new TypeError('Each shipping destination needs a valid country code and name.');
        }
        if (cities.length > MAX_CITIES_PER_DESTINATION ||
            cities.some(city => city.length > 100)) {
          throw new TypeError(`Each country may have no more than ${MAX_CITIES_PER_DESTINATION} cities per shipping zone.`);
        }
        if (destination.enabled !== undefined && typeof destination.enabled !== 'boolean') {
          throw new TypeError('Shipping destination enabled must be true or false.');
        }
        return {
          countryCode,
          countryName,
          cities,
          enabled: destination.enabled !== false
        };
      })
      : [];
    if (destinations.length > MAX_DESTINATIONS_PER_ZONE) {
      throw new TypeError(`Each shipping zone can have no more than ${MAX_DESTINATIONS_PER_ZONE} destination countries.`);
    }
    const rate = Number(zone.rate);
    const perKgRate = zone.perKgRate === '' || zone.perKgRate == null ? 0 : Number(zone.perKgRate);
    const taxRate = zone.taxRate === '' || zone.taxRate == null ? null : Number(zone.taxRate);
    const freeShippingThreshold = zone.freeShippingThreshold === '' || zone.freeShippingThreshold == null
      ? null
      : Number(zone.freeShippingThreshold);
    const minDeliveryDays = zone.minDeliveryDays === '' || zone.minDeliveryDays == null
      ? null
      : Number(zone.minDeliveryDays);
    const maxDeliveryDays = zone.maxDeliveryDays === '' || zone.maxDeliveryDays == null
      ? null
      : Number(zone.maxDeliveryDays);
    const shippingMethod = String(zone.shippingMethod || 'Standard shipping').trim();

    if (!id || id.length > 80 || ids.has(id)) throw new TypeError('Shipping zone IDs must be unique and no longer than 80 characters.');
    if (!name || name.length > 80) throw new TypeError('Every shipping zone needs a name of no more than 80 characters.');
    if ((!countries.length && !destinations.length) || countries.length > MAX_COUNTRIES_PER_ZONE) {
      throw new TypeError(`Each shipping zone needs between 1 and ${MAX_COUNTRIES_PER_ZONE} countries.`);
    }
    if (countries.some(country => country.length > 80)) throw new TypeError('Shipping country names must be no longer than 80 characters.');
    if (!Number.isFinite(rate) || rate < 0) throw new TypeError('Shipping rate must be a non-negative amount.');
    if (!Number.isFinite(perKgRate) || perKgRate < 0) throw new TypeError('Per-kilogram shipping rate must be a non-negative amount.');
    if (taxRate !== null && (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)) {
      throw new TypeError('Shipping zone tax rate must be between 0 and 100 percent.');
    }
    if (!shippingMethod || shippingMethod.length > 80) throw new TypeError('Each shipping zone needs a shipping method label of no more than 80 characters.');
    if (new Set(destinations.map(destination => destination.countryCode)).size !== destinations.length) {
      throw new TypeError('A country can only appear once in a shipping zone.');
    }
    if (freeShippingThreshold !== null && (!Number.isFinite(freeShippingThreshold) || freeShippingThreshold < 0)) {
      throw new TypeError('Free shipping threshold must be a non-negative amount.');
    }
    for (const day of [minDeliveryDays, maxDeliveryDays]) {
      if (day !== null && (!Number.isInteger(day) || day < 0 || day > 365)) {
        throw new TypeError('Estimated delivery days must be whole numbers between 0 and 365.');
      }
    }
    if (minDeliveryDays !== null && maxDeliveryDays !== null && minDeliveryDays > maxDeliveryDays) {
      throw new TypeError('Minimum delivery days cannot exceed maximum delivery days.');
    }
    if (zone.enabled !== undefined && typeof zone.enabled !== 'boolean') {
      throw new TypeError('Shipping zone enabled must be true or false.');
    }
    if (zone.codEnabled !== undefined && typeof zone.codEnabled !== 'boolean') {
      throw new TypeError('Cash on Delivery enabled must be true or false.');
    }
    ids.add(id);
    return {
      id,
      name,
      countries: [...new Set(countries)],
      destinations,
      enabled: zone.enabled !== false,
      shippingMethod,
      rate,
      perKgRate,
      taxRate,
      freeShippingThreshold,
      minDeliveryDays,
      maxDeliveryDays,
      codEnabled: zone.codEnabled !== false
    };
  });
  const assignedCountries = new Set();
  const assignedCountryCodes = new Set();
  let hasWildcard = false;
  for (const zone of normalizedZones.filter(entry => entry.enabled)) {
    for (const country of zone.countries) {
      if (country === '*') {
        if (hasWildcard) throw new TypeError('Only one enabled shipping zone can be the fallback zone.');
        hasWildcard = true;
      } else {
        if (assignedCountries.has(country)) {
          throw new TypeError(`Country "${country}" can only belong to one enabled shipping zone.`);
        }
        assignedCountries.add(country);
      }
    }
    for (const destination of zone.destinations) {
      if (!destination.enabled) continue;
      if (assignedCountryCodes.has(destination.countryCode)) {
        throw new TypeError(`Country "${destination.countryName}" can only belong to one enabled shipping zone.`);
      }
      assignedCountryCodes.add(destination.countryCode);
    }
  }
  return normalizedZones;
}

export function quoteShipping(settings = {}, country = '', subtotal = 0, {
  countryCode = '',
  city = '',
  weightKg = 0,
  weightComplete = true
} = {}) {
  const zones = Array.isArray(settings.shippingZones)
    ? normalizeShippingZones(settings.shippingZones).filter(zone => zone.enabled)
    : [];
  const orderSubtotal = Number(subtotal);
  const normalizedCountryCode = String(countryCode || '').trim().toUpperCase();
  const normalizedCity = String(city || '').trim().toLowerCase();
  const orderWeightKg = Number(weightKg);
  if (!Number.isFinite(orderSubtotal) || orderSubtotal < 0) {
    throw new TypeError('A valid order subtotal is required to calculate shipping.');
  }
  if (!Number.isFinite(orderWeightKg) || orderWeightKg < 0) {
    throw new TypeError('A valid parcel weight is required to calculate shipping.');
  }

  if (zones.length) {
    const normalizedCountry = normalizeCountry(country);
    const countryDestination = normalizedCountryCode && zones
      .flatMap(zone => zone.destinations.map(destination => ({ zone, destination })))
      .find(match => match.destination.countryCode === normalizedCountryCode);
    if (countryDestination && !countryDestination.destination.enabled) {
      return { available: false, amount: null, zoneId: null, zoneName: null, codEnabled: false };
    }
    const destinationMatches = zones.map(zone => ({
      zone,
      destination: zone.destinations.find(entry =>
        entry.enabled && normalizedCountryCode && entry.countryCode === normalizedCountryCode &&
        (!entry.cities.length || entry.cities.some(value => value.toLowerCase() === normalizedCity))
      )
    })).find(match => match.destination);
    const legacyZone = normalizedCountry && (
      zones.find(entry => entry.countries.includes(normalizedCountry)) ||
      zones.find(entry => entry.countries.includes('*'))
    );
    const zone = destinationMatches?.zone || legacyZone;
    const destination = destinationMatches?.destination;
    if (!zone) {
      return { available: false, amount: null, zoneId: null, zoneName: null, codEnabled: false };
    }
    const freeAt = zone.freeShippingThreshold === null || zone.freeShippingThreshold === undefined
      ? NaN
      : Number(zone.freeShippingThreshold);
    const isFreeShipping = Number.isFinite(freeAt) && freeAt >= 0 && orderSubtotal >= freeAt;
    if (zone.perKgRate > 0 && !weightComplete && !isFreeShipping) {
      return {
        available: false,
        amount: null,
        zoneId: zone.id,
        zoneName: zone.name,
        codEnabled: false,
        error: 'Add a shipping weight to every product before using weight-based delivery.'
      };
    }
    const amount = isFreeShipping ? 0 : Number(zone.rate) + Number(zone.perKgRate || 0) * orderWeightKg;
    const configuredTaxRate = zone.taxRate === null || zone.taxRate === undefined
      ? Number(settings.taxRate) || 0
      : Number(zone.taxRate);
    return {
      available: true,
      amount: Number(amount.toFixed(2)),
      zoneId: zone.id,
      zoneName: zone.name,
      shippingMethod: zone.shippingMethod,
      weightKg: Number(orderWeightKg.toFixed(3)),
      taxRate: configuredTaxRate,
      codEnabled: zone.codEnabled !== false,
      minDeliveryDays: zone.minDeliveryDays ?? null,
      maxDeliveryDays: zone.maxDeliveryDays ?? null
    };
  }

  const rate = settings.shippingFlatRate === '' || settings.shippingFlatRate == null
    ? NaN
    : Number(settings.shippingFlatRate);
  if (!Number.isFinite(rate) || rate < 0) {
    return { available: true, amount: null, zoneId: null, zoneName: null, codEnabled: true, taxRate: Number(settings.taxRate) || 0 };
  }
  const threshold = settings.freeShippingThreshold === '' || settings.freeShippingThreshold == null
    ? NaN
    : Number(settings.freeShippingThreshold);
  const amount = Number.isFinite(threshold) && threshold >= 0 && orderSubtotal >= threshold ? 0 : rate;
  return { available: true, amount: Number(amount.toFixed(2)), zoneId: null, zoneName: null, codEnabled: true, taxRate: Number(settings.taxRate) || 0 };
}
