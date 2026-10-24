export function getCategoryMetrics(category, products = []) {
  const matchingProducts = products.filter(
    product => (product.category || '').toLowerCase() === (category.name || '').toLowerCase()
  );

  return {
    itemCount: matchingProducts.length,
    productCount: matchingProducts.length,
    totalUnits: matchingProducts.reduce((total, product) => total + (Number(product.stock) || 0), 0)
  };
}

export function renameCategoryReferences(products, subcategories, previousName, nextName) {
  const previousKey = previousName.toLowerCase();
  return {
    products: products.map(product => (
      (product.category || '').toLowerCase() === previousKey
        ? { ...product, category: nextName }
        : product
    )),
    subcategories: subcategories.map(subcategory => (
      (subcategory.categoryName || '').toLowerCase() === previousKey
        ? { ...subcategory, categoryName: nextName }
        : subcategory
    ))
  };
}

export function deleteCategoryReferences(products, subcategories, category) {
  const categoryKey = (category.name || '').toLowerCase();
  const categorySubcategories = subcategories.filter(
    subcategory => subcategory.categoryId === category.id ||
      (subcategory.categoryName || '').toLowerCase() === categoryKey
  );
  const subcategoryNames = new Set(categorySubcategories.map(
    subcategory => (subcategory.name || '').toLowerCase()
  ));

  return {
    products: products.map(product => (
      (product.category || '').toLowerCase() === categoryKey
        ? { ...product, category: '', subCategory: '' }
        : (!product.category || (product.category || '').toLowerCase() === categoryKey) &&
          subcategoryNames.has((product.subCategory || '').toLowerCase())
          ? { ...product, subCategory: '' }
          : product
    )),
    subcategories: subcategories.filter(subcategory => !categorySubcategories.includes(subcategory))
  };
}

export function deleteSubcategoryReferences(products, subcategory) {
  const subcategoryKey = (subcategory.name || '').toLowerCase();
  return products.map(product => (
    (product.subCategory || '').toLowerCase() === subcategoryKey &&
      (!product.category || product.category.toLowerCase() === (subcategory.categoryName || '').toLowerCase())
      ? { ...product, subCategory: '' }
      : product
  ));
}

export function renameSubcategoryReferences(products, previousName, nextName, categoryName) {
  const previousKey = previousName.toLowerCase();
  const categoryKey = (categoryName || '').toLowerCase();
  return products.map(product => (
    (product.subCategory || '').toLowerCase() === previousKey &&
      (!product.category || product.category.toLowerCase() === categoryKey)
      ? { ...product, subCategory: nextName }
      : product
  ));
}

export function createStockAdjustment(product, previousStock, newStock, {
  type = 'Stock level update',
  reason = 'Product stock updated'
} = {}) {
  return {
    id: `adj-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    type,
    quantity: newStock - previousStock,
    reason,
    adjustedBy: 'Inventory Manager',
    previousStock,
    newStock,
    createdAt: new Date().toISOString()
  };
}

export function validateSellingPrice(value, fallback = 0) {
  const price = value === undefined || value === '' ? fallback : Number(value);
  return {
    valid: Number.isFinite(price) && price >= 0,
    price
  };
}

export function validateStock(value, fallback = 0) {
  const stock = value === undefined || value === '' ? fallback : Number(value);
  return {
    valid: Number.isSafeInteger(stock) && stock >= 0,
    stock
  };
}
