import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';

import { API_BASE_URL } from '../config';
import { COLORS } from '../config/colors';

const { width } = Dimensions.get('window');

export default function CommunityCirclesScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const topTheme = getActiveTopBarTheme(isDarkMode);

  const [activeTab, setActiveTab] = useState('explore'); // 'explore' | 'my_circles' | 'create'
  const [searchQuery, setSearchQuery] = useState('');
  const [joinedMap, setJoinedMap] = useState({});
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Creation form state
  const [circleName, setCircleName] = useState('');
  const [circleCategory, setCircleCategory] = useState('Design & UI');
  const [circleDesc, setCircleDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);

  const fetchCircles = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/social/circles`);
      if (res.ok) {
        const data = await res.json();
        setCircles(Array.isArray(data.circles) ? data.circles : []);
      } else {
        setCircles([]);
      }
    } catch {
      setCircles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCircles();
  }, []);

  const categories = ['All', 'Design & UI', 'Software Engineering', 'Media Production', 'Web3 & FinTech'];

  const handleToggleJoin = (id, name) => {
    setJoinedMap((prev) => {
      const next = !prev[id];
      Alert.alert(
        next ? 'Joined Circle' : 'Left Circle',
        next ? `You are now a member of ${name}.` : `You left ${name}.`
      );
      return { ...prev, [id]: next };
    });
  };

  const handleCreateCircle = async () => {
    if (!circleName.trim() || !circleDesc.trim()) {
      Alert.alert('Incomplete Form', 'Please provide a Circle name and brief description.');
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/social/circles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: circleName.trim(),
          category: circleCategory,
          description: circleDesc.trim(),
          creatorId: currentUser?.id,
          isPrivate,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const created = data.circle || {
          id: `circle_${Date.now()}`,
          name: circleName.trim(),
          category: circleCategory,
          description: circleDesc.trim(),
          memberCount: 1,
        };
        setCircles((prev) => [created, ...prev]);
        setJoinedMap((prev) => ({ ...prev, [created.id]: true }));
      }
    } catch {
      // Offline fallback
    }

    setCircleName('');
    setCircleDesc('');
    setActiveTab('explore');
    Alert.alert('Circle Created', `Your community "${circleName.trim()}" is now live!`);
  };

  const filteredCircles = circles.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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
        <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Community Circles</Text>
        <TouchableOpacity
          onPress={() => setActiveTab(activeTab === 'create' ? 'explore' : 'create')}
          style={[styles.headerActionBtn, { backgroundColor: theme.primary || COLORS.primary }]}
          activeOpacity={0.8}
        >
          <Ionicons name={activeTab === 'create' ? 'close' : 'add'} size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Segmented Top Tabs */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'explore' && styles.activeTabBtn]}
          onPress={() => setActiveTab('explore')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'explore' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'explore' && { fontWeight: '700' },
            ]}
          >
            Explore
          </Text>
          {activeTab === 'explore' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'my_circles' && styles.activeTabBtn]}
          onPress={() => setActiveTab('my_circles')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'my_circles' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'my_circles' && { fontWeight: '700' },
            ]}
          >
            My Circles
          </Text>
          {activeTab === 'my_circles' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'create' && styles.activeTabBtn]}
          onPress={() => setActiveTab('create')}
        >
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'create' ? (theme.primary || COLORS.primary) : theme.textSecondary },
              activeTab === 'create' && { fontWeight: '700' },
            ]}
          >
            Create
          </Text>
          {activeTab === 'create' && <View style={[styles.tabIndicator, { backgroundColor: theme.primary || COLORS.primary }]} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'create' ? (
          /* CREATE COMMUNITY CIRCLE FORM */
          <View style={[styles.createCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}>
            <View style={styles.createTitleRow}>
              <Ionicons name="people-circle" size={28} color={theme.primary || COLORS.primary} style={{ marginRight: 10 }} />
              <View>
                <Text style={[styles.createHeaderTitle, { color: theme.text }]}>Create a New Circle</Text>
                <Text style={[styles.createHeaderSub, { color: theme.textSecondary }]}>
                  Build a community around shared passions and ideas
                </Text>
              </View>
            </View>

            <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Circle Name</Text>
            <TextInput
              style={[
                styles.textInput,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="e.g. Flutter & React Native Engineers"
              placeholderTextColor={theme.textSecondary}
              value={circleName}
              onChangeText={setCircleName}
            />

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {categories.filter((c) => c !== 'All').map((cat) => {
                const isSelected = circleCategory === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: isSelected
                          ? (theme.primary || COLORS.primary)
                          : (isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground),
                      },
                    ]}
                    onPress={() => setCircleCategory(cat)}
                  >
                    <Text style={[styles.catChipText, { color: isSelected ? COLORS.white : theme.text }]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={[styles.inputLabel, { color: theme.textSecondary, marginTop: 14 }]}>Description & Guidelines</Text>
            <TextInput
              style={[
                styles.textArea,
                { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.hex_F9FAFB, color: theme.text, borderColor: theme.borderLight },
              ]}
              placeholder="What is this community about? Who should join?"
              placeholderTextColor={theme.textSecondary}
              value={circleDesc}
              onChangeText={setCircleDesc}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.submitCreateBtn, { backgroundColor: theme.primary || COLORS.primary }]}
              onPress={handleCreateCircle}
              activeOpacity={0.85}
            >
              <Ionicons name="sparkles" size={17} color={COLORS.white} style={{ marginRight: 6 }} />
              <Text style={styles.submitCreateBtnText}>Launch Community Circle</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* CIRCLES LISTING (EXPLORE / MY CIRCLES) */
          <>
            {/* Search Input */}
            <View style={[styles.searchBox, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
              <Ionicons name="search" size={18} color={theme.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: theme.text }]}
                placeholder="Search topics, interests, or circles..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {!!searchQuery && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {loading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={theme.primary || COLORS.primary} />
                <Text style={{ marginTop: 12, color: theme.textSecondary, fontSize: 13 }}>Loading communities...</Text>
              </View>
            ) : filteredCircles.filter((c) => (activeTab === 'my_circles' ? joinedMap[c.id] : true)).length === 0 ? (
              <View style={{ padding: 36, alignItems: 'center', backgroundColor: theme.cardBg, borderRadius: 16, borderWidth: 1, borderColor: theme.borderLight, marginTop: 16 }}>
                <Ionicons name="people-outline" size={54} color={theme.textSecondary} style={{ opacity: 0.6, marginBottom: 12 }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, marginBottom: 6 }}>
                  {activeTab === 'my_circles' ? 'No Joined Circles Yet' : 'No Community Circles Found'}
                </Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary, textAlign: 'center', lineHeight: 18, marginBottom: 18 }}>
                  {activeTab === 'my_circles'
                    ? 'Explore and join active interest groups or create your own topic circle.'
                    : 'Be the first creator to start a community circle in this category.'}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: theme.primary || COLORS.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}
                  onPress={() => setActiveTab('create')}
                >
                  <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 14 }}>Create a Circle</Text>
                </TouchableOpacity>
              </View>
            ) : (
              filteredCircles
                .filter((c) => (activeTab === 'my_circles' ? joinedMap[c.id] : true))
                .map((circle) => {
                  const isJoined = !!joinedMap[circle.id];
                  return (
                    <View
                      key={circle.id}
                      style={[styles.circleCard, { backgroundColor: theme.cardBg, borderColor: theme.borderLight }]}
                    >
                      {circle.banner && !circle.banner.includes('unsplash') ? (
                        <Image source={{ uri: circle.banner }} style={styles.circleBanner} />
                      ) : (
                        <View style={[styles.circleHeaderPattern, { backgroundColor: isDarkMode ? COLORS.hex_1F2937 : COLORS.primaryLight }]}>
                          <Ionicons name="people" size={28} color={theme.primary || COLORS.primary} />
                        </View>
                      )}
                      <View style={styles.circleContent}>
                        <View style={styles.circleTopRow}>
                          <View style={[styles.circleCategoryBadge, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}>
                            <Text style={[styles.circleCategoryText, { color: theme.primary || COLORS.primary }]}>
                              {circle.category || 'General'}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={[
                              styles.joinCircleBtn,
                              isJoined
                                ? { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }
                                : { backgroundColor: theme.primary || COLORS.primary },
                            ]}
                            onPress={() => handleToggleJoin(circle.id, circle.name)}
                            activeOpacity={0.8}
                          >
                            <Ionicons
                              name={isJoined ? 'checkmark' : 'add'}
                              size={14}
                              color={isJoined ? theme.text : COLORS.white}
                              style={{ marginRight: 4 }}
                            />
                            <Text
                              style={[
                                styles.joinCircleBtnText,
                                { color: isJoined ? theme.text : COLORS.white },
                              ]}
                            >
                              {isJoined ? 'Joined' : 'Join'}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        <Text style={[styles.circleName, { color: theme.text }]}>{circle.name}</Text>
                        <Text style={[styles.circleDesc, { color: theme.textSecondary }]} numberOfLines={2}>
                          {circle.description}
                        </Text>

                        <View style={styles.circleMetaRow}>
                          <View style={styles.metaItem}>
                            <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                              {circle.memberCount || circle.membersCount || 1} members
                            </Text>
                          </View>
                          <View style={styles.metaItem}>
                            <Ionicons name="chatbubbles-outline" size={14} color={theme.textSecondary} />
                            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                              {circle.postsCount || 0} posts
                            </Text>
                          </View>
                        </View>
                      </View>
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
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  circleCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  circleBanner: {
    width: '100%',
    height: 110,
  },
  circleContent: {
    padding: 16,
  },
  circleTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  circleCategoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  circleCategoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  joinCircleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  joinCircleBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  circleName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  circleDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  circleMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  createCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  createTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  createHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  createHeaderSub: {
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
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    marginRight: 8,
  },
  catChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    fontSize: 14,
  },
  submitCreateBtn: {
    flexDirection: 'row',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  submitCreateBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '700',
  },
});
