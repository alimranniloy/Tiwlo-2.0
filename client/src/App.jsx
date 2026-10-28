import { applicationFetch as fetch } from './api/graphqlTransport.js';
import React, { useState, useEffect, Suspense, lazy } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ToastNotification from './components/ToastNotification';
import LandingPage from './landing/LandingPage';
import LoginView from './views/LoginView';
import CreateAccountView from './views/CreateAccountView';
import { RefreshCw } from 'lucide-react';
import TiwloPageLoader, { TiwloTopSyncBar } from './components/TiwloUniqueLoader';
import { isAuthSubdomain, isDashboardSubdomain, isMailSubdomain, isTPanelSubdomain, getAuthUrl, getMainAppUrl, getMailUrl, getDashboardUrl, getTPanelUrl } from './utils/navigation';
import {
  getPlatformUrl,
  PLATFORM_DOMAIN,
  FREE_SUBDOMAIN_DOMAIN,
  isStorefrontSubdomainHost
} from './config/platformConfig';
import { updateSeoMetadata } from './utils/seo';
import { isVerificationRouteAllowed } from './verification/access';

// Dedicated Dashboards (Code-Split via React.lazy)
const CloudDashboard = lazy(() => import('./dashboards/cloud/CloudDashboard'));
const EcommerceDashboard = lazy(() => import('./dashboards/ecommerce/EcommerceDashboard'));

// Dedicated Page Views (Code-Split via React.lazy)
const ProductsView = lazy(() => import('./views/ProductsView'));
const CategoriesView = lazy(() => import('./views/CategoriesView'));
const InventoryView = lazy(() => import('./views/InventoryView'));
const PurchasesView = lazy(() => import('./views/PurchasesView'));
const SalesView = lazy(() => import('./views/SalesView'));
const StoreReviewsView = lazy(() => import('./views/StoreReviewsView'));
const CustomersView = lazy(() => import('./views/CustomersView'));
const SuppliersView = lazy(() => import('./views/SuppliersView'));
const StaffManagementView = lazy(() => import('./views/StaffManagementView'));
const HRManagementView = lazy(() => import('./views/HRManagementView'));
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

// Tiwi Social Media Web Experience (/tiwi)
const TiwiSocialWeb = lazy(() => import('./social-web'));

// Tiwi Outlook Email Experience (/email, /mail)
const TiwiOutlookEmail = lazy(() => import('./email-web'));

// Tiwlo Discord Bot & Community Manager (/discord)
const DiscordBotManager = lazy(() => import('./discord-web'));

// uids.app Subdomain Landing Page (/subdomain, /uidis, /uids)
const SubdomainLanding = lazy(() => import('./subdomain'));

// Tiwlo Studio Music Level & Distribution Landing Page (/studio)
const TiwloStudioLanding = lazy(() => import('./studio/landing-page'));

// UIDis.app / OneProfile Identity & Website Dashboard (/oneprofile, /one-profile)
const OneProfileDashboard = lazy(() => import('./oneprofile'));

// Cross-device Identity Verification Flow (/verification)
const VerificationFlow = lazy(() => import('./verification'));
const IdentityRequiredView = lazy(() => import('./verification/IdentityRequiredView'));

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

const getSavedSelectedStore = () => {
  try {
    return JSON.parse(sessionStorage.getItem('tiwlo.selectedStore') || 'null');
  } catch (e) {
    return null;
  }
};

// Return paths must remain on the first-party app and must not route back to auth.
const getSafeRedirectTarget = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  try {
    const platformUrl = new URL(getPlatformUrl());
    const dashboardUrl = new URL(getDashboardUrl());
    const identityDashboardUrl = new URL(`https://${FREE_SUBDOMAIN_DOMAIN}`);
    const target = new URL(value, platformUrl);
    const isRelative = value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
    const isConfiguredDashboard = target.origin === dashboardUrl.origin || target.origin === identityDashboardUrl.origin;
    const isAllowedOrigin = target.origin === platformUrl.origin || isConfiguredDashboard;
    if (!isRelative && !isConfiguredDashboard) {
      return null;
    }
    if (!isAllowedOrigin || /^\/(login|signin|create-account|register|signup)(\/|$)/i.test(target.pathname)) {
      return null;
    }
    return isConfiguredDashboard
      ? target.toString()
      : `${target.pathname}${target.search}${target.hash}`;
  } catch (e) {
    return null;
  }
};

const getSafeReturnToTarget = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  try {
    const target = new URL(value);
    const platformUrl = new URL(getPlatformUrl());
    const dashboardUrl = new URL(getDashboardUrl());
    const identityDashboardUrl = new URL(`https://${FREE_SUBDOMAIN_DOMAIN}`);
    const mailUrl = new URL(getMailUrl());
    const tpanelUrl = new URL(getTPanelUrl());
    const isAllowedOrigin = [
      platformUrl.origin,
      dashboardUrl.origin,
      identityDashboardUrl.origin,
      mailUrl.origin,
      tpanelUrl.origin
    ].includes(target.origin);
    const isLocalTarget = target.protocol === 'http:' && target.hostname.endsWith('.localhost');
    if ((target.protocol !== 'https:' && !isLocalTarget) || !isAllowedOrigin ||
        /^\/(login|signin|create-account|register|signup)(\/|$)/i.test(target.pathname)) {
      return null;
    }
    return target.toString();
  } catch (e) {
    return null;
  }
};

const getSafeRedirectPath = (value) => {
  const target = getSafeRedirectTarget(value);
  if (!target || target.startsWith('http')) return null;
  return target;
};

