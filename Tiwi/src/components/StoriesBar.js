import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from './SafeLinearGradient';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config/colors';

export default function StoriesBar({ stories = [], onAddStory, onStoryPress }) {
  const { theme, isDarkMode, currentUser } = useAuth();

  const defaultAvatar = currentUser?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=0B57D0&color=fff&size=400&bold=true`
    : 'https://ui-avatars.com/api/?name=User&background=0B57D0&color=fff&size=400&bold=true';

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* 1. Futuristic "Add Story" Card - Clean & Polished */}
        <TouchableOpacity
          style={[
            styles.storyCard,
            styles.addStoryCard,
            {
              backgroundColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.white,
              borderColor: isDarkMode ? COLORS.hex_333537 : COLORS.border,
            },
          ]}
          onPress={onAddStory}
          activeOpacity={0.85}
        >
          {/* Top 68% Image Area with User Avatar */}
          <View style={styles.addStoryImageArea}>
            <Image
              source={{ uri: currentUser?.avatar || defaultAvatar }}
              style={styles.addStoryImage}
              resizeMode="cover"
            />
            {/* Subtle Gradient to blend into bottom */}
            <LinearGradient
              colors={[COLORS.named_transparent, isDarkMode ? COLORS.rgba_30_31_32_0p8 : COLORS.rgba_248_249_250_0p8]}
              style={StyleSheet.absoluteFillObject}
            />
            {/* Centered Overlapping Plus Button */}
            <View style={styles.plusBtnAnchor}>
              <LinearGradient
                colors={isDarkMode ? [COLORS.hex_3B82F6, COLORS.hex_1D4ED8] : [COLORS.hex_1A73E8, COLORS.primary]}
                style={[styles.addStoryPlusBtn, { borderColor: isDarkMode ? COLORS.hex_1E1F20 : COLORS.white }]}
              >
                <Ionicons name="add" size={20} color={COLORS.white} />
              </LinearGradient>
            </View>
          </View>

          {/* Bottom Label Area */}
          <View style={styles.addStoryLabelArea}>
            <Text style={[styles.addStoryLabel, { color: theme.text }]} numberOfLines={1}>
              Add Story
            </Text>
          </View>
        </TouchableOpacity>

        {/* 2. Other Users' Visual Story Portrait Cards */}
        {(Array.isArray(stories) ? stories : [])
          .filter((s) => s && !s.isSelf)
          .map((item, index) => {
            const hasUnseen = !!item.hasUnseen;
            const itemAvatar = item.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name || 'User')}&background=0B57D0&color=fff&size=200&bold=true`;
            const mediaUri = item.mediaUrl || itemAvatar;

            return (
              <TouchableOpacity
                key={item.id ? String(item.id) : `story_${index}`}
                style={[
                  styles.storyCard,
                  hasUnseen
                    ? {
                        borderColor: isDarkMode ? COLORS.hex_A8C7FA : COLORS.primary,
                        borderWidth: 1.5,
                      }
                    : {
                        borderColor: isDarkMode ? COLORS.rgba_255_255_255_0p1 : COLORS.rgba_0_0_0_0p06,
                        borderWidth: 1,
                      },
                ]}
                onPress={() => onStoryPress && onStoryPress(item)}
                activeOpacity={0.88}
              >
                {/* Full-card Visual Image */}
                <Image
                  source={{ uri: mediaUri }}
                  style={styles.cardImage}
                  resizeMode="cover"
                />

                {/* Scrim Overlay for Contrast */}
                <LinearGradient
                  colors={[COLORS.rgba_0_0_0_0p35, COLORS.named_transparent, COLORS.rgba_0_0_0_0p85]}
                  style={StyleSheet.absoluteFillObject}
                />

                {/* Top-Left: Mini Avatar with Vibrant Gradient Ring if Unseen */}
                <View style={styles.cardHeader}>
                  {hasUnseen ? (
                    <LinearGradient
                      colors={[COLORS.hex_4285F4, COLORS.hex_EA4335, COLORS.hex_FBBC05, COLORS.hex_34A853]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.activeStoryRing}
                    >
                      <Image source={{ uri: itemAvatar }} style={styles.cardMiniAvatar} />
                    </LinearGradient>
                  ) : (
                    <View style={styles.seenRing}>
                      <Image source={{ uri: itemAvatar }} style={styles.cardMiniAvatar} />
                    </View>
                  )}
                </View>

                {/* Bottom Title / Creator Name */}
                <View style={styles.cardFooter}>
                  <Text style={styles.storyAuthorName} numberOfLines={1}>
                    {item.name || 'User'}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  storyCard: {
    width: 114,
    height: 172,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  // Add Story Card Styles
  addStoryCard: {
    borderWidth: 1.2,
    justifyContent: 'space-between',
  },
  addStoryImageArea: {
    width: '100%',
    height: '68%',
    position: 'relative',
    backgroundColor: COLORS.hex_E2E8F0,
  },
  addStoryImage: {
    width: '100%',
    height: '100%',
  },
  plusBtnAnchor: {
    position: 'absolute',
    bottom: -15,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  addStoryPlusBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
  },
  addStoryLabelArea: {
    height: '32%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingHorizontal: 4,
  },
  addStoryLabel: {
    fontSize: 12.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  // User Visual Story Card Styles
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardHeader: {
    position: 'absolute',
    top: 10,
    left: 10,
  },
  activeStoryRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seenRing: {
    width: 36,
    height: 36,
    borderRadius: 18,
    padding: 1.5,
    borderWidth: 1.5,
    borderColor: COLORS.rgba_255_255_255_0p7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMiniAvatar: {
    width: 29,
    height: 29,
    borderRadius: 15,
    backgroundColor: COLORS.hex_0F172A,
  },
  cardFooter: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  storyAuthorName: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
    textShadowColor: COLORS.rgba_0_0_0_0p9,
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
