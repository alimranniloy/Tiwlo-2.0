import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Archive,
  ShieldAlert,
  Sparkles,
  FolderInput,
  Tag,
  Clock,
  Pin,
  CheckCheck,
  RotateCcw,
  Printer,
  RefreshCw,
  Mail,
  ChevronDown,
  Layout,
  Keyboard,
  LifeBuoy,
  FileText
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function OutlookRibbon() {
  const {
    openCompose,
    selectedEmail,
    handleDeleteEmail,
    handleArchiveEmail,
    handleTogglePin,
    handleSweepSender,
    handleMarkAllAsRead,
    showToast
  } = useEmail();

  const [activeTab, setActiveRibbonTab] = useState('home');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [categorizeDropdown, setCategorizeDropdown] = useState(false);
  const [snoozeDropdown, setSnoozeDropdown] = useState(false);
  const [moveToDropdown, setMoveToDropdown] = useState(false);

  const categorizeRef = useRef(null);
  const snoozeRef = useRef(null);
  const moveToRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (categorizeRef.current && !categorizeRef.current.contains(e.target)) setCategorizeDropdown(false);
      if (snoozeRef.current && !snoozeRef.current.contains(e.target)) setSnoozeDropdown(false);
      if (moveToRef.current && !moveToRef.current.contains(e.target)) setMoveToDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    showToast('Checking for new messages...', 'info');
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('All folders up to date', 'info');
    }, 700);
  };

  const categories = [
    { name: 'Work', color: '#137333' },
    { name: 'Personal', color: '#107C41' },
    { name: 'Finance', color: '#111111' },
    { name: 'Projects', color: '#555555' },
    { name: 'Urgent', color: '#137333' }
  ];

  return (
    <div className="bg-white dark:bg-[#181818] border-b border-neutral-200 dark:border-neutral-800 flex flex-col text-neutral-700 dark:text-neutral-200 select-none text-[12.5px] z-30 shadow-xs">
      {/* 1. Ribbon Tabs Header: Home | View | Help */}
      <div className="h-[32px] flex items-center justify-between px-3 border-b border-neutral-100 dark:border-neutral-800/80 text-[12px] bg-neutral-50/70 dark:bg-neutral-900/40">
        <div className="flex items-center gap-1">
          {['home', 'view', 'help'].map((tab) => {
            const isActive = activeTab === tab;
            const labels = { home: 'Home', view: 'View', help: 'Help' };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveRibbonTab(tab)}
                className={`relative px-3 py-1 font-semibold transition cursor-pointer ${
                  isActive
                    ? 'text-[#137333] dark:text-[#1ed760]'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                {labels[tab]}
                {isActive && (
                  <span className="absolute bottom-[-1px] left-2 right-2 h-[2px] bg-[#137333] dark:bg-[#1ed760] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="hidden sm:flex items-center gap-1.5 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Connected
          </span>
        </div>
      </div>

      {/* 2. Ribbon Commands Bar */}
      {activeTab === 'home' && (
        <div className="h-[46px] flex items-center justify-between px-2 sm:px-3 overflow-x-auto scrollbar-none">
          {/* Left Actions Group */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* The Unified "New mail" Button (No side arrow) */}
            <button
              type="button"
              onClick={() => openCompose()}
              className="flex items-center gap-2 bg-[#137333] hover:bg-[#0f7a37] active:bg-[#115c31] text-white font-bold px-3.5 py-1.5 rounded-lg text-[13px] shadow-xs hover:shadow-sm transition cursor-pointer mr-1"
              title="Compose New Mail (Ctrl + N)"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span>New mail</span>
            </button>

            {/* Vertical Divider */}
            <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-700 mx-0.5 hidden sm:block" />

            {/* Action: Delete */}
            <button
              type="button"
              onClick={() => {
                if (selectedEmail) handleDeleteEmail(selectedEmail.id);
                else showToast('Select an email first', 'info');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-50 hover:text-neutral-600 dark:hover:bg-neutral-950/30 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              title="Delete message"
            >
              <Trash2 className="w-4 h-4 text-[#111111]" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            {/* Action: Archive */}
            <button
              type="button"
              onClick={() => {
                if (selectedEmail) handleArchiveEmail(selectedEmail.id);
                else showToast('Select an email first', 'info');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              title="Archive message"
            >
              <Archive className="w-4 h-4 text-neutral-500" />
              <span className="hidden sm:inline">Archive</span>
            </button>

            {/* Action: Report / Junk */}
            <button
              type="button"
              onClick={() => {
                if (selectedEmail) {
                  handleDeleteEmail(selectedEmail.id);
                  showToast('Marked as Junk and sender blocked', 'info');
                } else showToast('Select an email first', 'info');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              title="Report Junk"
            >
              <ShieldAlert className="w-4 h-4 text-[#111111]" />
              <span className="hidden md:inline">Report</span>
            </button>

            {/* Action: Sweep */}
            <button
              type="button"
              onClick={() => {
                if (selectedEmail?.sender?.email) {
                  handleSweepSender(selectedEmail.sender.email);
                } else showToast('Select an email to sweep all messages from sender', 'info');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              title="Sweep all emails from this sender"
            >
              <Sparkles className="w-4 h-4 text-[#137333]" />
              <span className="hidden md:inline">Sweep</span>
            </button>

            {/* Vertical Divider */}
            <div className="h-4 w-[1px] bg-neutral-200 dark:bg-neutral-700 mx-0.5 hidden md:block" />

            {/* Action: Move To */}
            <div className="relative" ref={moveToRef}>
              <button
                type="button"
                onClick={() => setMoveToDropdown((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              >
                <FolderInput className="w-4 h-4 text-neutral-500" />
                <span className="hidden lg:inline">Move to</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>
              {moveToDropdown && (
                <div className="absolute top-[36px] left-0 w-44 bg-white dark:bg-[#201F1E] rounded-xl shadow-xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => { setMoveToDropdown(false); showToast('Moved to Archive', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMoveToDropdown(false); showToast('Moved to Junk Email', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Junk Email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMoveToDropdown(false); showToast('Moved to Deleted Items', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    Deleted Items
                  </button>
                </div>
              )}
            </div>

            {/* Action: Categorize */}
            <div className="relative" ref={categorizeRef}>
              <button
                type="button"
                onClick={() => setCategorizeDropdown((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              >
                <Tag className="w-4 h-4 text-[#137333]" />
                <span className="hidden lg:inline">Categorize</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>
              {categorizeDropdown && (
                <div className="absolute top-[36px] left-0 w-52 bg-white dark:bg-[#201F1E] rounded-xl shadow-xl border border-black/10 dark:border-white/10 p-2 z-50 animate-fadeIn">
                  <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider mb-1 px-2">
                    Categories
                  </div>
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => {
                        setCategorizeDropdown(false);
                        showToast(`Applied ${cat.name} category`, 'info');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-left text-[12.5px]"
                    >
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action: Snooze */}
            <div className="relative" ref={snoozeRef}>
              <button
                type="button"
                onClick={() => setSnoozeDropdown((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              >
                <Clock className="w-4 h-4 text-neutral-500" />
                <span className="hidden xl:inline">Snooze</span>
                <ChevronDown className="w-3 h-3 text-neutral-400" />
              </button>
              {snoozeDropdown && (
                <div className="absolute top-[36px] left-0 w-52 bg-white dark:bg-[#201F1E] rounded-xl shadow-xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => { setSnoozeDropdown(false); showToast('Snoozed until 6:00 PM', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[12.5px]"
                  >
                    Later today (6:00 PM)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSnoozeDropdown(false); showToast('Snoozed until Tomorrow 8:00 AM', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-[12.5px]"
                  >
                    Tomorrow morning (8:00 AM)
                  </button>
                </div>
              )}
            </div>

            {/* Action: Pin */}
            <button
              type="button"
              onClick={() => {
                if (selectedEmail) handleTogglePin(selectedEmail.id);
                else showToast('Select an email first', 'info');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              title="Pin to top of folder"
            >
              <Pin className="w-4 h-4 text-[#137333]" />
              <span className="hidden xl:inline">Pin</span>
            </button>

            {/* Action: Mark all as read */}
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition cursor-pointer font-medium"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4 text-emerald-600" />
              <span className="hidden xl:inline">Mark all read</span>
            </button>
          </div>

          {/* Right Actions Group */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Sync / Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              className={`p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition cursor-pointer text-neutral-600 dark:text-neutral-400 ${
                isRefreshing ? 'animate-spin text-[#137333]' : ''
              }`}
              title="Check for new messages"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Undo */}
            <button
              type="button"
              onClick={() => showToast('Nothing to undo', 'info')}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition cursor-pointer text-neutral-600 dark:text-neutral-400"
              title="Undo (Ctrl + Z)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={() => window.print()}
              className="p-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md transition cursor-pointer text-neutral-600 dark:text-neutral-400"
              title="Print message"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Ribbon View Tab Commands */}
      {activeTab === 'view' && (
        <div className="h-[46px] flex items-center justify-between px-3 overflow-x-auto scrollbar-none text-[12.5px]">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-400 uppercase text-[11px]">Reading Pane:</span>
            <button
              type="button"
              onClick={() => showToast('Reading pane: Right side (Default)', 'info')}
              className="px-2.5 py-1 bg-neutral-50 dark:bg-neutral-950/40 text-[#137333] rounded-md font-medium cursor-pointer"
            >
              Right
            </button>
            <button
              type="button"
              onClick={() => showToast('Reading pane: Bottom view', 'info')}
              className="px-2.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md cursor-pointer"
            >
              Bottom
            </button>
            <button
              type="button"
              onClick={() => showToast('Reading pane: Hidden', 'info')}
              className="px-2.5 py-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-md cursor-pointer"
            >
              Hide
            </button>
          </div>
        </div>
      )}

      {/* 4. Ribbon Help Tab Commands */}
      {activeTab === 'help' && (
        <div className="h-[46px] flex items-center justify-between px-3 overflow-x-auto scrollbar-none text-[12.5px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => showToast('Shortcuts: Ctrl+N (New mail), Ctrl+E (Search), Delete (Remove)', 'info')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-[#137333]" />
              <span>Keyboard Shortcuts</span>
            </button>
            <button
              type="button"
              onClick={() => showToast('Opening Help Center...', 'info')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 font-medium cursor-pointer"
            >
              <LifeBuoy className="w-4 h-4 text-emerald-600" />
              <span>Help Center</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
