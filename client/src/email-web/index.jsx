import React from 'react';
import { EmailProvider, useEmail } from './context/EmailContext';
import OutlookHeader from './components/OutlookHeader';
import OutlookRibbon from './components/OutlookRibbon';
import OutlookSidebar from './components/OutlookSidebar';
import EmailListPane from './components/EmailListPane';
import EmailReadingPane from './components/EmailReadingPane';
import EmailComposePane from './components/EmailComposePane';
import OutlookBottomNav from './components/OutlookBottomNav';
import MailboxSetup from './components/MailboxSetup';
import { X } from 'lucide-react';

function OutlookEmailLayout() {
  const {
    isComposeOpen,
    mailbox,
    mailboxLoading,
    mobileView,
    mobileDrawerOpen,
    setMobileDrawerOpen
  } = useEmail();

  if (mailboxLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0F172A] text-sm text-slate-500">
        Checking your Tiwlo Mail account…
      </div>
    );
  }

  if (!mailbox) return <MailboxSetup />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-800 dark:text-slate-100 font-sans antialiased overflow-hidden select-none">
      {/* 1. Top App Header */}
      <OutlookHeader />

      {/* 2. Command Ribbon Bar */}
      <OutlookRibbon />

      {/* 3. Main 3-Pane Desktop Workspace / Responsive Mobile */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* DESKTOP PANE 1: Left Navigation Rail & Folders Tree */}
        <aside className="hidden md:flex h-full flex-shrink-0">
          <OutlookSidebar />
        </aside>

        {/* MOBILE SLIDING DRAWER: Left Folders Tree */}
        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <div
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            />
            {/* Drawer */}
            <div className="relative w-[280px] max-w-[85vw] h-full bg-white dark:bg-[#18181B] shadow-2xl flex flex-col z-10 animate-slideRight">
              <div className="p-3.5 bg-[#0078D4] text-white flex items-center justify-between">
                <span className="font-bold text-[14px]">Mail Folders</span>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded-md hover:bg-white/20 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <OutlookSidebar />
              </div>
            </div>
          </div>
        )}

        {/* DESKTOP PANE 2 & 3: Message List + Reading / Compose Pane */}
        {/* On Desktop: Side-by-side 2 columns */}
        {/* On Mobile: Single active view switching (list vs reading vs compose) */}
        <div className="flex-1 flex h-full min-w-0">
          {/* Message List */}
          <div
            className={`h-full min-w-0 ${
              mobileView === 'list'
                ? 'w-full flex-1'
                : 'hidden md:flex md:w-[360px] xl:w-[400px] flex-shrink-0'
            }`}
          >
            <EmailListPane />
          </div>

          {/* Reading Pane / Compose Pane */}
          <div
            className={`h-full min-w-0 ${
              mobileView === 'list'
                ? 'hidden md:flex md:flex-1'
                : 'w-full flex-1'
            }`}
          >
            {isComposeOpen ? <EmailComposePane /> : <EmailReadingPane />}
          </div>
        </div>
      </div>

      {/* 4. Mobile Bottom Navigation (Hidden during compose so composer buttons are never obstructed) */}
      {!isComposeOpen && mobileView !== 'compose' && <OutlookBottomNav />}
    </div>
  );
}

export default function TiwiOutlookEmail({ currentUser = null, onNavigateHome = null }) {
  return (
    <EmailProvider initialUser={currentUser} onNavigateHome={onNavigateHome}>
      <OutlookEmailLayout />
    </EmailProvider>
  );
}
