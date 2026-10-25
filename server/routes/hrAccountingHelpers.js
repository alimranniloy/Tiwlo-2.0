export function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function calculateCashbookBalance(openingBalanceCents, openingBalanceAt, entries) {
  if (!Number.isSafeInteger(openingBalanceCents) || openingBalanceCents < 0 ||
      !Number.isFinite(Date.parse(openingBalanceAt)) || !Array.isArray(entries)) return null;
  let balanceCents = openingBalanceCents;
  const openingTimestamp = Date.parse(openingBalanceAt);
  if (entries.some(entry => !Number.isFinite(Date.parse(entry.createdAt)))) return null;
  const effectiveEntries = entries
    .filter(entry => Date.parse(entry.createdAt) >= openingTimestamp)
    .sort((first, second) =>
      Date.parse(first.createdAt) - Date.parse(second.createdAt) ||
      (Number(first.sequence) || 0) - (Number(second.sequence) || 0)
    );
  for (const entry of effectiveEntries) {
    if (!Number.isSafeInteger(entry.amountCents) || entry.amountCents <= 0 ||
        !['in', 'out'].includes(entry.direction)) return null;
    const nextBalance = balanceCents + (entry.direction === 'in' ? entry.amountCents : -entry.amountCents);
    if (!Number.isSafeInteger(nextBalance)) return null;
    balanceCents = nextBalance;
  }
  return balanceCents;
}

export function calculateOutstandingAdvanceCents(staffId, transactions) {
  if (!Array.isArray(transactions)) return null;
  let issued = 0;
  let recovered = 0;
  for (const transaction of transactions) {
    if (transaction.staffId !== staffId) continue;
    if (!Number.isSafeInteger(transaction.amountCents) || transaction.amountCents <= 0) return null;
    if (transaction.type === 'advance_issued') issued += transaction.amountCents;
    else if (['advance_repayment', 'advance_payroll_deduction'].includes(transaction.type)) {
      recovered += transaction.amountCents;
    }
    if (!Number.isSafeInteger(issued) || !Number.isSafeInteger(recovered)) return null;
  }
  return issued >= recovered ? issued - recovered : null;
}

export function parseHoursToHundredths(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{1,4})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const hundredths = Number(`${match[1]}${(match[2] || '').padEnd(2, '0')}`);
  return Number.isSafeInteger(hundredths) && hundredths > 0 ? hundredths : null;
}

export function calculatePayrollGrossCents(employee, hoursHundredths = null) {
  if (employee.salaryFrequency === 'Hourly') {
    const rateCents = Number(employee.hourlyRateCents);
    if (!Number.isSafeInteger(rateCents) || rateCents <= 0 ||
        !Number.isSafeInteger(hoursHundredths) || hoursHundredths <= 0) return null;
    const product = BigInt(rateCents) * BigInt(hoursHundredths);
    const rounded = (product + 50n) / 100n;
    const result = Number(rounded);
    return Number.isSafeInteger(result) ? result : null;
  }
  if (!['Monthly', 'Weekly'].includes(employee.salaryFrequency) ||
      !Number.isSafeInteger(employee.salaryAmountCents) || employee.salaryAmountCents <= 0) return null;
  return employee.salaryAmountCents;
}

export function calculateFixedPayrollGrossCents(employee, periodStart, periodEnd) {
  if (!['Monthly', 'Weekly'].includes(employee.salaryFrequency) ||
      !Number.isSafeInteger(employee.salaryAmountCents) || employee.salaryAmountCents <= 0 ||
      !parseDateOnly(periodStart) || !parseDateOnly(periodEnd) || periodEnd < periodStart) return null;

  const start = new Date(`${periodStart}T00:00:00.000Z`);
  const end = new Date(`${periodEnd}T00:00:00.000Z`);
  if (employee.salaryFrequency === 'Weekly') {
    const dayCount = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    const numerator = BigInt(employee.salaryAmountCents) * BigInt(dayCount);
    const result = Number((numerator * 2n + 7n) / 14n);
    return Number.isSafeInteger(result) ? result : null;
  }

  let amountNumerator = 0n;
  let dayDenominator = 1n;
  for (let cursor = start; cursor <= end;) {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const segmentEnd = monthEnd < end ? monthEnd : end;
    const segmentDays = Math.floor((segmentEnd.getTime() - cursor.getTime()) / 86400000) + 1;
    const daysInMonth = monthEnd.getUTCDate();
    const monthDenominator = BigInt(daysInMonth);
    const commonDenominator = dayDenominator * monthDenominator /
      greatestCommonDivisor(dayDenominator, monthDenominator);
    amountNumerator =
      amountNumerator * (commonDenominator / dayDenominator) +
      BigInt(employee.salaryAmountCents) * BigInt(segmentDays) *
      (commonDenominator / monthDenominator);
    dayDenominator = commonDenominator;
    cursor = new Date(segmentEnd.getTime() + 86400000);
  }
  const result = Number((amountNumerator * 2n + dayDenominator) / (dayDenominator * 2n));
  return Number.isSafeInteger(result) ? result : null;
}

function greatestCommonDivisor(first, second) {
  while (second !== 0n) [first, second] = [second, first % second];
  return first;
}
