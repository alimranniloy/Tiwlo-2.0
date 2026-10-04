import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  Share,
  Platform,
  Dimensions,
  FlatList,
  Animated,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { BASE_URL } from '../config/api';
import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from './SafeLinearGradient';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import SharedDrawer from './SharedDrawer';
import TiwiVideoPlayer from './TiwiVideoPlayer';
import { LAYOUT } from '../config/layout';
import { COLORS } from '../config/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_HEIGHT = SCREEN_WIDTH; // 1:1 Full-Width Edge-to-Edge
const STANDARD_VIDEO_ASPECT_RATIOS = [9 / 16, 4 / 5, 1, 4 / 3, 16 / 9];

const getVideoAspectRatio = (width, height) => {
  if (!width || !height) return null;
  const sourceRatio = Math.min(16 / 9, Math.max(9 / 16, width / height));
  const closestStandardRatio = STANDARD_VIDEO_ASPECT_RATIOS.reduce((closest, ratio) => (
    Math.abs(ratio - sourceRatio) < Math.abs(closest - sourceRatio) ? ratio : closest
  ));
  return Math.abs(closestStandardRatio - sourceRatio) / sourceRatio <= 0.03
    ? closestStandardRatio
    : sourceRatio;
};

// Helper to reliably parse strings like "2.1K", "1.5M", "124"
export const parseCount = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return val;
  const str = String(val).trim().toUpperCase();
  if (str.endsWith('M')) {
    return Math.round((parseFloat(str.slice(0, -1)) || 0) * 1000000);
  }
  if (str.endsWith('K')) {
    return Math.round((parseFloat(str.slice(0, -1)) || 0) * 1000);
  }
  return parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
};

// Helper to format counts cleanly: 1200 -> "1.2K", 2100 -> "2.1K", 1000000 -> "1M"
export const formatCount = (num) => {
  if (!num || num <= 0) return '0';
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'M' : formatted + 'M';
  }
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + 'K' : formatted + 'K';
  }
  return num.toString();
};

