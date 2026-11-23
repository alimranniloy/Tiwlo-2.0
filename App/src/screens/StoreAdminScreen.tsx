import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Check,
  CreditCard,
  FileText,
  Globe,
  Image as ImageIcon,
  LayoutDashboard,
  Megaphone,
  Package,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Truck,
  UserCheck,
  Users,
  X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TIWLO_API_BASE, type TiwloUser } from '../services/tiwloAuth';
import { setStoreStatus } from '../services/tiwloAccount';
import { emitRealtimeSync } from '../services/tiwloRealtime';
import {
  adjustStoreInventory,
  createStoreCategory,
  createStoreCustomer,
  createStoreProduct,
  createStoreSupplier,
  deleteStoreCategory,
  deleteStoreProduct,
  fetchStoreAdminSnapshot,
  saveStoreSettings,
  type StoreCategoryRecord,
  type StoreCustomerRecord,
  type StoreFinanceSummary,
  type StoreInventorySummary,
  type StoreProductRecord,
  type StoreSaleRecord,
  type StoreSettingsRecord,
  type StoreSubscriptionRecord,
  type StoreSupplierRecord,
  updateStoreOrderStatus,
} from '../services/tiwloStoreAdmin';
import { colors } from '../theme/tokens';
import {
  formatMonthlyRate,
  formatStorePlanLabel,
  formatStoreStatusLabel,
  isStoreLive,
  type OnlineStoreRecord,
} from './OnlineStoreScreen';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');

export type StoreAdminTab = 'overview' | 'catalog' | 'orders' | 'flows' | 'settings';
type CatalogSubTab = 'products' | 'categories' | 'inventory';
type OrdersSubTab = 'sales' | 'customers' | 'suppliers';

export interface StoreAdminScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  store: OnlineStoreRecord;
  initialTab?: StoreAdminTab;
  onBack: () => void;
  onOpenUpgrade: () => void;
  onOpenInAppUrl: (title: string, url: string, storeTiwiId?: string) => void;
  onRequireAuth: () => void;
}

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;

const WEB_FLOW_GROUPS = [
  {
    group: 'Sales & POS Flows',
    items: [
      { id: 'pos', title: 'POS Terminal', desc: 'Fast checkout & barcode cart', path: '/pos', icon: CreditCard },
      { id: 'purchases', title: 'Purchases & Stock-In', desc: 'Supplier POs & returns', path: '/purchases', icon: Truck },
      { id: 'promotions', title: 'Promotions & Coupons', desc: 'Discount rules & vouchers', path: '/promotions', icon: Megaphone },
    ],
  },
  {
    group: 'Team & Operations',
    items: [
      { id: 'staff', title: 'Staff & Permissions', desc: 'Cashiers, managers & access', path: '/staff-management', icon: UserCheck },
      { id: 'hr', title: 'HR, Payroll & Advances', desc: 'Salaries & attendance logs', path: '/hr-management', icon: Users },
      { id: 'courier', title: 'Courier & Shipping', desc: 'Delivery partners & zones', path: '/courier', icon: Package },
      { id: 'payments', title: 'Payment Gateways', desc: 'bKash, Stripe, SSL & COD', path: '/payments', icon: CreditCard },
    ],
  },
  {
    group: 'Storefront & Insights',
    items: [
      { id: 'domains', title: 'Custom Domain & DNS', desc: 'Custom host & SSL certs', path: '/domain-settings', icon: Globe },
      { id: 'identity', title: 'Store Identity & Brand', desc: 'Logo, favicon & theme', path: '/store-identity', icon: Store },
      { id: 'banners', title: 'Banners & Store Pages', desc: 'Hero sliders & custom CMS', path: '/store-banners', icon: ImageIcon },
      { id: 'reviews', title: 'Customer Reviews', desc: 'Approve & reply to ratings', path: '/store-reviews', icon: Star },
      { id: 'analytics', title: 'Analytics & Reports', desc: 'Profit, sales & GST reports', path: '/analytics', icon: BarChart3 },
    ],
  },
] as const;

