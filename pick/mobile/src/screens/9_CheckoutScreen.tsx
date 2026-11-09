import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { Header } from '../components/common/Header';
import { PickIcon } from '../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import type { BazarProduct } from '../data/mockData';
import type { CartEntry, PaymentMethod, PaymentProvider } from '../services/orders';

interface CheckoutScreenProps {
  onBack: () => void;
  onPlaceOrder: (paymentMethod: PaymentMethod) => void;
  onChangeAddress?: () => void;
  onChangeTime?: () => void;
  onChangePayment?: () => void;
  onAddMoreItems?: () => void;
  address: string;
  products: BazarProduct[];
  cart: CartEntry[];
  deliveryFee: number | null;
  paymentProviders: PaymentProvider[];
  onCartChange: (item: CartEntry) => void;
}

export const CheckoutScreen: React.FC<CheckoutScreenProps> = ({
  onBack,
  onPlaceOrder,
  onChangeAddress,
  onAddMoreItems,
  address,
  products,
  cart,
  deliveryFee,
  paymentProviders,
  onCartChange,
}) => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  const items = cart.flatMap((entry) => {
    const product = products.find((candidate) => candidate.id === entry.productId);
    if (!product) return [];
    return [{
      ...entry,
      product,
      price: product.unitPrices?.[entry.unitIndex] ?? product.price,
      unit: isEn
        ? product.unitsEn[entry.unitIndex] ?? product.unitEn
        : product.units[entry.unitIndex] ?? product.unit
    }];
  });
  const updateItemQty = (item: CartEntry, delta: number) => {
    onCartChange({ ...item, quantity: Math.max(0, item.quantity + delta) });
  };

  const itemsSubtotal = Math.round(items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  ) * 100) / 100;
  const grandTotal = deliveryFee === null
    ? null
    : Math.round((itemsSubtotal + deliveryFee) * 100) / 100;

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Checkout', 'চেকআউট')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: SYSTEM_INSETS.bottom + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Delivery Address */}
        <Text style={styles.sectionHeading}>
          {t('Delivery Address', 'ডেলিভারি ঠিকানা')}
        </Text>
        <View style={styles.section}>
          <View style={styles.addressRow}>
            <View style={styles.addressInfo}>
              <Text style={styles.addressMain}>
                {address || t('Set a delivery address', 'ডেলিভারির ঠিকানা দিন')}
              </Text>
            </View>
            {onChangeAddress && (
              <TouchableOpacity onPress={onChangeAddress} activeOpacity={0.7}>
                <Text style={styles.changeLink}>{t('Change', 'পরিবর্তন')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Cart Items */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeading}>
            {t('Selected Items', 'নির্বাচিত পণ্য')}
          </Text>
          {onAddMoreItems && (
            <TouchableOpacity onPress={onAddMoreItems} activeOpacity={0.7}>
              <Text style={styles.addMoreLink}>
                {t('+ Add more', '+ আরও যোগ করুন')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const unit = item.unit;

            return (
              <React.Fragment key={`${item.productId}:${item.unitIndex}`}>
                <View style={styles.itemRow}>
                  <Image source={{ uri: item.product.image }} style={styles.itemThumb} />
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {isEn ? item.product.nameEn : item.product.name}
                    </Text>
                    <Text style={styles.itemPrice}>
                      ৳{item.price * item.quantity}{' '}
                      <Text style={styles.itemUnit}>({unit})</Text>
                    </Text>
                  </View>

                  <View style={styles.stepperWrap}>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => updateItemQty(item, -1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <PickIcon name="minus" size={12} color="#09090B" />
                    </TouchableOpacity>
                    <Text style={styles.stepVal}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.stepBtn}
                      onPress={() => updateItemQty(item, 1)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <PickIcon name="plus" size={12} color="#09090B" />
                    </TouchableOpacity>
                  </View>
                </View>
                {!isLast && <View style={styles.hairlineDivider} />}
              </React.Fragment>
            );
          })}
          {items.length === 0 && (
            <Text style={styles.addressSub}>
              {t('Your cart is empty', 'আপনার কার্ট খালি')}
            </Text>
          )}
        </View>

        {/* Bill Summary */}
        <Text style={styles.sectionHeading}>
          {t('Bill Summary', 'বিল বিবরণ')}
        </Text>
        <View style={styles.section}>
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              {t('Items Total', 'পণ্যের মূল্য')}
            </Text>
            <Text style={styles.billValue}>৳{itemsSubtotal}</Text>
          </View>
          <View style={styles.hairlineDivider} />
          <View style={styles.billRow}>
            <Text style={styles.billLabel}>
              {t('Delivery Fee', 'ডেলিভারি চার্জ')}
            </Text>
            <Text style={styles.billValue}>
              {deliveryFee === null ? '—' : `৳${deliveryFee}`}
            </Text>
          </View>
          <View style={styles.hairlineDivider} />
          <View style={styles.billRow}>
            <Text style={styles.billTotalLabel}>{t('Total', 'সর্বমোট')}</Text>
            <Text style={styles.billTotalValue}>
              {grandTotal === null ? '—' : `৳${grandTotal}`}
            </Text>
          </View>
        </View>

        {/* Payment Method */}
        <Text style={styles.sectionHeading}>
          {t('Payment Method', 'পেমেন্ট মেথড')}
        </Text>
        <View style={styles.section}>
          {paymentProviders.map((provider, index) => (
            <React.Fragment key={provider.id}>
              {index > 0 && <View style={styles.hairlineDivider} />}
              <TouchableOpacity
                style={styles.payRow}
                onPress={() => setPaymentMethod(provider.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.payTitle}>{provider.name}</Text>
                <View style={styles.radioOuter}>
                  {paymentMethod === provider.id && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
          {paymentProviders.length > 0 && <View style={styles.hairlineDivider} />}
          <TouchableOpacity
            style={styles.payRow}
            onPress={() => setPaymentMethod('cod')}
            activeOpacity={0.7}
          >
            <Text style={styles.payTitle}>
              {t('Cash on Delivery', 'ক্যাশ অন ডেলিভারি')}
            </Text>
            <View style={styles.radioOuter}>
              {paymentMethod === 'cod' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Primary Action Button */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: SYSTEM_INSETS.bottom + 16 },
        ]}
      >
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => onPlaceOrder(paymentMethod)}
          disabled={items.length === 0 || deliveryFee === null || !address.trim()}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {grandTotal === null
              ? t('Ordering unavailable', 'অর্ডার করা যাচ্ছে না')
              : `${t('Place Order', 'অর্ডার নিশ্চিত করুন')} • ৳${grandTotal}`}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    marginTop: 10,
  },
  addMoreLink: {
    fontSize: 13,
    fontWeight: '600',
    color: '#09090B',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  addressInfo: {
    flex: 1,
  },
  addressMain: {
    fontSize: 15,
    fontWeight: '600',
    color: '#09090B',
    marginBottom: 2,
  },
  addressSub: {
    fontSize: 13,
    color: '#71717A',
  },
  changeLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  itemThumb: {
    width: 48,
    height: 48,
    borderRadius: 6,
    backgroundColor: '#F4F4F5',
  },
  itemDetails: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
  },
  itemUnit: {
    fontSize: 12,
    fontWeight: '400',
    color: '#71717A',
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 6,
    height: 30,
    paddingHorizontal: 4,
  },
  stepBtn: {
    padding: 6,
  },
  stepVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
    minWidth: 18,
    textAlign: 'center',
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E4E7',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  billLabel: {
    fontSize: 14,
    color: '#71717A',
  },
  billValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  billTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
  },
  billTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#09090B',
  },
  payRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  payTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#09090B',
  },
  bottomBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
  },
  primaryButton: {
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
