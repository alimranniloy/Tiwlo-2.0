import React from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Header } from '../components/common/Header';
import { BottomNav } from '../components/common/BottomNav';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import type { PaymentProvider } from '../services/orders';

interface WalletScreenProps {
  onBack: () => void;
  onTabPress: (tab: string) => void;
  paymentProviders: PaymentProvider[];
  paymentProvidersLoading: boolean;
}

export const WalletScreen: React.FC<WalletScreenProps> = ({
  onBack,
  onTabPress,
  paymentProviders,
  paymentProvidersLoading,
}) => {
  const { t } = useLanguage();

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Wallet', 'ওয়ালেট')} onBack={onBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: SYSTEM_INSETS.bottomNavPadding + 20 },
        ]}
      >
        {/* Balance Display */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>
            {t('Total Balance', 'মোট ব্যালেন্স')}
          </Text>
          <Text style={styles.balanceValue}>—</Text>

          {/* Primary Action Button */}
          <Text style={styles.methodDetails}>
            {t('Wallet service is not connected', 'ওয়ালেট সেবা এখনো সংযুক্ত নয়')}
          </Text>
        </View>

        {/* Tiwlo platform payment gateways available for PICK orders */}
        <Text style={styles.sectionHeading}>
          {t('Online payment methods', 'অনলাইন পেমেন্ট')}
        </Text>
        <View style={styles.section}>
          {paymentProvidersLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#09090B" />
            </View>
          ) : paymentProviders.length > 0 ? (
            paymentProviders.map((provider, index) => (
              <React.Fragment key={provider.id}>
                {index > 0 && <View style={styles.hairlineDivider} />}
                <View style={styles.methodRow}>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodName}>{provider.name}</Text>
                    <Text style={styles.methodDetails}>
                      {t('Available for PICK orders', 'PICK অর্ডারের জন্য চালু আছে')}
                    </Text>
                  </View>
                  <Text style={styles.currency}>{provider.currency}</Text>
                </View>
              </React.Fragment>
            ))
          ) : (
            <Text style={styles.methodDetails}>
              {t(
                'No online gateway is currently enabled for PICK orders',
                'PICK অর্ডারের জন্য এখন কোনো অনলাইন গেটওয়ে চালু নেই'
              )}
            </Text>
          )}
        </View>

        {/* Transactions */}
        <Text style={styles.sectionHeading}>
          {t('Recent Transactions', 'সাম্প্রতিক লেনদেন')}
        </Text>
        <View style={styles.section}>
          <Text style={styles.methodDetails}>
            {t('No wallet transactions are available', 'ওয়ালেটের কোনো লেনদেন নেই')}
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <BottomNav
        activeTab="wallet"
        onTabPress={onTabPress}
        onCenterPress={() => onTabPress('parcel')}
      />
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  balanceSection: {
    paddingBottom: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E4E4E7',
    marginBottom: 20,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#71717A',
    marginBottom: 4,
  },
  balanceValue: {
    fontSize: 34,
    fontWeight: '700',
    color: '#09090B',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  primaryButton: {
    height: 48,
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
  sectionHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: '#09090B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#E4E4E7',
    marginBottom: 20,
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  loadingContainer: {
    minHeight: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  methodInfo: {
    flex: 1,
    marginLeft: 12,
  },
  methodName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#09090B',
  },
  methodDetails: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  currency: {
    color: '#71717A',
    fontSize: 12,
    fontWeight: '600',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#09090B',
  },
  txDate: {
    fontSize: 12,
    color: '#71717A',
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#09090B',
  },
  txAmountCredit: {
    color: '#16A34A',
  },
  hairlineDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E4E4E7',
  },
});
