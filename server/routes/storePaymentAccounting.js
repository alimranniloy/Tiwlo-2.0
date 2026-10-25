import { amountToCents } from '../../shared/accountingHelpers.mjs';

export function recordVerifiedGatewayPayment(order, verification) {
  const gateway = order.paymentGateway;
  if (!gateway) throw new TypeError('This order has no verified gateway payment.');
  const verifiedCents = amountToCents(verification.amount);
  const gatewayCents = amountToCents(gateway.amount);
  const totalCents = amountToCents(order.totalAmount);
  if (verifiedCents === null || gatewayCents === null || totalCents === null ||
      verifiedCents !== gatewayCents || verifiedCents !== totalCents ||
      String(verification.currency).toUpperCase() !== String(gateway.currency).toUpperCase()) {
    throw new TypeError('The verified payment amount or currency does not match the order.');
  }
  if (!verification.transactionId) {
    throw new TypeError('The verified payment did not include a transaction reference.');
  }
  if (gateway.status === 'paid') {
    if (gateway.transactionId === verification.transactionId) return false;
    throw new TypeError('A different payment has already been recorded for this order.');
  }
  if (order.paymentStatus === 'Paid') {
    throw new TypeError('A different payment has already been recorded for this order.');
  }

  const timestamp = new Date().toISOString();
  gateway.status = 'paid';
  gateway.providerPaymentId = verification.providerPaymentId || gateway.providerPaymentId;
  gateway.transactionId = verification.transactionId;
  gateway.providerStatus = verification.rawStatus;
  gateway.completedAt = timestamp;
  gateway.updatedAt = timestamp;
  if (verification.eventId) {
    const eventIds = Array.isArray(gateway.eventIds) ? gateway.eventIds : [];
    if (eventIds.includes(verification.eventId)) return false;
    gateway.eventIds = [...eventIds, verification.eventId].slice(-50);
  }

  const payments = Array.isArray(order.payments) ? order.payments : [];
  const paymentId = `gateway-${verification.transactionId}`;
  if (!payments.some(payment => payment.id === paymentId)) {
    payments.push({
      id: paymentId,
      amount: verifiedCents / 100,
      method: order.paymentMethod || 'Online payment',
      reference: verification.transactionId,
      verificationStatus: 'gateway_verified',
      gatewayVerified: true,
      createdAt: timestamp
    });
  }
  order.payments = payments;
  order.paidAmount = verifiedCents / 100;
  order.dueAmount = 0;
  order.paymentStatus = 'Paid';
  order.updatedAt = timestamp;
  return true;
}

export function updateOrderRefundPaymentStatus(order) {
  const totalCents = amountToCents(order.totalAmount);
  const refunds = Array.isArray(order.refundHistory) ? order.refundHistory : [];
  let refundedCents = 0;
  for (const refund of refunds) {
    if (!['manually_processed', 'gateway_confirmed'].includes(refund.status)) continue;
    const amountCents = amountToCents(refund.amount);
    if (amountCents === null || !Number.isSafeInteger(refundedCents + amountCents)) {
      throw new TypeError('Processed refund history cannot be totaled safely.');
    }
    refundedCents += amountCents;
  }
  if (totalCents === null || refundedCents > totalCents) {
    throw new TypeError('Processed refunds exceed the order total.');
  }

  if (refundedCents > 0) {
    order.paymentStatus = refundedCents >= totalCents ? 'Refunded' : 'Partially Refunded';
  } else if (order.paymentStatus === 'Refunded' || order.paymentStatus === 'Partially Refunded') {
    order.paymentStatus = 'Paid';
  }
  return order.paymentStatus;
}
