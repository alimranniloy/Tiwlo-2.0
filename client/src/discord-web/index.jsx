import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Wallet, X } from 'lucide-react';
import DiscordSidebar from './components/DiscordSidebar';
import DiscordHeader from './components/DiscordHeader';
import OverviewView from './views/OverviewView';
import BotsView from './views/BotsView';
import AddBotView from './views/AddBotView';
import BotDetailView from './views/BotDetailView';
import ServersView from './views/ServersView';
import AddServerView from './views/AddServerView';
import ServerDetailView from './views/ServerDetailView';
import AutomationsView from './views/AutomationsView';
import ModerationView from './views/ModerationView';
import TicketsView from './views/TicketsView';
import ActivityView from './views/ActivityView';
import SettingsView from './views/SettingsView';
import ServiceSubscriptionGateView from '../views/ServiceSubscriptionGateView';
import { DiscordAPI } from './api/discordApi';

export default function DiscordBotManager({ currentUser, onNavigateHome, onNavigateTab, showToast }) {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname || '/discord';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [subChecking, setSubChecking] = useState(true);
  const [subscriptionState, setSubscriptionState] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [dismissingAlert, setDismissingAlert] = useState(false);

  // Sync URL changes with popstate (back/forward)
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/discord');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((targetPath) => {
    setCurrentPath(targetPath);
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const navigateToBilling = useCallback((path = '/billing/credits', tab = 'credits') => {
    if (typeof onNavigateTab === 'function') {
      const cleanTab = path.replace(/^\/+/, '') || (tab === 'credits' ? 'billing/credits' : 'billing');
      onNavigateTab(cleanTab);
      return;
    }
    try {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.location.assign(path);
    }
  }, [onNavigateTab]);

  // Fetch overview data ONLY when subscription is verified active
  const loadOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DiscordAPI.getOverview();
      setOverviewData(data);
      if (data?.subscription) {
        setSubscriptionState((prev) => ({
          ...(prev || {}),
          subscription: data.subscription,
          tierInsight: data.tierInsight || prev?.tierInsight || null,
        }));
        if (!data.subscription.isActive) {
          setOverviewData(null);
        }
      }
    } catch (err) {
      if (err?.status === 402 || err?.code === 'SUBSCRIPTION_REQUIRED') {
        setSubscriptionState((prev) => ({
          ...(prev || {}),
          subscription: err.subscription || { ...(prev?.subscription || {}), isActive: false },
          packages: err.packages || prev?.packages || [],
          tierInsight: err.tierInsight || prev?.tierInsight || null,
        }));
        setOverviewData(null);
      } else {
        console.warn('[DiscordBotManager] Could not load overview:', err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const verifySubscriptionAndLoad = useCallback(async ({ showGateLoader = false } = {}) => {
    if (showGateLoader) setSubChecking(true);
    try {
      const [subRes, notifRes] = await Promise.all([
        DiscordAPI.getSubscription().catch((err) => {
          if (err?.status === 402 || err?.code === 'SUBSCRIPTION_REQUIRED') {
            return {
              subscription: err.subscription || { isActive: false },
              packages: err.packages || [],
              tierInsight: err.tierInsight || null,
            };
          }
          return null;
        }),
        DiscordAPI.getSubscriptionNotifications().catch(() => null),
      ]);

      const nextNotifications = Array.isArray(notifRes?.notifications)
        ? notifRes.notifications
        : Array.isArray(subRes?.notifications)
          ? subRes.notifications
          : [];
      setNotifications(nextNotifications);

      if (subRes) {
        setSubscriptionState(subRes);
      }

      if (subRes?.subscription?.isActive) {
        await loadOverviewData();
      } else {
        setOverviewData(null);
      }
    } finally {
      setSubChecking(false);
    }
  }, [loadOverviewData]);

  useEffect(() => {
    verifySubscriptionAndLoad({ showGateLoader: true });
  }, [verifySubscriptionAndLoad]);

  const isSubscribed = Boolean(subscriptionState?.subscription?.isActive);

  useEffect(() => {
    if (!isSubscribed) return undefined;
    const handleSubChanged = () => {
      verifySubscriptionAndLoad({ showGateLoader: false });
    };
    window.addEventListener('tiwlo:service-subscriptions-changed', handleSubChanged);
    return () => window.removeEventListener('tiwlo:service-subscriptions-changed', handleSubChanged);
  }, [isSubscribed, verifySubscriptionAndLoad]);

  const handleToggleAutoRenew = useCallback(async (nextAutoRenew) => {
    const res = await DiscordAPI.setAutoRenew(nextAutoRenew);
    const updatedSub = res?.subscription || {
      ...(subscriptionState?.subscription || {}),
      autoRenew: Boolean(nextAutoRenew),
    };
    setSubscriptionState((prev) => ({ ...(prev || {}), subscription: updatedSub }));
    setOverviewData((prev) => (prev ? { ...prev, subscription: updatedSub } : prev));
    window.dispatchEvent(new CustomEvent('tiwlo:service-subscriptions-changed'));
    return res;
  }, [subscriptionState?.subscription]);

  const unreadPaymentAlerts = notifications.filter(
    (n) => (n.kind === 'payment_failed' || n.type === 'payment_failed') && !n.readAt && !n.read
  );
  const activeSub = overviewData?.subscription || subscriptionState?.subscription || null;
  const hasPaymentAlert = Boolean(
    activeSub?.status === 'past_due' ||
      activeSub?.lastRenewalError ||
      unreadPaymentAlerts.length > 0
  );

  const handleDismissAlerts = useCallback(async () => {
    if (dismissingAlert) return;
    setDismissingAlert(true);
    try {
      const ids = unreadPaymentAlerts.map((n) => n.id).filter(Boolean);
      await DiscordAPI.markSubscriptionNotificationsRead(ids);
      const readAt = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) =>
          n.kind === 'payment_failed' || n.type === 'payment_failed' ? { ...n, readAt, read: true } : n
        )
      );
      showToast?.('Payment alert dismissed.', 'info');
    } catch (err) {
      showToast?.(err.message || 'Could not dismiss alert.', 'error');
    } finally {
      setDismissingAlert(false);
    }
  }, [dismissingAlert, unreadPaymentAlerts, showToast]);

  // Compute clean breadcrumbs from currentPath
  const getBreadcrumbs = () => {
    const path = currentPath.replace(/\/+$/, '');
    if (path === '/discord' || path === '/discord/overview' || path === '') {
      return ['Discord Console', 'Overview'];
    }
    if (path === '/discord/bots') return ['Discord Console', 'My bots'];
    if (path === '/discord/bots/new') return ['Discord Console', 'My bots', 'Add bot'];
    if (path.startsWith('/discord/bots/')) return ['Discord Console', 'My bots', 'Manage'];
    if (path === '/discord/servers') return ['Discord Console', 'Your servers'];
    if (path === '/discord/servers/new') return ['Discord Console', 'Your servers', 'Add server'];
    if (path.startsWith('/discord/servers/')) return ['Discord Console', 'Your servers', 'Manage'];
    if (path.startsWith('/discord/automations')) return ['Discord Console', 'Automations'];
    if (path === '/discord/moderation') return ['Discord Console', 'Moderation'];
    if (path === '/discord/tickets') return ['Discord Console', 'Tickets'];
    if (path === '/discord/activity') return ['Discord Console', 'Activity'];
    if (path === '/discord/settings') return ['Discord Console', 'Settings'];
    return ['Discord Console'];
  };

  // Render appropriate view based on clean routing (NO POPUPS)
  const renderCurrentView = () => {
    const path = currentPath.replace(/\/+$/, '');

    // Subroute: Add bot
    if (path === '/discord/bots/new') {
      return (
        <AddBotView
          onBack={() => navigateTo('/discord/bots')}
          onBotCreated={() => {
            loadOverviewData();
            navigateTo('/discord/bots');
          }}
        />
      );
    }

    // Subroute: Bot detail / manage
    if (path.startsWith('/discord/bots/') && path !== '/discord/bots/new') {
      const botId = path.replace('/discord/bots/', '');
      return (
        <BotDetailView
          botId={botId}
          onBack={() => navigateTo('/discord/bots')}
          onBotUpdated={loadOverviewData}
          onBotDeleted={loadOverviewData}
        />
      );
    }

    // Subroute: Official Bots hub
    if (path === '/discord/bots') {
      return (
        <BotsView
          overviewData={overviewData}
          currentUser={currentUser}
          onNavigate={navigateTo}
          onReload={loadOverviewData}
        />
      );
    }

    // Subroute: Add server
    if (path === '/discord/servers/new') {
      return (
        <AddServerView
          overviewData={overviewData}
          currentUser={currentUser}
          onBack={() => navigateTo('/discord/servers')}
          onReload={loadOverviewData}
          onServerCreated={async () => {
            await loadOverviewData();
            navigateTo('/discord/servers');
          }}
        />
      );
    }

    // Subroute: Server detail / manage
    if (path.startsWith('/discord/servers/') && path !== '/discord/servers/new') {
      const serverId = path.replace('/discord/servers/', '');
      return (
        <ServerDetailView
          serverId={serverId}
          overviewData={overviewData}
          currentUser={currentUser}
          onBack={() => navigateTo('/discord/servers')}
          onServerUpdated={loadOverviewData}
          onServerDeleted={loadOverviewData}
        />
      );
    }

    // Subroute: Servers list
    if (path === '/discord/servers') {
      return (
        <ServersView
          servers={overviewData?.servers || []}
          overviewData={overviewData}
          currentUser={currentUser}
          onNavigate={navigateTo}
          onReload={loadOverviewData}
        />
      );
    }

    // Subroute: Automations
    if (path.startsWith('/discord/automations')) {
      const tab = path.replace('/discord/automations/', '');
      return (
        <AutomationsView
          initialTab={tab === 'auto-roles' ? 'auto-roles' : (tab === 'commands' ? 'commands' : 'welcome')}
          onNavigate={navigateTo}
        />
      );
    }

    // Subroute: Moderation
    if (path === '/discord/moderation') {
      return <ModerationView onNavigate={navigateTo} />;
    }

    // Subroute: Tickets
    if (path === '/discord/tickets') {
      return <TicketsView onNavigate={navigateTo} />;
    }

    // Subroute: Activity
    if (path === '/discord/activity') {
      return (
        <ActivityView
          activities={overviewData?.recentActivities || []}
          onNavigate={navigateTo}
        />
      );
    }

    // Subroute: Settings
    if (path === '/discord/settings') {
      return (
        <SettingsView
          currentUser={currentUser}
          onNavigate={navigateTo}
        />
      );
    }

    // Default: Overview Dashboard
    return (
      <OverviewView
        overviewData={overviewData}
        loading={loading}
        currentUser={currentUser}
        subscriptionState={subscriptionState}
        notifications={notifications}
        onNavigate={navigateTo}
        onNavigateBilling={navigateToBilling}
        onToggleAutoRenew={handleToggleAutoRenew}
        onDismissAlerts={handleDismissAlerts}
        onReload={() => verifySubscriptionAndLoad({ showGateLoader: false })}
      />
    );
  };

  if (subChecking) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          <div className="h-24 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
            <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
            <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (!isSubscribed) {
    return (
      <ServiceSubscriptionGateView
        serviceType="discord"
        currentUser={currentUser}
        initialData={
          subscriptionState
            ? {
                ...subscriptionState,
                notifications,
              }
            : null
        }
        onBack={() => {
          if (onNavigateHome) onNavigateHome();
          else navigateToBilling('/workspace', 'overview');
        }}
        onNavigateBilling={navigateToBilling}
        onActivated={async (purchaseData) => {
          if (purchaseData?.subscription) {
            setSubscriptionState((prev) => ({
              ...(prev || {}),
              subscription: purchaseData.subscription,
            }));
          }
          await verifySubscriptionAndLoad({ showGateLoader: false });
        }}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="tiwi-v3-discord flex min-h-screen bg-[#f4f4f4] text-[#1F1F1F] font-sans antialiased">
      {/* Sidebar Navigation */}
      <DiscordSidebar
        currentPath={currentPath}
        onNavigate={navigateTo}
        currentUser={currentUser}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <DiscordHeader
          breadcrumbs={getBreadcrumbs()}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          currentUser={currentUser}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onNavigateHome={onNavigateHome}
        />

        {/* Scrollable Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 space-y-5">
          {hasPaymentAlert && (
            <div
              role="alert"
              className="mx-auto flex max-w-6xl flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-800 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                <div>
                  <p className="font-semibold text-rose-950">
                    {activeSub?.status === 'past_due'
                      ? 'Renewal Payment Failed — Action Required'
                      : 'Subscription Payment Alert'}
                  </p>
                  <p className="mt-0.5">
                    {activeSub?.lastRenewalError ||
                      unreadPaymentAlerts[0]?.message ||
                      'Your recent renewal attempt could not be charged. Top up your Tiwlo Credits to prevent service interruption.'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigateToBilling('/billing/credits', 'credits')}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Top Up Credits</span>
                </button>
                {unreadPaymentAlerts.length > 0 && (
                  <button
                    type="button"
                    disabled={dismissingAlert}
                    onClick={handleDismissAlerts}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>{dismissingAlert ? 'Dismissing...' : 'Dismiss'}</span>
                  </button>
                )}
              </div>
            </div>
          )}
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
}
