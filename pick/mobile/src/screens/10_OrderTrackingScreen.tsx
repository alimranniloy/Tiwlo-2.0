import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Header } from '../components/common/Header';
import { PickIcon } from '../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import type { PickOrder } from '../services/orders';

interface OrderTrackingScreenProps {
  onBack: () => void;
  order: PickOrder | null;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({
  onBack,
  order,
}) => {
  const { t } = useLanguage();
  const stages = [
    { id: 'placed', title: t('Order placed', 'অর্ডার করা হয়েছে') },
    { id: 'confirmed', title: t('Order confirmed', 'অর্ডার নিশ্চিত') },
    { id: 'preparing', title: t('Preparing', 'প্রস্তুত করা হচ্ছে') },
    { id: 'out_for_delivery', title: t('Out for delivery', 'ডেলিভারির পথে') },
    { id: 'delivered', title: t('Delivered', 'ডেলিভারি সম্পন্ন') },
  ];
  const status = order?.status.toLowerCase() || '';
  const stageIndex = status === 'cancelled' || status === 'canceled' || status === 'failed'
    ? -1
    : status === 'delivered'
      ? stages.length - 1
      : status.includes('deliver') || status === 'picked_up' || status === 'in_transit'
        ? 3
        : status === 'preparing' || status === 'processing'
          ? 2
          : status === 'confirmed' || status === 'accepted'
            ? 1
            : 0;
  const formatStatus = (value: string) =>
    value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const paymentStatus = order?.paymentStatus.toLowerCase() || '';
  const paymentStatusLabel = paymentStatus === 'paid'
    ? t('Payment complete', 'পেমেন্ট সম্পন্ন')
    : paymentStatus === 'pending'
      ? t('Payment pending', 'পেমেন্ট অপেক্ষমাণ')
      : paymentStatus === 'failed'
        ? t('Payment failed', 'পেমেন্ট ব্যর্থ')
        : paymentStatus === 'expired'
          ? t('Payment expired', 'পেমেন্টের সময় শেষ')
          : paymentStatus === 'cancelled'
            ? t('Payment cancelled', 'পেমেন্ট বাতিল')
            : '';

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Order Tracking', 'অর্ডার ট্র্যাকিং')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: SYSTEM_INSETS.bottom + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Map space is kept until dispatch provides live rider coordinates. */}
        <View style={styles.mapContainer}>
          <Text style={styles.mapOrderId}>
            {order ? `#${order.id.slice(0, 8).toUpperCase()}` : t('Order unavailable', 'অর্ডার পাওয়া যায়নি')}
          </Text>
        </View>

        {/* Status Info */}
        <View style={styles.statusSection}>
          <Text style={styles.statusHeadline}>
            {order ? formatStatus(order.status) : t('Order unavailable', 'অর্ডার পাওয়া যায়নি')}
          </Text>
          <Text style={styles.statusHelper}>
            {order?.deliveryAddress || t('No delivery address available', 'ডেলিভারির ঠিকানা নেই')}
          </Text>
          {order && order.paymentMethod.toLowerCase() !== 'cod' && paymentStatusLabel ? (
            <Text style={styles.paymentStatus}>
              {t('Payment', 'পেমেন্ট')}: {paymentStatusLabel}
            </Text>
          ) : null}
          {paymentStatus === 'pending' ? (
            <Text style={styles.paymentHint}>
              {t(
                'The order will be confirmed after Tiwlo verifies the payment.',
                'Tiwlo পেমেন্ট যাচাই করার পর অর্ডার নিশ্চিত হবে।'
              )}
            </Text>
          ) : null}
        </View>

        <View style={styles.hairlineDivider} />

        {/* Timeline */}
        <View style={styles.timelineSection}>
          <Text style={styles.sectionHeading}>
            {t('Delivery Progress', 'ডেলিভারি অগ্রগতি')}
          </Text>

          {stages.map((step, index) => {
            const isCompleted = order !== null && index < stageIndex;
            const isActive = order !== null && index === stageIndex;
            const isLast = index === stages.length - 1;

            return (
              <View key={step.id} style={styles.timelineRow}>
                <View style={styles.indicatorCol}>
                  <View
                    style={[
                      styles.dot,
                      (isCompleted || isActive) && styles.dotActive,
                    ]}
                  >
                      {isCompleted ? (
                        <PickIcon name="check" size={10} color="#FFFFFF" />
                      ) : null}
                    </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.line,
                        isCompleted && styles.lineCompleted,
                      ]}
                    />
                  )}
                </View>

                <View style={styles.stepInfoCol}>
                  <View style={styles.stepHeaderRow}>
                    <Text
                      style={[
                        styles.stepTitle,
                        (isCompleted || isActive) && styles.stepTitleBold,
                      ]}
                    >
                      {step.title}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  mapContainer: {
    height: 150,
    backgroundColor: '#F4F4F5',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  mapOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#71717A',
  },
  statusSection: {
    marginBottom: 16,
  },
  statusHeadline: {
    fontSize: 20,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  statusHelper: {
    fontSize: 14,
    color: '#71717A',
  },
  paymentStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
    marginTop: 10,
  },
  paymentHint: {
    fontSize: 13,
    color: '#71717A',
    lineHeight: 19,
    marginTop: 4,
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E4E7',
  },
  timelineSection: {
    paddingTop: 16,
  },
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  timelineRow: {
    flexDirection: 'row',
    minHeight: 48,
  },
  indicatorCol: {
    alignItems: 'center',
    width: 20,
    marginRight: 12,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#E4E4E7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: '#09090B',
  },
  line: {
    width: 2,
    flex: 1,
    backgroundColor: '#E4E4E7',
    marginVertical: 4,
  },
  lineCompleted: {
    backgroundColor: '#09090B',
  },
  stepInfoCol: {
    flex: 1,
    paddingBottom: 16,
  },
  stepHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 14,
    color: '#71717A',
  },
  stepTitleBold: {
    fontWeight: '600',
    color: '#09090B',
  },
  stepTime: {
    fontSize: 12,
    color: '#71717A',
  },
  stepSub: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
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
