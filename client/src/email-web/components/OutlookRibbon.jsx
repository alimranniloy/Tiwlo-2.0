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
  CheckSquare
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

  const [newMailDropdown, setNewMailDropdown] = useState(false);
  const [categorizeDropdown, setCategorizeDropdown] = useState(false);
  const [snoozeDropdown, setSnoozeDropdown] = useState(false);
  const [moveToDropdown, setMoveToDropdown] = useState(false);

  const newMailRef = useRef(null);
  const categorizeRef = useRef(null);
  const snoozeRef = useRef(null);
  const moveToRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (newMailRef.current && !newMailRef.current.contains(e.target)) setNewMailDropdown(false);
      if (categorizeRef.current && !categorizeRef.current.contains(e.target)) setCategorizeDropdown(false);
      if (snoozeRef.current && !snoozeRef.current.contains(e.target)) setSnoozeDropdown(false);
      if (moveToRef.current && !moveToRef.current.contains(e.target)) setMoveToDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const categories = [
    { name: 'Blue Category (Work)', color: '#0078D4' },
    { name: 'Green Category (Personal)', color: '#107C41' },
    { name: 'Orange Category (Finance)', color: '#D83B01' },
    { name: 'Purple Category (Projects)', color: '#9333EA' },
    { name: 'Red Category (Urgent)', color: '#E81123' }
  ];

  return (
    <div className="h-[44px] bg-[#FAF9F8] dark:bg-[#1B1A19] border-b border-[#EDEBE9] dark:border-[#292827] flex items-center justify-between px-2 sm:px-3 text-[#323130] dark:text-[#E1DFDD] select-none text-[12.5px] overflow-x-auto scrollbar-none z-30">
      {/* 1. Left: "New mail" Split Button & Core Actions */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* New Mail Primary Split Button */}
        <div className="relative flex items-center mr-1 sm:mr-2" ref={newMailRef}>
          <button
            type="button"
            onClick={() => openCompose()}
            className="flex items-center gap-1.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-semibold px-3 py-1.5 rounded-l-md text-[13px] transition cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New mail</span>
          </button>
          <button
            type="button"
            onClick={() => setNewMailDropdown((prev) => !prev)}
            className="bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white px-1.5 py-1.5 rounded-r-md text-[13px] border-l border-white/20 transition cursor-pointer"
            title="More creation options"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* New Item Dropdown */}
          {newMailDropdown && (
            <div className="absolute top-[38px] left-0 w-48 bg-white dark:bg-[#201F1E] rounded-md shadow-xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn">
              <button
                type="button"
                onClick={() => { setNewMailDropdown(false); openCompose(); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
              >
                <Mail className="w-4 h-4 text-[#0078D4]" />
                <span>Mail message</span>
              </button>
              <button
                type="button"
                onClick={() => { setNewMailDropdown(false); showToast('Calendar Event opened', 'info'); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-[#107C41]" />
                <span>Calendar event</span>
              </button>
              <button
                type="button"
                onClick={() => { setNewMailDropdown(false); showToast('To Do task created', 'info'); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 text-left cursor-pointer"
              >
                <CheckSquare className="w-4 h-4 text-[#0078D4]" />
                <span>To Do task</span>
              </button>
            </div>
          )}
        </div>

        {/* Action: Delete */}
        <button
          type="button"
          onClick={() => {
            if (selectedEmail) handleDeleteEmail(selectedEmail.id);
            else showToast('Select an email first', 'info');
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
          title="Archive message"
        >
          <Archive className="w-4 h-4 text-[#605E5C]" />
          <span className="hidden sm:inline">Archive</span>
        </button>

        {/* Action: Report / Junk */}
        <button
          type="button"
          onClick={() => {
            if (selectedEmail) {
              handleDeleteEmail(selectedEmail.id);
              showToast('Marked as Junk and blocked sender', 'info');
            } else showToast('Select an email first', 'info');
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
          title="Report phishing or junk"
        >
          <ShieldAlert className="w-4 h-4 text-[#D83B01]" />
          <span className="hidden md:inline">Report</span>
        </button>

        {/* Action: Sweep (Iconic Outlook Feature!) */}
        <button
          type="button"
          onClick={() => {
            if (selectedEmail?.sender?.email) {
              handleSweepSender(selectedEmail.sender.email);
            } else showToast('Select an email to sweep all messages from sender', 'info');
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
          title="Sweep: Clean up all emails from this sender"
        >
          <Sparkles className="w-4 h-4 text-[#0078D4]" />
          <span className="hidden md:inline">Sweep</span>
        </button>

        {/* Action: Move To */}
        <div className="relative" ref={moveToRef}>
          <button
            type="button"
            onClick={() => setMoveToDropdown((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
          >
            <FolderInput className="w-4 h-4 text-[#605E5C]" />
            <span className="hidden lg:inline">Move to</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
          {moveToDropdown && (
            <div className="absolute top-[34px] left-0 w-44 bg-white dark:bg-[#201F1E] rounded-md shadow-xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn">
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
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
          >
            <Tag className="w-4 h-4 text-[#0078D4]" />
            <span className="hidden lg:inline">Categorize</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
          {categorizeDropdown && (
            <div className="absolute top-[34px] left-0 w-56 bg-white dark:bg-[#201F1E] rounded-md shadow-xl border border-black/10 dark:border-white/10 p-2 z-50 animate-fadeIn">
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
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-sm text-left text-[12.5px]"
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
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
          >
            <Clock className="w-4 h-4 text-[#605E5C]" />
            <span className="hidden xl:inline">Snooze</span>
            <ChevronDown className="w-3 h-3 text-gray-500" />
          </button>
          {snoozeDropdown && (
            <div className="absolute top-[34px] left-0 w-52 bg-white dark:bg-[#201F1E] rounded-md shadow-xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn">
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
          title="Pin to top of folder"
        >
          <Pin className="w-4 h-4 text-[#0078D4]" />
          <span className="hidden xl:inline">Pin</span>
        </button>

        {/* Action: Mark all as read */}
        <button
          type="button"
          onClick={handleMarkAllAsRead}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#323130] dark:text-[#E1DFDD] transition cursor-pointer font-medium"
          title="Mark all as read"
        >
          <CheckCheck className="w-4 h-4 text-[#107C41]" />
          <span className="hidden xl:inline">Mark all read</span>
        </button>
      </div>

      {/* 2. Right: Undo, Print & More */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={() => showToast('Nothing to undo', 'info')}
          className="p-1.5 hover:bg-[#F3F2F1] dark:hover:bg-[#252423] rounded-sm transition cursor-pointer text-[#605E5C]"
          title="Undo action (Ctrl + Z)"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => window.print()}
          className="p-1.5 hover:bg-[#F3F2F1] dark:hover:bg-[#252423] rounded-sm transition cursor-pointer text-[#605E5C]"
          title="Print message"
        >
          <Printer className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
