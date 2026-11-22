import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Header } from '../components/common/Header';
import { PickIcon } from '../components/common/PickIcon';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';
import { useLanguage } from '../context/LanguageContext';
import { PickAccountDisabledError, PickUser } from '../services/auth';
import {
  fetchPickSessions,
  PickSessionItem,
  PickSessionsSummary,
  revokeOtherPickSessions,
  revokePickSession,
} from '../services/sessions';

interface SessionsScreenProps {
  onBack: () => void;
  onAccountDisabled?: (user: PickUser) => void;
}

type FilterKind = 'all' | 'mobile' | 'desktop';

function formatDate(iso: string | null, isEn: boolean): string {
  if (!iso) return isEn ? 'Unknown' : 'অজানা';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return isEn ? 'Unknown' : 'অজানা';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelative(iso: string | null, isEn: boolean): string {
  if (!iso) return isEn ? 'Active' : 'সক্রিয়';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return isEn ? 'Active now' : 'এখনই সক্রিয়';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ${isEn ? 'ago' : 'আগে'}`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ${isEn ? 'ago' : 'আগে'}`;
  return `${Math.floor(diffSec / 86400)}d ${isEn ? 'ago' : 'আগে'}`;
}

export const SessionsScreen: React.FC<SessionsScreenProps> = ({
  onBack,
  onAccountDisabled,
}) => {
  const { language, t } = useLanguage();
  const isEn = language === 'en';
  const [sessions, setSessions] = useState<PickSessionItem[]>([]);
  const [summary, setSummary] = useState<PickSessionsSummary>({
    total: 0,
    mobileCount: 0,
    desktopCount: 0,
    uniqueIpCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingKey, setRevokingKey] = useState('');
  const [filter, setFilter] = useState<FilterKind>('all');
  const [error, setError] = useState('');

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const data = await fetchPickSessions();
      setSessions(data.sessions);
      setSummary(data.summary);
    } catch (err) {
      if (err instanceof PickAccountDisabledError && onAccountDisabled) {
        onAccountDisabled(err.user);
        return;
      }
      setError(err instanceof Error
        ? err.message
        : t('Could not load active sessions.', 'সক্রিয় সেশন লোড করা যায়নি।'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onAccountDisabled, t]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const handleRevokeOne = (session: PickSessionItem) => {
    Alert.alert(
      t('Sign out device?', 'এই ডিভাইস সাইন আউট করবেন?'),
      t(
        `End session on ${session.device || session.deviceName}?`,
        `${session.device || session.deviceName} থেকে সেশন বন্ধ করবেন?`
      ),
      [
        { text: t('Cancel', 'বাতিল'), style: 'cancel' },
        {
          text: t('Sign out', 'সাইন আউট'),
          style: 'destructive',
          onPress: () => {
            setRevokingKey(session.id);
            void revokePickSession(session.id)
              .then((data) => {
                setSessions(data.sessions);
                setSummary(data.summary);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error
                  ? err.message
                  : t('Could not sign out device.', 'ডিভাইস সাইন আউট করা যায়নি।'));
              })
              .finally(() => setRevokingKey(''));
          },
        },
      ]
    );
  };

  const handleRevokeOthers = () => {
    Alert.alert(
      t('Sign out all other devices?', 'অন্য সব ডিভাইস সাইন আউট করবেন?'),
      t(
        'Every other phone and web browser session will be signed out immediately.',
        'এই ডিভাইস ছাড়া অন্য সব ফোন ও ব্রাউজার থেকে সেশন বন্ধ হয়ে যাবে।'
      ),
      [
        { text: t('Cancel', 'বাতিল'), style: 'cancel' },
        {
          text: t('Sign out all', 'সব সাইন আউট'),
          style: 'destructive',
          onPress: () => {
            setRevokingKey('others');
            void revokeOtherPickSessions()
              .then((data) => {
                setSessions(data.sessions);
                setSummary(data.summary);
              })
              .catch((err: unknown) => {
                setError(err instanceof Error
                  ? err.message
                  : t('Could not revoke other sessions.', 'অন্য সেশনগুলো বন্ধ করা যায়নি।'));
              })
              .finally(() => setRevokingKey(''));
          },
        },
      ]
    );
  };

  const filteredSessions = useMemo(() => {
    if (filter === 'all') return sessions;
    return sessions.filter((item) => item.platform === filter);
  }, [sessions, filter]);

  const hasOthers = sessions.some((item) => !item.isCurrent);

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <Header title={t('Logged-in Devices', 'লগইন করা ডিভাইস')} onBack={onBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: SYSTEM_INSETS.bottom + 28 },
        ]}
      >
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.total}</Text>
            <Text style={styles.summaryLabel}>{t('Active', 'সক্রিয়')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.mobileCount}</Text>
            <Text style={styles.summaryLabel}>{t('Mobile', 'মোবাইল')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.desktopCount}</Text>
            <Text style={styles.summaryLabel}>{t('Web', 'ওয়েব')}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{summary.uniqueIpCount}</Text>
            <Text style={styles.summaryLabel}>{t('IPs', 'আইপি')}</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {(
            [
              { id: 'all', label: t('All', 'সবগুলো') },
              { id: 'mobile', label: t('Mobile', 'মোবাইল') },
              { id: 'desktop', label: t('Web', 'ওয়েব') },
            ] as { id: FilterKind; label: string }[]
          ).map((chip) => {
            const active = filter === chip.id;
            return (
              <TouchableOpacity
                key={chip.id}
                onPress={() => setFilter(chip.id)}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {hasOthers && (
          <TouchableOpacity
            style={styles.revokeAllBtn}
            disabled={revokingKey === 'others'}
            onPress={handleRevokeOthers}
          >
            {revokingKey === 'others' ? (
              <ActivityIndicator size="small" color="#DC2626" />
            ) : (
              <Text style={styles.revokeAllText}>
                {t('Sign out all other devices', 'অন্য সব ডিভাইস থেকে সাইন আউট করুন')}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {Boolean(error) && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color="#111111" />
            <Text style={styles.mutedText}>
              {t('Loading devices and IPs…', 'ডিভাইস ও আইপি তথ্য লোড হচ্ছে…')}
            </Text>
          </View>
        ) : filteredSessions.length === 0 ? (
          <View style={styles.centerBox}>
            <Text style={styles.emptyTitle}>
              {t('No matching active sessions', 'কোনো সক্রিয় সেশন পাওয়া যায়নি')}
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {filteredSessions.map((session) => (
              <View key={session.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.iconCircle}>
                    <PickIcon
                      name={session.platform === 'mobile' ? 'phone' : 'business'}
                      size={18}
                      color="#111827"
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.titleRow}>
                      <Text style={styles.deviceTitle} numberOfLines={2}>
                        {session.device || session.deviceName}
                      </Text>
                    </View>
                    <View style={styles.badgeRow}>
                      {session.isCurrent && (
                        <View style={styles.currentBadge}>
                          <Text style={styles.currentBadgeText}>
                            {t('This device', 'এই ডিভাইস')}
                          </Text>
                        </View>
                      )}
                      {Boolean(session.appName) && (
                        <View style={styles.appBadge}>
                          <Text style={styles.appBadgeText}>{session.appName}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.metaText}>
                      IP: {session.ip || 'Unknown IP'}
                    </Text>
                    <Text style={styles.metaText}>
                      {formatRelative(session.lastActiveAt || session.createdAt, isEn)} ·{' '}
                      {t('Signed in', 'লগইন')}: {formatDate(session.createdAt, isEn)}
                    </Text>
                  </View>
                </View>

                {!session.isCurrent && (
                  <TouchableOpacity
                    style={styles.revokeOneBtn}
                    disabled={revokingKey === session.id}
                    onPress={() => handleRevokeOne(session)}
                  >
                    {revokingKey === session.id ? (
                      <ActivityIndicator size="small" color="#DC2626" />
                    ) : (
                      <Text style={styles.revokeOneText}>
                        {t('Sign out this device', 'এই ডিভাইস সাইন আউট করুন')}
                      </Text>
                    )}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 14,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  summaryLabel: {
    marginTop: 2,
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  revokeAllBtn: {
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    marginBottom: 14,
  },
  revokeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  errorBox: {
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
  },
  centerBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  mutedText: {
    fontSize: 13,
    color: '#6B7280',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 14,
    gap: 10,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  currentBadge: {
    backgroundColor: '#DCFCE7',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803D',
  },
  appBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  appBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  metaText: {
    fontSize: 12,
    color: '#6B7280',
  },
  revokeOneBtn: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 10,
    alignItems: 'center',
  },
  revokeOneText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
});
