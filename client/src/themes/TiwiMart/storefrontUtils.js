const CURRENCY_SYMBOLS = {
  BDT: '৳',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  JPY: '¥',
  USD: '$'
};

const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';

export function formatStoreCurrency(amount, settings = {}) {
  const value = Number(amount);
  const configuredCurrency = String(settings.currency || 'USD').toUpperCase();
  const currency = configuredCurrency.match(/[A-Z]{3}/)?.[0] || 'USD';
  const symbol = settings.currencySymbol && (currency === 'USD' || settings.currencySymbol !== '$')
    ? settings.currencySymbol
    : CURRENCY_SYMBOLS[currency];

  const formatted = Number.isFinite(value)
    ? new Intl.NumberFormat(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
    : '0.00';

  if (symbol) return `${symbol}${formatted}`;
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${currency} ${formatted}`;
  }
}

export function getStoreTaxRate(settings = {}) {
  const configuredRate = hasValue(settings.taxRate) ? Number(settings.taxRate) : NaN;
  return Number.isFinite(configuredRate) && configuredRate >= 0 ? configuredRate / 100 : 0;
}

export function getShippingAmount(subtotal, settings = {}, country = '') {
  const zones = Array.isArray(settings.shippingZones)
    ? settings.shippingZones.filter(zone => zone?.enabled !== false)
    : [];
  if (zones.length) {
    const normalizedCountry = String(country || '').trim().toLowerCase();
    const zone = normalizedCountry && zones.find(entry =>
      (entry.countries || []).some(value =>
        String(value).trim().toLowerCase() === '*' ||
        String(value).trim().toLowerCase() === normalizedCountry
      )
    );
    if (!zone) return null;
    const zoneThreshold = Number(zone.freeShippingThreshold);
    if (Number.isFinite(zoneThreshold) && zoneThreshold >= 0 && subtotal >= zoneThreshold) return 0;
    const zoneRate = Number(zone.rate);
    return Number.isFinite(zoneRate) && zoneRate >= 0 ? zoneRate : null;
  }
  const amount = hasValue(settings.shippingFlatRate) ? Number(settings.shippingFlatRate) : NaN;
  if (!Number.isFinite(amount) || amount < 0) return null;
  const threshold = hasValue(settings.freeShippingThreshold) ? Number(settings.freeShippingThreshold) : NaN;
  if (Number.isFinite(threshold) && threshold >= 0 && subtotal >= threshold) return 0;
  return amount;
}

export function productDescriptionText(description) {
  if (typeof description !== 'string' || !description.trim()) return '';
  const decodeCodePoint = code => {
    const value = Number(code);
    return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
      ? String.fromCodePoint(value)
      : ' ';
  };
  return description
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => decodeCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => decodeCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, ' ')
    .trim();
}

export function getProductDiscount(product = {}) {
  const price = Number(product.price);
  const originalPrice = Number(product.originalPrice);
  if (!Number.isFinite(price) || !Number.isFinite(originalPrice) || originalPrice <= price || originalPrice <= 0) {
    return null;
  }
  return {
    originalPrice,
    percent: Math.round(((originalPrice - price) / originalPrice) * 100),
    savings: originalPrice - price
  };
}
