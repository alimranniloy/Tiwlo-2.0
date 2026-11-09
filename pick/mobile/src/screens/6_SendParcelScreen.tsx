import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Header } from '../components/common/Header';
import { PickIcon, IconName } from '../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { PackageDetailsData } from './parcel/ParcelPackageDetailsScreen';
import { RecipientData } from './parcel/ParcelRecipientScreen';
import { useLanguage } from '../context/LanguageContext';

export interface VehicleOption {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  eta: string;
  capacity: string;
  capacityEn: string;
  icon: IconName;
}

interface SendParcelScreenProps {
  onBack: () => void;
  onOpenPackageDetails: () => void;
  onOpenRecipient: () => void;
  onOpenReview: (vehicle: VehicleOption) => void;
  vehicles: VehicleOption[];
  vehiclesLoading: boolean;
  packageData: PackageDetailsData;
  recipientData: RecipientData;
}

export const SendParcelScreen: React.FC<SendParcelScreenProps> = ({
  onBack,
  onOpenPackageDetails,
  onOpenRecipient,
  onOpenReview,
  vehicles,
  vehiclesLoading,
  packageData,
  recipientData,
}) => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const currentVehicle =
    vehicles.find((vehicle) => vehicle.id === selectedVehicleId) ?? vehicles[0] ?? null;

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Send a Parcel', 'পার্সেল পাঠান')} onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SYSTEM_INSETS.bottom + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Addresses */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.addressRow}
            onPress={onOpenRecipient}
            activeOpacity={0.7}
          >
            <View style={styles.pointDotGreen} />
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>
                {t('PICKUP LOCATION', 'পিকআপ লোকেশন')}
              </Text>
              <Text style={styles.addressValue} numberOfLines={1}>
                {recipientData.senderAddress}
              </Text>
            </View>
            <PickIcon name="chevron-right" size={16} color="#A1A1AA" />
          </TouchableOpacity>

          <View style={styles.hairlineDivider} />

          <TouchableOpacity
            style={styles.addressRow}
            onPress={onOpenRecipient}
            activeOpacity={0.7}
          >
            <View style={styles.pointSquareBlack} />
            <View style={styles.addressInfo}>
              <Text style={styles.addressLabel}>
                {t('DELIVERY DESTINATION', 'ডেলিভারি লোকেশন')}
              </Text>
              <Text style={styles.addressValue} numberOfLines={1}>
                {recipientData.recipientAddress}
              </Text>
            </View>
            <PickIcon name="chevron-right" size={16} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('Parcel Details', 'পার্সেলের বিবরণ')}
          </Text>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.navRow}
            onPress={onOpenPackageDetails}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Text style={styles.navRowTitle}>
                {t('Package Information', 'প্যাকেজের তথ্য')}
              </Text>
              <Text style={styles.navRowSub}>
                {packageData.categoryName} • {packageData.weight}{' '}
                {t('kg', 'কেজি')}
              </Text>
            </View>
            <PickIcon name="chevron-right" size={16} color="#A1A1AA" />
          </TouchableOpacity>

          <View style={styles.hairlineDivider} />

          <TouchableOpacity
            style={styles.navRow}
            onPress={onOpenRecipient}
            activeOpacity={0.7}
          >
            <View style={styles.navRowLeft}>
              <Text style={styles.navRowTitle}>
                {t('Recipient Details', 'প্রাপকের তথ্য')}
              </Text>
              <Text style={styles.navRowSub}>
                {recipientData.recipientName} ({recipientData.recipientPhone})
              </Text>
            </View>
            <PickIcon name="chevron-right" size={16} color="#A1A1AA" />
          </TouchableOpacity>
        </View>

        {/* Vehicle Selection */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>
            {t('Select Vehicle', 'বাহন নির্বাচন করুন')}
          </Text>
        </View>

        <View style={styles.section}>
          {vehicles.map((vehicle, index) => {
            const isSelected = currentVehicle?.id === vehicle.id;
            const isLast = index === vehicles.length - 1;
            const name = isEn ? vehicle.nameEn : vehicle.name;
            const cap = isEn ? vehicle.capacityEn : vehicle.capacity;

            return (
              <React.Fragment key={vehicle.id}>
                <TouchableOpacity
                  style={[
                    styles.vehicleRow,
                    isSelected && styles.vehicleRowSelected,
                  ]}
                  onPress={() => setSelectedVehicleId(vehicle.id)}
                  activeOpacity={0.7}
                >
                  <PickIcon name={vehicle.icon} size={22} color="#09090B" />
                  <View style={styles.vehicleInfo}>
                    <Text style={styles.vehicleName}>{name}</Text>
                    <Text style={styles.vehicleCapacity}>
                      {cap} • {vehicle.eta}
                    </Text>
                  </View>
                  <Text style={styles.vehiclePrice}>৳{vehicle.price}</Text>
                </TouchableOpacity>
                {!isLast && <View style={styles.hairlineDivider} />}
              </React.Fragment>
            );
          })}
          {!vehiclesLoading && vehicles.length === 0 && (
            <Text style={styles.vehicleCapacity}>
              {t('Parcel delivery options are not configured', 'পার্সেল ডেলিভারি অপশন এখনো নেই')}
            </Text>
          )}
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
          onPress={() => currentVehicle && onOpenReview(currentVehicle)}
          disabled={!currentVehicle}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {currentVehicle
              ? `${t('Continue', 'এগিয়ে যান')} • ৳${currentVehicle.price}`
              : t('Continue', 'এগিয়ে যান')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    marginBottom: 20,
  },
  sectionHeaderRow: {
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  pointDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 12,
  },
  pointSquareBlack: {
    width: 8,
    height: 8,
    backgroundColor: '#09090B',
    marginRight: 12,
  },
  addressInfo: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '500',
    marginBottom: 2,
  },
  addressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E4E7',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  navRowLeft: {
    flex: 1,
  },
  navRowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#09090B',
    marginBottom: 2,
  },
  navRowSub: {
    fontSize: 13,
    color: '#71717A',
  },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  vehicleRowSelected: {
    backgroundColor: '#FAFAFA',
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: 14,
  },
  vehicleName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#09090B',
  },
  vehicleCapacity: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  vehiclePrice: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
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
