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
import WorkspaceActivateView from '../../views/workspace/WorkspaceActivateView';
import WorkspaceBillingView from '../../views/workspace/WorkspaceBillingView';
import WorkspaceOperationsView from '../../views/workspace/WorkspaceOperationsView';

// Real GraphQL / REST Client
import {
  getCloudDashboardData,
  getUserStores,
  createDropletGraphQL,
  updateDropletStatusGraphQL,
  deleteDropletGraphQL,
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [billingInitialTab, setBillingInitialTab] = useState('overview');

  // Cloud Dashboard Data States
  const [metrics, setMetrics] = useState(null);
  const [droplets, setDroplets] = useState([]);
  const [activities, setActivities] = useState([]);
  const [popularImages, setPopularImages] = useState([]);

  // Multi-Store States ("Your Store" Section)
  const [userStores, setUserStores] = useState([]);
  const [currentStore, setCurrentStore] = useState(() => {
    return {
      storeName: currentUser?.storeName || currentUser?.name || 'Tiwlo Store',
      tiwiId: currentUser?.tiwiId || currentUser?.storeId || ''
    };
  });

  useEffect(() => {
    if (currentUser) {
      setCurrentStore(prev => ({
        ...prev,
        storeName: currentUser.storeName || currentUser.name || prev.storeName,
        tiwiId: currentUser.tiwiId || currentUser.storeId || prev.tiwiId,
      }));
    }
  }, [currentUser]);

  const [initialDropletImage, setInitialDropletImage] = useState('Ubuntu 24.04 LTS');

  const userId = currentUser?.id || currentUser?.tiwiId || null;

  // Load Cloud Data from real GraphQL
  const loadCloudData = async () => {
    try {
      setLoading(true);
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
        if (!currentStore || !storesData.some(s => s.tiwiId === currentStore.tiwiId)) {
          setCurrentStore(storesData[0]);
        }
      }
    } catch (err) {
      console.warn('Error loading cloud data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCloudData();
  }, [userId]);

  // Handler: Create Droplet
  const handleCreateDroplet = async (dropletInput) => {
    try {
      const created = await createDropletGraphQL(userId, {
        ...dropletInput,
        tiwiId: currentStore?.tiwiId || ''
      });
      if (created) {
        showToast?.(`Droplet "${created.name}" provisioned successfully!`);
        await loadCloudData();
      }
    } catch (err) {
      showToast?.('Failed to create droplet', 'error');
    }
  };

  // Handler: Update Droplet Status
  const handleUpdateStatus = async (dropletId, status) => {
    try {
      const updated = await updateDropletStatusGraphQL(dropletId, status);
      if (updated) {
        showToast?.(`Droplet status updated to ${status}`);
        setDroplets(prev =>
          prev.map(d => d.id === dropletId ? { ...d, status } : d)
        );
      }
    } catch (err) {
      showToast?.('Failed to update droplet status', 'error');
    }
  };

  // Handler: Delete Droplet
  const handleDeleteDroplet = async (dropletId) => {
    try {
      const ok = await deleteDropletGraphQL(dropletId);
      if (ok) {
        showToast?.('Droplet destroyed successfully');
        setDroplets(prev => prev.filter(d => d.id !== dropletId));
        await loadCloudData();
      }
    } catch (err) {
      showToast?.('Failed to delete droplet', 'error');
    }
  };

  // Handler: Create Store ("My Online Store" + action)
  const handleCreateStore = async (storeInput) => {
    try {
      const newStore = await createStoreGraphQL(userId, storeInput);
      if (newStore) {
        showToast?.(`Store "${newStore.storeName}" (${newStore.tiwiId}) created successfully!`);
        setUserStores(prev => [...prev, newStore]);
        setCurrentStore(newStore);
        await loadCloudData();
      }
    } catch (err) {
      showToast?.('Failed to create store', 'error');
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
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 flex transition-colors">
      {/* Left Sidebar */}
      <CloudSidebar
        activeNav={activeNav}
        setActiveNav={(nav) => {
          setActiveNav(nav);
          try {
            if (nav === 'workspace') window.history.pushState(null, '', '/workspace');
            else if (nav === 'dashboard') window.history.pushState(null, '', '/');
            else if (nav === 'whatsapp-automation') window.history.pushState(null, '', '/whatsapp-automation');
          } catch (e) {}
        }}
        userStores={userStores}
        currentStore={currentStore}
        onSelectStore={(st) => setCurrentStore(st)}
        onOpenStoreDashboard={onOpenStoreDashboard}
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
          onOpenStore={onOpenStoreDashboard}
          onOpenCreateDroplet={() => {
            setInitialDropletImage('Ubuntu 24.04 LTS');
            setActiveNav('create-droplet');
          }}
          onOpenSettings={(tab) => {
            if (tab === 'billing') {
              setBillingInitialTab('overview');
              setActiveNav('billing');
            }
            else if (tab === 'profile') onNavigateTab ? onNavigateTab('settings') : onOpenStoreDashboard();
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
          {activeNav === 'create-droplet' ? (
            <div className="max-w-[1500px] mx-auto">
              <CreateDropletView
                onBack={() => setActiveNav('dashboard')}
                onCreateDroplet={handleCreateDroplet}
                initialImage={initialDropletImage}
              />
            </div>
          ) : activeNav === 'create-store' ? (
            <div className="max-w-[1500px] mx-auto">
              <CreateStoreView
                onBack={() => setActiveNav('my-online-store')}
                onCreateStore={handleCreateStore}
                showToast={showToast}
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
                onOpenStoreDashboard={onOpenStoreDashboard}
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
              {activeNav === 'workspace/activate' ? (
                <WorkspaceActivateView
                  onBack={() => {
                    setActiveNav('workspace');
                    try { window.history.pushState(null, '', '/workspace'); } catch (e) {}
                  }}
                  onNavigate={(target) => {
                    setActiveNav(target);
                    try { window.history.pushState(null, '', `/${target}`); } catch (e) {}
                  }}
                />
              ) : activeNav === 'workspace/billing' ? (
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
                    setActiveNav(target);
                    try { window.history.pushState(null, '', `/${target}`); } catch (e) {}
                  }}
                />
              ) : (
                <WorkspaceView
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
                  <CloudStatCards metrics={metrics} />

                  {/* Droplets Table */}
                  <DropletsTable
                    droplets={filteredDroplets}
                    onUpdateStatus={handleUpdateStatus}
                    onDeleteDroplet={handleDeleteDroplet}
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
                        else showToast?.(`Opening ${action} manager`);
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
