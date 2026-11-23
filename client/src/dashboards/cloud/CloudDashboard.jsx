import { applicationFetch } from '../../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  Check,
  CreditCard,
  DatabaseBackup,
  Download,
  GripVertical,
  KeyRound,
  Layers,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  Webhook,
} from 'lucide-react';
import CloudHeader from './components/CloudHeader';
import CloudSidebar from './components/CloudSidebar';
import CloudHeroBanner from './components/CloudHeroBanner';
import CloudStatCards from './components/CloudStatCards';
import CloudPerformanceCard from './components/CloudPerformanceCard';
import DropletsTable from './components/DropletsTable';
import ServiceStatusCard from './components/ServiceStatusCard';
import PopularImagesCard from './components/PopularImagesCard';
import QuickAccessCard from './components/QuickAccessCard';
import UsageOverviewCard from './components/UsageOverviewCard';
import CreateNewSection from './components/CreateNewSection';
import CloudRecentActivity from './components/CloudRecentActivity';

// Dedicated Views (No Modals - Full Page Routing)
import CreateDropletView from './views/CreateDropletView';
import CreateStoreView from './views/CreateStoreView';
import ImagesView from './views/ImagesView';
import SnapshotsView from './views/SnapshotsView';
import BackupsView from './views/BackupsView';
import VolumesView from './views/VolumesView';
import KubernetesView from './views/KubernetesView';
import MyOnlineStoreView from './views/MyOnlineStoreView';
import WhatsAppAutomationView from './views/WhatsAppAutomationView';
import HelpSupportView from '../../views/HelpSupportView';
import CloudBillingView from './views/CloudBillingView';
import WorkspaceView from '../../views/workspace/WorkspaceView';
import WorkspaceServiceDetailView from '../../views/workspace/WorkspaceServiceDetailView';
import WorkspaceBillingView from '../../views/workspace/WorkspaceBillingView';
import DomainsView from './views/DomainsView';
import WorkspaceOperationsView from '../../views/workspace/WorkspaceOperationsView';
import MarketplaceView from '../../views/marketplace/MarketplaceView';
import MarketplaceProductDetailView from '../../views/marketplace/MarketplaceProductDetailView';
import OneProfileSettingsView from '../../oneprofile/views/OneProfileSettingsView';
import IdentityView from './views/IdentityView';
import UserProfileSettingsView from '../../views/UserProfileSettingsView';
import UserTwoFactorView from '../../views/UserTwoFactorView';
import UserSessionsView from '../../views/UserSessionsView';
import UserTeamManagementView from '../../views/UserTeamManagementView';
import WorkspacePerformanceView from '../../views/workspace/WorkspacePerformanceView';
import WorkspaceSecurityAlertsView from '../../views/workspace/WorkspaceSecurityAlertsView';
import WorkspaceDataExportView from '../../views/workspace/WorkspaceDataExportView';
import WorkspaceWebhooksView from '../../views/workspace/WorkspaceWebhooksView';
import WorkspaceBackupPolicyView from '../../views/workspace/WorkspaceBackupPolicyView';

// Real GraphQL / REST Client
import {
  getCloudDashboardData,
  getUserStores,
  createStoreGraphQL
} from './graphql/cloudQueries';

