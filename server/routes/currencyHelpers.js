const RATE_LIMIT = 1000;
const MAX_RATE = 1_000_000_000;
const SUPPORTED_CURRENCY_CODES = typeof Intl.supportedValuesOf === 'function'
  ? new Set(Intl.supportedValuesOf('currency'))
  : null;

export function normalizeCurrencyCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : null;
}

export function normalizeUsdRates(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('Currency rates must be provided as a currency-to-rate object.');
  }
  const entries = Object.entries(input);
  if (entries.length > RATE_LIMIT) {
    throw new TypeError(`At most ${RATE_LIMIT} currency rates can be saved.`);
  }
  const rates = { USD: 1 };
  for (const [rawCode, rawRate] of entries) {
    const code = normalizeCurrencyCode(rawCode);
    if ((typeof rawRate !== 'number' && typeof rawRate !== 'string') ||
        (typeof rawRate === 'string' && !rawRate.trim())) {
      throw new TypeError(`The USD exchange rate for ${rawCode} must be a positive number.`);
    }
    const rate = Number(rawRate);
    if (!code || !Number.isFinite(rate) || rate <= 0 || rate > MAX_RATE) {
      throw new TypeError(`The USD exchange rate for ${rawCode} must be a positive number.`);
    }
    if (code === 'USD' && rate !== 1) {
      throw new TypeError('USD must have an exchange rate of exactly 1.');
    }
    rates[code] = rate;
  }
  return rates;
}

export function validateMarketRateRows(rows, now = Date.now()) {
  if (!Array.isArray(rows) || !rows.length || rows.length > RATE_LIMIT) {
    throw new TypeError('The exchange-rate source returned an invalid rate list.');
  }
  const rates = { USD: 1 };
  const rateDates = {};
  let observedAt = '';
  for (const row of rows) {
    if (!row || String(row.base || '').toUpperCase() !== 'USD') {
      throw new TypeError('The exchange-rate source returned a rate with an unexpected base currency.');
    }
    const quote = normalizeCurrencyCode(row.quote);
    if (typeof row.rate !== 'number' && typeof row.rate !== 'string') {
      throw new TypeError('The exchange-rate source returned malformed data.');
    }
    const rate = Number(row.rate);
    const date = String(row.date || '');
    const observationTime = Date.parse(`${date}T00:00:00Z`);
    if (!quote || quote === 'USD' || !Number.isFinite(rate) || rate <= 0 || rate > MAX_RATE ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(observationTime) ||
        new Date(observationTime).toISOString().slice(0, 10) !== date) {
      throw new TypeError('The exchange-rate source returned malformed data.');
    }
    if (observationTime > now + 24 * 60 * 60 * 1000) {
      throw new TypeError(`The exchange-rate source returned a future rate for ${quote}.`);
    }
    if (now - observationTime > 4 * 24 * 60 * 60 * 1000) continue;
    rates[quote] = rate;
    rateDates[quote] = date;
    if (date > observedAt) observedAt = date;
  }
  if (!observedAt) {
    throw new TypeError('The exchange-rate source did not return any fresh rates.');
  }
  return { rates, rateDates, observedAt };
}

export function getCurrencyMinorUnits(currencyCode) {
  const code = normalizeCurrencyCode(currencyCode);
  if (!code) throw new TypeError('Currency must be an ISO 4217 three-letter code.');
  if (SUPPORTED_CURRENCY_CODES && !SUPPORTED_CURRENCY_CODES.has(code)) {
    throw new TypeError(`Unsupported ISO 4217 currency code: ${code}.`);
  }
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: code })
      .resolvedOptions().maximumFractionDigits;
  } catch {
    throw new TypeError(`Unsupported currency code: ${code}.`);
  }
}

export function convertCurrencyAmount(amount, fromCurrency, toCurrency, usdRates) {
  if ((typeof amount !== 'number' && typeof amount !== 'string') ||
      (typeof amount === 'string' && !amount.trim())) {
    throw new TypeError('Conversion amount must be a non-negative number.');
  }
  const value = Number(amount);
  const from = normalizeCurrencyCode(fromCurrency);
  const to = normalizeCurrencyCode(toCurrency);
  if (!Number.isFinite(value) || value < 0 || value > MAX_RATE) {
    throw new TypeError('Conversion amount must be a non-negative number.');
  }
  if (!from || !to) throw new TypeError('Source and target currencies must be ISO 4217 three-letter codes.');
  getCurrencyMinorUnits(from);
  const rates = normalizeUsdRates(usdRates);
  const fromRate = rates[from];
  const toRate = rates[to];
  if (!Number.isFinite(fromRate) || !Number.isFinite(toRate)) {
    throw new TypeError(`A current USD reference rate is not configured for ${!fromRate ? from : to}.`);
  }
  const converted = value / fromRate * toRate;
  const digits = getCurrencyMinorUnits(to);
  const rounded = Number(converted.toFixed(digits));
  if (!Number.isFinite(rounded)) throw new TypeError('Converted payment amount is outside the supported range.');
  return {
    amount: rounded,
    fromCurrency: from,
    toCurrency: to,
    exchangeRate: toRate / fromRate
  };
}

export function getFreshUsdRates(rateSettings, now = Date.now()) {
  if (!rateSettings || typeof rateSettings !== 'object') return null;
  const allRates = normalizeUsdRates(rateSettings.rates);
  const rateDates = rateSettings.rateDates && typeof rateSettings.rateDates === 'object'
    ? rateSettings.rateDates
    : {};
  const fallbackDate = String(rateSettings.observedAt || '');
  const rates = { USD: 1 };
  const freshRateDates = {};
  for (const [code, rate] of Object.entries(allRates)) {
    if (code === 'USD') continue;
    const date = String(rateDates[code] || fallbackDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    if (!Number.isFinite(timestamp) ||
        new Date(timestamp).toISOString().slice(0, 10) !== date ||
        timestamp > now + 24 * 60 * 60 * 1000 ||
        now - timestamp > 4 * 24 * 60 * 60 * 1000) continue;
    rates[code] = rate;
    freshRateDates[code] = date;
  }
  if (Object.keys(rates).length === 1) return null;
  return {
    rates,
    rateDates: freshRateDates,
    observedAt: Object.values(freshRateDates).sort().at(-1)
  };
}
