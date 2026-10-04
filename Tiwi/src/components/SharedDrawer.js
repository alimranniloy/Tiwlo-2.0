import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DRAWER_CONFIG } from '../config/drawerConfig';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../config/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * SharedDrawer - Universal Facebook / Google Material 3 Bottom Sheet Drawer
 * Features:
 *  1. Non-sliding backdrop (instantly dims & covers entire screen including status bar)
 *  2. Butter-smooth spring slide-up sheet animation
 *  3. Seamless extension to bottom edge under gesture navigation bar
 *  4. Native driver hardware acceleration
 */
export default function SharedDrawer({
  visible,
  onClose,
  title,
  subtitle,
  children,
  showHandle = true,
  showCloseButton = false,
  scrollable = true,
  maxHeight = SCREEN_HEIGHT * 0.82,
  headerRight,
  footer,
}) {
  const { isDarkMode } = useAuth();
  const insets = useSafeAreaInsets();
  const themeColors = DRAWER_CONFIG.getThemeColors(isDarkMode);

  const [modalVisible, setModalVisible] = useState(visible);
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const sheetAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      setModalVisible(true);
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: DRAWER_CONFIG.BACKDROP_FADE_DURATION,
          useNativeDriver: true,
        }),
        Animated.spring(sheetAnim, {
          toValue: 0,
          damping: DRAWER_CONFIG.SHEET_SPRING_CONFIG.damping,
          mass: DRAWER_CONFIG.SHEET_SPRING_CONFIG.mass,
          stiffness: DRAWER_CONFIG.SHEET_SPRING_CONFIG.stiffness,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(backdropAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(sheetAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setModalVisible(false);
      });
    }
  }, [visible]);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(sheetAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalVisible(false);
      if (onClose) onClose();
    });
  };

  if (!modalVisible) return null;

  const safeBottomPadding = Math.max(insets.bottom, DRAWER_CONFIG.DEFAULT_BOTTOM_INSET);

  return (
    <Modal
      visible={modalVisible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.rootContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 1. Backdrop (STATIONARY - does NOT slide, fades in like Facebook) */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.backdrop,
            {
              backgroundColor: themeColors.backdrop,
              opacity: backdropAnim,
            },
          ]}
        >
          <TouchableWithoutFeedback onPress={handleClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        </Animated.View>

        {/* 2. Sliding Sheet (Spring slide from bottom, extended all the way to bottom edge) */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: themeColors.sheetBg,
              borderTopLeftRadius: DRAWER_CONFIG.BORDER_RADIUS,
              borderTopRightRadius: DRAWER_CONFIG.BORDER_RADIUS,
              maxHeight,
              paddingBottom: safeBottomPadding,
              transform: [{ translateY: sheetAnim }],
            },
          ]}
        >
          {/* Drag Handle */}
          {showHandle && (
            <View style={styles.handleContainer}>
              <View
                style={[
                  styles.dragHandle,
                  {
                    backgroundColor: themeColors.dragHandle,
                    width: DRAWER_CONFIG.DRAG_HANDLE_WIDTH,
                    height: DRAWER_CONFIG.DRAG_HANDLE_HEIGHT,
                    borderRadius: DRAWER_CONFIG.DRAG_HANDLE_BORDER_RADIUS,
                  },
                ]}
              />
            </View>
          )}

          {/* Optional Header Row */}
          {(title || showCloseButton || headerRight) && (
            <View
              style={[
                styles.headerRow,
                { borderBottomColor: themeColors.divider },
              ]}
            >
              <View style={styles.headerTextCol}>
                {!!title && (
                  <Text style={[styles.headerTitle, { color: themeColors.textPrimary }]}>
                    {title}
                  </Text>
                )}
                {!!subtitle && (
                  <Text style={[styles.headerSubtitle, { color: themeColors.textSecondary }]}>
                    {subtitle}
                  </Text>
                )}
              </View>

              <View style={styles.headerRightActions}>
                {headerRight}
                {showCloseButton && (
                  <TouchableOpacity
                    onPress={handleClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={22} color={themeColors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Content Body */}
          {scrollable ? (
            <ScrollView
              contentContainerStyle={styles.scrollableContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={styles.unscrollableContent}>{children}</View>
          )}

          {/* Optional Fixed Footer (e.g. Save button / Action button) */}
          {!!footer && <View style={styles.footerContainer}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    zIndex: 1,
  },
  sheetContainer: {
    width: '100%',
    zIndex: 2,
    elevation: 24,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  handleContainer: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    alignSelf: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTextCol: {
    flex: 1,
    paddingRight: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 12.5,
    marginTop: 2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  closeBtn: {
    padding: 4,
  },
  scrollableContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  unscrollableContent: {
    flexShrink: 1,
  },
  footerContainer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
  },
});