export default function App() {
  // Clean Standard URL Routing Support: /login, /create-store/*, /dashboard, /products, /store, etc. (NO HASH #)
  const getTabFromUrl = () => {
    try {
      const hostname = window.location.hostname;
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const searchParams = new URLSearchParams(window.location.search);
      const restoreToken = searchParams.get('token');
      const isOneProfilePath = pathname === 'oneprofile' || pathname.startsWith('oneprofile/') ||
        pathname === 'one-profile' || pathname.startsWith('one-profile/');
      const isTpanelPath = pathname === 'tpanel' || pathname.startsWith('tpanel/');
      const isUidsLandingRoot = hostname.toLowerCase() === FREE_SUBDOMAIN_DOMAIN &&
        !pathname && !searchParams.has('web_sso_return_to');

      // Remove legacy session-token handoffs from the URL without trusting them.
      if (searchParams.has('auth_token')) {
        searchParams.delete('auth_token');
        const cleanQuery = searchParams.toString();
        const cleanUrl = window.location.pathname + (cleanQuery ? `?${cleanQuery}` : '');
        window.history.replaceState(null, '', cleanUrl);
      }

      if (isOneProfilePath && !isDashboardSubdomain()) {
        window.location.replace(`${getDashboardUrl(window.location.pathname)}${window.location.search}${window.location.hash}`);
        return 'oneprofile';
      }

      if (isUidsLandingRoot) return 'subdomain';

      if (isTpanelPath && !isTPanelSubdomain() &&
          (hostname === PLATFORM_DOMAIN || hostname === `www.${PLATFORM_DOMAIN}` ||
            hostname === 'localhost' || hostname === '127.0.0.1')) {
        window.location.replace(`${getTPanelUrl(window.location.pathname)}${window.location.search}${window.location.hash}`);
        return 'tpanel';
      }

      if (isDashboardSubdomain() && (!pathname || pathname === 'dashboard')) {
        window.history.replaceState(null, '', `/oneprofile${window.location.search}${window.location.hash}`);
        return 'oneprofile';
      }

      if (isTPanelSubdomain() &&
          ['login', 'signin', 'create-account', 'register', 'signup'].includes(pathname)) {
        const isRegistration = ['create-account', 'register', 'signup'].includes(pathname);
        const authPath = isRegistration ? '/create-account' : '/login';
        const authQuery = new URLSearchParams(window.location.search);
        authQuery.set('return_to', getTPanelUrl('/'));
        authQuery.set('sso_login', '1');
        window.location.replace(getAuthUrl(`${authPath}?${authQuery.toString()}`));
        return isRegistration ? 'create-account' : 'login';
      }

      if (isMailSubdomain() &&
          ['login', 'signin', 'create-account', 'register', 'signup'].includes(pathname)) {
        const isRegistration = ['create-account', 'register', 'signup'].includes(pathname);
        const authPath = isRegistration ? '/create-account' : '/login';
        const authQuery = new URLSearchParams(window.location.search);
        authQuery.delete('mail_return');
        authQuery.set('return_to', getMailUrl(
          window.location.pathname + window.location.search + window.location.hash
        ));
        window.location.replace(getAuthUrl(`${authPath}?${authQuery.toString()}`));
        return isRegistration ? 'create-account' : 'login';
      }

      // TPanel Subdomain or Direct Route Detection
      const isTpanelRoute = !isAuthSubdomain() && (isTPanelSubdomain() || pathname === 'tpanel' || pathname.startsWith('tpanel/') || searchParams.get('panel') === 'tpanel' || searchParams.get('tab') === 'tpanel' || searchParams.get('view') === 'tpanel');

      if (isTpanelRoute) {
        return 'tpanel';
      }

      if (pathname === 'verification' || pathname.startsWith('verification/')) {
        if (isVerificationRouteAllowed(
          pathname,
          window.location.hash,
          window.history.state
        )) {
          return 'verification';
        }
        window.history.replaceState(null, '', '/identity');
        return 'identity';
      }
      if (pathname === 'identity') {
        return 'identity';
      }
      if (pathname === 'identity-required') {
        return 'identity-required';
      }

      // Check if user is navigating on the configured authentication subdomain.
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

        if (isDashboardSubdomain()) {
          const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
          if (!hasSession) {
            const returnTo = getDashboardUrl('/oneprofile');
            window.location.replace(getAuthUrl(`/login?return_to=${encodeURIComponent(returnTo)}`));
            return 'login';
          }
        }

        if (pathname === 'create-account' || pathname === 'register' || pathname === 'signup' || pathname === 'create-store' || pathname.startsWith('create-store/') ||
          searchParams.get('view') === 'register' || searchParams.get('view') === 'create-account' || searchParams.get('view') === 'signup' || searchParams.get('view') === 'create-store') {
          return 'create-account';
        }
        return 'login';
      }

      const isLegacyMailPath = pathname === 'email' || pathname.startsWith('email/') ||
        pathname === 'mail' || pathname.startsWith('mail/');
      if (isLegacyMailPath) {
        const mailPath = pathname.replace(/^(email|mail)(?=\/|$)/, '');
        window.location.replace(`${getMailUrl(mailPath)}${window.location.search}${window.location.hash}`);
        return 'email';
      }
      if (isMailSubdomain()) return 'email';

      // Store Route Detection on the main platform.
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
          if (isAuthSubdomain()) return 'login';
          if (hostname.toLowerCase() === PLATFORM_DOMAIN || hostname.toLowerCase() === `www.${PLATFORM_DOMAIN}`) {
            return 'login';
          }
          const isExplicitLogout = searchParams.get('logout') === '1';
          const redirectPath = getSafeRedirectPath(searchParams.get('redirect'));
          const query = isExplicitLogout
            ? '?logout=1'
            : (isDashboardSubdomain()
              ? `?return_to=${encodeURIComponent(`${window.location.origin}/oneprofile`)}`
              : (redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : ''));
          window.location.replace(getAuthUrl(`/login${query}`));
          return 'login';
        }

        if (pathname === 'create-account' || pathname === 'register' || pathname === 'signup' || pathname === 'create-store' || pathname.startsWith('create-store/')) {
          if (isAuthSubdomain()) return 'create-account';
          if (hostname.toLowerCase() === PLATFORM_DOMAIN || hostname.toLowerCase() === `www.${PLATFORM_DOMAIN}`) {
            return 'create-account';
          }
          const registrationParams = new URLSearchParams(window.location.search);
          if (isDashboardSubdomain()) {
            registrationParams.set('return_to', `${window.location.origin}/oneprofile`);
            registrationParams.set('sso_login', '1');
          }
          const registrationQuery = registrationParams.toString();
          const registrationPath = `${window.location.pathname}${registrationQuery ? `?${registrationQuery}` : ''}`;
          window.location.replace(getAuthUrl(registrationPath));
          return 'create-account';
        }

        if (pathname === 'ecommerce' || pathname === 'store-dashboard' || pathname === 'ecommerce-dashboard') return 'ecommerce-dashboard';
        if (pathname === 'cloud' || pathname === 'dashboard') return 'dashboard';
        if (pathname === 'domains') return 'domains';
        if (pathname === 'store') return 'store';
        if (pathname === 'pos') return 'pos';
        if (pathname === 'subscription' || pathname === 'storage') return 'subscription';
        if (pathname === 'pricing' || pathname === 'upgrade' || pathname === 'plans') return 'pricing';
        if (pathname === 'products') return 'products';
        if (pathname === 'categories') return 'categories';
        if (pathname === 'inventory') return 'inventory';
        if (pathname === 'purchases') return 'purchases';
        if (pathname === 'sales') return 'sales';
        if (pathname === 'courier' || pathname === 'couriers') return 'courier';
        if (pathname === 'customers') return 'customers';
        if (pathname === 'suppliers') return 'suppliers';
        if (pathname === 'staff' || pathname === 'staff-management') return 'staff-management';
        if (pathname === 'hr' || pathname === 'hr-management') return 'hr-management';
        if (pathname === 'reports') return 'reports';
        if (pathname === 'analytics') return 'analytics';
        if (pathname === 'settings') return 'settings';
        if (pathname === 'store-settings') return 'store-settings';
        if (pathname === 'store-identity') return 'store-identity';
        if (pathname === 'store-banners') return 'store-banners';
        if (pathname === 'store-pages' || pathname === 'store-settings/pages') return 'store-pages';
        if (pathname === 'store-reviews' || pathname === 'reviews') return 'store-reviews';
        if (pathname === 'payments' || pathname === 'payment-shipping' || pathname === 'payments-shipping') return 'payments';
        if (pathname === 'shipping' || pathname === 'shipping-settings') return 'shipping';
        if (pathname === 'promotions' || pathname === 'promo-codes' || pathname === 'marketing/promotions') return 'promotions';
        if (pathname === 'help-support/mobile' || pathname === 'mobile-help-support' || pathname === 'support/mobile') return 'mobile-help-support';
        if (pathname === 'help' || pathname === 'support' || pathname === 'help-support' || pathname.startsWith('help-support/')) return pathname;
        if (pathname === 'tickets' || pathname === 'support-tickets') return 'help-support/tickets';
        if (pathname === 'create-ticket') return 'help-support/create-ticket';
        if (pathname === 'inbox' || pathname === 'support-inbox') return 'help-support/inbox';
        if (pathname === 'help-center') return 'help-support/help-center';
        if (pathname === 'guides') return 'help-support/guides';
        if (pathname === 'add-product') return 'add-product';
        if (pathname === 'workspace' || pathname.startsWith('workspace/')) return pathname;
        if (pathname === 'marketplace' || pathname.startsWith('marketplace/')) return pathname;
        if (pathname === 'whatsapp-automation' || pathname.startsWith('whatsapp-automation/')) return 'whatsapp-automation';
        if (pathname === 'tiwi' || pathname.startsWith('tiwi/') || pathname === 'social' || pathname.startsWith('social/')) return 'tiwi';
        if (pathname === 'email' || pathname.startsWith('email/') || pathname === 'mail' || pathname.startsWith('mail/')) return 'email';
        if (pathname === 'discord' || pathname.startsWith('discord/')) {
          const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
          if (!hasSession) {
            const redirectParam = encodeURIComponent('/' + pathname + (window.location.search || ''));
            window.location.replace(getAuthUrl(`/login?redirect=${redirectParam}`));
            return 'login';
          }
          return 'discord';
        }

        if (pathname === 'billing' || pathname.startsWith('billing/') || pathname === 'cloud/billing' || pathname.startsWith('cloud/billing/')) {
          return 'billing';
        }

        if (pathname === 'studio' || pathname.startsWith('studio/')) {
          return 'studio';
        }

        if (pathname === 'subdomain' || pathname.startsWith('subdomain/') || pathname === 'subdomains' || pathname === 'uidis' || pathname === 'uidis.app' || pathname.startsWith('uidis/') || pathname === 'uids' || pathname === 'uids.app' || pathname.startsWith('uids/')) {
          return 'subdomain';
        }

        if (pathname === 'oneprofile' || pathname.startsWith('oneprofile/') || pathname === 'one-profile' || pathname.startsWith('one-profile/') || pathname === 'uids/dashboard') {
          return 'oneprofile';
        }

        // Unrecognized route -> 404
        return 'not-found';
      }

      if (searchParams.get('mode') === 'mobile_app' || searchParams.get('source') === 'tiwi_mobile_app' || searchParams.get('sso_token')) {
        return 'mobile-help-support';
      }
      if (searchParams.get('tab') === 'billing' || searchParams.get('view') === 'billing') {
        return 'billing';
      }
      if (searchParams.get('tab') === 'tiwi' || searchParams.get('view') === 'tiwi' || searchParams.get('view') === 'social') {
        return 'tiwi';
      }
      if (searchParams.get('tab') === 'studio' || searchParams.get('view') === 'studio') {
        return 'studio';
      }
      if (searchParams.get('tab') === 'verification' || searchParams.get('view') === 'verification') {
        window.history.replaceState(null, '', '/identity');
        return 'identity';
      }
      if (searchParams.get('tab') === 'subdomain' || searchParams.get('view') === 'subdomain' || searchParams.get('view') === 'uidis') {
        return 'subdomain';
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

      if (!pathname && isStorefrontSubdomainHost(hostname)) {
        return 'store';
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
  useEffect(() => {
    updateSeoMetadata();
  }, [activeTab]);
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
    if (tabId === 'verification') {
      setActiveTab('verification');
      window.history.pushState(
        { identityVerificationStarted: true },
        '',
        '/verification'
      );
      return;
    }
    if (tabId === 'dashboard' && window.location.hostname.toLowerCase() === FREE_SUBDOMAIN_DOMAIN) {
      window.location.replace(`${window.location.origin}/oneprofile`);
      return;
    }
    if (
      (tabId === 'oneprofile' || tabId === 'one-profile' ||
        (typeof tabId === 'string' && (tabId.startsWith('oneprofile/') || tabId.startsWith('one-profile/')))) &&
      window.location.hostname.toLowerCase() === FREE_SUBDOMAIN_DOMAIN
    ) {
      window.location.replace(`${window.location.origin}/oneprofile`);
      return;
    }
    if (tabId === 'login' || tabId === 'signin') {
      if (!isAuthSubdomain()) {
        const path = window.location.pathname;
        const publicPaths = new Set(['/', '/landing', '/home', '/login', '/signin']);
        const isDashboardOrigin = isDashboardSubdomain();
        const isMailOrigin = isMailSubdomain();
        const returnTo = isDashboardOrigin
          ? `${window.location.origin}/oneprofile`
          : `${getMainAppUrl(path)}${window.location.search}`;
        const redirect = isDashboardOrigin
          ? `?return_to=${encodeURIComponent(`${window.location.origin}/oneprofile`)}`
          : (isMailOrigin
            ? `?return_to=${encodeURIComponent(getMailUrl(window.location.pathname + window.location.search + window.location.hash))}`
            : `?redirect=${encodeURIComponent(publicPaths.has(path) && window.location.hostname.toLowerCase() !== FREE_SUBDOMAIN_DOMAIN ? '' : returnTo)}`);
        window.location.replace(getAuthUrl(`/login${redirect}`));
        return;
      }
      setActiveTab('login');
      const authParams = new URLSearchParams(window.location.search);
      const loginQuery = ['redirect', 'return_to', 'sso_login', 'mail_return', 'restore_token', 'expired']
        .filter((key) => authParams.has(key))
        .map((key) => [key, authParams.get(key)]);
      const loginSearch = new URLSearchParams(loginQuery).toString();
      window.history.pushState(null, '', `/login${loginSearch ? `?${loginSearch}` : ''}`);
      return;
    }
    if (tabId === 'create-account' || tabId === 'register' || tabId === 'signup' || tabId === 'create-store' || (typeof tabId === 'string' && tabId.startsWith('create-store/'))) {
      if (!isAuthSubdomain()) {
        const isDashboardOrigin = isDashboardSubdomain();
        const isMailOrigin = isMailSubdomain();
        const returnTo = isDashboardOrigin ? `${window.location.origin}/oneprofile` : null;
        const query = isDashboardOrigin
          ? `?return_to=${encodeURIComponent(`${window.location.origin}/oneprofile`)}&sso_login=1`
          : (isMailOrigin
            ? `?return_to=${encodeURIComponent(getMailUrl(window.location.pathname + window.location.search + window.location.hash))}`
            : (returnTo ? `?redirect=${encodeURIComponent(returnTo)}` : ''));
        window.location.replace(getAuthUrl(`/create-account${query}`));
        return;
      }
      setActiveTab('create-account');
      const authParams = new URLSearchParams(window.location.search);
      const signupQuery = ['redirect', 'return_to', 'sso_login', 'mail_return']
        .filter((key) => authParams.has(key))
        .map((key) => [key, authParams.get(key)]);
      const signupSearch = new URLSearchParams(signupQuery).toString();
      window.history.pushState(null, '', `/create-account${signupSearch ? `?${signupSearch}` : ''}`);
      return;
    }

    if (tabId === 'tiwi' || (typeof tabId === 'string' && tabId.startsWith('tiwi'))) {
      setActiveTab('tiwi');
      if (!window.location.pathname.startsWith('/tiwi')) {
        window.history.pushState(null, '', '/tiwi');
      }
      return;
    }

    if (tabId === 'email' || (typeof tabId === 'string' && tabId.startsWith('email')) || tabId === 'mail') {
      if (!isMailSubdomain()) {
        window.location.assign(getMailUrl());
        return;
      }
      setActiveTab('email');
      return;
    }

    if (tabId === 'tpanel' || (typeof tabId === 'string' && tabId.startsWith('tpanel/'))) {
      if (!isTPanelSubdomain()) {
        const panelPath = typeof tabId === 'string' && tabId.startsWith('tpanel/')
          ? `/${tabId}`
          : '/';
        window.location.assign(getTPanelUrl(panelPath));
        return;
      }
      setActiveTab('tpanel');
      const panelPath = typeof tabId === 'string' && tabId.startsWith('tpanel/')
        ? `/${tabId}`
        : '/';
      if (window.location.pathname !== panelPath) {
        window.history.pushState(null, '', panelPath);
      }
      return;
    }

    if (tabId === 'discord' || (typeof tabId === 'string' && tabId.startsWith('discord'))) {
      const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
      if (!hasSession) {
        window.location.replace(getAuthUrl('/login?redirect=%2Fdiscord'));
        return;
      }
      setActiveTab('discord');
      if (!window.location.pathname.startsWith('/discord')) {
        window.history.pushState(null, '', '/discord');
      }
      return;
    }

    if (tabId === 'subdomain' || (typeof tabId === 'string' && (tabId.startsWith('subdomain') || tabId.startsWith('uidis')))) {
      setActiveTab('subdomain');
      if (!window.location.pathname.startsWith('/subdomain') && !window.location.pathname.startsWith('/uidis')) {
        window.history.pushState(null, '', '/subdomain');
      }
      return;
    }

    if (tabId === 'billing' || (typeof tabId === 'string' && (tabId.startsWith('billing') || tabId.startsWith('cloud/billing')))) {
      setActiveTab('billing');
      if (!window.location.pathname.startsWith('/billing')) {
        window.history.pushState(null, '', '/billing');
      }
      return;
    }

    if (tabId === 'studio' || (typeof tabId === 'string' && tabId.startsWith('studio'))) {
      setActiveTab('studio');
      if (!window.location.pathname.startsWith('/studio')) {
        window.history.pushState(null, '', '/studio');
      }
      return;
    }

    if (tabId === 'oneprofile' || (typeof tabId === 'string' && (tabId.startsWith('oneprofile') || tabId.startsWith('one-profile')))) {
      if (!isDashboardSubdomain()) {
        const dashboardPath = tabId === 'oneprofile' ? '/oneprofile' : `/${tabId.replace(/^\/+/, '')}`;
        window.location.replace(getDashboardUrl(dashboardPath));
        return;
      }
      setActiveTab('oneprofile');
      if (!window.location.pathname.startsWith('/oneprofile')) {
        window.history.pushState(null, '', '/oneprofile');
      }
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
  const [publicStoreSettings, setPublicStoreSettings] = useState(null);
  const [publicStorefrontLoading, setPublicStorefrontLoading] = useState(
    () => activeTab === 'store' && isStorefrontSubdomainHost()
  );
  const [publicStorefrontError, setPublicStorefrontError] = useState('');
  const [subcategories, setSubcategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dataLoadError, setDataLoadError] = useState('');
  const [manualReload, setManualReload] = useState(false);

  useEffect(() => {
    if (activeTab !== 'store' || !isStorefrontSubdomainHost()) return undefined;

    let cancelled = false;
    fetch(`${API_BASE}/public/storefront`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Storefront request failed with HTTP ${response.status}`);
        if (!Array.isArray(data.products) || !Array.isArray(data.categories) ||
            !data.settings || typeof data.settings !== 'object') {
          throw new Error('The storefront returned an invalid response.');
        }
        return data;
      })
      .then(data => {
        if (cancelled) return;
        setProducts(data.products);
        setCategories(data.categories);
        setPublicStoreSettings(data.settings);
      })
      .catch(error => {
        if (!cancelled) setPublicStorefrontError(error.message || 'Could not load this storefront.');
      })
      .finally(() => {
        if (!cancelled) setPublicStorefrontLoading(false);
      });

    return () => { cancelled = true; };
  }, [activeTab]);

  // Manual Reload Handler with smooth minimum duration
  const handleReloadData = async () => {
    setManualReload(true);
    try {
      const loaded = await loadData();
      showToast(
        loaded ? 'Inventory & POS data reloaded.' : 'Some data could not be refreshed.',
        loaded ? 'success' : 'error'
      );
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
  const [selectedStore, setSelectedStore] = useState(getSavedSelectedStore);
  const [storeSelectionReady, setStoreSelectionReady] = useState(() => !getSavedSelectedStore()?.tiwiId);

  // Cross-subdomain auth shares a cookie scoped to the configured platform domain.
  const [authChecking, setAuthChecking] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const isUidsLandingRoot = window.location.hostname.toLowerCase() === FREE_SUBDOMAIN_DOMAIN &&
      window.location.pathname.replace(/^\/+|\/+$/g, '') === '' &&
      !searchParams.has('web_sso_return_to');
    return searchParams.get('logout') !== '1' && !isUidsLandingRoot;
  });

  // Initial Cross-Subdomain Handshake & Cookie Session Auto-Discovery
  useEffect(() => {
    let isMounted = true;

    const isAuthHost = isAuthSubdomain();
    const searchParams = new URLSearchParams(window.location.search);
    const isUidsLandingRoot = window.location.hostname.toLowerCase() === FREE_SUBDOMAIN_DOMAIN &&
      window.location.pathname.replace(/^\/+|\/+$/g, '') === '' &&
      !searchParams.has('web_sso_return_to');

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
      const returnTo = searchParams.get('return_to');
      const ssoLoginMode = searchParams.get('sso_login') === '1';
      const webSsoReturnTo = searchParams.get('web_sso_return_to');
      const isPlatformHost = window.location.hostname.toLowerCase() ===
        new URL(getMainAppUrl()).hostname.toLowerCase();
      if ((isDashboardSubdomain() || isPlatformHost) && webSsoReturnTo) {
        const safeReturnTo = getSafeReturnToTarget(webSsoReturnTo);
        if (!safeReturnTo) {
          window.location.replace(getAuthUrl('/login'));
          return;
        }
        const dashboardSessionToken = localStorage.getItem('stockpro_session');
        const redirectToDashboardBridge = () => {
          const dashboardBridge = new URL(getDashboardUrl('/oneprofile'));
          dashboardBridge.searchParams.set('web_sso_return_to', safeReturnTo);
          dashboardBridge.searchParams.set('web_sso_fallback', 'uids');
          window.location.replace(dashboardBridge.toString());
        };
        try {
          const headers = { 'Content-Type': 'application/json' };
          if (dashboardSessionToken) headers.Authorization = `Bearer ${dashboardSessionToken}`;
          const response = await fetch(`${API_BASE}/auth/sso/web-start`, {
            method: 'POST',
            credentials: 'include',
            headers,
            body: JSON.stringify({ return_to: safeReturnTo })
          });
          const result = await response.json().catch(() => ({}));
          if (!response.ok || typeof result.handoffUrl !== 'string' || typeof result.handoffCode !== 'string' || typeof result.sessionToken !== 'string') {
            if (isPlatformHost && response.status === 401) {
              redirectToDashboardBridge();
              return;
            }
            throw new Error(result.error || 'Could not continue to Tiwlo Mail.');
          }
          submitWebSsoHandoff(result.handoffUrl, result.handoffCode, result.sessionToken);
          return;
        } catch (error) {
          console.error('Dashboard web SSO handoff failed:', error);
          window.location.replace(
            `${getAuthUrl('/login')}?return_to=${encodeURIComponent(safeReturnTo)}&sso_login=1`
          );
          return;
        }
      }
      if (isAuthHost && returnTo && !ssoLoginMode && searchParams.get('social_flow') !== '1') {
        const bridgeUrl = `${getMainAppUrl('/api/auth/sso/web-start')}?return_to=${encodeURIComponent(returnTo)}`;
        window.location.replace(bridgeUrl);
        return;
      }
      const token = localStorage.getItem('stockpro_session');
      try {
        const res = await fetch(`${API_BASE}/auth/sync-session`, {
          credentials: 'include',
          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!res.ok) {
          console.error(`Session verification unavailable (HTTP ${res.status}).`);
          if (isMounted) setAuthChecking(false);
          return;
        }

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

              if (data.user.identityVerificationRequired && !data.user.identityVerified) {
                if (isAuthHost) {
                  redirectAfterAuthentication(getMainAppUrl('/identity-required'));
                  return;
                }
                setActiveTab('identity-required');
                window.history.replaceState(null, '', '/identity-required');
                return;
              }

              if (isAuthHost) {
                if (searchParams.get('mail_return') === '1') {
                  redirectAfterAuthentication(getMailUrl());
                  return;
                }
                const safeRedirect = getSafeRedirectPath(searchParams.get('redirect'));
                const safeReturnTo = getSafeReturnToTarget(returnTo);
                const isSuper = data.user.role === 'super_admin' || data.user.email?.toLowerCase().trim() === 'tiwloltd@gmail.com';
                const target = safeRedirect && !searchParams.has('dashboard')
                  ? safeRedirect
                  : (isSuper ? '/administrator' : null);
                redirectAfterAuthentication(
                  safeReturnTo || (target ? getMainAppUrl(target) : getMainAppUrl('/dashboard'))
                );
                return;
              }

              if (isDashboardSubdomain() && !isUidsLandingRoot) {
                const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
                if (!path || path === 'dashboard' || path === 'login') {
                  setActiveTab('oneprofile');
                  window.history.replaceState(null, '', '/oneprofile');
                  return;
                }
              }

              const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
              const currentParams = new URLSearchParams(window.location.search);
              const isTpanelRoute = isTPanelSubdomain() ||
                path === 'tpanel' || path.startsWith('tpanel/') ||
                currentParams.get('panel') === 'tpanel' ||
                currentParams.get('tab') === 'tpanel' ||
                currentParams.get('view') === 'tpanel';
              if (isTpanelRoute) {
                setActiveTab('tpanel');
                return;
              }
              if (isMailSubdomain()) {
                setActiveTab('email');
                return;
              }
              const isSuper = data.user.role === 'super_admin' || data.user.email?.toLowerCase().trim() === 'tiwloltd@gmail.com';
              if (!isUidsLandingRoot && (path === '' || path === 'login' || path === 'landing')) {
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
        if (isMounted) setAuthChecking(false);
        return;
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
        const isPublicPath = (!isMailSubdomain() && path === '') || path === 'landing' || path === 'home' ||
          path === 'verification' || path.startsWith('verification/') ||
          path === 'store' || path.startsWith('store/') ||
          path === 'create-account' || path === 'register' || path === 'signup' ||
          path === 'create-store' || path.startsWith('create-store/') ||
          path === 'subdomain' || path.startsWith('subdomain/') || path === 'subdomains' ||
          path === 'uidis' || path === 'uidis.app' || path.startsWith('uidis/') ||
          path === 'uids' || path === 'uids.app' || path.startsWith('uids/') ||
          path === 'one-profile' || path.startsWith('one-profile/');

        if (!isPublicPath || isTpanelRoute || (isDashboardSubdomain() && !isUidsLandingRoot)) {
          if (isMailSubdomain()) {
            const returnTo = getMailUrl(window.location.pathname + window.location.search + window.location.hash);
            const bridgeUrl = `${getMainAppUrl('/api/auth/sso/web-start')}?return_to=${encodeURIComponent(returnTo)}`;
            window.location.replace(bridgeUrl);
          } else if (isTPanelSubdomain()) {
            const returnTo = getTPanelUrl(path === 'tpanel' || path.startsWith('tpanel/') ? `/${path}` : '/');
            window.location.replace(getAuthUrl(`/login?return_to=${encodeURIComponent(returnTo)}&sso_login=1`));
          } else {
            const requestedPath = isTpanelRoute && !path
              ? `/tpanel${window.location.search}`
              : window.location.pathname + window.location.search;
            const redirectQuery = isDashboardSubdomain()
              ? `return_to=${encodeURIComponent(window.location.origin + requestedPath)}`
              : `redirect=${encodeURIComponent(requestedPath)}`;
            window.location.replace(getAuthUrl(`/login${redirectQuery ? `?${redirectQuery}` : ''}`));
          }
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
            const isUidsLandingRoot = window.location.hostname.toLowerCase() === FREE_SUBDOMAIN_DOMAIN &&
              window.location.pathname.replace(/^\/+|\/+$/g, '') === '' &&
              !new URLSearchParams(window.location.search).has('web_sso_return_to');
            if (!isUidsLandingRoot) {
              const returnTo = window.location.pathname + window.location.search;
              window.location.replace(getAuthUrl(`/login?expired=1&redirect=${encodeURIComponent(returnTo)}`));
            }
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

  async function startWebSsoHandoff(returnTo) {
    try {
      const token = localStorage.getItem('stockpro_session');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`${API_BASE}/auth/sso/web-start`, {
        method: 'POST',
        credentials: 'include',
        headers,
        body: JSON.stringify({ return_to: returnTo })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.handoffUrl !== 'string' || typeof result.handoffCode !== 'string' || typeof result.sessionToken !== 'string') {
        throw new Error(result.error || 'Could not complete dashboard sign-in.');
      }
      submitWebSsoHandoff(result.handoffUrl, result.handoffCode, result.sessionToken);
    } catch (error) {
      console.error('Web SSO handoff failed:', error);
      // The MFA endpoint has already created the session. Keep the user out of
      // the completed OTP form and let the primary app restore that session
      // from the shared first-party cookie.
      window.location.replace(getMainAppUrl('/dashboard'));
    }
  }

  function submitWebSsoHandoff(action, code, sessionToken) {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = action;
    form.hidden = true;
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'handoffCode';
    input.value = code;
    form.appendChild(input);
    const sessionInput = document.createElement('input');
    sessionInput.type = 'hidden';
    sessionInput.name = 'sessionToken';
    sessionInput.value = sessionToken;
    form.appendChild(sessionInput);
    document.body.appendChild(form);
    form.submit();
  }

  function redirectAfterAuthentication(target) {
    let destination;
    try {
      destination = new URL(target);
    } catch {
      window.location.replace(target);
      return;
    }

    if (destination.origin === new URL(getMainAppUrl()).origin) {
      window.location.replace(destination.toString());
      return;
    }

    const webSsoOrigins = [
      getMainAppUrl(),
      getDashboardUrl(),
      `https://${FREE_SUBDOMAIN_DOMAIN}`,
      getMailUrl()
    ].map(url => new URL(url).origin);
    if (destination.protocol === 'https:' && webSsoOrigins.includes(destination.origin)) {
      void startWebSsoHandoff(destination.toString());
      return;
    }
    window.location.replace(destination.toString());
  }

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user?.identityVerificationRequired && !user?.identityVerified) {
      if (isAuthSubdomain()) {
        redirectAfterAuthentication(getMainAppUrl('/identity-required'));
      } else {
        setDashboardLoading(false);
        handleTabChange('identity-required');
      }
      return;
    }
    if (isAuthSubdomain()) {
      sessionStorage.removeItem('tiwlo_explicit_logout');
      const searchParams = new URLSearchParams(window.location.search);
      const safeReturnTo = getSafeReturnToTarget(searchParams.get('return_to'));
      const redirectUrl = searchParams.has('dashboard') ? null : searchParams.get('redirect');
      const socialFlow = searchParams.get('social_flow') === '1';

      if (searchParams.get('mail_return') === '1') {
        window.location.replace(getMailUrl());
        return;
      }

      if (safeReturnTo) {
        redirectAfterAuthentication(safeReturnTo);
        return;
      }

      let targetPath = socialFlow ? getDashboardUrl('/oneprofile') : '/dashboard';
      if (redirectUrl) {
        targetPath = redirectUrl;
      } else if (user?.role === 'super_admin' || user?.email === 'tiwloltd@gmail.com') {
        targetPath = '/administrator';
      }

      const safeTarget = getSafeRedirectTarget(targetPath);
      const destination = safeTarget
        ? (safeTarget.startsWith('http') ? safeTarget : getMainAppUrl(safeTarget))
        : (socialFlow ? getDashboardUrl('/oneprofile') : getMainAppUrl('/dashboard'));
      redirectAfterAuthentication(destination);
      return;
    }
    if (user?.role === 'super_admin' || user?.email === 'tiwloltd@gmail.com') {
      handleTabChange('administrator');
    } else {
      handleTabChange('dashboard');
      setDashboardLoading(false);
    }
  };

  const handleRegisterSuccess = (user) => {
    setCurrentUser(user);
    if (isAuthSubdomain()) {
      sessionStorage.removeItem('tiwlo_explicit_logout');
      if (new URLSearchParams(window.location.search).get('mail_return') === '1') {
        window.location.replace(getMailUrl());
        return;
      }
      const isSuper = user?.role === 'super_admin' || user?.email === 'tiwloltd@gmail.com';
      const registerParams = new URLSearchParams(window.location.search);
      const safeReturnTo = getSafeReturnToTarget(registerParams.get('return_to'));
      const requestedRedirect = registerParams.has('dashboard')
        ? null
        : getSafeRedirectTarget(registerParams.get('redirect'));
      const target = safeReturnTo || requestedRedirect || (isSuper ? '/administrator' : '/dashboard');
      const destination = target.startsWith('http') ? target : getMainAppUrl(target);
      redirectAfterAuthentication(destination);
      return;
    }
    setDashboardLoading(true);
    handleTabChange('dashboard');
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/stores/active`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiwiId: '' })
      });
    } catch (err) {
      console.error('Could not clear active store before logout:', err);
    }
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
    setSelectedStore(null);
    setStoreSelectionReady(true);
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
    const fetchJson = async (path) => {
      const response = await fetch(`${API_BASE}${path}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || `Request failed with HTTP ${response.status}`);
      return data;
    };
    try {
      setLoading(true);
      setDataLoadError('');
      const [
        resProd,
        resStats,
        resAct,
        resCat,
        resSub,
        resCust,
        resSup
      ] = await Promise.allSettled([
        fetchJson('/products'),
        fetchJson('/stats'),
        fetchJson('/activities'),
        fetchJson('/categories'),
        fetchJson('/subcategories'),
        fetchJson('/customers'),
        fetchJson('/suppliers'),
      ]);

      const failures = [];
      const acceptArray = (result, label, setter) => {
        if (result.status === 'fulfilled' && Array.isArray(result.value)) {
          setter(result.value);
        } else {
          failures.push(`${label}: ${result.status === 'rejected' ? result.reason.message : 'Invalid response'}`);
        }
      };

      acceptArray(resProd, 'Products', setProducts);
      if (resStats.status === 'fulfilled' && resStats.value && typeof resStats.value === 'object' && !Array.isArray(resStats.value)) {
        setStats(resStats.value);
      } else {
        failures.push(`Dashboard statistics: ${resStats.status === 'rejected' ? resStats.reason.message : 'Invalid response'}`);
      }
      acceptArray(resAct, 'Activity', setActivities);
      acceptArray(resCat, 'Categories', setCategories);
      acceptArray(resSub, 'Subcategories', setSubcategories);
      acceptArray(resCust, 'Customers', setCustomers);
      acceptArray(resSup, 'Suppliers', setSuppliers);

      if (failures.length > 0) {
        setDataLoadError(failures.join('; '));
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error fetching system data:', err);
      setDataLoadError(err.message || 'Could not load dashboard data.');
      return false;
    } finally {
      await minTimer;
      setDashboardLoading(false);
      setLoading(false);
    }
  };

  const handleStoreConsoleLaunch = async (store) => {
    if (!store?.tiwiId) {
      showToast('Select a store before opening its console.', 'error');
      return;
    }

    setStoreSelectionReady(false);
    try {
      const response = await fetch(`${API_BASE}/stores/active`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiwiId: store.tiwiId })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !result.store) {
        throw new Error(result.error || 'Could not switch to the selected store.');
      }
      setSelectedStore(result.store);
      sessionStorage.setItem('tiwlo.selectedStore', JSON.stringify(result.store));
      setDashboardLoading(true);
      handleTabChange('ecommerce-dashboard');
    } catch (error) {
      if (selectedStore?.tiwiId) {
        sessionStorage.setItem('tiwlo.selectedStore', JSON.stringify(selectedStore));
      } else {
        sessionStorage.removeItem('tiwlo.selectedStore');
      }
      showToast(error.message || 'Could not switch to the selected store.', 'error');
    } finally {
      setStoreSelectionReady(true);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const savedStore = getSavedSelectedStore();
    if (!currentUser || !savedStore?.tiwiId) {
      setSelectedStore(savedStore);
      setStoreSelectionReady(true);
      return () => { cancelled = true; };
    }

    setStoreSelectionReady(false);
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/stores/active`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tiwiId: savedStore.tiwiId })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || !result.store) {
          throw new Error(result.error || 'Saved store is unavailable.');
        }
        if (!cancelled) {
          setSelectedStore(result.store);
          sessionStorage.setItem('tiwlo.selectedStore', JSON.stringify(result.store));
        }
      } catch {
        if (!cancelled) {
          sessionStorage.removeItem('tiwlo.selectedStore');
          setSelectedStore(null);
        }
      } finally {
        if (!cancelled) setStoreSelectionReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [currentUser?.id]);

  // Only load data if active tab requires store data AND user has an authenticated session
  useEffect(() => {
    const hasSession = !!localStorage.getItem('stockpro_session') && !!localStorage.getItem('stockpro_user');
    if (isStorefrontSubdomainHost() && activeTab === 'store') {
      setDashboardLoading(false);
    } else if (hasSession && storeSelectionReady && DATA_TABS.has(activeTab)) {
      loadData(dashboardLoading);
    } else if (!hasSession || !DATA_TABS.has(activeTab)) {
      setDashboardLoading(false);
    }
  }, [activeTab, storeSelectionReady, selectedStore?.tiwiId]);

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
        const { initialPurchase, ...product } = created;
        setProducts((prev) => [product, ...prev]);
        showToast(`Product "${product.name}" added to inventory successfully!`);
        if (initialPurchase) {
          showToast(`Opening stock invoice ${initialPurchase.poNumber} recorded. Supplier due: ${initialPurchase.dueAmount.toFixed(2)}.`);
        }
        loadData();
        return product;
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
        const supplier = await res.json();
        showToast(`Supplier "${supplier.companyName}" added!`);
        loadData();
        return supplier;
      }
      const error = await res.json().catch(() => ({}));
      showToast(error.error || 'Failed to add supplier', 'error');
      return null;
    } catch (err) {
      showToast('Error connecting to server', 'error');
      return null;
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
      <ToastNotification message={toast?.message} type={toast?.type} />

      {/* DEDICATED AUTHENTICATION, LANDING & ONBOARDING VIEWS */}
      <Suspense fallback={<TiwloTopSyncBar active={true} />}>
        {authChecking && (activeTab === 'administrator' || activeTab === 'admin' || activeTab === 'tpanel') ? (
          <TiwloPageLoader />
        ) : !authChecking && currentUser?.identityVerificationRequired === true &&
          currentUser?.identityVerified !== true && activeTab !== 'verification' &&
          !String(activeTab).startsWith('verification/') ? (
          <IdentityRequiredView
            user={currentUser}
            onStartVerification={() => handleTabChange('verification')}
            onSignOut={handleLogout}
          />
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
      ) : (!currentUser && activeTab !== 'store' && activeTab !== 'verification' && activeTab !== 'create-account' && !activeTab.startsWith('create-store') && activeTab !== 'mobile-help-support' && activeTab !== 'help-support/mobile' && activeTab !== 'tpanel' && activeTab !== 'landing' && activeTab !== 'subdomain' && !(typeof activeTab === 'string' && (activeTab.startsWith('subdomain') || activeTab.startsWith('uidis')))) ? (
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
        isStorefrontSubdomainHost() && publicStorefrontLoading ? (
          <div className="min-h-screen flex items-center justify-center text-slate-600">Loading storefront...</div>
        ) : isStorefrontSubdomainHost() && publicStorefrontError ? (
          <div className="min-h-screen flex items-center justify-center p-6 text-center text-rose-700" role="alert">
            {publicStorefrontError}
          </div>
        ) : (
          <TiwiMart
            products={products}
            categories={categories}
            suppliers={suppliers}
            storeSettings={publicStoreSettings}
            onOpenAdmin={() => {
              setActiveTab('dashboard');
              try {
                window.history.pushState({}, '', window.location.pathname);
              } catch (e) {}
            }}
            showToast={showToast}
          />
        )
      ) : (activeTab === 'tiwi' || (typeof activeTab === 'string' && activeTab.startsWith('tiwi'))) ? (
        <TiwiSocialWeb
          currentUser={currentUser}
          onNavigateHome={() => handleTabChange('dashboard')}
        />
      ) : (activeTab === 'email' || (typeof activeTab === 'string' && activeTab.startsWith('email')) || activeTab === 'mail') ? (
        <TiwiOutlookEmail
          currentUser={currentUser}
          onSignOut={handleLogout}
          onNavigateHome={() => {
            if (isMailSubdomain()) {
              window.location.assign(getMainAppUrl('/'));
            } else {
              handleTabChange('dashboard');
            }
          }}
        />
      ) : (activeTab === 'discord' || (typeof activeTab === 'string' && activeTab.startsWith('discord'))) ? (
        <DiscordBotManager
          currentUser={currentUser}
          onNavigateHome={() => handleTabChange('dashboard')}
        />
      ) : (activeTab === 'studio' || (typeof activeTab === 'string' && activeTab.startsWith('studio'))) ? (
        <TiwloStudioLanding
          onNavigateAuth={(mode) => {
            if (mode === 'signup') handleTabChange('create-account');
            else handleTabChange('login');
          }}
          onNavigateTab={handleTabChange}
        />
      ) : (activeTab === 'subdomain' || (typeof activeTab === 'string' && (activeTab.startsWith('subdomain') || activeTab.startsWith('uidis') || activeTab.startsWith('uids')))) ? (
        <SubdomainLanding
          onNavigateAuth={(mode) => {
            if (mode === 'signup') handleTabChange('create-account');
            else handleTabChange('login');
          }}
          onNavigateTab={handleTabChange}
        />
      ) : (activeTab === 'oneprofile' || (typeof activeTab === 'string' && (activeTab.startsWith('oneprofile') || activeTab.startsWith('one-profile')))) ? (
        <OneProfileDashboard
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          onNavigateTab={handleTabChange}
        />
      ) : (activeTab === 'verification' || (typeof activeTab === 'string' && activeTab.startsWith('verification'))) ? (
        <Suspense fallback={<TiwloPageLoader text="Loading Identity Verification..." />}>
          <VerificationFlow
            onComplete={() => {
              if (!currentUser?.id) return;
              const verifiedUser = {
                ...currentUser,
                identityVerified: true,
                identityVerificationRequired: false
              };
              setCurrentUser(verifiedUser);
              localStorage.setItem('stockpro_user', JSON.stringify(verifiedUser));
              handleTabChange('dashboard');
            }}
            onCancel={() => handleTabChange(
              currentUser?.identityVerificationRequired ? 'identity-required' : 'dashboard'
            )}
          />
        </Suspense>
      ) : activeTab === 'pos' ? (
        <POSView
          onBack={() => handleTabChange('dashboard')}
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
      ) : (activeTab === 'dashboard' || activeTab === 'identity' || activeTab === 'billing' || activeTab.startsWith('billing') || activeTab === 'domains' || activeTab === 'workspace' || activeTab.startsWith('workspace') || activeTab === 'marketplace' || activeTab.startsWith('marketplace') || activeTab === 'whatsapp-automation' || activeTab.startsWith('whatsapp-automation')) ? (
        <CloudDashboard
          currentUser={currentUser}
          initialNav={activeTab === 'identity' ? 'identity' : activeTab === 'billing' || activeTab.startsWith('billing') ? 'billing' : activeTab === 'domains' ? 'domains' : activeTab.startsWith('workspace') ? activeTab : activeTab.startsWith('marketplace') ? activeTab : activeTab.startsWith('whatsapp-automation') ? 'whatsapp-automation' : 'dashboard'}
          onLogout={handleLogout}
          onOpenStoreDashboard={handleStoreConsoleLaunch}
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
                  dataLoadError={dataLoadError}
                  onReloadData={handleReloadData}
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
                  onBackToCloud={() => handleTabChange('dashboard')}
                  currentStore={selectedStore || currentUser}
                  products={products}
                  categories={categories}
                  inventoryLoading={loading}
                  onVisitSite={handleVisitSite}
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
              suppliers={suppliers}
              onAddSupplier={handleAddSupplier}
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
              onAddSupplier={handleAddSupplier}
              showToast={showToast}
              onRefreshData={loadData}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {/* TAB: SALES */}
          {(activeTab === 'sales' || activeTab === 'courier') && (
            <SalesView
              key={activeTab}
              courierMode={activeTab === 'courier'}
              products={products}
              customers={customers}
              showToast={showToast}
              onRefreshData={loadData}
              onBackToDashboard={() => setActiveTab('dashboard')}
            />
          )}

          {activeTab === 'store-reviews' && (
            <StoreReviewsView showToast={showToast} />
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

          {activeTab === 'staff-management' && (
            <StaffManagementView showToast={showToast} />
          )}

          {activeTab === 'hr-management' && (
            <HRManagementView showToast={showToast} />
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
          {(['store-settings', 'store-identity', 'store-banners', 'store-pages', 'payments', 'shipping', 'promotions'].includes(activeTab)) && (
            <StoreSettingsView
              key={activeTab}
              initialTab={activeTab === 'store-settings'
                ? 'theme'
                : activeTab === 'store-identity'
                  ? 'identity'
                  : activeTab === 'store-banners'
                    ? 'banners'
                    : activeTab === 'store-pages'
                      ? 'pages'
                    : activeTab}
              onNavigateToPaymentShipping={() => handleTabChange('payments')}
              onNavigateToPayments={() => handleTabChange('payments')}
              onNavigateToShipping={() => handleTabChange('shipping')}
              onNavigateToPromotions={() => handleTabChange('promotions')}
              onNavigateToStoreSettings={() => handleTabChange('store-settings')}
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
