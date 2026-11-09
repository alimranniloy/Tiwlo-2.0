import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Header } from '../components/common/Header';
import { PickIcon } from '../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import type { PickOrder } from '../services/orders';

interface ParcelLandingScreenProps {
  area: string;
  coverageAvailable: boolean;
  latestParcel: PickOrder | null;
  loading: boolean;
  onBack: () => void;
  onSendParcel: () => void;
}

export const ParcelLandingScreen: React.FC<ParcelLandingScreenProps> = ({
  area,
  coverageAvailable,
  latestParcel,
  loading,
  onBack,
  onSendParcel,
}) => {
  const { width } = useWindowDimensions();
  const city = area.trim() || 'your city';
  const parcelStatus = latestParcel?.status
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
  const destination = latestParcel?.parcelDetails?.recipient?.address ||
    latestParcel?.deliveryAddress ||
    '';

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title="Parcel" onBack={onBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SYSTEM_INSETS.bottom + 104 },
        ]}
      >
        <View style={[styles.hero, { height: Math.min(width * 0.78, 320) }]}>
          <ExpoImage
            source={require('../../assets/images/parcel-animation.gif')}
            contentFit="contain"
            autoplay
            style={styles.heroImage}
            accessibilityLabel="Animated parcel delivery"
          />
        </View>

        <Text style={styles.eyebrow}>PICK PARCEL</Text>
        <Text style={styles.title}>
          {coverageAvailable
            ? `Parcel delivery in ${city}`
            : 'Send a parcel with PICK'}
        </Text>
        <Text style={styles.description}>
          {coverageAvailable
            ? 'Send across the city with convenient pickup and reliable delivery.'
            : 'Choose a pickup and destination to check parcel delivery availability.'}
        </Text>

        <View style={styles.deliveryCard}>
          <View style={styles.deliveryIcon}>
            <PickIcon name="clock" size={20} color="#09090B" />
          </View>
          <View style={styles.deliveryCopy}>
            <Text style={styles.deliveryTitle}>
              {coverageAvailable ? 'In-city delivery' : 'Coverage check'}
            </Text>
            <Text style={styles.deliverySubtitle}>
              {coverageAvailable
                ? 'Typically delivered in 2–3 hours'
                : `Check availability for ${city} when you continue`}
            </Text>
          </View>
          {coverageAvailable && (
            <View style={styles.availableBadge}>
              <View style={styles.availableDot} />
              <Text style={styles.availableText}>Available</Text>
            </View>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your last parcel</Text>
          {!loading && latestParcel && (
            <Text style={styles.sectionLink}>RECENT</Text>
          )}
        </View>

        <View style={styles.lastParcelCard}>
          {loading ? (
            <View style={styles.lastParcelLoading}>
              <ActivityIndicator size="small" color="#09090B" />
            </View>
          ) : latestParcel ? (
            <>
              <View style={styles.parcelIcon}>
                <PickIcon name="parcel" size={20} color="#09090B" />
              </View>
              <View style={styles.parcelDetails}>
                <Text style={styles.parcelTitle} numberOfLines={1}>
                  {destination || 'Parcel delivery'}
                </Text>
                <Text style={styles.parcelSubtitle} numberOfLines={1}>
                  {latestParcel.parcelDetails?.vehicle?.nameEn || 'PICK Parcel'}
                  {parcelStatus ? `  ·  ${parcelStatus}` : ''}
                </Text>
              </View>
              <Text style={styles.parcelPrice}>৳{latestParcel.total}</Text>
            </>
          ) : (
            <>
              <View style={styles.parcelIcon}>
                <PickIcon name="parcel" size={20} color="#09090B" />
              </View>
              <View style={styles.parcelDetails}>
                <Text style={styles.parcelTitle}>Your first parcel starts here</Text>
                <Text style={styles.parcelSubtitle}>
                  Pickup, delivery and updates in one place
                </Text>
              </View>
            </>
          )}
        </View>

        <View style={styles.benefitRow}>
          <View style={styles.benefitIcon}>
            <PickIcon name="navigate" size={18} color="#09090B" />
          </View>
          <Text style={styles.benefitText}>Door-to-door pickup and delivery</Text>
        </View>
        <View style={styles.benefitRow}>
          <View style={styles.benefitIcon}>
            <PickIcon name="shield" size={18} color="#09090B" />
          </View>
          <Text style={styles.benefitText}>Track your parcel from pickup to drop-off</Text>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onSendParcel}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <Text style={styles.primaryButtonText}>Continue to parcel delivery</Text>
          <PickIcon name="arrow-right" size={19} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.footerNote}>Delivery time depends on distance and traffic</Text>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  hero: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  eyebrow: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    marginTop: 4,
  },
  title: {
    color: '#09090B',
    fontSize: 27,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 33,
    marginTop: 8,
  },
  description: {
    color: '#71717A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  deliveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginTop: 20,
    backgroundColor: '#F4F4F5',
    borderRadius: 12,
  },
  deliveryIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 21,
    marginRight: 12,
  },
  deliveryCopy: {
    flex: 1,
  },
  deliveryTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
  },
  deliverySubtitle: {
    color: '#71717A',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 3,
  },
  availableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  availableDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#16A34A',
    marginRight: 5,
  },
  availableText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 26,
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#09090B',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionLink: {
    color: '#71717A',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  lastParcelCard: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    borderRadius: 12,
  },
  lastParcelLoading: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  parcelIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 21,
    marginRight: 12,
  },
  parcelDetails: {
    flex: 1,
  },
  parcelTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
  },
  parcelSubtitle: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 4,
  },
  parcelPrice: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4F4F5',
    borderRadius: 16,
    marginRight: 10,
  },
  benefitText: {
    flex: 1,
    color: '#3F3F46',
    fontSize: 13,
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: SYSTEM_INSETS.bottom + 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4E4E7',
  },
  primaryButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090B',
    borderRadius: 9,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    marginRight: 10,
  },
  footerNote: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 8,
    textAlign: 'center',
  },
});
