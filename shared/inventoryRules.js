export const DEFAULT_MIN_STOCK = 20;

export function getMinStock(product) {
  const configured = product?.minStock;
  if (configured === undefined || configured === null || configured === '') return DEFAULT_MIN_STOCK;
  const threshold = Number(configured);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_MIN_STOCK;
}

export function getStockStatus(product) {
  const stock = Number(product?.stock) || 0;
  if (stock <= 0) return 'Out of Stock';
  return stock < getMinStock(product) ? 'Low Stock' : 'In Stock';
}

export function isLowStock(product) {
  return getStockStatus(product) === 'Low Stock';
}
