import { applicationFetch as fetch } from '../services/graphqlTransport.js';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Share,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

export default function CreatorMediaKitScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'rates'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState({
    monthlyImpressions: '0',
    engagementRate: '0.0%',
    followersCount: 0,
    postsCount: 0,
  });
  const [packages, setPackages] = useState([]);
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [pkgTitle, setPkgTitle] = useState('');
  const [pkgPrice, setPkgPrice] = useState('');
  const [pkgDesc, setPkgDesc] = useState('');

  const fetchMediaKit = useCallback(async () => {
    try {
      setLoading(true);
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/creator-media-kit?userId=${userId || ''}`, {
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) setMetrics(data.metrics);
        setPackages(Array.isArray(data.packages) ? data.packages : []);
      } else {
        setMetrics({
          monthlyImpressions: '0',
          engagementRate: '0.0%',
          followersCount: currentUser?.followersCount || 0,
          postsCount: 0,
        });
        setPackages([]);
      }
    } catch {
      setMetrics({
        monthlyImpressions: '0',
        engagementRate: '0.0%',
        followersCount: currentUser?.followersCount || 0,
        postsCount: 0,
      });
      setPackages([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser?.id, currentUser?.user_id, currentUser?.followersCount]);

  useEffect(() => {
    fetchMediaKit();
  }, [fetchMediaKit]);

  const handleShareMediaKit = async () => {
    try {
      await Share.share({
        message: `Verified Creator Media Kit & Rates for ${currentUser?.name || 'Creator'}: ${API_BASE_URL}/@${currentUser?.handle || currentUser?.username || 'creator'}/mediakit`,
        title: `${currentUser?.name} - Tiwi Media Kit`,
      });
    } catch {
      // ignore
    }
  };

  const handleCreatePackage = async () => {
    if (!pkgTitle.trim() || !pkgPrice.trim()) {
      Alert.alert('Incomplete Form', 'Please provide a package title and price.');
      return;
    }

    try {
      const userId = currentUser?.id || currentUser?.user_id;
      const res = await fetch(`${API_BASE_URL}/api/social/creator-media-kit/packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: pkgTitle.trim(),
          price: pkgPrice.trim().startsWith('$') ? pkgPrice.trim() : `$${pkgPrice.trim()}`,
          description: pkgDesc.trim() || 'Custom creator deliverable.',
          icon: 'videocam',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newPkg = data.package || {
          id: `pkg-${Date.now()}`,
          title: pkgTitle.trim(),
          price: pkgPrice.trim().startsWith('$') ? pkgPrice.trim() : `$${pkgPrice.trim()}`,
          description: pkgDesc.trim() || 'Custom creator deliverable.',
          icon: 'videocam',
        };
        setPackages([...packages, newPkg]);
        setPkgTitle('');
        setPkgPrice('');
        setPkgDesc('');
        setShowAddPackage(false);
        Alert.alert('Package Added', 'Your sponsorship package is now live on your Media Kit.');
      } else {
        Alert.alert('Error', 'Failed to save package on the server.');
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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Creator Media Kit</Text>
        <TouchableOpacity
          onPress={handleShareMediaKit}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name="share-outline" size={17} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'overview' && styles.activeTabBtn]}
          onPress={() => setActiveTab('overview')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'overview' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'overview' && { fontWeight: '700' },
            ]}
          >
            Audience & Reach
          </Text>
          {activeTab === 'overview' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'rates' && styles.activeTabBtn]}
          onPress={() => setActiveTab('rates')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'rates' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'rates' && { fontWeight: '700' },
            ]}
          >
            Sponsorship Rates ({packages.length})
          </Text>
          {activeTab === 'rates' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchMediaKit();
            }}
            tintColor={theme.primary || COLORS.primary}
          />
        }
      >
        {/* Profile Card Summary */}
        <View style={[styles.profileCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
          <Image
            source={{
              uri:
                currentUser?.avatar ||
                'https://ui-avatars.com/api/?name=Creator&background=0B57D0&color=fff&size=200&bold=true',
            }}
            style={styles.avatarImg}
          />
          <View style={styles.nameRow}>
            <Text style={[styles.creatorName, { color: theme.text }]}>{currentUser?.name || 'Creator'}</Text>
            <Ionicons name="checkmark-circle" size={17} color={COLORS.primary} style={{ marginLeft: 4 }} />
          </View>
          <Text style={[styles.handleText, { color: theme.textSecondary }]}>
            @{currentUser?.handle || currentUser?.username || 'creator'} • Verified Tiwi Creator
          </Text>

          <View style={[styles.verifiedStatusPill, { backgroundColor: COLORS.rgba_16_185_129_0p12 }]}>
            <Ionicons name="shield-checkmark" size={13} color={COLORS.hex_10B981} style={{ marginRight: 4 }} />
            <Text style={styles.verifiedStatusText}>Official Certified Media Metrics</Text>
          </View>
        </View>

        {activeTab === 'overview' ? (
          <>
            {/* Real Dynamic Metrics Grid */}
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>KEY PERFORMANCE METRICS</Text>
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color={theme.primary || COLORS.primary} />
              </View>
            ) : (
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                  <Ionicons name="eye-outline" size={20} color={COLORS.primary} style={{ marginBottom: 6 }} />
                  <Text style={[styles.metricNumber, { color: theme.text }]}>{metrics.monthlyImpressions || '0'}</Text>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Monthly Impressions</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                  <Ionicons name="trending-up-outline" size={20} color={COLORS.hex_10B981} style={{ marginBottom: 6 }} />
                  <Text style={[styles.metricNumber, { color: theme.text }]}>{metrics.engagementRate || '0.0%'}</Text>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Engagement Rate</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                  <Ionicons name="people-outline" size={20} color={COLORS.hex_A855F7} style={{ marginBottom: 6 }} />
                  <Text style={[styles.metricNumber, { color: theme.text }]}>{metrics.followersCount || 0}</Text>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Active Followers</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                  <Ionicons name="document-text-outline" size={20} color={COLORS.hex_EF4444} style={{ marginBottom: 6 }} />
                  <Text style={[styles.metricNumber, { color: theme.text }]}>{metrics.postsCount || 0}</Text>
                  <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>Total Posts</Text>
                </View>
              </View>
            )}
          </>
        ) : (
          /* SPONSORSHIP RATE CARD */
          <>
            <View style={styles.ratesHeaderRow}>
              <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>YOUR SPONSORSHIP PACKAGES</Text>
              <TouchableOpacity
                onPress={() => setShowAddPackage(!showAddPackage)}
                style={styles.addPkgBtn}
              >
                <Ionicons name={showAddPackage ? 'close' : 'add'} size={16} color={theme.primary || COLORS.primary} style={{ marginRight: 4 }} />
                <Text style={[styles.addPkgText, { color: theme.primary || COLORS.primary }]}>
                  {showAddPackage ? 'Cancel' : 'Add Package'}
                </Text>
              </TouchableOpacity>
            </View>

            {showAddPackage && (
              <View style={[styles.card, { backgroundColor: theme.cardBg, borderColor: theme.borderLight, padding: 16, marginBottom: 14 }]}>
                <Text style={[styles.formTitle, { color: theme.text }]}>New Sponsorship Deliverable</Text>

                <TextInput
                  style={[styles.textInput, { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight, marginTop: 10 }]}
                  placeholder="e.g. Dedicated Reel (60s)"
                  placeholderTextColor={theme.textSecondary}
                  value={pkgTitle}
                  onChangeText={setPkgTitle}
                />

                <TextInput
                  style={[styles.textInput, { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight, marginTop: 10 }]}
                  placeholder="e.g. $450"
                  placeholderTextColor={theme.textSecondary}
                  value={pkgPrice}
                  onChangeText={setPkgPrice}
                  keyboardType="numeric"
                />

                <TextInput
                  style={[styles.textInput, { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight, marginTop: 10 }]}
                  placeholder="Description of deliverables and terms"
                  placeholderTextColor={theme.textSecondary}
                  value={pkgDesc}
                  onChangeText={setPkgDesc}
                />

                <TouchableOpacity
                  style={[styles.savePkgBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                  onPress={handleCreatePackage}
                  activeOpacity={0.85}
                >
                  <Text style={styles.savePkgBtnText}>Save Deliverable</Text>
                </TouchableOpacity>
              </View>
            )}

            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color={theme.primary || COLORS.primary} />
              </View>
            ) : packages.length === 0 ? (
              <View style={[styles.card, styles.emptyCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
                <Ionicons name="pricetag-outline" size={40} color={theme.textSecondary} style={{ marginBottom: 8 }} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No Sponsorship Packages Yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                  Define your rates for sponsored posts, brand reels, shoutouts, or story takeovers.
                </Text>
                <TouchableOpacity
                  style={[styles.createFirstBtn, { backgroundColor: theme.primary || COLORS.primary }]}
                  onPress={() => setShowAddPackage(true)}
                >
                  <Ionicons name="add" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.createFirstBtnText}>Create Package</Text>
                </TouchableOpacity>
              </View>
            ) : (
              packages.map((pkg, idx) => (
                <View
                  key={pkg.id || `pkg-${idx}`}
                  style={[styles.packageCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                >
                  <View style={styles.pkgTopRow}>
                    <View style={styles.pkgLeft}>
                      <Ionicons name={pkg.icon || 'pricetag'} size={20} color={theme.primary || COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={[styles.pkgTitle, { color: theme.text }]}>{pkg.title}</Text>
                    </View>
                    <Text style={[styles.pkgPrice, { color: theme.text }]}>{pkg.price}</Text>
                  </View>
                  <Text style={[styles.pkgDesc, { color: theme.textSecondary }]}>{pkg.description}</Text>
                </View>
              ))
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
  headerActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
  activeTabBtn: {},
  tabText: {
    fontSize: 13,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    height: 3,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorName: {
    fontSize: 18,
    fontWeight: '700',
  },
  handleText: {
    fontSize: 13,
    marginTop: 2,
  },
  verifiedStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 10,
  },
  verifiedStatusText: {
    color: COLORS.hex_10B981,
    fontSize: 11,
    fontWeight: '700',
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  metricCard: {
    width: '48%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  metricNumber: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
  },
  ratesHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addPkgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addPkgText: {
    fontSize: 13,
    fontWeight: '600',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
  },
  formTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  savePkgBtn: {
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  savePkgBtnText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
  },
  packageCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  pkgTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  pkgLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pkgTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  pkgPrice: {
    fontSize: 16,
    fontWeight: '800',
  },
  pkgDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  centerContainer: {
    padding: 30,
    alignItems: 'center',
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    marginTop: 10,
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
    marginBottom: 16,
  },
  createFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 18,
  },
  createFirstBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
});
