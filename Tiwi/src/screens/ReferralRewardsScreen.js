import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function ReferralRewardsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [copied, setCopied] = useState(false);
  const [points, setPoints] = useState(0);
  const [invitedFriends, setInvitedFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refCode = currentUser?.tiwiId || `TIW-${String(currentUser?.id || '8192').padStart(5, '0')}`;
  const referralLink = `${API_BASE_URL}/join?ref=${refCode}`;

  const fetchReferralData = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/referrals?userId=${userId || ''}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        setPoints(typeof data.points === 'number' ? data.points : 0);
        setInvitedFriends(Array.isArray(data.invitedFriends) ? data.invitedFriends : []);
      } else {
        setPoints(0);
        setInvitedFriends([]);
      }
    } catch {
      setPoints(0);
      setInvitedFriends([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, currentUser?.user_id]);

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on Tiwi—the high-performance social platform for creators! Use my invite link: ${referralLink}`,
        url: referralLink,
      });
    } catch {
      // ignore
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRedeem = async (rewardName, cost) => {
    if (points < cost) {
      Alert.alert('Insufficient Points', `You need ${cost} points to claim ${rewardName}. Invite more creators to earn points!`);
      return;
    }

    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/referrals/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, rewardName, cost }),
      });

      if (res.ok) {
        setPoints((prev) => Math.max(0, prev - cost));
        Alert.alert('Reward Claimed!', `You successfully redeemed ${rewardName}. Check your profile for confirmation.`);
      } else {
        Alert.alert('Redemption Failed', 'Could not process reward redemption at this time.');
      }
    } catch {
      Alert.alert('Error', 'Network error. Please try again.');
    }
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Referral & Rewards</Text>
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
              fetchReferralData();
            }}
            tintColor={theme.primary || COLORS.primary}
          />
        }
      >
        {/* Points Banner */}
        <View style={[styles.pointsCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Text style={[styles.pointsLabel, { color: theme.textSecondary }]}>REWARD POINTS BALANCE</Text>
          <Text style={[styles.pointsValue, { color: theme.text }]}>{points} pts</Text>
          <Text style={[styles.pointsSub, { color: theme.textSecondary }]}>
            Earn 150 points for every creator who joins Tiwi using your link
          </Text>
        </View>

        {/* Invite Link Card */}
        <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 18, marginBottom: 20 }]}>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Your Personal Invite Link</Text>
          <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
            Share this link with friends, creators, and colleagues
          </Text>

          <View style={[styles.linkBox, { backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.hex_F9FAFB, borderColor: theme.borderLight }]}>
            <Text style={[styles.linkUrlText, { color: theme.text }]} numberOfLines={1}>
              {referralLink}
            </Text>
            <TouchableOpacity onPress={handleCopy} style={styles.copyPill}>
              <Ionicons name={copied ? 'checkmark' : 'copy'} size={15} color={copied ? COLORS.hex_10B981 : (theme.primary || COLORS.primary)} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.shareBtn, { backgroundColor: theme.primary || COLORS.primary }]}
            onPress={handleShare}
            activeOpacity={0.85}
          >
            <Ionicons name="share-social-outline" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
            <Text style={styles.shareBtnText}>Share Invite Link</Text>
          </TouchableOpacity>
        </View>

        {/* Rewards Store */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>AVAILABLE REWARDS</Text>
        {[
          { name: '1-Month Tiwi Pro Plan', cost: 300, icon: 'sparkles', desc: 'AI tools, HD streaming, and verified reach' },
          { name: 'Exclusive Creator Merch Pack', cost: 800, icon: 'shirt-outline', desc: 'Official Tiwi hoodie, sticker pack, and pins' },
          { name: 'Featured Creator Spotlight', cost: 500, icon: 'megaphone-outline', desc: '24-hour spotlight on the Explore trending shelf' },
        ].map((rw, idx) => (
          <View
            key={`rw-${idx}`}
            style={[styles.rewardCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
          >
            <View style={[styles.rewardIconWrap, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}>
              <Ionicons name={rw.icon} size={22} color={theme.primary || COLORS.primary} />
            </View>

            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={[styles.rewardName, { color: theme.text }]}>{rw.name}</Text>
              <Text style={[styles.rewardDesc, { color: theme.textSecondary }]}>{rw.desc}</Text>
              <Text style={[styles.rewardCost, { color: theme.primary || COLORS.primary }]}>{rw.cost} pts</Text>
            </View>

            <TouchableOpacity
              style={[
                styles.claimBtn,
                { backgroundColor: points >= rw.cost ? (theme.primary || COLORS.primary) : (isDarkMode ? COLORS.hex_333333 : COLORS.hex_E5E7EB) },
              ]}
              onPress={() => handleRedeem(rw.name, rw.cost)}
              disabled={points < rw.cost}
              activeOpacity={0.8}
            >
              <Text style={[styles.claimBtnText, { color: points >= rw.cost ? COLORS.white : theme.textSecondary }]}>
                Claim
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Friends Joined */}
        <Text style={[styles.sectionHeading, { color: theme.textSecondary, marginTop: 16 }]}>
          FRIENDS JOINED ({invitedFriends.length})
        </Text>

        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color={theme.primary || COLORS.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Checking referrals...</Text>
          </View>
        ) : invitedFriends.length === 0 ? (
          <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <Ionicons name="people-outline" size={40} color={theme.textSecondary} style={{ marginBottom: 8 }} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No Referral Joins Yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
              Invite fellow creators to join Tiwi using your link above to earn 150 points per signup!
            </Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            {invitedFriends.map((f, fIdx) => (
              <View key={f.handle || `f-${fIdx}`}>
                <View style={styles.friendRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.friendName, { color: theme.text }]}>{f.name}</Text>
                    <Text style={[styles.friendHandle, { color: theme.textSecondary }]}>
                      {f.handle} • Joined {f.joinedAt || 'Recently'}
                    </Text>
                  </View>
                  <Text style={styles.pointsEarnedText}>{f.pointsEarned || '+150 pts'}</Text>
                </View>
                {fIdx < invitedFriends.length - 1 && (
                  <View style={[styles.divider, { backgroundColor: theme.borderLight }]} />
                )}
              </View>
            ))}
          </View>
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
  pointsCard: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    alignItems: 'center',
    marginBottom: 16,
  },
  pointsLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  pointsValue: {
    fontSize: 34,
    fontWeight: '800',
    marginVertical: 4,
  },
  pointsSub: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
    marginBottom: 14,
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  linkUrlText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  copyPill: {
    padding: 6,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
  },
  shareBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  rewardCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  rewardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  rewardName: {
    fontSize: 14,
    fontWeight: '700',
  },
  rewardDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  rewardCost: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  claimBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  claimBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '700',
  },
  friendHandle: {
    fontSize: 12,
    marginTop: 2,
  },
  pointsEarnedText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.hex_10B981,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 14,
  },
  centerContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 8,
    fontSize: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
});
