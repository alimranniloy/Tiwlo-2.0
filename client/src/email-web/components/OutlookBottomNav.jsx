import React from 'react';
import { Mail, Search, Calendar, Users, Plus } from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function OutlookBottomNav() {
  const {
    counts,
    openCompose,
    navigateFolder,
    activeFolder,
    setMobileView,
    isComposeOpen,
    mobileView,
    showToast
  } = useEmail();

  // If currently composing on mobile, do not show bottom navigation bar so composer has full screen height
  if (isComposeOpen || mobileView === 'compose') {
    return null;
  }

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-[56px] bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-40 select-none shadow-lg">
      <button
        type="button"
        onClick={() => {
          navigateFolder('inbox');
          setMobileView('list');
        }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer relative ${
          activeFolder === 'inbox' && mobileView === 'list'
            ? 'text-[#0078D4] dark:text-[#38BDF8] font-bold'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <Mail className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] font-semibold mt-0.5">Mail</span>
        {counts.inboxUnread > 0 && (
          <span className="absolute top-1 right-[26%] bg-[#0078D4] text-white text-[9.5px] font-bold px-1.5 py-0.2 rounded-full">
            {counts.inboxUnread}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => showToast('Search active in top bar', 'info')}
        className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400 transition cursor-pointer"
      >
        <Search className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] font-semibold mt-0.5">Search</span>
      </button>

      {/* Floating compose button in center on mobile (No side arrow) */}
      <button
        type="button"
        onClick={() => openCompose()}
        className="w-12 h-12 rounded-full bg-[#0078D4] hover:bg-[#106EBE] active:scale-95 text-white flex items-center justify-center shadow-lg transition cursor-pointer -mt-5 ring-4 ring-white dark:ring-[#18181B]"
        title="Compose Email"
      >
        <Plus className="w-6 h-6 stroke-[2.8]" />
      </button>

      <button
        type="button"
        onClick={() => showToast('Calendar preview', 'info')}
        className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400 transition cursor-pointer"
      >
        <Calendar className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] font-semibold mt-0.5">Calendar</span>
      </button>

      <button
        type="button"
        onClick={() => showToast('Contacts directory', 'info')}
        className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 dark:text-slate-400 transition cursor-pointer"
      >
        <Users className="w-5 h-5 stroke-[2]" />
        <span className="text-[10px] font-semibold mt-0.5">Contacts</span>
      </button>
    </div>
  );
}
