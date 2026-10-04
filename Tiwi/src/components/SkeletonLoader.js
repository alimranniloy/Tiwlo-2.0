import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config/colors';

/**
 * ShimmerItem - Core pulsing animated placeholder block
 */
export function ShimmerItem({ style, width, height, borderRadius = 4 }) {
  const { isDarkMode } = useAuth();
  const opacityAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacityAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacityAnim]);

  const baseColor = isDarkMode ? COLORS.hex_282A2C : COLORS.hex_E2E8F0;

  return (
    <Animated.View
      style={[
        {
          backgroundColor: baseColor,
          borderRadius,
          opacity: opacityAnim,
          ...(width !== undefined && { width }),
          ...(height !== undefined && { height }),
        },
        style,
      ]}
    />
  );
}

/**
 * PostSkeleton - Full-width Facebook/Twitter/Google Discover placeholder
 */
export function PostSkeleton({ hasMedia = true }) {
  const { theme } = useAuth();

  return (
    <View style={[styles.postContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
      {/* Header: Avatar + Name/Handle */}
      <View style={styles.postHeader}>
        <ShimmerItem width={40} height={40} borderRadius={20} />
        <View style={styles.postHeaderTextCol}>
          <ShimmerItem width={130} height={14} borderRadius={4} style={{ marginBottom: 6 }} />
          <ShimmerItem width={80} height={10} borderRadius={4} />
        </View>
      </View>

      {/* Caption lines */}
      <View style={styles.captionBlock}>
        <ShimmerItem width="92%" height={12} borderRadius={4} style={{ marginBottom: 6 }} />
        <ShimmerItem width="65%" height={12} borderRadius={4} />
      </View>

      {/* Media Box */}
      {hasMedia && (
        <ShimmerItem width="100%" height={320} borderRadius={0} style={{ marginBottom: 12 }} />
      )}

      {/* Action Buttons row */}
      <View style={styles.postActionsRow}>
        <ShimmerItem width={50} height={20} borderRadius={10} />
        <ShimmerItem width={50} height={20} borderRadius={10} />
        <ShimmerItem width={50} height={20} borderRadius={10} />
        <ShimmerItem width={24} height={20} borderRadius={10} />
      </View>
    </View>
  );
}

/**
 * ProfileSkeleton - Complete profile header & content placeholder
 */
export function ProfileSkeleton() {
  const { theme } = useAuth();

  return (
    <View style={[styles.profileContainer, { backgroundColor: theme.background }]}>
      {/* Cover */}
      <ShimmerItem width="100%" height={150} borderRadius={0} />

      {/* Profile Header Details */}
      <View style={[styles.profileHeaderBox, { backgroundColor: theme.cardBg }]}>
        <View style={styles.profileAvatarRow}>
          <ShimmerItem width={80} height={80} borderRadius={40} style={styles.profileAvatar} />
          <ShimmerItem width={100} height={36} borderRadius={18} />
        </View>

        <ShimmerItem width={160} height={20} borderRadius={4} style={{ marginTop: 12, marginBottom: 6 }} />
        <ShimmerItem width={100} height={12} borderRadius={4} style={{ marginBottom: 12 }} />

        <ShimmerItem width="85%" height={12} borderRadius={4} style={{ marginBottom: 6 }} />
        <ShimmerItem width="55%" height={12} borderRadius={4} style={{ marginBottom: 14 }} />

        {/* Stats */}
        <View style={styles.profileStatsRow}>
          <ShimmerItem width={70} height={16} borderRadius={4} />
          <ShimmerItem width={70} height={16} borderRadius={4} />
          <ShimmerItem width={60} height={16} borderRadius={4} />
        </View>
      </View>

      {/* Tab bar placeholder */}
      <View style={[styles.tabBarPlaceholder, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
        <ShimmerItem width={60} height={16} borderRadius={4} />
        <ShimmerItem width={60} height={16} borderRadius={4} />
        <ShimmerItem width={60} height={16} borderRadius={4} />
        <ShimmerItem width={60} height={16} borderRadius={4} />
      </View>

      {/* Feed post skeletons */}
      <PostSkeleton hasMedia={false} />
      <PostSkeleton hasMedia={true} />
    </View>
  );
}

/**
 * UserRowSkeleton - People search & followers list placeholder
 */
export function UserRowSkeleton() {
  const { theme } = useAuth();

  return (
    <View style={[styles.userRowContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
      <ShimmerItem width={44} height={44} borderRadius={22} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <ShimmerItem width={120} height={14} borderRadius={4} style={{ marginBottom: 6 }} />
        <ShimmerItem width={75} height={10} borderRadius={4} />
      </View>
      <ShimmerItem width={70} height={32} borderRadius={16} />
    </View>
  );
}

/**
 * ConversationSkeleton - Messages list placeholder
 */
export function ConversationSkeleton() {
  const { theme } = useAuth();

  return (
    <View style={[styles.convoContainer, { backgroundColor: theme.cardBg, borderBottomColor: theme.borderLight }]}>
      <ShimmerItem width={48} height={48} borderRadius={24} style={{ marginRight: 14 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
          <ShimmerItem width={110} height={14} borderRadius={4} />
          <ShimmerItem width={40} height={10} borderRadius={4} />
        </View>
        <ShimmerItem width="80%" height={12} borderRadius={4} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  postContainer: {
    width: '100%',
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  postHeaderTextCol: {
    marginLeft: 12,
    flex: 1,
  },
  captionBlock: {
    marginBottom: 12,
  },
  postActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  profileContainer: {
    flex: 1,
  },
  profileHeaderBox: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  profileAvatarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -40,
    marginBottom: 8,
  },
  profileAvatar: {
    borderWidth: 3,
    borderColor: COLORS.white,
  },
  profileStatsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.rgba_0_0_0_0p06,
  },
  tabBarPlaceholder: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: 4,
  },
  userRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  convoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
