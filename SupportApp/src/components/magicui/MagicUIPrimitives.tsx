import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getTonePalette, useAppTheme, type SemanticTone } from '../../theme/ThemeContext';
import { getInitials } from '../../utils/formatters';

export const Hairline: React.FC<{ style?: StyleProp<ViewStyle>; strong?: boolean }> = ({
  style,
  strong = false,
}) => {
  const { tokens } = useAppTheme();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth > 0 ? Math.max(1, StyleSheet.hairlineWidth) : 1,
          backgroundColor: strong ? tokens.hairlineStrong : tokens.hairline,
          width: '100%',
        },
        style,
      ]}
    />
  );
};

interface BorderlessIconButtonProps {
  name: React.ComponentProps<typeof Feather>['name'];
  onPress: () => void;
  size?: number;
  color?: string;
  accessibilityLabel: string;
  disabled?: boolean;
  badgeDot?: boolean;
  badgeCount?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Pure naked borderless icon button — ZERO box background, ZERO outline border.
 */
export const BorderlessIconButton: React.FC<BorderlessIconButtonProps> = ({
  name,
  onPress,
  size = 20,
  color,
  accessibilityLabel,
  disabled = false,
  badgeDot = false,
  badgeCount = 0,
  style,
}) => {
  const { tokens } = useAppTheme();
  return (
    <TouchableOpacity
      activeOpacity={0.55}
      disabled={disabled}
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      accessibilityLabel={accessibilityLabel}
      style={[styles.iconHit, { opacity: disabled ? 0.45 : 1 }, style]}
    >
      <Feather name={name} size={size} color={color || tokens.text} />
      {badgeCount > 0 ? (
        <View style={[styles.countDot, { backgroundColor: tokens.accent }]}>
          <Text style={styles.countText}>{badgeCount > 9 ? '9+' : badgeCount}</Text>
        </View>
      ) : badgeDot ? (
        <View style={[styles.microDot, { backgroundColor: tokens.accent }]} />
      ) : null}
    </TouchableOpacity>
  );
};

interface FlatBadgeProps {
  label: string;
  tone?: SemanticTone;
  withDot?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Minimal flat semantic label: crisp 5px dot + subtle tinted label, zero pill border.
 */
export const FlatBadge: React.FC<FlatBadgeProps> = ({
  label,
  tone = 'neutral',
  withDot = false,
  style,
  textStyle,
}) => {
  const { tokens } = useAppTheme();
  const palette = getTonePalette(tokens, tone);

  return (
    <View style={[styles.flatBadge, { backgroundColor: palette.bg }, style]}>
      {withDot ? <View style={[styles.badgeDot, { backgroundColor: palette.fg }]} /> : null}
      <Text numberOfLines={1} style={[styles.flatBadgeText, { color: palette.fg }, textStyle]}>
        {label}
      </Text>
    </View>
  );
};

interface FlatInputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  leftIcon?: React.ReactNode;
  rightSlot?: React.ReactNode;
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
}

/**
 * Compact flat borderless input field with subtle focus underline.
 */
export const FlatInput: React.FC<FlatInputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  maxLength,
  multiline = false,
  numberOfLines = 1,
  leftIcon,
  rightSlot,
  onSubmitEditing,
  style,
  inputStyle,
}) => {
  const { tokens } = useAppTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.inputGroup, style]}>
      {label ? (
        <Text style={[styles.inputLabel, { color: tokens.textSecondary }]}>{label}</Text>
      ) : null}
      <View
        style={[
          styles.inputBox,
          {
            backgroundColor: tokens.surfaceSubtle,
            minHeight: multiline ? 84 : 42,
            alignItems: multiline ? 'flex-start' : 'center',
            paddingVertical: multiline ? 10 : 0,
            borderWidth: 1,
            borderColor: focused ? tokens.accent : tokens.hairlineStrong,
          },
        ]}
      >
        {leftIcon ? <View style={styles.inputAdornLeft}>{leftIcon}</View> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={tokens.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          textAlignVertical={multiline ? 'top' : 'center'}
          style={[
            styles.inputControl,
            {
              color: tokens.text,
              minHeight: multiline ? 62 : 40,
            },
            inputStyle,
          ]}
        />
        {rightSlot ? <View style={styles.inputAdornRight}>{rightSlot}</View> : null}
      </View>
    </View>
  );
};

interface CompactOtpInputProps {
  value: string;
  onChange: (code: string) => void;
  length?: number;
  label?: string;
}

/**
 * Clean 6-slot underline OTP input — tap anywhere to focus numeric keypad.
 */