export default function CloudDashboard({
  currentUser,
  initialNav = 'dashboard',
  onLogout,
  onOpenStoreDashboard,
  onNavigateTab,
  showToast
}) {
  const userId = currentUser?.id || currentUser?.tiwiId || null;
  const navStorageKey = `tiwlo.cloudActiveNav.${userId || 'anon'}`;

  const [activeNav, setActiveNav] = useState(() => {
    if (initialNav && initialNav !== 'dashboard') return initialNav;
    try {
      const saved = sessionStorage.getItem(navStorageKey);
      if (saved === 'create-store' || saved === 'my-online-store') return saved;
    } catch {}
    return initialNav || 'dashboard';
  });

  useEffect(() => {
    if (initialNav && initialNav !== 'dashboard') {
      setActiveNav(initialNav);
    }
  }, [initialNav]);

  useEffect(() => {
    try {
      if (activeNav === 'create-store' || activeNav === 'my-online-store') {
        sessionStorage.setItem(navStorageKey, activeNav);
      } else {
        sessionStorage.removeItem(navStorageKey);
      }
    } catch {}
  }, [activeNav, navStorageKey]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cloudError, setCloudError] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [billingInitialTab, setBillingInitialTab] = useState(() => {
    try {
      const path = window.location.pathname || '';
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (path.startsWith('/billing/credits') || path.startsWith('/cloud/billing/credits') || tabParam === 'credits') {
        return 'credits';
      }
      if (path.startsWith('/billing/invoices/')) {
        return 'invoices';
      }
    } catch {}
    return 'overview';
  });
  const [serviceSubscriptions, setServiceSubscriptions] = useState({
    discord: null,
    whatsapp: null,
  });

  // Cloud Dashboard Data States
  const [metrics, setMetrics] = useState(null);
  const [droplets, setDroplets] = useState([]);
  const [activities, setActivities] = useState([]);
  const [popularImages, setPopularImages] = useState([]);

  // Multi-Store States ("Your Store" Section)
  const [userStores, setUserStores] = useState([]);
  const [profileUser, setProfileUser] = useState(currentUser);
  const [currentStore, setCurrentStore] = useState(null);

  useEffect(() => {
    if (currentUser) setProfileUser(currentUser);
  }, [currentUser]);

  useEffect(() => {
    const handleUserUpdated = (event) => {
      if (event?.detail) {
        setProfileUser((prev) => ({ ...(prev || {}), ...event.detail }));
      }
    };
    window.addEventListener('tiwlo:user-updated', handleUserUpdated);
    return () => window.removeEventListener('tiwlo:user-updated', handleUserUpdated);
  }, []);

  const launchStoreConsole = (store = currentStore) => {
    if (!store?.tiwiId) {
      setActiveNav('create-store');
      showToast?.('Create a store first to open the store dashboard.', 'info');
      return;
    }
    setCurrentStore(store);
    try {
      window.sessionStorage.setItem('tiwlo.selectedStore', JSON.stringify(store));
    } catch {}
    onOpenStoreDashboard?.(store);
  };

  const [initialDropletImage, setInitialDropletImage] = useState('Ubuntu 24.04 LTS');
  const DEFAULT_DASH_WIDGET_ORDER = ['quick-shortcuts', 'active-services', 'metrics', 'performance', 'droplets', 'create-new', 'overview-services'];
  const [widgetOrder, setWidgetOrder] = useState(DEFAULT_DASH_WIDGET_ORDER);
  const [editWidgetLayout, setEditWidgetLayout] = useState(false);
  const [draggedWidgetId, setDraggedWidgetId] = useState(null);
  const [savingWidgetOrder, setSavingWidgetOrder] = useState(false);

  const navigateCloudView = (target) => {
    setActiveNav(target);
    try {
      const pathMap = {
        dashboard: '/workspace',
        workspace: '/workspace',
        'workspace-hub': '/workspace/hub',
        marketplace: '/marketplace',
        identity: '/identity',
        'whatsapp-automation': '/whatsapp-automation',
        'profile-settings': '/profile-settings',
        'active-sessions': '/active-sessions',
        'two-factor-auth': '/two-factor-auth',
        'team-management': '/team-management',
      };
      const cleanPath = pathMap[target] || (target.startsWith('/') ? target : `/${target}`);
      if (window.location.pathname !== cleanPath) {
        window.history.pushState(null, '', cleanPath);
      }
    } catch {}
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    applicationFetch('/api/user/account', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const order = d?.account?.preferences?.widgetConfig?.widgetOrder;
        if (!cancelled && Array.isArray(order) && order.length) {
          const valid = order.filter((id) => DEFAULT_DASH_WIDGET_ORDER.includes(id));
          const missing = DEFAULT_DASH_WIDGET_ORDER.filter((id) => !valid.includes(id));
          setWidgetOrder([...valid, ...missing]);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  const persistWidgetOrder = async (nextOrder) => {
    setWidgetOrder(nextOrder);
    setSavingWidgetOrder(true);
    try {
      await applicationFetch('/api/user/account/preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgetConfig: { widgetOrder: nextOrder } })
      });
    } catch {} finally {
      setSavingWidgetOrder(false);
    }
  };

  const moveWidget = (id, dir) => {
    const idx = widgetOrder.indexOf(id);
    const nextIdx = idx + dir;
    if (idx === -1 || nextIdx < 0 || nextIdx >= widgetOrder.length) return;
    const copy = [...widgetOrder];
    [copy[idx], copy[nextIdx]] = [copy[nextIdx], copy[idx]];
    persistWidgetOrder(copy);
  };

  // Load Cloud Data from real GraphQL
  const loadCloudData = async () => {
    try {
      setLoading(true);
      setCloudError('');
      const [cloudData, storesData] = await Promise.all([
        getCloudDashboardData(userId),
        getUserStores(userId)
      ]);

      if (cloudData) {
        setMetrics(cloudData.metrics);
        setDroplets(cloudData.droplets || []);
        setActivities(cloudData.activities || []);
        setPopularImages(cloudData.popularImages || []);
      }

      if (storesData && storesData.length > 0) {
        setUserStores(storesData);
        let preferredStore;
        try {
          const storedStore = JSON.parse(window.sessionStorage.getItem('tiwlo.selectedStore') || 'null');
          preferredStore = storesData.find(store => store.tiwiId === storedStore?.tiwiId);
        } catch {}
        setCurrentStore(prev => (
          preferredStore ||
          storesData.find(store => store.tiwiId === prev?.tiwiId) ||
          storesData[0]
        ));
      } else {
        setUserStores([]);
        setCurrentStore(null);
      }
    } catch (err) {
      setCloudError(err.message || 'Could not load cloud dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCloudData();
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const fetchServiceSubscriptions = async () => {
      if (!userId) {
        if (!cancelled) setServiceSubscriptions({ discord: null, whatsapp: null });
        return;
      }
      const token =
        localStorage.getItem('stockpro_session') ||
        sessionStorage.getItem('stockpro_session') ||
        '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const [discordRes, whatsappRes] = await Promise.all([
        applicationFetch('/api/discord/subscription', { credentials: 'include', headers })
          .then((r) => (r.ok ? r.json().catch(() => null) : null))
          .catch(() => null),
        applicationFetch('/api/whatsapp/subscription', { credentials: 'include', headers })
          .then((r) => (r.ok ? r.json().catch(() => null) : null))
          .catch(() => null),
      ]);
      if (cancelled) return;
      setServiceSubscriptions({
        discord: discordRes?.subscription || null,
        whatsapp: whatsappRes?.subscription || null,
      });
    };

    fetchServiceSubscriptions();
    const handleSubscriptionChange = () => {
      fetchServiceSubscriptions();
    };
    window.addEventListener('tiwlo:service-subscriptions-changed', handleSubscriptionChange);
    return () => {
      cancelled = true;
      window.removeEventListener('tiwlo:service-subscriptions-changed', handleSubscriptionChange);
    };
  }, [userId]);

  useEffect(() => {
    const syncBillingTabFromUrl = () => {
      try {
        const path = window.location.pathname || '';
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        if (path.startsWith('/billing/credits') || path.startsWith('/cloud/billing/credits') || tabParam === 'credits') {
          setBillingInitialTab('credits');
          setActiveNav('billing');
        } else if (path.startsWith('/billing/invoices/')) {
          setBillingInitialTab('invoices');
          setActiveNav('billing');
        }
      } catch {}
    };
    window.addEventListener('popstate', syncBillingTabFromUrl);
    return () => window.removeEventListener('popstate', syncBillingTabFromUrl);
  }, []);

  // Handler: Create Store ("My Online Store" + action)
  const handleCreateStore = async (storeInput) => {
    try {
      const newStore = await createStoreGraphQL(userId, storeInput);
      if (!newStore) throw new Error('The store could not be created.');
      showToast?.(`Store "${newStore.storeName}" (${newStore.tiwiId}) created successfully!`);
      setUserStores(prev => [...prev, newStore]);
      setCurrentStore(newStore);
      await loadCloudData();
      return newStore;
    } catch (err) {
      const msg = String(err?.message || '');
      if (err?.banned || /suspended:|blocked due to multiple free-account/i.test(msg)) {
        const banInfo = {
          email: currentUser?.email || '',
          banReason: msg
        };
        try {
          sessionStorage.setItem('tiwlo_banned_info', JSON.stringify(banInfo));
          localStorage.setItem('tiwlo_banned_info', JSON.stringify(banInfo));
        } catch {}
        onNavigateTab?.('account-disabled');
      }
      throw err;
    }
  };

  // Filter droplets by search query
  const filteredDroplets = droplets.filter(d => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.name?.toLowerCase().includes(q) ||
      d.ip?.toLowerCase().includes(q) ||
      d.region?.toLowerCase().includes(q) ||
      d.specs?.toLowerCase().includes(q)
    );
  });

  const isBillingRoute = activeNav === 'billing' || activeNav.startsWith('billing');

  return (
    <div className={`tiwi-v3-cloud flex min-h-dvh font-sans text-neutral-950 dark:bg-neutral-950 dark:text-neutral-100 ${isBillingRoute ? 'bg-white' : 'bg-neutral-50'}`}>
      {/* Left Sidebar */}
      <CloudSidebar
        activeNav={activeNav}
        setActiveNav={(nav) => navigateCloudView(nav)}
        currentUser={profileUser || currentUser}
        userStores={userStores}
        currentStore={currentStore}
        serviceSubscriptions={serviceSubscriptions}
        onNavigateTab={onNavigateTab}
        onOpenCreateStore={() => setActiveNav('create-store')}
        onOpenCreateDroplet={() => {
          setInitialDropletImage('Ubuntu 24.04 LTS');
          setActiveNav('create-droplet');
        }}
        mobileOpen={mobileNavOpen}
        setMobileOpen={setMobileNavOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <CloudHeader
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentUser={profileUser || currentUser}
          onUserUpdated={(updatedUser) => setProfileUser((prev) => ({ ...(prev || {}), ...updatedUser }))}
          onLogout={onLogout}
          onOpenStore={currentStore?.tiwiId ? () => launchStoreConsole(currentStore) : null}
          onSwitchStore={() => setActiveNav('my-online-store')}
          onOpenCreateDroplet={() => {
            setInitialDropletImage('Ubuntu 24.04 LTS');
            setActiveNav('create-droplet');
          }}
          onOpenSettings={(tab) => {
            if (tab === 'billing') {
              setBillingInitialTab('overview');
              navigateCloudView('billing');
            } else if (tab === 'profile' || tab === 'profile-settings') {
              navigateCloudView('profile-settings');
            } else if (tab === 'security') {
              navigateCloudView('profile-settings/security');
            } else if (tab === 'notifications' || tab === 'widgets' || tab === 'activity') {
              navigateCloudView(`profile-settings/${tab}`);
            } else if (tab === 'two-factor-auth') {
              navigateCloudView('two-factor-auth');
            } else if (tab === 'active-sessions' || tab === 'sessions') {
              navigateCloudView('active-sessions');
            } else if (tab === 'team-management') {
              navigateCloudView('team-management');
            } else if (tab && tab.includes('/')) {
              navigateCloudView(tab);
            } else {
              navigateCloudView('profile-settings');
            }
          }}
          onOpenBilling={(tab = 'overview') => {
            setBillingInitialTab(tab);
            setActiveNav('billing');
            try {
              if (window.location.pathname !== '/billing') {
                window.history.pushState(null, '', '/billing');
              }
            } catch (e) {}
          }}
          showToast={showToast}
          onToggleMobileMenu={() => setMobileNavOpen(true)}
        />

        {/* Scrollable Dashboard Body */}
        <main className="min-w-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6 lg:px-10">
          {cloudError && (
            <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <span>{cloudError}</span>
              <button
                type="button"
                onClick={loadCloudData}
                className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-bold hover:bg-rose-100"
              >
                Retry
              </button>
            </div>
          )}
          {activeNav === 'identity' ? (
            <div className="-m-3.5 min-h-full sm:-m-6 lg:-m-8">
              <IdentityView
                currentUser={currentUser}
                onStartVerification={() => onNavigateTab?.('verification')}
              />
            </div>
          ) : activeNav === 'oneprofile-settings' ? (
            <div className="max-w-[1000px] mx-auto space-y-5">
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Back to Cloud Dashboard
              </button>
              <OneProfileSettingsView
                currentUser={profileUser}
                onUserUpdated={setProfileUser}
              />
            </div>
          ) : activeNav === 'domains' ? (
            <div className="max-w-[1500px] mx-auto"><DomainsView currentUser={currentUser} showToast={showToast} /></div>
          ) : activeNav === 'create-droplet' ? (
            <div className="max-w-[1500px] mx-auto">
              <CreateDropletView
                onBack={() => setActiveNav('dashboard')}
                onDropletCreated={() => {
                  loadCloudData();
                  setActiveNav('my-droplets');
                }}
                showToast={showToast}
                initialImage={initialDropletImage}
              />
            </div>
          ) : activeNav === 'create-store' ? (
            <div className="max-w-[1500px] mx-auto">
              <CreateStoreView
                userId={userId}
                userStores={userStores}
                onBack={() => setActiveNav('my-online-store')}
                onCreateStore={handleCreateStore}
                onOpenBilling={(tab = 'credits') => {
                  setBillingInitialTab(tab);
                  setActiveNav('billing');
                }}
                onOpenUpgrade={(store) => {
                  if (store?.tiwiId) {
                    setCurrentStore(store);
                    try {
                      window.sessionStorage.setItem('tiwlo.selectedStore', JSON.stringify(store));
                    } catch {}
                  }
                  onNavigateTab?.('pricing');
                }}
              />
            </div>
          ) : activeNav === 'images' ? (
            <div className="max-w-[1500px] mx-auto">
              <ImagesView
                onDeployImage={(img) => {
                  setInitialDropletImage(img);
                  setActiveNav('create-droplet');
                }}
                onBack={() => setActiveNav('dashboard')}
              />
            </div>
          ) : activeNav === 'snapshots' ? (
            <div className="max-w-[1500px] mx-auto">
              <SnapshotsView
                droplets={droplets}
                showToast={showToast}
              />
            </div>
          ) : activeNav === 'backups' ? (
            <div className="max-w-[1500px] mx-auto">
              <BackupsView
                droplets={droplets}
                showToast={showToast}
              />
            </div>
          ) : activeNav === 'volumes' ? (
            <div className="max-w-[1500px] mx-auto">
              <VolumesView
                droplets={droplets}
                showToast={showToast}
              />
            </div>
          ) : activeNav === 'kubernetes' ? (
            <div className="max-w-[1500px] mx-auto">
              <KubernetesView
                showToast={showToast}
              />
            </div>
          ) : activeNav === 'my-online-store' ? (
            <div className="max-w-[1500px] mx-auto">
              <MyOnlineStoreView
                currentUser={currentUser}
                userStores={userStores}
                currentStore={currentStore}
                onSelectStore={(st) => setCurrentStore(st)}
                onOpenStoreDashboard={launchStoreConsole}
                onOpenCreateStore={() => setActiveNav('create-store')}
                onOpenBilling={(tab = 'overview') => {
                  setBillingInitialTab(tab);
                  setActiveNav('billing');
                  try {
                    if (window.location.pathname !== '/billing') {
                      window.history.pushState(null, '', '/billing');
                    }
                  } catch {}
                }}
                onRenewSuccess={loadCloudData}
                showToast={showToast}
                onOpenUpgrade={(store) => {
                  if (store?.tiwiId) {
                    setCurrentStore(store);
                    try {
                      window.sessionStorage.setItem('tiwlo.selectedStore', JSON.stringify(store));
                    } catch {}
                  }
                  onNavigateTab?.('pricing');
                }}
              />
            </div>
          ) : (activeNav === 'whatsapp-automation' || activeNav.startsWith('whatsapp-automation')) ? (
            <div className="max-w-[1500px] mx-auto">
              <WhatsAppAutomationView
                currentUser={currentUser}
                currentStore={currentStore}
                userStores={userStores}
                showToast={showToast}
                onBack={() => navigateCloudView('workspace-hub')}
                onNavigateBilling={(path = '/billing/credits', tab = 'credits') => {
                  setBillingInitialTab(tab);
                  setActiveNav('billing');
                  try {
                    if (window.location.pathname !== path) {
                      window.history.pushState(null, '', path);
                    }
                  } catch {}
                }}
              />
            </div>
          ) : (activeNav === 'help-support' || activeNav.startsWith('help-support')) ? (
            <div className="max-w-[1500px] mx-auto">
              <HelpSupportView
                currentUser={currentUser}
                initialSubRoute={activeNav.startsWith('help-support/') ? activeNav.replace('help-support/', '') : 'home'}
                showToast={showToast}
                onBackToDashboard={() => {
                  setActiveNav('dashboard');
                  try {
                    window.history.pushState(null, '', '/');
                  } catch (e) {}
                }}
              />
            </div>
          ) : (activeNav === 'billing' || activeNav.startsWith('billing')) ? (
            <div className="mx-auto max-w-7xl">
              <CloudBillingView
                currentUser={currentUser}
                initialTab={billingInitialTab}
                showToast={showToast}
                onBack={() => {
                  setActiveNav('dashboard');
                  try {
                    window.history.pushState(null, '', '/');
                  } catch (e) {}
                }}
              />
            </div>
          ) : (
            activeNav === 'profile-settings' ||
            activeNav.startsWith('profile-settings/') ||
            activeNav === 'user-settings' ||
            activeNav.startsWith('user-settings/') ||
            activeNav === 'account-settings' ||
            activeNav.startsWith('account-settings/')
          ) ? (
            <div className="max-w-[1500px] mx-auto">
              <UserProfileSettingsView
                currentUser={profileUser || currentUser}
                initialSection={activeNav.includes('/') ? activeNav.split('/')[1] : 'profile'}
                onUserUpdated={(updatedUser) => setProfileUser((prev) => ({ ...(prev || {}), ...updatedUser }))}
                onBack={() => navigateCloudView('dashboard')}
                onOpenTwoFactor={() => navigateCloudView('two-factor-auth')}
                onOpenSessions={() => navigateCloudView('active-sessions')}
                onOpenTeamManagement={() => navigateCloudView('team-management')}
                showToast={showToast}
              />
            </div>
          ) : activeNav === 'active-sessions' ? (
            <div className="max-w-[1500px] mx-auto">
              <UserSessionsView
                onBack={() => navigateCloudView('profile-settings/security')}
                showToast={showToast}
              />
            </div>
          ) : activeNav === 'two-factor-auth' ? (
            <div className="max-w-[1500px] mx-auto">
              <UserTwoFactorView
                currentUser={profileUser || currentUser}
                onUserUpdated={(updatedUser) => setProfileUser((prev) => ({ ...(prev || {}), ...updatedUser }))}
                onBack={() => navigateCloudView('profile-settings/security')}
                showToast={showToast}
              />
            </div>
          ) : activeNav === 'team-management' ? (
            <div className="max-w-[1500px] mx-auto">
              <UserTeamManagementView
                currentUser={profileUser || currentUser}
                onBack={() => navigateCloudView('dashboard')}
                onOpenTwoFactor={() => navigateCloudView('two-factor-auth')}
                showToast={showToast}
              />
            </div>
          ) : (activeNav === 'workspace-hub' || activeNav === 'workspace/hub' || activeNav.startsWith('workspace/')) ? (
            <div className="max-w-[1500px] mx-auto">
              {activeNav === 'workspace/billing' ? (
                <WorkspaceBillingView
                  currentUser={profileUser || currentUser}
                  onBack={() => navigateCloudView('workspace-hub')}
                  onNavigate={(target) => navigateCloudView(target === 'workspace' ? 'workspace-hub' : target)}
                  onOpenCloudBilling={(tab = 'overview') => {
                    setBillingInitialTab(tab);
                    navigateCloudView('billing');
                  }}
                />
              ) : activeNav === 'workspace/performance' ? (
                <WorkspacePerformanceView
                  currentUser={profileUser || currentUser}
                  onBack={() => navigateCloudView('dashboard')}
                  onNavigate={(target) => navigateCloudView(target)}
                  showToast={showToast}
                />
              ) : activeNav === 'workspace/security-alerts' ? (
                <WorkspaceSecurityAlertsView
                  currentUser={profileUser || currentUser}
                  onBack={() => navigateCloudView('dashboard')}
                  onNavigate={(target) => navigateCloudView(target)}
                  showToast={showToast}
                />
              ) : activeNav === 'workspace/data-export' ? (
                <WorkspaceDataExportView
                  currentUser={profileUser || currentUser}
                  onBack={() => navigateCloudView('dashboard')}
                  showToast={showToast}
                />
              ) : activeNav === 'workspace/webhooks' ? (
                <WorkspaceWebhooksView
                  onBack={() => navigateCloudView('dashboard')}
                  showToast={showToast}
                />
              ) : activeNav === 'workspace/backup-policy' ? (
                <WorkspaceBackupPolicyView
                  onBack={() => navigateCloudView('dashboard')}
                  showToast={showToast}
                />
              ) : activeNav === 'workspace/operations' ? (
                <WorkspaceOperationsView
                  onBack={() => {
                    setActiveNav('workspace-hub');
                    try { window.history.pushState(null, '', '/workspace/hub'); } catch (e) {}
                  }}
                  onNavigate={(target) => {
                    setActiveNav(target === 'workspace' ? 'workspace-hub' : target);
                    try { window.history.pushState(null, '', `/${target === 'workspace' ? 'workspace/hub' : target}`); } catch (e) {}
                  }}
                />
              ) : activeNav.startsWith('workspace/service/') ? (
                <WorkspaceServiceDetailView
                  serviceId={activeNav.replace('workspace/service/', '')}
                  onBack={() => {
                    setActiveNav('workspace-hub');
                    try { window.history.pushState(null, '', '/workspace/hub'); } catch (e) {}
                  }}
                  onNavigate={(target) => {
                    if (target === 'discord') {
                      onNavigateTab?.(target);
                      return;
                    }
                    setActiveNav(target === 'workspace' ? 'workspace-hub' : target);
                    try { window.history.pushState(null, '', `/${target === 'workspace' ? 'workspace/hub' : target}`); } catch (e) {}
                  }}
                />
              ) : (
                <WorkspaceView
                  onOpenStoreDashboard={launchStoreConsole}
                  showToast={showToast}
                  onNavigate={(target) => {
                    setActiveNav(target === 'workspace' ? 'workspace-hub' : target);
                    try { window.history.pushState(null, '', `/${target === 'workspace' ? 'workspace/hub' : target}`); } catch (e) {}
                  }}
                />
              )}
            </div>
          ) : (activeNav === 'marketplace' || activeNav.startsWith('marketplace')) ? (
            <div className="max-w-[1500px] mx-auto">
              {activeNav.startsWith('marketplace/') ? (
                <MarketplaceProductDetailView
                  productId={activeNav.replace('marketplace/', '')}
                  onBack={() => {
                    setActiveNav('marketplace');
                    try { window.history.pushState(null, '', '/marketplace'); } catch (e) {}
                  }}
                  onNavigate={(target) => {
                    setActiveNav(target);
                    try { window.history.pushState(null, '', `/${target}`); } catch (e) {}
                  }}
                />
              ) : (
                <MarketplaceView
                  onNavigate={(target) => {
                    setActiveNav(target);
                    try { window.history.pushState(null, '', `/${target}`); } catch (e) {}
                  }}
                />
              )}
            </div>
          ) : (
            <div className="mx-auto max-w-7xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  Workspace Overview · Drag or reorder widget sections below
                </div>
                <button
                  type="button"
                  onClick={() => setEditWidgetLayout((v) => !v)}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                    editWidgetLayout
                      ? 'border-[#1ED760] bg-[#1ED760] text-black font-semibold'
                      : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900'
                  }`}
                >
                  {editWidgetLayout ? <Check className="h-3.5 w-3.5" /> : <SlidersHorizontal className="h-3.5 w-3.5" />}
                  <span>{editWidgetLayout ? (savingWidgetOrder ? 'Saving Layout...' : 'Done Reordering') : 'Customize Layout'}</span>
                </button>
              </div>

              <CloudHeroBanner
                currentUser={profileUser || currentUser}
                onCreateDroplet={() => {
                  setInitialDropletImage('Ubuntu 24.04 LTS');
                  setActiveNav('create-droplet');
                }}
                onOpenTPanel={() => window.open('/tpanel', '_blank', 'noopener,noreferrer')}
              />

              {widgetOrder.map((widgetKey, wIdx) => {
                const renderWidgetBody = () => {
                  if (widgetKey === 'quick-shortcuts') {
                    return (
                      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Quick Action Shortcuts</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
                          {[
                            { id: 'workspace/performance', label: 'Performance', icon: Activity },
                            { id: 'workspace/security-alerts', label: 'Security Alerts', icon: ShieldAlert },
                            { id: 'workspace/billing', label: 'Billing History', icon: CreditCard },
                            { id: 'workspace/webhooks', label: 'Webhooks', icon: Webhook },
                            { id: 'workspace/backup-policy', label: 'Backup Policy', icon: DatabaseBackup },
                            { id: 'workspace/data-export', label: 'Data Export', icon: Download },
                            { id: 'team-management', label: 'Team Access', icon: Users },
                            { id: 'two-factor-auth', label: '2FA & QR', icon: KeyRound },
                          ].map((sc) => {
                            const Icon = sc.icon;
                            return (
                              <button
                                key={sc.id}
                                type="button"
                                onClick={() => navigateCloudView(sc.id)}
                                className="flex flex-col items-start gap-2 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/50 p-3 text-left text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-[#1ED760] hover:bg-[#1ED760]/5 transition cursor-pointer"
                              >
                                <Icon className="h-4 w-4 text-[#1ED760]" />
                                <span className="truncate w-full">{sc.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  if (widgetKey === 'active-services') {
                    return (
                      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                          <div>
                            <h3 className="text-sm font-semibold text-neutral-950 dark:text-white flex items-center gap-2">
                              <Layers className="h-4 w-4 text-[#1ED760]" />
                              Active Workspace Services
                            </h3>
                            <p className="text-xs text-neutral-500">Live overview of connected stores and cloud instances on your account</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigateCloudView('workspace-hub')}
                            className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
                          >
                            Open Services Hub
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <button
                            type="button"
                            onClick={() => navigateCloudView('my-online-store')}
                            className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 p-4 text-left hover:border-[#1ED760] transition cursor-pointer"
                          >
                            <div className="text-xs text-neutral-500">Online Stores</div>
                            <div className="mt-1 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">{userStores.length}</div>
                            <div className="mt-1 text-[11px] text-emerald-600 dark:text-[#1ED760] truncate">
                              {currentStore?.storeName || 'Manage storefronts'}
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateCloudView('my-droplets')}
                            className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 p-4 text-left hover:border-[#1ED760] transition cursor-pointer"
                          >
                            <div className="text-xs text-neutral-500">Compute Droplets</div>
                            <div className="mt-1 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">{droplets.length}</div>
                            <div className="mt-1 text-[11px] text-neutral-500">
                              {droplets.filter((d) => ['active', 'running'].includes(String(d.status || '').toLowerCase())).length} running right now
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateCloudView('workspace/performance')}
                            className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900/40 p-4 text-left hover:border-[#1ED760] transition cursor-pointer"
                          >
                            <div className="text-xs text-neutral-500">Compute Health &amp; Load</div>
                            <div className="mt-1 text-xl font-bold tabular-nums text-neutral-950 dark:text-white">{metrics?.cpuPercent ?? 0}% CPU</div>
                            <div className="mt-1 text-[11px] text-neutral-500">View live GraphQL performance</div>
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (widgetKey === 'metrics') return <CloudStatCards metrics={metrics} loading={loading} />;
                  if (widgetKey === 'performance') {
                    return (
                      <div className="grid items-start gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                          <CloudPerformanceCard metrics={metrics} loading={loading} />
                        </div>
                        <UsageOverviewCard metrics={metrics} />
                      </div>
                    );
                  }
                  if (widgetKey === 'droplets') {
                    return (
                      <DropletsTable
                        droplets={filteredDroplets}
                        onOpenCreateDroplet={() => {
                          setInitialDropletImage('Ubuntu 24.04 LTS');
                          setActiveNav('create-droplet');
                        }}
                      />
                    );
                  }
                  if (widgetKey === 'create-new') {
                    return (
                      <div className="grid items-start gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                          <CreateNewSection
                            onOpenCreateDroplet={() => {
                              setInitialDropletImage('Ubuntu 24.04 LTS');
                              setActiveNav('create-droplet');
                            }}
                          />
                        </div>
                        <ServiceStatusCard />
                      </div>
                    );
                  }
                  if (widgetKey === 'overview-services') {
                    return (
                      <div className="grid items-start gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-1">
                          <PopularImagesCard
                            images={popularImages}
                            onDeployImage={(img) => {
                              if (!img) {
                                setActiveNav('images');
                                return;
                              }
                              setInitialDropletImage(img);
                              setActiveNav('create-droplet');
                            }}
                          />
                        </div>
                        <div className="lg:col-span-1">
                          <QuickAccessCard
                            onSelectAction={(action) => {
                              if (action === 'Droplets') setActiveNav('create-droplet');
                              else if (action === 'Volumes') setActiveNav('volumes');
                              else if (action === 'Kubernetes') setActiveNav('kubernetes');
                              else if (action === 'Domains') setActiveNav('domains');
                            }}
                          />
                        </div>
                        <CloudRecentActivity activities={activities} />
                      </div>
                    );
                  }
                  return null;
                };

                const body = renderWidgetBody();
                if (!body) return null;

                return (
                  <div
                    key={widgetKey}
                    draggable={editWidgetLayout}
                    onDragStart={() => editWidgetLayout && setDraggedWidgetId(widgetKey)}
                    onDragOver={(e) => {
                      if (editWidgetLayout && draggedWidgetId && draggedWidgetId !== widgetKey) e.preventDefault();
                    }}
                    onDrop={() => {
                      if (!editWidgetLayout || !draggedWidgetId || draggedWidgetId === widgetKey) return;
                      const from = widgetOrder.indexOf(draggedWidgetId);
                      const to = widgetOrder.indexOf(widgetKey);
                      if (from !== -1 && to !== -1) {
                        const next = [...widgetOrder];
                        const [moved] = next.splice(from, 1);
                        next.splice(to, 0, moved);
                        persistWidgetOrder(next);
                      }
                      setDraggedWidgetId(null);
                    }}
                    className={`relative rounded-xl transition ${editWidgetLayout ? 'ring-1 ring-dashed ring-[#1ED760]/70 p-2 bg-white/50 dark:bg-neutral-950/50' : ''}`}
                  >
                    {editWidgetLayout && (
                      <div className="mb-2 flex items-center justify-between px-2 py-1 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-900 rounded-lg">
                        <span className="inline-flex items-center gap-1.5 cursor-grab">
                          <GripVertical className="h-3.5 w-3.5 text-neutral-400" />
                          <span className="capitalize">{widgetKey.replace(/-/g, ' ')}</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={wIdx === 0}
                            onClick={() => moveWidget(widgetKey, -1)}
                            className="rounded p-1 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
                            title="Move up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            disabled={wIdx === widgetOrder.length - 1}
                            onClick={() => moveWidget(widgetKey, 1)}
                            className="rounded p-1 hover:bg-white dark:hover:bg-neutral-800 disabled:opacity-30 cursor-pointer"
                            title="Move down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
