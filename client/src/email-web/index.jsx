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
    mailboxError,
    refreshMailbox,
    mobileView,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    onSignOut
  } = useEmail();

  if (mailboxLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-[#171717] text-sm text-neutral-500">
        Checking your Tiwlo Mail account…
      </div>
    );
  }

  if (mailboxError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-neutral-50 dark:bg-[#171717] px-6 text-center">
        <p className="max-w-md text-sm text-neutral-600 dark:text-neutral-300">{mailboxError}</p>
        <button type="button" onClick={refreshMailbox} className="rounded-lg bg-[#137333] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f7a37]">
          Retry connection
        </button>
      </div>
    );
  }

  if (!mailbox) return <MailboxSetup />;

  return (
    <div className="h-screen w-screen flex flex-col bg-[#fafafa] dark:bg-[#171717] text-neutral-800 dark:text-neutral-100 font-sans antialiased overflow-hidden">
      {/* 1. Top App Header */}
      <OutlookHeader onSignOut={onSignOut} />

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
            <div className="relative w-[280px] max-w-[85vw] h-full bg-white dark:bg-[#181818] shadow-2xl flex flex-col z-10 animate-slideRight">
              <div className="p-3.5 bg-[#137333] text-white flex items-center justify-between">
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

export default function TiwiOutlookEmail({ currentUser = null, onNavigateHome = null, onSignOut = null }) {
  return (
    <EmailProvider initialUser={currentUser} onNavigateHome={onNavigateHome} onSignOut={onSignOut}>
      <OutlookEmailLayout />
    </EmailProvider>
  );
}
