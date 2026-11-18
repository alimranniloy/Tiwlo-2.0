import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supportService } from '../../services/supportService';
import { useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import type { CustomerContextData } from '../../types/support';
import { formatShortDateTime } from '../../utils/formatters';
import { FlatBadge, FlatNotice, Hairline, MagicModalSheet, MagicSpinner } from '../../components/magicui';

interface CustomerContextSheetProps {
  visible: boolean;
  ticketId: string | null;
  customerLabel?: string;
  onClose: () => void;
}

type ContextTab = 'overview' | 'orders' | 'billing' | 'services' | 'security';

function pickStr(row: Record<string, unknown>, keys: string[], fallback = '—'): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      return String(val);
    }
  }
  return fallback;
}

export const CustomerContextSheet: React.FC<CustomerContextSheetProps> = ({
  visible,
  ticketId,
  customerLabel,
  onClose,
}) => {
  const { tokens } = useAppTheme();
  const [tab, setTab] = useState<ContextTab>('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState<CustomerContextData | null>(null);

  const load = useCallback(async () => {
    if (!ticketId) return;
    setLoading(true);
    setError('');
    try {
      const res = await supportService.getCustomerContext(ticketId);
      setData(res.context || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch customer context.');
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    if (visible && ticketId) {
      setTab('overview');
      load();
    }
  }, [visible, ticketId, load]);

  const user = data?.user;
  const riskLevel = String(data?.multiAccountRisk?.riskLevel || 'low').toLowerCase();
  const riskTone: SemanticTone =
    riskLevel === 'high' || riskLevel === 'critical'
      ? 'danger'
      : riskLevel === 'medium'
        ? 'warning'
        : 'success';

  const tabs: { id: ContextTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'orders', label: 'Orders' },
    { id: 'billing', label: 'Billing' },
    { id: 'services', label: 'Services' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <MagicModalSheet
      visible={visible}
      onClose={onClose}
      title="Customer 360 Context"
      subtitle={customerLabel ? `Read-only profile for ${customerLabel}` : 'Customer intelligence'}
    >
      {loading ? (
        <MagicSpinner label="Loading customer dossier..." />
      ) : error ? (
        <FlatNotice text={error} tone="danger" icon="alert-circle" />
      ) : !data ? (
        <Text style={[styles.empty, { color: tokens.textMuted }]}>No registered profile linked.</Text>
      ) : (
        <View style={styles.wrap}>
          {/* Flat Header Profile Info */}
          <View style={styles.profileRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, { color: tokens.text }]}>{user?.name || 'Guest Customer'}</Text>
              <Text style={[styles.meta, { color: tokens.textMuted }]}>{user?.email || 'No email'}</Text>
              {user?.phone ? (
                <Text style={[styles.meta, { color: tokens.textMuted }]}>{user.phone}</Text>
              ) : null}
            </View>
            <FlatBadge label={`Risk ${riskLevel.toUpperCase()}`} tone={riskTone} withDot />
          </View>

          <View style={styles.badgeLine}>
            {user?.tiwiId ? <FlatBadge label={`ID ${user.tiwiId}`} tone="accent" /> : null}
            {data.billingId ? <FlatBadge label={`Billing ${data.billingId}`} tone="neutral" /> : null}
            {user?.planName ? <FlatBadge label={user.planName} tone="success" /> : null}
          </View>

          <Hairline />

          {/* Underlined Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {tabs.map((t) => {
              const active = tab === t.id;
              return (
                <TouchableOpacity
                  key={t.id}
                  onPress={() => setTab(t.id)}
                  style={[styles.tabItem, active && { borderBottomColor: tokens.accent, borderBottomWidth: 2 }]}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: '600', color: active ? tokens.text : tokens.textMuted }}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Hairline />

          {tab === 'overview' ? (
            <View style={styles.list}>
              <View style={[styles.row, { borderBottomColor: tokens.hairline }]}>
                <Text style={[styles.rowKey, { color: tokens.textMuted }]}>Identity Verification</Text>
                <FlatBadge
                  label={user?.identityVerified ? 'Verified' : 'Pending'}
                  tone={user?.identityVerified ? 'success' : 'warning'}
                />
              </View>
              <View style={[styles.row, { borderBottomColor: tokens.hairline }]}>
                <Text style={[styles.rowKey, { color: tokens.textMuted }]}>Address Verification</Text>
                <FlatBadge
                  label={user?.addressVerified ? 'Verified' : 'Unverified'}
                  tone={user?.addressVerified ? 'success' : 'neutral'}
                />
              </View>
              <View style={[styles.row, { borderBottomColor: tokens.hairline }]}>
                <Text style={[styles.rowKey, { color: tokens.textMuted }]}>Account State</Text>
                <FlatBadge label={user?.isBanned ? 'Banned' : 'Active'} tone={user?.isBanned ? 'danger' : 'success'} />
              </View>
              {(data.multiAccountRisk?.signals || []).length > 0 ? (
                <View style={styles.signals}>
                  <Text style={[styles.sigTitle, { color: tokens.textSecondary }]}>RISK SIGNALS</Text>
                  {(data.multiAccountRisk?.signals || []).map((s, idx) => (
                    <Text key={idx} style={[styles.sigText, { color: tokens.textMuted }]}>{`• ${s}`}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {tab === 'orders' ? (
            <View style={styles.list}>
              {(data.orders || []).length === 0 ? (
                <Text style={[styles.empty, { color: tokens.textMuted }]}>No recent orders.</Text>
              ) : (
                (data.orders || []).map((ord, idx) => (
                  <View key={idx} style={[styles.flatRow, { borderBottomColor: tokens.hairline }]}>
                    <View style={styles.flatRowTop}>
                      <Text style={[styles.itemTitle, { color: tokens.text }]}>
                        #{pickStr(ord, ['orderNumber', 'id', 'code'], String(idx + 1))}
                      </Text>
                      <FlatBadge label={pickStr(ord, ['status', 'state'], 'recorded')} tone="accent" />
                    </View>
                    <Text style={[styles.meta, { color: tokens.textMuted }]}>
                      {`${pickStr(ord, ['total', 'amount'], '0')} ${pickStr(ord, ['currency'], 'USD')} · ${formatShortDateTime(pickStr(ord, ['createdAt'], ''))}`}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'billing' ? (
            <View style={styles.list}>
              {(data.invoices || []).length === 0 && (data.payments || []).length === 0 ? (
                <Text style={[styles.empty, { color: tokens.textMuted }]}>No invoices or payments.</Text>
              ) : (
                <>
                  {(data.invoices || []).map((inv, idx) => (
                    <View key={`inv-${idx}`} style={[styles.flatRow, { borderBottomColor: tokens.hairline }]}>
                      <View style={styles.flatRowTop}>
                        <Text style={[styles.itemTitle, { color: tokens.text }]}>
                          Invoice #{pickStr(inv, ['invoiceNumber', 'id'], String(idx + 1))}
                        </Text>
                        <FlatBadge label={pickStr(inv, ['status'], 'issued')} tone="success" />
                      </View>
                      <Text style={[styles.meta, { color: tokens.textMuted }]}>
                        {`${pickStr(inv, ['total', 'amount'], '0')} ${pickStr(inv, ['currency'], 'USD')} · ${formatShortDateTime(pickStr(inv, ['createdAt'], ''))}`}
                      </Text>
                    </View>
                  ))}
                  {(data.payments || []).map((pay, idx) => (
                    <View key={`pay-${idx}`} style={[styles.flatRow, { borderBottomColor: tokens.hairline }]}>
                      <View style={styles.flatRowTop}>
                        <Text style={[styles.itemTitle, { color: tokens.text }]}>
                          {pickStr(pay, ['gateway', 'method', 'provider'], 'Payment')}
                        </Text>
                        <FlatBadge label={pickStr(pay, ['status'], 'recorded')} tone="accent" />
                      </View>
                      <Text style={[styles.meta, { color: tokens.textMuted }]}>
                        {`${pickStr(pay, ['amount'], '0')} ${pickStr(pay, ['currency'], 'USD')} · ${formatShortDateTime(pickStr(pay, ['createdAt'], ''))}`}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : null}

          {tab === 'services' ? (
            <View style={styles.list}>
              {(data.stores || []).length === 0 && (data.services || []).length === 0 ? (
                <Text style={[styles.empty, { color: tokens.textMuted }]}>No stores or services.</Text>
              ) : (
                <>
                  {(data.stores || []).map((st, idx) => (
                    <View key={`st-${idx}`} style={[styles.flatRow, { borderBottomColor: tokens.hairline }]}>
                      <View style={styles.flatRowTop}>
                        <Text style={[styles.itemTitle, { color: tokens.text }]}>
                          {pickStr(st, ['name', 'storeName', 'domain'], 'Store')}
                        </Text>
                        <FlatBadge label={pickStr(st, ['status', 'plan'], 'active')} tone="success" />
                      </View>
                      <Text style={[styles.meta, { color: tokens.textMuted }]}>
                        {pickStr(st, ['domain', 'subdomain', 'slug'], '—')}
                      </Text>
                    </View>
                  ))}
                  {(data.services || []).map((svc, idx) => (
                    <View key={`svc-${idx}`} style={[styles.flatRow, { borderBottomColor: tokens.hairline }]}>
                      <View style={styles.flatRowTop}>
                        <Text style={[styles.itemTitle, { color: tokens.text }]}>
                          {pickStr(svc, ['name', 'planName', 'type'], 'Service')}
                        </Text>
                        <FlatBadge label={pickStr(svc, ['status'], 'active')} tone="accent" />
                      </View>
                      <Text style={[styles.meta, { color: tokens.textMuted }]}>
                        {`Renew: ${formatShortDateTime(pickStr(svc, ['expiresAt', 'renewsAt', 'updatedAt'], ''))}`}
                      </Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          ) : null}

          {tab === 'security' ? (
            <View style={styles.list}>
              {(data.activeSessions || []).length === 0 ? (
                <Text style={[styles.empty, { color: tokens.textMuted }]}>No active sessions.</Text>
              ) : (
                (data.activeSessions || []).map((sess, idx) => (
                  <View key={`sess-${idx}`} style={[styles.flatRow, { borderBottomColor: tokens.hairline }]}>
                    <View style={styles.flatRowTop}>
                      <Text style={[styles.itemTitle, { color: tokens.text }]}>
                        {pickStr(sess, ['ipAddress', 'ip'], 'Unknown IP')}
                      </Text>
                      <FlatBadge label={pickStr(sess, ['platform', 'device'], 'Session')} tone="neutral" />
                    </View>
                    <Text numberOfLines={2} style={[styles.meta, { color: tokens.textMuted }]}>
                      {pickStr(sess, ['userAgent', 'deviceName'], 'Client session')}
                    </Text>
                    <Text style={[styles.meta, { color: tokens.textMuted }]}>
                      {`Seen: ${formatShortDateTime(pickStr(sess, ['lastActiveAt', 'createdAt'], ''))}`}
                    </Text>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      )}
    </MagicModalSheet>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  empty: { fontSize: 12.5, textAlign: 'center', paddingVertical: 18 },
  profileRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 15.5, fontWeight: '700' },
  meta: { fontSize: 12 },
  badgeLine: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tabRow: { gap: 16 },
  tabItem: { paddingVertical: 7 },
  list: { gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  rowKey: { fontSize: 12.5, fontWeight: '500' },
  signals: { gap: 3, paddingTop: 8 },
  sigTitle: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
  sigText: { fontSize: 12 },
  flatRow: { paddingVertical: 10, borderBottomWidth: 1, gap: 3 },
  flatRowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { fontSize: 13.5, fontWeight: '600' },
});
