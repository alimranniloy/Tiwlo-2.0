import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
} from 'react-native';
import { Header } from '../../components/common/Header';
import { ScreenContainer, SYSTEM_INSETS } from '../../components/common/ScreenContainer';

export interface RecipientData {
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  senderFloor: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
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
  const [senderName, setSenderName] = useState(
    initialData?.senderName ?? ''
  );
  const [senderPhone, setSenderPhone] = useState(
    initialData?.senderPhone ?? ''
  );
  const [senderFloor, setSenderFloor] = useState(
    initialData?.senderFloor ?? ''
  );
  const senderAddress =
    initialData?.senderAddress ?? '';

  const [recipientName, setRecipientName] = useState(
    initialData?.recipientName ?? ''
  );
  const [recipientPhone, setRecipientPhone] = useState(
    initialData?.recipientPhone ?? ''
  );
  const [recipientFloor, setRecipientFloor] = useState(
    initialData?.recipientFloor ?? ''
  );
  const recipientAddress =
    initialData?.recipientAddress ?? '';

  const [requirePin, setRequirePin] = useState(initialData?.requirePin ?? true);
  const [whoPays, setWhoPays] = useState<'sender' | 'recipient'>(
    initialData?.whoPays ?? 'sender'
  );

  const handleSave = () => {
    onSave({
      senderName,
      senderPhone,
      senderAddress,
      senderFloor,
      recipientName,
      recipientPhone,
      recipientAddress,
      recipientFloor,
      requirePin,
      whoPays,
      photoProof: true,
    });
    onBack();
  };

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title="প্রেরক ও প্রাপক" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SYSTEM_INSETS.bottom + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Sender Section */}
        <Text style={styles.sectionHeading}>প্রেরক (পিকআপ)</Text>
        <Text style={styles.addressStatic}>{senderAddress}</Text>

        <TextInput
          style={styles.input}
          value={senderName}
          onChangeText={setSenderName}
          placeholder="প্রেরকের নাম"
          placeholderTextColor="#A1A1AA"
        />
        <TextInput
          style={styles.input}
          value={senderPhone}
          onChangeText={setSenderPhone}
          placeholder="মোবাইল নম্বর"
          placeholderTextColor="#A1A1AA"
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          value={senderFloor}
          onChangeText={setSenderFloor}
          placeholder="ফ্ল্যাট / তলা নম্বর"
          placeholderTextColor="#A1A1AA"
        />

        {/* Recipient Section */}
        <Text style={[styles.sectionHeading, { marginTop: 24 }]}>
          প্রাপক (ডেলিভারি)
        </Text>
        <Text style={styles.addressStatic}>{recipientAddress}</Text>

        <TextInput
          style={styles.input}
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="প্রাপকের নাম"
          placeholderTextColor="#A1A1AA"
        />
        <TextInput
          style={styles.input}
          value={recipientPhone}
          onChangeText={setRecipientPhone}
          placeholder="প্রাপকের মোবাইল নম্বর"
          placeholderTextColor="#A1A1AA"
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          value={recipientFloor}
          onChangeText={setRecipientFloor}
          placeholder="ফ্ল্যাট / তলা নম্বর"
          placeholderTextColor="#A1A1AA"
        />

        {/* Delivery Options */}
        <Text style={[styles.sectionHeading, { marginTop: 24 }]}>
          ডেলিভারি অপশন
        </Text>

        <View style={styles.optionRow}>
          <Text style={styles.optionTitle}>ডেলিভারি পিন (নিরাপদ হস্তান্তর)</Text>
          <Switch
            value={requirePin}
            onValueChange={setRequirePin}
            thumbColor={requirePin ? '#09090B' : '#F4F4F5'}
            trackColor={{ false: '#E4E4E7', true: '#A1A1AA' }}
          />
        </View>

        <View style={styles.paymentSelectRow}>
          <Text style={styles.optionTitle}>ভাড়া প্রদানকারী</Text>
          <View style={styles.payToggle}>
            <TouchableOpacity
              style={[
                styles.payToggleBtn,
                whoPays === 'sender' && styles.payToggleBtnActive,
              ]}
              onPress={() => setWhoPays('sender')}
            >
              <Text
                style={[
                  styles.payToggleText,
                  whoPays === 'sender' && styles.payToggleTextActive,
                ]}
              >
                প্রেরক
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.payToggleBtn,
                whoPays === 'recipient' && styles.payToggleBtnActive,
              ]}
              onPress={() => setWhoPays('recipient')}
            >
              <Text
                style={[
                  styles.payToggleText,
                  whoPays === 'recipient' && styles.payToggleTextActive,
                ]}
              >
                প্রাপক
              </Text>
            </TouchableOpacity>
          </View>
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
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>সংরক্ষণ করুন</Text>
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
    fontSize: 14,
    fontWeight: '700',
    color: '#09090B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  addressStatic: {
    fontSize: 14,
    color: '#71717A',
    marginBottom: 12,
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#09090B',
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
  },
  paymentSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  optionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  payToggle: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F5',
    borderRadius: 6,
    padding: 3,
  },
  payToggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  payToggleBtnActive: {
    backgroundColor: '#09090B',
  },
  payToggleText: {
    fontSize: 13,
    color: '#71717A',
    fontWeight: '500',
  },
  payToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
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
