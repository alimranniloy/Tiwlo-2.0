import React, { useState, useEffect } from 'react';
import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import MetricCards from './MetricCards';
import SalesOverviewChart from './SalesOverviewChart';
import RevenueBreakdownChart from './RevenueBreakdownChart';
import RecentActivities from './RecentActivities';
import EcommerceOverview from './EcommerceOverview';
import CloudOverview from './CloudOverview';
import QuickActions from './QuickActions';
import SystemInfoCard from './SystemInfoCard';
import AdminSubView from './AdminSubView';
import AdminCustomersView from './AdminCustomersView';
import AdminUsersView from './AdminUsersView';
import AdminGoogleDrivePage from './AdminGoogleDrivePage';
import { Calendar, Sparkles } from 'lucide-react';
import { useTheme } from '../config/themeConfig';

const API_BASE = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:5000/api'
  : '/api';

export default function AdminDashboard({ currentUser, onLogout, showToast }) {
  const isAuthorizedAdmin = currentUser && (
    currentUser.role === 'admin' ||
    currentUser.role === 'super_admin' ||
    currentUser.email?.toLowerCase().trim() === 'tiwloltd@gmail.com'
  );

  useEffect(() => {
    if (!isAuthorizedAdmin) {
      window.location.replace('/');
    }
  }, [isAuthorizedAdmin]);

  const [activeView, setActiveView] = useState(() => {
    const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (pathname === 'administrator/customers' || pathname === 'admin/customers') return 'customers';
    if (pathname === 'administrator/users' || pathname === 'admin/users') return 'users';
    if (pathname === 'administrator/orders' || pathname === 'admin/orders') return 'orders';
    if (pathname === 'administrator/servers' || pathname === 'admin/servers') return 'servers';
    if (pathname.startsWith('administrator/')) return pathname.replace('administrator/', '');
    if (pathname.startsWith('admin/')) return pathname.replace('admin/', '');
    return 'dashboard';
  });

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [overviewError, setOverviewError] = useState('');
  const [selectedRange, setSelectedRange] = useState('7days');
  const { isDark: isDarkMode, toggleTheme: toggleDarkMode } = useTheme();

  const handleNavigate = (view) => {
    setActiveView(view);
    const targetUrl = view === 'dashboard' ? '/administrator' : `/administrator/${view}`;
    if (window.location.pathname !== targetUrl) {
      window.history.pushState(null, '', targetUrl);
    }
  };

  // Sync state on browser back/forward buttons
  useEffect(() => {
    const handlePop = () => {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (pathname === 'administrator' || pathname === 'admin') setActiveView('dashboard');
      else if (pathname.startsWith('administrator/')) setActiveView(pathname.replace('administrator/', ''));
      else if (pathname.startsWith('admin/')) setActiveView(pathname.replace('admin/', ''));
    };
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Fetch live overview from backend
  const fetchOverview = async (range = selectedRange) => {
    try {
      const token = localStorage.getItem('stockpro_session');
      const res = await fetch(`${API_BASE}/admin/overview?range=${range}`, {
        credentials: 'include',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || `Overview request failed (${res.status}).`);
      setAdminData(json.data);
      setOverviewError('');
    } catch (err) {
      console.error('[Admin] Error fetching overview:', err);
      setAdminData(null);
      setOverviewError('Live dashboard data could not be loaded.');
    }
  };

  useEffect(() => {
    if (!isAuthorizedAdmin) {
      return undefined;
    }
    fetchOverview(selectedRange);
    const timer = setInterval(() => fetchOverview(selectedRange), 10000);
    return () => clearInterval(timer);
  }, [isAuthorizedAdmin, selectedRange]);

  // Hooks must always run in the same order.  Render the redirect fallback
  // only after all hooks have been declared.
  if (!isAuthorizedAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0B0F19] text-slate-600 dark:text-slate-400 font-sans">
        <p className="text-sm">Redirecting to user workspace...</p>
      </div>
    );
  }

  const now = new Date();
  const dateFormatted = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  const timeFormatted = now.toLocaleDateString('en-US', { weekday: 'long' }) + ', ' +
    now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-[#f4f7fc] text-slate-900'} font-sans antialiased transition-colors duration-200`}>
      {/* Top Header */}
      <AdminHeader
        currentUser={currentUser}
        onLogout={onLogout}
        onNavigate={handleNavigate}
        onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <div className="flex">
        {/* Left Sidebar */}
        <AdminSidebar
          activeView={activeView}
          onNavigate={handleNavigate}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 p-4 sm:p-5 lg:p-6 space-y-5">
          {activeView === 'customers' ? (
            <AdminCustomersView
              onBackToDashboard={() => handleNavigate('dashboard')}
              showToast={showToast}
            />
          ) : activeView === 'users' ? (
            <AdminUsersView
              onBackToDashboard={() => handleNavigate('dashboard')}
              showToast={showToast}
              currentUser={currentUser}
            />
          ) : activeView === 'google-drive' ? (
            <AdminGoogleDrivePage showToast={showToast} />
          ) : activeView !== 'dashboard' ? (
            <AdminSubView
              key={activeView}
              viewId={activeView}
              onBackToDashboard={() => handleNavigate('dashboard')}
              showToast={showToast}
            />
          ) : (
            <>
              {/* Welcome Banner Row matching screenshot */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 text-xs font-semibold mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Welcome back, {currentUser?.name?.split(' ')[0] || 'Administrator'}!</span>
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Admin Dashboard
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Manage your e-commerce and cloud services from one place.
                  </p>
                </div>

                {/* Right Status Cards */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Date Card */}
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{dateFormatted}</p>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500">{timeFormatted}</p>
                    </div>
                  </div>

                  {/* System Status Card */}
                  <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                    <div className={`w-2.5 h-2.5 rounded-full ml-1 ${
                      !adminData && !overviewError ? 'bg-amber-500 ring-4 ring-amber-500/20' :
                      overviewError || !adminData?.systemInfo?.operational ? 'bg-rose-500 ring-4 ring-rose-500/20' :
                      'bg-emerald-500 ring-4 ring-emerald-500/20'
                    }`} />
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">System Status</p>
                      <p className={`text-[10px] font-medium ${
                        !adminData && !overviewError ? 'text-amber-600 dark:text-amber-400' :
                        overviewError || !adminData?.systemInfo?.operational ? 'text-rose-600 dark:text-rose-400' :
                        'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {!adminData && !overviewError ? 'Checking services…' : overviewError || adminData?.systemInfo?.status || 'Status unavailable'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top 4 KPI Metric Cards */}
              <MetricCards metrics={adminData?.metrics} />

              {/* Middle Section: Sales Overview (60%) + Revenue Breakdown (20%) + Recent Activities (20%) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                <div className="lg:col-span-6 xl:col-span-6">
                  <SalesOverviewChart
                    salesData={adminData?.salesOverview}
                    currency={adminData?.revenueBreakdown?.currency}
                    currentRange={selectedRange}
                    onRangeChange={(range) => setSelectedRange(range)}
                  />
                </div>

                <div className="lg:col-span-3 xl:col-span-3">
                  <RevenueBreakdownChart breakdown={adminData?.revenueBreakdown} />
                </div>

                <div className="lg:col-span-3 xl:col-span-3">
                  <RecentActivities
                    activities={adminData?.recentActivities}
                  />
                </div>
              </div>

              {/* Bottom Section: E-commerce Overview + Cloud Overview + Quick Actions & System Info */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* E-commerce Overview Card */}
                <div className="lg:col-span-5 xl:col-span-5">
                  <EcommerceOverview
                    data={adminData?.ecommerceOverview}
                    onViewDetails={() => setActiveView('orders')}
                  />
                </div>

                {/* Cloud Overview Card */}
                <div className="lg:col-span-4 xl:col-span-4">
                  <CloudOverview
                    data={adminData?.cloudOverview}
                    onViewDetails={() => setActiveView('servers')}
                  />
                </div>

                {/* Quick Actions & System Info Column */}
                <div className="lg:col-span-3 xl:col-span-3 space-y-5">
                  <QuickActions onAction={(target) => setActiveView(target)} />
                  <SystemInfoCard info={adminData?.systemInfo} />
                </div>
              </div>
            </>
          )}

          {/* Minimalist Clean Footer */}
          <footer className="pt-6 pb-2 border-t border-slate-200/60 dark:border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 dark:text-slate-500 gap-2">
            <div>
              <span>Tiwlo Admin Panel</span>
              <span className="mx-2">•</span>
              <span>E-commerce & Cloud Management System</span>
            </div>
            <div className="flex items-center gap-1 text-[11px]">
              <span>Built with</span>
              <span className="text-red-500">❤️</span>
              <span>for a better tomorrow.</span>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}
