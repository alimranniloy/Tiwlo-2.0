import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import { COLORS } from '../config/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

/**
 * Twitter/X Style Inline Suggested Creators Shelf
 * Seamlessly embedded inside FeedScreen with real database users
 */
export default function SuggestedUsersShelf({ onNavigate, onDismiss }) {
  const { theme, isDarkMode, currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [followingMap, setFollowingMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    loadSuggested();
  }, [currentUser?.id]);

  const loadSuggested = async () => {
    try {
      const res = await TiwiAPI.search('', currentUser?.id);
      if (res && Array.isArray(res.users)) {
        const filtered = res.users
          .filter((u) => u && u.id !== currentUser?.id && u.handle !== currentUser?.handle)
          .slice(0, 10);
        setUsers(filtered);
      }
    } catch (err) {
      console.warn('SuggestedUsersShelf error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFollow = async (user) => {
    const userId = user.id;
    const isCurrentlyFollowing = !!followingMap[userId];
    setFollowingMap((prev) => ({ ...prev, [userId]: !isCurrentlyFollowing }));
    try {
      await TiwiAPI.toggleFollow(userId, currentUser?.id);
    } catch (err) {
      console.warn('Toggle follow in shelf error:', err);
    }
  };

  if (dismissed || loading || users.length === 0) return null;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.white,
          borderTopColor: theme.borderLight,
          borderBottomColor: theme.borderLight,
        },
      ]}
    >
      {/* Shelf Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="sparkles" size={17} color={theme.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>Suggested for you</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setDismissed(true);
            if (onDismiss) onDismiss();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={18} color={theme.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Horizontal Scroll of Suggested Cards */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {users.map((item) => {
          const isFollowing = !!followingMap[item.id];
          const avatarUrl =
            item.avatar ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`;

          return (
            <View
              key={item.id}
              style={[
                styles.userCard,
                {
                  backgroundColor: theme.cardBg,
                  borderColor: isDarkMode ? COLORS.hex_333537 : COLORS.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => onNavigate && onNavigate('profile', item)}
                activeOpacity={0.8}
                style={styles.cardTouchArea}
              >
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
                <View style={styles.nameRow}>
                  <Text style={[styles.userName, { color: theme.text }]} numberOfLines={1}>
                    {item.name || 'User'}
                  </Text>
                  {item.isVerified && (
                    <Ionicons name="checkmark-circle" size={14} color={COLORS.primary} style={{ marginLeft: 3 }} />
                  )}
                </View>
                <Text style={[styles.userHandle, { color: theme.textMuted }]} numberOfLines={1}>
                  {item.handle || '@user'}
                </Text>
              </TouchableOpacity>

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
                    {
                      color: isFollowing
                        ? theme.text
                        : isDarkMode
                        ? COLORS.hex_040E28
                        : COLORS.white,
                    },
                  ]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginVertical: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  userCard: {
    width: 140,
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cardTouchArea: {
    alignItems: 'center',
    width: '100%',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.hex_E2E8F0,
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  userName: {
    fontSize: 13.5,
    fontWeight: '700',
  },
  userHandle: {
    fontSize: 11.5,
    marginTop: 2,
    marginBottom: 10,
  },
  followBtn: {
    width: '100%',
    paddingVertical: 6.5,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
});
