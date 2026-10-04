import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Dimensions,
  RefreshControl,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from '../components/SafeLinearGradient';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import PostCard from '../components/PostCard';
import { ProfileSkeleton, PostSkeleton } from '../components/SkeletonLoader';
import CommentsModal from '../components/CommentsModal';
import SharedDrawer from '../components/SharedDrawer';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { getScreenDataCache } from '../utils/screenDataCache';
import { COLORS } from '../config/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 4) / 3;

export default function ProfileScreen({ onNavigate, user: propUser }) {
  const { theme, isDarkMode, currentUser, setCurrentUser, refreshUser, isUserFollowed, isFollowRequestPending, toggleFollowUser, setFollowStatus } = useAuth();

  const isOwnProfile = !propUser || (
    (currentUser?.id && (propUser?.id === currentUser?.id || propUser?._id === currentUser?.id)) ||
    (currentUser?.handle && propUser?.handle && propUser?.handle?.toLowerCase() === currentUser?.handle?.toLowerCase())
  );

  const [profileData, setProfileData] = useState(isOwnProfile ? currentUser : propUser);
  const [activeTab, setActiveTab] = useState('Posts'); // 'Posts' | 'Media' | 'Likes' | 'About'
  const [userPosts, setUserPosts] = useState([]);
  const [avatarSuccessVisible, setAvatarSuccessVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const targetId = profileData?.id || profileData?._id;
  const targetHandle = profileData?.handle;
  const globalFollowed = isUserFollowed(targetId, targetHandle);
  const effectiveIsFollowing = globalFollowed !== undefined ? globalFollowed : Boolean(isFollowing || profileData?.isFollowing || profileData?.isFollowed);
  const globalRequestPending = isFollowRequestPending(targetId, targetHandle);
  const effectiveRequestPending = globalRequestPending !== undefined
    ? globalRequestPending
    : Boolean(profileData?.followRequestPending);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selectedGridPost, setSelectedGridPost] = useState(null);
  const [activeCommentPost, setActiveCommentPost] = useState(null);
  const [verifiedDrawerVisible, setVerifiedDrawerVisible] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    const targetKey = isOwnProfile
      ? currentUser?.id
      : propUser?.id || propUser?._id || propUser?.handle;
    if (targetKey) {
      const cacheKey = `profile-posts:${currentUser?.id || targetKey}:${targetKey}`;
      getScreenDataCache(cacheKey).then((cachedPosts) => {
        if (!isCurrent || !Array.isArray(cachedPosts)) return;
        setUserPosts(cachedPosts);
        setLoading(false);
      });
    }
    loadUserProfile(() => isCurrent);
    return () => {
      isCurrent = false;
    };
  }, [propUser?.id, propUser?._id, propUser?.handle, currentUser?.id]);

  const loadUserProfile = async (isCurrent = () => true) => {
    try {
      if (isOwnProfile) {
        if (isCurrent()) setProfileData(currentUser);
        if (currentUser?.id) {
          const posts = await TiwiAPI.getUserPosts(currentUser.id);
          if (isCurrent()) setUserPosts(Array.isArray(posts) ? posts : []);
        }
      } else {
        const targetKey = propUser?.id || propUser?._id || propUser?.handle;
        const [fetchedProfile, posts] = targetKey
          ? await Promise.all([
            TiwiAPI.getProfile(targetKey, currentUser?.id),
            TiwiAPI.getUserPosts(targetKey, currentUser?.id),
          ])
          : [null, []];
        const merged = { ...propUser, ...(fetchedProfile || {}) };
        if (!isCurrent()) return;
        setProfileData(merged);
        const resolvedFollow = Boolean(merged?.isFollowing || merged?.isFollowed);
        setIsFollowing(resolvedFollow);
        if (merged.id) setFollowStatus(merged.id, resolvedFollow);
        if (merged.handle) setFollowStatus(merged.handle, resolvedFollow);
        setUserPosts(Array.isArray(posts) ? posts : []);
      }
    } catch (err) {
      console.warn('[ProfileScreen] Error loading profile:', err);
    } finally {
      if (isCurrent()) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    if (isOwnProfile && refreshUser) {
      await refreshUser();
    }
    await loadUserProfile();
  };

  const handleToggleFollow = async () => {
    if (!targetId || followLoading) return;
    setFollowLoading(true);
    const prevFollowersCount = Number(profileData?.followersCount || 0);

    try {
      const res = await toggleFollowUser(profileData);
      if (res?.requestPending) {
        setIsFollowing(false);
        setProfileData((prev) => ({ ...prev, followRequestPending: true }));
      } else if (res && res.followersCount !== undefined) {
        setProfileData((prev) => ({
          ...prev,
          followersCount: res.followersCount,
        }));
        setIsFollowing(res.isFollowing);
      } else {
        const nextState = !effectiveIsFollowing;
        setIsFollowing(nextState);
        setProfileData((prev) => ({
          ...prev,
          followersCount: nextState ? prevFollowersCount + 1 : Math.max(0, prevFollowersCount - 1),
        }));
      }
    } catch (err) {
      Alert.alert('Error', 'Unable to update follow status.');
    } finally {
      setFollowLoading(false);
    }
  };

  const handlePickCover = async () => {
    if (!isOwnProfile) return;
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access your photos is required to update cover photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingCover(true);
        const asset = result.assets[0];
        setCurrentUser((prev) => ({ ...prev, coverPhoto: asset.uri }));
        setProfileData((prev) => ({ ...prev, coverPhoto: asset.uri }));

        const uploadedUrl = await TiwiAPI.uploadMedia(asset.uri, 'cover_pic', asset.base64, currentUser?.id);
        await TiwiAPI.updateProfile({ coverPhoto: uploadedUrl }, currentUser.id);
        setCurrentUser((prev) => ({ ...prev, coverPhoto: uploadedUrl }));
        setProfileData((prev) => ({ ...prev, coverPhoto: uploadedUrl }));
        if (refreshUser) await refreshUser();
        Alert.alert('Success', 'Cover photo updated successfully!');
      }
    } catch (err) {
      console.error('Error changing cover photo:', err);
      Alert.alert('Upload Failed', err.message || 'Failed to upload cover photo.');
    } finally {
      setUploadingCover(false);
    }
  };

  const handlePickAvatar = async () => {
    if (!isOwnProfile) return;
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Denied', 'Permission to access your photos is required to update profile picture.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setUploadingAvatar(true);
        const asset = result.assets[0];
        setCurrentUser((prev) => ({ ...prev, avatar: asset.uri }));
        setProfileData((prev) => ({ ...prev, avatar: asset.uri }));

        const uploadedUrl = await TiwiAPI.uploadMedia(asset.uri, 'profile_pic', asset.base64, currentUser?.id);
        await TiwiAPI.updateProfile({ avatar: uploadedUrl }, currentUser.id);
        setCurrentUser((prev) => ({ ...prev, avatar: uploadedUrl }));
        setProfileData((prev) => ({ ...prev, avatar: uploadedUrl }));
        // Instantly update author avatar on all currently rendered posts in the profile feed
        setUserPosts((prev) =>
          (prev || []).map((p) =>
            p.author?.id === currentUser?.id || p.author?.handle === currentUser?.handle
              ? { ...p, author: { ...p.author, avatar: uploadedUrl } }
              : p
          )
        );
        if (refreshUser) await refreshUser();
        setAvatarSuccessVisible(true);
      }
    } catch (err) {
      console.error('Error changing avatar:', err);
      Alert.alert('Upload Failed', err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleShare = async () => {
    try {
      const handleName = displayUser?.handle || '@tiwlo_user';
      await Share.share({
        message: `Connect with ${displayUser?.name || 'User'} (${handleName}) on Tiwi: https://tiwlo.com/${handleName.replace('@', '')}`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const displayUser = isOwnProfile ? (currentUser || profileData) : profileData;
  const defaultAvatar = displayUser?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(displayUser.name)}&background=0B57D0&color=fff&size=400&bold=true`
    : 'https://ui-avatars.com/api/?name=User&background=0B57D0&color=fff&size=400&bold=true';

  const isBusiness = displayUser?.accountType === 'business';
  const mediaPosts = userPosts.filter((p) => p && (p.image || (Array.isArray(p.images) && p.images.length > 0)));

  const topTheme = getActiveTopBarTheme(isDarkMode);

  // If initial load with no user info at all, show full profile skeleton
  if (loading && !displayUser?.name) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.topBar, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
          <TouchableOpacity
            onPress={() => onNavigate && onNavigate('back')}
            style={styles.topIconBtn}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
          </TouchableOpacity>
          <View style={styles.topBarTitleBlock}>
            <Text style={[styles.topBarName, { color: topTheme.headerText }]} numberOfLines={1}>
              Profile
            </Text>
          </View>
        </View>
        <ProfileSkeleton />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 1. Sleek Top Bar */}
      <View style={[styles.topBar, { backgroundColor: topTheme.headerBg, borderBottomColor: topTheme.headerBorder }]}>
        <TouchableOpacity
          onPress={() => onNavigate && onNavigate('back')}
          style={styles.topIconBtn}
          activeOpacity={0.7}
          hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
        >
          <Ionicons name="arrow-back" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
        </TouchableOpacity>
        <View style={styles.topBarTitleBlock}>
          <Text style={[styles.topBarName, { color: topTheme.headerText }]} numberOfLines={1}>
            {displayUser?.name || 'Profile'}
          </Text>
          <Text style={[styles.topBarPostsCount, { color: theme.textMuted }]}>
            {userPosts.length} {userPosts.length === 1 ? 'post' : 'posts'}
          </Text>
        </View>
        {isOwnProfile ? (
          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => onNavigate && onNavigate('settings')}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="settings-outline" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={handleShare}
            activeOpacity={0.7}
            hitSlop={LAYOUT.HEADER_BUTTON_HIT_SLOP}
          >
            <Ionicons name="share-social-outline" size={LAYOUT.HEADER_ICON_SIZE} color={topTheme.headerIconColor} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
        }
      >
        {/* 2. Cinematic Cover Photo (Facebook / Twitter style) */}
        <TouchableOpacity
          style={styles.coverWrapper}
          onPress={handlePickCover}
          activeOpacity={0.92}
          disabled={!isOwnProfile || uploadingCover}
        >
          {displayUser?.coverPhoto ? (
            <Image
              source={{ uri: displayUser.coverPhoto }}
              style={styles.coverImage}
              resizeMode="cover"
            />
          ) : (
            <LinearGradient
              colors={[COLORS.hex_1E293B, COLORS.hex_0F172A]}
              style={styles.coverPlaceholder}
            >
              <Ionicons name="image-outline" size={28} color={COLORS.hex_94A3B8} />
              {isOwnProfile && <Text style={styles.coverPlaceholderText}>Tap to set cover photo</Text>}
            </LinearGradient>
          )}

          {/* Floating Edit Cover Button (only on own profile) */}
          {isOwnProfile && (
            <View style={styles.coverBadge}>
              {uploadingCover ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="camera" size={13} color={COLORS.white} />
                  <Text style={styles.coverBadgeText}>Edit Cover</Text>
                </>
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* 3. Header Details: Overlapping Avatar, Actions, Identity, Bio, Stats */}
        <View style={[styles.profileHeaderBlock, { backgroundColor: theme.cardBg }]}>
          {/* Avatar and Action Buttons Row */}
          <View style={styles.avatarActionRow}>
            {/* Overlapping Avatar */}
            <TouchableOpacity
              style={[styles.avatarWrapper, { borderColor: theme.cardBg, backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E2E8F0 }]}
              onPress={handlePickAvatar}
              activeOpacity={0.88}
              disabled={!isOwnProfile || uploadingAvatar}
            >
              <Image
                source={{ uri: displayUser?.avatar || defaultAvatar }}
                style={styles.avatarImage}
              />
              {isOwnProfile && (
                <View style={styles.avatarCameraBadge}>
                  {uploadingAvatar ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <Ionicons name="camera" size={13} color={COLORS.white} />
                  )}
                </View>
              )}
            </TouchableOpacity>

            {/* Action Buttons: Own Profile (Edit + QR + Share + Settings) vs Other User (Follow + Message + Share) */}
            <View style={styles.actionButtonsGroup}>
              {isOwnProfile ? (
                <>
                  <TouchableOpacity
                    style={[styles.editProfileBtn, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}
                    onPress={() => onNavigate && onNavigate('edit-profile')}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.editProfileText, { color: theme.text }]}>Edit Profile</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareIconBtn, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}
                    onPress={() => onNavigate && onNavigate('profile-qr', displayUser)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="qr-code-outline" size={18} color={theme.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareIconBtn, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}
                    onPress={handleShare}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share-social-outline" size={18} color={theme.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareIconBtn, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}
                    onPress={() => onNavigate && onNavigate('settings')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="settings-outline" size={18} color={theme.text} />
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[
                      styles.editProfileBtn,
                      effectiveIsFollowing || effectiveRequestPending
                        ? { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }
                        : { backgroundColor: theme.primary },
                    ]}
                    onPress={handleToggleFollow}
                    activeOpacity={0.8}
                    disabled={followLoading || effectiveRequestPending}
                  >
                    {followLoading ? (
                      <ActivityIndicator size="small" color={effectiveIsFollowing || effectiveRequestPending ? theme.text : COLORS.white} />
                    ) : (
                      <Text
                        style={[
                          styles.editProfileText,
                          { color: effectiveIsFollowing || effectiveRequestPending ? theme.text : (isDarkMode ? COLORS.hex_040E28 : COLORS.white) },
                        ]}
                      >
                        {effectiveIsFollowing ? 'Following' : effectiveRequestPending ? 'Requested' : 'Follow'}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareIconBtn, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}
                    onPress={() => onNavigate && onNavigate('messages')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={theme.text} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.shareIconBtn, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E9EEF6 }]}
                    onPress={handleShare}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="share-social-outline" size={18} color={theme.text} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          {/* Identity: Name, Verified, Handle */}
          <View style={styles.identityBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.nameText, { color: theme.text }]}>
                {displayUser?.name || 'User'}
              </Text>
              {displayUser?.isVerified && (
                <TouchableOpacity
                  onPress={() => setVerifiedDrawerVisible(true)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} style={styles.verifiedIcon} />
                </TouchableOpacity>
              )}
            </View>

            <Text style={[styles.handleText, { color: theme.textMuted }]}>
              {displayUser?.handle ? (displayUser.handle.startsWith('@') ? displayUser.handle : `@${displayUser.handle}`) : '@user'}
            </Text>

            {/* Clean Metadata Badges Row: Tiwi ID + Account Type */}
            <View style={styles.badgesRow}>
              {/* Copyable Tiwi ID Chip */}
              <TouchableOpacity
                style={[
                  styles.tiwiIdChip,
                  {
                    backgroundColor: isDarkMode ? COLORS.rgba_11_87_208_0p15 : COLORS.primaryLight,
                    borderColor: isDarkMode ? COLORS.rgba_168_199_250_0p3 : COLORS.hex_C2E7FF,
                  },
                ]}
                onPress={async () => {
                  const idToCopy = displayUser?.tiwiId || (displayUser?.id ? `TIW-${displayUser.id}` : 'TIW-00000');
                  await Clipboard.setStringAsync(idToCopy);
                  Alert.alert('Tiwi ID Copied', `${idToCopy} copied to clipboard.`);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="card-outline" size={12} color={theme.primary} />
                <Text style={[styles.tiwiIdChipText, { color: theme.primary }]}>
                  {displayUser?.tiwiId || (displayUser?.id ? `TIW-${displayUser.id}` : 'TIW-USER')}
                </Text>
                <Ionicons name="copy-outline" size={11} color={theme.primary} style={{ opacity: 0.7 }} />
              </TouchableOpacity>

              {/* Account Type Pill */}
              <View
                style={[
                  styles.accountTypePill,
                  { backgroundColor: isBusiness ? (isDarkMode ? COLORS.hex_1E293B : COLORS.hex_EFF6FF) : (isDarkMode ? COLORS.hex_282A2C : COLORS.hex_F1F5F9) },
                ]}
              >
                <Ionicons
                  name={isBusiness ? 'briefcase' : 'sparkles'}
                  size={11}
                  color={isBusiness ? COLORS.hex_3B82F6 : theme.textMuted}
                  style={{ marginRight: 4 }}
                />
                <Text
                  style={[
                    styles.accountTypePillText,
                    { color: isBusiness ? COLORS.hex_3B82F6 : theme.textMuted },
                  ]}
                >
                  {isBusiness ? 'Brand' : 'Member'}
                </Text>
              </View>
            </View>
          </View>

          {/* Bio */}
          {!!displayUser?.bio && (
            <Text style={[styles.bioText, { color: theme.text }]}>
              {displayUser.bio}
            </Text>
          )}

          {/* Meta Info: Location, Website, Joined Date */}
          <View style={styles.metaRow}>
            {!!displayUser?.location && (
              <View style={styles.metaItem}>
                <Ionicons name="location-outline" size={15} color={theme.textMuted} />
                <Text style={[styles.metaText, { color: theme.textSecondary }]}>
                  {displayUser.location}
                </Text>
              </View>
            )}

            {!!displayUser?.website && (
              <View style={styles.metaItem}>
                <Ionicons name="link-outline" size={15} color={theme.primary} />
                <Text style={[styles.metaText, { color: theme.primary }]}>
                  {displayUser.website.replace(/^https?:\/\//, '')}
                </Text>
              </View>
            )}

            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={15} color={theme.textMuted} />
              <Text style={[styles.metaText, { color: theme.textMuted }]}>
                {displayUser?.joinedDate || 'Joined Tiwlo'}
              </Text>
            </View>
          </View>

          {/* Follower / Following / Posts Stats Row (Interactive) */}
          <View style={[styles.statsRow, { borderTopColor: theme.border }]}>
            <TouchableOpacity
              style={styles.statItem}
              onPress={() => onNavigate && onNavigate('following-list', displayUser)}
              activeOpacity={0.7}
            >
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {displayUser?.followingCount !== undefined ? displayUser.followingCount : 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}> Following</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statItem}
              onPress={() => onNavigate && onNavigate('followers-list', displayUser)}
              activeOpacity={0.7}
            >
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {displayUser?.followersCount !== undefined ? displayUser.followersCount : 0}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}> Followers</Text>
            </TouchableOpacity>

            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: theme.text }]}>
                {userPosts.length}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}> Posts</Text>
            </View>
          </View>
        </View>

        {/* 4. Tab Bar (Posts, Media, Likes, About) */}
        <View style={[styles.profileTabBar, { borderBottomColor: theme.border, backgroundColor: theme.cardBg }]}>
          {['Posts', 'Media', 'Likes', 'About'].map((tab) => {
            const isActive = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.profileTabItem, isActive && styles.activeProfileTabItem]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.profileTabText,
                    { color: isActive ? theme.primary : theme.textMuted },
                    isActive && styles.activeProfileTabText,
                  ]}
                >
                  {tab}
                </Text>
                {isActive && (
                  <View style={[styles.profileTabIndicator, { backgroundColor: theme.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 5. TAB CONTENT */}
        {/* Tab 1: Posts Stream */}
        {activeTab === 'Posts' && (
          <View style={styles.postsListWrapper}>
            {loading ? (
              <View>
                <PostSkeleton hasMedia={false} />
                <PostSkeleton hasMedia={true} />
              </View>
            ) : userPosts.length > 0 ? (
              userPosts.map((post) => (
                <PostCard
                  key={post.id || post._id || Math.random().toString()}
                  post={post}
                  onCommentPress={(p) => setActiveCommentPost(p)}
                  onProfilePress={(author) => onNavigate && onNavigate('profile', author)}
                />
              ))
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="chatbubbles-outline" size={44} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No posts yet</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                  {isOwnProfile
                    ? 'When you share posts and updates, they will appear right here.'
                    : `${displayUser?.name || 'This user'} hasn\'t posted anything yet.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tab 2: Media (Instagram 3-Column Grid) */}
        {activeTab === 'Media' && (
          <View style={styles.mediaGrid}>
            {mediaPosts.length > 0 ? (
              mediaPosts.map((post) => {
                const mediaUri = post.image || (Array.isArray(post.images) && post.images.length > 0 ? post.images[0] : null);
                if (!mediaUri) return null;
                const isVideo = /\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i.test(mediaUri) || mediaUri.includes('/reels/');
                const posterUri = isVideo
                  ? mediaUri.replace(/\.(mp4|mov|webm|mkv|m4v|avi)(\?.*)?$/i, '_poster.jpg$2')
                  : mediaUri;
                return (
                  <TouchableOpacity
                    key={post.id || post._id || Math.random().toString()}
                    style={styles.gridItem}
                    activeOpacity={0.85}
                    onPress={() => setSelectedGridPost(post)}
                  >
                    <Image
                      source={{ uri: posterUri }}
                      style={styles.gridImage}
                      resizeMode="cover"
                    />
                    {isVideo && (
                      <View style={styles.gridMultiBadge}>
                        <Ionicons name="play" size={13} color={COLORS.white} />
                      </View>
                    )}
                    {Array.isArray(post.images) && post.images.length > 1 && (
                      <View style={styles.gridMultiBadge}>
                        <Ionicons name="copy-outline" size={13} color={COLORS.white} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={[styles.emptyContainer, { width: SCREEN_WIDTH }]}>
                <Ionicons name="images-outline" size={44} color={theme.textMuted} />
                <Text style={[styles.emptyTitle, { color: theme.text }]}>No photos or videos</Text>
                <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
                  {isOwnProfile
                    ? 'Photos and media you attach to your posts will appear here.'
                    : `${displayUser?.name || 'This user'} hasn\'t posted any media yet.`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Tab 3: Likes */}
        {activeTab === 'Likes' && (
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={44} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No liked posts yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
              Tap the heart on any post to save it to your likes collection.
            </Text>
          </View>
        )}

        {/* Tab 4: About & Account Details */}
        {activeTab === 'About' && (
          <View style={[styles.aboutCard, { backgroundColor: theme.cardBg }]}>
            <Text style={[styles.aboutHeading, { color: theme.text }]}>Account Information</Text>

            <View style={[styles.aboutRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.aboutLabel, { color: theme.textMuted }]}>Account Type</Text>
              <Text style={[styles.aboutValue, { color: theme.text }]}>
                {isBusiness ? 'Business Organization' : 'Personal User'}
              </Text>
            </View>

            {isOwnProfile && (
              <View style={[styles.aboutRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.aboutLabel, { color: theme.textMuted }]}>Email</Text>
                <Text style={[styles.aboutValue, { color: theme.text }]}>
                  {displayUser?.email || 'N/A'}
                </Text>
              </View>
            )}

            <View style={[styles.aboutRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.aboutLabel, { color: theme.textMuted }]}>Tiwi Global ID</Text>
              <Text style={[styles.aboutValue, { color: theme.primary, fontWeight: '700' }]}>
                {displayUser?.tiwiId || (displayUser?.id ? `TIW-${displayUser.id}` : 'Tiwi Account')}
              </Text>
            </View>

            {isOwnProfile && (
              <View style={[styles.aboutRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.aboutLabel, { color: theme.textMuted }]}>Two-Step Verification (2FA)</Text>
                <View style={styles.statusPill}>
                  <Ionicons
                    name={displayUser?.twoFactorEnabled ? 'shield-checkmark' : 'shield-outline'}
                    size={14}
                    color={displayUser?.twoFactorEnabled ? COLORS.hex_10B981 : COLORS.hex_F59E0B}
                    style={{ marginRight: 4 }}
                  />
                  <Text
                    style={{
                      color: displayUser?.twoFactorEnabled ? COLORS.hex_10B981 : COLORS.hex_F59E0B,
                      fontSize: 12,
                      fontWeight: '700',
                    }}
                  >
                    {displayUser?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </Text>
                </View>
              </View>
            )}

            <View style={[styles.aboutRow, { borderBottomColor: theme.border }]}>
              <Text style={[styles.aboutLabel, { color: theme.textMuted }]}>Status</Text>
              <Text style={{ color: COLORS.hex_10B981, fontWeight: '700', fontSize: 13 }}>
                Active & Verified
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Grid Post Detail Modal (Instagram-style tap-to-view post) */}
      <Modal
        visible={!!selectedGridPost}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedGridPost(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.cardBg }}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.borderLight }]}>
            <TouchableOpacity onPress={() => setSelectedGridPost(null)} style={styles.modalBackBtn}>
              <Ionicons name="arrow-back" size={24} color={theme.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Photo</Text>
            <View style={{ width: 36 }} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedGridPost && (
              <PostCard
                post={selectedGridPost}
                onCommentPress={(p) => setActiveCommentPost(p)}
                onProfilePress={(author) => {
                  setSelectedGridPost(null);
                  if (onNavigate) onNavigate('profile', author);
                }}
              />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Comments Modal */}
      <CommentsModal
        visible={!!activeCommentPost}
        post={activeCommentPost}
        onClose={() => setActiveCommentPost(null)}
        onCommentAdded={() => {}}
      />

      {/* Profile Picture Updated Bottom Sheet */}
      <SharedDrawer
        visible={avatarSuccessVisible}
        onClose={() => setAvatarSuccessVisible(false)}
        title="Profile picture updated"
        subtitle="Your new photo is now visible across Tiwi"
        footer={
          <TouchableOpacity
            style={[styles.drawerPillBtn, { backgroundColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary }]}
            onPress={() => setAvatarSuccessVisible(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.drawerPillBtnText, { color: isDarkMode ? COLORS.hex_040E28 : COLORS.white }]}>Done</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.avatarSuccessBody}>
          <View style={styles.avatarSuccessPreviewWrap}>
            <Image
              source={{ uri: profileData?.avatar || currentUser?.avatar }}
              style={styles.avatarSuccessPreviewImg}
            />
            <View style={styles.avatarSuccessGreenBadge}>
              <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </View>
          </View>
          <Text style={[styles.avatarSuccessDesc, { color: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary }]}>
            Your profile picture has been updated and is saved to your account.
          </Text>
        </View>
      </SharedDrawer>

      {/* Verified Account Information Drawer */}
      <SharedDrawer
        visible={verifiedDrawerVisible}
        onClose={() => setVerifiedDrawerVisible(false)}
        title="Verified account"
        subtitle="Identity authenticity confirmed by Tiwlo"
        footer={
          <TouchableOpacity
            style={[styles.drawerPillBtn, { backgroundColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary }]}
            onPress={() => setVerifiedDrawerVisible(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.drawerPillBtnText, { color: isDarkMode ? COLORS.hex_040E28 : COLORS.white }]}>Got it</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.verifiedDrawerContent}>
          <View style={[styles.verifiedDrawerBadgeBox, { backgroundColor: isDarkMode ? COLORS.rgba_11_87_208_0p18 : COLORS.primaryLight }]}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.primary} />
          </View>
          <Text style={[styles.verifiedDrawerHeadline, { color: theme.text }]}>
            Authentic Creator / Public Figure
          </Text>
          <Text style={[styles.verifiedDrawerBody, { color: theme.textSecondary }]}>
            The blue badge confirms that Tiwlo has established this account is the authentic presence of{' '}
            <Text style={{ fontWeight: '700', color: theme.text }}>{displayUser?.name || 'this user'}</Text>{' '}
            ({displayUser?.handle || '@user'}).
          </Text>

          <View style={styles.verifiedCheckRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={[styles.verifiedCheckText, { color: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary }]}>
              Identity Verified: Phone, email, and creator credentials verified.
            </Text>
          </View>

          <View style={styles.verifiedCheckRow}>
            <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={[styles.verifiedCheckText, { color: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary }]}>
              Trusted Member: Adheres to Tiwlo Community Standards and Terms of Service.
            </Text>
          </View>
        </View>
      </SharedDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    height: LAYOUT.HEADER_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topIconBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    borderRadius: LAYOUT.HEADER_BUTTON_TOUCH_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitleBlock: {
    flex: 1,
    marginLeft: 8,
  },
  topBarName: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  topBarPostsCount: {
    fontSize: 11,
    fontWeight: '500',
  },
  coverWrapper: {
    width: '100%',
    height: 150,
    backgroundColor: COLORS.hex_0F172A,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverPlaceholderText: {
    color: COLORS.hex_94A3B8,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  coverBadge: {
    position: 'absolute',
    bottom: 12,
    right: 14,
    backgroundColor: COLORS.rgba_0_0_0_0p65,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  coverBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '700',
  },
  profileHeaderBlock: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  avatarActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: -42,
    marginBottom: 12,
  },
  avatarWrapper: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3.5,
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  actionButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editProfileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileText: {
    fontSize: 13,
    fontWeight: '700',
  },
  shareIconBtn: {
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityBlock: {
    marginBottom: 8,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
    flexWrap: 'wrap',
  },
  handleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  accountTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  accountTypePillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tiwiIdChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  tiwiIdChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tiwBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tiwBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  bioText: {
    fontSize: 14,
    lineHeight: 20,
    marginVertical: 8,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 13,
  },
  profileTabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  profileTabItem: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  activeProfileTabItem: {},
  profileTabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeProfileTabText: {
    fontWeight: '800',
  },
  profileTabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 2.5,
    width: '60%',
    borderRadius: 2,
  },
  postsListWrapper: {
    paddingBottom: 40,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    paddingBottom: 40,
  },
  gridItem: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    position: 'relative',
  },
  gridMultiBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: COLORS.rgba_0_0_0_0p65,
    borderRadius: 4,
    padding: 3,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalBackBtn: {
    padding: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 56,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  aboutCard: {
    width: '100%',
    padding: 18,
  },
  aboutHeading: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  aboutLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  aboutValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarSuccessBody: {
    alignItems: 'center',
    paddingVertical: 18,
  },
  avatarSuccessPreviewWrap: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarSuccessPreviewImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarSuccessGreenBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  avatarSuccessDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  drawerPillBtn: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  drawerPillBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  verifiedDrawerContent: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  verifiedDrawerBadgeBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  verifiedDrawerHeadline: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  verifiedDrawerBody: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 6,
  },
  verifiedCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  verifiedCheckText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
  },
});
