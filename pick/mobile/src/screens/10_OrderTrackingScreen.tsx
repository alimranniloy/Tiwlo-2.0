import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { type CameraRef } from '@maplibre/maplibre-react-native';
import { Header } from '../components/common/Header';
import { PickIcon } from '../components/common/PickIcon';
import { PickNativeMap } from '../components/maps/PickNativeMap';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import {
  decodeDeliveryRoute,
  getDeliveryRouteEstimate,
  getOrders,
  type DeliveryRouteEstimate,
  type PickOrder
} from '../services/orders';

interface OrderTrackingScreenProps {
  onBack: () => void;
  order: PickOrder | null;
}

function getMapPoint(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (typeof latitude !== 'number' || !Number.isFinite(latitude) ||
      typeof longitude !== 'number' || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({
  onBack,
  order,
}) => {
  const { language, t } = useLanguage();
  const [liveOrder, setLiveOrder] = useState<PickOrder | null>(null);
  const [liveError, setLiveError] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [followingRiderState, setFollowingRiderState] = useState<{
    orderId: string | undefined;
    following: boolean;
  }>({ orderId: undefined, following: true });
  const [syncing, setSyncing] = useState(false);
  const cameraRef = useRef<CameraRef>(null);
  const initialCameraSet = useRef(false);
  const lastRiderPointKey = useRef<string | null>(null);
  const [routeEstimateState, setRouteEstimateState] = useState<{
    orderId: string;
    estimate: DeliveryRouteEstimate;
  } | null>(null);
  const [routeErrorState, setRouteErrorState] = useState<{ orderId: string; error: string } | null>(null);
  const trackingOrder = liveOrder?.id === order?.id && order
    ? { ...order, ...liveOrder }
    : order;
  const parcelRecipient = trackingOrder?.parcelDetails?.recipient;
  const recipientPin = parcelRecipient?.latitude !== undefined &&
      parcelRecipient.longitude !== undefined
    ? parcelRecipient
    : trackingOrder?.deliveryLatitude !== null &&
        trackingOrder?.deliveryLatitude !== undefined &&
        trackingOrder.deliveryLongitude !== null &&
        trackingOrder.deliveryLongitude !== undefined
      ? {
          latitude: trackingOrder.deliveryLatitude,
          longitude: trackingOrder.deliveryLongitude
        }
      : undefined;
  const riderPin = trackingOrder?.deliveryTracking;
  const riderPoint = useMemo(
    () => getMapPoint(riderPin?.latitude, riderPin?.longitude),
    [riderPin?.latitude, riderPin?.longitude]
  );
  const recipientPoint = useMemo(
    () => getMapPoint(recipientPin?.latitude, recipientPin?.longitude),
    [recipientPin?.latitude, recipientPin?.longitude]
  );
  const hasRecipientPin = recipientPoint !== null;
  const hasRiderPin = riderPoint !== null;
  const initialCenter = useMemo(() => ({
    latitude: riderPoint?.latitude ?? recipientPoint?.latitude ?? 23.8103,
    longitude: riderPoint?.longitude ?? recipientPoint?.longitude ?? 90.4125,
  }), [riderPoint?.latitude, riderPoint?.longitude, recipientPoint?.latitude, recipientPoint?.longitude]);
  const orderId = order?.id;
  const followingRider = followingRiderState.orderId === orderId
    ? followingRiderState.following
    : true;
  const setFollowingRider = (following: boolean) => {
    setFollowingRiderState({ orderId, following });
  };
  useEffect(() => {
    initialCameraSet.current = false;
    lastRiderPointKey.current = null;
  }, [orderId]);
  const orderStatus = order?.status;
  const liveStatus = liveOrder && liveOrder.id === orderId ? liveOrder.status : orderStatus;
  const routeIsActive = Boolean(
    orderId && hasRecipientPin && hasRiderPin &&
    ['accepted', 'picked_up'].includes(riderPin?.status || '')
  );
  const routeEstimate = routeIsActive && orderId && routeEstimateState &&
      routeEstimateState.orderId === orderId
    ? routeEstimateState.estimate
    : null;
  const routeCoordinates = useMemo(
    () => routeEstimate ? decodeDeliveryRoute(routeEstimate.encodedPolyline) : [],
    [routeEstimate]
  );
  const routeError = routeIsActive && orderId && routeErrorState &&
      routeErrorState.orderId === orderId
    ? routeErrorState.error
    : '';
  useEffect(() => {
    if (!orderId || ['delivered', 'cancelled', 'canceled', 'failed'].includes(liveStatus?.toLowerCase() || '')) {
      return undefined;
    }
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
  }, [orderId, liveStatus]);

  useEffect(() => {
    if (!routeIsActive || !orderId) return undefined;
    let active = true;
    let loading = false;
    const refreshEstimate = async () => {
      if (loading) return;
      loading = true;
      try {
        const estimate = await getDeliveryRouteEstimate(orderId);
        if (active) {
          setRouteEstimateState({ orderId, estimate });
          setRouteErrorState(null);
        }
      } catch (error) {
        if (active) {
          setRouteErrorState({
            orderId,
            error: error instanceof Error
              ? error.message
              : 'Live arrival time is temporarily unavailable.'
          });
        }
      } finally {
        loading = false;
      }
    };
    void refreshEstimate();
    const interval = setInterval(() => void refreshEstimate(), 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [
    orderId, routeIsActive
  ]);

  useEffect(() => {
    if (!mapReady || initialCameraSet.current || !riderPoint || !recipientPoint) return;
    const coordinates = routeCoordinates.length > 1
      ? routeCoordinates
      : [riderPoint, recipientPoint];
    const longitudes = coordinates.map((point) => point.longitude);
    const latitudes = coordinates.map((point) => point.latitude);
    const west = Math.min(...longitudes);
    const east = Math.max(...longitudes);
    const south = Math.min(...latitudes);
    const north = Math.max(...latitudes);
    const minimumSpan = 0.003;
    const longitudeSpan = Math.max(east - west, minimumSpan);
    const latitudeSpan = Math.max(north - south, minimumSpan);
    cameraRef.current?.fitBounds([
      west - longitudeSpan * 0.08,
      south - latitudeSpan * 0.08,
      east + longitudeSpan * 0.08,
      north + latitudeSpan * 0.08,
    ], {
      padding: { top: 56, right: 42, bottom: 56, left: 42 },
      duration: 0,
    });
    initialCameraSet.current = true;
  }, [mapReady, riderPoint, recipientPoint, routeCoordinates]);

  useEffect(() => {
    if (!mapReady || !followingRider || !riderPoint || !initialCameraSet.current) return;
    const pointKey = `${riderPoint.latitude},${riderPoint.longitude}`;
    if (lastRiderPointKey.current === null) {
      lastRiderPointKey.current = pointKey;
      return;
    }
    if (lastRiderPointKey.current === pointKey) return;
    lastRiderPointKey.current = pointKey;
    cameraRef.current?.easeTo({
      center: [riderPoint.longitude, riderPoint.latitude],
      zoom: 15,
      duration: 850,
    });
  }, [mapReady, followingRider, riderPoint]);

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
          {(hasRecipientPin || hasRiderPin) ? (
            <PickNativeMap
              style={StyleSheet.absoluteFill}
              center={initialCenter}
              cameraRef={cameraRef}
              initialZoom={14}
              route={routeCoordinates}
              destination={recipientPoint}
              rider={riderPoint}
              onMapReady={() => {
                setMapReady(true);
                setMapError(false);
              }}
              onMapError={() => {
                setMapReady(false);
                setMapError(true);
              }}
              onUserInteraction={() => setFollowingRider(false)}
            />
          ) : (
            <View style={styles.mapFallback}>
              <Text style={styles.mapOrderId}>
                {trackingOrder ? `#${trackingOrder.id.slice(0, 8).toUpperCase()}` : t('Order unavailable', 'অর্ডার পাওয়া যায়নি')}
              </Text>
              <Text style={styles.mapFallbackText}>
                {t('Map coordinates are not available for this order yet.', 'এই অর্ডারের ম্যাপ লোকেশন এখনো পাওয়া যায়নি।')}
              </Text>
            </View>
          )}
          {mapError ? (
            <View style={styles.mapErrorOverlay}>
              <Text style={styles.mapFallbackText}>
                {t('Map tiles could not be loaded. Check your internet connection.', 'ম্যাপ লোড হয়নি। ইন্টারনেট সংযোগ পরীক্ষা করুন।')}
              </Text>
            </View>
          ) : null}
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
          {routeEstimate && hasRiderPin ? (
            <View style={styles.etaBadge}>
              <Text style={styles.etaValue}>
                {t(`About ${routeEstimate.etaMinutes} min`, `প্রায় ${routeEstimate.etaMinutes} মিনিট`)}
              </Text>
              <Text style={styles.etaCaption}>
                {t('estimated · no live traffic', 'আনুমানিক · লাইভ ট্রাফিক ছাড়া')}
              </Text>
            </View>
          ) : null}
          {hasRiderPin && !followingRider ? (
            <TouchableOpacity
              style={styles.recenterButton}
              accessibilityRole="button"
              accessibilityLabel={t('Follow delivery partner', 'ডেলিভারি পার্টনারকে অনুসরণ করুন')}
              onPress={() => {
                setFollowingRider(true);
                if (riderPoint) {
                  lastRiderPointKey.current = `${riderPoint.latitude},${riderPoint.longitude}`;
                  cameraRef.current?.easeTo({
                    center: [riderPoint.longitude, riderPoint.latitude],
                    zoom: 15,
                    duration: 650,
                  });
                }
              }}
              activeOpacity={0.85}
            >
              <PickIcon name="navigate" size={17} color="#FFFFFF" />
            </TouchableOpacity>
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
              {trackingOrder.deliveryTracking.locationUpdatedAt ? (
                <Text style={styles.riderDetail}>
                  {t('Location updated', 'লোকেশন আপডেট')} · {new Date(
                    trackingOrder.deliveryTracking.locationUpdatedAt,
                  ).toLocaleTimeString(language === 'en' ? 'en-BD' : 'bn-BD', {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              ) : null}
              {routeError ? (
                <Text style={styles.riderDetail}>
                  {t('Arrival estimate is updating.', 'পৌঁছানোর সময় আপডেট হচ্ছে।')}
                </Text>
              ) : null}
              {routeEstimate ? (
                <Text style={styles.riderDetail}>
                  {t('Route distance', 'রুটের দূরত্ব')} · {routeEstimate.distanceMeters >= 1000
                    ? `${(routeEstimate.distanceMeters / 1000).toFixed(1)} km`
                    : `${Math.round(routeEstimate.distanceMeters)} m`}
                </Text>
              ) : null}
              {routeEstimate ? (
                <Text style={styles.riderDetail}>
                  Routes © OSRM · © OpenStreetMap contributors (ODbL)
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

        {trackingOrder ? (
          <>
            <View style={styles.hairlineDivider} />
            <View style={styles.invoiceSection}>
              <Text style={styles.sectionHeading}>{t('Order summary', 'অর্ডারের সারাংশ')}</Text>
              {trackingOrder.items.map((item) => (
                <View key={item.id} style={styles.invoiceRow}>
                  <Text style={styles.invoiceItem} numberOfLines={2}>
                    {language === 'en' ? item.nameEn : item.nameBn}
                    {'  ×  '}
                    {item.quantity}
                  </Text>
                  <Text style={styles.invoiceAmount}>৳{item.lineTotal.toFixed(2)}</Text>
                </View>
              ))}
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceLabel}>{t('Subtotal', 'সাবটোটাল')}</Text>
                <Text style={styles.invoiceAmount}>৳{trackingOrder.subtotal.toFixed(2)}</Text>
              </View>
              <View style={styles.invoiceRow}>
                <Text style={styles.invoiceLabel}>{t('Delivery fee', 'ডেলিভারি ফি')}</Text>
                <Text style={styles.invoiceAmount}>৳{trackingOrder.deliveryFee.toFixed(2)}</Text>
              </View>
              <View style={[styles.invoiceRow, styles.invoiceTotalRow]}>
                <Text style={styles.invoiceTotalLabel}>{t('Total', 'সর্বমোট')}</Text>
                <Text style={styles.invoiceTotalAmount}>৳{trackingOrder.total.toFixed(2)}</Text>
              </View>
              <Text style={styles.paymentStatus}>
                {t('Payment method', 'পেমেন্ট পদ্ধতি')}: {formatStatus(trackingOrder.paymentMethod)}
                {trackingOrder.paymentMethod.toLowerCase() !== 'cod' && paymentStatusLabel
                  ? ` · ${paymentStatusLabel}`
                  : ''}
              </Text>
            </View>
          </>
        ) : null}

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
    height: 260,
    backgroundColor: '#202124',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  mapOrderId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  mapFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#202124',
  },
  mapFallbackText: {
    color: '#D1D5DB',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    textAlign: 'center',
  },
  mapErrorOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: 'rgba(32, 33, 36, 0.88)',
  },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: '#09090B',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  etaBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    alignItems: 'flex-end',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  etaValue: {
    color: '#09090B',
    fontSize: 13,
    fontWeight: '800',
  },
  etaCaption: {
    color: '#52525B',
    fontSize: 10,
    marginTop: 1,
  },
  recenterButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090B',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    elevation: 4,
  },
  statusSection: {
    marginBottom: 16,
  },
  invoiceSection: {
    paddingVertical: 16,
    gap: 10,
  },
  invoiceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  invoiceItem: {
    flex: 1,
    color: '#52525B',
    fontSize: 13,
    lineHeight: 19,
  },
  invoiceLabel: {
    color: '#71717A',
    fontSize: 13,
  },
  invoiceAmount: {
    color: '#52525B',
    fontSize: 13,
    fontWeight: '500',
  },
  invoiceTotalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
    paddingTop: 10,
  },
  invoiceTotalLabel: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '700',
  },
  invoiceTotalAmount: {
    color: '#09090B',
    fontSize: 15,
    fontWeight: '700',
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
    backgroundColor: '#F4F4F5',
    padding: 12,
  },
  riderName: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
  },
  riderDetail: {
    color: '#52525B',
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
