import React, { useState } from 'react';
import {
  Mail,
  Calendar,
  Users,
  CheckSquare,
  HardDrive,
  Inbox,
  Send,
  FileEdit,
  Trash2,
  Archive,
  ShieldAlert,
  Bookmark,
  Flag,
  ChevronDown,
  ChevronRight,
  Plus,
  Tag,
  Folder,
  HardDriveDownload
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function OutlookSidebar() {
  const {
    activeFolder,
    navigateFolder,
    counts,
    activeCategoryFilter,
    setActiveCategoryFilter,
    showToast
  } = useEmail();

  const [activeRail, setActiveRail] = useState('mail');
  const [foldersOpen, setFoldersOpen] = useState(true);
  const [favoritesOpen, setFavoritesOpen] = useState(true);
  const [categoriesOpen, setCategoriesOpen] = useState(true);

  const railItems = [
    { id: 'mail', label: 'Mail', icon: Mail },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
    { id: 'people', label: 'People', icon: Users },
    { id: 'todo', label: 'To Do', icon: CheckSquare },
    { id: 'files', label: 'Files', icon: HardDrive }
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
    { name: 'Work', color: '#0078D4' },
    { name: 'Personal', color: '#107C41' },
    { name: 'Finance', color: '#D83B01' },
    { name: 'Projects', color: '#9333EA' }
  ];

  return (
    <div className="flex h-full select-none text-[12.5px] border-r border-[#EDEBE9] dark:border-[#292827] bg-[#F5F5F5] dark:bg-[#1E1E1E]">
      {/* 1. Outer Left Rail (Icon Column) */}
      <div className="w-[48px] bg-[#EAEAEA] dark:bg-[#181818] border-r border-[#E0E0E0] dark:border-[#262626] flex flex-col items-center py-2 gap-1 flex-shrink-0">
        {railItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeRail === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveRail(item.id);
                if (item.id !== 'mail') {
                  showToast(`${item.label} app view is ready`, 'info');
                }
              }}
              className={`relative w-[40px] h-[40px] rounded-md flex items-center justify-center transition cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-[#252526] text-[#0078D4] shadow-xs'
                  : 'text-[#605E5C] dark:text-[#A19F9D] hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              title={item.label}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#0078D4] rounded-r-md" />
              )}
              <Icon className="w-5 h-5 stroke-[1.8]" />
            </button>
          );
        })}
      </div>

      {/* 2. Inner Folders Tree */}
      <div className="w-[200px] xl:w-[220px] flex flex-col justify-between overflow-y-auto scrollbar-none py-2 px-1 text-[#323130] dark:text-[#E1DFDD]">
        <div className="flex flex-col gap-2">
          {/* Favorites Header & List */}
          <div>
            <button
              type="button"
              onClick={() => setFavoritesOpen((prev) => !prev)}
              className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white uppercase tracking-wider cursor-pointer"
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
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition cursor-pointer text-left ${
                        isActive
                          ? 'bg-[#E1DFDD]/70 dark:bg-[#333333] text-[#0078D4] font-semibold'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#323130] dark:text-[#D2D0CE]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0078D4]' : 'text-gray-500'}`} />
                        <span className="truncate">{f.label}</span>
                      </div>
                      {f.count > 0 && (
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                            f.countHighlight
                              ? 'bg-[#0078D4] text-white'
                              : 'text-gray-500 dark:text-gray-400'
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
              className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white uppercase tracking-wider cursor-pointer"
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
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition cursor-pointer text-left ${
                        isActive
                          ? 'bg-[#E1DFDD]/70 dark:bg-[#333333] text-[#0078D4] font-semibold'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#323130] dark:text-[#D2D0CE]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0078D4]' : 'text-gray-500'}`} />
                        <span className="truncate">{f.label}</span>
                      </div>
                      {f.count > 0 && (
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                            f.countHighlight
                              ? 'bg-[#0078D4] text-white'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {f.count}
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* + New Folder button */}
                <button
                  type="button"
                  onClick={() => showToast('New folder dialog', 'info')}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-gray-500 hover:text-[#0078D4] hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition cursor-pointer text-left mt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New folder</span>
                </button>
              </div>
            )}
          </div>

          {/* Categories Filter */}
          <div>
            <button
              type="button"
              onClick={() => setCategoriesOpen((prev) => !prev)}
              className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white uppercase tracking-wider cursor-pointer"
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
                      className={`flex items-center justify-between px-2.5 py-1.5 rounded-md transition cursor-pointer text-left ${
                        isSelected
                          ? 'bg-[#E1DFDD]/70 dark:bg-[#333333] text-[#0078D4] font-semibold'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-[#323130] dark:text-[#D2D0CE]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                        <span className="truncate">{cat.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Storage Quota Card */}
        <div className="p-2.5 mt-4 rounded-md bg-white dark:bg-[#252526] border border-[#EDEBE9] dark:border-[#2D2D2D] shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
            <span>Mail Storage</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">2.4 GB / 50 GB</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-[#0078D4] rounded-full w-[5%]" />
          </div>
        </div>
      </div>
    </div>
  );
}
