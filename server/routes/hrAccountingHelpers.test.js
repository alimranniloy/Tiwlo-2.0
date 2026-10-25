import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCashbookBalance,
  calculateFixedPayrollGrossCents,
  calculateOutstandingAdvanceCents,
  calculatePayrollGrossCents,
  parseDateOnly,
  parseHoursToHundredths
} from './hrAccountingHelpers.js';

test('cashbook applies validated post-opening transactions in time order including actual overdrafts', () => {
  const entries = [
    { direction: 'out', amountCents: 2500, createdAt: '2026-01-01T00:00:00.000Z' },
    { direction: 'out', amountCents: 3000, createdAt: '2026-01-04T00:00:00.000Z' },
    { direction: 'in', amountCents: 7000, createdAt: '2026-01-03T00:00:00.000Z' }
  ];
  assert.equal(calculateCashbookBalance(5000, '2026-01-02T00:00:00.000Z', entries), 9000);
  assert.equal(calculateCashbookBalance(1000, '2026-01-02T00:00:00.000Z', entries), 5000);
  assert.equal(calculateCashbookBalance(1000, '2026-01-02T00:00:00.000Z', [
    { direction: 'out', amountCents: 2000, createdAt: '2026-01-03T00:00:00.000Z' }
  ]), -1000);
  assert.equal(calculateCashbookBalance(1000, 'invalid', []), null);
  assert.equal(calculateCashbookBalance(1000, '2026-01-02T00:00:00.000Z', [
    { direction: 'in', amountCents: 500, createdAt: 'bad timestamp' }
  ]), null);
  assert.equal(calculateCashbookBalance(1000, '2026-01-02T00:00:00.000Z', [
    { direction: 'out', amountCents: 1500, sequence: 2, createdAt: '2026-01-03T00:00:00.000Z' },
    { direction: 'in', amountCents: 1000, sequence: 1, createdAt: '2026-01-03T00:00:00.000Z' }
  ]), 500);
});

test('staff advances reduce only through recorded repayments or payroll deductions', () => {
  const transactions = [
    { staffId: 's1', type: 'advance_payroll_deduction', amountCents: 2500 },
    { staffId: 's2', type: 'advance_issued', amountCents: 4000 },
    { staffId: 's1', type: 'advance_issued', amountCents: 10000 }
  ];
  assert.equal(calculateOutstandingAdvanceCents('s1', transactions), 7500);
  assert.equal(calculateOutstandingAdvanceCents('missing', transactions), 0);
  assert.equal(calculateOutstandingAdvanceCents('s1', [
    ...transactions,
    { staffId: 's1', type: 'advance_repayment', amountCents: 8000 }
  ]), null);
});

test('payroll schedules validate date, period hours and exact hourly gross pay', () => {
  assert.equal(parseDateOnly('2026-02-28'), '2026-02-28');
  assert.equal(parseDateOnly('2026-02-30'), null);
  assert.equal(parseHoursToHundredths('7.5'), 750);
  assert.equal(parseHoursToHundredths('0'), null);
  assert.equal(calculatePayrollGrossCents({
    salaryFrequency: 'Hourly',
    hourlyRateCents: 1250
  }, 750), 9375);
  assert.equal(calculatePayrollGrossCents({
    salaryFrequency: 'Monthly',
    salaryAmountCents: 150000
  }), 150000);
});

test('fixed payroll is prorated by covered calendar days without floating point drift', () => {
  const monthly = { salaryFrequency: 'Monthly', salaryAmountCents: 31000 };
  assert.equal(calculateFixedPayrollGrossCents(monthly, '2026-10-01', '2026-10-31'), 31000);
  assert.equal(calculateFixedPayrollGrossCents(monthly, '2026-10-01', '2026-10-25'), 25000);
  assert.equal(calculateFixedPayrollGrossCents(
    { salaryFrequency: 'Monthly', salaryAmountCents: 29000 },
    '2024-02-01',
    '2024-02-29'
  ), 29000);
  assert.equal(calculateFixedPayrollGrossCents(monthly, '2026-10-30', '2026-11-02'), 4067);
  assert.equal(calculateFixedPayrollGrossCents(
    { salaryFrequency: 'Weekly', salaryAmountCents: 7000 },
    '2026-10-01',
    '2026-10-04'
  ), 4000);
  assert.equal(calculateFixedPayrollGrossCents(monthly, '2026-10-02', '2026-10-01'), null);
});
