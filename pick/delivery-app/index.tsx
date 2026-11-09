import React, { useEffect } from 'react';
import { registerRootComponent } from 'expo';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import type { ComponentType } from 'react';

function App() {
  const [Root, setRoot] = React.useState<ComponentType | null>(null);
  const [startupError, setStartupError] = React.useState('');

  useEffect(() => {
    let active = true;
    import('./src/components/DeliveryRoot').then(({ DeliveryRoot }) => {
      if (active) setRoot(() => DeliveryRoot);
    }).catch((error: unknown) => {
      console.error('PICK Delivery failed to load its app screen:', error);
      if (active) {
        setStartupError(error instanceof Error ? error.message : String(error));
      }
    });
    return () => { active = false; };
  }, []);

  if (startupError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>PICK Delivery could not start</Text>
        <Text style={styles.error}>{startupError}</Text>
      </View>
    );
  }

  if (!Root) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#17A56B" />
        <Text style={styles.title}>Starting PICK Delivery…</Text>
      </View>
    );
  }

  return <Root />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 28,
    backgroundColor: '#F6F8F7'
  },
  title: { color: '#15231E', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  error: { color: '#A33131', fontSize: 14, lineHeight: 21, textAlign: 'center' }
});

registerRootComponent(App);
