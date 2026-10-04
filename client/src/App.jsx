import React, { useState, useEffect, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import LandingPage from './landing/LandingPage';
import LoginView from './views/LoginView';
import CreateAccountView from './views/CreateAccountView';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import TiwloPageLoader, { TiwloTopSyncBar } from './components/TiwloUniqueLoader';
import { isAuthSubdomain, getAuthUrl, getMainAppUrl } from './utils/navigation';

// Dedicated Dashboards (Code-Split via React.lazy)
const CloudDashboard = lazy(() => import('./dashboards/cloud/CloudDashboard'));
const EcommerceDashboard = lazy(() => import('./dashboards/ecommerce/EcommerceDashboard'));

// Dedicated Page Views (Code-Split via React.lazy)
const ProductsView = lazy(() => import('./views/ProductsView'));
const CategoriesView = lazy(() => import('./views/CategoriesView'));
const InventoryView = lazy(() => import('./views/InventoryView'));
const PurchasesView = lazy(() => import('./views/PurchasesView'));
const SalesView = lazy(() => import('./views/SalesView'));
const CustomersView = lazy(() => import('./views/CustomersView'));
const SuppliersView = lazy(() => import('./views/SuppliersView'));
const ReportsView = lazy(() => import('./views/ReportsView'));
const AnalyticsView = lazy(() => import('./views/AnalyticsView'));
const SystemView = lazy(() => import('./views/SystemView'));
const AddProductView = lazy(() => import('./views/AddProductView'));
const POSView = lazy(() => import('./views/POSView'));
const StoreSettingsView = lazy(() => import('./views/StoreSettingsView'));
const SubscriptionOverviewView = lazy(() => import('./views/SubscriptionOverviewView'));
const PricingPlansView = lazy(() => import('./views/PricingPlansView'));
const HelpSupportView = lazy(() => import('./views/HelpSupportView'));
const MobileHelpSupportView = lazy(() => import('./views/MobileHelpSupportView'));
const AccountDisabledView = lazy(() => import('./views/AccountDisabledView'));
const SecurityCheckupView = lazy(() => import('./views/SecurityCheckupView'));
const NotFoundView = lazy(() => import('./views/NotFoundView'));
const TPanelDashboard = lazy(() => import('./services/tpanel/TPanelDashboard'));
const AdminDashboard = lazy(() => import('./administrator').then(m => ({ default: m.AdminDashboard })));

// TiwloMart / TiwiMart eCommerce Multi-Vendor Theme
const TiwiMart = lazy(() => import('./themes/TiwiMart/TiwiMart'));

// Live Support AI Widget
const LiveSupportWidget = lazy(() => import('./support/ai/LiveSupportWidget'));

// Code-Split Modals
const AddProductModal = lazy(() => import('./components/modals/AddProductModal'));
const EditProductModal = lazy(() => import('./components/modals/EditProductModal'));
const DeleteConfirmModal = lazy(() => import('./components/modals/DeleteConfirmModal'));
const NewSaleModal = lazy(() => import('./components/modals/NewSaleModal'));
const NewPurchaseModal = lazy(() => import('./components/modals/NewPurchaseModal'));
const ScanBarcodeModal = lazy(() => import('./components/modals/ScanBarcodeModal'));
const ImportCsvModal = lazy(() => import('./components/modals/ImportCsvModal'));
const GenerateReportModal = lazy(() => import('./components/modals/GenerateReportModal'));
const PrintBarcodeModal = lazy(() => import('./components/modals/PrintBarcodeModal'));

const API_BASE = '/api';

// Return paths must remain on the first-party app and must not route back to auth.
const getSafeRedirectPath = (value) => {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return null;
  }
  try {
    const target = new URL(value, 'https://tiwlo.com');
    if (target.origin !== 'https://tiwlo.com' || /^\/(login|signin|create-account|register|signup)(\/|$)/i.test(target.pathname)) {
      return null;
    }
    return `${target.pathname}${target.search}${target.hash}`;
  } catch (e) {
    return null;
  }
};

