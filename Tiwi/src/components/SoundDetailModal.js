import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  Animated,
  Share,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import * as Clipboard from 'expo-clipboard';
import ScreenHeader from './ScreenHeader';
import { BASE_URL } from '../config/api';
import { COLORS } from '../config/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - 32 - 16) / 3;
const GRID_ITEM_HEIGHT = GRID_ITEM_WIDTH * (16 / 9);

export default function SoundDetailModal({
  visible,
  sound,
  reel,
  allReels = [],
  onClose,
  onUseSound,
  onSelectReel,
}) {
  const { theme, isDarkMode } = useAuth();
  const insets = useSafeAreaInsets();

  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  // Soundwave / Equalizer animation bars
  const bar1 = useRef(new Animated.Value(0.3)).current;
  const bar2 = useRef(new Animated.Value(0.7)).current;
  const bar3 = useRef(new Animated.Value(0.5)).current;
  const bar4 = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    let anim;
    if (isPlaying) {
      anim = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(bar1, { toValue: 1, duration: 280, useNativeDriver: true }),
            Animated.timing(bar1, { toValue: 0.2, duration: 280, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(bar2, { toValue: 0.2, duration: 320, useNativeDriver: true }),
            Animated.timing(bar2, { toValue: 1, duration: 320, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(bar3, { toValue: 0.9, duration: 250, useNativeDriver: true }),
            Animated.timing(bar3, { toValue: 0.3, duration: 250, useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(bar4, { toValue: 0.3, duration: 350, useNativeDriver: true }),
            Animated.timing(bar4, { toValue: 1, duration: 350, useNativeDriver: true }),
          ]),
        ])
      );
      anim.start();
    } else {
      bar1.setValue(0.3);
      bar2.setValue(0.7);
      bar3.setValue(0.5);
      bar4.setValue(0.9);
    }
    return () => anim && anim.stop();
  }, [isPlaying]);

  // Audio simulation progress ticker
  useEffect(() => {
    let interval;
    if (isPlaying) {
      interval = setInterval(() => {
        setPlaybackProgress((prev) => {
          if (prev >= 1) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.05;
        });
      }, 500);
    } else {
      setPlaybackProgress(0);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Extract sound properties
  const soundTitle = sound?.title || reel?.audioTitle || 'Original Sound';
  const soundArtist = sound?.artist || reel?.author?.name || 'Creator';
  const soundAvatar = sound?.avatar || reel?.author?.avatar || 'https://ui-avatars.com/api/?name=Sound&background=0B57D0&color=fff';
  const soundCover = sound?.cover || reel?.image || reel?.videoUrl || soundAvatar;
  const videosCount = sound?.videosCount || '14.2K';
  const duration = sound?.duration || '0:30';

  // Filter or mock shorts that use this sound
  const shortsUsingSound = allReels.length > 0 ? allReels : (reel ? [reel] : []);

  const handleShareSound = async () => {
    try {
      await Share.share({
        message: `Listen to "${soundTitle}" by ${soundArtist} on Tiwi Shorts 🎵 ${BASE_URL}/sound/${encodeURIComponent(soundTitle)}`,
      });
    } catch (e) {
      // Ignored
    }
  };

  const handleToggleSave = () => {
    setIsSaved(!isSaved);
    Alert.alert(
      !isSaved ? 'Sound Saved! 🎵' : 'Removed from Saved Sounds',
      !isSaved ? 'Added to your Saved Sounds library.' : 'Removed from your library.'
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: COLORS.black }]}>
        {/* 1. Standardized ScreenHeader aligned to exact layout baseline */}
        <ScreenHeader
          title="Sound Details"
          leftIcon="arrow-back"
          onLeftPress={onClose}
          isModal={true}
          isImmersive={true}
          customBg={COLORS.black}
          rightElement={
            <View style={styles.navRight}>
              <TouchableOpacity onPress={handleToggleSave} style={styles.iconBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={22}
                  color={isSaved ? COLORS.hex_3B82F6 : COLORS.white}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleShareSound} style={styles.iconBtn} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="share-social-outline" size={22} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          }
        />

        {/* 2. Scrollable Body: Hero Audio Info + CTA + Grid of Shorts */}
        <FlatList
          data={shortsUsingSound}
          numColumns={3}
          keyExtractor={(item, index) => item.id || `short_${index}`}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.heroSection}>
              {/* Sound Card (Cover + Waveform Play Button + Titles) */}
              <View style={styles.soundHeroCard}>
                {/* Album Cover Artwork with Play/Pause Button */}
                <TouchableOpacity
                  style={styles.coverWrapper}
                  onPress={() => setIsPlaying(!isPlaying)}
                  activeOpacity={0.85}
                >
                  <Image source={{ uri: soundCover }} style={styles.coverImage} />
                  <View style={styles.playOverlay}>
                    <Ionicons
                      name={isPlaying ? 'pause' : 'play'}
                      size={26}
                      color={COLORS.white}
                      style={!isPlaying ? { marginLeft: 2 } : {}}
                    />
                  </View>
                </TouchableOpacity>

                {/* Sound Title, Artist, & Usage Metadata */}
                <View style={styles.heroInfoBlock}>
                  <Text style={styles.soundTitleText} numberOfLines={2}>
                    {soundTitle}
                  </Text>
                  <Text style={styles.soundArtistText} numberOfLines={1}>
                    {soundArtist}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons name="videocam-outline" size={14} color={COLORS.hex_AAAAAA} />
                    <Text style={styles.metaCountText}>{videosCount} Shorts</Text>
                    <Text style={styles.metaDot}>•</Text>
                    <Ionicons name="time-outline" size={13} color={COLORS.hex_AAAAAA} />
                    <Text style={styles.metaCountText}>{duration}</Text>
                  </View>

                  {/* Equalizer Waveform Indicator if playing */}
                  {isPlaying && (
                    <View style={styles.equalizerRow}>
                      <Animated.View style={[styles.eqBar, { transform: [{ scaleY: bar1 }] }]} />
                      <Animated.View style={[styles.eqBar, { transform: [{ scaleY: bar2 }] }]} />
                      <Animated.View style={[styles.eqBar, { transform: [{ scaleY: bar3 }] }]} />
                      <Animated.View style={[styles.eqBar, { transform: [{ scaleY: bar4 }] }]} />
                      <Text style={styles.playingLabel}>Previewing audio...</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Progress Bar of Audio Preview */}
              {isPlaying && (
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: `${playbackProgress * 100}%` }]} />
                </View>
              )}

              {/* YouTube Signature Big CTA: "Use this sound" */}
              <TouchableOpacity
                style={styles.useSoundBtn}
                onPress={() => {
                  onClose();
                  if (onUseSound) {
                    onUseSound({
                      title: soundTitle,
                      artist: soundArtist,
                      cover: soundCover,
                    });
                  }
                }}
                activeOpacity={0.85}
              >
                <Ionicons name="camera" size={19} color={COLORS.black} style={{ marginRight: 8 }} />
                <Text style={styles.useSoundBtnText}>Use this sound</Text>
              </TouchableOpacity>

              {/* Section Header: Shorts using this sound */}
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="flame" size={18} color={COLORS.shortsAccent} style={{ marginRight: 6 }} />
                <Text style={styles.sectionHeadingText}>Shorts with this audio</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.gridCard}
              onPress={() => {
                onClose();
                if (onSelectReel) onSelectReel(item);
              }}
              activeOpacity={0.8}
            >
              <Image
                source={{ uri: item.videoUrl || item.image }}
                style={styles.gridCardImage}
                resizeMode="cover"
              />
              <View style={styles.gridOverlay}>
                <Ionicons name="play" size={11} color={COLORS.white} style={{ marginRight: 3 }} />
                <Text style={styles.gridViewsText}>{item.likesCount || '10K'}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptyGridContainer}>
              <Ionicons name="musical-notes-outline" size={40} color={COLORS.hex_666666} />
              <Text style={styles.emptyGridText}>Be the first to make a Short with this sound!</Text>
            </View>
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.hex_272727,
  },
  navTitle: {
    color: COLORS.white,
    fontSize: 16.5,
    fontWeight: '700',
    flex: 1,
    marginLeft: 12,
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  listContent: {
    paddingBottom: 40,
  },
  heroSection: {
    padding: 16,
  },
  soundHeroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  coverWrapper: {
    width: 90,
    height: 90,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: COLORS.hex_1E1E1E,
    borderWidth: 1,
    borderColor: COLORS.hex_333333,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.rgba_0_0_0_0p4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroInfoBlock: {
    flex: 1,
  },
  soundTitleText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  soundArtistText: {
    color: COLORS.hex_AAAAAA,
    fontSize: 13.5,
    fontWeight: '600',
    marginTop: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  metaCountText: {
    color: COLORS.hex_888888,
    fontSize: 12,
    fontWeight: '500',
  },
  metaDot: {
    color: COLORS.hex_888888,
    fontSize: 12,
    marginHorizontal: 3,
  },
  equalizerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
    height: 16,
  },
  eqBar: {
    width: 3,
    height: 14,
    backgroundColor: COLORS.shortsAccent,
    borderRadius: 2,
  },
  playingLabel: {
    color: COLORS.shortsAccent,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: COLORS.hex_272727,
    borderRadius: 2,
    marginTop: 14,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COLORS.shortsAccent,
  },
  useSoundBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.white,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 18,
    shadowColor: COLORS.white,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  useSoundBtnText: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  sectionHeadingText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
  },
  gridCard: {
    width: GRID_ITEM_WIDTH,
    height: GRID_ITEM_HEIGHT,
    marginHorizontal: 5,
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: COLORS.hex_1E1E1E,
    position: 'relative',
  },
  gridCardImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.rgba_0_0_0_0p65,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  gridViewsText: {
    color: COLORS.white,
    fontSize: 10.5,
    fontWeight: '700',
  },
  emptyGridContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyGridText: {
    color: COLORS.hex_888888,
    fontSize: 13,
    textAlign: 'center',
  },
});
