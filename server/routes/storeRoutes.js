import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MasterDB, TenantDB } from '../db/multiTenant.js';
import {
  readData,
  writeData,
  logActivity,
  getActiveTiwiId,
  PRODUCTS_FILE,
  CATEGORIES_FILE,
  SUBCATEGORIES_FILE,
  PURCHASES_FILE,
  SALES_FILE,
  CUSTOMERS_FILE,
  SUPPLIERS_FILE,
  STORE_SETTINGS_FILE,
  SUBSCRIPTION_FILE
} from '../db/storeDataAdapter.js';
import {
  contentSafetyMiddleware,
  checkAssetScope
} from '../security/index.js';
import { PaymentSecurity } from '../security/cryptoSecurity.js';
import { PLATFORM_CONFIG } from '../config/platformConfig.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    cb(null, `store_${Date.now()}_${cleanName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const router = express.Router();

// Store management and POS data are private to an authenticated tenant.
router.use((req, res, next) => {
  // Never intercept auth or public endpoints
  if (req.path.startsWith('/auth') || req.path.startsWith('/public') || req.path.startsWith('/media')) {
    return next();
  }
  if (!req.activeUser) return res.status(401).json({ error: 'Authentication required' });
  next();
});

const getReqUserId = (req) => {
  // This route runs after authentication: ownership always comes from the
  // verified session, never from a spoofable request field.
  return req.activeUser?.id || req.activeUser?.tiwiId || null;
};

// ==========================================
// MULTI-STORE DIRECTORY ("YOUR STORE")
// ==========================================
router.get('/stores', async (req, res) => {
  try {
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const stores = await MasterDB.getUserStores(userId);
    res.json(stores);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stores' });
  }
});

router.post('/stores', async (req, res) => {
  try {
    const { storeName, subdomain, planId, category, currency, billingDetails } = req.body;
    const userId = getReqUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!storeName || !storeName.trim()) {
      return res.status(400).json({ error: 'Store name is required' });
    }
    const store = await MasterDB.createStoreForUser({
      userId,
      storeName,
      subdomain,
      planId: planId || 'free',
      category,
      currency,
      billingDetails
    });
    res.json(store);
  } catch (err) {
    console.error('Error creating store:', err);
    res.status(500).json({ error: err.message || 'Failed to create store' });
  }
});

// ==========================================
// PRODUCTS CRUD
// ==========================================
router.get('/products', (req, res) => {
  let products = readData(PRODUCTS_FILE, []);
  const { category, subCategory, status, search, sortBy } = req.query;

  if (category && category !== 'All Categories') {
    products = products.filter(p => (p.category || '').toLowerCase() === category.toLowerCase());
  }

  if (subCategory && subCategory !== 'All Subcategories') {
    products = products.filter(p => (p.subCategory || '').toLowerCase() === subCategory.toLowerCase());
  }

  if (status && status !== 'All Status') {
    products = products.filter(p => (p.status || '').toLowerCase() === status.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    products = products.filter(
      p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.subCategory || '').toLowerCase().includes(q)
    );
  }

  if (sortBy) {
    if (sortBy === 'name') products.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === 'stock-asc') products.sort((a, b) => (a.stock || 0) - (b.stock || 0));
    else if (sortBy === 'stock-desc') products.sort((a, b) => (b.stock || 0) - (a.stock || 0));
    else if (sortBy === 'price-asc') products.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sortBy === 'price-desc') products.sort((a, b) => (b.price || 0) - (a.price || 0));
  }

  res.json(products);
});

