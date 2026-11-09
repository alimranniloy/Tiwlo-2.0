import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ScreenContainer, SYSTEM_INSETS } from '../components/common/ScreenContainer';

interface RainDelayScreenProps {
  onContinue: () => void;
}

export const RainDelayScreen: React.FC<RainDelayScreenProps> = ({ onContinue }) => {
  const { width } = useWindowDimensions();

  return (
    <ScreenContainer applyTopInset applyBottomInset={false}>
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={[styles.animationArea, { height: Math.min(width * 0.9, 380) }]}>
            <ExpoImage
              source={require('../../assets/images/rain-delay.gif')}
              contentFit="contain"
              autoplay
              style={styles.animation}
              accessibilityLabel="Rain falling over a delivery route"
            />
          </View>

          <View style={styles.message}>
            <Text style={styles.eyebrow}>A QUICK DELIVERY NOTE</Text>
            <Text style={styles.title}>A little rain, a little extra time</Text>
            <Text style={styles.description}>
              Rain or unexpected weather may delay your delivery. We’ll keep you
              updated, and we appreciate your understanding.
            </Text>
          </View>
        </View>

        <View style={[styles.bottom, { paddingBottom: SYSTEM_INSETS.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.button}
            onPress={onContinue}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>Woo! Okay!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  animationArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  animation: {
    width: '100%',
    height: '100%',
  },
  message: {
    alignItems: 'center',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  eyebrow: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textAlign: 'center',
  },
  title: {
    color: '#09090B',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 33,
    marginTop: 10,
    textAlign: 'center',
  },
  description: {
    color: '#71717A',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
    maxWidth: 340,
    textAlign: 'center',
  },
  bottom: {
    paddingTop: 16,
  },
  button: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090B',
    borderRadius: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
