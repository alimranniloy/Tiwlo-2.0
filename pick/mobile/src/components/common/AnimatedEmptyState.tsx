import React from 'react';
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import LottieView from 'lottie-react-native';

type EmptyStateAnimation = 'catalog' | 'orders';

const animations = {
  catalog: require('../../../assets/animations/empty-catalog.json'),
  orders: require('../../../assets/animations/no-active-orders.json'),
};

interface AnimatedEmptyStateProps {
  animation: EmptyStateAnimation;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  style?: StyleProp<ViewStyle>;
}

export const AnimatedEmptyState: React.FC<AnimatedEmptyStateProps> = ({
  animation,
  title,
  description,
  actionLabel,
  onAction,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <LottieView
        source={animations[animation]}
        autoPlay
        loop
        style={styles.animation}
      />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      <TouchableOpacity
        style={styles.action}
        onPress={onAction}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 390,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 24,
  },
  animation: {
    width: 240,
    height: 220,
    marginBottom: 8,
  },
  title: {
    color: '#09090B',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  description: {
    maxWidth: 320,
    color: '#71717A',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: 'center',
  },
  action: {
    minHeight: 46,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 20,
    borderRadius: 8,
    backgroundColor: '#09090B',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
