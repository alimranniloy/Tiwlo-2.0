import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Feather } from '@expo/vector-icons';
import { WEBSITE_ORIGIN } from '../../config/siteConfig';
import {
  getIdentityReviewStatus,
  VerifiedStaffSession,
  verifyStaffAdminSession,
} from '../../services/authService';
import { useAppTheme } from '../../theme/ThemeContext';
import type { AuthUser } from '../../types/support';
import { ScreenContainer } from '../../components/common/ScreenContainer';
import {
  BlurFade,
  DotPattern,
  FlatBadge,
  FlatNotice,
  Hairline,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';

interface IdentityVerificationGateScreenProps {
  user: AuthUser;
  onVerified: (session: VerifiedStaffSession) => void;
  onLogout: () => void;
}

export const IdentityVerificationGateScreen: React.FC<IdentityVerificationGateScreenProps> = ({
  user,
  onVerified,
  onLogout,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const [status, setStatus] = useState<string | null>(user.identityReviewStatus || null);
  const [reason, setReason] = useState<string | null>(user.identityReviewReason || null);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const res = await getIdentityReviewStatus();
      setStatus(res.reviewStatus);
      setReason(res.reviewReason || null);
      if (res.identityVerified || !res.identityVerificationRequired) {
        const refreshed = await verifyStaffAdminSession();
        if (refreshed) {
          onVerified(refreshed);
          return;
        }
      }
      toast.show({
        variant: 'accent',
        label:
          res.reviewStatus === 'pending'
            ? 'Identity review is pending administrator confirmation.'
            : 'Complete biometric & ID verification to continue.',
      });
    } catch (err) {
      toast.show({
        variant: 'danger',
        label: err instanceof Error ? err.message : 'Unable to check verification status.',
      });
    } finally {
      setChecking(false);
    }
  }, [onVerified, toast]);

  useEffect(() => {
    checkStatus().catch(() => {});
  }, [checkStatus]);

  const handleLaunchBrowserFlow = async () => {
    await WebBrowser.openBrowserAsync(`${WEBSITE_ORIGIN}/verify`);
    await checkStatus();
  };

  const isPending = status === 'pending' || status === 'manual_review';

  return (
    <ScreenContainer applyTopInset applyBottomInset>
      <View style={styles.root}>
        <DotPattern height={160} glow />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <BlurFade delay={0} offset={8}>
            <View style={styles.topRow}>
              <FlatBadge
                label={isPending ? 'Pending Review' : 'Verification Required'}
                tone={isPending ? 'warning' : 'danger'}
                withDot
              />
              <Feather
                name={isPending ? 'clock' : 'user-check'}
                size={20}
                color={isPending ? tokens.warning : tokens.accent}
              />
            </View>
          </BlurFade>

          <BlurFade delay={60} offset={8}>
            <View style={styles.titleBlock}>
              <Text style={[styles.title, { color: tokens.text }]}>Identity Verification</Text>
              <Text style={[styles.desc, { color: tokens.textMuted }]}>
                Staff workspace access requires a confirmed identity check for{' '}
                <Text style={{ color: tokens.text, fontWeight: '600' }}>{user.email}</Text>.
              </Text>
            </View>
          </BlurFade>

          {reason ? <FlatNotice text={`Review note: ${reason}`} tone="warning" icon="alert-triangle" /> : null}

          <Hairline />

          <BlurFade delay={110} offset={8}>
            <View style={styles.statusList}>
              <Text style={[styles.metaLabel, { color: tokens.textMuted }]}>ACCOUNT STATUS</Text>
              <Text style={[styles.statusValue, { color: tokens.text }]}>
                {status ? status.replace(/_/g, ' ').toUpperCase() : 'UNVERIFIED'}
              </Text>
            </View>
          </BlurFade>

          <View style={styles.actionRow}>
            {!isPending ? (
              <ShimmerButton
                label="Verify Identity"
                size="md"
                onPress={handleLaunchBrowserFlow}
                leftIcon={<Feather name="shield" size={14} color={tokens.inkButtonText} />}
              />
            ) : null}

            <ShimmerButton
              label="Refresh"
              size="md"
              variant={isPending ? 'primary' : 'subtle'}
              loading={checking}
              onPress={checkStatus}
            />

            <TouchableOpacity onPress={onLogout} hitSlop={8}>
              <Text style={[styles.signOutLink, { color: tokens.danger }]}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: { gap: 6 },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  desc: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  statusList: { gap: 4 },
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.7,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
  },
  signOutLink: {
    fontSize: 13,
    fontWeight: '600',
  },
});
