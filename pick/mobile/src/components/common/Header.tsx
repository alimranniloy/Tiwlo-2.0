import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../theme/colors';
import { PickIcon, IconName } from './PickIcon';

interface HeaderProps {
  title?: string;
  onBack?: () => void;
  showBack?: boolean;
  rightIcon?: IconName;
  onRightPress?: () => void;
  dark?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  onBack,
  showBack = true,
  rightIcon,
  onRightPress,
  dark = false,
}) => {
  return (
    <View style={[styles.container, dark && styles.containerDark]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <PickIcon
              name="back"
              size={28}
              color={dark ? Colors.textInverse : Colors.text}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {title ? (
        <Text
          style={[styles.title, dark && styles.titleDark]}
          numberOfLines={1}
        >
          {title}
        </Text>
      ) : null}

      <View style={styles.right}>
        {rightIcon ? (
          <TouchableOpacity
            style={styles.iconButton}
            onPress={onRightPress}
            activeOpacity={0.7}
          >
            <PickIcon
              name={rightIcon}
              size={20}
              color={dark ? Colors.textInverse : Colors.text}
            />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: Colors.background,
  },
  containerDark: {
    backgroundColor: Colors.backgroundDark,
  },
  left: {
    width: 40,
    alignItems: 'flex-start',
  },
  right: {
    width: 40,
    alignItems: 'flex-end',
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    flex: 1,
    letterSpacing: -0.3,
  },
  titleDark: {
    color: Colors.textInverse,
  },
});
