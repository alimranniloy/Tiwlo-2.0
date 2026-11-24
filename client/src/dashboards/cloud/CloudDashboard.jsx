import { applicationFetch } from '../../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CreditCard,
  DatabaseBackup,
  Download,
  GripVertical,
  KeyRound,
  Layers,
  Plus,
  Server,
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
import DropletDetailView from './views/DropletDetailView';
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

const VALID_DROPLET_SECTIONS = ['overview', 'console', 'network', 'dns', 'billing'];

const CLOUD_NAV_PATH_MAP = {
  dashboard: '/cloud',
  workspace: '/cloud',
  'workspace-hub': '/cloud/services',
  'my-online-store': '/cloud/online-store',
  'create-store': '/cloud/create-store',
  marketplace: '/cloud/marketplace',
  'create-droplet': '/cloud/create-droplet',
  'my-droplets': '/cloud/droplets',
  images: '/cloud/images',
  snapshots: '/cloud/snapshots',
  backups: '/cloud/backups',
  volumes: '/cloud/volumes',
  kubernetes: '/cloud/kubernetes',
  identity: '/cloud/identity',
  'whatsapp-automation': '/cloud/whatsapp',
  'help-support': '/cloud/help',
  domains: '/domains',
  billing: '/billing',
  'profile-settings': '/profile-settings',
  'active-sessions': '/active-sessions',
  'two-factor-auth': '/two-factor-auth',
  'team-management': '/team-management',
};

function parseCloudDropletRoute(rawNavOrPath) {
  const raw = String(rawNavOrPath || '').replace(/^\/+|\/+$/g, '');
  if (raw === 'my-droplets' || raw === 'cloud/droplets') {
    return { nav: 'my-droplets', dropletId: null, section: 'overview' };
  }
  if (raw.startsWith('cloud/droplets/')) {
    const parts = raw.slice('cloud/droplets/'.length).split('/').filter(Boolean);
    if (parts.length > 0) {
      const dropletId = decodeURIComponent(parts[0]);
      const candidateSection = parts[1] ? decodeURIComponent(parts[1]).toLowerCase() : 'overview';
      const section = VALID_DROPLET_SECTIONS.includes(candidateSection) ? candidateSection : 'overview';
      return { nav: 'droplet-detail', dropletId, section };
    }
    return { nav: 'my-droplets', dropletId: null, section: 'overview' };
  }
  return null;
}

