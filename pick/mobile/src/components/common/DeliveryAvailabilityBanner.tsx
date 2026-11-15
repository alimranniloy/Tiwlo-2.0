import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { PickIcon } from './PickIcon';
import { useLanguage } from '../../context/LanguageContext';
import type { DeliveryAvailability } from '../../services/deliveryAvailability';

interface DeliveryAvailabilityBannerProps {
  availability: DeliveryAvailability | { status: 'checking'; count: 0 };
  onDismiss: () => void;
}

export const DeliveryAvailabilityBanner: React.FC<DeliveryAvailabilityBannerProps> = ({
  availability,
  onDismiss
}) => {
  const { t } = useLanguage();
  const [loadingPulse] = useState(() => new Animated.Value(0.35));
  const [slideY] = useState(() => new Animated.Value(0));
  const isSearching = availability.status !== 'available';

  useEffect(() => {
    if (isSearching) {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(loadingPulse, {
          toValue: 0.9,
          duration: 700,
          useNativeDriver: true
        }),
        Animated.timing(loadingPulse, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true
        })
      ]));
      pulse.start();
      return () => pulse.stop();
    }

    const timer = setTimeout(() => {
      Animated.timing(slideY, {
        toValue: 110,
        duration: 450,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) onDismiss();
      });
    }, 3500);
    return () => clearTimeout(timer);
  }, [isSearching, loadingPulse, onDismiss, slideY]);

  const title = availability.status === 'checking'
    ? t('Finding delivery partners near you', 'আপনার কাছের ডেলিভারি পার্টনার খোঁজা হচ্ছে')
    : availability.status === 'available'
      ? t(
        `${availability.count} delivery ${availability.count === 1 ? 'partner' : 'partners'} available nearby`,
        `${availability.count} জন ডেলিভারি পার্টনার কাছাকাছি আছেন`
      )
      : t('No delivery partners in your area yet', 'এখনো আপনার এলাকায় ডেলিভারি পার্টনার নেই');
  const message = availability.status === 'available'
    ? t(
      'Available within your area’s delivery range.',
      'আপনার এলাকার নির্ধারিত ডেলিভারি রেঞ্জের মধ্যে আছেন।'
    )
    : availability.status === 'checking'
      ? t(
        'Checking on-duty partners within your delivery range.',
        'আপনার ডেলিভারি রেঞ্জে অন-ডিউটি পার্টনার খোঁজা হচ্ছে।'
      )
      : t(
        'We’re finding the best way to get your parcel to you.',
        'আপনার কাছে ডেলিভারি পৌঁছানোর উপায় খোঁজা হচ্ছে।'
      );

  return (
    <Animated.View
      accessibilityRole="summary"
      style={[
        styles.card,
        {
          opacity: slideY.interpolate({
            inputRange: [0, 110],
            outputRange: [1, 0],
            extrapolate: 'clamp'
          }),
          transform: [{ translateY: slideY }]
        }
      ]}
    >
      <Image
        source={require('../../../assets/images/parcel-1.gif')}
        style={styles.gif}
        contentFit="contain"
        autoplay
        accessibilityLabel={t('Animated parcel delivery illustration', 'পার্সেল ডেলিভারির অ্যানিমেশন')}
      />
      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {availability.status === 'available' ? (
            <View style={styles.partnerIcon}>
              <PickIcon name="scooter" size={18} color="#2563EB" />
            </View>
          ) : null}
        </View>
        <Text style={styles.message} numberOfLines={2}>{message}</Text>
        {isSearching ? (
          <View
            style={styles.loading}
            accessibilityLabel={t('Searching for delivery options', 'ডেলিভারির ব্যবস্থা খোঁজা হচ্ছে')}
          >
            {[0, 1, 2].map((line) => (
              <Animated.View
                key={line}
                style={[
                  styles.loadingLine,
                  line === 1 && styles.loadingLineShort,
                  line === 2 && styles.loadingLineMedium,
                  { opacity: loadingPulse }
                ]}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F7F8FA'
  },
  gif: {
    width: 68,
    height: 72,
    marginRight: 10
  },
  copy: {
    flex: 1,
    justifyContent: 'center'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5
  },
  title: {
    flex: 1,
    color: '#111827',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16
  },
  partnerIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    backgroundColor: '#DBEAFE'
  },
  message: {
    color: '#6B7280',
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 5
  },
  loadingLine: {
    width: 26,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#3B82F6'
  },
  loadingLineShort: {
    width: 15
  },
  loadingLineMedium: {
    width: 21
  }
});
