import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Header } from '../../components/common/Header';
import { IconName } from '../../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../../components/common/ScreenContainer';
import { useLanguage } from '../../context/LanguageContext';
import { PackageDetailsData } from './ParcelPackageDetailsScreen';
import { RecipientData } from './ParcelRecipientScreen';
import type { PaymentMethod, PaymentProvider } from '../../services/orders';

interface ParcelReviewScreenProps {
  onBack: () => void;
  onConfirmOrder: (paymentMethod: PaymentMethod) => void;
  paymentProviders: PaymentProvider[];
  packageData: PackageDetailsData;
  recipientData: RecipientData;
  vehicle: {
    id: string;
    name: string;
    price: number;
    eta: string;
    icon: IconName;
  };
}

export const ParcelReviewScreen: React.FC<ParcelReviewScreenProps> = ({
  onBack,
  onConfirmOrder,
  paymentProviders,
  packageData,
  recipientData,
  vehicle,
}) => {
  const { t } = useLanguage();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');

  const totalFare = vehicle.price;

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title="অর্ডার নিশ্চিতকরণ" onBack={onBack} />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: SYSTEM_INSETS.bottom + 84 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Route Details - Flat on background */}
        <Text style={styles.sectionHeading}>ডেলিভারি রুট</Text>
        <View style={styles.section}>
          <View style={styles.routeRow}>
            <View style={styles.pointDotGreen} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeRole}>পিকআপ</Text>
              <Text style={styles.routeAddress}>{recipientData.senderAddress}</Text>
              <Text style={styles.routeContact}>
                {recipientData.senderName} ({recipientData.senderPhone})
              </Text>
            </View>
          </View>

          <View style={styles.hairlineDivider} />

          <View style={styles.routeRow}>
            <View style={styles.pointSquareBlack} />
            <View style={styles.routeInfo}>
              <Text style={styles.routeRole}>ডেলিভারি</Text>
              <Text style={styles.routeAddress}>
                {recipientData.recipientAddress}
              </Text>
              <Text style={styles.routeContact}>
                {recipientData.recipientName} ({recipientData.recipientPhone})
              </Text>
            </View>
          </View>
        </View>

        {/* Package & Vehicle Summary */}
        <Text style={styles.sectionHeading}>পার্সেল ও বাহন</Text>
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>বাহন</Text>
            <Text style={styles.infoValue}>
              {vehicle.name} ({vehicle.eta})
            </Text>
          </View>
          <View style={styles.hairlineDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>প্যাকেজের ধরন</Text>
            <Text style={styles.infoValue}>{packageData.categoryName}</Text>
          </View>
          <View style={styles.hairlineDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ওজন</Text>
            <Text style={styles.infoValue}>{packageData.weight} কেজি</Text>
          </View>
        </View>

        {/* Fare Summary */}
        <Text style={styles.sectionHeading}>ভাড়ার বিবরণ</Text>
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ডেলিভারি চার্জ</Text>
            <Text style={styles.infoValue}>৳{vehicle.price}</Text>
          </View>
          <View style={styles.hairlineDivider} />
          <View style={styles.infoRow}>
            <Text style={styles.infoTotalLabel}>সর্বমোট</Text>
            <Text style={styles.infoTotalValue}>৳{totalFare}</Text>
          </View>
        </View>

        {/* Payment Method */}
        <Text style={styles.sectionHeading}>পেমেন্ট মেথড</Text>
        <View style={styles.section}>
          {paymentProviders.map((provider, index) => (
            <React.Fragment key={provider.id}>
              {index > 0 && <View style={styles.hairlineDivider} />}
              <TouchableOpacity
                style={styles.payOptionRow}
                onPress={() => setPaymentMethod(provider.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.payTitle}>{provider.name}</Text>
                <View style={styles.radioOuter}>
                  {paymentMethod === provider.id && <View style={styles.radioInner} />}
                </View>
              </TouchableOpacity>
            </React.Fragment>
          ))}
          {paymentProviders.length > 0 && <View style={styles.hairlineDivider} />}

          <TouchableOpacity
            style={styles.payOptionRow}
            onPress={() => setPaymentMethod('cod')}
            activeOpacity={0.7}
          >
            <Text style={styles.payTitle}>
              {t('Cash on Delivery', 'ক্যাশ অন ডেলিভারি')}
            </Text>
            <View style={styles.radioOuter}>
              {paymentMethod === 'cod' && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
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
          onPress={() => onConfirmOrder(paymentMethod)}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            অর্ডার নিশ্চিত করুন • ৳{totalFare}
          </Text>
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
    marginBottom: 8,
    marginTop: 10,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
  },
  pointDotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 12,
    marginTop: 5,
  },
  pointSquareBlack: {
    width: 8,
    height: 8,
    backgroundColor: '#09090B',
    marginRight: 12,
    marginTop: 5,
  },
  routeInfo: {
    flex: 1,
  },
  routeRole: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '500',
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
    marginBottom: 2,
  },
  routeContact: {
    fontSize: 12,
    color: '#71717A',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
  },
  infoLabel: {
    fontSize: 14,
    color: '#71717A',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  infoTotalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
  },
  infoTotalValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#09090B',
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E4E7',
  },
  payOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  payTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#09090B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#09090B',
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
