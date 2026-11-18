import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import {
  initialWindowMetrics,
  SafeAreaProvider,
} from 'react-native-safe-area-context';
import {
  clearAllAuthStorage,
  logoutAccount,
  StaffAccessRestrictedError,
  VerifiedStaffSession,
  verifyStaffAdminSession,
} from './src/services/authService';
import {
  initializeNotificationsOnLaunch,
  promptAlwaysAllowBackgroundRun,
  stopBackgroundMonitor,
  syncAuthenticatedBackgroundMonitor,
} from './src/services/notificationService';
import {
  getWorkspacePreferences,
  subscribeWorkspacePreferences,
  syncWorkspacePreferencesFromServer,
} from './src/services/preferencesService';
import { AppThemeProvider } from './src/theme/ThemeContext';
import { MagicToastProvider } from './src/components/magicui';
import { SensitiveGrantProvider } from './src/components/security/SensitiveGrantContext';
import { MainAppShell } from './src/navigation/MainAppShell';
import { IdentityVerificationGateScreen } from './src/screens/auth/IdentityVerificationGateScreen';
import { LoginScreen } from './src/screens/auth/LoginScreen';
import { PinSetupGateScreen } from './src/screens/auth/PinSetupGateScreen';
import { PinUnlockGateScreen } from './src/screens/auth/PinUnlockGateScreen';
import { StaffAccessRequestScreen } from './src/screens/auth/StaffAccessRequestScreen';
import { SplashScreen } from './src/screens/SplashScreen';

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const [bootChecked, setBootChecked] = useState(false);
  const [bootError, setBootError] = useState('');
  const [session, setSession] = useState<VerifiedStaffSession | null>(null);
  const [showAccessRequest, setShowAccessRequest] = useState(false);

  // Dedicated App-Launch PIN Lock State: starts locked on every launch whenever staff has a PIN!
  const [pinUnlocked, setPinUnlocked] = useState(false);
  const [requirePinOnLaunch, setRequirePinOnLaunch] = useState(true);
  const autoLockMinutesRef = useRef<number>(5);
  const backgroundedAtRef = useRef<number | null>(null);

  const hydrateSession = useCallback(async () => {
    try {
      const [verified, prefs] = await Promise.all([
        verifyStaffAdminSession(),
        getWorkspacePreferences(),
      ]);
      setRequirePinOnLaunch(prefs.requirePinOnLaunch !== false);
      autoLockMinutesRef.current = prefs.autoLockMinutes ?? 5;
      setSession(verified);
      setBootError('');
    } catch (err) {
      if (err instanceof StaffAccessRestrictedError) {
        setBootError(err.message);
        setSession(null);
      } else {
        setSession(null);
      }
    } finally {
      setBootChecked(true);
    }
  }, []);

  useEffect(() => {
    initializeNotificationsOnLaunch().catch(() => {});
    hydrateSession();

    const unsubPrefs = subscribeWorkspacePreferences((prefs) => {
      setRequirePinOnLaunch(prefs.requirePinOnLaunch !== false);
      autoLockMinutesRef.current = prefs.autoLockMinutes ?? 5;
    });
    return unsubPrefs;
  }, [hydrateSession]);

  // Background Inactivity Auto-Lock Listener
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (backgroundedAtRef.current === null) {
          backgroundedAtRef.current = Date.now();
        }
      } else if (nextState === 'active') {
        const bgStart = backgroundedAtRef.current;
        backgroundedAtRef.current = null;
        if (bgStart !== null && session?.staffProfile.hasPin) {
          const elapsedMs = Date.now() - bgStart;
          const thresholdMs = Math.max(0, autoLockMinutesRef.current) * 60_000;
          if (autoLockMinutesRef.current === 0 ? elapsedMs >= 3000 : elapsedMs >= thresholdMs) {
            setPinUnlocked(false);
          }
        }
      }
    });
    return () => sub.remove();
  }, [session?.staffProfile.hasPin]);

  const passesAuthGates =
    Boolean(session) &&
    !(session?.user.identityVerificationRequired && !session?.user.identityVerified) &&
    !session?.staffProfile.requiresPinSetup;

  // Keep background call/notification listener running as soon as authenticated (even while PIN locked!)
  useEffect(() => {
    if (passesAuthGates && session?.user.id) {
      syncWorkspacePreferencesFromServer().catch(() => {});
      syncAuthenticatedBackgroundMonitor(session.user.id)
        .then(() => promptAlwaysAllowBackgroundRun())
        .catch(() => {});
    }
  }, [passesAuthGates, session?.user.id]);

  const handleLogout = useCallback(async () => {
    await stopBackgroundMonitor().catch(() => {});
    await logoutAccount().catch(() => clearAllAuthStorage());
    setSession(null);
    setPinUnlocked(false);
    setBootError('');
  }, []);

  const needsPinUnlockScreen =
    Boolean(session?.staffProfile.hasPin) && requirePinOnLaunch && !pinUnlocked;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <KeyboardProvider>
          <AppThemeProvider>
            <MagicToastProvider>
              {!splashDone || !bootChecked ? (
                <SplashScreen onFinish={() => setSplashDone(true)} />
              ) : !session ? (
                showAccessRequest ? (
                  <StaffAccessRequestScreen onBackToLogin={() => setShowAccessRequest(false)} />
                ) : (
                  <LoginScreen
                    initialError={bootError}
                    onOpenAccessRequest={() => setShowAccessRequest(true)}
                    onAuthenticated={(verifiedSession) => {
                      setBootError('');
                      setPinUnlocked(!verifiedSession.staffProfile.hasPin);
                      setSession(verifiedSession);
                    }}
                  />
                )
              ) : session.user.identityVerificationRequired && !session.user.identityVerified ? (
                <IdentityVerificationGateScreen
                  user={session.user}
                  onVerified={(verifiedSession) => setSession(verifiedSession)}
                  onLogout={handleLogout}
                />
              ) : session.staffProfile.requiresPinSetup ? (
                <PinSetupGateScreen
                  staffProfile={session.staffProfile}
                  onCompleted={async () => {
                    await hydrateSession();
                    setPinUnlocked(true);
                  }}
                  onLogout={handleLogout}
                />
              ) : needsPinUnlockScreen ? (
                <PinUnlockGateScreen
                  user={session.user}
                  staffProfile={session.staffProfile}
                  onUnlocked={() => setPinUnlocked(true)}
                  onPinResetComplete={async () => {
                    await hydrateSession();
                    setPinUnlocked(true);
                  }}
                  onLogout={handleLogout}
                />
              ) : (
                <SensitiveGrantProvider staffProfile={session.staffProfile}>
                  <MainAppShell
                    user={session.user}
                    staffProfile={session.staffProfile}
                    onLogout={handleLogout}
                    onRefreshSession={hydrateSession}
                    onLockNow={() => setPinUnlocked(false)}
                  />
                </SensitiveGrantProvider>
              )}
            </MagicToastProvider>
          </AppThemeProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