export const StoreAdminScreen: React.FC<StoreAdminScreenProps> = ({
  user,
  sessionToken,
  store,
  initialTab = 'overview',
  onBack,
  onOpenUpgrade,
  onOpenInAppUrl,
  onRequireAuth,
}) => {
  const insets = useSafeAreaInsets();
  const tiwiId = store.tiwiId || store.id;

  const [tab, setTab] = useState<StoreAdminTab>(initialTab);
  const [catalogSub, setCatalogSub] = useState<CatalogSubTab>('products');
  const [ordersSub, setOrdersSub] = useState<OrdersSubTab>('sales');
  const [storeStatus, setStoreStatusLocal] = useState(store.status || 'active');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const [products, setProducts] = useState<StoreProductRecord[]>([]);
  const [categories, setCategories] = useState<StoreCategoryRecord[]>([]);
  const [sales, setSales] = useState<StoreSaleRecord[]>([]);
  const [customers, setCustomers] = useState<StoreCustomerRecord[]>([]);
  const [suppliers, setSuppliers] = useState<StoreSupplierRecord[]>([]);
  const [finance, setFinance] = useState<StoreFinanceSummary>({});
  const [inventory, setInventory] = useState<StoreInventorySummary>({});
  const [subscription, setSubscription] = useState<StoreSubscriptionRecord | null>(null);
  const [settingsForm, setSettingsForm] = useState<StoreSettingsRecord>({
    storeName: store.storeName || '',
    currency: store.currency || 'USD',
  });

  // Modals
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pSku, setPSku] = useState('');
  const [pCategory, setPCategory] = useState('');
  const [pSellPrice, setPSellPrice] = useState('');
  const [pBuyPrice, setPBuyPrice] = useState('');
  const [pStock, setPStock] = useState('');
  const [pMinStock, setPMinStock] = useState('5');

  const [newCategoryName, setNewCategoryName] = useState('');

  const [adjustModalProduct, setAdjustModalProduct] = useState<StoreProductRecord | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [adjustReason, setAdjustReason] = useState('Restock');

  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [cName, setCName] = useState('');
  const [cPhone, setCPhone] = useState('');
  const [cEmail, setCEmail] = useState('');

  const [supplierModalOpen, setSupplierModalOpen] = useState(false);
  const [sName, setSName] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sEmail, setSEmail] = useState('');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadSnapshot = useCallback(async () => {
    if (!user || !sessionToken || !tiwiId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const snap = await fetchStoreAdminSnapshot(tiwiId, sessionToken);
      setProducts(snap.products);
      setCategories(snap.categories);
      setSales(snap.sales);
      setCustomers(snap.customers);
      setSuppliers(snap.suppliers);
      setFinance(snap.finance);
      setInventory(snap.inventory);
      setSubscription(snap.subscription);
      if (snap.settings) {
        setSettingsForm((prev) => ({
          ...prev,
          ...snap.settings,
          storeName: snap.settings.storeName || store.storeName,
        }));
      }
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Unable to load store admin data.');
    } finally {
      setLoading(false);
    }
  }, [sessionToken, store.storeName, tiwiId, user]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  const showToast = (msg: string, tone: 'success' | 'error' | 'info' = 'success') => {
    setBannerTone(tone);
    setBanner(msg);
  };

  const handleChangeAvailability = () => {
    Alert.alert(
      'Store Visibility',
      `Set availability for ${store.storeName}`,
      [
        {
          text: 'Online (Live)',
          onPress: () => void applyAvailability('active', 'Online'),
        },
        {
          text: 'Paused',
          onPress: () => void applyAvailability('paused', 'Paused'),
        },
        {
          text: 'Offline',
          style: 'destructive',
          onPress: () => void applyAvailability('offline', 'Offline'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const applyAvailability = async (
    next: 'active' | 'paused' | 'offline',
    label: string
  ) => {
    if (!sessionToken) {
      onRequireAuth();
      return;
    }
    try {
      await setStoreStatus(tiwiId, next, sessionToken);
      setStoreStatusLocal(next);
      emitRealtimeSync('all');
      showToast(`${store.storeName} is now ${label}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  const handleCreateProduct = async () => {
    if (!pName.trim()) {
      showToast('Enter product name.', 'error');
      return;
    }
    const sellingPrice = Number(pSellPrice);
    const stock = Number(pStock || 0);
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      showToast('Enter a valid selling price.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createStoreProduct(
        tiwiId,
        {
          name: pName.trim(),
          sku: pSku.trim() || undefined,
          category: pCategory.trim() || categories[0]?.name || 'General',
          sellingPrice,
          buyingPrice: Number(pBuyPrice || 0),
          stock: Number.isFinite(stock) ? stock : 0,
          minStock: Number(pMinStock || 5),
        },
        sessionToken
      );
      setProductModalOpen(false);
      setPName('');
      setPSku('');
      setPSellPrice('');
      setPBuyPrice('');
      setPStock('');
      showToast('Product created successfully.');
      await loadSnapshot();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not create product.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProduct = (prod: StoreProductRecord) => {
    Alert.alert('Delete Product', `Remove "${prod.name}" from store?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await deleteStoreProduct(tiwiId, prod.id, sessionToken);
              setProducts((prev) => prev.filter((p) => p.id !== prod.id));
              showToast('Product removed.');
            } catch (err) {
              showToast(err instanceof Error ? err.message : 'Delete failed.', 'error');
            }
          })();
        },
      },
    ]);
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    setSaving(true);
    try {
      await createStoreCategory(tiwiId, newCategoryName.trim(), '', sessionToken);
      setNewCategoryName('');
      showToast('Category added.');
      await loadSnapshot();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create category.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustStock = async () => {
    if (!adjustModalProduct) return;
    const delta = Number(adjustDelta);
    if (!Number.isFinite(delta) || delta === 0) {
      showToast('Enter non-zero stock quantity change.', 'error');
      return;
    }
    setSaving(true);
    try {
      await adjustStoreInventory(
        tiwiId,
        {
          productId: adjustModalProduct.id,
          quantityChange: delta,
          reason: adjustReason.trim() || 'Manual adjustment',
        },
        sessionToken
      );
      setAdjustModalProduct(null);
      setAdjustDelta('');
      showToast('Stock adjusted.');
      await loadSnapshot();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Stock adjustment failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCycleOrderStatus = (sale: StoreSaleRecord) => {
    Alert.alert(
      `Order ${sale.invoiceNumber || sale.id}`,
      'Update fulfillment status:',
      [
        ...ORDER_STATUSES.map((st) => ({
          text: st.charAt(0).toUpperCase() + st.slice(1),
          onPress: () => {
            void (async () => {
              try {
                await updateStoreOrderStatus(tiwiId, sale.id, st, sessionToken);
                setSales((prev) =>
                  prev.map((item) => (item.id === sale.id ? { ...item, status: st } : item))
                );
                showToast(`Order marked ${st}.`);
              } catch (err) {
                showToast(
                  err instanceof Error ? err.message : 'Failed to update order.',
                  'error'
                );
              }
            })();
          },
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const handleAddCustomer = async () => {
    if (!cName.trim()) return;
    setSaving(true);
    try {
      await createStoreCustomer(
        tiwiId,
        { name: cName.trim(), phone: cPhone.trim(), email: cEmail.trim() },
        sessionToken
      );
      setCustomerModalOpen(false);
      setCName('');
      setCPhone('');
      setCEmail('');
      showToast('Customer added.');
      await loadSnapshot();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add customer.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSupplier = async () => {
    if (!sName.trim()) return;
    setSaving(true);
    try {
      await createStoreSupplier(
        tiwiId,
        { name: sName.trim(), phone: sPhone.trim(), email: sEmail.trim() },
        sessionToken
      );
      setSupplierModalOpen(false);
      setSName('');
      setSPhone('');
      setSEmail('');
      showToast('Supplier saved.');
      await loadSnapshot();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add supplier.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      await saveStoreSettings(tiwiId, settingsForm, sessionToken);
      emitRealtimeSync('all');
      showToast('Store settings saved.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Settings save failed.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      [p.name, p.sku, p.category].some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [products, searchQuery]);

  const statusText = formatStoreStatusLabel(storeStatus);
  const live = isStoreLive(storeStatus);
  const currentMonthly = formatMonthlyRate({
    ...store,
    planId: subscription?.planId || store.planId,
    price: subscription?.price ?? store.price,
  });

  const tiwiQuery = tiwiId ? `?tiwiId=${encodeURIComponent(tiwiId)}` : '';

  return (
    <View style={styles.root}>
      {/* Borderless Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 6 }]}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.75}>
          <ArrowLeft size={21} strokeWidth={2} color={colors.foreground} />
        </TouchableOpacity>
        <View style={styles.flexOne}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {store.storeName || 'Store Admin'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.statusBadge, live && styles.statusBadgeLive]}
          onPress={handleChangeAvailability}
          activeOpacity={0.8}
        >
          {live ? <View style={styles.onlineDot} /> : null}
          <Text style={[styles.statusText, live && styles.statusTextLive]}>
            {statusText}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Primary Section Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabRow}
      >
        {(
          [
            { key: 'overview', label: 'Dashboard' },
            { key: 'catalog', label: 'Catalog' },
            { key: 'orders', label: 'Orders & CRM' },
            { key: 'flows', label: 'All Flows' },
            { key: 'settings', label: 'Settings' },
          ] as const
        ).map((item) => {
          const active = tab === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.tabPill, active && styles.tabPillActive]}
              onPress={() => setTab(item.key)}
              activeOpacity={0.82}
            >
              <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 28 }]}
      >
        {banner ? (
          <View style={[styles.toast, bannerTone === 'error' && styles.toastErr]}>
            <Text style={[styles.toastText, bannerTone === 'error' && styles.toastTextErr]}>
              {banner}
            </Text>
          </View>
        ) : null}

        {loading && products.length === 0 && sales.length === 0 ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color={colors.primaryHover} />
            <Text style={styles.mutedText}>Loading store admin...</Text>
          </View>
        ) : null}

        {/* 1. OVERVIEW / STORE DASHBOARD */}
        {tab === 'overview' && (
          <View style={styles.section}>
            <View style={styles.planBanner}>
              <View style={styles.flexOne}>
                <Text style={styles.eyebrow}>
                  {formatStorePlanLabel(subscription?.planId || store.planId, subscription?.planName)} ·{' '}
                  {currentMonthly}
                </Text>
                <Text style={styles.heroHeadline}>
                  {subscription?.usage?.products ?? products.length} Products ·{' '}
                  {sales.length} Orders
                </Text>
              </View>
              <TouchableOpacity
                style={styles.upgradePill}
                onPress={onOpenUpgrade}
                activeOpacity={0.85}
              >
                <Sparkles size={14} strokeWidth={2.1} color={colors.ink} />
                <Text style={styles.upgradePillText}>Upgrade</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.kpiGrid}>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiVal}>
                  ${Number(finance.totalRevenue || 0).toLocaleString()}
                </Text>
                <Text style={styles.kpiLbl}>Total Revenue</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiVal}>{sales.length}</Text>
                <Text style={styles.kpiLbl}>Orders</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={styles.kpiVal}>
                  {inventory.totalProducts ?? products.length}
                </Text>
                <Text style={styles.kpiLbl}>Products</Text>
              </View>
              <View style={styles.kpiCard}>
                <Text style={[styles.kpiVal, (inventory.lowStockCount || 0) > 0 && { color: colors.warning }]}>
                  {inventory.lowStockCount ?? 0}
                </Text>
                <Text style={styles.kpiLbl}>Low Stock</Text>
              </View>
            </View>

            {/* Quick Admin Jump Actions */}
            <Text style={styles.sectionLabel}>Quick E-Commerce Shortcuts</Text>
            <View style={styles.quickGrid}>
              <TouchableOpacity
                style={styles.quickTile}
                onPress={() => {
                  setTab('catalog');
                  setProductModalOpen(true);
                }}
              >
                <Plus size={18} strokeWidth={2.2} color={colors.primaryHover} />
                <Text style={styles.quickLabel}>Add Product</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickTile}
                onPress={() =>
                  onOpenInAppUrl('POS Terminal', `${TIWLO_ORIGIN}/pos${tiwiQuery}`, tiwiId)
                }
              >
                <CreditCard size={18} strokeWidth={2} color={colors.foreground} />
                <Text style={styles.quickLabel}>Open POS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickTile}
                onPress={() => {
                  setTab('orders');
                  setOrdersSub('sales');
                }}
              >
                <ShoppingBag size={18} strokeWidth={2} color={colors.foreground} />
                <Text style={styles.quickLabel}>Orders</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickTile}
                onPress={onOpenUpgrade}
              >
                <Sparkles size={18} strokeWidth={2} color={colors.primaryHover} />
                <Text style={styles.quickLabel}>Upgrade Plan</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 2. CATALOG: PRODUCTS / CATEGORIES / INVENTORY */}
        {tab === 'catalog' && (
          <View style={styles.section}>
            <View style={styles.subTabBar}>
              {(['products', 'categories', 'inventory'] as const).map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={[styles.subTabBtn, catalogSub === sub && styles.subTabBtnActive]}
                  onPress={() => setCatalogSub(sub)}
                >
                  <Text
                    style={[
                      styles.subTabText,
                      catalogSub === sub && styles.subTabTextActive,
                    ]}
                  >
                    {sub.charAt(0).toUpperCase() + sub.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {catalogSub === 'products' && (
              <>
                <View style={styles.searchActionRow}>
                  <View style={styles.searchBox}>
                    <Search size={15} strokeWidth={2} color={colors.muted} />
                    <TextInput
                      style={styles.searchInput}
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder="Search products or SKU..."
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => setProductModalOpen(true)}
                  >
                    <Plus size={16} strokeWidth={2.3} color={colors.ink} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {filteredProducts.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Package size={22} strokeWidth={1.8} color={colors.muted} />
                    <Text style={styles.emptyTitle}>No products yet</Text>
                    <Text style={styles.emptySub}>Tap Add to publish your first product.</Text>
                  </View>
                ) : (
                  filteredProducts.map((item) => (
                    <View key={item.id} style={styles.listCard}>
                      <View style={styles.flexOne}>
                        <Text style={styles.rowTitle}>{item.name}</Text>
                        <Text style={styles.rowSub}>
                          {item.category || 'Uncategorized'}
                          {item.sku ? ` · SKU ${item.sku}` : ''} · Stock {item.stock}
                        </Text>
                      </View>
                      <Text style={styles.priceText}>${item.sellingPrice}</Text>
                      <TouchableOpacity
                        style={styles.iconAction}
                        onPress={() => handleDeleteProduct(item)}
                      >
                        <Trash2 size={16} strokeWidth={1.9} color={colors.danger} />
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </>
            )}

            {catalogSub === 'categories' && (
              <>
                <View style={styles.searchActionRow}>
                  <TextInput
                    style={[styles.searchBox, styles.textBoxPad]}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    placeholder="New category name..."
                    placeholderTextColor="#9CA3AF"
                  />
                  <TouchableOpacity
                    style={styles.addBtn}
                    disabled={saving}
                    onPress={() => void handleAddCategory()}
                  >
                    <Plus size={16} strokeWidth={2.3} color={colors.ink} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                </View>

                {categories.map((cat) => (
                  <View key={cat.id} style={styles.listCard}>
                    <Tag size={16} strokeWidth={2} color={colors.primaryHover} />
                    <View style={styles.flexOne}>
                      <Text style={styles.rowTitle}>{cat.name}</Text>
                      <Text style={styles.rowSub}>
                        {cat.productCount ?? 0} linked products
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iconAction}
                      onPress={() => {
                        void deleteStoreCategory(tiwiId, cat.id, sessionToken).then(() =>
                          loadSnapshot()
                        );
                      }}
                    >
                      <Trash2 size={16} strokeWidth={1.9} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {catalogSub === 'inventory' && (
              <>
                <View style={styles.kpiGrid}>
                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiVal}>{inventory.totalStockUnits ?? 0}</Text>
                    <Text style={styles.kpiLbl}>Total Units</Text>
                  </View>
                  <View style={styles.kpiCard}>
                    <Text style={styles.kpiVal}>{inventory.outOfStockCount ?? 0}</Text>
                    <Text style={styles.kpiLbl}>Out of Stock</Text>
                  </View>
                </View>

                {products.map((prod) => (
                  <View key={prod.id} style={styles.listCard}>
                    <Boxes size={16} strokeWidth={2} color={colors.foreground} />
                    <View style={styles.flexOne}>
                      <Text style={styles.rowTitle}>{prod.name}</Text>
                      <Text style={styles.rowSub}>Current Stock: {prod.stock}</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.adjustPill}
                      onPress={() => {
                        setAdjustModalProduct(prod);
                        setAdjustDelta('');
                      }}
                    >
                      <Text style={styles.adjustPillText}>Adjust</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* 3. ORDERS, CUSTOMERS & SUPPLIERS */}
        {tab === 'orders' && (
          <View style={styles.section}>
            <View style={styles.subTabBar}>
              {(['sales', 'customers', 'suppliers'] as const).map((sub) => (
                <TouchableOpacity
                  key={sub}
                  style={[styles.subTabBtn, ordersSub === sub && styles.subTabBtnActive]}
                  onPress={() => setOrdersSub(sub)}
                >
                  <Text
                    style={[
                      styles.subTabText,
                      ordersSub === sub && styles.subTabTextActive,
                    ]}
                  >
                    {sub === 'sales' ? 'Orders' : sub.charAt(0).toUpperCase() + sub.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {ordersSub === 'sales' &&
              (sales.length === 0 ? (
                <View style={styles.emptyCard}>
                  <ShoppingBag size={22} strokeWidth={1.8} color={colors.muted} />
                  <Text style={styles.emptyTitle}>No sales or orders yet</Text>
                </View>
              ) : (
                sales.map((sale) => (
                  <TouchableOpacity
                    key={sale.id}
                    style={styles.listCard}
                    onPress={() => handleCycleOrderStatus(sale)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.flexOne}>
                      <Text style={styles.rowTitle}>
                        {sale.invoiceNumber || sale.id} · {sale.customerName || 'Walk-in'}
                      </Text>
                      <Text style={styles.rowSub}>
                        Total ${sale.totalAmount ?? 0} · Due ${sale.dueAmount ?? 0}
                      </Text>
                    </View>
                    <View style={styles.pillNeutral}>
                      <Text style={styles.pillNeutralText}>
                        {sale.status || 'pending'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))
              ))}

            {ordersSub === 'customers' && (
              <>
                <TouchableOpacity
                  style={styles.addFullBtn}
                  onPress={() => setCustomerModalOpen(true)}
                >
                  <Plus size={16} strokeWidth={2.2} color={colors.ink} />
                  <Text style={styles.addBtnText}>Add Customer</Text>
                </TouchableOpacity>
                {customers.map((c) => (
                  <View key={c.id} style={styles.listCard}>
                    <View style={styles.flexOne}>
                      <Text style={styles.rowTitle}>{c.name}</Text>
                      <Text style={styles.rowSub}>{c.phone || c.email || 'No contact'}</Text>
                    </View>
                    {typeof c.totalDue === 'number' && c.totalDue > 0 ? (
                      <Text style={[styles.priceText, { color: colors.danger }]}>
                        Due ${c.totalDue}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </>
            )}

            {ordersSub === 'suppliers' && (
              <>
                <TouchableOpacity
                  style={styles.addFullBtn}
                  onPress={() => setSupplierModalOpen(true)}
                >
                  <Plus size={16} strokeWidth={2.2} color={colors.ink} />
                  <Text style={styles.addBtnText}>Add Supplier</Text>
                </TouchableOpacity>
                {suppliers.map((s) => (
                  <View key={s.id} style={styles.listCard}>
                    <View style={styles.flexOne}>
                      <Text style={styles.rowTitle}>{s.name}</Text>
                      <Text style={styles.rowSub}>{s.phone || s.email || 'No contact'}</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {/* 4. ALL E-COMMERCE FLOWS (Silent Mobile-View Launchers inside App) */}
        {tab === 'flows' && (
          <View style={styles.section}>
            {WEB_FLOW_GROUPS.map((grp) => (
              <View key={grp.group} style={styles.flowGroup}>
                <Text style={styles.sectionLabel}>{grp.group}</Text>
                {grp.items.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <TouchableOpacity
                      key={mod.id}
                      style={styles.flowRow}
                      onPress={() =>
                        onOpenInAppUrl(
                          mod.title,
                          `${TIWLO_ORIGIN}${mod.path}${tiwiQuery}`,
                          tiwiId
                        )
                      }
                      activeOpacity={0.82}
                    >
                      <View style={styles.flowIcon}>
                        <Icon size={17} strokeWidth={1.9} color={colors.foreground} />
                      </View>
                      <View style={styles.flexOne}>
                        <Text style={styles.rowTitle}>{mod.title}</Text>
                        <Text style={styles.rowSub}>{mod.desc}</Text>
                      </View>
                      <ArrowUpRight size={16} strokeWidth={2} color={colors.muted} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}

        {/* 5. STORE SETTINGS + STATUS + UPGRADE */}
        {tab === 'settings' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.planBanner} onPress={onOpenUpgrade}>
              <View style={styles.flexOne}>
                <Text style={styles.eyebrow}>Active Monthly Plan</Text>
                <Text style={styles.heroHeadline}>
                  {formatStorePlanLabel(subscription?.planId || store.planId, subscription?.planName)} ·{' '}
                  {currentMonthly}
                </Text>
              </View>
              <View style={styles.upgradePill}>
                <Text style={styles.upgradePillText}>Manage</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Store Name</Text>
              <TextInput
                style={styles.formInput}
                value={settingsForm.storeName || ''}
                onChangeText={(v) => setSettingsForm((p) => ({ ...p, storeName: v }))}
                placeholder="Store Name"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Business Phone</Text>
              <TextInput
                style={styles.formInput}
                value={settingsForm.phone || ''}
                onChangeText={(v) => setSettingsForm((p) => ({ ...p, phone: v }))}
                placeholder="+880..."
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Business Email</Text>
              <TextInput
                style={styles.formInput}
                value={settingsForm.email || ''}
                onChangeText={(v) => setSettingsForm((p) => ({ ...p, email: v }))}
                placeholder="store@tiwlo.com"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Address</Text>
              <TextInput
                style={styles.formInput}
                value={settingsForm.address || ''}
                onChangeText={(v) => setSettingsForm((p) => ({ ...p, address: v }))}
                placeholder="Street, City"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Currency Code (USD, BDT, EUR, GBP)</Text>
              <TextInput
                style={styles.formInput}
                value={settingsForm.currency || 'USD'}
                onChangeText={(v) => setSettingsForm((p) => ({ ...p, currency: v.toUpperCase() }))}
                autoCapitalize="characters"
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, saving && { opacity: 0.6 }]}
              disabled={saving}
              onPress={() => void handleSaveSettings()}
            >
              <Save size={16} strokeWidth={2.2} color={colors.ink} />
              <Text style={styles.saveBtnText}>
                {saving ? 'Saving...' : 'Save Store Settings'}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* ADD PRODUCT MODAL */}
      <Modal visible={productModalOpen} transparent animationType="slide" onRequestClose={() => setProductModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Product</Text>
              <TouchableOpacity onPress={() => setProductModalOpen(false)}>
                <X size={20} strokeWidth={2} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.formInput} value={pName} onChangeText={setPName} placeholder="Product Name *" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={pSku} onChangeText={setPSku} placeholder="SKU (optional)" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={pCategory} onChangeText={setPCategory} placeholder="Category" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={pSellPrice} onChangeText={setPSellPrice} placeholder="Selling Price *" keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={pBuyPrice} onChangeText={setPBuyPrice} placeholder="Buying Cost" keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={pStock} onChangeText={setPStock} placeholder="Initial Stock Qty" keyboardType="numeric" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={styles.saveBtn} disabled={saving} onPress={() => void handleCreateProduct()}>
              <Text style={styles.saveBtnText}>{saving ? 'Creating...' : 'Create Product'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* INVENTORY ADJUST MODAL */}
      <Modal visible={Boolean(adjustModalProduct)} transparent animationType="fade" onRequestClose={() => setAdjustModalProduct(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adjust Stock: {adjustModalProduct?.name}</Text>
              <TouchableOpacity onPress={() => setAdjustModalProduct(null)}>
                <X size={20} strokeWidth={2} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.formInput} value={adjustDelta} onChangeText={setAdjustDelta} placeholder="Quantity change (e.g. 10 or -3)" keyboardType="numbers-and-punctuation" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={adjustReason} onChangeText={setAdjustReason} placeholder="Reason" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={styles.saveBtn} disabled={saving} onPress={() => void handleAdjustStock()}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Apply Adjustment'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADD CUSTOMER MODAL */}
      <Modal visible={customerModalOpen} transparent animationType="slide" onRequestClose={() => setCustomerModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Customer</Text>
              <TouchableOpacity onPress={() => setCustomerModalOpen(false)}>
                <X size={20} strokeWidth={2} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.formInput} value={cName} onChangeText={setCName} placeholder="Customer Name *" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={cPhone} onChangeText={setCPhone} placeholder="Phone" keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={cEmail} onChangeText={setCEmail} placeholder="Email" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={styles.saveBtn} disabled={saving} onPress={() => void handleAddCustomer()}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Customer'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ADD SUPPLIER MODAL */}
      <Modal visible={supplierModalOpen} transparent animationType="slide" onRequestClose={() => setSupplierModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Supplier</Text>
              <TouchableOpacity onPress={() => setSupplierModalOpen(false)}>
                <X size={20} strokeWidth={2} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <TextInput style={styles.formInput} value={sName} onChangeText={setSName} placeholder="Supplier Name *" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={sPhone} onChangeText={setSPhone} placeholder="Phone" keyboardType="phone-pad" placeholderTextColor="#9CA3AF" />
            <TextInput style={styles.formInput} value={sEmail} onChangeText={setSEmail} placeholder="Email" autoCapitalize="none" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={styles.saveBtn} disabled={saving} onPress={() => void handleAddSupplier()}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Supplier'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flexOne: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
    backgroundColor: colors.background,
    gap: 10,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.3,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusBadgeLive: {
    backgroundColor: colors.primarySoft,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.primaryHover,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  statusTextLive: {
    color: colors.primaryHover,
  },
  tabScroll: {
    flexGrow: 0,
    backgroundColor: colors.background,
  },
  tabRow: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 8,
  },
  tabPill: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabPillActive: {
    backgroundColor: colors.primary,
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  tabPillTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 8, gap: 16 },
  toast: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toastErr: {
    backgroundColor: colors.dangerSoft,
  },
  toastText: { fontSize: 13, fontWeight: '600', color: colors.primaryHover },
  toastTextErr: { color: colors.danger },
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  mutedText: { fontSize: 13, color: colors.muted },
  section: { gap: 12 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: colors.muted,
  },
  planBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 14,
  },
  eyebrow: { fontSize: 12, fontWeight: '600', color: colors.muted },
  heroHeadline: {
    fontSize: 15.5,
    fontWeight: '700',
    color: colors.foreground,
    marginTop: 2,
  },
  upgradePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  upgradePillText: { fontSize: 12.5, fontWeight: '700', color: colors.ink },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  kpiCard: {
    width: '48.6%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 13,
    gap: 3,
  },
  kpiVal: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  kpiLbl: { fontSize: 12, color: colors.muted },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickTile: {
    width: '48.6%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  quickLabel: { fontSize: 13.5, fontWeight: '600', color: colors.foreground },
  subTabBar: { flexDirection: 'row', gap: 8 },
  subTabBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabBtnActive: { backgroundColor: colors.primarySoft },
  subTabText: { fontSize: 13, fontWeight: '600', color: colors.muted },
  subTabTextActive: { color: colors.primaryHover, fontWeight: '700' },
  searchActionRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBox: {
    flex: 1,
    height: 42,
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  textBoxPad: { paddingHorizontal: 12, fontSize: 14, color: colors.foreground },
  searchInput: { flex: 1, fontSize: 14, color: colors.foreground },
  addBtn: {
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  addFullBtn: {
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addBtnText: { fontSize: 13.5, fontWeight: '700', color: colors.ink },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 14.5, fontWeight: '700', color: colors.foreground },
  emptySub: { fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  rowTitle: { fontSize: 14, fontWeight: '600', color: colors.foreground },
  rowSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  priceText: { fontSize: 14, fontWeight: '700', color: colors.foreground },
  iconAction: { padding: 6 },
  adjustPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  adjustPillText: { fontSize: 12, fontWeight: '700', color: colors.primaryHover },
  pillNeutral: {
    backgroundColor: colors.background,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillNeutralText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: colors.foreground,
    textTransform: 'capitalize',
  },
  flowGroup: { gap: 8, marginBottom: 4 },
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 12,
  },
  flowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldGroup: { gap: 5 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: colors.muted },
  formInput: {
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 13,
    fontSize: 14,
    color: colors.foreground,
  },
  saveBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 4,
  },
  saveBtnText: { fontSize: 14, fontWeight: '700', color: colors.ink },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(17,24,39,0.35)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    gap: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modalTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
});
