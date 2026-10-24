import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertCurrencyAmount,
  getFreshUsdRates,
  normalizeUsdRates,
  validateMarketRateRows
} from './currencyHelpers.js';

test('normalizes manual USD-base rates and rejects invalid or non-USD-base input', () => {
  assert.deepEqual(normalizeUsdRates({ usd: 1, bdt: 120, INR: 83 }), {
    USD: 1,
    BDT: 120,
    INR: 83
  });
  assert.throws(() => normalizeUsdRates({ BDT: 0 }), /positive number/);
  assert.throws(() => normalizeUsdRates({ USD: 1.01 }), /exactly 1/);
  assert.throws(() => normalizeUsdRates({ US: 1 }), /positive number/);
});

test('validates market rates and refuses stale or future rate observations', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  const parsed = validateMarketRateRows([
    { date: '2026-10-24', base: 'USD', quote: 'BDT', rate: 120 },
    { date: '2026-10-24', base: 'USD', quote: 'INR', rate: 83 }
  ], now);
  assert.equal(parsed.observedAt, '2026-10-24');
  assert.equal(parsed.rates.BDT, 120);
  const mixedFreshness = validateMarketRateRows([
    { date: '2026-10-24', base: 'USD', quote: 'INR', rate: 83 },
    { date: '2026-10-10', base: 'USD', quote: 'BDT', rate: 120 }
  ], now);
  assert.equal(mixedFreshness.rates.INR, 83);
  assert.equal(mixedFreshness.rates.BDT, undefined);
  assert.throws(() => validateMarketRateRows([
    { date: '2026-10-10', base: 'USD', quote: 'BDT', rate: 120 }
  ], now), /did not return any fresh rates/);
  assert.throws(() => validateMarketRateRows([
    { date: '2026-10-30', base: 'USD', quote: 'BDT', rate: 120 }
  ], now), /future/);
});

test('converts with server-configured rates, rounds by currency, and rejects unknown currency', () => {
  assert.deepEqual(
    convertCurrencyAmount(10, 'USD', 'BDT', { BDT: 120 }),
    { amount: 1200, fromCurrency: 'USD', toCurrency: 'BDT', exchangeRate: 120 }
  );
  assert.equal(convertCurrencyAmount(10, 'USD', 'JPY', { JPY: 150 }).amount, 1500);
  assert.equal(convertCurrencyAmount(100, 'EUR', 'BDT', { EUR: 0.8, BDT: 120 }).amount, 15000);
  assert.throws(() => convertCurrencyAmount(10, 'USD', 'BDT', { BDT: 0 }), /positive number/);
  assert.throws(() => convertCurrencyAmount(-1, 'USD', 'BDT', { BDT: 120 }), /non-negative/);
  assert.throws(() => convertCurrencyAmount(1, 'USD', 'EUR', { BDT: 120 }), /not configured for EUR/);
  assert.throws(() => convertCurrencyAmount(1, 'USD', 'ABC', { ABC: 10 }), /Unsupported ISO/);
});

test('rejects stale saved market rates instead of silently using them', () => {
  const now = Date.parse('2026-10-24T12:00:00Z');
  assert.equal(getFreshUsdRates({
    observedAt: '2026-10-24',
    rates: { BDT: 120 }
  }, now).rates.BDT, 120);
  assert.equal(getFreshUsdRates({
    observedAt: '2026-10-10',
    rates: { BDT: 120 }
  }, now), null);
});
