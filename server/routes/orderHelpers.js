export const ORDER_STATUSES = Object.freeze([
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
  'Returned'
]);

export const PAYMENT_STATUSES = Object.freeze([
  'Pending',
  'Paid',
  'Failed',
  'Refunded'
]);

const ORDER_TRANSITIONS = Object.freeze({
  Pending: ['Confirmed', 'Processing', 'Cancelled'],
  Confirmed: ['Processing', 'Cancelled'],
  Processing: ['Shipped', 'Cancelled'],
  Shipped: ['Out for Delivery', 'Delivered', 'Returned'],
  'Out for Delivery': ['Delivered', 'Returned'],
  Delivered: ['Returned'],
  Cancelled: [],
  Returned: []
});

export function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

export function canTransitionOrder(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  return ORDER_TRANSITIONS[currentStatus]?.includes(nextStatus) || false;
}

export function validateOrderUpdate(input = {}) {
  if (input.status !== undefined && !ORDER_STATUSES.includes(input.status)) {
    return 'Select a valid order status.';
  }
  if (input.paymentStatus !== undefined && !PAYMENT_STATUSES.includes(input.paymentStatus)) {
    return 'Select a valid payment status.';
  }
  if (input.courierService !== undefined &&
      (typeof input.courierService !== 'string' || input.courierService.length > 80)) {
    return 'Courier service must be 80 characters or fewer.';
  }
  if (input.trackingNumber !== undefined &&
      (typeof input.trackingNumber !== 'string' || input.trackingNumber.length > 120)) {
    return 'Tracking number must be 120 characters or fewer.';
  }
  if (input.trackingUrl !== undefined) {
    if (typeof input.trackingUrl !== 'string' || input.trackingUrl.length > 500) {
      return 'Courier tracking link must be 500 characters or fewer.';
    }
    if (input.trackingUrl) {
      try {
        const url = new URL(input.trackingUrl);
        if (url.protocol !== 'https:' || url.username || url.password) {
          return 'Courier tracking link must be a public HTTPS URL.';
        }
      } catch {
        return 'Enter a valid HTTPS courier tracking link.';
      }
    }
  }
  return null;
}