export const CompactOtpInput: React.FC<CompactOtpInputProps> = ({
  value,
  onChange,
  length = 6,
  label,
}) => {
  const { tokens } = useAppTheme();
  const hiddenRef = useRef<React.ComponentRef<typeof TextInput> | null>(null);
  const digits = value.replace(/\D/g, '').slice(0, length);

  return (
    <View style={styles.inputGroup}>
      {label ? (
        <Text style={[styles.inputLabel, { color: tokens.textSecondary }]}>{label}</Text>
      ) : null}
      <Pressable onPress={() => hiddenRef.current?.focus()} style={styles.otpRow}>
        {Array.from({ length }).map((_, idx) => {
          const char = digits[idx] || '';
          const active = idx === digits.length || (digits.length === length && idx === length - 1);
          return (
            <View
              key={idx}
              style={[
                styles.otpSlot,
                {
                  backgroundColor: tokens.surfaceMuted,
                  borderBottomColor: active ? tokens.accent : tokens.hairlineStrong,
                },
              ]}
            >
              <Text style={[styles.otpChar, { color: tokens.text }]}>{char}</Text>
            </View>
          );
        })}
        <TextInput
          ref={hiddenRef}
          value={digits}
          onChangeText={(txt) => onChange(txt.replace(/\D/g, '').slice(0, length))}
          keyboardType="number-pad"
          maxLength={length}
          style={styles.hiddenOtpInput}
          caretHidden
        />
      </Pressable>
    </View>
  );
};

export const MagicSwitch: React.FC<{
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
}> = ({ value, onValueChange, disabled = false }) => {
  const { tokens } = useAppTheme();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: tokens.hairlineStrong, true: tokens.accent }}
      thumbColor="#FFFFFF"
      style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
    />
  );
};

export const MagicAvatar: React.FC<{
  name: string;
  uri?: string | null;
  size?: number;
  online?: boolean;
}> = ({ name, uri, size = 34, online = false }) => {
  const { tokens } = useAppTheme();
  const [imgFailed, setImgFailed] = useState(false);
  const validUri =
    !imgFailed && uri && !uri.endsWith('/favicon.png') && uri.trim().length > 0 ? uri.trim() : null;

  const dotSize = Math.max(8, Math.round(size * 0.28));

  return (
    <View style={{ width: size, height: size, position: 'relative' }}>
      {validUri ? (
        <Image
          source={{ uri: validUri }}
          onError={() => setImgFailed(true)}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: tokens.surfaceMuted,
          }}
        />
      ) : (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: tokens.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{
              color: tokens.accent,
              fontSize: Math.round(size * 0.36),
              fontWeight: '700',
            }}
          >
            {getInitials(name)}
          </Text>
        </View>
      )}
      {online ? (
        <View
          style={{
            position: 'absolute',
            right: -1,
            bottom: -1,
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: '#16A34A',
            borderWidth: 1.5,
            borderColor: tokens.bg,
          }}
        />
      ) : null}
    </View>
  );
};

export const FlatNotice: React.FC<{
  text: string;
  tone?: SemanticTone;
  icon?: React.ComponentProps<typeof Feather>['name'];
}> = ({ text, tone = 'danger', icon = 'info' }) => {
  const { tokens } = useAppTheme();
  const palette = getTonePalette(tokens, tone);
  return (
    <View style={[styles.notice, { backgroundColor: palette.bg, borderLeftColor: palette.fg }]}>
      <Feather name={icon} size={14} color={palette.fg} style={{ marginTop: 1 }} />
      <Text style={[styles.noticeText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
};

export const MagicSpinner: React.FC<{ label?: string }> = ({ label }) => {
  const { tokens } = useAppTheme();
  return (
    <View style={styles.spinnerBox}>
      <ActivityIndicator size="small" color={tokens.accent} />
      {label ? <Text style={[styles.spinnerLabel, { color: tokens.textMuted }]}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  iconHit: {
    position: 'relative',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  microDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  countDot: {
    position: 'absolute',
    top: -1,
    right: -3,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  countText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
  flatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  flatBadgeText: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  inputBox: {
    flexDirection: 'row',
    borderRadius: 8,
    paddingHorizontal: 11,
  },
  inputAdornLeft: {
    marginRight: 8,
  },
  inputAdornRight: {
    marginLeft: 8,
  },
  inputControl: {
    flex: 1,
    fontSize: 14,
    padding: 0,
  },
  otpRow: {
    flexDirection: 'row',
    gap: 8,
    position: 'relative',
  },
  otpSlot: {
    flex: 1,
    height: 44,
    borderRadius: 7,
    borderBottomWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  otpChar: {
    fontSize: 18,
    fontWeight: '700',
  },
  hiddenOtpInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0.01,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderLeftWidth: 2.5,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  spinnerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  spinnerLabel: {
    fontSize: 12,
  },
});
