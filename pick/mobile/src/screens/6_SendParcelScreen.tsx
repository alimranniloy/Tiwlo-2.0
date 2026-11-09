import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Header } from '../components/common/Header';
import { IconName, PickIcon } from '../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import { PackageDetailsData } from './parcel/ParcelPackageDetailsScreen';
import { ParcelLocationKind } from './parcel/ParcelLocationPickerScreen';
import { RecipientData } from './parcel/ParcelRecipientScreen';
import { PARCEL_CATEGORIES } from './parcel/parcelCategories';

export interface VehicleOption {
  id: string;
  name: string;
  nameEn: string;
  price: number;
  eta: string;
  capacity: string;
  capacityEn: string;
  maxWeightKg: number;
  icon: IconName;
}

interface SendParcelScreenProps {
  onBack: () => void;
  onOpenLocation: (kind: ParcelLocationKind) => void;
  onOpenRecipient: () => void;
  onOpenReview: (vehicle: VehicleOption) => void;
  onPackageDataChange: (data: PackageDetailsData) => void;
  onWhoPaysChange: (whoPays: 'sender' | 'recipient') => void;
  vehicles: VehicleOption[];
  vehiclesLoading: boolean;
  packageData: PackageDetailsData;
  recipientData: RecipientData;
}

export const SendParcelScreen: React.FC<SendParcelScreenProps> = ({
  onBack,
  onOpenLocation,
  onOpenRecipient,
  onOpenReview,
  onPackageDataChange,
  onWhoPaysChange,
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
  const hasPickupPin =
    typeof recipientData.senderLatitude === 'number' &&
    typeof recipientData.senderLongitude === 'number';
  const hasDestinationPin =
    typeof recipientData.recipientLatitude === 'number' &&
    typeof recipientData.recipientLongitude === 'number';
  const canContinue =
    hasPickupPin &&
    hasDestinationPin &&
    recipientData.senderAddress.trim().length > 0 &&
    recipientData.recipientAddress.trim().length > 0 &&
    recipientData.recipientName.trim().length > 0 &&
    recipientData.recipientPhone.trim().length > 0 &&
    !!currentVehicle &&
    packageData.weight <= currentVehicle.maxWeightKg &&
    !vehiclesLoading;

  const updatePackage = (patch: Partial<PackageDetailsData>) => {
    onPackageDataChange({ ...packageData, ...patch });
  };

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Send a parcel', 'পার্সেল পাঠান')} onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SYSTEM_INSETS.bottom + 104 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>
          {t('Choose two map pins, add parcel details, and send it on its way.', 'দুটি ম্যাপ পিন সেট করে পার্সেলের তথ্য দিন।')}
        </Text>

        <View style={styles.routeCard}>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => onOpenLocation('pickup')}
            activeOpacity={0.75}
          >
            <View style={styles.routeMarkerPickup} />
            <View style={styles.locationCopy}>
              <Text style={styles.eyebrow}>{t('PICKUP', 'পিকআপ')}</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {recipientData.senderAddress || t('Choose pickup on map', 'ম্যাপে পিকআপ লোকেশন বাছুন')}
              </Text>
              <Text style={styles.pinLabel}>
                {hasPickupPin ? t('Map pin set', 'ম্যাপ পিন সেট') : t('Required · set pin on map', 'আবশ্যক · ম্যাপে পিন সেট করুন')}
              </Text>
            </View>
            <PickIcon name="map-pin" size={19} color={hasPickupPin ? '#047857' : '#6B7280'} />
          </TouchableOpacity>

          <View style={styles.routeConnector} />

          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => onOpenLocation('destination')}
            activeOpacity={0.75}
          >
            <View style={styles.routeMarkerDestination} />
            <View style={styles.locationCopy}>
              <Text style={styles.eyebrow}>{t('DELIVER TO', 'ডেলিভারি')}</Text>
              <Text style={styles.locationAddress} numberOfLines={2}>
                {recipientData.recipientAddress || t('Choose destination on map', 'ম্যাপে ডেলিভারি লোকেশন বাছুন')}
              </Text>
              <Text style={styles.pinLabel}>
                {hasDestinationPin ? t('Map pin set', 'ম্যাপ পিন সেট') : t('Required · set pin on map', 'আবশ্যক · ম্যাপে পিন সেট করুন')}
              </Text>
            </View>
            <PickIcon name="map-pin" size={19} color={hasDestinationPin ? '#047857' : '#6B7280'} />
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t('Package information', 'পার্সেলের তথ্য')}</Text>
          <Text style={styles.sectionSubtitle}>{t('What are you sending?', 'কী পাঠাচ্ছেন?')}</Text>
        </View>
        <View style={styles.card}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          >
            {PARCEL_CATEGORIES.map((category) => {
              const selected = packageData.categoryId === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  onPress={() => updatePackage({
                    categoryId: category.id,
                    categoryName: isEn ? category.en : category.bn,
                  })}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                    {isEn ? category.en : category.bn}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.divider} />

          <View style={styles.packageRow}>
            <View style={styles.packageText}>
              <Text style={styles.rowTitle}>{t('Estimated weight', 'আনুমানিক ওজন')}</Text>
              <Text style={styles.rowSubtitle}>{t('Up to the selected vehicle limit', 'নির্বাচিত বাহনের সীমার মধ্যে')}</Text>
            </View>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => updatePackage({ weight: Math.max(0.5, +(packageData.weight - 0.5).toFixed(1)) })}
              >
                <PickIcon name="minus" size={15} color="#111827" />
              </TouchableOpacity>
              <Text style={styles.weightValue}>{packageData.weight} kg</Text>
              <TouchableOpacity
                style={styles.stepButton}
                onPress={() => updatePackage({ weight: +(packageData.weight + 0.5).toFixed(1) })}
              >
                <PickIcon name="plus" size={15} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />
          <View style={styles.valueRow}>
            <Text style={styles.rowTitle}>{t('Declared value', 'পার্সেলের মূল্য')}</Text>
            <View style={styles.valueInputWrap}>
              <Text style={styles.currency}>৳</Text>
              <TextInput
                value={packageData.value > 0 ? String(packageData.value) : ''}
                onChangeText={(value) => updatePackage({ value: Number(value.replace(/[^\d]/g, '')) || 0 })}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#9CA3AF"
                style={styles.valueInput}
              />
            </View>
          </View>

          <View style={styles.divider} />
          <View style={styles.switchRow}>
            <View style={styles.packageText}>
              <Text style={styles.rowTitle}>{t('Handle with care', 'সাবধানে বহন করুন')}</Text>
              <Text style={styles.rowSubtitle}>{t('Mark as fragile or delicate', 'ভঙ্গুর বা সংবেদনশীল হলে নির্বাচন করুন')}</Text>
            </View>
            <Switch
              value={packageData.handleWithCare}
              onValueChange={(handleWithCare) => updatePackage({ handleWithCare })}
              thumbColor={packageData.handleWithCare ? '#111827' : '#F4F4F5'}
              trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
            />
          </View>

          <TextInput
            value={packageData.notes}
            onChangeText={(notes) => updatePackage({ notes })}
            placeholder={t('Instructions for the rider (optional)', 'রাইডারের জন্য নির্দেশনা (ঐচ্ছিক)')}
            placeholderTextColor="#9CA3AF"
            style={styles.notesInput}
            multiline
            maxLength={1000}
          />
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t('Recipient', 'প্রাপক')}</Text>
        </View>
        <TouchableOpacity style={styles.contactCard} onPress={onOpenRecipient} activeOpacity={0.75}>
          <View style={styles.contactIcon}>
            <PickIcon name="profile" size={20} color="#111827" />
          </View>
          <View style={styles.contactCopy}>
            <Text style={styles.rowTitle}>
              {recipientData.recipientName || t('Add recipient details', 'প্রাপকের তথ্য যোগ করুন')}
            </Text>
            <Text style={styles.rowSubtitle}>
              {recipientData.recipientPhone || t('Name and phone number required', 'নাম ও ফোন নম্বর আবশ্যক')}
            </Text>
          </View>
          <PickIcon name="chevron-right" size={19} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t('Who pays the delivery fare?', 'ডেলিভারি ভাড়া কে দেবেন?')}</Text>
        </View>
        <View style={styles.payerRow}>
          {(['sender', 'recipient'] as const).map((whoPays) => {
            const selected = recipientData.whoPays === whoPays;
            return (
              <TouchableOpacity
                key={whoPays}
                style={[styles.payerOption, selected && styles.payerOptionSelected]}
                onPress={() => onWhoPaysChange(whoPays)}
                activeOpacity={0.8}
              >
                <Text style={[styles.payerText, selected && styles.payerTextSelected]}>
                  {whoPays === 'sender' ? t('I will pay', 'আমি দেব') : t('Recipient pays', 'প্রাপক দেবেন')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionHeading}>
          <Text style={styles.sectionTitle}>{t('Choose a vehicle', 'বাহন নির্বাচন করুন')}</Text>
        </View>
        <View style={styles.vehicleCard}>
          {vehicles.map((vehicle, index) => (
            <React.Fragment key={vehicle.id}>
              {index > 0 && <View style={styles.divider} />}
              <TouchableOpacity
                style={[
                  styles.vehicleRow,
                  (currentVehicle?.id === vehicle.id) && styles.vehicleRowSelected,
                ]}
                onPress={() => setSelectedVehicleId(vehicle.id)}
                activeOpacity={0.75}
              >
                <View style={styles.vehicleIcon}>
                  <PickIcon name={vehicle.icon} size={22} color="#111827" />
                </View>
                <View style={styles.vehicleCopy}>
                  <Text style={styles.rowTitle}>{isEn ? vehicle.nameEn : vehicle.name}</Text>
                  <Text style={styles.rowSubtitle}>
                    {isEn ? vehicle.capacityEn : vehicle.capacity} · {vehicle.eta}
                  </Text>
                </View>
                <Text style={styles.price}>৳{vehicle.price}</Text>
                <View style={[
                  styles.vehicleRadio,
                  currentVehicle?.id === vehicle.id && styles.vehicleRadioSelected,
                ]}>
                  {currentVehicle?.id === vehicle.id && <View style={styles.vehicleRadioInner} />}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
          {!vehiclesLoading && vehicles.length === 0 && (
            <Text style={styles.emptyVehicles}>
              {t('Parcel delivery options are not available right now.', 'এখন পার্সেল ডেলিভারি অপশন পাওয়া যাচ্ছে না।')}
            </Text>
          )}
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: SYSTEM_INSETS.bottom + 14 }]}>
        {!canContinue && (
          <Text style={styles.continueHint}>
            {currentVehicle && packageData.weight > currentVehicle.maxWeightKg
              ? t('Choose a vehicle that supports this parcel weight.', 'এই ওজন বহন করতে পারে এমন বাহন বাছুন।')
              : t('Set both map pins and add recipient details to continue.', 'এগোতে দুইটি ম্যাপ পিন সেট করে প্রাপকের তথ্য দিন।')}
          </Text>
        )}
        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={() => currentVehicle && onOpenReview(currentVehicle)}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          <Text style={styles.continueText}>
            {currentVehicle
              ? `${t('Review order', 'অর্ডার দেখুন')} · ৳${currentVehicle.price}`
              : t('Review order', 'অর্ডার দেখুন')}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  intro: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  routeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    marginBottom: 24,
    shadowColor: '#111827',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  locationRow: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  routeMarkerPickup: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  routeMarkerDestination: {
    width: 10,
    height: 10,
    backgroundColor: '#111827',
  },
  routeConnector: {
    position: 'absolute',
    left: 20,
    top: 50,
    height: 68,
    borderLeftWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
  },
  locationCopy: {
    flex: 1,
  },
  eyebrow: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  locationAddress: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  pinLabel: {
    color: '#6B7280',
    fontSize: 11,
    marginTop: 4,
  },
  sectionHeading: {
    marginBottom: 10,
    marginTop: 2,
  },
  sectionTitle: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 22,
    shadowColor: '#111827',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  categoryList: {
    gap: 8,
    paddingBottom: 2,
  },
  categoryChip: {
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  categoryChipSelected: {
    backgroundColor: '#111827',
  },
  categoryText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryTextSelected: {
    color: '#FFFFFF',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E5E7EB',
    marginVertical: 14,
  },
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  packageText: {
    flex: 1,
    paddingRight: 10,
  },
  rowTitle: {
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightValue: {
    color: '#111827',
    fontSize: 13,
    fontWeight: '700',
    minWidth: 44,
    textAlign: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueInputWrap: {
    minWidth: 88,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 10,
  },
  currency: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  valueInput: {
    minWidth: 44,
    padding: 0,
    color: '#111827',
    fontSize: 14,
    textAlign: 'right',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notesInput: {
    minHeight: 46,
    borderRadius: 11,
    backgroundColor: '#F9FAFB',
    color: '#111827',
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginTop: 14,
  },
  contactCard: {
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 22,
    gap: 12,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactCopy: {
    flex: 1,
  },
  payerRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 22,
  },
  payerOption: {
    flex: 1,
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  payerOptionSelected: {
    borderColor: '#111827',
    backgroundColor: '#111827',
  },
  payerText: {
    color: '#4B5563',
    fontSize: 13,
    fontWeight: '600',
  },
  payerTextSelected: {
    color: '#FFFFFF',
  },
  vehicleCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  vehicleRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  vehicleRowSelected: {
    backgroundColor: '#F9FAFB',
  },
  vehicleIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleCopy: {
    flex: 1,
  },
  price: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },
  vehicleRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleRadioSelected: {
    borderColor: '#111827',
  },
  vehicleRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#111827',
  },
  emptyVehicles: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 19,
    paddingVertical: 18,
    textAlign: 'center',
  },
  bottomBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  continueHint: {
    color: '#6B7280',
    fontSize: 11,
    marginBottom: 8,
    textAlign: 'center',
  },
  continueButton: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  continueButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  continueText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
