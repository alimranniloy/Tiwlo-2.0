import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowLeft, CheckCircle2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/tokens';

interface AccountPageShellProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  bannerMessage?: string;
  bannerTone?: 'success' | 'error' | 'info';
  children: React.ReactNode;
}

export const AccountPageShell: React.FC<AccountPageShellProps> = ({
  title,
  onBack,
  onRefresh,
  refreshing = false,
  bannerMessage,
  bannerTone = 'info',
  children,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.page}>
      {/* Clean shadcn Mobile Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 10) + 6 }]}>
        <TouchableOpacity
          style={styles.backTouch}
          onPress={onBack}
          accessibilityLabel="Go back"
          activeOpacity={0.75}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <ArrowLeft size={21} strokeWidth={2} color={colors.foreground} />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primaryHover}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        {bannerMessage ? (
          <View
            style={[
              styles.toastBox,
              bannerTone === 'error'
                ? styles.toastError
                : bannerTone === 'success'
                ? styles.toastSuccess
                : styles.toastInfo,
            ]}
          >
            <CheckCircle2
              size={16}
              strokeWidth={2}
              color={bannerTone === 'error' ? colors.danger : colors.primaryHover}
            />
            <Text
              style={[
                styles.toastText,
                bannerTone === 'error' && styles.toastTextError,
              ]}
            >
              {bannerMessage}
            </Text>
          </View>
        ) : null}

        {children}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 14,
    backgroundColor: colors.background,
    gap: 12,
  },
  backTouch: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 19,
    fontWeight: '700',
    color: colors.foreground,
    letterSpacing: -0.35,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 18,
    gap: 18,
  },
  toastBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  toastSuccess: {
    backgroundColor: colors.primarySoft,
  },
  toastError: {
    backgroundColor: colors.dangerSoft,
  },
  toastInfo: {
    backgroundColor: colors.surface,
  },
  toastText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: colors.foreground,
  },
  toastTextError: {
    color: colors.danger,
  },
});
