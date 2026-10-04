import React, { Component } from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../config/colors';

let ExpoLinearGradient = null;
try {
  const mod = require('expo-linear-gradient');
  ExpoLinearGradient = mod.LinearGradient || mod.default || mod;
} catch (e) {
  console.warn('[SafeLinearGradient] expo-linear-gradient module failed to load:', e);
}

class SafeLinearGradient extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.warn('[SafeLinearGradient] Caught gradient render exception:', error, info);
  }

  render() {
    const { colors, style, children, start, end, locations, ...rest } = this.props;
    const fallbackColor = Array.isArray(colors) && colors.length > 0 ? colors[0] : COLORS.named_transparent;

    if (this.state.hasError || !ExpoLinearGradient) {
      return (
        <View style={[{ backgroundColor: fallbackColor }, style]} {...rest}>
          {children}
        </View>
      );
    }

    try {
      return (
        <ExpoLinearGradient
          colors={colors}
          style={style}
          start={start}
          end={end}
          locations={locations}
          {...rest}
        >
          {children}
        </ExpoLinearGradient>
      );
    } catch (err) {
      console.warn('[SafeLinearGradient] Native render error:', err);
      return (
        <View style={[{ backgroundColor: fallbackColor }, style]} {...rest}>
          {children}
        </View>
      );
    }
  }
}

export { SafeLinearGradient, SafeLinearGradient as LinearGradient };
export default SafeLinearGradient;