// Helper to dynamically calculate time elapsed from creation
export const formatTimeAgo = (dateOrStr, fallback = 'Just now') => {
  if (!dateOrStr) return fallback;
  const postDate = new Date(dateOrStr);
  if (isNaN(postDate.getTime())) {
    return typeof dateOrStr === 'string' ? dateOrStr : fallback;
  }
  const now = Date.now();
  const diffSec = Math.floor((now - postDate.getTime()) / 1000);
  if (diffSec < 45) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d`;
  return postDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function PostCard(props) {
  if (!props.post) return null;
  return <PostCardContent {...props} />;
}

function PostCardContent({ post, onCommentPress, onProfilePress, onDeletePost, onEditPost, onHidePost, isActive = false, onPress }) {
  const { theme, isDarkMode, currentUser, isVideoMuted, setIsVideoMuted, isUserFollowed, isFollowRequestPending, toggleFollowUser } = useAuth();

  const [isLiked, setIsLiked] = useState(post?.isLiked || false);
  const [likesCount, setLikesCount] = useState(post?.likesCount || '0');
  const [isSaved, setIsSaved] = useState(post?.isSaved || false);
  const [isReposted, setIsReposted] = useState(post?.isReposted || false);
  const [repostsCount, setRepostsCount] = useState(post?.repostsCount || '0');
  const [viewsCount, setViewsCount] = useState(post?.viewsCount || '0');
  const [videoAspectRatios, setVideoAspectRatios] = useState({});
  const viewedPostIdRef = useRef(null);

  // Multi-Media Carousel State
  const [activeIndex, setActiveIndex] = useState(0);

  // Caption Expandable & Editing State
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentCaption, setCurrentCaption] = useState(post?.caption || '');
  const [isEditing, setIsEditing] = useState(false);
  const [editCaptionText, setEditCaptionText] = useState(post?.caption || '');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Deletion & Pinning State
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPostDeleted, setIsPostDeleted] = useState(false);
  const [isPostHidden, setIsPostHidden] = useState(false);
  const followRequestInFlightRef = useRef(false);
  const [isPinned, setIsPinned] = useState(post?.isPinned || false);

  // Drawers
  const [menuVisible, setMenuVisible] = useState(false);
  const [shareDrawerVisible, setShareDrawerVisible] = useState(false);
  const [reportDrawerVisible, setReportDrawerVisible] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [learnMoreVisible, setLearnMoreVisible] = useState(false);
  const [verifiedDrawerVisible, setVerifiedDrawerVisible] = useState(false);

  // Own Post detection
  const isOwnPost = Boolean(
    currentUser && (
      (post.author?.id && (post.author?.id === currentUser.id || String(post.author?.id) === String(currentUser.id))) ||
      (post.author?.handle && currentUser.handle && post.author?.handle.toLowerCase().replace('@', '') === currentUser.handle.toLowerCase().replace('@', '')) ||
      (post.author_id && (post.author_id === currentUser.id || String(post.author_id) === String(currentUser.id))) ||
      (post.user_id && (post.user_id === currentUser.id || String(post.user_id) === String(currentUser.id)))
    )
  );
  const authorId = post.author?.id || post.author?._id || post.author_id || post.user_id;
  const authorHandle = post.author?.handle;
  const isOtherAuthor = Boolean(currentUser && !isOwnPost && (authorId || authorHandle));
  const globalFollowed = isUserFollowed(authorId, authorHandle);
  const isAuthorFollowed = globalFollowed !== undefined
    ? globalFollowed
    : Boolean(post.author?.isFollowing || post.author?.isFollowed);
  const globalFollowRequestPending = isFollowRequestPending(authorId, authorHandle);
  const isFollowRequestPendingForAuthor = globalFollowRequestPending !== undefined
    ? globalFollowRequestPending
    : Boolean(post.author?.followRequestPending);

  // Double-tap heart animation
  const lastTapRef = useRef(0);
  const heartScaleAnim = useRef(new Animated.Value(0)).current;
  const heartOpacityAnim = useRef(new Animated.Value(0)).current;

  // Extract all media (supports post.images array or single post.image)
  const mediaList = useMemo(() => {
    if (Array.isArray(post.images) && post.images.length > 0) {
      return post.images.filter((img) => typeof img === 'string' && img.trim().length > 0);
    }
    if (post.image && typeof post.image === 'string' && post.image.trim().length > 0) {
      return [post.image];
    }
    return [];
  }, [post.images, post.image]);

  const hasMedia = mediaList.length > 0;
  const isVideoUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    return /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(url) || url.includes('/uploads/videos/') || url.includes('/reels/');
  };
  const isVideoPost = useMemo(
    () => mediaList.some(isVideoUrl),
    [mediaList]
  );
  const activeMediaUri = mediaList[activeIndex] || mediaList[0];
  const isActiveMediaVideo = isVideoUrl(activeMediaUri);
  const activeVideoAspectRatio = videoAspectRatios[activeMediaUri] || 9 / 16;
  const currentMediaHeight = isActiveMediaVideo
    ? Math.round(SCREEN_WIDTH / activeVideoAspectRatio)
    : MEDIA_HEIGHT;

  const handleVideoSizeChange = useCallback((size) => {
    const ratio = getVideoAspectRatio(size?.width, size?.height);
    if (!ratio || !activeMediaUri) return;
    setVideoAspectRatios((previous) => (
      previous[activeMediaUri] === ratio ? previous : { ...previous, [activeMediaUri]: ratio }
    ));
  }, [activeMediaUri]);

  useEffect(() => {
    viewedPostIdRef.current = null;
    setViewsCount(post?.viewsCount || '0');
  }, [post?.id]);

  const handleVideoPlaybackStarted = async () => {
    if (!post?.id || viewedPostIdRef.current === post.id) return;
    viewedPostIdRef.current = post.id;
    try {
      const result = await TiwiAPI.recordPostView(post.id, currentUser?.id);
      if (result?.viewsCount !== undefined) setViewsCount(String(result.viewsCount));
    } catch (error) {
      viewedPostIdRef.current = null;
      console.warn('[PostCard] Could not record video view:', error?.message || error);
    }
  };

  // Like Toggle
  const handleLike = async () => {
    const nextState = !isLiked;
    setIsLiked(nextState);

    const currentNum = parseCount(likesCount);
    const updatedNum = nextState ? currentNum + 1 : Math.max(0, currentNum - 1);
    setLikesCount(formatCount(updatedNum));

    try {
      await TiwiAPI.toggleLikePost(post.id, currentUser?.id);
    } catch (err) {
      // Ignored
    }
  };

  // Double Tap Trigger for Heart Popup
  const triggerHeartAnimation = () => {
    heartScaleAnim.setValue(0);
    heartOpacityAnim.setValue(1);
    Animated.parallel([
      Animated.spring(heartScaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(450),
        Animated.timing(heartOpacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  };

  const singleTapTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
    };
  }, []);

  const handleMediaPress = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 280;
    if (now - lastTapRef.current < DOUBLE_PRESS_DELAY) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      triggerHeartAnimation();
      if (!isLiked) {
        handleLike();
      }
    } else {
      singleTapTimerRef.current = setTimeout(() => {
        if (onPress) {
          onPress(post);
        }
      }, DOUBLE_PRESS_DELAY);
    }
    lastTapRef.current = now;
  };

  // Bookmark / Save Toggle
  const handleSave = async () => {
    setIsSaved(!isSaved);
    try {
      await TiwiAPI.toggleBookmarkPost(post.id, currentUser?.id);
    } catch (err) {
      // Ignored
    }
  };

  // Repost Toggle
  const handleRepost = async () => {
    const nextState = !isReposted;
    setIsReposted(nextState);

    const currentNum = parseCount(repostsCount);
    const updatedNum = nextState ? currentNum + 1 : Math.max(0, currentNum - 1);
    setRepostsCount(formatCount(updatedNum));

    try {
      await TiwiAPI.toggleRepost(post.id, currentUser?.id);
    } catch (err) {
      // Ignored
    }
  };

  // Share
  const handleShare = async () => {
    try {
      await Share.share({
        message: `${post.author?.name || 'User'} on Tiwi: "${currentCaption || ''}" ${BASE_URL}/post/${post.id}`,
      });
    } catch (err) {
      // Ignored
    }
  };

  // Caption Copy
  const handleCopyCaption = async () => {
    if (!currentCaption) return;
    try {
      await Clipboard.setStringAsync(currentCaption);
      Alert.alert('Copied to Clipboard', 'Post text has been copied.');
    } catch (err) {
      console.warn('Clipboard copy error:', err);
    }
  };

  // Edit Post Handler
  const handleEditSubmit = async () => {
    if (isSavingEdit) return;
    setIsSavingEdit(true);
    try {
      await TiwiAPI.editPost(post.id, editCaptionText, currentUser?.id);
      setCurrentCaption(editCaptionText);
      setIsEditing(false);
      if (onEditPost) onEditPost(post.id, editCaptionText);
      Alert.alert('Success', 'Post updated successfully.');
    } catch (err) {
      Alert.alert('Update Failed', err.message || 'Could not update post');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleHidePost = () => {
    setIsPostHidden(true);
    onHidePost?.(post.id || post._id);
  };

  const handleToggleAuthorFollow = async () => {
    if (followRequestInFlightRef.current || !post.author) return;
    followRequestInFlightRef.current = true;
    try {
      await toggleFollowUser({
        ...post.author,
        id: post.author.id || post.author._id || post.author_id || post.user_id,
        handle: post.author.handle,
      });
    } catch (error) {
      console.warn('[PostCard] Follow update failed:', error?.message || error);
    } finally {
      followRequestInFlightRef.current = false;
    }
  };

  // Delete Post Handler
  const handleDeleteSubmit = async () => {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await TiwiAPI.deletePost(post.id, currentUser?.id);
      setIsPostDeleted(true);
      setDeleteConfirmVisible(false);
      if (onDeletePost) onDeletePost(post.id);
      Alert.alert('Deleted', 'Post has been removed.');
    } catch (err) {
      Alert.alert('Delete Failed', err.message || 'Could not delete post');
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle Pin Handler
  const handleTogglePin = async () => {
    try {
      const nextPin = !isPinned;
      setIsPinned(nextPin);
      await TiwiAPI.pinPost(post.id, currentUser?.id);
      Alert.alert(nextPin ? 'Pinned' : 'Unpinned', nextPin ? 'Post pinned to top of profile.' : 'Post unpinned.');
    } catch (err) {
      // Ignored
    }
  };

  // Share to Feed (Repost)
  const handleShareToFeed = async () => {
    setShareDrawerVisible(false);
    await handleRepost();
    Alert.alert('Shared', 'Post has been shared to your feed.');
  };

  // Report submit
  const handleReportSubmit = (reason) => {
    setReportReason(reason);
    setReportSubmitted(true);
    setTimeout(() => {
      setReportDrawerVisible(false);
      setReportSubmitted(false);
      Alert.alert('Report Submitted', 'Thank you. Our moderation team will review this post.');
    }, 1500);
  };

  // Scroll Tracking for Multi-Media Carousel
  const handleScroll = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== activeIndex && index >= 0 && index < mediaList.length) {
      setActiveIndex(index);
    }
  };

  if (isPostDeleted || isPostHidden) return null;

  // Caption logic
  const captionText = currentCaption || '';
  const CAPTION_LIMIT = 90;
  const isLongCaption = captionText.length > CAPTION_LIMIT;
  const displayedCaption = isLongCaption && !isExpanded
    ? `${captionText.slice(0, CAPTION_LIMIT).trim()}...`
    : captionText;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBg,
          borderBottomColor: theme.borderLight,
        },
      ]}
    >
      {/* 1. Author Row: Avatar, Name, Handle, Timestamp, Options */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.authorInfo}
          onPress={() => onProfilePress && onProfilePress(post.author)}
          activeOpacity={0.8}
        >
          <Image
            source={{
              uri:
                (currentUser && (post.author?.id === currentUser.id || post.author?.handle === currentUser.handle) && currentUser.avatar)
                  ? currentUser.avatar
                  : (post.author?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`),
            }}
            style={styles.authorAvatar}
          />
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.authorName, { color: theme.text }]} numberOfLines={1}>
                {post.author?.name || 'User'}
              </Text>
              {post.author?.isVerified && (
                <TouchableOpacity
                  onPress={(e) => {
                    e?.stopPropagation && e.stopPropagation();
                    setVerifiedDrawerVisible(true);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                >
                  <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} style={styles.verifiedIcon} />
                </TouchableOpacity>
              )}
              {post.author?.accountType === 'business' && (
                <View style={[styles.businessBadge, { backgroundColor: isDarkMode ? COLORS.hex_283344 : COLORS.primaryLight }]}>
                  <Text style={[styles.businessBadgeText, { color: theme.primary }]}>Brand</Text>
                </View>
              )}
              {isOtherAuthor && (
                <TouchableOpacity
                  style={styles.inlineFollowButton}
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    void handleToggleAuthorFollow();
                  }}
                  activeOpacity={0.6}
                  disabled={isFollowRequestPendingForAuthor}
                  accessibilityRole="button"
                  accessibilityLabel={isFollowRequestPendingForAuthor ? 'Follow request sent' : isAuthorFollowed ? 'Unfollow user' : 'Follow user'}
                >
                  <Text
                    style={[
                      styles.inlineFollowText,
                      { color: isAuthorFollowed || isFollowRequestPendingForAuthor ? theme.textSecondary : COLORS.primary },
                    ]}
                  >
                    {isFollowRequestPendingForAuthor ? 'Requested' : isAuthorFollowed ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.handleText, { color: theme.textMuted }]}>
              {post.author?.handle || '@user'} • {formatTimeAgo(post.createdAt || post.timestamp || post.created_at || post.timeAgo)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Borderless 3-Dots Button */}
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => setMenuVisible(true)}
            style={styles.dotsButton}
            activeOpacity={0.6}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Post options"
          >
            <Ionicons name="ellipsis-horizontal" size={19} color={theme.textSecondary} />
          </TouchableOpacity>
          {isOtherAuthor && (
            <TouchableOpacity
              onPress={handleHidePost}
              style={styles.hidePostButton}
              activeOpacity={0.65}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Hide this post"
            >
              <Ionicons name="close" size={19} color={theme.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* 2. Post Caption Text (Facebook-style: ABOVE photos/videos with See more / See less and Long-Press to Copy) */}
      {!!captionText && (
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={() => {
            if (onPress) onPress(post);
          }}
          onLongPress={handleCopyCaption}
          delayLongPress={350}
          style={styles.captionContainer}
        >
          <Text style={[styles.captionText, { color: theme.text }]}>
            {displayedCaption}
            {isLongCaption && (
              <Text
                style={[styles.seeMoreBtn, { color: theme.primary }]}
                onPress={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? '  See less' : ' See more'}
              </Text>
            )}
          </Text>
        </TouchableOpacity>
      )}

      {/* 3. Sensitive / Violated Content Frosted Broken Glass Cover (Borderless Full Frame) */}
      {post.isPolicyViolated ? (
        <View style={styles.violationBackdropContainer}>
          {/* Frosted / Broken Glass Layer */}
          <LinearGradient
            colors={isDarkMode ? [COLORS.hex_1F0E13, COLORS.hex_2B1218, COLORS.hex_140C10, COLORS.hex_0A090B] : [COLORS.hex_F0E4E6, COLORS.hex_DEC8CB, COLORS.hex_EBDCE0, COLORS.hex_CBBEC2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={[styles.blurredVeil1, { backgroundColor: isDarkMode ? COLORS.rgba_239_68_68_0p16 : COLORS.rgba_220_38_38_0p18 }]} />
          <View style={[styles.blurredVeil2, { backgroundColor: isDarkMode ? COLORS.rgba_59_130_246_0p14 : COLORS.rgba_37_99_235_0p15 }]} />
          <View style={[styles.blurredVeil3, { backgroundColor: isDarkMode ? COLORS.rgba_168_85_247_0p12 : COLORS.rgba_147_51_234_0p14 }]} />
          <View style={[styles.blurredDarkVeil, { backgroundColor: isDarkMode ? COLORS.rgba_0_0_0_0p6 : COLORS.rgba_255_255_255_0p6 }]} />

          {/* Borderless Center Overlay (Directly on Full Frame Blur) */}
          <View style={styles.violationCenterBox}>
            <View
              style={[
                styles.violationIconBadge,
                { backgroundColor: isDarkMode ? COLORS.rgba_239_68_68_0p22 : COLORS.rgba_220_38_38_0p14 },
              ]}
            >
              <Ionicons name="eye-off-outline" size={32} color={isDarkMode ? COLORS.hex_F87171 : COLORS.hex_DC2626} />
            </View>
            <Text style={[styles.violationHeadline, { color: isDarkMode ? COLORS.hex_F9FAFB : COLORS.hex_111827 }]}>
              Content unavailable
            </Text>
            <Text style={[styles.violationSubtext, { color: isDarkMode ? COLORS.hex_D1D5DB : COLORS.hex_4B5563 }]}>
              {post.violationDetails?.reason
                ? `This photo was removed for violating community standards (${post.violationDetails.reason}).`
                : 'This photo was removed for violating safety and community standards.'}
            </Text>
            <TouchableOpacity
              style={[
                styles.violationLearnMoreBtn,
                { backgroundColor: isDarkMode ? COLORS.rgba_255_255_255_0p18 : COLORS.rgba_0_0_0_0p08 },
              ]}
              onPress={() => setLearnMoreVisible(true)}
              activeOpacity={0.75}
            >
              <Text style={[styles.violationLearnMoreText, { color: isDarkMode ? COLORS.white : COLORS.hex_111827 }]}>
                Learn more
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        hasMedia && (
          <View style={[styles.mediaContainer, { height: currentMediaHeight }]}>
            {/* Top-Right Multi-Media Counter Badge (e.g. 1/3) */}
            {mediaList.length > 1 && (
              <View style={styles.carouselBadge}>
                <Text style={styles.carouselBadgeText}>
                  {activeIndex + 1}/{mediaList.length}
                </Text>
              </View>
            )}

            {/* Double-Tap Heart Animation Overlay */}
            <Animated.View
              style={[
                styles.heartOverlay,
                {
                  opacity: heartOpacityAnim,
                  transform: [{ scale: heartScaleAnim }],
                },
              ]}
            >
              <Ionicons name="heart" size={90} color={COLORS.white} style={styles.heartShadow} />
            </Animated.View>

            {/* Full-Width Carousel / Single Image or Video */}
            {mediaList.length === 1 ? (
              isVideoUrl(mediaList[0]) ? (
                <View style={[styles.slideItem, { height: currentMediaHeight }]}>
                  <TiwiVideoPlayer
                    sourceUri={mediaList[0]}
                    posterUri={post.image && post.image !== mediaList[0] ? post.image : null}
                    style={{ width: SCREEN_WIDTH, height: currentMediaHeight }}
                    resizeMode="cover"
                    isActive={isActive}
                    isMuted={isVideoMuted}
                    loop={true}
                    showControls={true}
                    onPress={() => onPress && onPress(post)}
                    onPlaybackStarted={handleVideoPlaybackStarted}
                    onVideoSizeChange={handleVideoSizeChange}
                  />
                </View>
              ) : (
                <Pressable onPress={handleMediaPress} style={[styles.slideItem, { height: currentMediaHeight }]}>
                  <Image
                    source={{ uri: mediaList[0] }}
                    style={[styles.fullMediaImage, { height: currentMediaHeight }]}
                    resizeMode="cover"
                  />
                </Pressable>
              )
            ) : (
              <FlatList
                data={mediaList}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                snapToInterval={SCREEN_WIDTH}
                snapToAlignment="start"
                decelerationRate="fast"
                scrollEventThrottle={16}
                onScroll={handleScroll}
                keyExtractor={(item, index) => `${item}_${index}`}
                renderItem={({ item, index }) => (
                  <View style={[styles.slideItem, { height: currentMediaHeight }]}>
                    {isVideoUrl(item) ? (
                      <TiwiVideoPlayer
                        sourceUri={item}
                        posterUri={post.image && post.image !== item ? post.image : null}
                        style={{ width: SCREEN_WIDTH, height: currentMediaHeight }}
                        resizeMode="cover"
                        isActive={isActive && activeIndex === index}
                        isMuted={isVideoMuted}
                        loop={true}
                        showControls={true}
                        onPress={() => onPress && onPress(post)}
                        onPlaybackStarted={handleVideoPlaybackStarted}
                        onVideoSizeChange={index === activeIndex ? handleVideoSizeChange : undefined}
                      />
                    ) : (
                      <Pressable onPress={handleMediaPress} style={[styles.slideItem, { height: currentMediaHeight }]}>
                        <Image
                          source={{ uri: item }}
                          style={[styles.fullMediaImage, { height: currentMediaHeight }]}
                          resizeMode="cover"
                        />
                      </Pressable>
                    )}
                  </View>
                )}
              />
            )}
            {isActiveMediaVideo && (
              <TouchableOpacity
                style={styles.videoSoundButton}
                onPress={(event) => {
                  event?.stopPropagation?.();
                  setIsVideoMuted((muted) => !muted);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={isVideoMuted ? 'Unmute video' : 'Mute video'}
              >
                <Ionicons
                  name={isVideoMuted ? 'volume-mute' : 'volume-high'}
                  size={18}
                  color={COLORS.white}
                />
              </TouchableOpacity>
            )}
          </View>
        )
      )}

      {/* Post actions */}
      <View style={[styles.actionsRow, { borderTopColor: theme.borderLight }]}>
        <View style={styles.actionsLeft}>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={handleLike}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`${isLiked ? 'Unlike' : 'Like'}, ${formatCount(parseCount(likesCount))}`}
          >
            <Feather
              name="heart"
              size={19}
              color={isLiked ? COLORS.hex_E11D48 : theme.textSecondary}
              fill={isLiked ? COLORS.hex_E11D48 : 'transparent'}
              strokeWidth={2}
            />
            <Text style={[styles.actionCountText, { color: isLiked ? COLORS.hex_E11D48 : theme.textSecondary }]}>
              {formatCount(parseCount(likesCount))}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => onCommentPress && onCommentPress(post)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Reply, ${formatCount(parseCount(post.commentsCount ?? post.comments?.length ?? 0))} comments`}
          >
            <Feather name="message-circle" size={19} color={theme.textSecondary} strokeWidth={2} />
            <Text style={[styles.actionCountText, { color: theme.textSecondary }]}>
              {formatCount(parseCount(post.commentsCount ?? post.comments?.length ?? 0))}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={handleRepost}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`Repost, ${formatCount(parseCount(repostsCount))}`}
          >
            <Feather name="repeat" size={19} color={isReposted ? COLORS.hex_16A34A : theme.textSecondary} strokeWidth={2} />
            <Text style={[styles.actionCountText, { color: isReposted ? COLORS.hex_16A34A : theme.textSecondary }]}>
              {formatCount(parseCount(repostsCount))}
            </Text>
          </TouchableOpacity>

          {isVideoPost && (
            <View
              style={styles.actionIconBtn}
              accessibilityRole="text"
              accessibilityLabel={`${viewsCount} video views`}
            >
              <Feather name="bar-chart-2" size={19} color={theme.textSecondary} strokeWidth={2} />
              <Text style={[styles.actionCountText, { color: theme.textSecondary }]}>
                {formatCount(parseCount(viewsCount))}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => setShareDrawerVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel="Share post"
          >
            <Feather name="share" size={18} color={theme.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.bookmarkBtn}
          onPress={handleSave}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={isSaved ? 'Remove bookmark' : 'Bookmark post'}
        >
          <Feather
            name="bookmark"
            size={19}
            color={isSaved ? theme.primary : theme.textSecondary}
            fill={isSaved ? theme.primary : 'transparent'}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>

      {/* 5. Post Options Bottom Sheet Menu Drawer */}
      <SharedDrawer
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        showHandle={true}
        scrollable={true}
      >
        {/* Post Snippet Info */}
        <View style={styles.menuHeaderRow}>
          <Image
            source={{
              uri:
                post.author?.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author?.name || 'User')}&background=0B57D0&color=fff&size=100&bold=true`,
            }}
            style={styles.menuAuthorAvatar}
          />
          <View style={styles.menuHeaderTextCol}>
            <Text style={[styles.menuPostAuthor, { color: theme.text }]} numberOfLines={1}>
              {post.author?.name || 'User'}
            </Text>
            <Text style={[styles.menuPostSnippet, { color: theme.textMuted }]} numberOfLines={1}>
              {currentCaption ? `"${currentCaption}"` : post.author?.handle || '@user'}
            </Text>
          </View>
        </View>

        <View style={[styles.menuDivider, { backgroundColor: theme.borderLight }]} />

        {isOwnPost ? (
          /* OWN POST MENU OPTIONS */
          <>
            {/* Edit Post */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={() => {
                setMenuVisible(false);
                setEditCaptionText(currentCaption);
                setIsEditing(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons name="create-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>Edit Post</Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Modify caption or description</Text>
              </View>
            </TouchableOpacity>

            {/* Pin to Profile */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={() => {
                setMenuVisible(false);
                handleTogglePin();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons name={isPinned ? 'pin' : 'pin-outline'} size={20} color={isPinned ? theme.primary : theme.text} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>
                  {isPinned ? 'Unpin from Profile' : 'Pin to Profile'}
                </Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>
                  {isPinned ? 'Remove from top of your profile' : 'Highlight at the top of your profile'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Copy Link */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={async () => {
                setMenuVisible(false);
                await Clipboard.setStringAsync(`${BASE_URL}/post/${post.id}`);
                Alert.alert('Link Copied', 'Direct post link copied to clipboard.');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons name="link-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>Copy Link</Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Share direct link to this post</Text>
              </View>
            </TouchableOpacity>

            {/* Share Post */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={() => {
                setMenuVisible(false);
                setShareDrawerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons name="share-social-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>Share Post</Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Share to feed or other apps</Text>
              </View>
            </TouchableOpacity>

            {/* Delete Post */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={() => {
                setMenuVisible(false);
                setDeleteConfirmVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.rgba_239_68_68_0p15 : COLORS.hex_FEE2E2 }]}>
                <Ionicons name="trash-outline" size={20} color={COLORS.hex_EF4444} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: COLORS.hex_EF4444 }]}>Delete Post</Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Permanently remove from Tiwi</Text>
              </View>
            </TouchableOpacity>
          </>
        ) : (
          /* OTHER USERS POST MENU OPTIONS */
          <>
            {/* Action Item 1: Save Post */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={() => {
                setMenuVisible(false);
                handleSave();
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={20}
                  color={isSaved ? theme.primary : theme.text}
                />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>
                  {isSaved ? 'Saved in Bookmarks' : 'Save Post'}
                </Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>
                  {isSaved ? 'Saved in your bookmarks collection' : 'Add to your saved collection for later'}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Action Item 2: Copy Caption */}
            {!!currentCaption && (
              <TouchableOpacity
                style={styles.menuActionItem}
                onPress={() => {
                  setMenuVisible(false);
                  handleCopyCaption();
                }}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                  <Ionicons name="copy-outline" size={20} color={theme.text} />
                </View>
                <View style={styles.menuActionTextCol}>
                  <Text style={[styles.menuActionTitle, { color: theme.text }]}>Copy Text</Text>
                  <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Copy post caption to clipboard</Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Action Item 3: Copy Link */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={async () => {
                setMenuVisible(false);
                await Clipboard.setStringAsync(`${BASE_URL}/post/${post.id}`);
                Alert.alert('Link Copied', 'Post link copied to clipboard.');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons name="link-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>Copy Link</Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Copy direct link to this post</Text>
              </View>
            </TouchableOpacity>

            {/* Action Item 4: Share Via */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={() => {
                setMenuVisible(false);
                setShareDrawerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons name="share-social-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>Share Post</Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Share outside Tiwi</Text>
              </View>
            </TouchableOpacity>

            {/* Action Item 5: Not interested */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={() => {
                setMenuVisible(false);
                Alert.alert('Feedback Recorded', 'You will see fewer posts like this.');
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons name="eye-off-outline" size={20} color={theme.text} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: theme.text }]}>Not Interested</Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Tune your feed recommendations</Text>
              </View>
            </TouchableOpacity>

            {/* Action Item 6: Report */}
            <TouchableOpacity
              style={styles.menuActionItem}
              onPress={() => {
                setMenuVisible(false);
                setReportDrawerVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                <Ionicons name="flag-outline" size={20} color={COLORS.hex_EF4444} />
              </View>
              <View style={styles.menuActionTextCol}>
                <Text style={[styles.menuActionTitle, { color: COLORS.hex_EF4444 }]}>Report Post</Text>
                <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Report spam or policy violations</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </SharedDrawer>

      {/* Share Drawer */}
      <SharedDrawer
        visible={shareDrawerVisible}
        onClose={() => setShareDrawerVisible(false)}
        title="Share Post"
        subtitle="Share this post with friends or to your feed"
      >
        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={handleShareToFeed}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_1B2E4B : COLORS.primaryLight }]}>
            <Ionicons name="repeat" size={20} color={theme.primary} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={[styles.menuActionTitle, { color: theme.text }]}>Share to Feed (Repost)</Text>
            <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Instantly share to your followers' feeds</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={async () => {
            setShareDrawerVisible(false);
            await Clipboard.setStringAsync(`${BASE_URL}/post/${post.id}`);
            Alert.alert('Link Copied', 'Direct post link copied to clipboard.');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
            <Ionicons name="link-outline" size={20} color={theme.text} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={[styles.menuActionTitle, { color: theme.text }]}>Copy Link</Text>
            <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Copy post link to clipboard</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={() => {
            setShareDrawerVisible(false);
            handleShare();
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
            <Ionicons name="share-social-outline" size={20} color={theme.text} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={[styles.menuActionTitle, { color: theme.text }]}>Share via Apps...</Text>
            <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>Send via WhatsApp, Messenger, or other apps</Text>
          </View>
        </TouchableOpacity>
      </SharedDrawer>

      {/* Report Post Drawer */}
      <SharedDrawer
        visible={reportDrawerVisible}
        onClose={() => setReportDrawerVisible(false)}
        title="Report Post"
        subtitle="Help us understand the issue"
      >
        {reportSubmitted ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Ionicons name="checkmark-circle" size={48} color={COLORS.hex_16A34A} style={{ marginBottom: 12 }} />
            <Text style={[styles.menuActionTitle, { color: theme.text, fontSize: 16, marginBottom: 6 }]}>Report Submitted</Text>
            <Text style={[styles.menuActionSub, { color: theme.textMuted, textAlign: 'center' }]}>
              Thank you for helping keep Tiwi safe. Our safety team will review this content.
            </Text>
          </View>
        ) : (
          <View>
            {[
              { id: 'spam', title: 'Spam or Scam', desc: 'Misleading links, scams, or repeated posts' },
              { id: 'harassment', title: 'Harassment or Bullying', desc: 'Targeted attacks or threats' },
              { id: 'hate', title: 'Hate Speech', desc: 'Attacks based on identity or beliefs' },
              { id: 'nudity', title: 'Adult or Sexual Content', desc: 'Explicit imagery or contraband' },
              { id: 'violence', title: 'Violence or Dangerous Content', desc: 'Graphic violence or harmful behavior' },
            ].map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.menuActionItem}
                onPress={() => handleReportSubmit(item.title)}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIconCircle, { backgroundColor: isDarkMode ? COLORS.hex_282A2C : COLORS.inputBackground }]}>
                  <Ionicons name="flag-outline" size={18} color={COLORS.hex_EF4444} />
                </View>
                <View style={styles.menuActionTextCol}>
                  <Text style={[styles.menuActionTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={[styles.menuActionSub, { color: theme.textMuted }]}>{item.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </SharedDrawer>

      {/* Delete Confirmation Drawer */}
      <SharedDrawer
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        title="Delete Post?"
        subtitle="This action cannot be undone"
      >
        <View style={{ paddingVertical: 12 }}>
          <Text style={[styles.policyDrawerIntro, { color: theme.textSecondary, marginBottom: 20 }]}>
            Are you sure you want to permanently delete this post? All likes, comments, and media associated with it will be removed.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.border, flex: 1 }]}
              onPress={() => setDeleteConfirmVisible(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteBtn, { backgroundColor: COLORS.hex_EF4444, flex: 1 }]}
              onPress={handleDeleteSubmit}
              disabled={isDeleting}
              activeOpacity={0.8}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.deleteBtnText}>Delete</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SharedDrawer>

      {/* Edit Post Drawer */}
      <SharedDrawer
        visible={isEditing}
        onClose={() => setIsEditing(false)}
        title="Edit Post"
        subtitle="Update your caption"
      >
        <View style={{ paddingVertical: 12 }}>
          <TextInput
            style={[
              styles.editInput,
              {
                color: theme.text,
                backgroundColor: isDarkMode ? COLORS.hex_1E232A : COLORS.hex_F8FAFC,
                borderColor: theme.border,
              },
            ]}
            multiline
            numberOfLines={4}
            value={editCaptionText}
            onChangeText={setEditCaptionText}
            placeholder="What's on your mind?"
            placeholderTextColor={theme.textMuted}
          />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: theme.border, flex: 1 }]}
              onPress={() => setIsEditing(false)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary, flex: 1 }]}
              onPress={handleEditSubmit}
              disabled={isSavingEdit}
              activeOpacity={0.85}
            >
              {isSavingEdit ? (
                <ActivityIndicator size="small" color={isDarkMode ? COLORS.hex_040E28 : COLORS.white} />
              ) : (
                <Text style={[styles.saveBtnText, { color: isDarkMode ? COLORS.hex_040E28 : COLORS.white }]}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SharedDrawer>

      {/* Policy Learn More Bottom Sheet Drawer */}
      <SharedDrawer
        visible={learnMoreVisible}
        onClose={() => setLearnMoreVisible(false)}
        title="Tiwlo Community Standards"
        subtitle="Adult & Sexually Explicit Content Policy"
        footer={
          <TouchableOpacity
            style={[styles.drawerDoneBtn, { backgroundColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary }]}
            onPress={() => setLearnMoreVisible(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.drawerDoneBtnText, { color: isDarkMode ? COLORS.hex_040E28 : COLORS.white }]}>Got it</Text>
          </TouchableOpacity>
        }
      >
        <View style={styles.policyDrawerContent}>
          <Text style={[styles.policyDrawerIntro, { color: isDarkMode ? COLORS.hex_E3E3E3 : COLORS.text }]}>
            To maintain a safe, respectful, and family-friendly community, Tiwlo does not allow adult, sexually explicit, or contraband content on public feeds.
          </Text>

          <View style={styles.policyBulletRow}>
            <Ionicons name="close-circle-outline" size={20} color={COLORS.hex_D93025} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={[styles.policyBulletText, { color: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary }]}>
              Nudity, partially or excessively unclad photos, and sexually suggestive imagery are prohibited.
            </Text>
          </View>

          <View style={styles.policyBulletRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={isDarkMode ? COLORS.hex_8AB4F8 : COLORS.primary} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={[styles.policyBulletText, { color: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary }]}>
              Violating media is immediately purged from platform storage and covered from view.
            </Text>
          </View>

          <View style={styles.policyBulletRow}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.warning} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={[styles.policyBulletText, { color: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary }]}>
              Accounts with repeated strikes face a 24-hour publishing freeze or permanent termination.
            </Text>
          </View>
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
            style={[styles.drawerDoneBtn, { backgroundColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary }]}
            onPress={() => setVerifiedDrawerVisible(false)}
            activeOpacity={0.85}
          >
            <Text style={[styles.drawerDoneBtnText, { color: isDarkMode ? COLORS.hex_040E28 : COLORS.white }]}>Got it</Text>
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
            <Text style={{ fontWeight: '700', color: theme.text }}>{post.author?.name || 'this creator'}</Text>{' '}
            ({post.author?.handle || '@user'}).
          </Text>

          <View style={styles.policyBulletRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={COLORS.primary} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={[styles.policyBulletText, { color: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary }]}>
              Identity Verified: Phone, email, and creator credentials verified.
            </Text>
          </View>

          <View style={styles.policyBulletRow}>
            <Ionicons name="sparkles-outline" size={20} color={COLORS.primary} style={{ marginRight: 10, marginTop: 2 }} />
            <Text style={[styles.policyBulletText, { color: isDarkMode ? COLORS.hex_C4C7C5 : COLORS.textSecondary }]}>
              Trusted Member: Adheres to Tiwlo Community Standards and Terms of Service.
            </Text>
          </View>
        </View>
      </SharedDrawer>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 0,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  verifiedIcon: {
    marginTop: 1,
  },
  businessBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 4,
  },
  businessBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  handleText: {
    fontSize: 12,
    marginTop: 2,
  },
  dotsButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  hidePostButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  inlineFollowButton: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
    paddingHorizontal: 2,
  },
  inlineFollowText: {
    fontSize: 12,
    fontWeight: '700',
  },
  captionContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  captionText: {
    fontSize: 14.5,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  seeMoreBtn: {
    fontWeight: '700',
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: MEDIA_HEIGHT,
    backgroundColor: COLORS.hex_0F172A,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 8,
  },
  slideItem: {
    width: SCREEN_WIDTH,
    height: MEDIA_HEIGHT,
  },
  fullMediaImage: {
    width: SCREEN_WIDTH,
    height: MEDIA_HEIGHT,
  },
  carouselBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: COLORS.rgba_15_23_42_0p75,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 10,
  },
  carouselBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  videoSoundButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.rgba_0_0_0_0p55,
    zIndex: 25,
  },
  heartOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 20,
    pointerEvents: 'none',
  },
  heartShadow: {
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  actionsLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginRight: 6,
  },
  actionIconBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  actionCountText: {
    fontSize: 11.5,
    fontWeight: '500',
  },
  bookmarkBtn: {
    padding: 6,
    borderRadius: 18,
  },
  // Post Options Menu Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.rgba_0_0_0_0p55,
    justifyContent: 'flex-end',
  },
  menuSheet: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 10,
    paddingBottom: 32,
    paddingHorizontal: 18,
    elevation: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.hex_8E918F,
    alignSelf: 'center',
    marginBottom: 14,
  },
  menuHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  menuAuthorAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.hex_E2E8F0,
  },
  menuHeaderTextCol: {
    flex: 1,
  },
  menuPostAuthor: {
    fontSize: 15,
    fontWeight: '700',
  },
  menuPostSnippet: {
    fontSize: 12.5,
    marginTop: 2,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 10,
    width: '100%',
  },
  menuActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuActionTextCol: {
    flex: 1,
  },
  menuActionTitle: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  menuActionSub: {
    fontSize: 11.5,
    marginTop: 1,
  },
  // Sensitive Content Frosted Broken Glass Cover (Borderless Full Frame)
  violationBackdropContainer: {
    width: '100%',
    height: MEDIA_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.hex_0F172A,
  },
  blurredVeil1: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -50,
    left: -40,
    transform: [{ scaleX: 1.6 }, { rotate: '25deg' }],
  },
  blurredVeil2: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    bottom: -40,
    right: -30,
    transform: [{ scaleY: 1.5 }, { rotate: '-35deg' }],
  },
  blurredVeil3: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: '30%',
    left: '25%',
    transform: [{ scale: 1.4 }],
  },
  blurredDarkVeil: {
    ...StyleSheet.absoluteFillObject,
  },
  violationCenterBox: {
    width: '100%',
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  violationIconBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  violationHeadline: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  violationSubtext: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 12,
  },
  violationLearnMoreBtn: {
    height: 38,
    paddingHorizontal: 22,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  violationLearnMoreText: {
    fontSize: 13.5,
    fontWeight: '700',
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
  policyDrawerContent: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  policyDrawerIntro: {
    fontSize: 14.5,
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: '500',
  },
  policyBulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  policyBulletText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
  },
  drawerDoneBtn: {
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  drawerDoneBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 15,
    minHeight: 110,
    textAlignVertical: 'top',
  },
  cancelBtn: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  saveBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  deleteBtn: {
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
