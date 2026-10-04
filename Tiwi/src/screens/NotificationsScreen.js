import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { UserRowSkeleton } from '../components/SkeletonLoader';
import { formatTimeAgo } from '../components/PostCard';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function NotificationsScreen({ onNavigate }) {
  const { theme, isDarkMode, currentUser, setUnreadNotificationsCount } = useAuth();
  const [activeTab, setActiveTab] = useState('All');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState(null);

  useEffect(() => {
    loadNotifications();
  }, [currentUser?.id]);

  const loadNotifications = async () => {
    if (!currentUser?.id) {
      setLoading(false);
      return;
    }
    try {
      const data = await TiwiAPI.getNotifications(currentUser.id);
      const safeData = Array.isArray(data) ? data : [];
      setNotifications(safeData);
      const unread = safeData.filter((n) => !n.read).length;
      if (setUnreadNotificationsCount) {
        setUnreadNotificationsCount(unread);
      }
    } catch (err) {
      console.warn('Error loading notifications:', err);
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleMarkAsRead = async (item) => {
    if (!item || item.read) return;
    setNotifications((prev) =>
      Array.isArray(prev) ? prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)) : []
    );
    try {
      await TiwiAPI.markNotificationRead(item.id, currentUser?.id);
    } catch (err) {
      console.warn('Error marking notification read:', err);
    }
    const unread = (Array.isArray(notifications) ? notifications : []).filter(
      (n) => !n.read && n.id !== item.id
    ).length;
    if (setUnreadNotificationsCount) {
      setUnreadNotificationsCount(unread);
    }
  };

  const handleToggleFollow = async (item) => {
    if (!item) return;
    if (item.user?.id) {
      try {
        const result = await TiwiAPI.toggleFollow(item.user.id, currentUser?.id);
        setNotifications((prev) =>
          Array.isArray(prev)
            ? prev.map((n) =>
                n.id === item.id
                  ? { ...n, isFollowing: Boolean(result?.isFollowing), requestPending: Boolean(result?.requestPending) }
                  : n
              )
            : []
        );
      } catch (err) {
        Alert.alert('Error', 'Unable to update follow status.');
      }
    }
  };

  const handleFollowRequestResponse = async (item, action) => {
    const requestId = item?.meta?.requestId;
    if (!requestId || respondingRequestId) return;
    setRespondingRequestId(item.id);
    try {
      await TiwiAPI.respondToFollowRequest(requestId, action === 'accept' ? 'accepted' : 'rejected', currentUser?.id);
      setNotifications((prev) => prev.filter((notification) => notification.id !== item.id));
      await loadNotifications();
    } catch (err) {
      Alert.alert('Error', 'Unable to respond to follow request.');
    } finally {
      setRespondingRequestId(null);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <Ionicons name="heart" size={18} color={COLORS.hex_EF4444} />;
      case 'follow':
        return <Ionicons name="person" size={18} color={COLORS.hex_3B82F6} />;
      case 'comment':
        return <Ionicons name="chatbubble" size={18} color={COLORS.hex_3B82F6} />;
      case 'warning':
      case 'violation':
      case 'strike':
        return <Ionicons name="shield-outline" size={18} color={COLORS.hex_D93025} />;
      case 'system':
      case 'update':
      case 'post':
        return (
          <Image
            source={require('../../assets/tiwi.png')}
            style={{ width: 18, height: 18, borderRadius: 4 }}
            resizeMode="contain"
          />
        );
      default:
        return (
          <Image
            source={require('../../assets/tiwi.png')}
            style={{ width: 18, height: 18, borderRadius: 4 }}
            resizeMode="contain"
          />
        );
    }
  };

  const safeList = Array.isArray(notifications) ? notifications : [];
  const filteredNotifications = safeList.filter((item) => {
    if (!item) return false;
    if (activeTab === 'Mentions') return item.type === 'comment';
    if (activeTab === 'Verified') return Boolean(item.user?.isVerified);
    return true;
  });

  const topTheme = getActiveTopBarTheme(isDarkMode);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. Header with Back Button */}
      <View style={[styles.header, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => onNavigate && onNavigate('back')}
            style={styles.backBtn}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: topTheme.headerText }]}>Activity</Text>
        </View>

        <View style={styles.headerIcons}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: isDarkMode ? COLORS.rgba_255_255_255_0p08 : COLORS.rgba_0_0_0_0p05 }]}
            onPress={() => onNavigate && onNavigate('settings')}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="settings-outline" size={LAYOUT.HEADER_ICON_SIZE - 2} color={topTheme.headerIconColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Filter Tabs: All, Mentions, Verified */}
      <View style={[styles.tabBar, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        {['All', 'Mentions', 'Verified'].map((tab) => {
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabItem, isActive && styles.activeTabItem]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? theme.primary : theme.textSecondary },
                  isActive && styles.activeTabText,
                ]}
              >
                {tab}
              </Text>
              {isActive && <View style={[styles.tabIndicator, { backgroundColor: theme.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 3. Notifications List */}
      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 8 }}>
          <UserRowSkeleton />
          <UserRowSkeleton />
          <UserRowSkeleton />
          <UserRowSkeleton />
          <UserRowSkeleton />
          <UserRowSkeleton />
        </ScrollView>
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => (item?.id ? String(item.id) : Math.random().toString())}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadNotifications();
              }}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="notifications-outline" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No notifications yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                {activeTab === 'Mentions'
                  ? 'When someone mentions or tags you, it will appear here.'
                  : activeTab === 'Verified'
                  ? 'Updates from verified creators and accounts will show up here.'
                  : 'Interactions, likes, follows, and mentions will appear right here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (!item) return null;
            const senderName = item.user?.name || 'Someone';
            const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=0B57D0&color=fff&size=200&bold=true`;
            const timeAgoText = formatTimeAgo(item.createdAt || item.timestamp || item.timeAgo);

            return (
              <TouchableOpacity
                style={[
                  styles.itemRow,
                  { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight },
                  !item.read && { backgroundColor: isDarkMode ? COLORS.hex_1E2638 : COLORS.hex_EFF6FF },
                ]}
                onPress={() => handleMarkAsRead(item)}
                activeOpacity={0.75}
              >
                {/* Type Icon Badge */}
                <View style={styles.iconCol}>{getNotificationIcon(item.type)}</View>

                {/* User or Official Tiwi Avatar */}
                <TouchableOpacity
                  onPress={() => onNavigate && item.user && onNavigate('profile', item.user)}
                  activeOpacity={0.8}
                >
                  <Image
                    source={
                      item.type === 'system' || item.type === 'update' || item.type === 'warning' || item.type === 'violation' || item.type === 'strike' || !item.user?.avatar
                        ? require('../../assets/tiwi.png')
                        : { uri: item.user.avatar }
                    }
                    style={styles.avatar}
                  />
                </TouchableOpacity>

                {/* Content text */}
                <View style={styles.contentCol}>
                  {item.type === 'warning' || item.type === 'violation' || item.type === 'strike' ? (
                    <>
                      <Text style={[styles.itemTitle, { color: isDarkMode ? COLORS.hex_F87171 : COLORS.hex_DC2626, fontWeight: '700' }]}>
                        {item.title || 'Community Standards Notice'}
                        <Text style={[styles.timeAgo, { color: theme.textMuted, fontWeight: '400' }]}> • {timeAgoText}</Text>
                      </Text>
                      <Text style={[styles.snippetText, { color: theme.textSecondary }]} numberOfLines={3}>
                        {item.message || item.snippet}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.itemTitle, { color: theme.text }]}>
                        <Text
                          style={styles.userName}
                          onPress={() => onNavigate && item.user && onNavigate('profile', item.user)}
                        >
                          {senderName}{' '}
                        </Text>
                        {typeof item.title === 'string'
                          ? item.title.replace(senderName, '').trim()
                          : (item.message || 'interacted with your post')}
                        <Text style={[styles.timeAgo, { color: theme.textMuted }]}> • {timeAgoText}</Text>
                      </Text>
                      {!!item.snippet && (
                        <Text style={[styles.snippetText, { color: theme.textSecondary }]} numberOfLines={2}>
                          {item.snippet}
                        </Text>
                      )}
                    </>
                  )}
                </View>

                {/* Right Side: Follow Button or Photo Thumbnail */}
                {item.type === 'follow' ? (
                  <TouchableOpacity
                    style={[
                      styles.followBtn,
                      item.isFollowing || item.requestPending
                        ? [styles.followingBtn, { borderColor: theme.border }]
                        : { backgroundColor: theme.primary },
                    ]}
                    onPress={() => handleToggleFollow(item)}
                    disabled={item.requestPending}
                  >
                    <Text
                      style={[
                        styles.followBtnText,
                        { color: item.isFollowing || item.requestPending ? theme.textSecondary : COLORS.white },
                      ]}
                    >
                      {item.isFollowing ? 'Following' : item.requestPending ? 'Requested' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                ) : item.type === 'follow_request' ? (
                  <View style={styles.followRequestActions}>
                    {respondingRequestId === item.id ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <>
                        <TouchableOpacity
                          style={[styles.requestActionBtn, { backgroundColor: theme.primary }]}
                          onPress={() => handleFollowRequestResponse(item, 'accept')}
                        >
                          <Text style={styles.requestActionText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.requestActionBtn, styles.declineRequestBtn, { borderColor: theme.border }]}
                          onPress={() => handleFollowRequestResponse(item, 'decline')}
                        >
                          <Text style={[styles.requestActionText, { color: theme.textSecondary }]}>Decline</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : item.thumbnail ? (
                  <Image source={{ uri: item.thumbnail }} style={styles.thumbnail} />
                ) : null}
              </TouchableOpacity>
            );
          }}
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
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    borderRadius: LAYOUT.HEADER_BUTTON_TOUCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    borderRadius: LAYOUT.HEADER_BUTTON_TOUCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    height: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeTabItem: {},
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeTabText: {
    fontWeight: '800',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: '40%',
    height: 2.5,
    borderRadius: 2,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  iconCol: {
    width: 24,
    alignItems: 'center',
    paddingTop: 8,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  contentCol: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  userName: {
    fontWeight: '700',
  },
  timeAgo: {
    fontSize: 12,
    fontWeight: '400',
  },
  snippetText: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'center',
  },
  followingBtn: {
    backgroundColor: COLORS.named_transparent,
    borderWidth: 1,
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  followRequestActions: {
    alignItems: 'center',
    gap: 6,
  },
  requestActionBtn: {
    minWidth: 64,
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
  },
  declineRequestBtn: {
    backgroundColor: COLORS.named_transparent,
    borderWidth: 1,
  },
  requestActionText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignSelf: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
