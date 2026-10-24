import React, { useState, useEffect } from 'react';
import CloudHeader from './components/CloudHeader';
import CloudSidebar from './components/CloudSidebar';
import CloudHeroBanner from './components/CloudHeroBanner';
import CloudStatCards from './components/CloudStatCards';
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
  const [activeNav, setActiveNav] = useState(initialNav || 'dashboard');

  useEffect(() => {
    if (initialNav) setActiveNav(initialNav);
  }, [initialNav]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [cloudError, setCloudError] = useState('');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [billingInitialTab, setBillingInitialTab] = useState('overview');

  // Cloud Dashboard Data States
  const [metrics, setMetrics] = useState(null);
  const [droplets, setDroplets] = useState([]);
  const [activities, setActivities] = useState([]);
  const [popularImages, setPopularImages] = useState([]);

  // Multi-Store States ("Your Store" Section)
  const [userStores, setUserStores] = useState([]);
  const [profileUser, setProfileUser] = useState(currentUser);
  const [currentStore, setCurrentStore] = useState(() => {
    return {
      storeName: currentUser?.storeName || currentUser?.name || 'Tiwlo Store',
      tiwiId: currentUser?.tiwiId || currentUser?.storeId || ''
    };
  });

  useEffect(() => {
    if (currentUser) {
      setProfileUser(currentUser);
      setCurrentStore(prev => ({
        ...prev,
        storeName: currentUser.storeName || currentUser.name || prev.storeName,
        tiwiId: currentUser.tiwiId || currentUser.storeId || prev.tiwiId,
      }));
    }
  }, [currentUser]);

  const launchStoreConsole = (store = currentStore) => {
    if (store) {
      setCurrentStore(store);
      try {
        window.sessionStorage.setItem('tiwlo.selectedStore', JSON.stringify(store));
      } catch {}
    }
    onOpenStoreDashboard?.(store);
  };

  const [initialDropletImage, setInitialDropletImage] = useState('Ubuntu 24.04 LTS');

  const userId = currentUser?.id || currentUser?.tiwiId || null;

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

  return (
    <div className="min-h-screen bg-[#FFFFFF] text-[#1F1F1F] flex font-sans">
      {/* Left Sidebar */}
      <CloudSidebar
        activeNav={activeNav}
        setActiveNav={(nav) => {
          setActiveNav(nav);
          try {
            if (nav === 'workspace') window.history.pushState(null, '', '/workspace');
            else if (nav === 'marketplace') window.history.pushState(null, '', '/marketplace');
            else if (nav === 'dashboard') window.history.pushState(null, '', '/');
            else if (nav === 'whatsapp-automation') window.history.pushState(null, '', '/whatsapp-automation');
          } catch (e) {}
        }}
        userStores={userStores}
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
          currentUser={{ ...currentUser, storeName: currentStore?.storeName || currentUser?.storeName }}
          onLogout={onLogout}
          onOpenStore={launchStoreConsole}
          onSwitchStore={() => setActiveNav('my-online-store')}
          onOpenCreateDroplet={() => {
            setInitialDropletImage('Ubuntu 24.04 LTS');
            setActiveNav('create-droplet');
          }}
          onOpenSettings={(tab) => {
            if (tab === 'billing') {
              setBillingInitialTab('overview');
              setActiveNav('billing');
            }
            else if (tab === 'profile') setActiveNav('profile-settings');
            else if (tab === 'security' || tab === 'settings') onNavigateTab ? onNavigateTab('settings') : onOpenStoreDashboard();
            else onOpenStoreDashboard();
          }}
          onOpenBilling={(tab = 'overview') => {
            setBillingInitialTab(tab);
            setActiveNav('billing');
          }}
          showToast={showToast}
          onToggleMobileMenu={() => setMobileNavOpen(true)}
        />

        {/* Scrollable Dashboard Body */}
        <main className="flex-1 p-3.5 sm:p-6 lg:p-8 overflow-y-auto min-w-0">
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
          {activeNav === 'profile-settings' ? (
            <div className="max-w-[1000px] mx-auto space-y-5">
              <button
                type="button"
                onClick={() => setActiveNav('dashboard')}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
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
                initialImage={initialDropletImage}
              />
            </div>
          ) : activeNav === 'create-store' ? (
            <div className="max-w-[1500px] mx-auto">
              <CreateStoreView
                onBack={() => setActiveNav('my-online-store')}
                onCreateStore={handleCreateStore}
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
              />
            </div>
          ) : (activeNav === 'whatsapp-automation' || activeNav.startsWith('whatsapp-automation')) ? (
            <div className="max-w-[1500px] mx-auto">
              <WhatsAppAutomationView
                currentUser={currentUser}
                currentStore={currentStore}
                userStores={userStores}
                showToast={showToast}
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
            <div className="max-w-[1600px] mx-auto">
              <CloudBillingView
                currentUser={currentUser}
                initialTab={billingInitialTab}
                showToast={showToast}
                onBack={() => setActiveNav('dashboard')}
              />
            </div>
          ) : (activeNav === 'workspace' || activeNav.startsWith('workspace')) ? (
            <div className="max-w-[1500px] mx-auto">
              {activeNav === 'workspace/billing' ? (
                <WorkspaceBillingView
                  onBack={() => {
                    setActiveNav('workspace');
                    try { window.history.pushState(null, '', '/workspace'); } catch (e) {}
                  }}
                  onNavigate={(target) => {
                    setActiveNav(target);
                    try { window.history.pushState(null, '', `/${target}`); } catch (e) {}
                  }}
                />
              ) : activeNav === 'workspace/operations' ? (
                <WorkspaceOperationsView
                  onBack={() => {
                    setActiveNav('workspace');
                    try { window.history.pushState(null, '', '/workspace'); } catch (e) {}
                  }}
                  onNavigate={(target) => {
                    setActiveNav(target);
                    try { window.history.pushState(null, '', `/${target}`); } catch (e) {}
                  }}
                />
              ) : activeNav.startsWith('workspace/service/') ? (
                <WorkspaceServiceDetailView
                  serviceId={activeNav.replace('workspace/service/', '')}
                  onBack={() => {
                    setActiveNav('workspace');
                    try { window.history.pushState(null, '', '/workspace'); } catch (e) {}
                  }}
                  onNavigate={(target) => {
                    if (target === 'discord') {
                      onNavigateTab?.(target);
                      return;
                    }
                    setActiveNav(target);
                    try { window.history.pushState(null, '', `/${target}`); } catch (e) {}
                  }}
                />
              ) : (
                <WorkspaceView
                  onOpenStoreDashboard={launchStoreConsole}
                  showToast={showToast}
                  onNavigate={(target) => {
                    setActiveNav(target);
                    try { window.history.pushState(null, '', `/${target}`); } catch (e) {}
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
            <div className="max-w-[1600px] mx-auto space-y-6">
              {/* Top 2-Column Split: Main Grid (Left ~68%) and Right Column (~32%) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Left/Center Main Column (Col 8) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Hero Greeting & Cloud Banner */}
                  <CloudHeroBanner currentUser={{ ...currentUser, storeName: currentStore?.storeName || currentUser?.storeName }} />

                  {/* 4 Stat Cards */}
                  <CloudStatCards metrics={metrics} loading={loading} />

                  {/* Droplets Table */}
                  <DropletsTable
                    droplets={filteredDroplets}
                    onOpenCreateDroplet={() => {
                      setInitialDropletImage('Ubuntu 24.04 LTS');
                      setActiveNav('create-droplet');
                    }}
                  />

                  {/* Bottom Row of 3 Cards matching screenshot */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <ServiceStatusCard />
                    <PopularImagesCard
                      onDeployImage={(img) => {
                        setInitialDropletImage(img);
                        setActiveNav('create-droplet');
                      }}
                    />
                    <QuickAccessCard
                      onSelectAction={(action) => {
                        if (action === 'Droplets') setActiveNav('create-droplet');
                        else if (action === 'Volumes') setActiveNav('volumes');
                        else if (action === 'Kubernetes') setActiveNav('kubernetes');
                        else if (action === 'Domains') setActiveNav('domains');
                      }}
                    />
                  </div>
                </div>

                {/* Right Column (Col 4) */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Usage Overview (4 Circular Progress Rings) */}
                  <UsageOverviewCard metrics={metrics} />

                  {/* Create New Hero Button + 2x2 Grid */}
                  <CreateNewSection
                    onOpenCreateDroplet={() => {
                      setInitialDropletImage('Ubuntu 24.04 LTS');
                      setActiveNav('create-droplet');
                    }}
                  />

                  {/* Recent Activity */}
                  <CloudRecentActivity activities={activities} />
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
