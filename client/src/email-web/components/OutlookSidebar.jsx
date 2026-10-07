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
  Flag,
  ChevronDown,
  ChevronRight,
  Plus
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function OutlookSidebar() {
  const {
    activeFolder,
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
    <div className="flex h-full select-none text-[12.5px] border-r border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#18181B]">
      {/* 1. Outer Left Rail (Icon Column) */}
      <div className="w-[48px] bg-slate-100/80 dark:bg-[#121214] border-r border-slate-200/80 dark:border-slate-800 flex flex-col items-center py-2.5 gap-1.5 flex-shrink-0">
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
                  showToast(`${item.label} is not connected to Tiwi Mail yet.`, 'info');
                }
              }}
              className={`relative w-[38px] h-[38px] rounded-lg flex items-center justify-center transition cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-800 text-[#0078D4] dark:text-[#38BDF8] shadow-xs font-semibold'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
              }`}
              title={item.label}
            >
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#0078D4] dark:bg-[#38BDF8] rounded-r-md" />
              )}
              <Icon className="w-5 h-5 stroke-[1.8]" />
            </button>
          );
        })}
      </div>

      {/* 2. Inner Folders Tree */}
      <div className="w-[210px] xl:w-[230px] flex flex-col justify-between overflow-y-auto scrollbar-none py-3 px-2.5 text-slate-700 dark:text-slate-200">
        <div className="flex flex-col gap-3">
          {/* Top Primary "New mail" Action in Sidebar (NO side arrow!) */}
          <div>
            <button
              type="button"
              onClick={() => openCompose()}
              className="w-full flex items-center justify-center gap-2 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-bold py-2 px-3 rounded-lg shadow-xs hover:shadow transition cursor-pointer"
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
              className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700"
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
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] dark:text-[#38BDF8] font-bold'
                          : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0078D4] dark:text-[#38BDF8]' : 'text-slate-400'}`} />
                        <span className="truncate">{f.label}</span>
                      </div>
                      {f.count > 0 && (
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                            f.countHighlight
                              ? 'bg-[#0078D4] text-white'
                              : 'text-slate-400'
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
              className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700"
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
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] dark:text-[#38BDF8] font-bold'
                          : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[#0078D4] dark:text-[#38BDF8]' : 'text-slate-400'}`} />
                        <span className="truncate">{f.label}</span>
                      </div>
                      {f.count > 0 && (
                        <span
                          className={`text-[11px] font-bold px-1.5 py-0.2 rounded-full ${
                            f.countHighlight
                              ? 'bg-[#0078D4] text-white'
                              : 'text-slate-400'
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
                  onClick={() => showToast('New folder dialog opened', 'info')}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-slate-400 hover:text-[#0078D4] hover:bg-slate-200/40 dark:hover:bg-slate-800/40 rounded-lg transition cursor-pointer text-left mt-0.5"
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
              className="w-full flex items-center gap-1.5 px-1.5 py-1 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700"
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
                          ? 'bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] dark:text-[#38BDF8] font-semibold'
                          : 'hover:bg-slate-200/50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
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

        {/* Bottom Storage Quota Card */}
        <div className="p-3 mt-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 shadow-xs">
          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
            <span className="font-semibold text-slate-700 dark:text-slate-300">Mailbox Storage</span>
            <span>1.2 GB / 15 GB</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-[#0078D4] rounded-full w-[8%]" />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
            <span>8% used</span>
            <span
              onClick={() => showToast('Tiwlo Cloud Storage', 'info')}
              className="text-[#0078D4] hover:underline cursor-pointer"
            >
              Manage
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
