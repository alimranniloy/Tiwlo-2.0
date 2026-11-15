import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Header } from '../components/common/Header';
import { PickIcon } from '../components/common/PickIcon';
import { ScreenContainer } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import type { PickOrder } from '../services/orders';

export type PaymentResultState = 'success' | 'failed' | 'pending';

interface PaymentResultScreenProps {
  order: PickOrder;
  result: PaymentResultState;
  onBack: () => void;
  onViewOrder: () => void;
  onViewOrders: () => void;
  onCheckAgain: () => void;
  checkoutError?: string;
}

export const PaymentResultScreen: React.FC<PaymentResultScreenProps> = ({
  order,
  result,
  onBack,
  onViewOrder,
  onViewOrders,
  onCheckAgain,
  checkoutError
}) => {
  const { t } = useLanguage();
  const success = result === 'success';
  const failed = result === 'failed';

  return (
    <ScreenContainer applyTopInset applyBottomInset>
      <Header title={t('Payment', 'পেমেন্ট')} onBack={onBack} />
      <View style={styles.content}>
        <View style={[
          styles.iconCircle,
          success ? styles.successCircle : failed ? styles.failedCircle : styles.pendingCircle
        ]}>
          <PickIcon
            name={success ? 'check' : failed ? 'close' : 'clock'}
            size={40}
            color={success ? '#138A5B' : failed ? '#C2413A' : '#A66B13'}
          />
        </View>
        <Text style={styles.title}>
          {success
            ? t('Payment successful', 'পেমেন্ট সফল হয়েছে')
            : failed
              ? t('Payment was not completed', 'পেমেন্ট সম্পন্ন হয়নি')
              : t('Payment is being confirmed', 'পেমেন্ট নিশ্চিত করা হচ্ছে')}
        </Text>
        <Text style={styles.description}>
          {success
            ? t('Your payment is confirmed. You can follow the delivery from your order.', 'পেমেন্ট নিশ্চিত হয়েছে। অর্ডার থেকে ডেলিভারি ট্র্যাক করুন।')
            : failed
              ? t('No successful payment was received. Your order remains available in your order history.', 'পেমেন্ট নিশ্চিত হয়নি। অর্ডারটি আপনার অর্ডার তালিকায় থাকবে।')
              : t('The payment provider has not sent a final result yet. Check again in a moment.', 'পেমেন্টের চূড়ান্ত ফল এখনো আসেনি। কিছুক্ষণ পর আবার দেখুন।')}
        </Text>
        {checkoutError ? <Text accessibilityRole="alert" style={styles.error}>{checkoutError}</Text> : null}
        <View style={styles.summary}>
          <Text style={styles.orderNumber}>
            {t('Order', 'অর্ডার')} #{order.id.slice(0, 8).toUpperCase()}
          </Text>
          <Text style={styles.total}>৳{order.total.toFixed(2)}</Text>
          <Text style={styles.method}>
            {order.paymentProvider || order.paymentMethod}
          </Text>
        </View>
        {result === 'pending' && (
          <TouchableOpacity style={styles.secondaryButton} onPress={onCheckAgain} activeOpacity={0.8}>
            <Text style={styles.secondaryButtonText}>{t('Check payment again', 'পেমেন্ট আবার দেখুন')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.primaryButton} onPress={onViewOrder} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>
            {t('Track this order', 'এই অর্ডার ট্র্যাক করুন')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.ordersButton} onPress={onViewOrders} activeOpacity={0.8}>
          <Text style={styles.ordersButtonText}>{t('View all orders', 'সব অর্ডার দেখুন')}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingBottom: 20
  },
  iconCircle: {
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 44,
    marginBottom: 24
  },
  successCircle: { backgroundColor: '#E8F7EF' },
  failedCircle: { backgroundColor: '#FEF0EF' },
  pendingCircle: { backgroundColor: '#FFF6E5' },
  title: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center'
  },
  description: {
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    maxWidth: 340,
    textAlign: 'center'
  },
  error: {
    color: '#B42318',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 14,
    textAlign: 'center'
  },
  summary: { alignItems: 'center', marginTop: 28, marginBottom: 26 },
  orderNumber: { color: '#6B7280', fontSize: 13, fontWeight: '600' },
  total: { color: '#111827', fontSize: 26, fontWeight: '800', marginTop: 6 },
  method: { color: '#9CA3AF', fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#111827'
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  secondaryButton: {
    width: '100%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: '#F3F4F6'
  },
  secondaryButtonText: { color: '#374151', fontSize: 14, fontWeight: '700' },
  ordersButton: { paddingVertical: 16 },
  ordersButtonText: { color: '#4B5563', fontSize: 14, fontWeight: '600' }
});
