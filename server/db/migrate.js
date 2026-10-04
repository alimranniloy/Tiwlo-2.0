import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MasterDB, TenantDB } from './multiTenant.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../data');
const BACKUP_DIR = path.join(DATA_DIR, 'migration_backup');

export async function runMigration() {
  console.log('🔄 [Migration Engine] Starting Data Migration to Multi-Tenant Database...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 1. Read existing JSON files if they exist
  const readOldJson = (filename, defaultVal = []) => {
    const p = path.join(DATA_DIR, filename);
    if (!fs.existsSync(p)) return defaultVal;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch (e) {
      console.warn(`Could not parse ${filename}:`, e.message);
      return defaultVal;
    }
  };

  const oldUsers = readOldJson('users.json', []);
  const oldSessions = readOldJson('sessions.json', []);
  const oldSubscription = readOldJson('subscription.json', {});
  const oldProducts = readOldJson('products.json', []);
  const oldCategories = readOldJson('categories.json', []);
  const oldSubcategories = readOldJson('subcategories.json', []);
  const oldCustomers = readOldJson('customers.json', []);
  const oldSuppliers = readOldJson('suppliers.json', []);
  const oldPurchases = readOldJson('purchases.json', []);
  const oldSales = readOldJson('sales.json', []);
  const oldAdjustments = readOldJson('inventory_adjustments.json', []);
  const oldActivities = readOldJson('activities.json', []);
  const oldStoreSettings = readOldJson('store_settings.json', {});

  // 2. Populate Master Database
  const masterData = MasterDB.getMasterData();
  
  // Migrate users & map storeId -> tiwiId
  const migratedUsers = oldUsers.map(u => ({
    ...u,
    tiwiId: u.tiwiId || u.storeId || 'TIW-PRIMARY',
    storeId: u.tiwiId || u.storeId || 'TIW-PRIMARY'
  }));

  masterData.users = migratedUsers;

  // Migrate sessions
  masterData.sessions = (oldSessions.length > 0 ? oldSessions : []).map(s => ({
    ...s,
    tiwiId: s.tiwiId || s.storeId || 'TIW-PRIMARY',
    storeId: s.tiwiId || s.storeId || 'TIW-PRIMARY'
  }));

  // Migrate stores registry
  masterData.stores = migratedUsers.map(u => ({
    id: `store_${u.tiwiId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    tiwiId: u.tiwiId,
    storeName: u.storeName,
    subdomain: u.subdomain || `${u.storeName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'store'}.${process.env.PRIMARY_DOMAIN || 'tiwlo.com'}`,
    ownerId: u.id,
    planId: u.planId || 'free',
    dbSchema: `store_${u.tiwiId.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
    status: 'active',
    createdAt: u.createdAt || new Date().toISOString()
  }));

  // Migrate subscription
  masterData.subscriptions = [
    {
      tiwiId: 'TIW-PRIMARY',
      planId: oldSubscription.planId || 'enterprise',
      planName: oldSubscription.planName || 'Enterprise Unlimited',
      price: oldSubscription.price || '$0',
      productLimit: oldSubscription.productLimit || 10000,
      warehouseLimit: oldSubscription.warehouseLimit || 10,
      hasCustomDomain: oldSubscription.hasCustomDomain || true
    }
  ];

  MasterDB.saveMasterData(masterData);
  console.log(`✅ [Migration] Migrated ${masterData.users.length} Users & Stores into Master Database.`);

  // 3. Populate Primary Tenant Store Database (TIW-PRIMARY)
  const primaryStoreData = {
    tiwiId: 'TIW-PRIMARY',
    storeName: oldStoreSettings.storeName || 'Tiwlo Main Store',
    products: oldProducts,
    categories: oldCategories,
    subcategories: oldSubcategories,
    customers: oldCustomers,
    suppliers: oldSuppliers,
    purchases: oldPurchases,
    sales: oldSales,
    inventory_adjustments: oldAdjustments,
    activities: oldActivities,
    store_settings: {
      ...oldStoreSettings,
      tiwiId: 'TIW-PRIMARY',
      storeName: oldStoreSettings.storeName || 'Tiwlo Main Store'
    }
  };

  TenantDB.saveStoreDb('TIW-PRIMARY', primaryStoreData);
  console.log(`✅ [Migration] Migrated ${oldProducts.length} Products, ${oldCategories.length} Categories, ${oldSales.length} Sales into Isolated Tenant Store: store_tiw_10001.json`);

  // Also ensure any additional registered stores from users have their isolated DB provisioned
  for (const u of migratedUsers) {
    if (u.tiwiId && u.tiwiId !== 'TIW-PRIMARY') {
      await TenantDB.provisionStore(u.tiwiId, u.storeName, u.planId);
    }
  }

  // 4. Backup old JSON files and delete obsolete files as requested by user
  const filesToMigrate = [
    'products.json',
    'categories.json',
    'subcategories.json',
    'customers.json',
    'suppliers.json',
    'purchases.json',
    'sales.json',
    'inventory_adjustments.json',
    'activities.json',
    'users.json',
    'sessions.json',
    'subscription.json',
    'store_settings.json',
    'system_settings.json'
  ];

  let cleanedCount = 0;
  for (const file of filesToMigrate) {
    const src = path.join(DATA_DIR, file);
    if (fs.existsSync(src)) {
      // Backup
      const dest = path.join(BACKUP_DIR, file);
      fs.copyFileSync(src, dest);
      // Remove obsolete flat JSON file
      fs.unlinkSync(src);
      cleanedCount++;
    }
  }

  console.log(`🧹 [Migration] Cleaned up ${cleanedCount} obsolete JSON files (safely backed up to data/migration_backup/).`);
  console.log('🎉 [Migration Engine] Multi-Tenant Database Migration Completed Successfully!');
}
