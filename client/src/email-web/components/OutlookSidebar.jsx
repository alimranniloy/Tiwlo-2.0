import React, { useState } from 'react';
import {
  Mail,
  Inbox,
  Send,
  FileEdit,
  Trash2,
  Archive,
  ShieldAlert,
  Flag,
  ChevronDown,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function OutlookSidebar() {
  const {
    activeFolder,
    mailbox,
    navigateFolder,
    counts,
    activeCategoryFilter,
    setActiveCategoryFilter,
    openCompose,
    showToast
  } = useEmail();

  const [activeRail, setActiveRail] = useState('mail');
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  const railItems = [
    { id: 'mail', label: 'Mail', icon: Mail }
  ];

  const favoriteFolders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: counts.inboxUnread, countHighlight: true },
    { id: 'sent', label: 'Sent Items', icon: Send, count: counts.sentCount },
    { id: 'drafts', label: 'Drafts', icon: FileEdit, count: counts.draftsCount },
    { id: 'flagged', label: 'Flagged', icon: Flag, count: counts.flaggedCount }
  ];

  const mainFolders = [
    { id: 'inbox', label: 'Inbox', icon: Inbox, count: counts.inboxUnread, countHighlight: true },
    { id: 'junk', label: 'Junk Email', icon: ShieldAlert, count: counts.junkCount },
    { id: 'drafts', label: 'Drafts', icon: FileEdit, count: counts.draftsCount },
    { id: 'sent', label: 'Sent Items', icon: Send, count: counts.sentCount },
    { id: 'trash', label: 'Deleted Items', icon: Trash2, count: counts.trashCount },
    { id: 'archive', label: 'Archive', icon: Archive, count: counts.archiveCount }
  ];

  const categoryTags = [
    { name: 'Work', color: '#137333' },
    { name: 'Personal', color: '#107C41' }
  ];

  return (
    <div className="flex h-full select-none text-[12.5px] border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-[#181818]">
      {/* 1. Outer Left Rail (Icon Column) */}
      <div className="w-[48px] bg-neutral-100/80 dark:bg-[#121212] border-r border-neutral-200/80 dark:border-neutral-800 flex flex-col items-center py-2.5 gap-1.5 flex-shrink-0">
        {railItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRail === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveRail(item.id);
              }}
              className={`relative w-[38px] h-[38px] rounded-lg flex items-center justify-center transition cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-neutral-800 text-[#137333] dark:text-[#1ed760] shadow-xs font-semibold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60'
              }`}
              title={item.label}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#137333] dark:bg-[#1ed760] rounded-r-md" />
              )}
              <Icon className="w-5 h-5 stroke-[1.8]" />
            </button>
          );
        })}
      </div>

      {/* 2. Inner Folders Tree */}
      <div className="w-[210px] xl:w-[230px] flex flex-col justify-between overflow-y-auto scrollbar-none py-3 px-2.5 text-neutral-700 dark:text-neutral-200">
        <div className="flex flex-col gap-3">
          {/* Top Primary "New mail" Action in Sidebar (NO side arrow!) */}
          <div>
            <button
              type="button"
              onClick={() => openCompose()}
              className="w-full flex items-center justify-center gap-2 bg-[#137333] hover:bg-[#0f7a37] active:bg-[#115c31] text-white font-bold py-2 px-3 rounded-lg shadow-xs hover:shadow transition cursor-pointer"
              title="Compose New Mail (Ctrl + N)"
            >
              <Plus className="w-4 h-4 stroke-[2.8]" />
              <span className="text-[13px] tracking-tight">New mail</span>
            </button>
          </div>

          {/* Favorites Header & List */}
          <div>
            <button
              type="button"
              onClick={() => setFavoritesOpen((prev) => !prev)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-700"
            >
              {favoritesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Favorites</span>
            </button>

            {favoritesOpen && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {favoriteFolders.map((f) => {
                  const Icon = f.icon;
                  const isActive = activeFolder === f.id && !activeCategoryFilter;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setActiveCategoryFilter(null);
                        navigateFolder(f.id);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left ${
                        isActive
                          ? 'bg-neutral-50 dark:bg-neutral-950/40 text-[#137333] dark:text-[#1ed760] font-bold'
                          : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#137333] dark:text-[#1ed760]' : 'text-neutral-400'}`} />
                        <span className="truncate">{f.label}</span>
                      </div>
                      {f.count > 0 && (
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                            f.countHighlight
                              ? 'bg-[#137333] text-white'
                              : 'text-neutral-400'
                          }`}
                        >
                          {f.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Folders Header & Tree */}
          <div>
            <button
              type="button"
              onClick={() => setFoldersOpen((prev) => !prev)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-700"
            >
              {foldersOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Folders</span>
            </button>

            {foldersOpen && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {mainFolders.map((f) => {
                  const Icon = f.icon;
                  const isActive = activeFolder === f.id && !activeCategoryFilter;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setActiveCategoryFilter(null);
                        navigateFolder(f.id);
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left ${
                        isActive
                          ? 'bg-neutral-50 dark:bg-neutral-950/40 text-[#137333] dark:text-[#1ed760] font-bold'
                          : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#137333] dark:text-[#1ed760]' : 'text-neutral-400'}`} />
                        <span className="truncate">{f.label}</span>
                      </div>
                      {f.count > 0 && (
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                            f.countHighlight
                              ? 'bg-[#137333] text-white'
                              : 'text-neutral-400'
                          }`}
                        >
                          {f.count}
                        </span>
                      )}
                    </button>
                  );
                })}

              </div>
            )}
          </div>

          {/* Categories Filter */}
          <div>
            <button
              type="button"
              onClick={() => setCategoriesOpen((prev) => !prev)}
              className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider cursor-pointer hover:text-neutral-700"
            >
              {categoriesOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span>Categories</span>
            </button>

            {categoriesOpen && (
              <div className="flex flex-col gap-0.5 mt-0.5">
                {categoryTags.map((cat) => {
                  const isSelected = activeCategoryFilter === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      onClick={() => {
                        setActiveCategoryFilter(isSelected ? null : cat.name);
                        showToast(isSelected ? 'Cleared category filter' : `Filtering by ${cat.name}`, 'info');
                      }}
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-neutral-50 dark:bg-neutral-950/40 text-[#137333] dark:text-[#1ed760] font-semibold'
                          : 'hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="truncate">{cat.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active mailbox */}
        <div className="p-3 mt-4 rounded-xl bg-white dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 shadow-xs">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-neutral-400 mb-1">Signed in as</span>
          <span className="block truncate text-[11px] font-semibold text-neutral-700 dark:text-neutral-200">
            {mailbox?.address || 'Tiwlo Mail'}
          </span>
        </div>
      </div>
    </div>
  );
}
