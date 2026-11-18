import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { resolveWebsiteUrl } from '../../config/siteConfig';
import { opsHubService } from '../../services/opsHubService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { Customer360Summary } from '../../types/opsHub';
import { formatRelativeTime } from '../../utils/formatters';
import {
  AnimatedListItem,
  BorderlessIconButton,
  FlatBadge,
  FlatInput,
  Hairline,
  MagicAvatar,
  MagicSpinner,
  NumberTicker,
  ShimmerButton,
  useMagicToast,
} from '../../components/magicui';
import type { OpsScreenProps } from './UnifiedInboxScreen';

type DirectoryFilterTab = 'all' | 'vip' | 'watchlist' | 'registered' | 'guests';

const FILTER_TABS: { id: DirectoryFilterTab; label: string }[] = [
  { id: 'all', label: 'All Customers' },
  { id: 'vip', label: 'VIP' },
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'registered', label: 'Registered' },
  { id: 'guests', label: 'Guests' },
];

function getSegmentBadge(segment: Customer360Summary['segment']): {
  label: string;
  tone: SemanticTone;
} {
  if (segment === 'vip') return { label: 'VIP', tone: 'accent' };
  if (segment === 'watchlist') return { label: 'Watchlist', tone: 'danger' };
  return { label: 'Standard', tone: 'neutral' };
}

