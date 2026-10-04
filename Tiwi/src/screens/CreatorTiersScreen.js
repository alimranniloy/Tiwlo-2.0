import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';

import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function CreatorTiersScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('browse'); // 'browse' | 'manage'
  const [subscribedTierId, setSubscribedTierId] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Creator Tier Setup State
  const [tierName, setTierName] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [tierPerks, setTierPerks] = useState('');

  const fetchTiers = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/creator-tiers?userId=${currentUser?.id || ''}`);
      if (res.ok) {
        const data = await res.json();
        setTiers(Array.isArray(data.tiers) ? data.tiers : []);
      } else {
        setTiers([]);
      }
    } catch {
      setTiers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTiers();
  }, [currentUser?.id]);

  const handleSubscribe = (t) => {
    if (subscribedTierId === t.id) {
      Alert.alert('Manage Subscription', `You are currently subscribed to ${t.name}.`, [
        { text: 'Cancel Subscription', style: 'destructive', onPress: () => setSubscribedTierId(null) },
        { text: 'Keep Active', style: 'cancel' },
      ]);
    } else {
      setSubscribedTierId(t.id);
      Alert.alert(
        'Subscription Activated!',
        `Thank you for supporting this creator on ${t.name} for ${t.price}/${t.interval}.`
      );
    }
  };

  const handleCreateTier = () => {
    if (!tierName.trim() || !tierPrice.trim()) {
      Alert.alert('Required Fields', 'Please specify a tier name and monthly price.');
      return;
    }

    const perksArray = tierPerks
      .split('\n')
      .map((p) => p.trim())
      .filter(Boolean);

    const newTier = {
      id: `tier-${Date.now()}`,
      name: tierName.trim(),
      badgeColor: COLORS.hex_F59E0B,
      price: `$${tierPrice.replace('$', '').trim()}`,
      interval: 'month',
      subscribersCount: 0,
      perks: perksArray.length > 0 ? perksArray : ['Exclusive Subscriber Badge', 'Direct creator access'],
    };

    setTiers([...tiers, newTier]);
    setTierName('');
    setTierPrice('');
    setTierPerks('');
    setActiveTab('browse');
    Alert.alert('Tier Created', `Your custom tier "${newTier.name}" has been published.`);
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Creator Subscriptions</Text>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'browse' && styles.activeTabBtn]}
          onPress={() => setActiveTab('browse')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'browse' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'browse' && { fontWeight: '700' },
            ]}
          >
            Membership Tiers
          </Text>
          {activeTab === 'browse' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'manage' && styles.activeTabBtn]}
          onPress={() => setActiveTab('manage')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'manage' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'manage' && { fontWeight: '700' },
            ]}
          >
            Creator Studio
          </Text>
          {activeTab === 'manage' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'manage' ? (
          /* CREATOR STUDIO TIER CREATION */
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18 }]}>
            <View style={styles.studioHeaderRow}>
              <Ionicons name="sparkles" size={26} color={COLORS.hex_F59E0B} style={{ marginRight: 10 }} />
              <View>
                <Text style={[styles.studioTitle, { color: theme.text }]}>Add New Subscription Tier</Text>
                <Text style={[styles.studioSub, { color: theme.textSecondary }]}>
                  Monetize your audience with monthly recurring support
                </Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Tier Name</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Masterclass VIP Member"
              placeholderTextColor={theme.textSecondary}
              value={tierName}
              onChangeText={setTierName}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Monthly Price (USD)</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. 4.99"
              placeholderTextColor={theme.textSecondary}
              keyboardType="decimal-pad"
              value={tierPrice}
              onChangeText={setTierPrice}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>
              Perks (Enter one per line)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="Custom badge&#10;Private community chat&#10;Weekly video calls"
              placeholderTextColor={theme.textSecondary}
              value={tierPerks}
              onChangeText={setTierPerks}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.saveTierBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleCreateTier}
              activeOpacity={0.85}
            >
              <Ionicons name="card-outline" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.saveTierBtnText}>Publish Subscription Tier</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* BROWSE MEMBERSHIP TIERS */
          <>
            {/* Banner */}
            <View style={[styles.heroBanner, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
              <Text style={[styles.heroTitle, { color: theme.text }]}>Support Creators Directly</Text>
              <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
                Subscribe to get exclusive member-only badges, direct messaging priority, and private live room access.
              </Text>
            </View>

            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
                <Text style={{ marginTop: 12, color: theme.textSecondary, fontSize: 13 }}>Loading creator tiers...</Text>
              </View>
            ) : tiers.length === 0 ? (
              <View style={{ padding: 36, alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.borderLight, marginTop: 14 }}>
                <Ionicons name="diamond-outline" size={54} color={theme.textSecondary} style={{ opacity: 0.6, marginBottom: 12 }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 6 }}>No Creator Tiers Active</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 18 }}>
                  Create monthly supporter tiers to monetize your content and offer VIP community perks.
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: theme.primary || COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                  onPress={() => setActiveTab('manage')}
                >
                  <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 14 }}>Configure Tiers</Text>
                </TouchableOpacity>
              </View>
            ) : (
              tiers.map((t) => {
                const isSubscribed = subscribedTierId === t.id;
                return (
                  <View
                    key={t.id}
                    style={[
                      styles.tierCard,
                      { backgroundColor: theme.cardBg, borderColor: isSubscribed ? t.badgeColor : theme.borderLight },
                      t.isPopular && { borderWidth: 1.5, borderColor: theme.primary || COLORS.primary },
                    ]}
                  >
                    {t.isPopular && (
                      <View style={[styles.popularBadge, { backgroundColor: theme.primary || COLORS.primary }]}>
                        <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
                      </View>
                    )}

                    <View style={styles.tierTopRow}>
                      <View>
                        <Text style={[styles.tierName, { color: theme.text }]}>{t.name}</Text>
                        <Text style={[styles.tierSubCount, { color: theme.textSecondary }]}>
                          {t.subscribersCount} active subscribers
                        </Text>
                      </View>
                      <View style={styles.priceCol}>
                        <Text style={[styles.priceText, { color: theme.text }]}>{t.price}</Text>
                        <Text style={[styles.intervalText, { color: theme.textSecondary }]}>/{t.interval}</Text>
                      </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />

                    {/* Perks Checklist */}
                    <View style={styles.perksList}>
                      {(t.perks || []).map((p, pIdx) => (
                        <View key={`perk-${pIdx}`} style={styles.perkRow}>
                          <Ionicons name="checkmark-circle" size={16} color={t.badgeColor} style={{ marginRight: 8 }} />
                          <Text style={[styles.perkText, { color: theme.text }]}>{p}</Text>
                        </View>
                      ))}
                    </View>

                    {/* Subscribe / Manage Button */}
                    <TouchableOpacity
                      style={[
                        styles.subscribeBtn,
                        isSubscribed
                          ? { backgroundColor: isDarkMode ? COLORS.hex_1E293B : COLORS.hex_E2E8F0 }
                          : { backgroundColor: t.badgeColor },
                      ]}
                      onPress={() => handleSubscribe(t)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={isSubscribed ? 'checkmark-circle' : 'card-outline'}
                        size={17}
                        color={isSubscribed ? theme.text : COLORS.white}
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.subscribeBtnText,
                          { color: isSubscribed ? theme.text : COLORS.white },
                        ]}
                      >
                        {isSubscribed ? 'Active Member (Tap to Manage)' : `Join for ${t.price}/mo`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
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
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 13,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 48,
    height: 3,
    borderRadius: 2,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroBanner: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  tierCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    position: 'relative',
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    right: 18,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  popularBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tierTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tierName: {
    fontSize: 17,
    fontWeight: '700',
  },
  tierSubCount: {
    fontSize: 12,
    marginTop: 2,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 22,
    fontWeight: '800',
  },
  intervalText: {
    fontSize: 11,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  perksList: {
    marginBottom: 16,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  perkText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  subscribeBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  studioHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  studioTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  studioSub: {
    fontSize: 12,
    marginTop: 2,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 100,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
  },
  saveTierBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  saveTierBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
