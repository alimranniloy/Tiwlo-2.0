import { getFreshUsdRates, validateMarketRateRows } from './currencyHelpers.js';

const MARKET_RATE_CACHE_TTL_MS = 60 * 60 * 1000;
let marketUsdRateCache = null;
let marketUsdRateRequest = null;

async function fetchFrankfurterRates(signal) {
  try {
    const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD', {
      headers: { Accept: 'application/json' }, signal
    });
    if (!response.ok) throw new Error(`Frankfurter v2 returned HTTP ${response.status}.`);
    return validateMarketRateRows(await response.json());
  } catch (v2Error) {
    const fallback = await fetch('https://api.frankfurter.dev/v1/latest?base=USD', {
      headers: { Accept: 'application/json' }, signal
    });
    if (!fallback.ok) throw v2Error;
    const payload = await fallback.json();
    const date = String(payload?.date || '');
    const entries = Object.entries(payload?.rates || {});
    if (!entries.length) throw v2Error;
    return validateMarketRateRows(entries.map(([quote, rate]) => ({
      date, base: payload?.base || 'USD', quote, rate
    })));
  }
}

export async function getMarketUsdRates() {
  const now = Date.now();
  if (marketUsdRateCache && now - marketUsdRateCache.fetchedAt < MARKET_RATE_CACHE_TTL_MS &&
      getFreshUsdRates(marketUsdRateCache, now)) return marketUsdRateCache;
  if (marketUsdRateRequest) return marketUsdRateRequest;
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const { rates, rateDates, observedAt } = await fetchFrankfurterRates(controller.signal);
      marketUsdRateCache = {
        rates, rateDates, observedAt, fetchedAt: Date.now(),
        source: 'Frankfurter blended central-bank reference rates'
      };
      return marketUsdRateCache;
    } finally {
      clearTimeout(timeout);
    }
  })();
  marketUsdRateRequest = request;
  try { return await request; }
  finally { if (marketUsdRateRequest === request) marketUsdRateRequest = null; }
}
