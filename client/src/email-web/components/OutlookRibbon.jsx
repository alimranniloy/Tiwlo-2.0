import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  ChevronDown,
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
  MoreHorizontal,
  Mail,
  Calendar,
  CheckSquare,
  Users,
  RefreshCw,
  SlidersHorizontal,
  Layout,
  HelpCircle,
  Keyboard,
  FileText,
  LifeBuoy
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function OutlookRibbon() {
  const {
    openCompose,
    selectedEmail,
    handleDeleteEmail,
    handleArchiveEmail,
    handleToggleFlag,
    handleTogglePin,
    handleSweepSender,
    handleMarkAllAsRead,
    showToast
  } = useEmail();

  // Active Ribbon Tab: 'home' | 'view' | 'help'
  const [activeTab, setActiveRibbonTab] = useState('home');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dropdowns
  const [newMailDropdown, setNewMailDropdown] = useState(false);
  const [categorizeDropdown, setCategorizeDropdown] = useState(false);
  const [snoozeDropdown, setSnoozeDropdown] = useState(false);
  const [moveToDropdown, setMoveToDropdown] = useState(false);
  const [reportDropdown, setReportDropdown] = useState(false);

  const newMailRef = useRef(null);
  const categorizeRef = useRef(null);
  const snoozeRef = useRef(null);
  const moveToRef = useRef(null);
  const reportRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (newMailRef.current && !newMailRef.current.contains(e.target)) setNewMailDropdown(false);
      if (categorizeRef.current && !categorizeRef.current.contains(e.target)) setCategorizeDropdown(false);
      if (snoozeRef.current && !snoozeRef.current.contains(e.target)) setSnoozeDropdown(false);
      if (moveToRef.current && !moveToRef.current.contains(e.target)) setMoveToDropdown(false);
      if (reportRef.current && !reportRef.current.contains(e.target)) setReportDropdown(false);
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
    }, 900);
  };

  const categories = [
    { name: 'Blue Category (Work)', color: '#0078D4' },
    { name: 'Green Category (Personal)', color: '#107C41' },
    { name: 'Orange Category (Finance)', color: '#D83B01' },
    { name: 'Purple Category (Projects)', color: '#9333EA' },
    { name: 'Red Category (Urgent)', color: '#E81123' }
  ];

  return (
    <div className="bg-[#FAF9F8] dark:bg-[#1B1A19] border-b border-[#EDEBE9] dark:border-[#292827] flex flex-col text-[#323130] dark:text-[#E1DFDD] select-none text-[12.5px] z-30">
      {/* 1. Ribbon Tabs Header: Home | View | Help */}
      <div className="h-[30px] flex items-center justify-between px-3 border-b border-[#EDEBE9]/60 dark:border-[#292827]/60 text-[12px] bg-[#F5F5F5] dark:bg-[#181818]">
        <div className="flex items-center gap-1 sm:gap-2">
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
                    ? 'text-[#0078D4] dark:text-[#2899F5]'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {labels[tab]}
                {isActive && (
                  <span className="absolute bottom-[-1px] left-2 right-2 h-[2.5px] bg-[#0078D4] dark:bg-[#2899F5] rounded-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Right side of Tabs bar: Sync Status */}
        <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          <span className="hidden sm:inline flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#107C41]" />
            Exchange Connected
          </span>
        </div>
      </div>

      {/* 2. Ribbon Commands Bar */}
      {activeTab === 'home' && (
        <div className="h-[46px] flex items-center justify-between px-2 sm:px-3 overflow-x-auto scrollbar-none">
          {/* Left Actions Group */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            {/* The Ultra-Premium "New mail" Split Button */}
            <div className="relative flex items-center mr-1.5 sm:mr-2.5" ref={newMailRef}>
              <button
                type="button"
                onClick={() => openCompose()}
                className="flex items-center gap-1.5 bg-gradient-to-r from-[#0078D4] to-[#0F6CBD] hover:from-[#106EBE] hover:to-[#005A9E] active:scale-[0.98] text-white font-bold px-3.5 py-1.5 rounded-l-md text-[13px] transition cursor-pointer shadow-[0_1px_3px_rgba(0,120,212,0.35)]"
                title="Create new mail (Ctrl + N)"
              >
                <Plus className="w-4 h-4 stroke-[2.6]" />
                <span>New mail</span>
              </button>
              <button
                type="button"
                onClick={() => setNewMailDropdown((prev) => !prev)}
                className="bg-gradient-to-r from-[#0F6CBD] to-[#005A9E] hover:bg-[#005A9E] text-white px-2 py-1.5 rounded-r-md text-[13px] border-l border-white/25 transition cursor-pointer shadow-[0_1px_3px_rgba(0,120,212,0.35)]"
                title="More creation options"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {/* New Item Dropdown */}
              {newMailDropdown && (
                <div className="absolute top-[38px] left-0 w-52 bg-white dark:bg-[#201F1E] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => { setNewMailDropdown(false); openCompose(); }}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-[#0078D4]" />
                      <span className="font-semibold text-gray-800 dark:text-gray-200">Mail message</span>
                    </span>
                    <kbd className="text-[10px] text-gray-400 font-mono">Ctrl+N</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setNewMailDropdown(false); showToast('Calendar Event opened', 'info'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
                  >
                    <Calendar className="w-4 h-4 text-[#107C41]" />
                    <span>Calendar event</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setNewMailDropdown(false); showToast('To Do task created', 'info'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
                  >
                    <CheckSquare className="w-4 h-4 text-[#0078D4]" />
                    <span>To Do task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => { setNewMailDropdown(false); showToast('New contact modal opened', 'info'); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
                  >
                    <Users className="w-4 h-4 text-[#8764B8]" />
                    <span>Contact</span>
                  </button>
                </div>
              )}
            </div>

            {/* Vertical Divider */}
            <div className="h-5 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1 hidden sm:block" />

            {/* Action: Delete */}
            <button
              type="button"
              onClick={() => {
                if (selectedEmail) handleDeleteEmail(selectedEmail.id);
                else showToast('Select an email first', 'info');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
              title="Delete message (Delete key)"
            >
              <Trash2 className="w-4 h-4 text-[#D83B01]" />
              <span className="hidden sm:inline">Delete</span>
            </button>

            {/* Action: Archive */}
            <button
              type="button"
              onClick={() => {
                if (selectedEmail) handleArchiveEmail(selectedEmail.id);
                else showToast('Select an email first', 'info');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
              title="Archive message"
            >
              <Archive className="w-4 h-4 text-[#605E5C]" />
              <span className="hidden sm:inline">Archive</span>
            </button>

            {/* Action: Report / Junk */}
            <div className="relative" ref={reportRef}>
              <button
                type="button"
                onClick={() => setReportDropdown((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
                title="Report phishing or junk"
              >
                <ShieldAlert className="w-4 h-4 text-[#D83B01]" />
                <span className="hidden md:inline">Report</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>

              {reportDropdown && (
                <div className="absolute top-[36px] left-0 w-44 bg-white dark:bg-[#201F1E] rounded-lg shadow-xl border border-black/10 dark:border-white/10 py-1 z-50 animate-fadeIn text-[12px]">
                  <button
                    type="button"
                    onClick={() => {
                      setReportDropdown(false);
                      if (selectedEmail) handleDeleteEmail(selectedEmail.id);
                      showToast('Reported as Junk and sender blocked', 'info');
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Report Junk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReportDropdown(false);
                      if (selectedEmail) handleDeleteEmail(selectedEmail.id);
                      showToast('Reported as Phishing security alert', 'info');
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-red-600"
                  >
                    Report Phishing
                  </button>
                </div>
              )}
            </div>

            {/* Action: Sweep (Iconic Outlook Feature!) */}
            <button
              type="button"
              onClick={() => {
                if (selectedEmail?.sender?.email) {
                  handleSweepSender(selectedEmail.sender.email);
                } else showToast('Select an email to sweep all messages from sender', 'info');
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
              title="Sweep: Clean up all emails from this sender"
            >
              <Sparkles className="w-4 h-4 text-[#0078D4]" />
              <span className="hidden md:inline">Sweep</span>
            </button>

            {/* Vertical Divider */}
            <div className="h-5 w-[1px] bg-gray-200 dark:bg-gray-700 mx-1 hidden md:block" />

            {/* Action: Move To */}
            <div className="relative" ref={moveToRef}>
              <button
                type="button"
                onClick={() => setMoveToDropdown((prev) => !prev)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
              >
                <FolderInput className="w-4 h-4 text-[#605E5C]" />
                <span className="hidden lg:inline">Move to</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>
              {moveToDropdown && (
                <div className="absolute top-[36px] left-0 w-44 bg-white dark:bg-[#201F1E] rounded-lg shadow-xl border border-black/10 dark:border-white/10 py-1 z-50 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => { setMoveToDropdown(false); showToast('Moved to Archive', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-[12.5px]"
                  >
                    Archive
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMoveToDropdown(false); showToast('Moved to Junk Email', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-[12.5px]"
                  >
                    Junk Email
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMoveToDropdown(false); showToast('Moved to Deleted Items', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-[12.5px]"
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
                className="flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
              >
                <Tag className="w-4 h-4 text-[#0078D4]" />
                <span className="hidden lg:inline">Categorize</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>
              {categorizeDropdown && (
                <div className="absolute top-[36px] left-0 w-56 bg-white dark:bg-[#201F1E] rounded-xl shadow-xl border border-black/10 dark:border-white/10 p-2 z-50 animate-fadeIn">
                  <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1 px-2">
                    Color Categories
                  </div>
                  {categories.map((cat) => (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => {
                        setCategorizeDropdown(false);
                        showToast(`Applied ${cat.name}`, 'info');
                      }}
                      className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-left text-[12.5px]"
                    >
                      <span className="w-3.5 h-3.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
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
                className="flex items-center gap-1 px-2.5 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
              >
                <Clock className="w-4 h-4 text-[#605E5C]" />
                <span className="hidden xl:inline">Snooze</span>
                <ChevronDown className="w-3 h-3 text-gray-500" />
              </button>
              {snoozeDropdown && (
                <div className="absolute top-[36px] left-0 w-52 bg-white dark:bg-[#201F1E] rounded-xl shadow-xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn">
                  <button
                    type="button"
                    onClick={() => { setSnoozeDropdown(false); showToast('Snoozed until Later Today (6:00 PM)', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-[12.5px]"
                  >
                    Later today (6:00 PM)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSnoozeDropdown(false); showToast('Snoozed until Tomorrow (8:00 AM)', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-[12.5px]"
                  >
                    Tomorrow morning (8:00 AM)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSnoozeDropdown(false); showToast('Snoozed until Next Week', 'info'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-[12.5px]"
                  >
                    Next week (Monday 8:00 AM)
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
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
              title="Pin to top of folder"
            >
              <Pin className="w-4 h-4 text-[#0078D4]" />
              <span className="hidden xl:inline">Pin</span>
            </button>

            {/* Action: Mark all as read */}
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4 text-[#107C41]" />
              <span className="hidden xl:inline">Mark all read</span>
            </button>
          </div>

          {/* Right Actions Group */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Sync / Refresh */}
            <button
              type="button"
              onClick={handleRefresh}
              className={`p-1.5 hover:bg-[#F3F2F1] dark:hover:bg-[#252423] rounded transition cursor-pointer text-[#605E5C] dark:text-[#A19F9D] ${
                isRefreshing ? 'animate-spin text-[#0078D4]' : ''
              }`}
              title="Check for new messages"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Undo */}
            <button
              type="button"
              onClick={() => showToast('Nothing to undo', 'info')}
              className="p-1.5 hover:bg-[#F3F2F1] dark:hover:bg-[#252423] rounded transition cursor-pointer text-[#605E5C] dark:text-[#A19F9D]"
              title="Undo action (Ctrl + Z)"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={() => window.print()}
              className="p-1.5 hover:bg-[#F3F2F1] dark:hover:bg-[#252423] rounded transition cursor-pointer text-[#605E5C] dark:text-[#A19F9D]"
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
            <span className="font-bold text-gray-500 uppercase text-[11px]">Reading Pane:</span>
            <button
              type="button"
              onClick={() => showToast('Reading pane: Right side (Default)', 'info')}
              className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] rounded font-medium cursor-pointer"
            >
              Right
            </button>
            <button
              type="button"
              onClick={() => showToast('Reading pane: Bottom (Active)', 'info')}
              className="px-2.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
            >
              Bottom
            </button>
            <button
              type="button"
              onClick={() => showToast('Reading pane: Hidden', 'info')}
              className="px-2.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
            >
              Hide
            </button>

            <div className="h-4 w-[1px] bg-gray-200 dark:bg-gray-700 mx-2" />

            <span className="font-bold text-gray-500 uppercase text-[11px]">Density:</span>
            <button
              type="button"
              onClick={() => showToast('Density: Comfortable', 'info')}
              className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] rounded font-medium cursor-pointer"
            >
              Comfortable
            </button>
            <button
              type="button"
              onClick={() => showToast('Density: Compact', 'info')}
              className="px-2.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded cursor-pointer"
            >
              Compact
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
              onClick={() => showToast('Shortcuts: Ctrl+N (New mail), Ctrl+E (Search), Delete (Remove), Ctrl+Z (Undo)', 'info')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 font-medium cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-[#0078D4]" />
              <span>Keyboard Shortcuts</span>
            </button>
            <button
              type="button"
              onClick={() => showToast('Opening Tiwi 365 Help Center...', 'info')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 font-medium cursor-pointer"
            >
              <LifeBuoy className="w-4 h-4 text-[#107C41]" />
              <span>Help Center</span>
            </button>
            <button
              type="button"
              onClick={() => showToast('Tiwi Mail v2.4 Enterprise Edition', 'info')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 font-medium cursor-pointer"
            >
              <FileText className="w-4 h-4 text-gray-500" />
              <span>Version & Licenses</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
