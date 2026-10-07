const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

export function getSalesPeriod(range, now = new Date()) {
  const normalizedRange = ['7days', '30days', '3months'].includes(range) ? range : '7days';
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);

  let start;
  let bucketStarts;
  let bucketUnit;
  if (normalizedRange === '3months') {
    start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, 1));
    const monthBuckets = [];
    for (let date = new Date(start); date <= end; date.setUTCMonth(date.getUTCMonth() + 1)) {
      monthBuckets.push(new Date(date));
    }
    bucketStarts = monthBuckets;
    bucketUnit = 'month';
    end.setTime(end.getTime() + DAY_MS);
  } else {
    const dayCount = normalizedRange === '30days' ? 30 : 7;
    start = new Date(end.getTime() - (dayCount - 1) * DAY_MS);
    bucketStarts = [];
    const bucketSize = normalizedRange === '30days' ? 7 : 1;
    for (let offset = 0; offset < dayCount; offset += bucketSize) {
      bucketStarts.push(new Date(start.getTime() + offset * DAY_MS));
    }
    bucketUnit = normalizedRange === '30days' ? 'week' : 'day';
    end.setTime(end.getTime() + DAY_MS);
  }

  const duration = end.getTime() - start.getTime();
  return {
    range: normalizedRange,
    start,
    end,
    previousStart: new Date(start.getTime() - duration),
    previousEnd: new Date(start),
    bucketStarts,
    bucketUnit
  };
}

export function getSaleTimestamp(sale) {
  return validDate(sale?.date || sale?.createdAt);
}

export function getSaleAmount(sale) {
  const amount = Number(sale?.totalAmount ?? sale?.grandTotal ?? sale?.total);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

export function isPaidSale(sale) {
  const status = String(sale?.paymentStatus || sale?.status || '').trim().toLowerCase();
  return ['paid', 'completed', 'complete', 'succeeded', 'success'].includes(status);
}

export function formatPeriodLabel(date, unit, end = null) {
  if (unit === 'month') {
    return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  }
  if (unit === 'week' && end) {
    const lastDay = new Date(end.getTime() - DAY_MS);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}–${lastDay.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'UTC' })}`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

export function formatTrend(current, previous) {
  if (previous === 0) return current === 0 ? '0.0%' : 'New';
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const rounded = Math.abs(change).toFixed(1);
  return `${change >= 0 ? '+' : '-'}${rounded}%`;
}