export default function App() {
  // Clean Standard URL Routing Support: /login, /create-store/*, /dashboard, /products, /store, etc. (NO HASH #)
  const getTabFromUrl = () => {
    try {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const searchParams = new URLSearchParams(window.location.search);
      const restoreToken = searchParams.get('token');

      // Remove legacy session-token handoffs from the URL without trusting them.
      if (searchParams.has('auth_token')) {
        searchParams.delete('auth_token');
        const cleanQuery = searchParams.toString();
        const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '');
        window.history.replaceState(null, '', cleanUrl);
      }

      // TPanel Subdomain or Direct Route Detection
      const isTpanelRoute = !isAuthSubdomain() && (hostname === 'tpanel.tiwlo.com' || hostname.startsWith('tpanel.') || pathname === 'tpanel' || pathname.startsWith('tpanel/') || searchParams.get('panel') === 'tpanel' || searchParams.get('tab') === 'tpanel' || searchParams.get('view') === 'tpanel');

      if (isTpanelRoute) {
        return 'tpanel';
      }

      // Check if user is navigating on Authentication Subdomain (auth.tiwlo.com or auth.localhost)
      if (isAuthSubdomain()) {
        const isExplicitLogout = searchParams.get('logout') === '1';
        if (isExplicitLogout) {
          try {
            localStorage.removeItem('stockpro_session');
            localStorage.removeItem('stockpro_user');
            sessionStorage.clear();
            sessionStorage.setItem('tiwlo_explicit_logout', '1');
          } catch (e) {}
          return 'login';
        }

        if (pathname === 'create-account' || pathname === 'register' || pathname === 'signup' || pathname === 'create-store' || pathname.startsWith('create-store/') ||
          searchParams.get('view') === 'register' || searchParams.get('view') === 'create-account' || searchParams.get('view') === 'signup' || searchParams.get('view') === 'create-store') {
          return 'create-account';
        }
        return 'login';
      }

      // Store Route Detection (tiwlo.com/store)
      const isStoreRoute = pathname === 'store' || pathname.startsWith('store/');
      if (isStoreRoute) {
        return 'store';
      }

      // Check if user is in post-restoration Security Checkup flow
      const checkupPending = sessionStorage.getItem('tiwlo_security_checkup_pending') || localStorage.getItem('tiwlo_security_checkup_pending');
      if (pathname === 'security-checkup' || (checkupPending && pathname !== 'login')) {
        if (restoreToken) {
          sessionStorage.setItem('tiwlo_pending_checkup_token', restoreToken);
        }
        return 'security-checkup';
      }

      // Handle account restore token from email links
      if (pathname === 'account-restore') {
        const token = restoreToken;
        if (token) {
          sessionStorage.setItem('tiwlo_pending_restore_token', token);
        }
        const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
        const bannedSaved = sessionStorage.getItem('tiwlo_banned_info') || localStorage.getItem('tiwlo_banned_info');
        if (bannedSaved) {
          window.history.replaceState(null, '', '/account-disabled');
          return 'account-disabled';
        }
        // If not logged in, must log in first to verify identity
        if (!hasSession) {
          window.location.replace(getAuthUrl(`/login?restore_token=${encodeURIComponent(token || '')}`));
          return 'login';
        }
      }

      // If user account is marked as disabled, persistently hold on account-disabled page until sign-out
      const bannedSaved = sessionStorage.getItem('tiwlo_banned_info') || localStorage.getItem('tiwlo_banned_info');
      if (bannedSaved) {
        window.history.replaceState(null, '', '/account-disabled');
        return 'account-disabled';
      }

      // If unauthenticated user attempts to visit /account-disabled directly without logging in:
      // Redirect to login
      if (pathname === 'account-disabled' || pathname === 'disabled') {
        if (!bannedSaved) {
          window.location.replace(getAuthUrl('/login'));
          return 'login';
        }
        return 'account-disabled';
      }

      // Main domain routes:
      if (pathname) {
        if (pathname === 'administrator' || pathname === 'admin' || pathname.startsWith('administrator/') || pathname.startsWith('admin/')) {
          const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
          if (!hasSession) return 'administrator';
          try {
            const u = JSON.parse(localStorage.getItem('stockpro_user'));
            const isSuper = u?.role === 'super_admin' || u?.email?.toLowerCase().trim() === 'tiwloltd@gmail.com';
            if (isSuper) {
              return 'administrator';
            }
          } catch (e) {}
          // Unauthorized user attempting to access /admin -> strictly redirect to /
          window.history.replaceState(null, '', '/');
          return 'dashboard';
        }
        if (pathname === 'landing' || pathname === 'home') return 'landing';

        if (pathname === 'login' || pathname === 'signin') {
          const isExplicitLogout = searchParams.get('logout') === '1';
          const redirectPath = getSafeRedirectPath(searchParams.get('redirect'));
          const query = isExplicitLogout
            ? '?logout=1'
            : (redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : '');
          window.location.replace(getAuthUrl(`/login${query}`));
          return 'login';
        }

        if (pathname === 'create-account' || pathname === 'register' || pathname === 'signup' || pathname === 'create-store' || pathname.startsWith('create-store/')) {
          const registrationPath = `${window.location.pathname}${window.location.search}`;
          window.location.replace(getAuthUrl(registrationPath));
          return 'create-account';
        }

        if (pathname === 'ecommerce' || pathname === 'store-dashboard' || pathname === 'ecommerce-dashboard') return 'ecommerce-dashboard';
        if (pathname === 'cloud' || pathname === 'dashboard') return 'dashboard';
        if (pathname === 'store') return 'store';
        if (pathname === 'pos') return 'pos';
        if (pathname === 'subscription' || pathname === 'storage') return 'subscription';
        if (pathname === 'pricing' || pathname === 'upgrade' || pathname === 'plans') return 'pricing';
        if (pathname === 'products') return 'products';
        if (pathname === 'categories') return 'categories';
        if (pathname === 'inventory') return 'inventory';
        if (pathname === 'purchases') return 'purchases';
        if (pathname === 'sales') return 'sales';
        if (pathname === 'customers') return 'customers';
        if (pathname === 'suppliers') return 'suppliers';
        if (pathname === 'reports') return 'reports';
        if (pathname === 'analytics') return 'analytics';
        if (pathname === 'settings') return 'settings';
        if (pathname === 'store-settings') return 'store-settings';
        if (pathname === 'help-support/mobile' || pathname === 'mobile-help-support' || pathname === 'support/mobile') return 'mobile-help-support';
        if (pathname === 'help' || pathname === 'support' || pathname === 'help-support' || pathname.startsWith('help-support/')) return pathname;
        if (pathname === 'tickets' || pathname === 'support-tickets') return 'help-support/tickets';
        if (pathname === 'create-ticket') return 'help-support/create-ticket';
        if (pathname === 'inbox' || pathname === 'support-inbox') return 'help-support/inbox';
        if (pathname === 'help-center') return 'help-support/help-center';
        if (pathname === 'guides') return 'help-support/guides';
        if (pathname === 'add-product') return 'add-product';
        if (pathname === 'whatsapp-automation' || pathname.startsWith('whatsapp-automation/')) return 'whatsapp-automation';

        // Unrecognized route -> 404
        return 'not-found';
      }

      if (searchParams.get('mode') === 'mobile_app' || searchParams.get('source') === 'tiwi_mobile_app' || searchParams.get('sso_token')) {
        return 'mobile-help-support';
      }
      if (searchParams.get('view') === 'landing') return 'landing';
      if (searchParams.get('view') === 'login') {
        window.location.replace(getAuthUrl('/login'));
        return 'login';
      }
      if (searchParams.get('view') === 'register' || searchParams.get('view') === 'create-account' || searchParams.get('view') === 'signup' || searchParams.get('view') === 'create-store') {
        window.location.replace(getAuthUrl('/create-account'));
        return 'create-account';
      }
      if (searchParams.get('view') === 'store' || searchParams.get('theme') === 'TiwiMart') {
        return 'store';
      }
      if (searchParams.get('tab')) {
        return searchParams.get('tab');
      }
    } catch (e) {}

    // Check if real active session exists in storage when visiting root '/'
    const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
    if (hasSession) {
      try {
        const u = JSON.parse(localStorage.getItem('stockpro_user'));
        if (u?.role === 'super_admin' || u?.email === 'tiwloltd@gmail.com') {
          window.history.replaceState(null, '', '/administrator');
          return 'administrator';
        }
      } catch (e) {}
      return 'dashboard';
    }
    return 'landing';
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  const [ssoInitData, setSsoInitData] = useState(null);
  const [bannedAccountInfo, setBannedAccountInfo] = useState(() => {
    try {
      const saved = sessionStorage.getItem('tiwlo_banned_info') || localStorage.getItem('tiwlo_banned_info');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const [dashboardLoading, setDashboardLoading] = useState(() => {
    try {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
      return pathname === 'dashboard' || (pathname === '' && hasSession);
    } catch (e) {
      return false;
    }
  });

  // Instant clean URL tab navigation without any '#' hash
  const handleTabChange = (tabId) => {
    if (tabId === 'login' || tabId === 'signin') {
      if (!isAuthSubdomain()) {
        const path = window.location.pathname;
        const publicPaths = new Set(['/', '/landing', '/home', '/login', '/signin']);
        const redirect = publicPaths.has(path) ? '' : `?redirect=${encodeURIComponent(path + window.location.search)}`;
        window.location.replace(getAuthUrl(`/login${redirect}`));
        return;
      }
      setActiveTab('login');
      window.history.pushState(null, '', '/login');
      return;
    }
    if (tabId === 'create-account' || tabId === 'register' || tabId === 'signup' || tabId === 'create-store' || (typeof tabId === 'string' && tabId.startsWith('create-store/'))) {
      if (!isAuthSubdomain()) {
        window.location.replace(getAuthUrl('/create-account'));
        return;
      }
      setActiveTab('create-account');
      window.history.pushState(null, '', '/create-account');
      return;
    }

    if (tabId === 'dashboard' && activeTab !== 'dashboard') {
      setDashboardLoading(true);
    }
    setActiveTab(tabId);
    try {
      const targetPath = tabId === 'landing' ? '/' : (tabId === 'dashboard' ? (currentUser ? '/' : '/dashboard') : (tabId === 'administrator' ? '/administrator' : (tabId === 'account-disabled' ? '/account-disabled' : (tabId === 'security-checkup' ? '/security-checkup' : (tabId === 'not-found' ? window.location.pathname : `/${tabId}`)))));
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
    } catch (e) {}
  };

  // Sync state on browser back/forward buttons
  useEffect(() => {
    const handleUrlChange = () => {
      const current = getTabFromUrl();
      setActiveTab(current);
    };
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [manualReload, setManualReload] = useState(false);

  // Manual Reload Handler with smooth minimum duration
  const handleReloadData = async () => {
    setManualReload(true);
    try {
      await loadData();
      showToast('Inventory & POS database reloaded securely!');
    } catch (e) {
      showToast('Error refreshing data', 'error');
    } finally {
      setTimeout(() => setManualReload(false), 600);
    }
  };

  // Filters & Search
  const [globalSearch, setGlobalSearch] = useState('');
  const [tableSearch, setTableSearch] = useState('');
  const [tableCategory, setTableCategory] = useState('All Categories');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [selectedBarcodeSku, setSelectedBarcodeSku] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isPrintBarcodeModalOpen, setIsPrintBarcodeModalOpen] = useState(false);
  const [selectedPrintBarcodeProduct, setSelectedPrintBarcodeProduct] = useState(null);

  // Toast Notification state
  const [toast, setToast] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Real Multi-Store Authentication & Session State
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('stockpro_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Cross-Subdomain Auth Auto-Discovery State (Validating shared .tiwlo.com cookie)
  const [authChecking, setAuthChecking] = useState(() => {
    return new URLSearchParams(window.location.search).get('logout') !== '1';
  });

  // Initial Cross-Subdomain Handshake & Cookie Session Auto-Discovery
  useEffect(() => {
    let isMounted = true;

    const isAuthHost = isAuthSubdomain();
    const searchParams = new URLSearchParams(window.location.search);

    if (isAuthHost && (searchParams.get('logout') === '1' || sessionStorage.getItem('tiwlo_explicit_logout') === '1')) {
      setAuthChecking(false);
      return () => {
        isMounted = false;
      };
    }

    const checkInitialSession = async () => {
      if (window.location.search.includes('logout=1')) {
        if (isMounted) setAuthChecking(false);
        return;
      }
      const initialPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (!isAuthHost && (initialPath === 'login' || initialPath === 'signin')) {
        if (isMounted) setAuthChecking(false);
        return;
      }

      const token = localStorage.getItem('stockpro_session');
      try {
        const res = await fetch(`${API_BASE}/auth/sync-session`, {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            if (isMounted) {
              if (data.sessionToken) {
                localStorage.setItem('stockpro_session', data.sessionToken);
              }
              localStorage.setItem('stockpro_user', JSON.stringify(data.user));
              setCurrentUser(data.user);
              setAuthChecking(false);

              if (isAuthHost) {
                const safeRedirect = getSafeRedirectPath(searchParams.get('redirect'));
                const isSuper = data.user.role === 'super_admin' || data.user.email?.toLowerCase().trim() === 'tiwloltd@gmail.com';
                const target = safeRedirect || (isSuper ? '/administrator' : '/dashboard');
                window.location.replace(getMainAppUrl(target));
                return;
              }

              const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
              const currentParams = new URLSearchParams(window.location.search);
              const isTpanelRoute = window.location.hostname.toLowerCase().startsWith('tpanel.') ||
                path === 'tpanel' || path.startsWith('tpanel/') ||
                currentParams.get('panel') === 'tpanel' ||
                currentParams.get('tab') === 'tpanel' ||
                currentParams.get('view') === 'tpanel';
              if (isTpanelRoute) {
                setActiveTab('tpanel');
                return;
              }
              const isSuper = data.user.role === 'super_admin' || data.user.email?.toLowerCase().trim() === 'tiwloltd@gmail.com';
              if (path === '' || path === 'login' || path === 'landing') {
                setActiveTab(isSuper ? 'administrator' : 'dashboard');
                window.history.replaceState(null, '', isSuper ? '/administrator' : '/');
              } else if (path === 'dashboard') {
                setActiveTab('dashboard');
              } else if (path === 'administrator' && !isSuper) {
                setActiveTab('dashboard');
                window.history.replaceState(null, '', '/');
              }
              return;
            }
          }
          if (data.isBanned && !isAuthHost && isMounted) {
            const banData = {
              email: data.email,
              name: data.name,
              avatar: data.avatar,
              storeName: data.storeName,
              tiwiId: data.tiwiId,
              banReason: data.banReason || 'Your account was disabled due to a violation of platform policies.'
            };
            localStorage.setItem('tiwlo_banned_info', JSON.stringify(banData));
            sessionStorage.setItem('tiwlo_banned_info', JSON.stringify(banData));
            localStorage.removeItem('stockpro_session');
            localStorage.removeItem('stockpro_user');
            setBannedAccountInfo(banData);
            setCurrentUser(null);
            setAuthChecking(false);
            setActiveTab('account-disabled');
            window.history.replaceState(null, '', '/account-disabled');
            return;
          }
        }
      } catch (err) {
        console.error('Session verification error:', err);
      }

      if (isMounted) {
        localStorage.removeItem('stockpro_session');
        localStorage.removeItem('stockpro_user');
        setCurrentUser(null);
        setAuthChecking(false);
        if (isAuthHost) return;

        const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
        const currentParams = new URLSearchParams(window.location.search);
        const isTpanelRoute = window.location.hostname.toLowerCase().startsWith('tpanel.') ||
          path === 'tpanel' || path.startsWith('tpanel/') ||
          currentParams.get('panel') === 'tpanel' ||
          currentParams.get('tab') === 'tpanel' ||
          currentParams.get('view') === 'tpanel';
        const isPublicPath = path === '' || path === 'landing' || path === 'home' ||
          path === 'store' || path.startsWith('store/') ||
          path === 'create-account' || path === 'register' || path === 'signup' ||
          path === 'create-store' || path.startsWith('create-store/');

        if (!isPublicPath || isTpanelRoute) {
          const requestedPath = isTpanelRoute && !path
            ? `/tpanel${window.location.search}`
            : window.location.pathname + window.location.search;
          window.location.replace(getAuthUrl(`/login?redirect=${encodeURIComponent(requestedPath)}`));
        }
      }
    };

    checkInitialSession();

    return () => {
      isMounted = false;
    };
  }, []);

  // Real-Time 2-Way Sync between Mobile App, Backend, and Web Dashboard
  useEffect(() => {
    const syncLiveUser = async () => {
      try {
        const token = localStorage.getItem('stockpro_session');
        const currentSaved = localStorage.getItem('stockpro_user');

        // If no active session token and no user, do not poll or auto-authenticate
        if (!token && !currentSaved) {
          return;
        }

        const res = await fetch(`${API_BASE}/auth/sync-session`, {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(prev => {
              if (
                !prev ||
                prev.storeName !== data.user.storeName ||
                prev.name !== data.user.name ||
                prev.avatar !== data.user.avatar ||
                prev.coverPhoto !== data.user.coverPhoto ||
                prev.credits !== data.user.credits
              ) {
                localStorage.setItem('stockpro_user', JSON.stringify(data.user));
                return data.user;
              }
              return prev;
            });
          } else {
            if (data?.isBanned) {
              const banData = {
                email: data.email,
                name: data.name,
                banReason: data.banReason || 'Your account was disabled due to a violation of platform policies.',
                bannedAt: data.bannedAt || new Date().toISOString()
              };
              localStorage.setItem('tiwlo_banned_info', JSON.stringify(banData));
              sessionStorage.setItem('tiwlo_banned_info', JSON.stringify(banData));
              localStorage.removeItem('stockpro_user');
              localStorage.removeItem('stockpro_session');
              setBannedAccountInfo(banData);
              setCurrentUser(null);
              window.history.replaceState(null, '', '/account-disabled');
              setActiveTab('account-disabled');
              return;
            }
            // Invalid or expired token: clear storage and logout
            localStorage.removeItem('stockpro_user');
            localStorage.removeItem('stockpro_session');
            setCurrentUser(null);
            const returnTo = window.location.pathname + window.location.search;
            window.location.replace(getAuthUrl(`/login?expired=1&redirect=${encodeURIComponent(returnTo)}`));
          }
        }
      } catch (err) {
        // Silently continue
      }
    };

    // Run only if token exists
    if (localStorage.getItem('stockpro_session')) {
      syncLiveUser();
    }

    // Re-sync instantly whenever the window or tab is focused
    window.addEventListener('focus', syncLiveUser);

    // Gentle background heartbeat (every 60s) only if active session exists
    const pollInterval = setInterval(() => {
      if (localStorage.getItem('stockpro_session')) {
        syncLiveUser();
      }
    }, 60000);

    return () => {
      window.removeEventListener('focus', syncLiveUser);
      clearInterval(pollInterval);
    };
  }, []);

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (isAuthSubdomain()) {
      sessionStorage.removeItem('tiwlo_explicit_logout');
      const searchParams = new URLSearchParams(window.location.search);
      const redirectUrl = searchParams.get('redirect');

      let targetPath = '/dashboard';
      if (redirectUrl) {
        targetPath = redirectUrl;
      } else if (user?.role === 'super_admin' || user?.email === 'tiwloltd@gmail.com') {
        targetPath = '/administrator';
      }

      const safeTargetPath = getSafeRedirectPath(targetPath) || '/dashboard';
      window.location.replace(getMainAppUrl(safeTargetPath));
      return;
    }
    if (user?.role === 'super_admin' || user?.email === 'tiwloltd@gmail.com') {
      handleTabChange('administrator');
    } else {
      setDashboardLoading(true);
      handleTabChange('dashboard');
    }
  };

  const handleRegisterSuccess = (user) => {
    setCurrentUser(user);
    if (isAuthSubdomain()) {
      sessionStorage.removeItem('tiwlo_explicit_logout');
      const isSuper = user?.role === 'super_admin' || user?.email === 'tiwloltd@gmail.com';
      const target = isSuper ? '/administrator' : '/dashboard';
      window.location.replace(getMainAppUrl(target));
      return;
    }
    setDashboardLoading(true);
    handleTabChange('dashboard');
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('stockpro_session');
      const response = await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error(`Logout failed with HTTP ${response.status}`);
      }
    } catch (err) {
      console.error('Logout request failed:', err);
    }
    localStorage.removeItem('stockpro_session');
    localStorage.removeItem('stockpro_user');
    sessionStorage.clear();
    setCurrentUser(null);
    showToast('Signed out successfully');
    setDashboardLoading(false);
    setAuthChecking(false);
    setActiveTab('login');
    window.location.replace(getAuthUrl('/login?logout=1'));
  };

  // Handler for 'Visit Site' button below System Settings in Sidebar
  const handleVisitSite = () => {
    // Open store in a new session/tab with clean URL: /store
    const storeUrl = `${window.location.origin}/store`;
    window.open(storeUrl, '_blank');
  };

  // Tabs that require store inventory and analytics data
  const DATA_TABS = new Set([
    'dashboard', 'ecommerce-dashboard', 'products', 'categories',
    'inventory', 'purchases', 'sales', 'customers', 'suppliers',
    'reports', 'analytics', 'pos', 'store'
  ]);

  // Fetch all initial data with smooth 1.5s natural transition (Zero freeze or lagging)
  const loadData = async (enforceMinDuration = false) => {
    const minTimer = enforceMinDuration ? new Promise((r) => setTimeout(r, 1500)) : Promise.resolve();
    try {
      setLoading(true);
      const [
        resProd,
        resStats,
        resAct,
        resCat,
        resSub,
        resCust,
        resSup
      ] = await Promise.allSettled([
        fetch(`${API_BASE}/products`).then(r => r.json()),
        fetch(`${API_BASE}/stats`).then(r => r.json()),
        fetch(`${API_BASE}/activities`).then(r => r.json()),
        fetch(`${API_BASE}/categories`).then(r => r.json()),
        fetch(`${API_BASE}/subcategories`).then(r => r.json()),
        fetch(`${API_BASE}/customers`).then(r => r.json()),
        fetch(`${API_BASE}/suppliers`).then(r => r.json()),
      ]);

      if (resProd.status === 'fulfilled' && Array.isArray(resProd.value)) {
        setProducts(resProd.value);
      }
      if (resStats.status === 'fulfilled') {
        setStats(resStats.value);
      }
      if (resAct.status === 'fulfilled' && Array.isArray(resAct.value)) {
        setActivities(resAct.value);
      }
      if (resCat.status === 'fulfilled' && Array.isArray(resCat.value)) {
        setCategories(resCat.value);
      }
      if (resSub.status === 'fulfilled' && Array.isArray(resSub.value)) {
        setSubcategories(resSub.value);
      }
      if (resCust.status === 'fulfilled' && Array.isArray(resCust.value)) {
        setCustomers(resCust.value);
      }
      if (resSup.status === 'fulfilled' && Array.isArray(resSup.value)) {
        setSuppliers(resSup.value);
      }
    } catch (err) {
      console.error('Error fetching system data:', err);
    } finally {
      await minTimer;
      setDashboardLoading(false);
      setLoading(false);
    }
  };

  // Only load data if active tab requires store data AND user has an authenticated session
  useEffect(() => {
    const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
    if (hasSession && DATA_TABS.has(activeTab)) {
      loadData(dashboardLoading);
    } else {
      setDashboardLoading(false);
    }
  }, [activeTab]);

  // CRUD: Add Product
  const handleAddProduct = async (newProductData) => {
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProductData),
      });
      if (res.ok) {
        const created = await res.json();
        setProducts((prev) => [created, ...prev]);
        showToast(`Product "${created.name}" added to inventory successfully!`);
        loadData();
        return created;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to add product', 'error');
        return null;
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
      return null;
    }
  };

  // CRUD: Update Product
  const handleUpdateProduct = async (id, updatedData) => {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData),
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts((prev) => prev.map((p) => (p.id === id ? updated : p)));
        showToast(`Product "${updated.name}" updated successfully!`);
        loadData();
      } else {
        showToast('Failed to update product', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  // CRUD: Delete Product
  const handleDeleteProduct = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        showToast(`Product deleted successfully!`, 'success');
        loadData();
      } else {
        showToast('Failed to delete product', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  // Quick stock adjustment
  const handleQuickStockChange = async (id, delta) => {
    const prod = products.find((p) => p.id === id);
    if (!prod) return;
    const newStock = Math.max(0, (prod.stock || 0) + delta);
    await handleUpdateProduct(id, { stock: newStock });
  };

  // ================= CATEGORIES CRUD =================
  const handleAddCategory = async (catData) => {
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catData),
      });
      if (res.ok) {
        showToast(`Category "${catData.name}" created!`);
        loadData();
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to create category', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  const handleUpdateCategory = async (id, catData) => {
    try {
      const res = await fetch(`${API_BASE}/categories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catData),
      });
      if (res.ok) {
        showToast(`Category updated successfully!`);
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  const handleDeleteCategory = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/categories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Category deleted');
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  // ================= SUBCATEGORIES CRUD =================
  const handleAddSubcategory = async (subData) => {
    try {
      const res = await fetch(`${API_BASE}/subcategories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subData),
      });
      if (res.ok) {
        showToast(`Subcategory "${subData.name}" created!`);
        loadData();
      } else {
        showToast('Failed to create subcategory', 'error');
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  const handleUpdateSubcategory = async (id, subData) => {
    try {
      const res = await fetch(`${API_BASE}/subcategories/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subData),
      });
      if (res.ok) {
        showToast('Subcategory updated');
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  const handleDeleteSubcategory = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/subcategories/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Subcategory deleted');
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  // ================= CUSTOMERS CRUD =================
  const handleAddCustomer = async (custData) => {
    try {
      const res = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custData),
      });
      if (res.ok) {
        const created = await res.json();
        showToast(`Customer "${custData.name}" registered!`);
        loadData();
        return created;
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  const handleUpdateCustomer = async (id, custData) => {
    try {
      const res = await fetch(`${API_BASE}/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(custData),
      });
      if (res.ok) {
        showToast('Customer updated');
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  const handleDeleteCustomer = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/customers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Customer removed');
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  // ================= SUPPLIERS CRUD =================
  const handleAddSupplier = async (supData) => {
    try {
      const res = await fetch(`${API_BASE}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supData),
      });
      if (res.ok) {
        showToast(`Supplier "${supData.companyName}" added!`);
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  const handleUpdateSupplier = async (id, supData) => {
    try {
      const res = await fetch(`${API_BASE}/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supData),
      });
      if (res.ok) {
        showToast('Supplier updated');
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  const handleDeleteSupplier = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/suppliers/${id}`, { method: 'DELETE' });
      if (res.ok) {
        showToast('Supplier removed');
        loadData();
      }
    } catch (err) {
      showToast('Error connecting to server', 'error');
    }
  };

  // Record Sale
  const handleRecordSale = async (saleData) => {
    try {
      const res = await fetch(`${API_BASE}/sales`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saleData),
      });
      if (res.ok) {
        const createdSale = await res.json();
        showToast(`Sale recorded successfully! Invoice: ${createdSale.invoiceNumber || ''} ($${createdSale.totalAmount})`);
        loadData();
        return createdSale;
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Failed to record sale', 'error');
        return null;
      }
    } catch (err) {
      showToast('Error recording sale', 'error');
      return null;
    }
  };

  // Record Purchase / Restock
  const handleRecordPurchase = async (purchaseData) => {
    try {
      const res = await fetch(`${API_BASE}/purchases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(purchaseData),
      });
      if (res.ok) {
        showToast(`Purchase order logged! +${purchaseData.quantity} units restocked.`);
        loadData();
      }
    } catch (err) {
      showToast('Error recording purchase order', 'error');
    }
  };

  // Delete activity item
  const handleDeleteActivity = async (id) => {
    try {
      await fetch(`${API_BASE}/activities/${id}`, { method: 'DELETE' });
      setActivities((prev) => prev.filter((a) => a.id !== id));
      showToast('Activity record removed');
    } catch (err) {
      console.error(err);
    }
  };

  // Batch CSV Import
  const handleImportBatch = async (batch) => {
    for (const item of batch) {
      await handleAddProduct(item);
    }
    showToast(`Successfully imported ${batch.length} products from CSV!`);
  };

  // Filtered products for Dashboard table
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      (tableSearch || globalSearch) === '' ||
      (p.name || '').toLowerCase().includes((tableSearch || globalSearch).toLowerCase()) ||
      (p.sku || '').toLowerCase().includes((tableSearch || globalSearch).toLowerCase()) ||
      (p.category || '').toLowerCase().includes((tableSearch || globalSearch).toLowerCase());

    const matchesCategory =
      tableCategory === 'All Categories' ||
      (p.category || '').toLowerCase() === tableCategory.toLowerCase();

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0B0F17] font-sans antialiased text-slate-800 dark:text-slate-100">
      {/* Top Laser Progress Beam for Unique Reload Indication */}
      {activeTab !== 'mobile-help-support' && activeTab !== 'help-support/mobile' && (
        <TiwloTopSyncBar active={loading || manualReload} />
      )}

      {/* Unique Glassmorphic Loader for entering Dashboard (3.5 to 5s smooth sync) */}
      {dashboardLoading && (activeTab === 'dashboard' || activeTab === 'ecommerce-dashboard') && (
        <TiwloPageLoader />
      )}

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 flex items-center space-x-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-200 animate-in slide-in-from-top-3 fade-in duration-200 text-xs font-semibold">
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* DEDICATED AUTHENTICATION, LANDING & ONBOARDING VIEWS */}
      <Suspense fallback={<TiwloTopSyncBar active={true} />}>
        {authChecking && (activeTab === 'administrator' || activeTab === 'admin' || activeTab === 'tpanel') ? (
          <TiwloPageLoader />
        ) : activeTab === 'not-found' ? (
          <NotFoundView
            onNavigate={(target) => {
              if (target === 'landing') {
                window.location.href = getMainAppUrl('/');
              } else if (target === 'dashboard') {
                window.location.href = getMainAppUrl('/dashboard');
              } else if (target === 'login') {
                window.location.href = getAuthUrl('/login');
              } else {
                handleTabChange(target);
              }
            }}
          />
        ) : activeTab === 'landing' ? (
        <LandingPage
          onNavigate={handleTabChange}
          currentUser={currentUser}
        />
      ) : activeTab === 'account-disabled' ? (
        <AccountDisabledView
          bannedInfo={bannedAccountInfo}
          onSignOut={async () => {
            sessionStorage.removeItem('tiwlo_banned_info');
            localStorage.removeItem('tiwlo_banned_info');
            setBannedAccountInfo(null);
            await handleLogout();
          }}
          onAccountRestored={(restoredUser) => {
            sessionStorage.removeItem('tiwlo_banned_info');
            localStorage.removeItem('tiwlo_banned_info');
            setBannedAccountInfo(null);
            const checkupData = {
              email: restoredUser?.user?.email || restoredUser?.email || bannedAccountInfo?.email,
              name: restoredUser?.user?.name || restoredUser?.name,
              storeName: restoredUser?.user?.storeName || restoredUser?.storeName || bannedAccountInfo?.storeName,
              tiwiId: restoredUser?.user?.tiwiId || restoredUser?.tiwiId || bannedAccountInfo?.tiwiId,
              avatar: restoredUser?.user?.avatar || restoredUser?.avatar || bannedAccountInfo?.avatar,
              twoFactorEnabled: restoredUser?.user?.twoFactorEnabled ?? restoredUser?.twoFactorEnabled,
              checkupToken: restoredUser?.checkupToken,
              restoredAt: new Date().toISOString()
            };
            sessionStorage.setItem('tiwlo_security_checkup_pending', JSON.stringify(checkupData));
            localStorage.setItem('tiwlo_security_checkup_pending', JSON.stringify(checkupData));
            if (restoredUser?.checkupToken) {
              sessionStorage.setItem('tiwlo_pending_checkup_token', restoredUser.checkupToken);
            }
            showToast?.('Account access restored! Please complete your security checkup.');
            window.history.pushState(null, '', '/security-checkup');
            handleTabChange('security-checkup');
          }}
          onContactSupport={() => handleTabChange('help-support')}
        />
      ) : activeTab === 'security-checkup' ? (
        <SecurityCheckupView
          user={currentUser || (() => {
            try {
              const pending = sessionStorage.getItem('tiwlo_security_checkup_pending') || localStorage.getItem('tiwlo_security_checkup_pending');
              return pending ? JSON.parse(pending) : null;
            } catch (e) {
              return null;
            }
          })()}
          onComplete={() => {
            sessionStorage.removeItem('tiwlo_security_checkup_pending');
            localStorage.removeItem('tiwlo_security_checkup_pending');
            sessionStorage.removeItem('tiwlo_pending_restore_token');
            sessionStorage.removeItem('tiwlo_pending_checkup_token');
            showToast?.('Security checkup completed! Welcome back.');
            const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
            if (hasSession) {
              window.history.pushState(null, '', '/');
              handleTabChange('dashboard');
            } else {
              window.history.pushState(null, '', '/login');
              handleTabChange('login');
            }
          }}
        />
      ) : (activeTab === 'administrator' || activeTab === 'admin' || activeTab.startsWith('administrator/') || activeTab.startsWith('admin/')) ? (
        <AdminDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          showToast={showToast}
        />
      ) : activeTab === 'tpanel' ? (
        <TPanelDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      ) : authChecking ? (
        <TiwloPageLoader />
      ) : (!currentUser && activeTab !== 'store' && activeTab !== 'create-account' && !activeTab.startsWith('create-store') && activeTab !== 'mobile-help-support' && activeTab !== 'help-support/mobile' && activeTab !== 'tpanel' && activeTab !== 'landing') ? (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onAccountDisabled={(info) => {
            setBannedAccountInfo(info);
            handleTabChange('account-disabled');
          }}
          onNavigateToRegister={(ssoData) => {
            setSsoInitData(ssoData || null);
            handleTabChange('create-account');
          }}
          showToast={showToast}
        />
      ) : activeTab === 'login' ? (
        <LoginView
          onLoginSuccess={handleLoginSuccess}
          onAccountDisabled={(info) => {
            setBannedAccountInfo(info);
            handleTabChange('account-disabled');
          }}
          onNavigateToRegister={(ssoData) => {
            setSsoInitData(ssoData || null);
            handleTabChange('create-account');
          }}
          showToast={showToast}
        />
      ) : (activeTab === 'create-account' || activeTab === 'create-store' || activeTab.startsWith('create-store/')) ? (
        <CreateAccountView
          initialSsoData={ssoInitData}
          onNavigateToLogin={() => {
            setSsoInitData(null);
            handleTabChange('login');
          }}
          onRegisterSuccess={handleRegisterSuccess}
          showToast={showToast}
        />
      ) : activeTab === 'store' ? (
        <TiwiMart
          products={products}
          categories={categories}
          suppliers={suppliers}
          onOpenAdmin={() => {
            setActiveTab('dashboard');
            try {
              window.history.pushState({}, '', window.location.pathname);
            } catch (e) {}
          }}
          showToast={showToast}
        />
      ) : activeTab === 'pos' ? (
        <POSView
          onBack={() => setActiveTab('dashboard')}
          products={products}
          categories={categories}
          customers={customers}
          suppliers={suppliers}
          onAddCustomer={handleAddCustomer}
          onRecordSale={handleRecordSale}
          onRefreshData={handleReloadData}
        />
      ) : (activeTab === 'mobile-help-support' || activeTab === 'help-support/mobile') ? (
        <MobileHelpSupportView
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          showToast={showToast}
          onBackToApp={() => handleTabChange('dashboard')}
        />
      ) : (activeTab === 'dashboard' || activeTab === 'whatsapp-automation' || activeTab.startsWith('whatsapp-automation')) ? (
        <CloudDashboard
          currentUser={currentUser}
          initialNav={activeTab.startsWith('whatsapp-automation') ? 'whatsapp-automation' : 'dashboard'}
          onLogout={handleLogout}
          onOpenStoreDashboard={() => handleTabChange('ecommerce-dashboard')}
          onNavigateTab={handleTabChange}
          showToast={showToast}
        />
      ) : (
        <div className="flex min-h-screen bg-[#F6F8FB] dark:bg-[#0B0F17] text-[#1E293B] dark:text-[#E2E8F0] transition-colors">
          {/* Left Sidebar */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={handleTabChange}
            onVisitSite={handleVisitSite}
            onBackToCloud={() => handleTabChange('dashboard')}
            mobileOpen={mobileMenuOpen}
            setMobileOpen={setMobileMenuOpen}
          />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top Header with Dynamic Store Profile & Sign Out */}
            <Header
              searchQuery={globalSearch}
              setSearchQuery={setGlobalSearch}
              onOpenSearchModal={() => setIsBarcodeModalOpen(true)}
              onUpgrade={() => handleTabChange('pricing')}
              showToast={showToast}
              currentUser={currentUser}
              onLogout={handleLogout}
              onToggleMobileMenu={() => setMobileMenuOpen(true)}
            />

            {/* Scrollable Body */}
            <main className="flex-1 px-3 sm:px-6 lg:px-8 py-4 sm:py-7 overflow-y-auto min-w-0">
              {/* TAB: ECOMMERCE DASHBOARD */}
              {activeTab === 'ecommerce-dashboard' && (
                <EcommerceDashboard
                  stats={stats}
                  filteredProducts={filteredProducts}
                  tableSearch={tableSearch}
                  setTableSearch={setTableSearch}
                  tableCategory={tableCategory}
                  setTableCategory={setTableCategory}
                  activities={activities}
                  onNavigateTab={handleTabChange}
                  onEditProduct={(p) => {
                    setSelectedProduct(p);
                    setIsEditModalOpen(true);
                  }}
                  onDeleteProduct={(p) => {
                    setSelectedProduct(p);
                    setIsDeleteModalOpen(true);
                  }}
                  onQuickStockChange={handleQuickStockChange}
                  onOpenPrintBarcode={(p) => {
                    setSelectedPrintBarcodeProduct(p);
                    setIsPrintBarcodeModalOpen(true);
                  }}
                  onAddProduct={() => handleTabChange('add-product')}
                  onNewPurchase={() => handleTabChange('purchases')}
                  onNewSale={() => handleTabChange('pos')}
                  onScanBarcode={() => handleTabChange('pos')}
                  onImportCsv={() => handleTabChange('inventory')}
                  onGenerateReport={() => handleTabChange('reports')}
                  onDeleteActivity={handleDeleteActivity}
                  showToast={showToast}
                  onBackToCloud={() => handleTabChange('dashboard')}
                  currentStore={currentUser}
                />
              )}

          {/* TAB: PRODUCTS */}
          {activeTab === 'products' && (
            <ProductsView
              products={products}
              categories={categories}
              subcategories={subcategories}
              onAddProduct={() => setActiveTab('add-product')}
              onEditProduct={(p) => {
                setSelectedProduct(p);
                setIsEditModalOpen(true);
              }}
              onDeleteProduct={(p) => {
                setSelectedProduct(p);
                setIsDeleteModalOpen(true);
              }}
              onQuickStockChange={handleQuickStockChange}
              onOpenBarcodeModal={(sku) => {
                setSelectedBarcodeSku(sku);
                setIsBarcodeModalOpen(true);
              }}
              onOpenPrintBarcode={(p) => {
                setSelectedPrintBarcodeProduct(p);
                setIsPrintBarcodeModalOpen(true);
              }}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: ADD PRODUCT (Dedicated Full-Page Multi-Step Part-by-Part Experience) */}
          {activeTab === 'add-product' && (
            <AddProductView
              onBack={() => setActiveTab('products')}
              onSaveProduct={handleAddProduct}
              onAddCategory={handleAddCategory}
              onAddSubcategory={handleAddSubcategory}
              categories={categories}
              subcategories={subcategories}
              onOpenPrintBarcode={(p) => {
                setSelectedPrintBarcodeProduct(p);
                setIsPrintBarcodeModalOpen(true);
              }}
            />
          )}

          {/* TAB: CATEGORIES & SUBCATEGORIES */}
          {activeTab === 'categories' && (
            <CategoriesView
              categories={categories}
              subcategories={subcategories}
              products={products}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onAddSubcategory={handleAddSubcategory}
              onUpdateSubcategory={handleUpdateSubcategory}
              onDeleteSubcategory={handleDeleteSubcategory}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: INVENTORY */}
          {activeTab === 'inventory' && (
            <InventoryView
              products={products}
              onQuickStockChange={handleQuickStockChange}
              showToast={showToast}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: PURCHASES */}
          {activeTab === 'purchases' && (
            <PurchasesView
              products={products}
              suppliers={suppliers}
              showToast={showToast}
              onRefreshData={loadData}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: SALES */}
          {activeTab === 'sales' && (
            <SalesView
              products={products}
              customers={customers}
              showToast={showToast}
              onRefreshData={loadData}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: CUSTOMERS */}
          {activeTab === 'customers' && (
            <CustomersView
              customers={customers}
              onAddCustomer={handleAddCustomer}
              onUpdateCustomer={handleUpdateCustomer}
              onDeleteCustomer={handleDeleteCustomer}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: SUPPLIERS */}
          {activeTab === 'suppliers' && (
            <SuppliersView
              suppliers={suppliers}
              categories={categories}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: REPORTS */}
          {activeTab === 'reports' && (
            <ReportsView
              products={products}
              categories={categories}
              stats={stats}
              showToast={showToast}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: ANALYTICS */}
          {activeTab === 'analytics' && (
            <AnalyticsView
              products={products}
              stats={stats}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: SYSTEM & SETTINGS */}
          {activeTab === 'settings' && (
            <SystemView
              showToast={showToast}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: STORE & THEME SETTINGS */}
          {activeTab === 'store-settings' && (
            <StoreSettingsView
              showToast={showToast}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: SUBSCRIPTION & STORAGE OVERVIEW (Cloud Storage Overview) */}
          {activeTab === 'subscription' && (
            <SubscriptionOverviewView
              onBackToDashboard={() => handleTabChange('dashboard')}
              onNavigateToPricing={() => handleTabChange('pricing')}
              showToast={showToast}
            />
          )}

          {/* TAB: SUBSCRIPTION PRICING PLANS */}
          {(activeTab === 'pricing' || activeTab === 'upgrade') && (
            <PricingPlansView
              onBackToOverview={() => handleTabChange('subscription')}
              showToast={showToast}
              onRefreshData={loadData}
            />
          )}

          {/* TAB: HELP & SUPPORT (Tiwlo Help & Support Center) */}
          {(activeTab === 'help-support' || activeTab.startsWith('help-support')) && (
            <HelpSupportView
              currentUser={currentUser}
              initialSubRoute={activeTab.startsWith('help-support/') ? activeTab.replace('help-support/', '') : 'home'}
              showToast={showToast}
              onBackToDashboard={() => handleTabChange('dashboard')}
            />
          )}
        </main>
      </div>
    </div>
  )}
      </Suspense>

      {/* Live Support Agent Chat Widget (Tiwi AI Core - 512 Online, 3-Tier Escalation) */}
      {activeTab !== 'mobile-help-support' && activeTab !== 'help-support/mobile' && (
        <Suspense fallback={null}>
          <LiveSupportWidget currentUser={currentUser} />
        </Suspense>
      )}

      {/* Global Modals (Rendered conditionally on demand) */}
      <Suspense fallback={null}>
        {isAddModalOpen && (
          <AddProductModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onAddProduct={handleAddProduct}
            onAddCategory={handleAddCategory}
            categories={categories}
            subcategories={subcategories}
          />
        )}

        {isEditModalOpen && (
          <EditProductModal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            onUpdateProduct={handleUpdateProduct}
            categories={categories}
            subcategories={subcategories}
          />
        )}

        {isDeleteModalOpen && (
          <DeleteConfirmModal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setSelectedProduct(null);
            }}
            product={selectedProduct}
            onConfirmDelete={handleDeleteProduct}
          />
        )}

        {isSaleModalOpen && (
          <NewSaleModal
            isOpen={isSaleModalOpen}
            onClose={() => setIsSaleModalOpen(false)}
            products={products}
            onRecordSale={handleRecordSale}
          />
        )}

        {isPurchaseModalOpen && (
          <NewPurchaseModal
            isOpen={isPurchaseModalOpen}
            onClose={() => setIsPurchaseModalOpen(false)}
            products={products}
            onRecordPurchase={handleRecordPurchase}
          />
        )}

        {isBarcodeModalOpen && (
          <ScanBarcodeModal
            isOpen={isBarcodeModalOpen}
            onClose={() => {
              setIsBarcodeModalOpen(false);
              setSelectedBarcodeSku(null);
            }}
            initialSku={selectedBarcodeSku}
            onSelectBarcodeProduct={(sku) => {
              setTableSearch(sku);
              setActiveTab('products');
              showToast(`Filtered inventory by barcode / SKU: ${sku}`);
            }}
          />
        )}

        {isImportModalOpen && (
          <ImportCsvModal
            isOpen={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            onImportBatch={handleImportBatch}
          />
        )}

        {isReportModalOpen && (
          <GenerateReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            stats={stats}
            products={products}
          />
        )}

        {/* Barcode Print Studio Modal */}
        {isPrintBarcodeModalOpen && (
          <PrintBarcodeModal
            isOpen={isPrintBarcodeModalOpen}
            onClose={() => {
              setIsPrintBarcodeModalOpen(false);
              setSelectedPrintBarcodeProduct(null);
            }}
            product={selectedPrintBarcodeProduct}
            storeName="TIWLO STORE"
          />
        )}
      </Suspense>
    </div>
  );
}
