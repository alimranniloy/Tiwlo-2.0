import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function ParentalControlsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [screenTimeLimit, setScreenTimeLimit] = useState('1 Hour');
  const [strictContent, setStrictContent] = useState(true);
  const [restrictDMs, setRestrictDMs] = useState(true);
  const [nightQuietHours, setNightQuietHours] = useState(true);
  const [pairingPin, setPairingPin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchControls = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/parental-controls?userId=${userId || ''}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.controls) {
          setScreenTimeLimit(data.controls.screenTimeLimit || '1 Hour');
          setStrictContent(data.controls.strictContent ?? true);
          setRestrictDMs(data.controls.restrictDMs ?? true);
          setNightQuietHours(data.controls.nightQuietHours ?? true);
          setPairingPin(data.controls.pairingPin || null);
        }
      }
    } catch {
      // keep defaults
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, currentUser?.user_id]);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const saveControls = async (updated) => {
    try {
      const userId = currentUser?.id || currentUser?.user_id;
      await fetch(`${API_BASE_URL}/api/social/parental-controls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...updated }),
      });
    } catch {
      // silent
    }
  };

  const handleGenerateNewPin = async () => {
    const randomPin = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(100 + Math.random() * 900)}`;
    setPairingPin(randomPin);
    await saveControls({
      screenTimeLimit,
      strictContent,
      restrictDMs,
      nightQuietHours,
      pairingPin: randomPin,
    });
    Alert.alert('New Guardian PIN Generated', `Use code ${randomPin} to link guardian device.`);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('back')}
          style={styles.backBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Family Safety & Controls</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchControls();
            }}
            tintColor={theme.primary || COLORS.primary}
          />
        }
      >
        {/* Banner */}
        <View style={[styles.bannerCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Ionicons name="shield-half" size={32} color={theme.primary || COLORS.primary} style={{ marginBottom: 8 }} />
          <Text style={[styles.bannerTitle, { color: theme.text }]}>Teen Safety & Guardian Pairing</Text>
          <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
            Set healthy digital boundaries, restrict unsolicited messages, and supervise app activity.
          </Text>
        </View>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={theme.primary || COLORS.primary} />
          </View>
        ) : (
          <>
            {/* Daily Time Limit */}
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>DAILY SCREEN TIME LIMIT</Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16 }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Time Allowance</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                Tiwi app locks automatically once daily usage exceeds this duration
              </Text>

              <View style={styles.timePillsRow}>
                {['30 Mins', '1 Hour', '2 Hours', 'No Limit'].map((time) => (
                  <TouchableOpacity
                    key={time}
                    style={[
                      styles.timePill,
                      screenTimeLimit === time && { backgroundColor: theme.primary || COLORS.primary, borderColor: theme.primary || COLORS.primary },
                      screenTimeLimit !== time && { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, borderColor: theme.borderLight },
                    ]}
                    onPress={() => {
                      setScreenTimeLimit(time);
                      saveControls({ screenTimeLimit: time, strictContent, restrictDMs, nightQuietHours, pairingPin });
                    }}
                  >
                    <Text
                      style={[
                        styles.timePillText,
                        { color: screenTimeLimit === time ? COLORS.white : theme.text },
                      ]}
                    >
                      {time}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Content Restrictions */}
            <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginTop: 20 }]}>
              SAFETY RULES
            </Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.toggleTitle, { color: theme.text }]}>Restricted Content Mode</Text>
                  <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                    Blocks mature posts, graphic media, and unrated links
                  </Text>
                </View>
                <Switch
                  value={strictContent}
                  onValueChange={(val) => {
                    setStrictContent(val);
                    saveControls({ screenTimeLimit, strictContent: val, restrictDMs, nightQuietHours, pairingPin });
                  }}
                  trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.toggleTitle, { color: theme.text }]}>Block Stranger Direct Messages</Text>
                  <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                    Only mutual followers are permitted to initiate chats
                  </Text>
                </View>
                <Switch
                  value={restrictDMs}
                  onValueChange={(val) => {
                    setRestrictDMs(val);
                    saveControls({ screenTimeLimit, strictContent, restrictDMs: val, nightQuietHours, pairingPin });
                  }}
                  trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

              <View style={styles.toggleRow}>
                <View style={{ flex: 1, paddingRight: 12 }}>
                  <Text style={[styles.toggleTitle, { color: theme.text }]}>Nighttime Quiet Hours (10 PM - 7 AM)</Text>
                  <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
                    Mutes all push notifications and sounds during resting hours
                  </Text>
                </View>
                <Switch
                  value={nightQuietHours}
                  onValueChange={(val) => {
                    setNightQuietHours(val);
                    saveControls({ screenTimeLimit, strictContent, restrictDMs, nightQuietHours: val, pairingPin });
                  }}
                  trackColor={{ false: theme.borderLight, true: theme.primary || COLORS.primary }}
                  thumbColor={COLORS.white}
                />
              </View>
            </View>

            {/* Guardian Link */}
            <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginTop: 20 }]}>
              GUARDIAN PAIRING PIN
            </Text>
            <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Pair Guardian Device</Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                Share this verification PIN with a parent or legal guardian to link devices
              </Text>

              <View style={[styles.pinBox, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.inputBackground }]}>
                <Text style={[styles.pinText, { color: theme.primary || COLORS.primary }]}>
                  {pairingPin || 'NO PIN SET'}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.pinBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                onPress={handleGenerateNewPin}
                activeOpacity={0.85}
              >
                <Ionicons name="refresh" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                <Text style={styles.pinBtnText}>
                  {pairingPin ? 'Generate New PIN' : 'Generate Guardian PIN'}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  bannerCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    alignItems: 'center',
    textAlign: 'center',
  },
  bannerTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
    textAlign: 'center',
  },
  bannerSub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
    marginBottom: 14,
  },
  timePillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  timePill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  timePillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  toggleSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 16,
  },
  pinBox: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 12,
  },
  pinText: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 3,
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
  },
  pinBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
  },
});
