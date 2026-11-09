import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Header } from '../../components/common/Header';
import { PickIcon } from '../../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../../components/common/ScreenContainer';
import { useLanguage } from '../../context/LanguageContext';
import { getParcelAddressForPin } from '../../services/parcels';

export type ParcelLocationKind = 'pickup' | 'destination';

export interface ParcelPin {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface ParcelLocationPickerScreenProps {
  kind: ParcelLocationKind;
  initialPin: ParcelPin;
  onBack: () => void;
  onSave: (pin: ParcelPin) => void;
}

const DEFAULT_REGION: Region = {
  latitude: 23.8103,
  longitude: 90.4125,
  latitudeDelta: 0.035,
  longitudeDelta: 0.035,
};

const validCoordinate = (value: number | null): value is number =>
  typeof value === 'number' && Number.isFinite(value);

export const ParcelLocationPickerScreen: React.FC<ParcelLocationPickerScreenProps> = ({
  kind,
  initialPin,
  onBack,
  onSave,
}) => {
  const { t } = useLanguage();
  const mapsConfigured = Constants.expoConfig?.extra?.googleMapsConfigured === true;
  const initialRegion = useMemo<Region>(() => ({
    latitude: validCoordinate(initialPin.latitude) ? initialPin.latitude : DEFAULT_REGION.latitude,
    longitude: validCoordinate(initialPin.longitude) ? initialPin.longitude : DEFAULT_REGION.longitude,
    latitudeDelta: DEFAULT_REGION.latitudeDelta,
    longitudeDelta: DEFAULT_REGION.longitudeDelta,
  }), [initialPin.latitude, initialPin.longitude]);
  const mapRef = useRef<MapView>(null);
  const userMovedMap = useRef(false);
  const [region, setRegion] = useState(initialRegion);
  const [address, setAddress] = useState(initialPin.address);
  const [pin, setPin] = useState({
    latitude: initialPin.latitude,
    longitude: initialPin.longitude,
  });
  const [pinConfirmed, setPinConfirmed] = useState(
    validCoordinate(initialPin.latitude) && validCoordinate(initialPin.longitude),
  );
  const [locating, setLocating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [error, setError] = useState('');

  const setMapPin = (latitude: number, longitude: number) => {
    setPin({ latitude, longitude });
    setPinConfirmed(true);
    setError('');
  };

  const handleUseCurrentLocation = async () => {
    setLocating(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error(t(
          'Allow location access to center the map on your current location.',
          'বর্তমান অবস্থান দেখাতে লোকেশন ব্যবহারের অনুমতি দিন।',
        ));
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nextRegion = {
        ...region,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };
      setRegion(nextRegion);
      setMapPin(position.coords.latitude, position.coords.longitude);
      mapRef.current?.animateToRegion(nextRegion, 350);
    } catch (locationError) {
      setError(locationError instanceof Error
        ? locationError.message
        : t('Could not get your current location.', 'বর্তমান অবস্থান পাওয়া যায়নি।'));
    } finally {
      setLocating(false);
    }
  };

  const handleConfirm = async () => {
    Keyboard.dismiss();
    if (!mapsConfigured) {
      setError(t(
        'Google Maps needs app-restricted Android and iOS API keys before you can set a pin.',
        'পিন সেট করতে Android ও iOS-এর জন্য সীমাবদ্ধ Google Maps API key কনফিগার করতে হবে।',
      ));
      return;
    }
    if (!pinConfirmed || !validCoordinate(pin.latitude) || !validCoordinate(pin.longitude)) {
      setError(t('Move the map to set a location pin.', 'ম্যাপ সরিয়ে লোকেশন পিন সেট করুন।'));
      return;
    }
    setResolvingAddress(true);
    try {
      const resolvedAddress = address.trim() ||
        await getParcelAddressForPin(pin.latitude, pin.longitude);
      onSave({
        address: resolvedAddress,
        latitude: pin.latitude,
        longitude: pin.longitude,
      });
    } catch (resolveError) {
      setError(resolveError instanceof Error
        ? resolveError.message
        : t('Could not resolve this map pin. Enter the address manually.', 'এই ম্যাপ পিনের ঠিকানা পাওয়া যায়নি। ঠিকানা ম্যানুয়ালি লিখুন।'));
    } finally {
      setResolvingAddress(false);
    }
  };

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header
        title={kind === 'pickup'
          ? t('Set pickup location', 'পিকআপ লোকেশন সেট করুন')
          : t('Set delivery destination', 'ডেলিভারি লোকেশন সেট করুন')}
        onBack={onBack}
      />
      <View style={styles.content}>
        <Text style={styles.instruction}>
          {t('Move the map until the pin is exactly at the location.', 'পিনটি সঠিক জায়গায় না আসা পর্যন্ত ম্যাপ সরান।')}
        </Text>

        <View style={styles.mapContainer}>
          {mapsConfigured ? (
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={StyleSheet.absoluteFill}
              initialRegion={initialRegion}
              onPanDrag={() => {
                userMovedMap.current = true;
                setPinConfirmed(false);
              }}
              onRegionChangeComplete={(nextRegion) => {
                setRegion(nextRegion);
                if (userMovedMap.current) {
                  setMapPin(nextRegion.latitude, nextRegion.longitude);
                  userMovedMap.current = false;
                }
              }}
              onPress={(event) => {
                const coordinate = event.nativeEvent.coordinate;
                setMapPin(coordinate.latitude, coordinate.longitude);
                mapRef.current?.animateToRegion({
                  ...region,
                  latitude: coordinate.latitude,
                  longitude: coordinate.longitude,
                }, 250);
              }}
              showsCompass
              toolbarEnabled={false}
            />
          ) : (
            <View style={styles.mapUnavailable}>
              <PickIcon name="map-pin" size={30} color="#71717A" />
              <Text style={styles.mapUnavailableText}>
                {t('Google Maps key setup is required to select a pin.', 'পিন নির্বাচন করতে Google Maps key কনফিগার করতে হবে।')}
              </Text>
            </View>
          )}
          {mapsConfigured && (
            <View pointerEvents="none" style={styles.centerPin}>
              <PickIcon name="map-pin" size={38} color="#111827" />
            </View>
          )}
          <TouchableOpacity
            style={styles.locateButton}
            onPress={handleUseCurrentLocation}
            disabled={locating || !mapsConfigured}
            activeOpacity={0.8}
          >
            {locating
              ? <ActivityIndicator size="small" color="#111827" />
              : <PickIcon name="navigate" size={18} color="#111827" />}
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>{t('ADDRESS OR LANDMARK', 'ঠিকানা বা পরিচিত স্থান')}</Text>
        <TextInput
          value={address}
          onChangeText={(value) => {
            setAddress(value);
            setPinConfirmed(false);
            setError('');
          }}
          placeholder={t('House, road, area or landmark', 'বাড়ি, রাস্তা, এলাকা বা পরিচিত স্থান')}
          placeholderTextColor="#9CA3AF"
          style={styles.addressInput}
          returnKeyType="done"
          onSubmitEditing={Keyboard.dismiss}
        />
        {!address.trim() && (
          <Text style={styles.addressHint}>
            {t('If left blank, the address will be looked up from the map pin.', 'খালি রাখলে ম্যাপ পিন থেকে ঠিকানা খুঁজে নেওয়া হবে।')}
          </Text>
        )}
        {pinConfirmed && validCoordinate(pin.latitude) && validCoordinate(pin.longitude) && (
          <Text style={styles.pinStatus}>
            {t('Map pin set', 'ম্যাপ পিন সেট হয়েছে')}
          </Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      <View style={[styles.bottomBar, { paddingBottom: SYSTEM_INSETS.bottom + 16 }]}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          disabled={resolvingAddress}
          activeOpacity={0.85}
        >
          {resolvingAddress
            ? <ActivityIndicator color="#FFFFFF" />
            : <Text style={styles.confirmButtonText}>{t('Confirm location', 'লোকেশন নিশ্চিত করুন')}</Text>}
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  instruction: {
    color: '#52525B',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  mapContainer: {
    height: 330,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    marginBottom: 18,
  },
  mapUnavailable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  mapUnavailableText: {
    color: '#52525B',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -19 }, { translateY: -35 }],
  },
  locateButton: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  label: {
    color: '#52525B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  addressInput: {
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontSize: 15,
    paddingHorizontal: 14,
  },
  addressHint: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  pinStatus: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  error: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
  },
  confirmButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
