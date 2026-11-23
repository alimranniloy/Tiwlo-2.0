import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, BackHandler, Linking, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppErrorBoundary } from './src/components/AppErrorBoundary';
import { FingerprintDrawer } from './src/components/FingerprintDrawer';
import { BottomNavKey } from './src/components/MobileNavbar';
import { NavMenuItem } from './src/screens/MenuScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { CreateAccountScreen } from './src/screens/CreateAccountScreen';
import { ChallengeMode, VerificationScreen } from './src/screens/VerificationScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { MenuScreen } from './src/screens/MenuScreen';
import { IdentityScreen } from './src/screens/IdentityScreen';
import { UserSettingsScreen } from './src/screens/UserSettingsScreen';
import { ActiveSessionsScreen } from './src/screens/ActiveSessionsScreen';
import { TwoFactorAuthScreen } from './src/screens/TwoFactorAuthScreen';
import { TeamManagementScreen } from './src/screens/TeamManagementScreen';
import { HelpSupportScreen } from './src/screens/HelpSupportScreen';
import { CloudWalletPlansScreen } from './src/screens/CloudWalletPlansScreen';
import { CreateStoreScreen } from './src/screens/CreateStoreScreen';
import { OnlineStoreRecord, OnlineStoreScreen } from './src/screens/OnlineStoreScreen';
import { StoreAdminScreen, StoreAdminTab } from './src/screens/StoreAdminScreen';
import { StoreUpgradeScreen } from './src/screens/StoreUpgradeScreen';
import { WorkspaceScreen } from './src/screens/WorkspaceScreen';
import { ServicesHubScreen } from './src/screens/ServicesHubScreen';
import { MarketplaceScreen } from './src/screens/MarketplaceScreen';
import { NotificationsScreen } from './src/screens/NotificationsScreen';
import { InAppWebViewScreen } from './src/screens/InAppWebViewScreen';
import { PaymentResultPayload, PaymentResultScreen } from './src/screens/PaymentResultScreen';
import { SystemErrorMode, SystemStateScreen } from './src/screens/SystemStateScreen';
import { AuthChallengeResponse, TIWLO_API_BASE, TiwloUser } from './src/services/tiwloAuth';
import {
  fetchBiometricStatus,
  registerSessionExpiredHandler,
} from './src/services/tiwloAccount';
import {
  clearPersistedSession,
  loadPersistedSession,
  savePersistedSession,
} from './src/services/tiwloSession';
import {
  fetchTiwloNotifications,
  triggerNativeLocalAlert,
} from './src/services/tiwloNotifications';
import {
  checkBiometricAvailable,
  evaluateAppIntegrity,
  hasFingerprintPromptSuppressed,
  postNativeLocalNotification,
  readDeviceNetworkState,
  suppressFingerprintPrompt,
} from './src/services/tiwloIntegrity';
import { emitRealtimeSync } from './src/services/tiwloRealtime';
import { colors } from './src/theme/tokens';

const TIWLO_ORIGIN = TIWLO_API_BASE.replace(/\/api$/, '');

type DedicatedRoute =
  | 'workspace'
  | 'workspace-hub'
  | 'my-online-store'
  | 'create-store'
  | 'marketplace'
  | 'notifications'
  | 'identity'
  | 'profile-settings'
  | 'active-sessions'
  | 'two-factor-auth'
  | 'team-management'
  | 'help-support'
  | 'billing';

type AuthRoute =
  | 'dashboard'
  | 'menu'
  | DedicatedRoute
  | 'store-admin'
  | 'store-upgrade'
  | 'plugin-webview'
  | 'checkout-webview'
  | 'payment-result'
  | 'login'
  | 'forgot_password'
  | 'create_account'
  | 'verification';

const DEDICATED_ROUTES: readonly DedicatedRoute[] = [
  'workspace',
  'workspace-hub',
  'my-online-store',
  'create-store',
  'marketplace',
  'notifications',
  'identity',
  'profile-settings',
  'active-sessions',
  'two-factor-auth',
  'team-management',
  'help-support',
  'billing',
];

const IN_APP_DASHBOARD_NAVS = new Set([
  'discord',
  'whatsapp-automation',
  'email',
  'oneprofile',
  'domains',
  'create-droplet',
  'my-droplets',
  'tpanel',
  'images',
  'snapshots',
  'backups',
  'volumes',
  'kubernetes',
]);

