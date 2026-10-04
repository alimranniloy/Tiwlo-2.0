import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function FollowersListScreen({ onNavigate, user }) {
  const { theme, isDarkMode, currentUser, isUserFollowed, toggleFollowUser } = useAuth();
  const targetUser = user || currentUser;
  const isOwn = currentUser && (targetUser.id === currentUser.id || targetUser.handle === currentUser.handle);

  const [followers, setFollowers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadFollowers();
  }, [targetUser?.id, targetUser?.handle]);

  const loadFollowers = async () => {
    setLoading(true);
    try {
      const targetId = targetUser?.id || targetUser?.tiwiId || targetUser?.handle;
      const list = await TiwiAPI.getUserFollowers(targetId, currentUser?.id);
      setFollowers(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Error loading followers:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleToggleFollow = async (targetUserItem) => {
    try {
      await toggleFollowUser(targetUserItem);
    } catch (err) {
      console.warn('Follow error:', err);
    }
  };

  const filtered = followers.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.handle?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topTheme = getActiveTopBarTheme(isDarkMode);

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
        <View style={styles.headerTitleCol}>
          <Text style={[styles.headerTitle, { color: topTheme.headerText }]}>Followers</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textMuted }]}>
            {targetUser?.name || 'User'} • {followers.length} followers
          </Text>
        </View>
        <View style={{ width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE }} />
      </View>

      {/* Search Input Pill */}
      <View style={[styles.searchPillBox, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <View style={[styles.searchPill, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
          <Ionicons name="search" size={16} color={theme.textSecondary} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search followers..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {!!searchQuery && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadFollowers(); }} colors={[theme.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No followers found</Text>
              <Text style={[styles.emptySub, { color: theme.textMuted }]}>
                {searchQuery ? 'Try searching a different name or handle' : 'When people follow this account, they will appear here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const userFollowed = isUserFollowed(item.id, item.handle);
            const isFollowing = userFollowed !== undefined ? userFollowed : !!(item.isFollowing || item.isFollowed);
            const isSelf = currentUser && (item.id === currentUser.id);

            return (
              <TouchableOpacity
                style={[styles.userRow, { borderBottomColor: theme.borderLight }]}
                onPress={() => onNavigate && onNavigate('profile', item)}
                activeOpacity={0.7}
              >
                <Image
                  source={{
                    uri:
                      item.avatar ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`,
                  }}
                  style={styles.avatar}
                />
                <View style={styles.userTextCol}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.isVerified && (
                      <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} style={{ marginLeft: 3 }} />
                    )}
                  </View>
                  <Text style={[styles.userHandle, { color: theme.textMuted }]} numberOfLines={1}>
                    {item.handle || '@user'}
                  </Text>
                </View>

                {!isSelf && (
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      isFollowing
                        ? {
                            backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6,
                            borderColor: isDarkMode ? COLORS.hex_3C4043 : COLORS.primaryContainer,
                            borderWidth: 1,
                          }
                        : { backgroundColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary },
                    ]}
                    onPress={() => handleToggleFollow(item)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.followBtnText,
                        { color: isFollowing ? theme.text : (isDarkMode ? COLORS.hex_040E28 : COLORS.white) },
                      ]}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleCol: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_WEIGHT,
  },
  headerSubtitle: {
    fontSize: 11.5,
    marginTop: 1,
  },
  searchPillBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    height: '100%',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 24,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  userTextCol: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userName: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  userHandle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
