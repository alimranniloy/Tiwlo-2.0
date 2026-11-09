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
import { Header } from '../../components/common/Header';
import { ScreenContainer, SYSTEM_INSETS } from '../../components/common/ScreenContainer';
import { useLanguage } from '../../context/LanguageContext';

export interface RecipientData {
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderLatitude: number | null;
  senderLongitude: number | null;
  senderFloor: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientLatitude: number | null;
  recipientLongitude: number | null;
  recipientFloor: string;
  requirePin: boolean;
  whoPays: 'sender' | 'recipient';
  photoProof: boolean;
}

interface ParcelRecipientScreenProps {
  onBack: () => void;
  initialData?: RecipientData;
  onSave: (data: RecipientData) => void;
}

export const ParcelRecipientScreen: React.FC<ParcelRecipientScreenProps> = ({
  onBack,
  initialData,
  onSave,
}) => {
  const { t } = useLanguage();
  const [senderName, setSenderName] = useState(initialData?.senderName ?? '');
  const [senderPhone, setSenderPhone] = useState(initialData?.senderPhone ?? '');
  const [senderFloor, setSenderFloor] = useState(initialData?.senderFloor ?? '');
  const [recipientName, setRecipientName] = useState(initialData?.recipientName ?? '');
  const [recipientPhone, setRecipientPhone] = useState(initialData?.recipientPhone ?? '');
  const [recipientFloor, setRecipientFloor] = useState(initialData?.recipientFloor ?? '');
  const [requirePin, setRequirePin] = useState(initialData?.requirePin ?? true);

  const handleSave = () => {
    onSave({
      ...(initialData ?? {
        senderAddress: '',
        senderLatitude: null,
        senderLongitude: null,
        recipientAddress: '',
        recipientLatitude: null,
        recipientLongitude: null,
        whoPays: 'sender',
        photoProof: true,
      }),
      senderName: senderName.trim(),
      senderPhone: senderPhone.trim(),
      senderFloor: senderFloor.trim(),
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      recipientFloor: recipientFloor.trim(),
      requirePin,
    });
    onBack();
  };

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Recipient details', 'প্রাপকের তথ্য')} onBack={onBack} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SYSTEM_INSETS.bottom + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeading}>{t('SENDER', 'প্রেরক')}</Text>
        <Text style={styles.addressStatic}>
          {initialData?.senderAddress || t('Set your pickup pin on the map first.', 'আগে ম্যাপে পিকআপ পিন সেট করুন।')}
        </Text>
        <TextInput
          style={styles.input}
          value={senderName}
          onChangeText={setSenderName}
          placeholder={t('Sender name', 'প্রেরকের নাম')}
          placeholderTextColor="#A1A1AA"
        />
        <TextInput
          style={styles.input}
          value={senderPhone}
          onChangeText={setSenderPhone}
          placeholder={t('Phone number', 'মোবাইল নম্বর')}
          placeholderTextColor="#A1A1AA"
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          value={senderFloor}
          onChangeText={setSenderFloor}
          placeholder={t('Apartment / floor (optional)', 'ফ্ল্যাট / তলা নম্বর (ঐচ্ছিক)')}
          placeholderTextColor="#A1A1AA"
        />

        <Text style={[styles.sectionHeading, styles.recipientHeading]}>
          {t('RECIPIENT', 'প্রাপক')}
        </Text>
        <Text style={styles.addressStatic}>
          {initialData?.recipientAddress || t('Set the delivery destination pin on the map first.', 'আগে ম্যাপে ডেলিভারি পিন সেট করুন।')}
        </Text>
        <TextInput
          style={styles.input}
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder={t('Recipient name', 'প্রাপকের নাম')}
          placeholderTextColor="#A1A1AA"
        />
        <TextInput
          style={styles.input}
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          placeholder={t('Recipient phone number', 'প্রাপকের মোবাইল নম্বর')}
          placeholderTextColor="#A1A1AA"
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          value={recipientFloor}
          onChangeText={setRecipientFloor}
          placeholder={t('Apartment / floor (optional)', 'ফ্ল্যাট / তলা নম্বর (ঐচ্ছিক)')}
          placeholderTextColor="#A1A1AA"
        />

        <Text style={[styles.sectionHeading, styles.optionsHeading]}>
          {t('DELIVERY OPTIONS', 'ডেলিভারি অপশন')}
        </Text>
        <View style={styles.optionRow}>
          <View style={styles.optionCopy}>
            <Text style={styles.optionTitle}>
              {t('Delivery PIN', 'ডেলিভারি পিন')}
            </Text>
            <Text style={styles.optionSubtitle}>
              {t('Require a PIN for secure handover', 'নিরাপদ হস্তান্তরের জন্য পিন প্রয়োজন')}
            </Text>
          </View>
          <Switch
            value={requirePin}
            onValueChange={setRequirePin}
            thumbColor={requirePin ? '#09090B' : '#F4F4F5'}
            trackColor={{ false: '#E4E4E7', true: '#A1A1AA' }}
          />
        </View>
      </ScrollView>

      <View style={[styles.bottomBar, { paddingBottom: SYSTEM_INSETS.bottom + 16 }]}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSave} activeOpacity={0.85}>
          <Text style={styles.primaryButtonText}>{t('Save details', 'তথ্য সংরক্ষণ করুন')}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionHeading: {
    color: '#09090B',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  recipientHeading: {
    marginTop: 22,
  },
  optionsHeading: {
    marginTop: 24,
  },
  addressStatic: {
    color: '#71717A',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    color: '#09090B',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  optionRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
  },
  optionCopy: {
    flex: 1,
    paddingRight: 12,
  },
  optionTitle: {
    color: '#09090B',
    fontSize: 14,
    fontWeight: '600',
  },
  optionSubtitle: {
    color: '#71717A',
    fontSize: 12,
    marginTop: 4,
  },
  bottomBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
  },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
