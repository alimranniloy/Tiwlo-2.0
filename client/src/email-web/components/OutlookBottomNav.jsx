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
    showToast
  } = useEmail();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 h-[56px] bg-white dark:bg-[#1E1E1E] border-t border-[#EDEBE9] dark:border-[#292827] flex items-center justify-around px-2 z-40 select-none shadow-lg">
      <button
        type="button"
        onClick={() => {
          navigateFolder('inbox');
          setMobileView('list');
        }}
        className={`flex flex-col items-center justify-center flex-1 py-1 transition cursor-pointer relative ${
          activeFolder === 'inbox' ? 'text-[#0078D4]' : 'text-gray-500'
        }`}
      >
        <Mail className="w-5 h-5 stroke-[2]" />
        <span className="text-[10.5px] font-semibold mt-0.5">Mail</span>
        {counts.inboxUnread > 0 && (
          <span className="absolute top-1 right-[26%] bg-[#0078D4] text-white text-[9.5px] font-bold px-1.5 py-0.2 rounded-full">
            {counts.inboxUnread}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => showToast('Search active in header', 'info')}
        className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 transition cursor-pointer"
      >
        <Search className="w-5 h-5 stroke-[2]" />
        <span className="text-[10.5px] font-semibold mt-0.5">Search</span>
      </button>

      {/* Floating compose button in center on mobile */}
      <button
        type="button"
        onClick={() => openCompose()}
        className="w-11 h-11 rounded-full bg-[#0078D4] text-white flex items-center justify-center shadow-md active:scale-95 transition cursor-pointer -mt-5 ring-4 ring-white dark:ring-[#1E1E1E]"
        title="Compose Email"
      >
        <Plus className="w-6 h-6 stroke-[2.5]" />
      </button>

      <button
        type="button"
        onClick={() => showToast('Calendar view opened', 'info')}
        className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 transition cursor-pointer"
      >
        <Calendar className="w-5 h-5 stroke-[2]" />
        <span className="text-[10.5px] font-semibold mt-0.5">Calendar</span>
      </button>

      <button
        type="button"
        onClick={() => showToast('Contacts directory opened', 'info')}
        className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 transition cursor-pointer"
      >
        <Users className="w-5 h-5 stroke-[2]" />
        <span className="text-[10.5px] font-semibold mt-0.5">Contacts</span>
      </button>
    </div>
  );
}
