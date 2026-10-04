// Polyfill global environment for Hermes & React Native 0.86
if (typeof globalThis !== 'undefined') {
  if (typeof global === 'undefined') {
    globalThis.global = globalThis;
  }
  if (!globalThis.process) {
    globalThis.process = { env: {} };
  }
  if (!globalThis.process.env) {
    globalThis.process.env = {};
  }
  if (!globalThis.process.env.NODE_ENV) {
    globalThis.process.env.NODE_ENV = typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production';
  }
}

import React, { Component } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar, TouchableOpacity } from 'react-native';
import { registerRootComponent } from 'expo';

let AppComponent = null;
let bootError = null;

try {
  const AppMod = require('./App');
  AppComponent = AppMod.default || AppMod;
} catch (e) {
  bootError = e;
  console.error('[Tiwi Boot Interceptor] Critical startup error:', e);
}

class RootShield extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: !!bootError, error: bootError };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RootShield caught error]', error, errorInfo);
  }

  handleRetry = () => {
    try {
      const AppMod = require('./App');
      AppComponent = AppMod.default || AppMod;
      this.setState({ hasError: false, error: null });
    } catch (e) {
      this.setState({ hasError: true, error: e });
    }
  };

  render() {
    const error = this.state.error || bootError;
    if (this.state.hasError || error || !AppComponent) {
      return (
        <SafeAreaView style={styles.errorContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#121316" />
          <View style={styles.errorCard}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconText}>!</Text>
            </View>
            <Text style={styles.errorTitle}>Tiwi Diagnostic Mode</Text>
            <Text style={styles.errorSubtitle}>
              An error occurred during startup. Details below:
            </Text>
            <ScrollView style={styles.logBox} showsVerticalScrollIndicator={true}>
              <Text style={styles.logText} selectable={true}>
                {error ? (error.stack || error.message || String(error)) : 'AppComponent could not be loaded.'}
              </Text>
            </ScrollView>
            <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry} activeOpacity={0.8}>
              <Text style={styles.retryBtnText}>Retry Startup</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }

    const App = AppComponent;
    return <App />;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: '#121316',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    width: '100%',
    backgroundColor: '#1B1E23',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D323B',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3E1F1D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconText: {
    color: '#F28B82',
    fontSize: 28,
    fontWeight: 'bold',
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  errorSubtitle: {
    color: '#9AA0A6',
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  logBox: {
    maxHeight: 220,
    width: '100%',
    backgroundColor: '#121316',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2D323B',
  },
  logText: {
    color: '#F28B82',
    fontSize: 11,
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  retryBtn: {
    backgroundColor: '#0B57D0',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 24,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});

registerRootComponent(RootShield);
