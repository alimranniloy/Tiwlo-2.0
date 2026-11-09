import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Constants from 'expo-constants';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Header } from '../components/common/Header';
import { PickIcon } from '../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import { getOrders, type PickOrder } from '../services/orders';

interface OrderTrackingScreenProps {
  onBack: () => void;
  order: PickOrder | null;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({
  onBack,
  order,
}) => {
  const { t } = useLanguage();
  const [liveOrder, setLiveOrder] = useState<PickOrder | null>(null);
  const [liveError, setLiveError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const mapRef = useRef<MapView>(null);
  const mapsConfigured = Constants.expoConfig?.extra?.googleMapsConfigured === true;
  const trackingOrder = liveOrder?.id === order?.id && order
    ? { ...order, ...liveOrder }
    : order;
  const recipientPin = trackingOrder?.parcelDetails?.recipient;
  const riderPin = trackingOrder?.deliveryTracking;
  const initialRegion = useMemo<Region>(() => ({
    latitude: riderPin?.latitude ?? recipientPin?.latitude ?? 23.8103,
    longitude: riderPin?.longitude ?? recipientPin?.longitude ?? 90.4125,
    latitudeDelta: 0.035,
    longitudeDelta: 0.035,
  }), [riderPin?.latitude, riderPin?.longitude, recipientPin?.latitude, recipientPin?.longitude]);
  const orderId = order?.id;
  const orderType = order?.orderType;
  const orderStatus = order?.status;
  const liveStatus = liveOrder && liveOrder.id === orderId ? liveOrder.status : orderStatus;
  useEffect(() => {
    if (!orderId || orderType !== 'parcel' || liveStatus === 'delivered') return undefined;
    let active = true;
    let loading = false;
    const refreshTracking = async () => {
      if (loading) return;
      loading = true;
      setSyncing(true);
      try {
        const orders = await getOrders();
        const updatedOrder = orders.find((item) => item.id === orderId);
        if (active && updatedOrder) {
          setLiveOrder(updatedOrder);
          setLiveError('');
        }
      } catch (error) {
        if (active) {
          setLiveError(error instanceof Error
            ? error.message
            : 'Live delivery status could not be refreshed.');
        }
      } finally {
        loading = false;
        if (active) setSyncing(false);
      }
    };
    void refreshTracking();
    const interval = setInterval(() => void refreshTracking(), 15_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderId, orderType, liveStatus]);

  useEffect(() => {
    if (riderPin?.latitude === null || riderPin?.latitude === undefined ||
        riderPin.longitude === null || riderPin.longitude === undefined) return;
    mapRef.current?.animateToRegion(initialRegion, 350);
  }, [initialRegion, riderPin?.latitude, riderPin?.longitude]);

  const stages = [
    { id: 'placed', title: t('Order placed', 'অর্ডার করা হয়েছে') },
    { id: 'confirmed', title: t('Order confirmed', 'অর্ডার নিশ্চিত') },
    { id: 'preparing', title: t('Preparing', 'প্রস্তুত করা হচ্ছে') },
    { id: 'out_for_delivery', title: t('Out for delivery', 'ডেলিভারির পথে') },
    { id: 'delivered', title: t('Delivered', 'ডেলিভারি সম্পন্ন') },
  ];
  const status = trackingOrder?.status.toLowerCase() || '';
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
  const paymentStatus = trackingOrder?.paymentStatus.toLowerCase() || '';
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
        <View style={styles.mapContainer}>
          {mapsConfigured && trackingOrder?.orderType === 'parcel' ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFill}
              initialRegion={initialRegion}
              showsCompass
            >
              {recipientPin?.latitude !== undefined && recipientPin.longitude !== undefined ? (
                <Marker
                  coordinate={{ latitude: recipientPin.latitude, longitude: recipientPin.longitude }}
                  title={t('Delivery destination', 'ডেলিভারির গন্তব্য')}
                  pinColor="#17A56B"
                />
              ) : null}
              {riderPin?.latitude !== null && riderPin?.latitude !== undefined &&
                riderPin.longitude !== null && riderPin.longitude !== undefined ? (
                  <Marker
                    coordinate={{ latitude: riderPin.latitude, longitude: riderPin.longitude }}
                    title={riderPin.riderName || t('PICK Delivery partner', 'PICK ডেলিভারি পার্টনার')}
                    description={t('Live rider location', 'পার্টনারের বর্তমান অবস্থান')}
                    pinColor="#111827"
                  />
                ) : null}
            </MapView>
          ) : (
            <Text style={styles.mapOrderId}>
              {trackingOrder ? `#${trackingOrder.id.slice(0, 8).toUpperCase()}` : t('Order unavailable', 'অর্ডার পাওয়া যায়নি')}
            </Text>
          )}
          {trackingOrder?.deliveryTracking ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveBadgeText}>
                {riderPin?.latitude !== null && riderPin?.latitude !== undefined
                  ? t('Rider live', 'রাইডার লাইভ')
                  : t('Rider assigned', 'রাইডার বরাদ্দ হয়েছে')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Status Info */}
        <View style={styles.statusSection}>
          <Text style={styles.statusHeadline}>
            {trackingOrder ? formatStatus(trackingOrder.status) : t('Order unavailable', 'অর্ডার পাওয়া যায়নি')}
          </Text>
          <Text style={styles.statusHelper}>
            {trackingOrder?.deliveryAddress || t('No delivery address available', 'ডেলিভারির ঠিকানা নেই')}
          </Text>
          {trackingOrder?.deliveryTracking ? (
            <View style={styles.riderCard}>
              <Text style={styles.riderName}>
                {trackingOrder.deliveryTracking.riderName || t('PICK Delivery partner', 'PICK ডেলিভারি পার্টনার')}
              </Text>
              <Text style={styles.riderDetail}>
                {formatStatus(trackingOrder.deliveryTracking.status)}
                {trackingOrder.deliveryTracking.vehicleType
                  ? ` · ${formatStatus(trackingOrder.deliveryTracking.vehicleType)}`
                  : ''}
              </Text>
              {trackingOrder.deliveryTracking.latitude === null ? (
                <Text style={styles.riderDetail}>
                  {t('Waiting for the next rider location update.', 'রাইডারের পরবর্তী লোকেশন আপডেটের অপেক্ষায়।')}
                </Text>
              ) : null}
            </View>
          ) : null}
          {trackingOrder && trackingOrder.paymentMethod.toLowerCase() !== 'cod' && paymentStatusLabel ? (
            <Text style={styles.paymentStatus}>
              {t('Payment', 'পেমেন্ট')}: {paymentStatusLabel}
            </Text>
          ) : null}
          {liveError ? <Text accessibilityRole="alert" style={styles.liveError}>{liveError}</Text> : null}
          {syncing ? <ActivityIndicator size="small" color="#17A56B" style={styles.syncIndicator} /> : null}
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
            const isCompleted = trackingOrder !== null && index < stageIndex;
            const isActive = trackingOrder !== null && index === stageIndex;
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
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#17A56B',
  },
  liveBadgeText: {
    color: '#17251F',
    fontSize: 11,
    fontWeight: '700',
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
  riderCard: {
    marginTop: 12,
    borderRadius: 12,
    backgroundColor: '#F3F8F5',
    padding: 12,
  },
  riderName: {
    color: '#17251F',
    fontSize: 14,
    fontWeight: '700',
  },
  riderDetail: {
    color: '#637269',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  liveError: {
    color: '#B42318',
    fontSize: 12,
    marginTop: 8,
  },
  syncIndicator: {
    alignSelf: 'flex-start',
    marginTop: 8,
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
