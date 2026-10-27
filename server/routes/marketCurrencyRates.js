import { getFreshUsdRates, validateMarketRateRows } from './currencyHelpers.js';

const MARKET_RATE_CACHE_TTL_MS = 60 * 60 * 1000;
let marketUsdRateCache = null;
let marketUsdRateRequest = null;

export async function getMarketUsdRates() {
  const now = Date.now();
  if (marketUsdRateCache && now - marketUsdRateCache.fetchedAt < MARKET_RATE_CACHE_TTL_MS &&
      getFreshUsdRates(marketUsdRateCache, now)) return marketUsdRateCache;
  if (marketUsdRateRequest) return marketUsdRateRequest;
  const request = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetch('https://api.frankfurter.dev/v2/rates?base=USD', {
        headers: { Accept: 'application/json' }, signal: controller.signal
      });
      if (!response.ok) throw new Error(`Frankfurter returned HTTP ${response.status}.`);
      const { rates, rateDates, observedAt } = validateMarketRateRows(await response.json());
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
