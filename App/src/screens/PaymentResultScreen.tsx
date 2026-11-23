import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Wallet,
  XCircle,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getInvoiceViewUrl } from '../services/tiwloAccount';
import { openInAppBrowserUrl } from '../services/tiwloIntegrity';
import { colors } from '../theme/tokens';

export interface PaymentResultPayload {
  status: 'success' | 'failed';
  amount?: string;
  currency?: string;
  invoiceId?: string;
  message?: string;
}

interface PaymentResultScreenProps {
  result: PaymentResultPayload;
  onBackToWallet: () => void;
  onRetryPayment: () => void;
}

export const PaymentResultScreen: React.FC<PaymentResultScreenProps> = ({
  result,
  onBackToWallet,
  onRetryPayment,
}) => {
  const insets = useSafeAreaInsets();
  const isSuccess = result.status === 'success';

  return (
    <View
      style={[
        styles.page,
        {
          paddingTop: Math.max(insets.top, 20) + 24,
          paddingBottom: Math.max(insets.bottom, 20) + 16,
        },
      ]}
    >
      <View style={styles.centerContent}>
        <View style={[styles.iconWrap, isSuccess ? styles.iconSuccessBg : styles.iconFailBg]}>
          {isSuccess ? (
            <CheckCircle2 size={38} strokeWidth={2} color={colors.primaryHover} />
          ) : (
            <XCircle size={38} strokeWidth={2} color={colors.danger} />
          )}
        </View>

        <Text style={styles.title}>
          {isSuccess ? 'Payment Successful' : 'Payment Failed'}
        </Text>
        <Text style={styles.desc}>
          {result.message ||
            (isSuccess
              ? 'Your Cloud Wallet credits have been updated automatically.'
              : 'The payment was cancelled or could not be completed. No credits were charged.')}
        </Text>

        <View style={styles.detailsList}>
          {result.amount ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={styles.detailVal}>
                {result.currency || 'USD'} {result.amount}
              </Text>
            </View>
          ) : null}

          {result.invoiceId ? (
            <>
              {result.amount ? <View style={styles.hairline} /> : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Invoice ID</Text>
                <Text selectable style={styles.detailVal}>
                  {result.invoiceId}
                </Text>
              </View>
            </>
          ) : null}

          <View style={styles.hairline} />
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <Text style={[styles.detailVal, isSuccess ? styles.textSuccess : styles.textDanger]}>
              {isSuccess ? 'Credited' : 'Failed / Cancelled'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.footerActions}>
        {isSuccess && result.invoiceId ? (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => void openInAppBrowserUrl(getInvoiceViewUrl(result.invoiceId!))}
            activeOpacity={0.85}
          >
            <ExternalLink size={17} strokeWidth={2} color={colors.foreground} />
            <Text style={styles.secondaryBtnText}>Open Invoice</Text>
          </TouchableOpacity>
        ) : null}

        {!isSuccess ? (
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={onRetryPayment}
            activeOpacity={0.85}
          >
            <RotateCcw size={17} strokeWidth={2} color={colors.ink} />
            <Text style={styles.primaryBtnText}>Try Payment Again</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={isSuccess ? styles.primaryBtn : styles.secondaryBtn}
          onPress={onBackToWallet}
          activeOpacity={0.85}
        >
          <Wallet size={17} strokeWidth={2} color={isSuccess ? colors.ink : colors.foreground} />
          <Text style={isSuccess ? styles.primaryBtnText : styles.secondaryBtnText}>
            Back to Cloud Wallet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  iconSuccessBg: {
    backgroundColor: colors.primarySoft,
  },
  iconFailBg: {
    backgroundColor: colors.dangerSoft,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  desc: {
    fontSize: 13.5,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
  detailsList: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    gap: 10,
    marginTop: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailLabel: {
    fontSize: 13,
    color: colors.muted,
  },
  detailVal: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.foreground,
  },
  textSuccess: {
    color: colors.primaryHover,
  },
  textDanger: {
    color: colors.danger,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  footerActions: {
    gap: 10,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
    color: colors.ink,
  },
  secondaryBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: colors.foreground,
  },
});
