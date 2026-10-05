import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Paperclip,
  Flag,
  Pin,
  Trash2,
  Mail,
  MailOpen,
  Inbox,
  Sparkles,
  Archive
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function EmailListPane() {
  const {
    emails,
    loading,
    activeTab,
    setActiveTab,
    selectedEmail,
    openEmail,
    activeFolder,
    activeCategoryFilter,
    handleToggleFlag,
    handleToggleRead,
    handleTogglePin,
    handleDeleteEmail,
    handleArchiveEmail,
    showToast
  } = useEmail();

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'unread', 'flagged', 'attachments'

  // Filter messages based on activeFolder, activeTab, and quickFilter
  const displayedEmails = emails.filter((mail) => {
    if (quickFilter === 'unread' && !mail.isUnread) return false;
    if (quickFilter === 'flagged' && !mail.isFlagged) return false;
    if (quickFilter === 'attachments' && !mail.hasAttachments) return false;
    return true;
  });

  const folderTitle =
    activeFolder === 'inbox' ? 'Inbox' :
    activeFolder === 'sent' ? 'Sent Items' :
    activeFolder === 'drafts' ? 'Drafts' :
    activeFolder === 'junk' ? 'Junk Email' :
    activeFolder === 'trash' ? 'Deleted Items' :
    activeFolder === 'archive' ? 'Archive' :
    activeFolder === 'flagged' ? 'Flagged' : activeFolder;

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#18181B] border-r border-slate-200 dark:border-slate-800 select-none text-[12.5px] min-w-0">
      {/* 1. Header: Folder Title & Focused / Other Switcher */}
      <div className="p-3 border-b border-slate-200/80 dark:border-slate-800 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              {folderTitle}
            </h2>
            {activeCategoryFilter && (
              <span className="text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] dark:text-[#38BDF8] px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                {activeCategoryFilter}
              </span>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterMenuOpen((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer text-[12px] font-medium"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterMenuOpen && (
              <div className="absolute right-0 top-[28px] w-44 bg-white dark:bg-[#201F1E] rounded-xl shadow-xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn text-[12px]">
                <button
                  type="button"
                  onClick={() => { setQuickFilter('all'); setFilterMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  All messages
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickFilter('unread'); setFilterMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Unread mail
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickFilter('flagged'); setFilterMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Flagged
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickFilter('attachments'); setFilterMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Has attachments
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Focused vs Other Tabs */}
        {activeFolder === 'inbox' && (
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-1">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('focused')}
                className={`font-bold text-[13px] pb-1.5 relative transition cursor-pointer ${
                  activeTab === 'focused'
                    ? 'text-[#0078D4] dark:text-[#38BDF8]'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                Focused
                {activeTab === 'focused' && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-[#0078D4] dark:bg-[#38BDF8] rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('other')}
                className={`font-bold text-[13px] pb-1.5 relative transition cursor-pointer ${
                  activeTab === 'other'
                    ? 'text-[#0078D4] dark:text-[#38BDF8]'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
                }`}
              >
                Other
                {activeTab === 'other' && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-[#0078D4] dark:bg-[#38BDF8] rounded-full" />
                )}
              </button>
            </div>

            {/* Quick Filter Badges */}
            <div className="flex items-center gap-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread' },
                { id: 'flagged', label: 'Flagged' }
              ].map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setQuickFilter(chip.id)}
                  className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full transition cursor-pointer ${
                    quickFilter === chip.id
                      ? 'bg-[#0078D4] text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Messages Count Bar */}
      <div className="px-3 py-1.5 bg-slate-50/70 dark:bg-[#151518] border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-slate-500 text-[11.5px]">
        <span className="font-medium text-slate-600 dark:text-slate-400">
          Showing {displayedEmails.length} message{displayedEmails.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={() => showToast('Sorting: Newest on top', 'info')}
          className="hover:text-slate-800 dark:hover:text-white cursor-pointer font-medium"
        >
          Sort: Newest
        </button>
      </div>

      {/* 3. Scrollable List of Messages */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-6 h-6 border-2 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedEmails.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center text-slate-400 gap-2.5">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-[#0078D4]">
              <Inbox className="w-7 h-7 stroke-[1.8]" />
            </div>
            <h4 className="font-bold text-[14px] text-slate-800 dark:text-slate-200">All caught up</h4>
            <p className="text-[12px] text-slate-500 max-w-[220px]">
              No messages found matching your filter
            </p>
          </div>
        ) : (
          displayedEmails.map((mail) => {
            const isSelected = selectedEmail?.id === mail.id;

            return (
              <div
                key={mail.id}
                onClick={() => openEmail(mail)}
                className={`relative group p-3 cursor-pointer transition flex gap-3 text-left ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : mail.isUnread
                    ? 'bg-white dark:bg-[#18181B] font-medium'
                    : 'bg-white dark:bg-[#18181B] hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                {/* Unread Accent Pill */}
                {mail.isUnread && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-[#0078D4] rounded-r-md" />
                )}

                {/* Sender Avatar: Clean Circle with NO overlapping hover ticks! */}
                <div className="relative flex-shrink-0 pt-0.5">
                  {mail.sender?.avatar ? (
                    <img
                      src={mail.sender.avatar}
                      alt={mail.sender.name}
                      className="w-9 h-9 rounded-full object-cover ring-1 ring-black/5"
                    />
                  ) : (
                    <div className={`w-9 h-9 rounded-full ${mail.sender?.avatarColor || 'bg-[#0078D4]'} text-white font-bold text-[12px] flex items-center justify-center shadow-xs`}>
                      {mail.sender?.initials || 'U'}
                    </div>
                  )}
                </div>

                {/* Message Content Preview */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Sender Name & Date */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`text-[13px] truncate ${
                      mail.isUnread
                        ? 'font-bold text-slate-900 dark:text-white'
                        : 'font-semibold text-slate-700 dark:text-slate-200'
                    }`}>
                      {mail.sender?.name}
                    </span>
                    <span className={`text-[11px] whitespace-nowrap ml-2 ${
                      mail.isUnread ? 'text-[#0078D4] dark:text-[#38BDF8] font-bold' : 'text-slate-400'
                    }`}>
                      {mail.date}
                    </span>
                  </div>

                  {/* Row 2: Subject */}
                  <div className="flex items-center gap-1.5 mb-1">
                    {mail.isPinned && (
                      <Pin className="w-3 h-3 text-[#0078D4] fill-current flex-shrink-0" />
                    )}
                    <h3 className={`text-[12.5px] truncate ${
                      mail.isUnread
                        ? 'font-bold text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}>
                      {mail.subject}
                    </h3>
                  </div>

                  {/* Row 3: Snippet Body */}
                  <p className="text-[12px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {mail.preview}
                  </p>

                  {/* Row 4: Badges (Attachment, Category) */}
                  <div className="flex items-center gap-2 mt-1.5">
                    {mail.hasAttachments && (
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                        <Paperclip className="w-3 h-3 text-slate-400" />
                        <span>Attachment</span>
                      </span>
                    )}
                    {mail.category && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: mail.categoryColor || '#0078D4' }}
                      >
                        {mail.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* 4. Hover Micro-Actions Toolbar */}
                <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 bg-white/95 dark:bg-[#201F1E]/95 p-1 rounded-lg shadow-md border border-slate-200 dark:border-slate-700 z-20">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteEmail(mail.id, e)}
                    className="p-1 rounded-md hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-[#D83B01] transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleArchiveEmail(mail.id, e)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 transition"
                    title="Archive"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleToggleRead(mail.id, !mail.isUnread, e)}
                    className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 transition"
                    title={mail.isUnread ? 'Mark as read' : 'Mark as unread'}
                  >
                    {mail.isUnread ? <MailOpen className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleToggleFlag(mail.id, e)}
                    className={`p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
                      mail.isFlagged ? 'text-[#D83B01]' : 'text-slate-400'
                    }`}
                    title="Flag message"
                  >
                    <Flag className={`w-3.5 h-3.5 ${mail.isFlagged ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleTogglePin(mail.id, e)}
                    className={`p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition ${
                      mail.isPinned ? 'text-[#0078D4]' : 'text-slate-400'
                    }`}
                    title="Pin to top"
                  >
                    <Pin className={`w-3.5 h-3.5 ${mail.isPinned ? 'fill-current' : ''}`} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
