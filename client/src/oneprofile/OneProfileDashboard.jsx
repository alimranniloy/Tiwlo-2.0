import React, { useState, useEffect } from 'react';
import OneProfileSidebar from './components/OneProfileSidebar';
import OneProfileTopBar from './components/OneProfileTopBar';
import OneProfileHomeView from './views/OneProfileHomeView';
import OneProfileWebsitesView from './views/OneProfileWebsitesView';
import OneProfileSubdomainsView from './views/OneProfileSubdomainsView';
import OneProfileTemplatesView from './views/OneProfileTemplatesView';
import OneProfileNfcView from './views/OneProfileNfcView';
import OneProfileHostingView from './views/OneProfileHostingView';
import OneProfileAnalyticsView from './views/OneProfileAnalyticsView';
import OneProfileBillingView from './views/OneProfileBillingView';
import OneProfileSettingsView from './views/OneProfileSettingsView';
import OneProfileSupportView from './views/OneProfileSupportView';

/**
 * OneProfileDashboard Layout Container
 * 100% clone of the screenshot provided:
 * - Brand: UIDis.app
 * - Sidebar with group 1 (Home, My Website, Subdomains, Templates, NFC Card, Cloud Hosting, Analytics)
 *   and group 2 (Billing, Settings, Support) + Upgrade to Pro card
 * - TopBar with search, real notifications, and authenticated user profile
 * - Home View matches exact layout of screenshot
 * - Fully mobile-responsive layout (mobile-ui-rule.md)
 * - Zero popups / modals (page-nopopup-role.md)
 */
export default function OneProfileDashboard({
  currentUser,
  setCurrentUser,
  onNavigateTab
}) {
  const [activeView, setActiveView] = useState('home');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/oneprofile/summary', { credentials: 'include' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load dashboard data');
        return data;
      })
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch((error) => {
        if (active) setSummaryError(error.message);
      });
    return () => { active = false; };
  }, []);

  // Synchronize route with active view
  useEffect(() => {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (path.startsWith('oneprofile/')) {
      const sub = path.replace(/^oneprofile\//, '');
      if (['website', 'subdomains', 'templates', 'nfc', 'hosting', 'analytics', 'billing', 'settings', 'support'].includes(sub)) {
        setActiveView(sub);
      }
    }
  }, []);

  const handleSelectView = (viewId) => {
    setActiveView(viewId);
    const targetUrl = viewId === 'home' ? '/oneprofile' : `/oneprofile/${viewId}`;
    try {
      window.history.pushState(null, '', targetUrl);
    } catch (e) {}
  };

  const renderActiveView = () => {
    switch (activeView) {
      case 'website':
        return <OneProfileWebsitesView websites={summary?.websites || []} onNavigateTab={handleSelectView} />;
      case 'subdomains':
        return (
          <OneProfileSubdomainsView
            domains={summary?.domains || []}
            onDomainClaimed={(registration) => {
              setSummary((previous) => ({
                ...previous,
                domains: [
                  { ...registration, nameservers: [] },
                  ...(previous?.domains || [])
                ],
                metrics: previous?.metrics
                  ? { ...previous.metrics, domains: (previous.metrics.domains || 0) + 1 }
                  : previous?.metrics
              }));
            }}
          />
        );
      case 'templates':
        return <OneProfileTemplatesView onNavigateTab={handleSelectView} />;
      case 'nfc':
        return <OneProfileNfcView currentUser={currentUser} summary={summary} onNavigateTab={handleSelectView} />;
      case 'hosting':
        return <OneProfileHostingView currentUser={currentUser} summary={summary} onNavigateTab={handleSelectView} />;
      case 'analytics':
        return <OneProfileAnalyticsView summary={summary} onNavigateTab={handleSelectView} />;
      case 'billing':
        return <OneProfileBillingView onNavigateTab={handleSelectView} />;
      case 'settings':
        return (
          <OneProfileSettingsView
            currentUser={currentUser}
            onUserUpdated={setCurrentUser}
            profile={summary?.profile}
            onProfileUpdated={(profile) => setSummary((previous) => ({ ...previous, profile }))}
            onNavigateTab={handleSelectView}
          />
        );
      case 'support':
        return <OneProfileSupportView onNavigateTab={handleSelectView} />;
      case 'home':
      default:
        return <OneProfileHomeView currentUser={currentUser} summary={summary} onNavigateTab={handleSelectView} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-800 font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Sidebar (Desktop Persistent & Mobile Drawer) */}
      <OneProfileSidebar
        currentUser={currentUser}
        activeView={activeView}
        onSelectView={handleSelectView}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Sticky Header TopBar */}
        <OneProfileTopBar
          currentUser={currentUser}
          notifications={summary?.notifications || []}
          onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onNavigateTab={(target) => {
            if (target === 'login' || target === 'landing') {
              if (onNavigateTab) onNavigateTab(target);
              else window.location.assign('/');
            } else {
              handleSelectView(target);
            }
          }}
        />

        {/* Scrollable Main View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {summaryError && (
            <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
              {summaryError}
            </div>
          )}
          {summary ? renderActiveView() : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-sm text-slate-500">
              Loading your dashboard data...
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
