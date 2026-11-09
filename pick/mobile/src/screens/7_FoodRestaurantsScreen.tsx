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
import { Header } from '../components/common/Header';
import { PickIcon } from '../components/common/PickIcon';
import type { BazarCategory, BazarProduct } from '../data/mockData';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import type { CartEntry } from '../services/orders';

export type Restaurant = BazarProduct;

interface FoodRestaurantsScreenProps {
  onBack: () => void;
  categories: BazarCategory[];
  products: BazarProduct[];
  selectedCategoryId: string;
  cart: CartEntry[];
  onCartChange: (item: CartEntry) => void;
  onSelectRestaurant: (product: BazarProduct) => void;
}

export const FoodRestaurantsScreen: React.FC<FoodRestaurantsScreenProps> = ({
  onBack,
  categories,
  products,
  selectedCategoryId,
  cart,
  onCartChange,
  onSelectRestaurant,
}) => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  const [activeCategoryId, setActiveCategoryId] = useState(selectedCategoryId);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCat = categories.find((category) => category.id === activeCategoryId) ?? categories[0];

  const filteredProducts = products.filter((item) => {
    const matchesSearch = isEn
      ? item.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.categoryEn.toLowerCase().includes(searchQuery.toLowerCase())
      : item.name.includes(searchQuery) || item.category.includes(searchQuery);

    if (!matchesSearch) return false;
    return !selectedCat || selectedCat.id === 'all' || item.categoryId === selectedCat.id;
  });

  const handleUpdateQty = (productId: string, delta: number) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;
    const units = isEn ? product.unitsEn : product.units;
    const defaultUnit = isEn ? product.unitEn : product.unit;
    const matchingUnitIndex = units.indexOf(defaultUnit);
    const unitIndex = Math.max(matchingUnitIndex, 0);
    const currentQuantity = cart.find((item) => item.productId === productId)?.quantity ?? 0;
    onCartChange({
      productId,
      unitIndex,
      quantity: Math.max(0, currentQuantity + delta)
    });
  };

  const totalCartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Daily Fresh Bazar', 'কাঁচাবাজারের পণ্য')} onBack={onBack} />

      {/* Flat Search */}
      <View style={styles.searchContainer}>
        <PickIcon name="search" size={17} color="#71717A" />
        <TextInput
          style={styles.searchInput}
          placeholder={t('Search groceries...', 'পণ্য খুঁজুন...')}
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

      {/* Categories Bar */}
      <View style={styles.categoriesBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {categories.map((cat) => {
            const isActive = activeCategoryId === cat.id;
            const label = isEn ? cat.titleEn : cat.titleBn;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryTab,
                  isActive && styles.categoryTabActive,
                ]}
                onPress={() => setActiveCategoryId(cat.id)}
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

      {/* Uber Eats Style Product List */}
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          {
            paddingBottom:
              SYSTEM_INSETS.bottom + (totalCartCount > 0 ? 84 : 20),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {filteredProducts.map((item, index) => {
        const qty = cart.find((cartItem) => cartItem.productId === item.id)?.quantity ?? 0;
          const isLast = index === filteredProducts.length - 1;
          const title = isEn ? item.nameEn : item.name;
          const unit = isEn ? item.unitEn : item.unit;
          const description = isEn ? item.descriptionEn : item.description;

          return (
            <View
              key={item.id}
              style={[styles.uberFoodRow, !isLast && styles.hairlineDivider]}
            >
              {/* Left Column: Title, Price, Description */}
              <TouchableOpacity
                style={styles.uberFoodInfo}
                onPress={() => onSelectRestaurant(item)}
                activeOpacity={0.75}
              >
                <Text style={styles.uberFoodTitle} numberOfLines={2}>
                  {title}
                </Text>
                <Text style={styles.uberFoodPrice}>
                  ৳{item.unitPrices?.[Math.max(item.unitsEn.indexOf(item.unitEn), 0)] ?? item.price}{' '}
                  <Text style={styles.uberFoodUnit}>• {unit}</Text>
                </Text>
                <Text style={styles.uberFoodDesc} numberOfLines={2}>
                  {description}
                </Text>
              </TouchableOpacity>

              {/* Right Column: 105x105 Photo with Uber Add (+) button */}
              <View style={styles.uberFoodMediaWrap}>
                <TouchableOpacity
                  onPress={() => onSelectRestaurant(item)}
                  activeOpacity={0.85}
                >
                  <Image
                    source={{ uri: item.image }}
                    style={styles.uberFoodImage}
                  />
                </TouchableOpacity>

                {qty === 0 ? (
                  <TouchableOpacity
                    style={styles.uberAddCircle}
                    onPress={() => handleUpdateQty(item.id, 1)}
                    disabled={!item.inStock}
                    activeOpacity={0.8}
                  >
                    <PickIcon name="plus" size={16} color="#09090B" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.uberStepperPill}>
                    <TouchableOpacity
                      style={styles.uberStepBtn}
                      onPress={() => handleUpdateQty(item.id, -1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <PickIcon name="minus" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.uberStepQty}>{qty}</Text>
                    <TouchableOpacity
                      style={styles.uberStepBtn}
                      onPress={() => handleUpdateQty(item.id, 1)}
                      disabled={!item.inStock}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <PickIcon name="plus" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    marginHorizontal: 20,
    marginTop: 8,
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
  },
  uberFoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  hairlineDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  uberFoodInfo: {
    flex: 1,
    paddingRight: 14,
    justifyContent: 'center',
  },
  uberFoodTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#09090B',
    lineHeight: 21,
    marginBottom: 4,
  },
  uberFoodPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
    marginBottom: 6,
  },
  uberFoodUnit: {
    fontSize: 13,
    fontWeight: '400',
    color: '#71717A',
  },
  uberFoodDesc: {
    fontSize: 13,
    color: '#71717A',
    lineHeight: 18,
  },
  uberFoodMediaWrap: {
    position: 'relative',
    width: 105,
    height: 105,
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
