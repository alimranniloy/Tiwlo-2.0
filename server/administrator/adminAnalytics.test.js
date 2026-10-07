import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatPeriodLabel,
  formatTrend,
  getSaleAmount,
  getSaleTimestamp,
  getSalesPeriod,
  isPaidSale
} from './adminAnalytics.js';

test('7-day analytics period uses UTC dates and seven daily buckets', () => {
  const period = getSalesPeriod('7days', new Date('2026-10-07T08:00:00.000Z'));
  assert.equal(period.start.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(period.end.toISOString(), '2026-10-08T00:00:00.000Z');
  assert.equal(period.bucketStarts.length, 7);
  assert.equal(period.bucketUnit, 'day');
});

test('30-day and three-month ranges produce bounded weekly and monthly buckets', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');
  const days = getSalesPeriod('30days', now);
  const months = getSalesPeriod('3months', now);
  assert.equal(days.start.toISOString(), '2026-09-08T00:00:00.000Z');
  assert.equal(days.bucketUnit, 'week');
  assert.equal(days.bucketStarts.length, 5);
  assert.equal(months.start.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(months.end.toISOString(), '2026-10-08T00:00:00.000Z');
  assert.equal(months.bucketStarts.length, 3);
});

test('sales are recognized only when their recorded status represents paid revenue', () => {
  assert.equal(isPaidSale({ status: 'Completed' }), true);
  assert.equal(isPaidSale({ paymentStatus: 'Paid', status: 'Pending' }), true);
  assert.equal(isPaidSale({ status: 'Refunded' }), false);
  assert.equal(isPaidSale({ status: 'Pending' }), false);
  assert.equal(getSaleAmount({ grandTotal: '12.50' }), 12.5);
  assert.equal(getSaleAmount({ totalAmount: 'invalid' }), 0);
  assert.equal(getSaleTimestamp({ date: 'not-a-date' }), null);
});

test('period labels and trends are derived without invented comparisons', () => {
  assert.equal(formatPeriodLabel(new Date('2026-10-01T00:00:00Z'), 'month'), 'Oct');
  assert.equal(formatTrend(0, 0), '0.0%');
  assert.equal(formatTrend(2, 0), 'New');
  assert.equal(formatTrend(90, 100), '-10.0%');
});