const PUBLIC_AUTH_ROUTES = new Set<AuthRoute>([
  'login',
  'forgot_password',
  'create_account',
  'verification',
]);

function TiwloRootApp() {
  const [route, setRoute] = useState<AuthRoute>('login');
  const [returnRoute, setReturnRoute] = useState<
    'dashboard' | 'menu' | 'my-online-store' | 'store-admin'
  >('menu');
  const [selectedAdminStore, setSelectedAdminStore] = useState<OnlineStoreRecord | null>(null);
  const [storeAdminTab, setStoreAdminTab] = useState<StoreAdminTab>('overview');
  const [activeNav, setActiveNav] = useState('dashboard');
  const [bottomTab, setBottomTab] = useState<BottomNavKey>('dashboard');
  const [selectedNotice, setSelectedNotice] = useState('');
  const [storeCount, setStoreCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [forgotInitialId, setForgotInitialId] = useState('');
  const [loginBanner, setLoginBanner] = useState('');
  const [challengeState, setChallengeState] = useState<{
    challenge: AuthChallengeResponse;
    mode: ChallengeMode;
  } | null>(null);
  const [user, setUser] = useState<TiwloUser | null>(null);
  const [sessionToken, setSessionToken] = useState<string | undefined>(undefined);
  const [sessionHydrated, setSessionHydrated] = useState(false);

  const [fingerprintEnrolled, setFingerprintEnrolled] = useState<boolean>(true);
  const [showFingerprintDrawer, setShowFingerprintDrawer] = useState(false);
  const [drawerDismissed, setDrawerDismissed] = useState(false);

  const [webViewTarget, setWebViewTarget] = useState<{
    title: string;
    url: string;
    storeTiwiId?: string;
  }>({
    title: 'Tiwlo Console',
    url: `${TIWLO_ORIGIN}/dashboard`,
  });
  const [checkoutMeta, setCheckoutMeta] = useState<{
    amount?: string;
    currency?: string;
    invoiceId?: string;
  }>({});
  const [paymentResult, setPaymentResult] = useState<PaymentResultPayload | null>(null);

  const [systemStateMode, setSystemStateMode] = useState<SystemErrorMode | null>(null);
  const [systemStateMsg, setSystemStateMsg] = useState<string | undefined>(undefined);
  const [retryingSystem, setRetryingSystem] = useState(false);

  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const biometricSupportedRef = useRef<boolean | null>(null);
  const checkedBiometricUserRef = useRef<string | null>(null);
  const lastHealthCheckAtRef = useRef<number>(0);
  const lastSyncAtRef = useRef<number>(0);
  const healthCheckInFlightRef = useRef<boolean>(false);

  // 1. Hydrate AES-256-GCM Encrypted Session Vault on launch (strictly no guest bypass)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadPersistedSession();
        if (cancelled) return;
        if (!saved?.user || !saved?.sessionToken) {
          setUser(null);
          setSessionToken(undefined);
          setRoute('login');
          return;
        }
        setUser(saved.user);
        setSessionToken(saved.sessionToken);
        if (saved.activeNav) setActiveNav(saved.activeNav);
        if (saved.bottomTab) setBottomTab(saved.bottomTab);
        if (
          saved.route &&
          (saved.route === 'dashboard' ||
            saved.route === 'menu' ||
            (DEDICATED_ROUTES as readonly string[]).includes(saved.route))
        ) {
          setRoute(saved.route as AuthRoute);
        } else {
          setRoute('dashboard');
        }
      } finally {
        if (!cancelled) setSessionHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Enforce login gate whenever session is absent
  useEffect(() => {
    if (!sessionHydrated) return;
    if ((!user || !sessionToken) && !PUBLIC_AUTH_ROUTES.has(route)) {
      setRoute('login');
    }
  }, [route, sessionHydrated, sessionToken, user]);

  // Persist session & active route whenever signed in state changes
  useEffect(() => {
    if (!sessionHydrated) return;
    if (!user || !sessionToken) return;
    const persistRoute = PUBLIC_AUTH_ROUTES.has(route) ? 'dashboard' : route;
    void savePersistedSession({
      user,
      sessionToken,
      route: persistRoute,
      activeNav,
      bottomTab,
    });
  }, [activeNav, bottomTab, route, sessionHydrated, sessionToken, user]);

  // Register global 401 handler when remote Admin/Web revocation terminates session
  useEffect(() => {
    registerSessionExpiredHandler(() => {
      setUser(null);
      setSessionToken(undefined);
      setFingerprintEnrolled(false);
      void clearPersistedSession();
      setLoginBanner('Your session was signed out from another device.');
      setRoute('login');
    });
    return () => registerSessionExpiredHandler(null);
  }, []);

  // 2. Non-blocking Native Integrity + Network Health Evaluator (deferred & throttled)
  const runHealthAndIntegrityCheck = useCallback(async (manual = false) => {
    const now = Date.now();
    if (!manual && (healthCheckInFlightRef.current || now - lastHealthCheckAtRef.current < 60000)) {
      return;
    }
    healthCheckInFlightRef.current = true;
    lastHealthCheckAtRef.current = now;
    if (manual) {
      setRetryingSystem(true);
    }
    try {
      const report = await evaluateAppIntegrity();
      if (report.updateRequired) {
        setSystemStateMode('update_required');
        setSystemStateMsg(
          report.lockReason ||
            'An official Google Play update or integrity check is required to continue.'
        );
        return;
      }

      const net = await readDeviceNetworkState();
      if (!net.connected || !net.hasInternet) {
        setSystemStateMode(net.hasWifi ? 'no_internet' : 'no_wifi');
        setSystemStateMsg(undefined);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4500);
      try {
        const probe = await fetch(`${TIWLO_ORIGIN}/api/health`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (probe.status === 503) {
          setSystemStateMode('maintenance');
          setSystemStateMsg(undefined);
          return;
        }
        if (probe.status >= 500) {
          setSystemStateMode('server_error');
          setSystemStateMsg(undefined);
          return;
        }
      } catch {
        // Network already verified; keep running cleanly if health endpoint optional/times out
      } finally {
        clearTimeout(timeoutId);
      }

      setSystemStateMode((prev) => (prev === null ? prev : null));
      setSystemStateMsg((prev) => (prev === undefined ? prev : undefined));
    } finally {
      healthCheckInFlightRef.current = false;
      if (manual) {
        setRetryingSystem(false);
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void runHealthAndIntegrityCheck(false);
    }, 600);
    return () => {
      clearTimeout(timer);
    };
  }, [runHealthAndIntegrityCheck]);

  // 3. Cached Biometric Check once per session -> never re-poll or prompt phones without fingerprint
  useEffect(() => {
    if (!user || !sessionToken) {
      setShowFingerprintDrawer(false);
      checkedBiometricUserRef.current = null;
      return;
    }
    const userKey = user.id || user.tiwiId || user.email || 'default';
    if (checkedBiometricUserRef.current === userKey) {
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const hw = await checkBiometricAvailable();
        if (cancelled) return;
        const supported = Boolean(hw.hardwarePresent && hw.available);
        biometricSupportedRef.current = supported;

        if (!supported) {
          checkedBiometricUserRef.current = userKey;
          setFingerprintEnrolled(false);
          setShowFingerprintDrawer(false);
          await suppressFingerprintPrompt(userKey, 'unavailable');
          return;
        }

        const suppressed = drawerDismissed || (await hasFingerprintPromptSuppressed(userKey));
        const remote = await fetchBiometricStatus(sessionToken).catch(() => ({
          enrolled: Boolean(hw.hasStoredKey),
        }));
        if (cancelled) return;
        checkedBiometricUserRef.current = userKey;

        const enrolled = Boolean(remote.enrolled);
        setFingerprintEnrolled(enrolled);
        if (enrolled) {
          await suppressFingerprintPrompt(userKey, 'enrolled');
          setShowFingerprintDrawer(false);
        } else if (!suppressed) {
          setShowFingerprintDrawer(true);
        } else {
          setShowFingerprintDrawer(false);
        }
      } catch {
        // Ignore non-fatal check errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawerDismissed, sessionToken, user]);

  // 4. Foreground-only Throttled Auto-Sync + Filtered Tiwlo Local Notification Polling
  useEffect(() => {
    const syncAll = async (force = false) => {
      if (AppState.currentState && AppState.currentState !== 'active') return;
      const now = Date.now();
      if (!force && now - lastSyncAtRef.current < 20000) return;
      lastSyncAtRef.current = now;

      emitRealtimeSync('all');
      if (!sessionToken) return;
      try {
        if (biometricSupportedRef.current === null) {
          const hw = await checkBiometricAvailable();
          biometricSupportedRef.current = Boolean(hw.hardwarePresent && hw.available);
        }
        const items = await fetchTiwloNotifications(sessionToken);
        const visibleItems =
          biometricSupportedRef.current === false
            ? items.filter(
                (n) => !/(fingerprint|biometric)/i.test(`${n.title} ${n.body}`)
              )
            : items;
        const unread = visibleItems.filter((n) => !n.read);
        setUnreadNotifications(unread.length);

        for (const item of unread.slice(0, 3)) {
          if (!seenNotifIdsRef.current.has(item.id)) {
            seenNotifIdsRef.current.add(item.id);
            await triggerNativeLocalAlert(item, { vibrate: true, showSystemAlert: false });
            await postNativeLocalNotification(item.title, item.body);
          }
        }
      } catch {
        // silent poll
      }
    };

    const interval = setInterval(() => {
      if (AppState.currentState === 'active') {
        void syncAll(false);
      }
    }, 30000);

    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void runHealthAndIntegrityCheck(false);
        void syncAll(false);
      }
    });

    return () => {
      clearInterval(interval);
      appSub.remove();
    };
  }, [runHealthAndIntegrityCheck, sessionToken]);

  // 5. Handle In-Browser Deep Links (tiwlo://billing/success or fail)
  useEffect(() => {
    const handleDeepUrl = (rawUrl: string | null | undefined) => {
      if (!rawUrl) return;
      const lower = rawUrl.toLowerCase();
      if (lower.includes('billing/success') || lower.includes('status=success') || lower.includes('status=paid')) {
        setPaymentResult({
          status: 'success',
          amount: checkoutMeta.amount,
          currency: checkoutMeta.currency || 'USD',
          invoiceId: checkoutMeta.invoiceId,
        });
        setRoute('payment-result');
        emitRealtimeSync('billing');
      } else if (lower.includes('billing/fail') || lower.includes('status=failed') || lower.includes('cancel')) {
        setPaymentResult({
          status: 'failed',
          amount: checkoutMeta.amount,
          currency: checkoutMeta.currency || 'USD',
          invoiceId: checkoutMeta.invoiceId,
        });
        setRoute('payment-result');
      }
    };

    void Linking.getInitialURL().then(handleDeepUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepUrl(url));
    return () => sub.remove();
  }, [checkoutMeta.amount, checkoutMeta.currency, checkoutMeta.invoiceId]);

  // Hardware Back Handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route === 'forgot_password' || route === 'create_account' || route === 'verification') {
        setRoute('login');
        return true;
      }
      if (route === 'checkout-webview' || route === 'payment-result') {
        setRoute('billing');
        return true;
      }
      if (route === 'store-upgrade') {
        setRoute(returnRoute === 'store-admin' ? 'store-admin' : 'my-online-store');
        return true;
      }
      if (route === 'store-admin') {
        setRoute('my-online-store');
        return true;
      }
      if (route === 'plugin-webview') {
        setRoute(returnRoute);
        return true;
      }
      if ((DEDICATED_ROUTES as readonly string[]).includes(route)) {
        setRoute(returnRoute);
        return true;
      }
      if (route === 'menu') {
        setRoute('dashboard');
        return true;
      }
      if (route === 'login' && user) {
        setRoute('dashboard');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [returnRoute, route, user]);

  const handleAuthenticated = (signedInUser: TiwloUser, token?: string) => {
    setUser(signedInUser);
    setSessionToken(token);
    setChallengeState(null);
    setLoginBanner('');
    setDrawerDismissed(false);
    setRoute('dashboard');
    emitRealtimeSync('all');
  };

  const openPluginDashboard = useCallback(
    (navId: string, label: string, fromRoute: 'dashboard' | 'menu' = 'dashboard') => {
      setReturnRoute(fromRoute);
      setWebViewTarget({
        title: label,
        url: `${TIWLO_ORIGIN}/dashboard?nav=${encodeURIComponent(navId)}&mobile_app=1`,
      });
      setRoute('plugin-webview');
    },
    []
  );

  const handleSelectNav = useCallback(
    (id: string, label: string, fromRoute: 'dashboard' | 'menu' = 'dashboard') => {
      setActiveNav(id);
      if (id === 'workspace/billing') {
        setReturnRoute(fromRoute);
        setRoute('billing');
        return;
      }
      if (id === 'workspace/performance' || id === 'workspace/security-alerts' || id === 'workspace/webhooks' || id === 'workspace/backup-policy' || id === 'workspace/data-export') {
        setReturnRoute(fromRoute);
        setRoute('workspace');
        return;
      }
      if ((DEDICATED_ROUTES as readonly string[]).includes(id)) {
        setReturnRoute(fromRoute);
        if (id === 'my-online-store') setBottomTab('products');
        if (id === 'create-store') setBottomTab('create-store');
        setRoute(id as DedicatedRoute);
        return;
      }
      if (IN_APP_DASHBOARD_NAVS.has(id)) {
        openPluginDashboard(id, label, fromRoute);
        return;
      }
      if (id === 'dashboard') {
        setBottomTab('dashboard');
        setSelectedNotice('');
        setRoute('dashboard');
        return;
      }
      setSelectedNotice(`${label} opened.`);
      setRoute('dashboard');
    },
    [openPluginDashboard]
  );

  const handleSelectBottomTab = useCallback((tab: BottomNavKey) => {
    if (tab === 'menu') {
      setBottomTab('menu');
      setRoute('menu');
      return;
    }
    if (tab === 'create-store') {
      setBottomTab('create-store');
      setReturnRoute('dashboard');
      setRoute('create-store');
      return;
    }
    if (tab === 'products') {
      setBottomTab('products');
      setReturnRoute('dashboard');
      setRoute('my-online-store');
      return;
    }
    if (tab === 'cloud') {
      setBottomTab('cloud');
      setReturnRoute('dashboard');
      setRoute('workspace-hub');
      return;
    }
    setBottomTab('dashboard');
    setActiveNav('dashboard');
    setSelectedNotice('');
    setRoute('dashboard');
  }, []);

  const handleSelectMenuItem = useCallback(
    (item: NavMenuItem) => {
      handleSelectNav(item.id, item.label, 'menu');
    },
    [handleSelectNav]
  );

  const handleAuthAction = useCallback(() => {
    if (user) {
      setUser(null);
      setSessionToken(undefined);
      setFingerprintEnrolled(false);
      void clearPersistedSession();
    }
    setLoginBanner('');
    setRoute('login');
  }, [user]);

  const handleBackFromSubpage = useCallback(() => {
    if (route === 'plugin-webview' && (returnRoute === 'my-online-store' || returnRoute === 'store-admin')) {
      const target = returnRoute;
      setReturnRoute('dashboard');
      setRoute(target);
      return;
    }
    setRoute(returnRoute === 'my-online-store' || returnRoute === 'store-admin' ? 'dashboard' : returnRoute);
  }, [returnRoute, route]);

  if (systemStateMode) {
    return (
      <SystemStateScreen
        mode={systemStateMode}
        detailMessage={systemStateMsg}
        retrying={retryingSystem}
        onRetry={() => void runHealthAndIntegrityCheck(true)}
      />
    );
  }

  if (!sessionHydrated) {
    return (
      <View style={[styles.root, styles.bootSplash]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="small" color={colors.primaryHover} />
      </View>
    );
  }

  const isAuthenticated = Boolean(user && sessionToken);
  const activeRoute: AuthRoute =
    !isAuthenticated && !PUBLIC_AUTH_ROUTES.has(route) ? 'login' : route;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      {isAuthenticated && activeRoute === 'dashboard' && (
        <DashboardScreen
          user={user}
          sessionToken={sessionToken}
          activeNav={activeNav}
          bottomTab={bottomTab}
          selectedNotice={selectedNotice}
          unreadNotifications={unreadNotifications}
          onSelectNav={(id, label) => handleSelectNav(id, label, 'dashboard')}
          onSelectBottomTab={handleSelectBottomTab}
          onOpenMenu={() => setRoute('menu')}
          onOpenNotifications={() => {
            setReturnRoute('dashboard');
            setRoute('notifications');
          }}
          onOpenPluginDashboard={(navId, label) =>
            openPluginDashboard(navId, label, 'dashboard')
          }
          onSetNotice={setSelectedNotice}
          onStoresLoaded={setStoreCount}
          onAuthAction={handleAuthAction}
        />
      )}

      {isAuthenticated && activeRoute === 'menu' && (
        <MenuScreen
          activeNav={activeNav}
          user={user}
          storeCount={storeCount}
          onBack={() => {
            setBottomTab('dashboard');
            setRoute('dashboard');
          }}
          onSelectItem={handleSelectMenuItem}
          onSelectBottomTab={handleSelectBottomTab}
          onAuthAction={handleAuthAction}
        />
      )}

      {isAuthenticated && activeRoute === 'workspace' && (
        <WorkspaceScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onNavigateTarget={(id, label) => handleSelectNav(id, label, 'dashboard')}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'workspace-hub' && (
        <ServicesHubScreen
          user={user}
          sessionToken={sessionToken}
          storeCount={storeCount}
          onBack={handleBackFromSubpage}
          onNavigateService={(id, label) => handleSelectNav(id, label, 'dashboard')}
          onOpenPluginDashboard={(navId, label) =>
            openPluginDashboard(navId, label, 'dashboard')
          }
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'my-online-store' && (
        <OnlineStoreScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onOpenCreateStore={() => {
            setReturnRoute('dashboard');
            setBottomTab('create-store');
            setRoute('create-store');
          }}
          onOpenBilling={() => {
            setReturnRoute('dashboard');
            setRoute('billing');
          }}
          onOpenStoreAdmin={(store, tab) => {
            setSelectedAdminStore(store);
            setStoreAdminTab(
              tab === 'catalog' || tab === 'orders' || tab === 'settings' ? tab : 'overview'
            );
            setRoute('store-admin');
          }}
          onOpenStoreUpgrade={(store) => {
            setSelectedAdminStore(store);
            setReturnRoute('my-online-store');
            setRoute('store-upgrade');
          }}
          onOpenInAppUrl={(title, url, storeTiwiId) => {
            setWebViewTarget({ title, url, storeTiwiId });
            setReturnRoute('my-online-store');
            setRoute('plugin-webview');
          }}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'store-admin' && selectedAdminStore && (
        <StoreAdminScreen
          user={user}
          sessionToken={sessionToken}
          store={selectedAdminStore}
          initialTab={storeAdminTab}
          onBack={() => setRoute('my-online-store')}
          onOpenUpgrade={() => {
            setReturnRoute('store-admin');
            setRoute('store-upgrade');
          }}
          onOpenInAppUrl={(title, url, storeTiwiId) => {
            setWebViewTarget({ title, url, storeTiwiId });
            setReturnRoute('store-admin');
            setRoute('plugin-webview');
          }}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'store-upgrade' && selectedAdminStore && (
        <StoreUpgradeScreen
          user={user}
          sessionToken={sessionToken}
          store={selectedAdminStore}
          onBack={() =>
            setRoute(returnRoute === 'store-admin' ? 'store-admin' : 'my-online-store')
          }
          onOpenBilling={() => {
            setReturnRoute('my-online-store');
            setRoute('billing');
          }}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'create-store' && (
        <CreateStoreScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onStoreCreated={() => emitRealtimeSync('all')}
          onOpenOnlineStore={() => {
            setBottomTab('products');
            setRoute('my-online-store');
          }}
          onOpenBilling={() => setRoute('billing')}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'marketplace' && (
        <MarketplaceScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onRequireAuth={() => setRoute('login')}
          onOpenPluginDashboard={(navId, label) =>
            openPluginDashboard(navId, label, 'dashboard')
          }
        />
      )}

      {isAuthenticated && activeRoute === 'notifications' && (
        <NotificationsScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onNavigateRoute={(routeId) =>
            handleSelectNav(routeId, 'Notification', 'dashboard')
          }
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'plugin-webview' && (
        <InAppWebViewScreen
          title={webViewTarget.title}
          url={webViewTarget.url}
          sessionToken={sessionToken}
          user={user}
          activeStoreId={webViewTarget.storeTiwiId}
          onBack={handleBackFromSubpage}
        />
      )}

      {isAuthenticated && activeRoute === 'checkout-webview' && (
        <InAppWebViewScreen
          title="Tiwlo Checkout"
          url={webViewTarget.url}
          sessionToken={sessionToken}
          user={user}
          checkoutMode
          onBack={() => setRoute('billing')}
          onPaymentResult={(result) => {
            setPaymentResult({
              status: result.status,
              amount: result.amount || checkoutMeta.amount,
              currency: result.currency || checkoutMeta.currency || 'USD',
              invoiceId: result.invoiceId || checkoutMeta.invoiceId,
              message: result.message,
            });
            emitRealtimeSync('billing');
            setRoute('payment-result');
          }}
        />
      )}

      {isAuthenticated && activeRoute === 'payment-result' && paymentResult && (
        <PaymentResultScreen
          result={paymentResult}
          onBackToWallet={() => setRoute('billing')}
          onRetryPayment={() => setRoute('billing')}
        />
      )}

      {isAuthenticated && activeRoute === 'identity' && (
        <IdentityScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'profile-settings' && (
        <UserSettingsScreen
          user={user}
          sessionToken={sessionToken}
          fingerprintEnrolled={fingerprintEnrolled}
          onFingerprintChanged={(val) => setFingerprintEnrolled(val)}
          onUserUpdated={(patch) =>
            setUser((prev) => (prev ? { ...prev, ...patch } : prev))
          }
          onBack={handleBackFromSubpage}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'active-sessions' && (
        <ActiveSessionsScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'two-factor-auth' && (
        <TwoFactorAuthScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'team-management' && (
        <TeamManagementScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onRequireAuth={() => setRoute('login')}
        />
      )}

      {isAuthenticated && activeRoute === 'help-support' && (
        <HelpSupportScreen
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
        />
      )}

      {isAuthenticated && activeRoute === 'billing' && (
        <CloudWalletPlansScreen
          user={user}
          sessionToken={sessionToken}
          onBack={handleBackFromSubpage}
          onRequireAuth={() => setRoute('login')}
          onOpenCheckoutWebView={(url, meta) => {
            setCheckoutMeta(meta || {});
            setWebViewTarget({ title: 'Tiwlo Checkout', url });
            setRoute('checkout-webview');
          }}
        />
      )}

      {activeRoute === 'login' && (
        <LoginScreen
          noticeBanner={loginBanner}
          onForgotPassword={(initialId) => {
            setLoginBanner('');
            setForgotInitialId(initialId);
            setRoute('forgot_password');
          }}
          onCreateAccount={() => {
            setLoginBanner('');
            setRoute('create_account');
          }}
          onAuthenticated={handleAuthenticated}
          onRequireChallenge={(challenge, mode) => {
            setChallengeState({ challenge, mode });
            setRoute('verification');
          }}
        />
      )}

      {activeRoute === 'forgot_password' && (
        <ForgotPasswordScreen
          initialIdentifier={forgotInitialId}
          onBack={() => setRoute('login')}
          onSuccess={(message) => {
            setLoginBanner(message);
            setRoute('login');
          }}
        />
      )}

      {activeRoute === 'create_account' && (
        <CreateAccountScreen
          onBack={() => setRoute('login')}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {activeRoute === 'verification' && challengeState && (
        <VerificationScreen
          challenge={challengeState.challenge}
          initialMode={challengeState.mode}
          onBack={() => {
            setChallengeState(null);
            setRoute('login');
          }}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {/* Touch-ID Slide-Up Fingerprint Enrollment Reminder Drawer (only on supported devices, cached on dismiss) */}
      {isAuthenticated ? (
        <FingerprintDrawer
          visible={showFingerprintDrawer}
          isUpdate={false}
          userEmailOrId={user?.email || user?.tiwiId || user?.id}
          sessionToken={sessionToken}
          onEnrolled={() => {
            const userKey = user?.id || user?.tiwiId || user?.email || 'default';
            void suppressFingerprintPrompt(userKey, 'enrolled');
            setFingerprintEnrolled(true);
            setShowFingerprintDrawer(false);
            setSelectedNotice('Fingerprint sign-in enabled on this device.');
          }}
          onDismiss={() => {
            const userKey = user?.id || user?.tiwiId || user?.email || 'default';
            void suppressFingerprintPrompt(userKey, 'dismissed');
            setDrawerDismissed(true);
            setShowFingerprintDrawer(false);
          }}
        />
      ) : null}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <TiwloRootApp />
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  bootSplash: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
