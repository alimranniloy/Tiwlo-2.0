export const PURCHASE_STATUSES = Object.freeze(['Pending', 'Ordered', 'Received']);

const PURCHASE_TRANSITIONS = Object.freeze({
  Pending: ['Ordered', 'Received'],
  Ordered: ['Received'],
  Received: []
});

export function canTransitionPurchase(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  return PURCHASE_TRANSITIONS[currentStatus]?.includes(nextStatus) || false;
}

export function receivePurchaseOrder(purchase, products, receivedAt = new Date().toISOString()) {
  if (purchase.status === 'Received' || purchase.stockRestocked) {
    return { purchase, products, restocked: false };
  }

  const updatedProducts = products.map(product => ({ ...product }));
  for (const item of purchase.items || []) {
    const product = updatedProducts.find(entry => entry.id === item.productId);
    if (product) {
      product.stock = Number(product.stock || 0) + Number(item.quantity || 0);
    }
  }

  return {
    purchase: { ...purchase, status: 'Received', receivedAt, stockRestocked: true },
    products: updatedProducts,
    restocked: true
  };
}