function parseCloudNavFromPathname(pathname, fallbackNav = null) {
  const dropletRoute = parseCloudDropletRoute(pathname);
  if (dropletRoute) return dropletRoute;

  const clean = String(pathname || '').replace(/^\/+|\/+$/g, '');
  if (!clean || clean === 'cloud' || clean === 'workspace' || clean === 'dashboard') {
    return { nav: fallbackNav && fallbackNav !== 'dashboard' ? fallbackNav : 'dashboard', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/services' || clean === 'workspace/hub' || clean === 'workspace-hub') {
    return { nav: 'workspace-hub', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/online-store' || clean === 'my-online-store') {
    return { nav: 'my-online-store', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/create-store') {
    return { nav: 'create-store', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/marketplace' || clean === 'marketplace') {
    return { nav: 'marketplace', dropletId: null, section: 'overview' };
  }
  if (clean.startsWith('cloud/marketplace/')) {
    return { nav: clean.slice('cloud/'.length), dropletId: null, section: 'overview' };
  }
  if (clean.startsWith('marketplace/')) {
    return { nav: clean, dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/create-droplet' || clean === 'create-droplet') {
    return { nav: 'create-droplet', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/images' || clean === 'images') {
    return { nav: 'images', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/snapshots' || clean === 'snapshots') {
    return { nav: 'snapshots', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/backups' || clean === 'backups') {
    return { nav: 'backups', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/volumes' || clean === 'volumes') {
    return { nav: 'volumes', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/kubernetes' || clean === 'kubernetes') {
    return { nav: 'kubernetes', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/identity' || clean === 'identity') {
    return { nav: 'identity', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/whatsapp' || clean.startsWith('cloud/whatsapp/') || clean === 'whatsapp-automation' || clean.startsWith('whatsapp-automation/')) {
    return { nav: 'whatsapp-automation', dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/help' || clean === 'help-support' || clean === 'help' || clean === 'support') {
    return { nav: 'help-support', dropletId: null, section: 'overview' };
  }
  if (clean.startsWith('cloud/help/')) {
    return { nav: `help-support/${clean.slice('cloud/help/'.length)}`, dropletId: null, section: 'overview' };
  }
  if (clean.startsWith('help-support/')) {
    return { nav: clean, dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/domains' || clean === 'domains') {
    return { nav: 'domains', dropletId: null, section: 'overview' };
  }
  if (clean === 'billing' || clean.startsWith('billing/') || clean === 'cloud/billing' || clean.startsWith('cloud/billing/')) {
    return { nav: 'billing', dropletId: null, section: 'overview' };
  }
  if (clean.startsWith('cloud/workspace/')) {
    return { nav: clean.slice('cloud/'.length), dropletId: null, section: 'overview' };
  }
  if (clean.startsWith('workspace/')) {
    return { nav: clean, dropletId: null, section: 'overview' };
  }
  if (clean === 'cloud/profile-settings' || clean.startsWith('cloud/profile-settings/')) {
    return { nav: clean.slice('cloud/'.length), dropletId: null, section: 'overview' };
  }
  if (clean === 'profile-settings' || clean.startsWith('profile-settings/')) {
    return { nav: clean, dropletId: null, section: 'overview' };
  }
  if (clean === 'active-sessions' || clean === 'sessions' || clean === 'cloud/active-sessions') {
    return { nav: 'active-sessions', dropletId: null, section: 'overview' };
  }
  if (clean === 'two-factor-auth' || clean === 'cloud/two-factor-auth') {
    return { nav: 'two-factor-auth', dropletId: null, section: 'overview' };
  }
  if (clean === 'team-management' || clean === 'cloud/team-management') {
    return { nav: 'team-management', dropletId: null, section: 'overview' };
  }
  return null;
}

function getDropletAuthHeaders(extra = {}) {
  let token = '';
  try {
    token = localStorage.getItem('stockpro_session') || sessionStorage.getItem('stockpro_session') || '';
  } catch {}
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

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

  const resolveInitialRoute = () => {
    try {
      const locRoute = parseCloudNavFromPathname(window.location.pathname, initialNav);
      if (locRoute) return locRoute;
    } catch {}
    const propRoute = parseCloudDropletRoute(initialNav);
    if (propRoute) return propRoute;
    if (initialNav && initialNav !== 'dashboard') {
      return { nav: initialNav, dropletId: null, section: 'overview' };
    }
    return { nav: initialNav || 'dashboard', dropletId: null, section: 'overview' };
  };

  const initialRouteRef = resolveInitialRoute();
  const [activeNav, setActiveNav] = useState(initialRouteRef.nav);
  const [selectedDropletId, setSelectedDropletId] = useState(initialRouteRef.dropletId);
  const [dropletSection, setDropletSection] = useState(initialRouteRef.section);

  useEffect(() => {
    try {
      const locRoute = parseCloudNavFromPathname(window.location.pathname, initialNav);
      if (locRoute) {
        setActiveNav(locRoute.nav);
        setSelectedDropletId(locRoute.dropletId);
        setDropletSection(locRoute.section);
        return;
      }
    } catch {}
    const propRoute = parseCloudDropletRoute(initialNav);
    if (propRoute) {
      setActiveNav(propRoute.nav);
      setSelectedDropletId(propRoute.dropletId);
      setDropletSection(propRoute.section);
    } else if (initialNav) {
      setSelectedDropletId(null);
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
      navigateCloudView('create-store');
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

  const openDropletDetail = (dropletOrId, section = 'overview') => {
    const id = typeof dropletOrId === 'string' ? dropletOrId : dropletOrId?.id;
    if (!id) return;
    const safeSection = VALID_DROPLET_SECTIONS.includes(section) ? section : 'overview';
    setSelectedDropletId(id);
    setDropletSection(safeSection);
    setActiveNav('droplet-detail');
    try {
      const targetPath =
        safeSection === 'overview'
          ? `/cloud/droplets/${encodeURIComponent(id)}`
          : `/cloud/droplets/${encodeURIComponent(id)}/${safeSection}`;
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    } catch {}
  };

  const navigateCloudView = (target) => {
    const dropletRoute = parseCloudDropletRoute(target);
    if (dropletRoute) {
      setActiveNav(dropletRoute.nav);
      setSelectedDropletId(dropletRoute.dropletId);
      setDropletSection(dropletRoute.section);
      try {
        const cleanPath = dropletRoute.dropletId
          ? dropletRoute.section === 'overview'
            ? `/cloud/droplets/${encodeURIComponent(dropletRoute.dropletId)}`
            : `/cloud/droplets/${encodeURIComponent(dropletRoute.dropletId)}/${dropletRoute.section}`
          : '/cloud/droplets';
        if (window.location.pathname !== cleanPath) {
          window.history.pushState(null, '', cleanPath);
        }
      } catch {}
      return;
    }

    setSelectedDropletId(null);
    setActiveNav(target);
    try {
      let cleanPath = CLOUD_NAV_PATH_MAP[target];
      if (!cleanPath) {
        if (target === 'workspace/hub') {
          cleanPath = '/cloud/services';
        } else if (target.startsWith('marketplace/')) {
          cleanPath = `/cloud/${target}`;
        } else if (target.startsWith('help-support/')) {
          cleanPath = `/cloud/help/${target.slice('help-support/'.length)}`;
        } else if (target.startsWith('/')) {
          cleanPath = target;
        } else {
          cleanPath = `/${target}`;
        }
      }
      if (window.location.pathname !== cleanPath) {
        window.history.pushState(null, '', cleanPath);
      }
    } catch {}
  };

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    applicationFetch('/api/user/account/preferences', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const order =
          d?.account?.preferences?.widgetConfig?.widgetOrder ||
          d?.preferences?.widgetConfig?.widgetOrder ||
          d?.widgetConfig?.widgetOrder;
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

  // Load Cloud Data from real GraphQL + REST droplets fallback
  const loadCloudData = async () => {
    try {
      setLoading(true);
      setCloudError('');
      const [cloudData, restDroplets, storesData] = await Promise.all([
        getCloudDashboardData(userId).catch(() => null),
        fetch('/api/cloud/droplets', {
          credentials: 'include',
          headers: getDropletAuthHeaders(),
        })
          .then((r) => (r.ok ? r.json().catch(() => null) : null))
          .catch(() => null),
        getUserStores(userId)
      ]);

      const gqlDroplets = Array.isArray(cloudData?.droplets) ? cloudData.droplets.filter(Boolean) : [];
      const finalDroplets = (Array.isArray(restDroplets) ? restDroplets : gqlDroplets).filter(Boolean);
      setDroplets(finalDroplets);

      if (cloudData) {
        const computedVcpus = finalDroplets.reduce((sum, d) => sum + Number(d?.vcpus || 0), 0);
        const computedStorage = finalDroplets.reduce((sum, d) => sum + (parseFloat(d?.storage) || 0), 0);
        setMetrics({
          ...(cloudData.metrics || {}),
          totalDroplets: finalDroplets.length,
          totalVcpus: Math.max(Number(cloudData.metrics?.totalVcpus || 0), computedVcpus),
          totalStorage: cloudData.metrics?.totalStorage && finalDroplets.length === gqlDroplets.length
            ? cloudData.metrics.totalStorage
            : `${computedStorage} GB`,
        });
        setActivities(Array.isArray(cloudData.activities) ? cloudData.activities.filter(Boolean) : []);
        setPopularImages(Array.isArray(cloudData.popularImages) ? cloudData.popularImages.filter(Boolean) : []);
      } else if (finalDroplets.length > 0) {
        const computedVcpus = finalDroplets.reduce((sum, d) => sum + Number(d?.vcpus || 0), 0);
        const computedStorage = finalDroplets.reduce((sum, d) => sum + (parseFloat(d?.storage) || 0), 0);
        setMetrics({
          totalDroplets: finalDroplets.length,
          totalVcpus: computedVcpus,
          totalStorage: `${computedStorage} GB`,
          totalBandwidth: 'Unavailable',
        });
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

  const handleToggleDropletStatus = async (item, nextStatus) => {
    const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(item.id)}/status`, {
      method: 'PATCH',
      credentials: 'include',
      headers: getDropletAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status: nextStatus }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Could not update VPS power state.');
    const updated = json?.droplet || json;
    setDroplets((prev) => prev.map((d) => (d.id === item.id ? { ...d, ...updated, status: nextStatus } : d)));
    showToast?.(`VPS ${item.name} is now ${nextStatus}.`, 'success');
  };

  const handleRenameDroplet = async (item, newName) => {
    const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(item.id)}/name`, {
      method: 'PATCH',
      credentials: 'include',
      headers: getDropletAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: newName }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Could not rename VPS.');
    const updated = json?.droplet || json;
    setDroplets((prev) => prev.map((d) => (d.id === item.id ? { ...d, ...updated, name: newName } : d)));
    showToast?.(`Renamed VPS to ${newName}.`, 'success');
  };

  const handleDeleteDroplet = async (item) => {
    const res = await fetch(`/api/cloud/droplets/${encodeURIComponent(item.id)}`, {
      method: 'DELETE',
      credentials: 'include',
      headers: getDropletAuthHeaders(),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json?.error || 'Could not destroy VPS.');
    setDroplets((prev) => prev.filter((d) => d.id !== item.id));
    showToast?.(`VPS ${item.name} destroyed.`, 'success');
    loadCloudData();
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
    const syncCloudRoutesFromUrl = () => {
      try {
        const path = window.location.pathname || '';
        const tabParam = new URLSearchParams(window.location.search).get('tab');
        if (path.startsWith('/billing/credits') || path.startsWith('/cloud/billing/credits') || tabParam === 'credits') {
          setSelectedDropletId(null);
          setBillingInitialTab('credits');
          setActiveNav('billing');
          return;
        }
        if (path.startsWith('/billing/invoices/')) {
          setSelectedDropletId(null);
          setBillingInitialTab('invoices');
          setActiveNav('billing');
          return;
        }
        const parsed = parseCloudNavFromPathname(path);
        if (parsed) {
          setActiveNav(parsed.nav);
          setSelectedDropletId(parsed.dropletId);
          setDropletSection(parsed.section);
        }
      } catch {}
    };
    window.addEventListener('popstate', syncCloudRoutesFromUrl);
    return () => window.removeEventListener('popstate', syncCloudRoutesFromUrl);
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
        activeNav={activeNav === 'droplet-detail' ? 'my-droplets' : activeNav}
        setActiveNav={(nav) => navigateCloudView(nav)}
        currentUser={profileUser || currentUser}
        userStores={userStores}
        currentStore={currentStore}
        serviceSubscriptions={serviceSubscriptions}
        onNavigateTab={onNavigateTab}
        onOpenCreateStore={() => navigateCloudView('create-store')}
        onOpenCreateDroplet={() => {
          setInitialDropletImage('Ubuntu 24.04 LTS');
          navigateCloudView('create-droplet');
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
          onSwitchStore={() => navigateCloudView('my-online-store')}
          onOpenCreateDroplet={() => {
            setInitialDropletImage('Ubuntu 24.04 LTS');
            navigateCloudView('create-droplet');
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
                onClick={() => navigateCloudView('dashboard')}
                className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3.5 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
              >
                Back to Cloud Dashboard
              </button>
              <OneProfileSettingsView
                currentUser={profileUser}
                onUserUpdated={setProfileUser}
              />
            </div>
          ) : activeNav === 'droplet-detail' && selectedDropletId ? (
            <div className="max-w-[1500px] mx-auto">
              <DropletDetailView
                dropletId={selectedDropletId}
                initialDroplet={droplets.find((d) => String(d.id) === String(selectedDropletId)) || null}
                activeSection={dropletSection}
                onSectionChange={(nextSection) => openDropletDetail(selectedDropletId, nextSection)}
                onBack={() => navigateCloudView('my-droplets')}
                onDropletUpdated={(updated) => {
                  if (!updated?.id) return;
                  setDroplets((prev) =>
                    prev.map((d) => (String(d.id) === String(updated.id) ? { ...d, ...updated } : d))
                  );
                }}
                onDropletDeleted={(deletedId) => {
                  setDroplets((prev) => prev.filter((d) => String(d.id) !== String(deletedId)));
                  loadCloudData();
                  navigateCloudView('my-droplets');
                }}
                onOpenBilling={(tab = 'overview') => {
                  setBillingInitialTab(tab);
                  navigateCloudView('billing');
                }}
                showToast={showToast}
              />
            </div>
          ) : (activeNav === 'my-droplets' || activeNav === 'cloud/droplets') ? (
            <div className="mx-auto max-w-7xl space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => navigateCloudView('dashboard')}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Overview</span>
                  </button>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-neutral-950 dark:text-white flex items-center gap-2">
                      <Server className="h-5 w-5 text-[#1ED760]" />
                      <span>My Droplets</span>
                    </h1>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Click any VPS instance to inspect metrics, IPv6 networking, DNS bindings, firewall rules, and billing.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setInitialDropletImage('Ubuntu 24.04 LTS');
                    navigateCloudView('create-droplet');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1ED760] hover:bg-[#18c254] px-3.5 py-2 text-xs font-bold text-black shadow-xs transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Create Droplet</span>
                </button>
              </div>
              <DropletsTable
                droplets={filteredDroplets}
                showToast={showToast}
                onOpenDroplet={(item, section = 'overview') => openDropletDetail(item, section)}
                onToggleStatus={handleToggleDropletStatus}
                onRenameDroplet={handleRenameDroplet}
                onDeleteDroplet={handleDeleteDroplet}
                onOpenCreateDroplet={() => {
                  setInitialDropletImage('Ubuntu 24.04 LTS');
                  navigateCloudView('create-droplet');
                }}
                onViewAll={() => navigateCloudView('my-droplets')}
              />
            </div>
          ) : activeNav === 'domains' ? (
            <div className="max-w-[1500px] mx-auto"><DomainsView currentUser={currentUser} showToast={showToast} /></div>
          ) : activeNav === 'create-droplet' ? (
            <div className="max-w-[1500px] mx-auto">
              <CreateDropletView
                onBack={() => navigateCloudView('my-droplets')}
                onDropletCreated={(createdPayload) => {
                  const createdDroplet = createdPayload?.droplet || (createdPayload?.id ? createdPayload : null);
                  if (createdDroplet?.id) {
                    setDroplets((prev) => [
                      createdDroplet,
                      ...prev.filter((d) => String(d.id) !== String(createdDroplet.id)),
                    ]);
                  }
                  loadCloudData();
                  if (createdDroplet?.id) {
                    openDropletDetail(createdDroplet.id, 'overview');
                  } else {
                    navigateCloudView('my-droplets');
                  }
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
                onBack={() => navigateCloudView('my-online-store')}
                onCreateStore={handleCreateStore}
                onOpenBilling={(tab = 'credits') => {
                  setBillingInitialTab(tab);
                  navigateCloudView(tab === 'credits' ? '/billing/credits' : 'billing');
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
                  navigateCloudView('create-droplet');
                }}
                onBack={() => navigateCloudView('dashboard')}
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
                onOpenCreateStore={() => navigateCloudView('create-store')}
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
                onBackToDashboard={() => navigateCloudView('dashboard')}
              />
            </div>
          ) : (activeNav === 'billing' || activeNav.startsWith('billing')) ? (
            <div className="mx-auto max-w-7xl">
              <CloudBillingView
                currentUser={currentUser}
                initialTab={billingInitialTab}
                showToast={showToast}
                onBack={() => navigateCloudView('dashboard')}
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
                  onBack={() => navigateCloudView('workspace-hub')}
                  onNavigate={(target) => navigateCloudView(target === 'workspace' ? 'workspace-hub' : target)}
                />
              ) : activeNav.startsWith('workspace/service/') ? (
                <WorkspaceServiceDetailView
                  serviceId={activeNav.replace('workspace/service/', '')}
                  onBack={() => navigateCloudView('workspace-hub')}
                  onNavigate={(target) => {
                    if (target === 'discord') {
                      onNavigateTab?.(target);
                      return;
                    }
                    navigateCloudView(target === 'workspace' ? 'workspace-hub' : target);
                  }}
                />
              ) : (
                <WorkspaceView
                  onOpenStoreDashboard={launchStoreConsole}
                  showToast={showToast}
                  onNavigate={(target) => navigateCloudView(target === 'workspace' ? 'workspace-hub' : target)}
                />
              )}
            </div>
          ) : (activeNav === 'marketplace' || activeNav.startsWith('marketplace')) ? (
            <div className="max-w-[1500px] mx-auto">
              {activeNav.startsWith('marketplace/') ? (
                <MarketplaceProductDetailView
                  productId={activeNav.replace('marketplace/', '')}
                  onBack={() => navigateCloudView('marketplace')}
                  onNavigate={(target) => navigateCloudView(target)}
                />
              ) : (
                <MarketplaceView
                  onNavigate={(target) => navigateCloudView(target)}
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
                  navigateCloudView('create-droplet');
                }}
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
                        {droplets.length > 0 && (
                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800/80">
                            <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                              Active VPS:
                            </span>
                            {droplets.slice(0, 5).map((d) => (
                              <button
                                key={d.id}
                                type="button"
                                onClick={() => openDropletDetail(d, 'overview')}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200/80 bg-neutral-50 px-2.5 py-1 text-xs font-medium text-neutral-800 hover:border-[#1ED760] hover:bg-[#1ED760]/10 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-200 transition cursor-pointer"
                              >
                                <span
                                  className={`size-1.5 rounded-full ${
                                    ['active', 'running'].includes(String(d.status || '').toLowerCase())
                                      ? 'bg-[#1ED760]'
                                      : 'bg-amber-500'
                                  }`}
                                />
                                <span className="font-semibold">{d.name}</span>
                                <span className="font-mono text-[10px] text-neutral-500">{d.ip || d.regionCode || ''}</span>
                              </button>
                            ))}
                          </div>
                        )}
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
                        showToast={showToast}
                        onOpenDroplet={(item, section = 'overview') => openDropletDetail(item, section)}
                        onToggleStatus={handleToggleDropletStatus}
                        onRenameDroplet={handleRenameDroplet}
                        onDeleteDroplet={handleDeleteDroplet}
                        onViewAll={() => navigateCloudView('my-droplets')}
                        onOpenCreateDroplet={() => {
                          setInitialDropletImage('Ubuntu 24.04 LTS');
                          navigateCloudView('create-droplet');
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
                              navigateCloudView('create-droplet');
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
                                navigateCloudView('images');
                                return;
                              }
                              setInitialDropletImage(img);
                              navigateCloudView('create-droplet');
                            }}
                          />
                        </div>
                        <div className="lg:col-span-1">
                          <QuickAccessCard
                            onSelectAction={(action) => {
                              if (action === 'Droplets') navigateCloudView('create-droplet');
                              else if (action === 'Volumes') navigateCloudView('volumes');
                              else if (action === 'Kubernetes') navigateCloudView('kubernetes');
                              else if (action === 'Domains') navigateCloudView('domains');
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
