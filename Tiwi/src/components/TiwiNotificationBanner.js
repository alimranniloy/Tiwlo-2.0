import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Image,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../config/colors';

export default function TiwiNotificationBanner({
  visible,
  notification,
  onDismiss,
  isDarkMode = false,
}) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-140)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && notification) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: insets.top + (Platform.OS === 'android' ? 8 : 4),
          useNativeDriver: true,
          tension: 70,
          friction: 9,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, 4200);

      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -140,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, notification]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -140,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (onDismiss) onDismiss();
    });
  };

  if (!visible) return null;

  const bg = isDarkMode ? COLORS.hex_1E1F20 : COLORS.white;
  const textColor = isDarkMode ? COLORS.hex_E3E3E3 : COLORS.text;
  const borderColor = isDarkMode ? COLORS.rgba_255_255_255_0p14 : COLORS.rgba_0_0_0_0p08;

  return (
    <Animated.View
      style={[
        styles.bannerContainer,
        {
          transform: [{ translateY }],
          opacity,
          backgroundColor: bg,
          borderColor,
        },
      ]}
    >
      <TouchableOpacity
        activeOpacity={0.92}
        onPress={() => {
          if (notification?.onPress) notification.onPress();
          handleDismiss();
        }}
        style={styles.innerRow}
      >
        {/* Official Tiwi Icon */}
        <Image
          source={require('../../assets/tiwi.png')}
          style={styles.appIcon}
          resizeMode="contain"
        />

        <View style={styles.textColumn}>
          <View style={styles.topMetaRow}>
            <Text style={styles.appLabel}>TIWI</Text>
            <Text style={styles.dotSeparator}>•</Text>
            <Text style={styles.timeLabel}>Just now</Text>
          </View>
          <Text style={[styles.titleText, { color: textColor }]} numberOfLines={1}>
            {notification?.title || 'Notification'}
          </Text>
          {notification?.message ? (
            <Text style={[styles.messageText, { color: textColor }]} numberOfLines={2}>
              {notification.message}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    zIndex: 99999,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 12,
  },
  innerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  topMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  appLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.primary,
  },
  dotSeparator: {
    fontSize: 10,
    color: COLORS.hex_8E918F,
    marginHorizontal: 4,
  },
  timeLabel: {
    fontSize: 10,
    color: COLORS.hex_8E918F,
  },
  titleText: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 12,
    marginTop: 1,
    opacity: 0.85,
  },
});
