import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Clock,
  Globe,
  Laptop,
  LogOut,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react-native';
import { AccountPageShell } from '../components/AccountPageShell';
import type { TiwloUser } from '../services/tiwloAuth';
import {
  fetchActiveSessions,
  revokeAllOtherSessions,
  revokeSessionById,
  SessionRecord,
} from '../services/tiwloAccount';
import { colors } from '../theme/tokens';

interface ActiveSessionsScreenProps {
  user: TiwloUser | null;
  sessionToken?: string;
  onBack: () => void;
  onRequireAuth: () => void;
}

type SessionFilter = 'all' | 'mobile' | 'desktop';
const TIMEOUT_OPTIONS = ['15 min', '1 hour', '24 hours', '30 days'];

export const ActiveSessionsScreen: React.FC<ActiveSessionsScreenProps> = ({
  user,
  sessionToken,
  onBack,
  onRequireAuth,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [filter, setFilter] = useState<SessionFilter>('all');
  const [sessionTimeout, setSessionTimeout] = useState('24 hours');
  const [newDeviceAlerts, setNewDeviceAlerts] = useState(true);
  const [geoAnomalyLock, setGeoAnomalyLock] = useState(true);
  const [banner, setBanner] = useState('');
  const [bannerTone, setBannerTone] = useState<'success' | 'error' | 'info'>('info');

  const loadSessions = useCallback(async () => {
    if (!sessionToken && !user) return;
    setRefreshing(true);
    try {
      const res = await fetchActiveSessions(sessionToken);
      setSessions(res.sessions || []);
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Unable to load active sessions.');
    } finally {
      setRefreshing(false);
    }
  }, [sessionToken, user]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const handleRevoke = async (id: string) => {
    try {
      await revokeSessionById(id, sessionToken);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setBannerTone('success');
      setBanner('Session revoked.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not revoke session.');
    }
  };

  const handleRevokeAll = async () => {
    if (!user) {
      onRequireAuth();
      return;
    }
    try {
      await revokeAllOtherSessions(sessionToken);
      setSessions((prev) => prev.filter((s) => s.current || s.isCurrent));
      setBannerTone('success');
      setBanner('Signed out all other devices.');
    } catch (err) {
      setBannerTone('error');
      setBanner(err instanceof Error ? err.message : 'Could not clear other sessions.');
    }
  };

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'all') return true;
    const osText = `${s.os || ''} ${s.deviceName || ''}`.toLowerCase();
    const isMobile = /android|ios|iphone|ipad|mobile/.test(osText);
    return filter === 'mobile' ? isMobile : !isMobile;
  });

  const currentSession = sessions.find((s) => s.current || s.isCurrent);

  return (
    <AccountPageShell
      title="Active Sessions"
      onBack={onBack}
      onRefresh={() => void loadSessions()}
      refreshing={refreshing}
      bannerMessage={banner}
      bannerTone={bannerTone}
    >
      {/* Current Device Flat Row */}
      <View style={styles.currentDeviceRow}>
        <Smartphone size={20} strokeWidth={1.9} color={colors.primaryHover} />
        <View style={styles.flexOne}>
          <Text style={styles.deviceTitle}>
            {currentSession?.deviceName || 'Current Mobile Session'}
          </Text>
          <Text style={styles.deviceMeta}>
            {[
              currentSession?.os || 'Android',
              currentSession?.ip || 'Secured connection',
              currentSession?.location,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <View style={styles.activePill}>
          <Text style={styles.activePillText}>Current</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Filter & Revoke */}
      <View style={styles.toolbarRow}>
        <View style={styles.filterGroup}>
          {(['all', 'mobile', 'desktop'] as const).map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setFilter(f)}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>
                  {f === 'all' ? 'All' : f === 'mobile' ? 'Mobile' : 'Desktop'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.revokeAllBtn} onPress={() => void handleRevokeAll()}>
          <LogOut size={14} strokeWidth={2} color={colors.danger} />
          <Text style={styles.revokeAllText}>Revoke Others</Text>
        </TouchableOpacity>
      </View>

      {/* Sessions List */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Devices ({filteredSessions.length})</Text>

        {!user ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Sign in to view active device sessions.</Text>
            <TouchableOpacity style={styles.signInBtn} onPress={onRequireAuth}>
              <Text style={styles.signInBtnText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : filteredSessions.length === 0 ? (
          <Text style={styles.emptyText}>No matching sessions found.</Text>
        ) : (
          filteredSessions.map((sess, idx) => {
            const isMobile = /android|ios|iphone|mobile/i.test(`${sess.os || ''} ${sess.deviceName || ''}`);
            const isCurrent = sess.current || sess.isCurrent;
            return (
              <React.Fragment key={sess.id}>
                {idx > 0 ? <View style={styles.hairline} /> : null}
                <View style={styles.sessionRow}>
                  {isMobile ? (
                    <Smartphone size={18} strokeWidth={1.9} color={colors.foreground} />
                  ) : (
                    <Laptop size={18} strokeWidth={1.9} color={colors.foreground} />
                  )}

                  <View style={styles.flexOne}>
                    <View style={styles.sessionTopLine}>
                      <Text style={styles.sessionTitle} numberOfLines={1}>
                        {sess.deviceName || sess.browser || 'Authenticated Client'}
                      </Text>
                      {isCurrent ? (
                        <Text style={styles.currentLabel}>Current</Text>
                      ) : null}
                    </View>
                    <View style={styles.metaInline}>
                      <Globe size={12} strokeWidth={1.9} color={colors.muted} />
                      <Text style={styles.metaText}>{sess.ip || 'Private IP'}</Text>
                      {sess.location ? (
                        <>
                          <MapPin size={12} strokeWidth={1.9} color={colors.muted} />
                          <Text style={styles.metaText}>{sess.location}</Text>
                        </>
                      ) : null}
                      <Clock size={12} strokeWidth={1.9} color={colors.muted} />
                      <Text style={styles.metaText}>{sess.lastActiveAt || 'Recent'}</Text>
                    </View>
                  </View>

                  {!isCurrent ? (
                    <TouchableOpacity onPress={() => void handleRevoke(sess.id)}>
                      <Trash2 size={17} strokeWidth={1.9} color={colors.danger} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </React.Fragment>
            );
          })
        )}
      </View>

      <View style={styles.divider} />

      {/* Session Policies */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Session Timeout</Text>
        <View style={styles.timeoutGrid}>
          {TIMEOUT_OPTIONS.map((opt) => {
            const active = sessionTimeout === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.timeoutPill, active && styles.timeoutPillActive]}
                onPress={() => setSessionTimeout(opt)}
              >
                <Text style={[styles.timeoutText, active && styles.timeoutTextActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.hairline} />

        <View style={styles.switchRow}>
          <ShieldAlert size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.sessionTitle}>New Device Alerts</Text>
            <Text style={styles.deviceMeta}>Notify when a new device signs in</Text>
          </View>
          <Switch
            value={newDeviceAlerts}
            onValueChange={setNewDeviceAlerts}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.hairline} />

        <View style={styles.switchRow}>
          <ShieldCheck size={18} strokeWidth={1.9} color={colors.muted} />
          <View style={styles.flexOne}>
            <Text style={styles.sessionTitle}>Geo-Anomaly Verification</Text>
            <Text style={styles.deviceMeta}>Require extra check on rapid location change</Text>
          </View>
          <Switch
            value={geoAnomalyLock}
            onValueChange={setGeoAnomalyLock}
            trackColor={{ false: '#E4E4E7', true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>
      </View>
    </AccountPageShell>
  );
};

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  currentDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  deviceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.foreground,
  },
  deviceMeta: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  activePill: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  activePillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  toolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  filterGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 7,
  },
  filterPillActive: {
    backgroundColor: colors.background,
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  filterTextActive: {
    color: colors.foreground,
    fontWeight: '700',
  },
  revokeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.dangerSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  revokeAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.danger,
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.muted,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  sessionTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.foreground,
  },
  currentLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.primaryHover,
  },
  metaInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 3,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11.5,
    color: colors.muted,
    marginRight: 6,
  },
  timeoutGrid: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  timeoutPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  timeoutPillActive: {
    backgroundColor: colors.primary,
  },
  timeoutText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.muted,
  },
  timeoutTextActive: {
    color: colors.ink,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
    color: colors.muted,
  },
  signInBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  signInBtnText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: colors.ink,
  },
});
