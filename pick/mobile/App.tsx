import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AppNavigator } from './src/navigation/AppNavigator';
import { LanguageProvider } from './src/context/LanguageContext';
import { AppUpdateGate } from './src/components/common/AppUpdateGate';

export default function App() {
  return (
    <LanguageProvider>
      <View style={styles.container}>
        <AppUpdateGate appId="pick">
          <AppNavigator />
        </AppUpdateGate>
        <StatusBar style="auto" />
      </View>
    </LanguageProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});
