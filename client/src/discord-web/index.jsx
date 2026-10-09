import React, { useState, useEffect, useCallback } from 'react';
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
import { DiscordAPI } from './api/discordApi';

export default function DiscordBotManager({ currentUser, onNavigateHome }) {
  const [currentPath, setCurrentPath] = useState(() => {
    return window.location.pathname || '/discord';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [overviewData, setOverviewData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // Fetch real database overview data
  const loadOverviewData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await DiscordAPI.getOverview();
      setOverviewData(data);
    } catch (err) {
      console.warn('[DiscordBotManager] Could not load overview:', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverviewData();
  }, [loadOverviewData]);

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

    // Subroute: Bots list
    if (path === '/discord/bots') {
      return (
        <BotsView
          bots={overviewData?.bots || []}
          onNavigate={navigateTo}
          onReload={loadOverviewData}
        />
      );
    }

    // Subroute: Add server
    if (path === '/discord/servers/new') {
      return (
        <AddServerView
          onBack={() => navigateTo('/discord/servers')}
          onServerCreated={() => {
            loadOverviewData();
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
        onNavigate={navigateTo}
      />
    );
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-[#202124] font-sans antialiased">
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
          {renderCurrentView()}
        </main>
      </div>
    </div>
  );
}
