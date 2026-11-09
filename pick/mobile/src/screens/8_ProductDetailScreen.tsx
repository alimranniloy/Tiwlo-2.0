import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { PickIcon } from '../components/common/PickIcon';
import type { BazarProduct } from '../data/mockData';
import type { CartEntry } from '../services/orders';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProductDetailScreenProps {
  onBack: () => void;
  onAddToCart: (item: CartEntry) => void;
  product?: BazarProduct;
}

export const ProductDetailScreen: React.FC<ProductDetailScreenProps> = ({
  onBack,
  onAddToCart,
  product,
}) => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  const defaultUnitIndex = product
    ? Math.max((isEn ? product.unitsEn : product.units).indexOf(isEn ? product.unitEn : product.unit), 0)
    : 0;
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(defaultUnitIndex);
  const [quantity, setQuantity] = useState(1);

  if (!product) {
    return (
      <ScreenContainer applyTopInset applyBottomInset={false}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <PickIcon name="back" size={20} color="#09090B" />
        </TouchableOpacity>
        <Text style={styles.productName}>
          {t('This product is no longer available', 'এই পণ্যটি এখন পাওয়া যাচ্ছে না')}
        </Text>
      </ScreenContainer>
    );
  }

  const currentUnit = isEn
    ? product.unitsEn[selectedUnitIndex] ?? product.unitEn
    : product.units[selectedUnitIndex] ?? product.unit;

  const unitPrice = product.unitPrices?.[selectedUnitIndex] ?? product.price;
  const grandTotal = unitPrice * quantity;

  const handleDecrement = () => {
    if (quantity > 1) setQuantity(quantity - 1);
  };

  const handleIncrement = () => {
    setQuantity(quantity + 1);
  };

  const handleAddPress = () => {
    onAddToCart({
      productId: product.id,
      unitIndex: selectedUnitIndex,
      quantity,
    });
  };

  const availableUnits = isEn ? product.unitsEn : product.units;

  return (
    <ScreenContainer applyTopInset={false} applyBottomInset={false}>
      {/* Top Bar with back button */}
      <View style={[styles.topBar, { top: SYSTEM_INSETS.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <PickIcon name="back" size={20} color="#09090B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: SYSTEM_INSETS.bottom + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Product Image */}
        <Image source={{ uri: product.image }} style={styles.productImage} />

        {/* Product Info directly on background */}
        <View style={styles.infoSection}>
          <Text style={styles.productName}>
            {isEn ? product.nameEn : product.name}
          </Text>
          <Text style={styles.productPrice}>
            ৳{unitPrice} <Text style={styles.productUnit}>/ {currentUnit}</Text>
          </Text>
          <Text style={styles.description}>
            {isEn ? product.descriptionEn : product.description}
          </Text>
        </View>

        {/* Weight Selection - Flat on background */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('Select Quantity', 'পরিমাণ নির্বাচন করুন')}
          </Text>
        </View>

        <View style={styles.unitsSection}>
          {availableUnits.map((unit, idx) => {
            const isSelected = selectedUnitIndex === idx;
            const calcPrice = product.unitPrices?.[idx] ?? product.price;
            const isLast = idx === availableUnits.length - 1;

            return (
              <React.Fragment key={unit}>
                <TouchableOpacity
                  style={styles.unitRow}
                  onPress={() => setSelectedUnitIndex(idx)}
                  activeOpacity={0.7}
                >
                  <View style={styles.radioOuter}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                  <Text style={styles.unitName}>{unit}</Text>
                  <Text style={styles.unitPrice}>৳{calcPrice}</Text>
                </TouchableOpacity>
                {!isLast && <View style={styles.hairlineDivider} />}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Fixed Action Bar with Stepper and Primary Button */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: SYSTEM_INSETS.bottom + 14 },
        ]}
      >
        <View style={styles.stepperWrap}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={handleDecrement}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <PickIcon name="minus" size={14} color="#09090B" />
          </TouchableOpacity>
          <Text style={styles.stepCount}>{quantity}</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={handleIncrement}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <PickIcon name="plus" size={14} color="#09090B" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={handleAddPress}
          disabled={!product.inStock}
          activeOpacity={product.inStock ? 0.85 : 1}
        >
          <Text style={styles.primaryButtonText}>
            {t('Add to Bag', 'ব্যাগে যোগ করুন')} • ৳{grandTotal}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    left: 20,
    zIndex: 10,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  productImage: {
    width: SCREEN_WIDTH,
    height: 280,
    backgroundColor: '#F4F4F5',
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#09090B',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#09090B',
    marginBottom: 12,
  },
  productUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: '#71717A',
  },
  description: {
    fontSize: 14,
    color: '#71717A',
    lineHeight: 20,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 8,
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#09090B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unitsSection: {
    paddingHorizontal: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    backgroundColor: '#FFFFFF',
  },
  unitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#09090B',
  },
  unitName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#09090B',
  },
  unitPrice: {
    fontSize: 15,
    fontWeight: '600',
    color: '#09090B',
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E4E7',
  },
  bottomBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 8,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 8,
    height: 50,
    paddingHorizontal: 8,
  },
  stepBtn: {
    padding: 8,
  },
  stepCount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
    minWidth: 22,
    textAlign: 'center',
  },
  primaryButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#09090B',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
