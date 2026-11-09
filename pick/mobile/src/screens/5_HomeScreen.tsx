import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
} from 'react-native';
import { PickIcon } from '../components/common/PickIcon';
import { BottomNav } from '../components/common/BottomNav';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { AnimatedEmptyState } from '../components/common/AnimatedEmptyState';
import type { BazarCategory, BazarProduct } from '../data/mockData';
import type { CartEntry } from '../services/orders';
import { useLanguage } from '../context/LanguageContext';

interface HomeScreenProps {
  deliveryAddress: string;
  categories: BazarCategory[];
  products: BazarProduct[];
  catalogLoading: boolean;
  cart: CartEntry[];
  onCartChange: (item: CartEntry) => void;
  onSelectCategory: (categoryId: string) => void;
  onOpenRestaurant: (productId: string) => void;
  onOpenNotifications?: () => void;
  onOpenProfile?: () => void;
  onOpenCheckout?: () => void;
  onTabPress?: (tab: string) => void;
  onContactSupport: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  deliveryAddress,
  categories,
  products,
  catalogLoading,
  cart,
  onCartChange,
  onSelectCategory,
  onOpenRestaurant,
  onOpenProfile,
  onOpenCheckout,
  onTabPress,
  onContactSupport,
}) => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected unit index per product: { [productId]: unitIndex } (e.g. 0 = 500g, 1 = 1kg)
  const [selectedUnitIndexes, setSelectedUnitIndexes] = useState<{
    [id: string]: number;
  }>({});

  const setProductUnit = (productId: string, unitIndex: number) => {
    setSelectedUnitIndexes((prev) => ({ ...prev, [productId]: unitIndex }));
    const item = cart.find((entry) => entry.productId === productId);
    if (item) onCartChange({ ...item, unitIndex });
  };

  const getDefaultUnitIndex = (prod: BazarProduct) => {
    const units = isEn ? prod.unitsEn : prod.units;
    const unit = isEn ? prod.unitEn : prod.unit;
    const index = units.indexOf(unit);
    return index >= 0 ? index : 0;
  };

  const getProductCalculatedPrice = (prod: BazarProduct) => {
    const idx = selectedUnitIndexes[prod.id] ?? getDefaultUnitIndex(prod);
    return prod.unitPrices?.[idx] ?? prod.price;
  };

  const updateCart = (id: string, delta: number) => {
    const product = products.find((item) => item.id === id);
    if (!product) return;
    const unitIndex = selectedUnitIndexes[id] ?? getDefaultUnitIndex(product);
    const currentQuantity = cart.find((item) => item.productId === id)?.quantity ?? 0;
    onCartChange({
      productId: id,
      unitIndex,
      quantity: Math.max(0, currentQuantity + delta)
    });
  };

  const totalCartCount = cart.reduce((total, item) => total + item.quantity, 0);

  const selectedCat = categories[activeCategoryIndex] ?? categories[0];
  const visibleProducts = products.filter((product) => {
    const matchesCategory = !selectedCat || selectedCat.id === 'all' ||
      product.categoryId === selectedCat.id;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      isEn
        ? product.nameEn.toLowerCase().includes(query) || product.categoryEn.toLowerCase().includes(query)
        : product.name.toLowerCase().includes(query) || product.category.toLowerCase().includes(query)
    );
    return matchesCategory && matchesSearch;
  });

  const renderProductItem = (prod: BazarProduct, isLast: boolean) => {
    const cartItem = cart.find((item) => item.productId === prod.id);
    const qty = cartItem?.quantity ?? 0;
    const currentUnitIdx = selectedUnitIndexes[prod.id] ?? cartItem?.unitIndex ?? getDefaultUnitIndex(prod);
    const availableUnits = isEn ? prod.unitsEn : prod.units;
    const currentUnitLabel = availableUnits[currentUnitIdx] ?? (isEn ? prod.unitEn : prod.unit);
    const calculatedPrice = getProductCalculatedPrice(prod);

    const title = isEn ? prod.nameEn : prod.name;
    const description = isEn ? prod.descriptionEn : prod.description;

    return (
      <View
        key={prod.id}
        style={[styles.uberFoodRow, !isLast && styles.hairlineDivider]}
      >
        {/* Left Column: Info & Unit/Gram/Kg Selector */}
        <View style={styles.uberFoodInfo}>
          <TouchableOpacity
            onPress={() => onOpenRestaurant(prod.id)}
            activeOpacity={0.75}
          >
            <Text style={styles.uberFoodTitle} numberOfLines={2}>
              {title}
            </Text>

            {/* Price with strikethrough & Practical Stock/ETA info */}
            <View style={styles.priceMetaRow}>
              <Text style={styles.uberFoodPrice}>৳{calculatedPrice}</Text>
              <Text style={styles.uberFoodUnit}>• {currentUnitLabel}</Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.ratingText}>★ {prod.rating}</Text>
              <Text style={styles.dotSeparator}>•</Text>
              <Text style={styles.deliveryTimeText}>{prod.deliveryTime}</Text>
            </View>

            <Text style={styles.uberFoodDesc} numberOfLines={2}>
              {description}
            </Text>
          </TouchableOpacity>

          {/* Gram / Kg Unit Selector Chips */}
          <View style={styles.unitSelectorContainer}>
            <Text style={styles.unitSelectorLabel}>
              {t('home.selectWeight')}
            </Text>
            <View style={styles.unitChipsWrap}>
              {availableUnits.map((u, idx) => {
                const isSelected = currentUnitIdx === idx;
                return (
                  <TouchableOpacity
                    key={u}
                    style={[
                      styles.unitChip,
                      isSelected && styles.unitChipSelected,
                    ]}
                    onPress={() => setProductUnit(prod.id, idx)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.unitChipText,
                        isSelected && styles.unitChipTextSelected,
                      ]}
                    >
                      {u}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Right Column: 105x105 Image with Circular Add (+) or Stepper */}
        <View style={styles.uberFoodMediaWrap}>
          <TouchableOpacity
            onPress={() => onOpenRestaurant(prod.id)}
            activeOpacity={0.85}
          >
            <Image source={{ uri: prod.image }} style={styles.uberFoodImage} />
          </TouchableOpacity>

          {qty === 0 ? (
            <TouchableOpacity
              style={styles.uberAddCircle}
              onPress={() => updateCart(prod.id, 1)}
              disabled={!prod.inStock}
              activeOpacity={0.8}
            >
              <PickIcon name="plus" size={16} color="#09090B" />
            </TouchableOpacity>
          ) : (
            <View style={styles.uberStepperPill}>
              <TouchableOpacity
                style={styles.uberStepBtn}
                onPress={() => updateCart(prod.id, -1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <PickIcon name="minus" size={12} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.uberStepQty}>{qty}</Text>
              <TouchableOpacity
                style={styles.uberStepBtn}
                onPress={() => updateCart(prod.id, 1)}
                disabled={!prod.inStock}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <PickIcon name="plus" size={12} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      {/* Header Bar */}
      <View style={styles.header}>
        <View style={styles.locationWrap}>
          <Text style={styles.deliverToLabel}>
            {t('home.deliveringTo')}
          </Text>
          <View style={styles.addressRow}>
            <Text style={styles.locationTitle} numberOfLines={1}>
              {deliveryAddress || t('Set delivery location', 'ডেলিভারি লোকেশন দিন')}
            </Text>
            <PickIcon name="chevron-right" size={12} color="#09090B" />
          </View>
        </View>

        {/* Right action icons: Cart (with badge) & Profile */}
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onOpenCheckout}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <PickIcon name="cart" size={22} color="#09090B" />
            {totalCartCount > 0 && (
              <View style={styles.cartBadge}>
                <Text style={styles.cartBadgeText}>{totalCartCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={onOpenProfile}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <PickIcon name="profile" size={21} color="#09090B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Clean Flat Search Input */}
      <View style={styles.searchContainer}>
        <PickIcon name="search" size={18} color="#71717A" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('home.searchPlaceholder')}
          placeholderTextColor="#A1A1AA"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <PickIcon name="close" size={15} color="#71717A" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Tabs */}
      <View style={styles.categoriesBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((cat, index) => {
            const isActive = activeCategoryIndex === index;
            const label = isEn ? cat.titleEn : cat.titleBn;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryTab,
                  isActive && styles.categoryTabActive,
                ]}
                onPress={() => setActiveCategoryIndex(index)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.categoryTabText,
                    isActive && styles.categoryTabTextActive,
                  ]}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Uber Eats Style Content with Multiple Practical Sections */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: SYSTEM_INSETS.bottomNavPadding + 20 },
        ]}
      >
        {!catalogLoading && products.length === 0 ? (
          <AnimatedEmptyState
            animation="catalog"
            title={t('No products yet', 'এখনো কোনো পণ্য নেই')}
            description={t(
              'Our team is getting the catalog ready for your area. Contact us if you need help.',
              'আপনার এলাকার জন্য পণ্যের তালিকা প্রস্তুত করা হচ্ছে। সহায়তার জন্য আমাদের সঙ্গে যোগাযোগ করুন।'
            )}
            actionLabel={t('Contact support', 'সাপোর্টে যোগাযোগ করুন')}
            onAction={onContactSupport}
          />
        ) : selectedCat?.id === 'all' && !searchQuery.trim() ? (
          <>
            {categories.slice(1).map((category) => {
              const categoryProducts = products.filter((product) => product.categoryId === category.id);
              if (!categoryProducts.length) return null;
              return (
                <View key={category.id} style={styles.sectionBlock}>
                  <View style={styles.sectionHeaderWrap}>
                    <Text style={styles.sectionHeading}>
                      {isEn ? category.titleEn : category.titleBn}
                    </Text>
                  </View>
                  {categoryProducts.map((product, index) =>
                    renderProductItem(product, index === categoryProducts.length - 1)
                  )}
                </View>
              );
            })}
            {products.some((product) =>
              !product.categoryId || !categories.some((category) => category.id === product.categoryId)
            ) && (
              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderWrap}>
                  <Text style={styles.sectionHeading}>
                    {t('Other products', 'অন্যান্য পণ্য')}
                  </Text>
                </View>
                {products
                  .filter((product) =>
                    !product.categoryId || !categories.some((category) => category.id === product.categoryId)
                  )
                  .map((product, index, list) =>
                    renderProductItem(product, index === list.length - 1)
                  )}
              </View>
            )}
          </>
        ) : (
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderWrap}>
              <Text style={styles.sectionHeading}>
                {selectedCat ? (isEn ? selectedCat.titleEn : selectedCat.titleBn) : ''}
                {' '}({visibleProducts.length} {t('common.items')})
              </Text>
            </View>
            {visibleProducts.map((product, index) =>
              renderProductItem(product, index === visibleProducts.length - 1)
            )}
          </View>
        )}
        {!catalogLoading && products.length > 0 && visibleProducts.length === 0 && (
          <Text style={styles.noResults}>
            {t('No matching products found', 'কোনো মিল থাকা পণ্য পাওয়া যায়নি')}
          </Text>
        )}
      </ScrollView>

      {/* Clean Bottom Navigation Bar */}
      <BottomNav
        activeTab="home"
        onTabPress={(tab) => {
          if (tab !== 'home') {
            onTabPress?.(tab);
          }
        }}
        onCenterPress={() => onSelectCategory('parcel')}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  locationWrap: {
    flex: 1,
    paddingRight: 10,
  },
  deliverToLabel: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconBtn: {
    position: 'relative',
    padding: 4,
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: '#09090B',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  cartBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#09090B',
  },
  categoriesBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  categoryScroll: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 18,
  },
  categoryTab: {
    paddingVertical: 4,
  },
  categoryTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#09090B',
  },
  categoryTabText: {
    fontSize: 14,
    color: '#71717A',
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#09090B',
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionHeaderWrap: {
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: -0.2,
  },
  sectionBlock: {
    marginBottom: 12,
  },
  noResults: {
    color: '#71717A',
    fontSize: 14,
    paddingVertical: 40,
    textAlign: 'center',
  },
  uberFoodRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  hairlineDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  uberFoodInfo: {
    flex: 1,
    paddingRight: 14,
  },
  uberFoodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#09090B',
    lineHeight: 21,
    marginBottom: 4,
  },
  priceMetaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  uberFoodPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
  },
  uberFoodOldPrice: {
    fontSize: 12,
    color: '#A1A1AA',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  uberFoodUnit: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
    marginLeft: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#09090B',
  },
  dotSeparator: {
    marginHorizontal: 6,
    color: '#A1A1AA',
    fontSize: 12,
  },
  deliveryTimeText: {
    fontSize: 12,
    color: '#71717A',
  },
  uberFoodDesc: {
    fontSize: 13,
    color: '#71717A',
    lineHeight: 18,
    marginBottom: 8,
  },
  unitSelectorContainer: {
    marginTop: 2,
  },
  unitSelectorLabel: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '500',
    marginBottom: 4,
  },
  unitChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unitChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    backgroundColor: '#F4F4F5',
    borderWidth: 1,
    borderColor: '#E4E4E7',
  },
  unitChipSelected: {
    backgroundColor: '#09090B',
    borderColor: '#09090B',
  },
  unitChipText: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '600',
  },
  unitChipTextSelected: {
    color: '#FFFFFF',
  },
  uberFoodMediaWrap: {
    position: 'relative',
    width: 105,
    height: 105,
    marginTop: 2,
  },
  uberFoodImage: {
    width: 105,
    height: 105,
    borderRadius: 8,
    backgroundColor: '#F4F4F5',
  },
  uberAddCircle: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
  },
  uberStepperPill: {
    position: 'absolute',
    bottom: -6,
    right: -6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090B',
    borderRadius: 16,
    height: 32,
    paddingHorizontal: 6,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  uberStepBtn: {
    padding: 4,
  },
  uberStepQty: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    minWidth: 16,
    textAlign: 'center',
  },
});
