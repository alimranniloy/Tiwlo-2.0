import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  FlatList,
  TouchableOpacity,
  Image,
  Animated,
  Alert,
  Share,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
  Pressable,
} from 'react-native';
import { LinearGradient } from '../components/SafeLinearGradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../context/AuthContext';
import { TiwiAPI } from '../services/tiwiApi';
import CommentsModal from '../components/CommentsModal';
import SoundDetailModal from '../components/SoundDetailModal';
import RemixModal from '../components/RemixModal';
import ShortsCameraModal from '../components/ShortsCameraModal';
import SharedDrawer from '../components/SharedDrawer';
import TiwiVideoPlayer from '../components/TiwiVideoPlayer';
import { LAYOUT } from '../config/layout';
import { getScreenDataCache } from '../utils/screenDataCache';
import { COLORS } from '../config/colors';

const { width: SCREEN_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const createFeedReel = (params) => {
  const { openReel, videoUri } = params || {};
  if (!openReel || !videoUri) return null;
  const postId = openReel.id || openReel._id;
  return {
    ...openReel,
    id: `feed-${postId || videoUri}`,
    videoUrl: videoUri,
    image: openReel.image || videoUri,
    audioTitle: openReel.audioTitle || `Original sound - ${openReel.author?.name || 'Creator'}`,
    likesCount: openReel.likesCount || '0',
    commentsCount: openReel.commentsCount || '0',
    viewsCount: openReel.viewsCount || '0',
  };
};

// Format counts: 12400 -> "12.4K"
const formatCount = (val) => {
  if (val === null || val === undefined) return '0';
  if (typeof val === 'number') {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}K`;
    return val.toString();
  }
  const str = String(val).trim();
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10);
  if (str.toUpperCase().includes('K') || str.toUpperCase().includes('M')) return str;
  if (!num) return str || '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

export default function ReelsScreen({ onNavigate, routeParams }) {
  const { theme, isDarkMode, currentUser, isVideoMuted, setIsVideoMuted, isUserFollowed, toggleFollowUser } = useAuth();
  const insets = useSafeAreaInsets();
  const bottomNavClearance = Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) + 76;

  const [containerHeight, setContainerHeight] = useState(
    WINDOW_HEIGHT - (56 + Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8))
  );

  const openFeedReel = createFeedReel(routeParams);
  const [reels, setReels] = useState(() => openFeedReel ? [openFeedReel] : []);
  const [loading, setLoading] = useState(!openFeedReel);
  const [refreshing, setRefreshing] = useState(false);
  const activeReelUserRef = useRef(currentUser?.id);
  const networkReelsLoadedRef = useRef(false);
  const [activeReelIndex, setActiveReelIndex] = useState(0);

  // Comments Modal
  const [activeCommentReel, setActiveCommentReel] = useState(null);

  // Reels Options Menu Modal
  const [optionsMenuVisible, setOptionsMenuVisible] = useState(false);

  // Sound Details Modal
  const [soundModalVisible, setSoundModalVisible] = useState(false);
  const [selectedSoundReel, setSelectedSoundReel] = useState(null);

  // Remix Modal
  const [remixModalVisible, setRemixModalVisible] = useState(false);
  const [selectedRemixReel, setSelectedRemixReel] = useState(null);

  // YouTube Shorts Camera Studio Modal
  const [cameraModalVisible, setCameraModalVisible] = useState(false);
  const [cameraInitialSound, setCameraInitialSound] = useState(null);
  const [cameraRemixMode, setCameraRemixMode] = useState(null);
  const [cameraRemixReel, setCameraRemixReel] = useState(null);

  // Create Reel Modal State (Fallback)
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [reelCaption, setReelCaption] = useState('');
  const [reelAudioTitle, setReelAudioTitle] = useState('');
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [uploadingReel, setUploadingReel] = useState(false);

  // Followed channels map
  const [followedMap, setFollowedMap] = useState({});

  // Disliked reels map
  const [dislikedMap, setDislikedMap] = useState({});

  // Vinyl disc spin animation
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Load Reels from Backend
  const loadReels = useCallback(async (preferredReel = null) => {
    const requestedUserId = currentUser?.id;
    try {
      const data = await TiwiAPI.getReels(requestedUserId);
      if (activeReelUserRef.current === requestedUserId && Array.isArray(data)) {
        if (preferredReel) {
          const preferredSource = preferredReel.videoUrl || preferredReel.image;
          const matchingReel = data.find((reel) => (
            (reel.videoUrl || reel.image) === preferredSource
          ));
          const selectedReel = matchingReel || preferredReel;
          const remainingReels = data.filter((reel) => (
            reel.id !== selectedReel.id && (reel.videoUrl || reel.image) !== preferredSource
          ));
          setReels([selectedReel, ...remainingReels]);
          setActiveReelIndex(0);
        } else {
          setReels(data);
        }
        networkReelsLoadedRef.current = true;
      }
    } catch (err) {
      console.warn('Error loading reels:', err);
    } finally {
      if (activeReelUserRef.current === requestedUserId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [currentUser?.id]);

  useEffect(() => {
    let isCurrent = true;
    activeReelUserRef.current = currentUser?.id;
    networkReelsLoadedRef.current = false;
    setReels(openFeedReel ? [openFeedReel] : []);
    setActiveReelIndex(0);
    setLoading(!openFeedReel);
    if (!openFeedReel) {
      getScreenDataCache(`reels:${currentUser?.id || 'guest'}`).then((cachedReels) => {
        if (!isCurrent || networkReelsLoadedRef.current || !Array.isArray(cachedReels) || cachedReels.length === 0) return;
        setReels(cachedReels);
        setLoading(false);
      });
    }
    loadReels(openFeedReel);
    return () => {
      isCurrent = false;
    };
  }, [currentUser?.id, loadReels, routeParams?.openReel?.id, routeParams?.videoUri]);

  const onRefresh = () => {
    setRefreshing(true);
    loadReels();
  };

  // Like Toggle
  const handleToggleLike = async (reel) => {
    const isCurrentlyLiked = reel.isLiked;
    const currentNum = parseInt(String(reel.likesCount || '0').replace(/[^0-9]/g, ''), 10) || 0;
    const updatedCount = isCurrentlyLiked ? Math.max(0, currentNum - 1) : currentNum + 1;

    setReels((prev) =>
      prev.map((r) =>
        r.id === reel.id
          ? { ...r, isLiked: !isCurrentlyLiked, likesCount: formatCount(updatedCount) }
          : r
      )
    );

    if (dislikedMap[reel.id]) {
      setDislikedMap((prev) => ({ ...prev, [reel.id]: false }));
    }

    try {
      await TiwiAPI.toggleLikeReel(reel.id, currentUser?.id);
    } catch (err) {
      console.warn('Error toggling reel like:', err);
    }
  };

  // Dislike Toggle
  const handleToggleDislike = async (reelId) => {
    setDislikedMap((prev) => ({ ...prev, [reelId]: true }));
    try {
      await TiwiAPI.markReelNotInterested(reelId, currentUser?.id);
      setReels((prev) => prev.filter((reel) => reel.id !== reelId));
    } catch (err) {
      setDislikedMap((prev) => ({ ...prev, [reelId]: false }));
      Alert.alert('Could not save feedback', err.message || 'Please try again.');
    }
  };

  const handleReportReel = async (reel) => {
    try {
      await TiwiAPI.reportReel(reel.id, 'inappropriate', currentUser?.id);
      Alert.alert('Report Submitted', 'Thank you for reporting this Short.');
    } catch (err) {
      Alert.alert('Could not submit report', err.message || 'Please try again.');
    }
  };

  const handleDeleteReel = (reel) => {
    Alert.alert('Delete Short?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await TiwiAPI.deleteReel(reel.id, currentUser?.id);
          setReels((prev) => prev.filter((item) => item.id !== reel.id));
          setOptionsMenuVisible(false);
        } catch (err) {
          Alert.alert('Could not delete Short', err.message || 'Please try again.');
        }
      } },
    ]);
  };

  // Follow / Unfollow Toggle ("Follow" instead of "Subscribe")
  const handleToggleFollow = async (author) => {
    try {
      await toggleFollowUser(author);
    } catch (err) {
      // Ignored
    }
  };

  // Native Share
  const handleShare = async (reel) => {
    try {
      await Share.share({
        message: `${reel.author?.name || 'Creator'} on Tiwi Shorts: "${reel.caption || ''}" https://tiwlo.com/shorts/${reel.id}`,
      });
    } catch (err) {
      // Ignored
    }
  };

  // Open Full YouTube Shorts Sound Page
  const handleSoundPress = (reel) => {
    setSelectedSoundReel(reel);
    setSoundModalVisible(true);
  };

  // Open YouTube Shorts Remix Modal
  const handleRemixPress = (reel) => {
    setSelectedRemixReel(reel);
    setRemixModalVisible(true);
  };

  // Handle Remix selection
  const handleSelectRemixOption = (optionId, reel) => {
    if (optionId === 'sound') {
      setCameraInitialSound({
        title: reel.audioTitle || 'Original Sound',
        artist: reel.author?.name || 'Creator',
        cover: reel.image || reel.videoUrl,
      });
      setCameraRemixMode(null);
      setCameraRemixReel(null);
    } else {
      setCameraRemixMode(optionId);
      setCameraRemixReel(reel);
      setCameraInitialSound({
        title: reel.audioTitle || 'Original Sound',
        artist: reel.author?.name || 'Creator',
        cover: reel.image || reel.videoUrl,
      });
    }
    setCameraModalVisible(true);
  };

  // Handle Use Sound from SoundDetailModal
  const handleUseSoundFromModal = (soundInfo) => {
    setCameraInitialSound(soundInfo);
    setCameraRemixMode(null);
    setCameraRemixReel(null);
    setCameraModalVisible(true);
  };

  // Handle Short Published
  const handleShortPublished = (newShort) => {
    setReels((prev) => [newShort, ...prev]);
  };

  // Pick Media for new Short
  const handlePickMedia = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Permission to access gallery is required to create a Short.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setSelectedMedia(asset);
      }
    } catch (err) {
      Alert.alert('Upload Error', err.message || 'Failed to select media.');
    }
  };

  // Publish Short to Backend
  const handlePublishReel = async () => {
    if (!selectedMedia && !reelCaption.trim()) {
      Alert.alert('Missing Details', 'Please attach a video/photo and write a caption for your Short.');
      return;
    }

    setUploadingReel(true);
    try {
      const isVideo = selectedMedia?.type === 'video' ||
        (selectedMedia?.mimeType && selectedMedia.mimeType.startsWith('video/')) ||
        /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(selectedMedia?.fileName || selectedMedia?.uri || '');
      let uploadedUrl = selectedMedia?.uri || '';
      if (selectedMedia?.base64 || selectedMedia?.uri) {
        const fileMeta = {
          fileName: selectedMedia?.fileName || (isVideo ? `reel_${Date.now()}.mp4` : `photo_${Date.now()}.jpg`),
          mimeType: selectedMedia?.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg'),
          mediaType: isVideo ? 'video' : 'image',
        };
        uploadedUrl = await TiwiAPI.uploadMedia(selectedMedia.uri, 'reels', isVideo ? null : selectedMedia.base64, currentUser?.id, fileMeta);
      }

      const newReel = await TiwiAPI.createReel({
        caption: reelCaption.trim(),
        videoUrl: isVideo ? uploadedUrl : null,
        image: uploadedUrl,
        audioTitle: reelAudioTitle.trim() || `Original sound - ${currentUser?.name || 'Creator'}`,
        userId: currentUser?.id,
      });

      setReels((prev) => [newReel, ...prev]);
      setReelCaption('');
      setReelAudioTitle('');
      setSelectedMedia(null);
      setCreateModalVisible(false);
      Alert.alert('Short Published! 🚀', 'Your Short has been published to Tiwi Shorts feed.');
    } catch (err) {
      Alert.alert('Publish Failed', err.message || 'Could not publish Short.');
    } finally {
      setUploadingReel(false);
    }
  };

  // Track active scroll item
  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      setActiveReelIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;

  // Active reel object for options menu
  const activeReel = reels[activeReelIndex] || reels[0];

  // Render individual YouTube Short Page
  const renderReelItem = ({ item }) => {
    const isLiked = item.isLiked;
    const isDisliked = !!dislikedMap[item.id];
    const userFollowed = isUserFollowed(item.author?.id, item.author?.handle);
    const isFollowed = userFollowed !== undefined ? userFollowed : !!(item.author?.isFollowing || item.author?.isFollowed || followedMap[item.author?.handle]);
    const mediaUri = item.videoUrl || item.image;
    const isVideo = !!item.videoUrl || (typeof mediaUri === 'string' && /\.(mp4|mov|webm|mkv|m4v)(\?|$)/i.test(mediaUri));

    return (
      <View style={[styles.reelPage, { height: containerHeight }]}>
        {/* 1. Background Video Player / Image with Edge-to-Edge Fill */}
        <View style={styles.mediaPressable}>
          {isVideo ? (
            <TiwiVideoPlayer
              sourceUri={item.videoUrl || mediaUri}
              posterUri={item.image && item.image !== item.videoUrl ? item.image : null}
              isActive={item.id === activeReel?.id}
              isMuted={isVideoMuted}
              loop={true}
              resizeMode="cover"
              style={styles.fullScreenMedia}
            />
          ) : (
            <Image
              source={{ uri: mediaUri }}
              style={styles.fullScreenMedia}
              resizeMode="cover"
            />
          )}

          {/* Top and Bottom Dark Gradient Overlay for readability */}
          <LinearGradient
            colors={[COLORS.rgba_0_0_0_0p55, COLORS.named_transparent]}
            style={styles.topVignette}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[COLORS.named_transparent, COLORS.rgba_0_0_0_0p3, COLORS.rgba_0_0_0_0p9]}
            style={styles.bottomVignette}
            pointerEvents="none"
          />
        </View>

        {/* 2. Right Action Column (YouTube Shorts Iconic Actions) */}
        <View style={[styles.rightActionColumn, { bottom: bottomNavClearance }]}>
          {/* 1. Like (Thumbs Up) */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => handleToggleLike(item)}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons
                name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                size={25}
                color={isLiked ? COLORS.shortsAccent : COLORS.white}
              />
            </View>
            <Text style={styles.actionItemLabel}>{formatCount(item.likesCount || 0)}</Text>
          </TouchableOpacity>

          {isVideo && (
            <TouchableOpacity
              style={styles.actionItem}
              onPress={() => setIsVideoMuted((muted) => !muted)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={isVideoMuted ? 'Unmute video' : 'Mute video'}
            >
              <View style={styles.actionIconCircle}>
                <Ionicons
                  name={isVideoMuted ? 'volume-mute' : 'volume-high'}
                  size={20}
                  color={COLORS.white}
                />
              </View>
              <Text style={styles.actionItemLabel}>{isVideoMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>
          )}

          {/* 2. Dislike (Thumbs Down) */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => handleToggleDislike(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons
                name={isDisliked ? 'thumbs-down' : 'thumbs-down-outline'}
                size={25}
                color={COLORS.white}
              />
            </View>
            <Text style={styles.actionItemLabel}>Dislike</Text>
          </TouchableOpacity>

          {/* 3. Comments */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => setActiveCommentReel(item)}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.white} />
            </View>
            <Text style={styles.actionItemLabel}>
              {formatCount(item.commentsCount || (item.comments ? item.comments.length : 0))}
            </Text>
          </TouchableOpacity>

          {/* 4. Share */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => handleShare(item)}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="arrow-redo-outline" size={25} color={COLORS.white} />
            </View>
            <Text style={styles.actionItemLabel}>Share</Text>
          </TouchableOpacity>

          {/* 5. YouTube Shorts Remix */}
          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => handleRemixPress(item)}
            activeOpacity={0.7}
          >
            <View style={styles.actionIconCircle}>
              <Ionicons name="flash-outline" size={23} color={COLORS.white} />
            </View>
            <Text style={styles.actionItemLabel}>Remix</Text>
          </TouchableOpacity>

          {/* 6. Rotating Vinyl Audio Disc (Snug at bottom right) */}
          <TouchableOpacity
            style={styles.vinylContainer}
            onPress={() => handleSoundPress(item)}
            activeOpacity={0.8}
          >
            <Animated.View style={[styles.discRing, { transform: [{ rotate: spin }] }]}>
              <Image
                source={{
                  uri:
                    item.author?.avatar ||
                    'https://ui-avatars.com/api/?name=User&background=0B57D0&color=fff',
                }}
                style={styles.discThumb}
              />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* 3. Bottom-Left Details (Channel, Caption, Original Audio - Down near Navbar) */}
        <View style={[styles.bottomInfoBlock, { bottom: bottomNavClearance }]}>
          {/* Channel Info & Follow Button ("Follow" instead of "Subscribe") */}
          <View style={styles.channelRow}>
            <TouchableOpacity
              style={styles.channelBadge}
              onPress={() => onNavigate && onNavigate('profile', item.author)}
              activeOpacity={0.8}
            >
              <Image
                source={{
                  uri:
                    item.author?.avatar ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(item.author?.name || 'User')}&background=0B57D0&color=fff`,
                }}
                style={styles.channelAvatar}
              />
              <Text style={styles.channelName} numberOfLines={1}>
                {item.author?.handle || `@${(item.author?.name || 'user').toLowerCase().replace(/\s+/g, '')}`}
              </Text>
              {item.author?.isVerified && (
                <Ionicons name="checkmark-circle" size={14} color={COLORS.hex_3B82F6} style={{ marginLeft: 3 }} />
              )}
            </TouchableOpacity>

            {/* Red Follow Pill Button */}
            <TouchableOpacity
              style={[
                styles.followBtn,
                isFollowed ? styles.followedBtn : styles.unfollowedBtn,
              ]}
              onPress={() => handleToggleFollow(item.author)}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.followText,
                  isFollowed ? styles.followedText : styles.unfollowedText,
                ]}
              >
                {isFollowed ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Caption / Title */}
          {!!item.caption && (
            <Text style={styles.captionText} numberOfLines={2}>
              {item.caption}
            </Text>
          )}

          {/* Original Audio Sound Bar (YouTube Shorts Style) */}
          <TouchableOpacity
            style={styles.audioSoundBar}
            onPress={() => handleSoundPress(item)}
            activeOpacity={0.8}
          >
            <Ionicons name="musical-notes" size={13} color={COLORS.white} style={{ marginRight: 6 }} />
            <Text style={styles.audioTitleText} numberOfLines={1}>
              {item.audioTitle || `Original sound - ${item.author?.name || 'Creator'}`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View
      style={styles.container}
      onLayout={(e) => {
        const { height } = e.nativeEvent.layout;
        if (height > 0 && Math.abs(height - containerHeight) > 1) {
          setContainerHeight(height);
        }
      }}
    >
      {/* 1. YouTube Shorts Top Navigation Bar Overlay */}
      <View style={[styles.topHeaderOverlay, { top: insets.top }]}>
        <Text style={styles.shortsHeaderTitle}>Shorts</Text>
        <View style={styles.topHeaderRight}>
          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => onNavigate && onNavigate('search')}
            activeOpacity={0.7}
          >
            <Ionicons name="search" size={23} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => {
              setCameraInitialSound(null);
              setCameraRemixMode(null);
              setCameraRemixReel(null);
              setCameraModalVisible(true);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="camera-outline" size={25} color={COLORS.white} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => setOptionsMenuVisible(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Vertical Full-Page Feed (Buttery Smooth 1-by-1 Snapping, No Multi-Post Skipping) */}
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.shortsAccent} />
          <Text style={styles.loadingText}>Loading Shorts...</Text>
        </View>
      ) : (
        <FlatList
          data={reels}
          renderItem={renderReelItem}
          keyExtractor={(item) => item.videoUrl || item.image || item.id}
          pagingEnabled={Platform.OS === 'ios'}
          disableIntervalMomentum={true}
          showsVerticalScrollIndicator={false}
          snapToInterval={containerHeight}
          snapToAlignment="start"
          decelerationRate="fast"
          scrollEventThrottle={16}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshing={refreshing}
          onRefresh={onRefresh}
          extraData={containerHeight}
          getItemLayout={(data, index) => ({
            length: containerHeight,
            offset: containerHeight * index,
            index,
          })}
        />
      )}

      {/* 3. Reels Options Menu Drawer */}
      <SharedDrawer
        visible={optionsMenuVisible}
        onClose={() => setOptionsMenuVisible(false)}
        showHandle={true}
        scrollable={true}
      >
        <View style={styles.menuHeaderRow}>
          <Ionicons name="play-circle" size={24} color={COLORS.shortsAccent} />
          <View style={styles.menuHeaderTextCol}>
            <Text style={[styles.menuTitleText, { color: COLORS.white }]} numberOfLines={1}>
              Shorts Options
            </Text>
            <Text style={styles.menuSubText} numberOfLines={1}>
              {activeReel?.caption || 'Tiwi Shorts Experience'}
            </Text>
          </View>
        </View>

        <View style={styles.menuDivider} />

        {/* Option 1: Create New Short */}
        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={() => {
            setOptionsMenuVisible(false);
            setCameraInitialSound(null);
            setCameraRemixMode(null);
            setCameraRemixReel(null);
            setCameraModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconCircle}>
            <Ionicons name="camera-outline" size={20} color={COLORS.white} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={styles.menuActionTitle}>Create New Short</Text>
            <Text style={styles.menuActionSub}>Record or upload from gallery</Text>
          </View>
        </TouchableOpacity>

        {/* Option 2: Copy Link */}
        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={async () => {
            setOptionsMenuVisible(false);
            if (activeReel) {
              await Clipboard.setStringAsync(`https://tiwlo.com/shorts/${activeReel.id}`);
              Alert.alert('Link Copied', 'Short link copied to clipboard.');
            }
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconCircle}>
            <Ionicons name="link-outline" size={20} color={COLORS.white} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={styles.menuActionTitle}>Copy Link</Text>
            <Text style={styles.menuActionSub}>Share direct link to this Short</Text>
          </View>
        </TouchableOpacity>

        {/* Option 3: Sound Details */}
        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={() => {
            setOptionsMenuVisible(false);
            if (activeReel) handleSoundPress(activeReel);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconCircle}>
            <Ionicons name="musical-notes-outline" size={20} color={COLORS.white} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={styles.menuActionTitle}>Audio Details</Text>
            <Text style={styles.menuActionSub}>{activeReel?.audioTitle || 'Original Sound'}</Text>
          </View>
        </TouchableOpacity>

        {/* Option 4: Share */}
        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={() => {
            setOptionsMenuVisible(false);
            if (activeReel) handleShare(activeReel);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconCircle}>
            <Ionicons name="share-social-outline" size={20} color={COLORS.white} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={styles.menuActionTitle}>Share</Text>
            <Text style={styles.menuActionSub}>Send to friends and external apps</Text>
          </View>
        </TouchableOpacity>

        {activeReel?.author?.id === currentUser?.id && (
          <TouchableOpacity
            style={styles.menuActionItem}
            onPress={() => handleDeleteReel(activeReel)}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconCircle}>
              <Ionicons name="trash-outline" size={20} color={COLORS.hex_EF4444} />
            </View>
            <View style={styles.menuActionTextCol}>
              <Text style={[styles.menuActionTitle, { color: COLORS.hex_EF4444 }]}>Delete Short</Text>
              <Text style={styles.menuActionSub}>Permanently remove your Short</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Option 5: Not Interested */}
        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={() => {
            setOptionsMenuVisible(false);
            if (activeReel) handleToggleDislike(activeReel.id);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconCircle}>
            <Ionicons name="eye-off-outline" size={20} color={COLORS.white} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={styles.menuActionTitle}>Not Interested</Text>
            <Text style={styles.menuActionSub}>See fewer shorts like this</Text>
          </View>
        </TouchableOpacity>

        {/* Option 6: Report */}
        <TouchableOpacity
          style={styles.menuActionItem}
          onPress={() => {
            setOptionsMenuVisible(false);
            if (activeReel) handleReportReel(activeReel);
          }}
          activeOpacity={0.7}
        >
          <View style={styles.menuIconCircle}>
            <Ionicons name="flag-outline" size={20} color={COLORS.hex_EF4444} />
          </View>
          <View style={styles.menuActionTextCol}>
            <Text style={[styles.menuActionTitle, { color: COLORS.hex_EF4444 }]}>Report</Text>
            <Text style={styles.menuActionSub}>Report inappropriate or spam content</Text>
          </View>
        </TouchableOpacity>
      </SharedDrawer>

      {/* 4. Create Short Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={[styles.createModalRoot, { backgroundColor: COLORS.hex_0F0F0F, paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.createModalHeader}>
            <TouchableOpacity onPress={() => setCreateModalVisible(false)} style={styles.modalBackBtn}>
              <Ionicons name="close" size={26} color={COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.createModalTitle}>Create Short</Text>
            <TouchableOpacity
              style={[
                styles.publishShortBtn,
                { backgroundColor: (!selectedMedia && !reelCaption.trim()) ? COLORS.hex_333333 : COLORS.shortsAccent },
              ]}
              onPress={handlePublishReel}
              disabled={uploadingReel || (!selectedMedia && !reelCaption.trim())}
            >
              {uploadingReel ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.publishShortText}>Upload</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Media Preview Box */}
          <TouchableOpacity
            style={styles.mediaPickerBox}
            onPress={handlePickMedia}
            activeOpacity={0.85}
          >
            {selectedMedia ? (
              <Image source={{ uri: selectedMedia.uri }} style={styles.pickedMediaImage} />
            ) : (
              <View style={styles.mediaPickerPlaceholder}>
                <Ionicons name="videocam" size={48} color={COLORS.shortsAccent} />
                <Text style={styles.pickerTitle}>Select Video or Photo</Text>
                <Text style={styles.pickerSub}>Tap to browse from your device gallery</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Caption Input */}
          <View style={styles.captionInputContainer}>
            <TextInput
              style={styles.captionInput}
              placeholder="Caption your Short (#Shorts, #Trending)..."
              placeholderTextColor={COLORS.hex_888888}
              multiline
              value={reelCaption}
              onChangeText={setReelCaption}
            />
          </View>

          {/* Audio Title Input */}
          <View style={styles.audioInputRow}>
            <Ionicons name="musical-note" size={20} color={COLORS.shortsAccent} />
            <TextInput
              style={styles.audioInput}
              placeholder={`Original sound - ${currentUser?.name || 'Creator'}`}
              placeholderTextColor={COLORS.hex_888888}
              value={reelAudioTitle}
              onChangeText={setReelAudioTitle}
            />
          </View>

          {/* Quick Hashtags Chips */}
          <View style={styles.hashtagRow}>
            {['#Shorts', '#Viral', '#Tiwi', '#Trending', '#Tech'].map((tag) => (
              <TouchableOpacity
                key={tag}
                style={styles.tagChip}
                onPress={() => setReelCaption((prev) => `${prev} ${tag}`.trim())}
              >
                <Text style={styles.tagChipText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* 5. YouTube Shorts Sound Details Modal */}
      <SoundDetailModal
        visible={soundModalVisible}
        reel={selectedSoundReel}
        allReels={reels}
        onClose={() => setSoundModalVisible(false)}
        onUseSound={handleUseSoundFromModal}
        onSelectReel={(r) => {
          setSoundModalVisible(false);
          const foundIdx = reels.findIndex((item) => item.id === r.id);
          if (foundIdx >= 0) setActiveReelIndex(foundIdx);
        }}
      />

      {/* 6. YouTube Shorts Remix Modal */}
      <RemixModal
        visible={remixModalVisible}
        reel={selectedRemixReel}
        onClose={() => setRemixModalVisible(false)}
        onSelectOption={handleSelectRemixOption}
      />

      {/* 7. YouTube Shorts Camera Creation Studio */}
      <ShortsCameraModal
        visible={cameraModalVisible}
        initialSound={cameraInitialSound}
        remixMode={cameraRemixMode}
        remixReel={cameraRemixReel}
        onClose={() => {
          setCameraModalVisible(false);
          setCameraInitialSound(null);
          setCameraRemixMode(null);
          setCameraRemixReel(null);
        }}
        onShortPublished={handleShortPublished}
      />

      {/* 8. Comments Modal for Reels */}
      <CommentsModal
        visible={!!activeCommentReel}
        post={activeCommentReel}
        onClose={() => setActiveCommentReel(null)}
        onCommentAdded={(reelId, newCount) => {
          setReels((prev) =>
            prev.map((r) => (r.id === reelId ? { ...r, commentsCount: String(newCount) } : r))
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.black,
  },
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  // Top Header Overlay
  topHeaderOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
    zIndex: 30,
  },
  shortsHeaderTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  topIconBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Reel Full-Page Item
  reelPage: {
    width: SCREEN_WIDTH,
    position: 'relative',
    backgroundColor: COLORS.black,
    overflow: 'hidden',
  },
  mediaPressable: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  fullScreenMedia: {
    width: '100%',
    height: '100%',
  },
  topVignette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 5,
  },
  bottomVignette: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 240,
    zIndex: 5,
  },
  // Right Floating Action Column (Snug near bottom, no gap)
  rightActionColumn: {
    position: 'absolute',
    right: 12,
    bottom: 84,
    alignItems: 'center',
    gap: 10,
    zIndex: 20,
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.rgba_0_0_0_0p45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionItemLabel: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: COLORS.rgba_0_0_0_0p8,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  vinylContainer: {
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: COLORS.hex_333333,
    backgroundColor: COLORS.hex_111111,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  discThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  // Bottom-Left Info Block (Down near bottom, no gap above navbar)
  bottomInfoBlock: {
    position: 'absolute',
    left: 14,
    right: 76,
    bottom: 84,
    zIndex: 20,
    gap: 5,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  channelBadge: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  channelAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.white,
    backgroundColor: COLORS.hex_333333,
  },
  channelName: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '800',
    flexShrink: 1,
    textShadowColor: COLORS.rgba_0_0_0_0p8,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  followBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  unfollowedBtn: {
    backgroundColor: COLORS.hex_CC0000,
  },
  followedBtn: {
    backgroundColor: COLORS.rgba_255_255_255_0p25,
  },
  followText: {
    fontSize: 11,
    fontWeight: '800',
  },
  unfollowedText: {
    color: COLORS.white,
  },
  followedText: {
    color: COLORS.white,
  },
  captionText: {
    color: COLORS.white,
    fontSize: 12.5,
    lineHeight: 16,
    textShadowColor: COLORS.rgba_0_0_0_0p8,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  audioSoundBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_0_0_0_0p5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    maxWidth: '100%',
  },
  audioTitleText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  // Reels Menu Styles
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
  menuHeaderTextCol: {
    flex: 1,
  },
  menuTitleText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  menuSubText: {
    color: COLORS.hex_8E918F,
    fontSize: 12,
    marginTop: 2,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.hex_333537,
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
    backgroundColor: COLORS.hex_282A2C,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuActionTextCol: {
    flex: 1,
  },
  menuActionTitle: {
    color: COLORS.white,
    fontSize: 14.5,
    fontWeight: '600',
  },
  menuActionSub: {
    color: COLORS.hex_8E918F,
    fontSize: 11.5,
    marginTop: 1,
  },
  // Create Short Modal
  createModalRoot: {
    flex: 1,
    paddingHorizontal: 16,
  },
  createModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hex_272727,
  },
  modalBackBtn: {
    padding: 6,
  },
  createModalTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '800',
  },
  publishShortBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 18,
  },
  publishShortText: {
    color: COLORS.white,
    fontWeight: '800',
    fontSize: 13.5,
  },
  mediaPickerBox: {
    width: '100%',
    height: 240,
    backgroundColor: COLORS.hex_1E1E1E,
    borderRadius: 16,
    marginTop: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: COLORS.hex_333333,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedMediaImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mediaPickerPlaceholder: {
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
  },
  pickerTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
  pickerSub: {
    color: COLORS.hex_888888,
    fontSize: 12,
    textAlign: 'center',
  },
  captionInputContainer: {
    marginTop: 16,
    backgroundColor: COLORS.hex_1E1E1E,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.hex_333333,
  },
  captionInput: {
    color: COLORS.white,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  audioInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.hex_1E1E1E,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.hex_333333,
  },
  audioInput: {
    color: COLORS.white,
    fontSize: 14,
    flex: 1,
  },
  hashtagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  tagChip: {
    backgroundColor: COLORS.hex_272727,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagChipText: {
    color: COLORS.shortsAccent,
    fontSize: 12,
    fontWeight: '700',
  },
});