export const CustomerDirectoryScreen: React.FC<OpsScreenProps> = ({
  onBack,
  onNavigateSubScreen,
}) => {
  const { tokens } = useAppTheme();
  const { toast } = useMagicToast();
  const showToast = toast.show;

  const [activeTab, setActiveTab] = useState<DirectoryFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<Customer360Summary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCustomers = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const apiSegment =
          activeTab === 'vip' || activeTab === 'watchlist' ? activeTab : 'all';
        const res = await opsHubService.listCustomers({
          q: searchQuery.trim() || undefined,
          segment: apiSegment,
        });
        setCustomers(res.customers || []);
      } catch (err) {
        if (!silent) {
          showToast({
            variant: 'danger',
            label: err instanceof Error ? err.message : 'Unable to load customer directory.',
          });
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab, searchQuery, showToast]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(false);
    }, 180);
    return () => clearTimeout(timer);
  }, [loadCustomers]);

  const displayedCustomers = useMemo(() => {
    if (activeTab === 'registered') {
      return customers.filter((c) => c.isRegistered);
    }
    if (activeTab === 'guests') {
      return customers.filter((c) => !c.isRegistered);
    }
    if (activeTab === 'vip') {
      return customers.filter((c) => c.segment === 'vip');
    }
    if (activeTab === 'watchlist') {
      return customers.filter((c) => c.segment === 'watchlist');
    }
    return customers;
  }, [activeTab, customers]);

  const stats = useMemo(() => {
    let vipCount = 0;
    let watchCount = 0;
    let openIssues = 0;
    for (const c of customers) {
      if (c.segment === 'vip') vipCount += 1;
      if (c.segment === 'watchlist') watchCount += 1;
      openIssues += Number(c.openTicketsCount || 0);
    }
    return {
      total: customers.length,
      vipCount,
      watchCount,
      openIssues,
    };
  }, [customers]);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: tokens.hairline }]}>
        <View style={styles.headerLeft}>
          <BorderlessIconButton
            name="arrow-left"
            size={20}
            onPress={onBack}
            accessibilityLabel="Back"
          />
          <View>
            <Text style={[styles.pageTitle, { color: tokens.text }]}>Customer 360 Directory</Text>
            <Text style={[styles.subtitle, { color: tokens.textMuted }]}>
              {`${displayedCustomers.length} profiles · unified ticket & chat history`}
            </Text>
          </View>
        </View>

        <ShimmerButton
          label="+ Ticket"
          size="xs"
          variant="subtle"
          onPress={() => onNavigateSubScreen('create_ticket')}
        />
      </View>

      {/* Compact Flat KPI Strip */}
      <View style={[styles.kpiStrip, { borderBottomColor: tokens.hairline }]}>
        <View style={styles.kpiCell}>
          <NumberTicker value={stats.total} style={[styles.kpiValue, { color: tokens.text }]} />
          <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>Customers</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: tokens.hairline }]} />
        <View style={styles.kpiCell}>
          <NumberTicker value={stats.vipCount} style={[styles.kpiValue, { color: tokens.accent }]} />
          <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>VIP</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: tokens.hairline }]} />
        <View style={styles.kpiCell}>
          <NumberTicker
            value={stats.watchCount}
            style={[styles.kpiValue, { color: tokens.danger }]}
          />
          <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>Watchlist</Text>
        </View>
        <View style={[styles.kpiDivider, { backgroundColor: tokens.hairline }]} />
        <View style={styles.kpiCell}>
          <NumberTicker
            value={stats.openIssues}
            style={[styles.kpiValue, { color: tokens.warning }]}
          />
          <Text style={[styles.kpiLabel, { color: tokens.textMuted }]}>Open Tickets</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <FlatInput
          placeholder="Search customer name, email, phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon={<Feather name="search" size={15} color={tokens.textMuted} />}
          rightSlot={
            searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Feather name="x" size={15} color={tokens.textMuted} />
              </TouchableOpacity>
            ) : undefined
          }
        />
      </View>

      {/* Filter Tabs */}
      <View style={[styles.tabBarWrap, { borderBottomColor: tokens.hairline }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarScroll}
        >
          {FILTER_TABS.map((t) => {
            const active = activeTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setActiveTab(t.id)}
                style={[
                  styles.tabItem,
                  active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 },
                ]}
              >
                <Text style={[styles.tabLabel, { color: active ? tokens.text : tokens.textMuted }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Customer Rows */}
      {loading && customers.length === 0 ? (
        <MagicSpinner label="Loading customer profiles..." />
      ) : (
        <FlatList
          data={displayedCustomers}
          keyExtractor={(item) => item.key}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={tokens.accent}
              onRefresh={() => {
                setRefreshing(true);
                loadCustomers(true);
              }}
            />
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <Hairline />}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Feather name="users" size={22} color={tokens.textMuted} />
              <Text style={[styles.emptyText, { color: tokens.textMuted }]}>
                No customer profiles match this segment filter.
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const seg = getSegmentBadge(item.segment);
            return (
              <AnimatedListItem index={index}>
                <TouchableOpacity
                  activeOpacity={0.68}
                  onPress={() =>
                    onNavigateSubScreen('customer_360', { customerKey: item.key })
                  }
                  style={styles.customerRow}
                >
                  <MagicAvatar
                    name={item.name || item.email || 'Customer'}
                    uri={resolveWebsiteUrl(item.avatar)}
                    size={38}
                  />

                  <View style={styles.rowBody}>
                    <View style={styles.rowTop}>
                      <View style={styles.nameCluster}>
                        <Text numberOfLines={1} style={[styles.nameText, { color: tokens.text }]}>
                          {item.name || 'Guest Customer'}
                        </Text>
                        <FlatBadge
                          label={seg.label}
                          tone={seg.tone}
                          withDot={item.segment !== 'standard'}
                        />
                        <FlatBadge
                          label={item.isRegistered ? 'Registered' : 'Guest'}
                          tone={item.isRegistered ? 'success' : 'neutral'}
                        />
                      </View>
                      <Feather name="chevron-right" size={16} color={tokens.textMuted} />
                    </View>

                    <Text numberOfLines={1} style={[styles.emailText, { color: tokens.textSecondary }]}>
                      {item.email || item.phone || item.key}
                    </Text>

                    <View style={styles.metricsRow}>
                      <View style={styles.countsGroup}>
                        <Text style={[styles.metricItem, { color: tokens.textMuted }]}>
                          {`Tickets: ${item.ticketsCount}`}
                        </Text>
                        <Text
                          style={[
                            styles.metricItem,
                            {
                              color:
                                item.openTicketsCount > 0 ? tokens.warning : tokens.textMuted,
                              fontWeight: item.openTicketsCount > 0 ? '700' : '500',
                            },
                          ]}
                        >
                          {`Open: ${item.openTicketsCount}`}
                        </Text>
                        <Text style={[styles.metricItem, { color: tokens.textMuted }]}>
                          {`Chats: ${item.chatsCount}`}
                        </Text>
                      </View>

                      <Text style={[styles.activeTime, { color: tokens.textMuted }]}>
                        {formatRelativeTime(item.lastActivityAt)}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              </AnimatedListItem>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pageTitle: {
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  kpiStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  kpiCell: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  kpiDivider: {
    width: 1,
    height: 24,
  },
  kpiValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '500',
  },
  searchWrap: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 8,
  },
  tabBarWrap: {
    borderBottomWidth: 1,
  },
  tabBarScroll: {
    paddingHorizontal: 18,
    gap: 16,
  },
  tabItem: {
    paddingVertical: 9,
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 11,
    paddingVertical: 12,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  nameCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
  emailText: {
    fontSize: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    gap: 8,
  },
  countsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metricItem: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  activeTime: {
    fontSize: 11,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 42,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
