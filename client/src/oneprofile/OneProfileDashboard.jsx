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
 * - TopBar with Search ⌘K, Notifications, User Profile (John Doe, Free Plan)
 * - Home View matches exact layout of screenshot
 * - Fully mobile-responsive layout (mobile-ui-rule.md)
 * - Zero popups / modals (page-nopopup-role.md)
 */
export default function OneProfileDashboard({
  onNavigateTab
}) {
  const [activeView, setActiveView] = useState('home');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
        return <OneProfileWebsitesView onNavigateTab={handleSelectView} />;
      case 'subdomains':
        return <OneProfileSubdomainsView onNavigateTab={handleSelectView} />;
      case 'templates':
        return <OneProfileTemplatesView onNavigateTab={handleSelectView} />;
      case 'nfc':
        return <OneProfileNfcView onNavigateTab={handleSelectView} />;
      case 'hosting':
        return <OneProfileHostingView onNavigateTab={handleSelectView} />;
      case 'analytics':
        return <OneProfileAnalyticsView onNavigateTab={handleSelectView} />;
      case 'billing':
        return <OneProfileBillingView onNavigateTab={handleSelectView} />;
      case 'settings':
        return <OneProfileSettingsView onNavigateTab={handleSelectView} />;
      case 'support':
        return <OneProfileSupportView onNavigateTab={handleSelectView} />;
      case 'home':
      default:
        return <OneProfileHomeView onNavigateTab={handleSelectView} />;
    }
  };

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] text-slate-800 font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Sidebar (Desktop Persistent & Mobile Drawer) */}
      <OneProfileSidebar
        activeView={activeView}
        onSelectView={handleSelectView}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        {/* Sticky Header TopBar */}
        <OneProfileTopBar
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
          {renderActiveView()}
        </main>
      </div>
    </div>
  );
}