router.get('/products/:id', (req, res) => {
  const products = readData(PRODUCTS_FILE, []);
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/products', contentSafetyMiddleware('public_product'), (req, res) => {
  const products = readData(PRODUCTS_FILE, []);
  const {
    name,
    sku,
    barcode,
    category,
    subCategory,
    stock,
    minStock,
    price,
    costPrice,
    status,
    location,
    supplierId,
    supplierName,
    image,
    images,
    description,
    brand,
    unit
  } = req.body;

  const candidateImages = [image, ...(Array.isArray(images) ? images : [])].filter(Boolean);
  for (const imgUrl of candidateImages) {
    const scopeCheck = checkAssetScope(imgUrl, 'public_catalog');
    if (!scopeCheck.allowed) {
      return res.status(403).json({
        error: 'SECURITY_SCOPE_VIOLATION',
        message: scopeCheck.reason
      });
    }
  }

  if (!name || !sku) {
    return res.status(400).json({ error: 'Name and SKU are required' });
  }

  const existingSku = products.find(p => p.sku.toLowerCase() === sku.toLowerCase());
  if (existingSku) {
    return res.status(400).json({ error: 'A product with this SKU already exists' });
  }

  const stockVal = parseInt(stock) || 0;
  const minStockVal = parseInt(minStock) || 20;
  const autoStatus = status || (stockVal === 0 ? 'Out of Stock' : (stockVal < minStockVal ? 'Low Stock' : 'In Stock'));

  const newProduct = {
    id: `prod-${Date.now()}`,
    name,
    sku,
    barcode: barcode || `BC-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
    category: category || 'Electronics',
    subCategory: subCategory || '',
    stock: stockVal,
    minStock: minStockVal,
    price: parseFloat(price) || 0,
    costPrice: parseFloat(costPrice) || 0,
    status: autoStatus,
    location: location || 'Main Warehouse',
    supplierId: supplierId || '',
    supplierName: supplierName || '',
    image: image || (Array.isArray(images) && images[0]) || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&q=80',
    images: Array.isArray(images) && images.length ? images : (image ? [image] : []),
    description: description || '',
    brand: brand || '',
    unit: unit || 'Pcs',
    sold: 0,
    revenue: 0,
    growth: '+0%',
    createdAt: new Date().toISOString()
  };

  products.unshift(newProduct);
  writeData(PRODUCTS_FILE, products);

  logActivity('product', 'New product added', `${name} (${sku}) - Stock: ${stockVal}`);
  res.status(201).json(newProduct);
});

router.put('/products/:id', contentSafetyMiddleware('public_product'), (req, res) => {
  const products = readData(PRODUCTS_FILE, []);
  const { id } = req.params;
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const existing = products[index];
  const {
    name,
    sku,
    barcode,
    category,
    subCategory,
    stock,
    minStock,
    price,
    costPrice,
    status,
    location,
    supplierId,
    supplierName,
    image,
    images,
    description,
    brand,
    unit
  } = req.body;

  if (sku && sku.toLowerCase() !== existing.sku.toLowerCase()) {
    const existingSku = products.find(p => p.sku.toLowerCase() === sku.toLowerCase() && p.id !== id);
    if (existingSku) {
      return res.status(400).json({ error: 'A product with this SKU already exists' });
    }
  }

  const stockVal = stock !== undefined ? parseInt(stock) : existing.stock;
  const minStockVal = minStock !== undefined ? parseInt(minStock) : (existing.minStock || 20);
  const autoStatus = status || (stockVal === 0 ? 'Out of Stock' : (stockVal < minStockVal ? 'Low Stock' : 'In Stock'));

  const updatedProduct = {
    ...existing,
    name: name !== undefined ? name : existing.name,
    sku: sku !== undefined ? sku : existing.sku,
    barcode: barcode !== undefined ? barcode : existing.barcode,
    category: category !== undefined ? category : existing.category,
    subCategory: subCategory !== undefined ? subCategory : existing.subCategory,
    stock: stockVal,
    minStock: minStockVal,
    price: price !== undefined ? parseFloat(price) : existing.price,
    costPrice: costPrice !== undefined ? parseFloat(costPrice) : existing.costPrice,
    status: autoStatus,
    location: location !== undefined ? location : existing.location,
    supplierId: supplierId !== undefined ? supplierId : existing.supplierId,
    supplierName: supplierName !== undefined ? supplierName : existing.supplierName,
    image: image !== undefined ? image : existing.image,
    images: images !== undefined ? images : existing.images,
    description: description !== undefined ? description : existing.description,
    brand: brand !== undefined ? brand : existing.brand,
    unit: unit !== undefined ? unit : existing.unit,
    updatedAt: new Date().toISOString()
  };

  products[index] = updatedProduct;
  writeData(PRODUCTS_FILE, products);

  logActivity('product', 'Product updated', `${updatedProduct.name} (${updatedProduct.sku})`);
  res.json(updatedProduct);
});

router.delete('/products/:id', (req, res) => {
  const products = readData(PRODUCTS_FILE, []);
  const { id } = req.params;
  const index = products.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }

  const [deletedProduct] = products.splice(index, 1);
  writeData(PRODUCTS_FILE, products);

  logActivity('alert', 'Product deleted', `${deletedProduct.name} (${deletedProduct.sku})`);
  res.json({ message: 'Product deleted successfully', product: deletedProduct });
});

// ==========================================
// CATEGORIES & SUBCATEGORIES
// ==========================================
router.get('/categories', (req, res) => {
  const categories = readData(CATEGORIES_FILE, []);
  const products = readData(PRODUCTS_FILE, []);

  const enriched = categories.map(cat => {
    const prods = products.filter(p => (p.category || '').toLowerCase() === cat.name.toLowerCase());
    return {
      ...cat,
      itemCount: prods.length
    };
  });

  res.json(enriched);
});

router.post('/categories', (req, res) => {
  const categories = readData(CATEGORIES_FILE, []);
  const { name, description, icon, color } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const existing = categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'Category with this name already exists' });
  }

  const newCategory = {
    id: `cat-${Date.now()}`,
    name: name.trim(),
    slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: description || '',
    icon: icon || 'Package',
    color: color || '#3B82F6',
    itemCount: 0,
    createdAt: new Date().toISOString()
  };

  categories.push(newCategory);
  writeData(CATEGORIES_FILE, categories);

  logActivity('category', 'New category created', newCategory.name);
  res.status(201).json(newCategory);
});

router.put('/categories/:id', (req, res) => {
  const categories = readData(CATEGORIES_FILE, []);
  const { id } = req.params;
  const index = categories.findIndex(c => c.id === id);

  if (index === -1) return res.status(404).json({ error: 'Category not found' });

  const existing = categories[index];
  const { name, description, icon, color } = req.body;

  const updated = {
    ...existing,
    name: name !== undefined ? name.trim() : existing.name,
    slug: name !== undefined ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') : existing.slug,
    description: description !== undefined ? description : existing.description,
    icon: icon !== undefined ? icon : existing.icon,
    color: color !== undefined ? color : existing.color,
    updatedAt: new Date().toISOString()
  };

  categories[index] = updated;
  writeData(CATEGORIES_FILE, categories);

  logActivity('category', 'Category updated', updated.name);
  res.json(updated);
});

router.delete('/categories/:id', (req, res) => {
  const categories = readData(CATEGORIES_FILE, []);
  const { id } = req.params;
  const index = categories.findIndex(c => c.id === id);

  if (index === -1) return res.status(404).json({ error: 'Category not found' });

  const [deleted] = categories.splice(index, 1);
  writeData(CATEGORIES_FILE, categories);

  logActivity('alert', 'Category deleted', deleted.name);
  res.json({ message: 'Category deleted successfully', category: deleted });
});

router.get('/subcategories', (req, res) => {
  let subcategories = readData(SUBCATEGORIES_FILE, []);
  const products = readData(PRODUCTS_FILE, []);
  const { categoryId, categoryName } = req.query;

  if (categoryId) {
    subcategories = subcategories.filter(s => s.categoryId === categoryId);
  }
  if (categoryName) {
    subcategories = subcategories.filter(s => (s.categoryName || '').toLowerCase() === categoryName.toLowerCase());
  }

  const enriched = subcategories.map(sub => {
    const prods = products.filter(p => (p.subCategory || '').toLowerCase() === sub.name.toLowerCase());
    return {
      ...sub,
      productCount: prods.length
    };
  });

  res.json(enriched);
});

router.post('/subcategories', (req, res) => {
  const subcategories = readData(SUBCATEGORIES_FILE, []);
  const categories = readData(CATEGORIES_FILE, []);
  const { categoryId, categoryName, name, description } = req.body;

  if ((!categoryId && !categoryName) || !name) {
    return res.status(400).json({ error: 'Parent Category and Subcategory Name are required' });
  }

  const parentCat = categories.find(c => c.id === categoryId || (categoryName && c.name.toLowerCase() === categoryName.toLowerCase()));
  const parentName = parentCat ? parentCat.name : (categoryName || 'General');
  const finalCatId = parentCat ? parentCat.id : (categoryId || `cat-${Date.now()}`);

  const newSub = {
    id: `sub-${Date.now()}`,
    categoryId: finalCatId,
    categoryName: parentName,
    name: name.trim(),
    slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: description || '',
    createdAt: new Date().toISOString()
  };

  subcategories.push(newSub);
  writeData(SUBCATEGORIES_FILE, subcategories);

  logActivity('category', 'New subcategory created', `${newSub.name} (in ${parentName})`);
  res.status(201).json(newSub);
});

router.put('/subcategories/:id', (req, res) => {
  const subcategories = readData(SUBCATEGORIES_FILE, []);
  const categories = readData(CATEGORIES_FILE, []);
  const { id } = req.params;
  const index = subcategories.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: 'Subcategory not found' });

  const existing = subcategories[index];
  const { categoryId, name, description } = req.body;

  let parentName = existing.categoryName;
  if (categoryId && categoryId !== existing.categoryId) {
    const parentCat = categories.find(c => c.id === categoryId);
    if (parentCat) parentName = parentCat.name;
  }

  const updated = {
    ...existing,
    categoryId: categoryId || existing.categoryId,
    categoryName: parentName,
    name: name !== undefined ? name.trim() : existing.name,
    slug: name !== undefined ? name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') : existing.slug,
    description: description !== undefined ? description : existing.description,
    updatedAt: new Date().toISOString()
  };

  subcategories[index] = updated;
  writeData(SUBCATEGORIES_FILE, subcategories);

  logActivity('category', 'Subcategory updated', updated.name);
  res.json(updated);
});

router.delete('/subcategories/:id', (req, res) => {
  const subcategories = readData(SUBCATEGORIES_FILE, []);
  const { id } = req.params;
  const index = subcategories.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: 'Subcategory not found' });

  const [deleted] = subcategories.splice(index, 1);
  writeData(SUBCATEGORIES_FILE, subcategories);

  logActivity('alert', 'Subcategory deleted', deleted.name);
  res.json({ message: 'Subcategory deleted successfully', subcategory: deleted });
});

// ==========================================
// INVENTORY CONTROL & ADJUSTMENTS
// ==========================================
router.get('/inventory/summary', (req, res) => {
  const products = readData(PRODUCTS_FILE, []);
  const totalUnits = products.reduce((sum, p) => sum + (p.stock || 0), 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.price || 0)), 0);
  const totalCostValuation = products.reduce((sum, p) => sum + ((p.stock || 0) * (p.costPrice || (p.price * 0.5))), 0);
  const potentialProfit = totalRetailValuation - totalCostValuation;

  const lowStock = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < (p.minStock || 50));
  const outOfStock = products.filter(p => (p.stock || 0) === 0);

  res.json({
    totalProducts: products.length,
    totalUnits,
    totalRetailValuation: Math.round(totalRetailValuation),
    totalCostValuation: Math.round(totalCostValuation),
    potentialProfit: Math.round(potentialProfit),
    marginPercent: totalRetailValuation > 0 ? Math.round((potentialProfit / totalRetailValuation) * 100) : 0,
    lowStockCount: lowStock.length,
    outOfStockCount: outOfStock.length,
    lowStockProducts: lowStock,
    outOfStockProducts: outOfStock
  });
});

router.get('/inventory/adjustments', (req, res) => {
  const adjustments = readData('inventory_adjustments.json', []);
  res.json(adjustments);
});

router.post('/inventory/adjustments', (req, res) => {
  const adjustments = readData('inventory_adjustments.json', []);
  const products = readData(PRODUCTS_FILE, []);
  const { productId, type, quantity, reason, adjustedBy } = req.body;

  const product = products.find(p => p.id === productId);
  if (!product) return res.status(404).json({ error: 'Product not found' });

  const qty = parseInt(quantity) || 0;
  const previousStock = product.stock || 0;
  let newStock = previousStock;

  if (type === 'Add' || type === 'Received') {
    newStock = previousStock + Math.abs(qty);
  } else if (type === 'Remove' || type === 'Damage' || type === 'Loss') {
    newStock = Math.max(0, previousStock - Math.abs(qty));
  } else if (type === 'Audit Count' || type === 'Exact Set') {
    newStock = Math.max(0, qty);
  }

  product.stock = newStock;
  const minStock = product.minStock || 50;
  product.status = newStock === 0 ? 'Out of Stock' : (newStock < minStock ? 'Low Stock' : 'In Stock');
  product.updatedAt = new Date().toISOString();

  writeData(PRODUCTS_FILE, products);

  const newAdjustment = {
    id: `adj-${Date.now()}`,
    productId,
    productName: product.name,
    sku: product.sku,
    type: type || 'Stock Adjustment',
    quantity: newStock - previousStock,
    reason: reason || 'Routine inventory reconciliation',
    adjustedBy: adjustedBy || 'Inventory Manager',
    previousStock,
    newStock,
    createdAt: new Date().toISOString()
  };

  adjustments.unshift(newAdjustment);
  writeData('inventory_adjustments.json', adjustments.slice(0, 100));

  logActivity('stock', 'Inventory adjusted', `${product.name} (${product.sku}): ${previousStock} ➔ ${newStock} (${newAdjustment.type})`);

  res.status(201).json({ adjustment: newAdjustment, product });
});

// ==========================================
// PURCHASES & RESTOCK ORDERS
// ==========================================
router.get('/purchases', (req, res) => {
  const purchases = readData(PURCHASES_FILE, []);
  res.json(purchases);
});

router.post('/purchases', (req, res) => {
  const purchases = readData(PURCHASES_FILE, []);
  const products = readData(PRODUCTS_FILE, []);
  const { supplierId, supplierName, items, notes, expectedDelivery } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'At least one item is required for purchase order' });
  }
  if (items.some(item => !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0 || !Number.isFinite(Number(item.unitCost)) || Number(item.unitCost) < 0)) {
    return res.status(400).json({ error: 'Each purchase item needs a positive whole quantity and a valid unit cost' });
  }

  let totalAmount = 0;
  const enrichedItems = items.map(item => {
    const qty = Number(item.quantity);
    const unitCost = Number(item.unitCost);
    const itemTotal = qty * unitCost;
    totalAmount += itemTotal;

    const prod = products.find(p => p.id === item.productId);
    return {
      productId: item.productId,
      productName: prod ? prod.name : (item.productName || 'General Item'),
      sku: prod ? prod.sku : (item.sku || 'SKU-000'),
      quantity: qty,
      unitCost,
      total: itemTotal
    };
  });

  const poNumber = `PO-${Math.floor(1000 + Math.random() * 9000)}`;

  const newPO = {
    id: `po-${Date.now()}`,
    poNumber,
    supplierId: supplierId || '',
    supplierName: supplierName || 'Global Supplier',
    date: new Date().toISOString(),
    status: 'Pending',
    paymentStatus: 'Unpaid',
    items: enrichedItems,
    totalAmount: Math.round(totalAmount * 100) / 100,
    expectedDelivery: expectedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    notes: notes || 'Standard restocking order'
  };

  purchases.unshift(newPO);
  writeData(PURCHASES_FILE, purchases);

  logActivity('purchase', 'Purchase order created', `${poNumber} • $${totalAmount.toFixed(2)} (${newPO.supplierName})`);

  res.status(201).json(newPO);
});

router.put('/purchases/:id', (req, res) => {
  const purchases = readData(PURCHASES_FILE, []);
  const products = readData(PRODUCTS_FILE, []);
  const { id } = req.params;
  const index = purchases.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Purchase order not found' });

  const existing = purchases[index];
  const { status, paymentStatus, notes } = req.body;

  if (status === 'Received' && existing.status !== 'Received') {
    existing.receivedAt = new Date().toISOString();
    if (Array.isArray(existing.items)) {
      existing.items.forEach(item => {
        const prod = products.find(p => p.id === item.productId);
        if (prod) {
          prod.stock = (prod.stock || 0) + (item.quantity || 0);
          const minStock = prod.minStock || 50;
          prod.status = prod.stock === 0 ? 'Out of Stock' : (prod.stock < minStock ? 'Low Stock' : 'In Stock');
        }
      });
      writeData(PRODUCTS_FILE, products);
    }
    logActivity('stock', 'PO Items Restocked into Inventory', `${existing.poNumber} received - stocks updated.`);
  }

  const updated = {
    ...existing,
    status: status || existing.status,
    paymentStatus: paymentStatus || existing.paymentStatus,
    notes: notes !== undefined ? notes : existing.notes,
    updatedAt: new Date().toISOString()
  };

  purchases[index] = updated;
  writeData(PURCHASES_FILE, purchases);

  logActivity('purchase', 'Purchase order updated', `${updated.poNumber} status: ${updated.status}`);
  res.json(updated);
});

router.delete('/purchases/:id', (req, res) => {
  const purchases = readData(PURCHASES_FILE, []);
  const { id } = req.params;
  const index = purchases.findIndex(p => p.id === id);

  if (index === -1) return res.status(404).json({ error: 'Purchase order not found' });

  const [deleted] = purchases.splice(index, 1);
  writeData(PURCHASES_FILE, purchases);

  logActivity('alert', 'Purchase order deleted', deleted.poNumber);
  res.json({ message: 'Purchase order deleted', purchase: deleted });
});

// ==========================================
// PAYMENT TOKENIZATION & SALES
// ==========================================
router.post('/payments/tokenize', (req, res) => {
  try {
    const tiwiId = getActiveTiwiId(req);
    const { items, totalAmount, currency = 'USD' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required for payment tokenization' });
    }

    const paymentIntent = PaymentSecurity.tokenizePaymentIntent(tiwiId, items, totalAmount, currency);
    res.json({
      success: true,
      paymentIntent,
      message: 'Payment intent cryptographically tokenized successfully'
    });
  } catch (err) {
    console.error('Payment tokenization error:', err);
    res.status(500).json({ error: 'Failed to tokenize payment intent' });
  }
});

router.get('/sales', (req, res) => {
  const sales = readData(SALES_FILE, []);
  res.json(sales);
});

router.post('/sales', (req, res) => {
  const sales = readData(SALES_FILE, []);
  const products = readData(PRODUCTS_FILE, []);
  const customers = readData(CUSTOMERS_FILE, []);
  const tiwiId = getActiveTiwiId(req);

  const { customerId, customerName, items, paymentMethod, discount, notes, paymentToken, paymentSignature, paymentTimestamp } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'At least one item is required to create a sale' });
  }

  if (paymentToken && paymentSignature && paymentTimestamp) {
    const isTamperFree = PaymentSecurity.verifyPaymentIntegrity(
      tiwiId,
      paymentToken,
      paymentSignature,
      paymentTimestamp,
      items,
      req.body.totalAmount || 0
    );
    if (!isTamperFree) {
      logActivity('alert', 'Payment Tampering Attempt Detected!', `Invalid signature on payment token: ${paymentToken}`, tiwiId);
      return res.status(403).json({ error: '🚨 Security Alert: Cryptographic payment integrity verification failed. Transaction blocked.' });
    }
  }

  let subtotal = 0;
  const enrichedItems = [];

  const requestedQuantities = new Map();
  for (const item of items) {
    const qty = Number(item.quantity);
    const prod = products.find(p => p.id === item.productId || p.id === item.id);
    if (!Number.isInteger(qty) || qty <= 0) {
      return res.status(400).json({ error: 'Each sale item needs a positive whole quantity' });
    }
    if (!prod) {
      return res.status(400).json({ error: 'Every sale item must reference an existing product' });
    }
    const requested = (requestedQuantities.get(prod.id) || 0) + qty;
    if (requested > Number(prod.stock || 0)) {
      return res.status(400).json({ error: `Insufficient stock for ${prod.name}` });
    }
    requestedQuantities.set(prod.id, requested);
    const unitPrice = Number(prod.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ error: `Invalid price configured for ${prod.name}` });
    }
    const itemTotal = parseFloat((qty * unitPrice).toFixed(2));
    subtotal += itemTotal;

    prod.stock = Number(prod.stock || 0) - qty;
    prod.sold = Number(prod.sold || 0) + qty;
    prod.revenue = parseFloat((Number(prod.revenue || 0) + itemTotal).toFixed(2));
    const minStock = Number(prod.minStock || 20);
    prod.status = prod.stock === 0 ? 'Out of Stock' : (prod.stock < minStock ? 'Low Stock' : 'In Stock');

    enrichedItems.push({
      productId: item.productId || item.id,
      productName: prod ? prod.name : (item.productName || 'Store Product'),
      sku: prod ? prod.sku : (item.sku || 'SKU-000'),
      quantity: qty,
      unitPrice,
      total: itemTotal
    });
  }

  writeData(PRODUCTS_FILE, products, tiwiId);

  const storeSettings = readData(STORE_SETTINGS_FILE, {}, tiwiId);
  const configuredTaxRate = Number(storeSettings?.taxRate);
  const taxRate = Number.isFinite(configuredTaxRate) && configuredTaxRate >= 0 ? configuredTaxRate / 100 : 0.05;
  subtotal = parseFloat(Number(subtotal).toFixed(2));
  const requestedDiscount = Number(discount);
  const discountAmount = Number.isFinite(requestedDiscount) ? Math.min(subtotal, Math.max(0, requestedDiscount)) : 0;
  const tax = parseFloat(Math.max(0, (subtotal - discountAmount) * taxRate).toFixed(2));
  const totalAmount = parseFloat((subtotal - discountAmount + tax).toFixed(2));

  const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  if (customerId) {
    const custIndex = customers.findIndex(c => c.id === customerId);
    if (custIndex !== -1) {
      customers[custIndex].totalOrders = (customers[custIndex].totalOrders || 0) + 1;
      customers[custIndex].totalSpent = parseFloat(((customers[custIndex].totalSpent || 0) + totalAmount).toFixed(2));
      writeData(CUSTOMERS_FILE, customers, tiwiId);
    }
  }

  const newSale = {
    id: `inv-${Date.now()}`,
    invoiceNumber,
    customerId: customerId || '',
    customerName: customerName || 'Walk-in Customer',
    date: new Date().toISOString(),
    items: enrichedItems,
    subtotal,
    tax,
    discount: discountAmount,
    totalAmount,
    paymentMethod: paymentMethod || 'Cash',
    paymentToken: paymentToken || `pay_verified_${Date.now()}`,
    status: 'Completed',
    notes: notes || 'Point of Sale Transaction'
  };

  sales.unshift(newSale);
  writeData(SALES_FILE, sales, tiwiId);

  logActivity('sale', 'New sale completed', `${invoiceNumber} • $${totalAmount.toFixed(2)} (${newSale.customerName})`, tiwiId);

  res.status(201).json(newSale);
});

// ==========================================
// CUSTOMERS & SUPPLIERS CRUD
// ==========================================
router.get('/customers', (req, res) => {
  const customers = readData(CUSTOMERS_FILE, []);
  res.json(customers);
});

router.post('/customers', (req, res) => {
  const customers = readData(CUSTOMERS_FILE, []);
  const {
    name,
    email,
    phone,
    address,
    city,
    customerType,
    contactPerson,
    taxId,
    country,
    paymentTerms,
    creditLimit,
    notes
  } = req.body;

  if (!name) return res.status(400).json({ error: 'Customer name is required' });

  const newCust = {
    id: `cust-${Date.now()}`,
    name,
    customerType: customerType || 'Retail',
    contactPerson: contactPerson || '',
    email: email || '',
    phone: phone || '',
    address: address || '',
    city: city || 'Dhaka',
    country: country || 'Global',
    taxId: taxId || '',
    paymentTerms: paymentTerms || 'Immediate',
    creditLimit: creditLimit ? parseFloat(creditLimit) : 0,
    notes: notes || '',
    totalOrders: 0,
    totalSpent: 0,
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  customers.unshift(newCust);
  writeData(CUSTOMERS_FILE, customers);

  logActivity('customer', 'New customer registered', `${name} (${newCust.customerType} - ${newCust.city})`);
  res.status(201).json(newCust);
});

router.put('/customers/:id', (req, res) => {
  const customers = readData(CUSTOMERS_FILE, []);
  const { id } = req.params;
  const index = customers.findIndex(c => c.id === id);

  if (index === -1) return res.status(404).json({ error: 'Customer not found' });

  const existing = customers[index];
  const {
    name,
    email,
    phone,
    address,
    city,
    customerType,
    contactPerson,
    taxId,
    country,
    paymentTerms,
    creditLimit,
    notes,
    status
  } = req.body;

  const updated = {
    ...existing,
    name: name !== undefined ? name : existing.name,
    customerType: customerType !== undefined ? customerType : (existing.customerType || 'Retail'),
    contactPerson: contactPerson !== undefined ? contactPerson : (existing.contactPerson || ''),
    email: email !== undefined ? email : existing.email,
    phone: phone !== undefined ? phone : existing.phone,
    address: address !== undefined ? address : existing.address,
    city: city !== undefined ? city : existing.city,
    country: country !== undefined ? country : (existing.country || 'Global'),
    taxId: taxId !== undefined ? taxId : (existing.taxId || ''),
    paymentTerms: paymentTerms !== undefined ? paymentTerms : (existing.paymentTerms || 'Immediate'),
    creditLimit: creditLimit !== undefined ? parseFloat(creditLimit) : (existing.creditLimit || 0),
    notes: notes !== undefined ? notes : (existing.notes || ''),
    status: status !== undefined ? status : existing.status,
    updatedAt: new Date().toISOString()
  };

  customers[index] = updated;
  writeData(CUSTOMERS_FILE, customers);

  logActivity('customer', 'Customer updated', updated.name);
  res.json(updated);
});

router.delete('/customers/:id', (req, res) => {
  const customers = readData(CUSTOMERS_FILE, []);
  const { id } = req.params;
  const index = customers.findIndex(c => c.id === id);

  if (index === -1) return res.status(404).json({ error: 'Customer not found' });

  const [deleted] = customers.splice(index, 1);
  writeData(CUSTOMERS_FILE, customers);

  logActivity('alert', 'Customer deleted', deleted.name);
  res.json({ message: 'Customer deleted', customer: deleted });
});

router.get('/suppliers', (req, res) => {
  const suppliers = readData(SUPPLIERS_FILE, []);
  res.json(suppliers);
});

router.post('/suppliers', (req, res) => {
  const suppliers = readData(SUPPLIERS_FILE, []);
  const { companyName, contactPerson, email, phone, address, category, leadTimeDays } = req.body;

  if (!companyName) return res.status(400).json({ error: 'Company name is required' });

  const newSupplier = {
    id: `sup-${Date.now()}`,
    companyName,
    contactPerson: contactPerson || '',
    email: email || '',
    phone: phone || '',
    address: address || '',
    category: category || 'General',
    leadTimeDays: parseInt(leadTimeDays) || 5,
    rating: 4.8,
    status: 'Active',
    createdAt: new Date().toISOString()
  };

  suppliers.unshift(newSupplier);
  writeData(SUPPLIERS_FILE, suppliers);

  logActivity('supplier', 'New supplier onboarded', `${companyName} (${newSupplier.category})`);
  res.status(201).json(newSupplier);
});

router.put('/suppliers/:id', (req, res) => {
  const suppliers = readData(SUPPLIERS_FILE, []);
  const { id } = req.params;
  const index = suppliers.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: 'Supplier not found' });

  const existing = suppliers[index];
  const { companyName, contactPerson, email, phone, address, category, leadTimeDays, status } = req.body;

  const updated = {
    ...existing,
    companyName: companyName !== undefined ? companyName : existing.companyName,
    contactPerson: contactPerson !== undefined ? contactPerson : existing.contactPerson,
    email: email !== undefined ? email : existing.email,
    phone: phone !== undefined ? phone : existing.phone,
    address: address !== undefined ? address : existing.address,
    category: category !== undefined ? category : existing.category,
    leadTimeDays: leadTimeDays !== undefined ? parseInt(leadTimeDays) : existing.leadTimeDays,
    status: status !== undefined ? status : existing.status,
    updatedAt: new Date().toISOString()
  };

  suppliers[index] = updated;
  writeData(SUPPLIERS_FILE, suppliers);

  logActivity('supplier', 'Supplier updated', updated.companyName);
  res.json(updated);
});

router.delete('/suppliers/:id', (req, res) => {
  const suppliers = readData(SUPPLIERS_FILE, []);
  const { id } = req.params;
  const index = suppliers.findIndex(s => s.id === id);

  if (index === -1) return res.status(404).json({ error: 'Supplier not found' });

  const [deleted] = suppliers.splice(index, 1);
  writeData(SUPPLIERS_FILE, suppliers);

  logActivity('alert', 'Supplier deleted', deleted.companyName);
  res.json({ message: 'Supplier deleted', supplier: deleted });
});

// ==========================================
// STORE SETTINGS & ASSET UPLOADS
// ==========================================
router.get('/store/settings', (req, res) => {
  const account = req.activeUser || {};
  const defaultSettings = {
    storeName: account.storeName || account.name || 'Your Store',
    storeTagline: 'Shop Global • Sell Global',
    storeLogo: null,
    activeTheme: 'TiwiMart',
    themeColor: '#2563eb',
    themeColorPreset: 'sapphire',
    themeMode: 'light',
    contactEmail: account.email || '',
    contactPhone: account.phone || '',
    currency: 'USD',
    currencySymbol: '$',
    bannerSlidingSpeed: 5,
    availableThemes: [
      {
        id: 'TiwiMart',
        name: 'TiwiMart Global Marketplace',
        tagline: 'Modern Multi-Vendor & eCommerce Marketplace',
        category: 'Marketplace',
        rating: 4.9,
        reviewsCount: 1420,
        author: 'Tiwlo Engineering',
        version: '1.2.0',
        features: ['Sliding Hero Banner', 'Multi-Vendor Stores', 'Live Stock Sync', 'Realtime Cart & COD'],
        previewImage: '/banners/hero_banner_main.png'
      }
    ]
  };
  const settings = readData(STORE_SETTINGS_FILE, defaultSettings);
  res.json({ ...defaultSettings, ...settings });
});

router.put('/store/settings', (req, res) => {
  const current = readData(STORE_SETTINGS_FILE, {});
  const updated = {
    ...current,
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  writeData(STORE_SETTINGS_FILE, updated);
  logActivity('settings', 'Store settings updated', `Store: ${updated.storeName || 'TiwloMart'} • Theme: ${updated.activeTheme || 'TiwiMart'}`);
  res.json(updated);
});

router.post('/store/upload-logo', upload.single('logo'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No logo image file uploaded' });
    }
    const logoUrl = `/uploads/${req.file.filename}`;
    const current = readData(STORE_SETTINGS_FILE, {});
    current.storeLogo = logoUrl;
    current.updatedAt = new Date().toISOString();
    writeData(STORE_SETTINGS_FILE, current);
    logActivity('settings', 'Store logo updated', `New logo uploaded: ${req.file.originalname}`);
    res.json({ success: true, logoUrl, message: 'Store logo uploaded successfully' });
  } catch (err) {
    console.error('Logo upload error:', err);
    res.status(500).json({ error: 'Failed to upload logo image' });
  }
});

router.post('/store/upload-favicon', upload.single('favicon'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No favicon image file uploaded' });
    }
    const faviconUrl = `/uploads/${req.file.filename}`;
    const current = readData(STORE_SETTINGS_FILE, {});
    current.storeFavicon = faviconUrl;
    current.updatedAt = new Date().toISOString();
    writeData(STORE_SETTINGS_FILE, current);
    logActivity('settings', 'Store favicon updated', `New favicon uploaded: ${req.file.originalname}`);
    res.json({ success: true, faviconUrl, message: 'Store favicon uploaded successfully' });
  } catch (err) {
    console.error('Favicon upload error:', err);
    res.status(500).json({ error: 'Failed to upload favicon image' });
  }
});

router.post('/store/upload-banner', upload.single('banner'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No banner image file uploaded' });
    }
    const bannerUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, bannerUrl, message: 'Banner image uploaded successfully' });
  } catch (err) {
    console.error('Banner upload error:', err);
    res.status(500).json({ error: 'Failed to upload banner image' });
  }
});

// ==========================================
// SUBSCRIPTION & PLANS
// ==========================================
const DEFAULT_SUBSCRIPTION = {
  planId: 'free',
  planName: 'Free Starter',
  price: 0,
  billingCycle: 'monthly',
  productLimit: 50,
  warehouseLimit: 1,
  hasCustomDomain: false,
  subdomain: null,
  customDomain: null,
  activatedAt: null,
  status: 'active'
};

const PLAN_CATALOG = {
  free: { planId: 'free', planName: 'Free Starter', price: 0, productLimit: 50, warehouseLimit: 1, hasCustomDomain: false },
  growth: { planId: 'growth', planName: 'Growth Retailer', price: 19, productLimit: 500, warehouseLimit: 2, hasCustomDomain: true },
  pro: { planId: 'pro', planName: 'Pro Business', price: 49, productLimit: 5000, warehouseLimit: 5, hasCustomDomain: true },
  enterprise: { planId: 'enterprise', planName: 'Enterprise VIP', price: 129, productLimit: 999999, warehouseLimit: 99, hasCustomDomain: true }
};

router.get('/subscription', (req, res) => {
  const sub = readData(SUBSCRIPTION_FILE, DEFAULT_SUBSCRIPTION);
  const products = readData(PRODUCTS_FILE, []);
  const storeSettings = readData(STORE_SETTINGS_FILE, {});

  const currentProducts = products.length;
  const productLimit = sub.productLimit || 50;
  const usagePercent = Math.min(100, Math.round((currentProducts / productLimit) * 100));
  const remainingQuota = Math.max(0, productLimit - currentProducts);
  const isLimitReached = currentProducts >= productLimit;

  const cleanStoreName = (storeSettings.storeName || req.activeUser?.storeName || 'store').toLowerCase().replace(/[^a-z0-9]/g, '');
  const dynamicSubdomain = `${cleanStoreName || 'store'}.${PLATFORM_CONFIG.storeDomain}`;

  res.json({
    ...sub,
    subdomain: sub.subdomain || dynamicSubdomain,
    currentProducts,
    productLimit,
    usagePercent,
    remainingQuota,
    isLimitReached
  });
});

router.post('/subscription/upgrade', (req, res) => {
  try {
    const { planId, billingCycle = 'monthly' } = req.body;
    const planInfo = PLAN_CATALOG[planId];
    if (!planInfo) {
      return res.status(400).json({ error: 'Invalid subscription plan selected' });
    }

    const currentSub = readData(SUBSCRIPTION_FILE, DEFAULT_SUBSCRIPTION);
    const storeSettings = readData(STORE_SETTINGS_FILE, {});
    const cleanStoreName = (storeSettings.storeName || req.activeUser?.storeName || 'store').toLowerCase().replace(/[^a-z0-9]/g, '');

    const updated = {
      ...currentSub,
      planId: planInfo.planId,
      planName: planInfo.planName,
      price: billingCycle === 'annual' ? Math.round(planInfo.price * 0.8) : planInfo.price,
      billingCycle,
      productLimit: planInfo.productLimit,
      warehouseLimit: planInfo.warehouseLimit,
      hasCustomDomain: planInfo.hasCustomDomain,
      subdomain: currentSub.subdomain || `${cleanStoreName || 'store'}.${PLATFORM_CONFIG.storeDomain}`,
      updatedAt: new Date().toISOString()
    };

    writeData(SUBSCRIPTION_FILE, updated);
    logActivity('subscription', `Plan upgraded to ${planInfo.planName}`, `Billing: ${billingCycle}`);

    const products = readData(PRODUCTS_FILE, []);
    const currentProducts = products.length;
    const usagePercent = Math.min(100, Math.round((currentProducts / updated.productLimit) * 100));
    const remainingQuota = Math.max(0, updated.productLimit - currentProducts);

    res.json({
      success: true,
      subscription: {
        ...updated,
        currentProducts,
        usagePercent,
        remainingQuota,
        isLimitReached: currentProducts >= updated.productLimit
      },
      message: `Successfully switched to ${planInfo.planName}`
    });
  } catch (err) {
    console.error('Subscription upgrade error:', err);
    res.status(500).json({ error: 'Failed to process subscription upgrade' });
  }
});

export default router;
