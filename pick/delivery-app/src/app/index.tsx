import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { AccountDisabledScreen } from '../../../mobile/src/screens/AccountDisabledScreen';
import { AuthScreen } from '../../../mobile/src/screens/2_AuthScreen';
import {
  clearStoredPickSession,
  getStoredPickSession,
  PickAccountDisabledError,
  PickUser
} from '../../../mobile/src/services/auth';
import { DeliveryApp } from '../components/DeliveryApp';

export default function DeliveryEntryScreen() {
  const [user, setUser] = useState<PickUser | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connectionError, setConnectionError] = useState('');
  const [retryNumber, setRetryNumber] = useState(0);

  useEffect(() => {
    let active = true;
    getStoredPickSession().then((session) => {
      if (!active) return;
      setUser(session?.user || null);
      setDisabled(false);
    }).catch((error: unknown) => {
      if (!active) return;
      if (error instanceof PickAccountDisabledError) {
        setUser(error.user);
        setDisabled(true);
      } else {
        setConnectionError(error instanceof Error
          ? error.message
          : 'Could not check your Tiwlo sign-in. Please try again.');
      }
    }).finally(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [retryNumber]);

  const signOut = useCallback(async () => {
    await clearStoredPickSession();
    setUser(null);
    setDisabled(false);
    setConnectionError('');
  }, []);

  const handleAccountDisabled = useCallback((disabledUser: PickUser) => {
    setUser(disabledUser);
    setDisabled(true);
  }, []);

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#17A56B" />
        <Text style={styles.muted}>Checking your Tiwlo account…</Text>
      </View>
    );
  }

  if (connectionError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>You’re still signed in</Text>
        <Text style={styles.muted}>{connectionError}</Text>
        <Pressable
          style={styles.button}
          onPress={() => {
            setConnectionError('');
            setChecking(true);
            setRetryNumber((value) => value + 1);
          }}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
        <Pressable style={styles.linkButton} onPress={() => void signOut()}>
          <Text style={styles.linkText}>Sign out</Text>
        </Pressable>
      </View>
    );
  }

  if (disabled && user) {
    return (
      <AccountDisabledScreen
        user={user}
        onSignOut={signOut}
        onAccountRestored={async (restoredUser, requiresSignIn) => {
          if (requiresSignIn) {
            await clearStoredPickSession();
            setUser(null);
            setDisabled(false);
            return;
          }
          setUser(restoredUser);
          setDisabled(false);
        }}
      />
    );
  }

  if (!user) {
    return (
      <AuthScreen
        app="delivery"
        onAuthenticated={(authenticatedUser) => {
          setUser(authenticatedUser);
          setDisabled(authenticatedUser.isBanned === true);
        }}
      />
    );
  }

  return (
    <DeliveryApp
      user={user}
      onSignOut={signOut}
      onAccountDisabled={handleAccountDisabled}
    />
  );
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
  title: { color: '#15231E', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  muted: { color: '#66736D', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  button: {
    backgroundColor: '#17A56B',
    borderRadius: 14,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    marginTop: 6
  },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  linkButton: { padding: 12 },
  linkText: { color: '#26372F', fontSize: 14, fontWeight: '600' }
});
