import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { LAYOUT, getActiveTopBarTheme } from '../config/layout';
import { COLORS } from '../config/colors';

export default function ScreenHeader({
  title = '',
  subtitle = null,
  leftIcon = null, // 'arrow-back' | 'close' | null
  onLeftPress = null,
  leftElement = null,
  rightElement = null,
  isModal = false,
  isImmersive = false,
  borderBottom = true,
  customBg = null,
}) {
  const { isDarkMode } = useAuth();
  const insets = useSafeAreaInsets();
  const themeConfig = getActiveTopBarTheme(isDarkMode, isImmersive);

  const headerBg = customBg || themeConfig.headerBg;
  const topPadding = isModal ? LAYOUT.getModalTopSpacing(insets) : 0;

  return (
    <View style={[styles.wrapper, { backgroundColor: headerBg, paddingTop: topPadding }]}>
      {isModal && (
        <StatusBar
          barStyle={themeConfig.barStyle}
          backgroundColor={headerBg}
          translucent={true}
        />
      )}

      <View
        style={[
          styles.container,
          {
            backgroundColor: headerBg,
            borderBottomColor: borderBottom ? themeConfig.headerBorder : COLORS.named_transparent,
            borderBottomWidth: borderBottom ? StyleSheet.hairlineWidth : 0,
          },
        ]}
      >
        {/* Left Section: Back / Close button or custom left element */}
        <View style={styles.leftSection}>
          {leftElement ? (
            leftElement
          ) : leftIcon ? (
            <TouchableOpacity
              onPress={onLeftPress}
              style={styles.iconBtn}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={leftIcon}
                size={LAYOUT.HEADER_ICON_SIZE}
                color={themeConfig.headerIconColor}
              />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Center Section: Standardized Title & Subtitle */}
        <View style={styles.centerSection} pointerEvents="box-none">
          {typeof title === 'string' && title.length > 0 ? (
            <View style={styles.titleBlock}>
              <Text
                style={[styles.titleText, { color: themeConfig.headerText }]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {!!subtitle && (
                <Text
                  style={[styles.subtitleText, { color: themeConfig.headerTextSecondary }]}
                  numberOfLines={1}
                >
                  {subtitle}
                </Text>
              )}
            </View>
          ) : (
            title
          )}
        </View>

        {/* Right Section: Custom right action elements */}
        <View style={styles.rightSection}>{rightElement}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    zIndex: 100,
  },
  container: {
    height: LAYOUT.HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: LAYOUT.HEADER_HORIZONTAL_PADDING,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    zIndex: 2,
  },
  iconBtn: {
    width: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    height: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSection: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  titleBlock: {
    justifyContent: 'center',
  },
  titleText: {
    fontSize: LAYOUT.HEADER_TITLE_SIZE,
    fontWeight: LAYOUT.HEADER_TITLE_WEIGHT,
    letterSpacing: -0.3,
  },
  subtitleText: {
    fontSize: 11.5,
    marginTop: 1,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: LAYOUT.HEADER_BUTTON_TOUCH_SIZE,
    gap: 8,
    zIndex: 2,
  },
});
