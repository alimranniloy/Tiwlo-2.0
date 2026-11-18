import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../theme/ThemeContext';
import { BorderlessIconButton, Hairline } from './MagicUIPrimitives';

interface MagicModalSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxHeightPercent?: `${number}%`;
  contentStyle?: StyleProp<ViewStyle>;
  scrollable?: boolean;
}

/**
 * Clean flat Reanimated slide-up modal sheet
 * with built-in KeyboardAvoidingView so inputs never get hidden by Android soft keyboard.
 */
export const MagicModalSheet: React.FC<MagicModalSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  children,
  maxHeightPercent = '86%',
  contentStyle,
  scrollable = true,
}) => {
  const { tokens } = useAppTheme();
  const insets = useSafeAreaInsets();
  const backdrop = useSharedValue(0);
  const translateY = useSharedValue(48);

  useEffect(() => {
    if (visible) {
      backdrop.value = withTiming(1, { duration: 190, easing: Easing.out(Easing.ease) });
      translateY.value = withSpring(0, { damping: 24, stiffness: 260 });
    } else {
      backdrop.value = 0;
      translateY.value = 48;
    }
  }, [backdrop, translateY, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.backdrop, { backgroundColor: tokens.overlay }, backdropStyle]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <KeyboardAvoidingView behavior="padding" style={styles.kav}>
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: tokens.bg,
                maxHeight: maxHeightPercent,
                paddingBottom: Math.max(insets.bottom, 16),
              },
              sheetStyle,
            ]}
          >
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: tokens.hairlineStrong }]} />
            </View>

            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text numberOfLines={1} style={[styles.title, { color: tokens.text }]}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={[styles.subtitle, { color: tokens.textMuted }]}>{subtitle}</Text>
                ) : null}
              </View>
              <BorderlessIconButton
                name="x"
                size={20}
                onPress={onClose}
                accessibilityLabel="Close panel"
              />
            </View>

            <Hairline />

            {scrollable ? (
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollBody, contentStyle]}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.staticBody, contentStyle]}>{children}</View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  kav: {
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 34,
    height: 3.5,
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
  },
  scrollBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
    gap: 12,
  },
  staticBody: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 16,
  },
});
