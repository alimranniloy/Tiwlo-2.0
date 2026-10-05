import React, { useState } from 'react';
import {
  SlidersHorizontal,
  Paperclip,
  Flag,
  Pin,
  Trash2,
  Mail,
  MailOpen,
  CheckSquare,
  Square,
  AlertCircle,
  Inbox,
  Sparkles,
  Search,
  Filter
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
    selectedIds,
    setSelectedIds,
    activeFolder,
    activeCategoryFilter,
    handleToggleFlag,
    handleToggleRead,
    handleTogglePin,
    handleDeleteEmail,
    showToast
  } = useEmail();

  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [quickFilter, setQuickFilter] = useState('all'); // 'all', 'unread', 'flagged', 'attachments'

  const toggleSelectOne = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === emails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((m) => m.id)));
    }
  };

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
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#201F1E] border-r border-[#EDEBE9] dark:border-[#292827] select-none text-[12.5px] min-w-0">
      {/* 1. Header: Folder Title & Focused / Other Switcher */}
      <div className="p-3 border-b border-[#EDEBE9] dark:border-[#292827] flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-bold text-[#201F1E] dark:text-[#F3F2F1] tracking-tight">
              {folderTitle}
            </h2>
            {activeCategoryFilter && (
              <span className="text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                {activeCategoryFilter}
              </span>
            )}
          </div>

          {/* Filter Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setFilterMenuOpen((prev) => !prev)}
              className="flex items-center gap-1 px-2 py-1 text-gray-500 hover:text-gray-900 dark:hover:text-white rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer text-[12px] font-medium"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filter</span>
            </button>

            {filterMenuOpen && (
              <div className="absolute right-0 top-[28px] w-48 bg-white dark:bg-[#252423] rounded-xl shadow-2xl border border-black/10 dark:border-white/10 py-1.5 z-50 animate-fadeIn text-[12px]">
                <button
                  type="button"
                  onClick={() => { setQuickFilter('all'); setFilterMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  All messages
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickFilter('unread'); setFilterMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Unread mail
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickFilter('flagged'); setFilterMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Flagged
                </button>
                <button
                  type="button"
                  onClick={() => { setQuickFilter('attachments'); setFilterMenuOpen(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
                >
                  Has attachments
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Outlook Signature "Focused" vs "Other" Tabs */}
        {activeFolder === 'inbox' && (
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-1">
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={() => setActiveTab('focused')}
                className={`font-bold text-[13px] pb-1.5 relative transition cursor-pointer ${
                  activeTab === 'focused'
                    ? 'text-[#0078D4] dark:text-[#2899F5]'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Focused
                {activeTab === 'focused' && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-[#0078D4] dark:bg-[#2899F5] rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('other')}
                className={`font-bold text-[13px] pb-1.5 relative transition cursor-pointer ${
                  activeTab === 'other'
                    ? 'text-[#0078D4] dark:text-[#2899F5]'
                    : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                Other
                {activeTab === 'other' && (
                  <span className="absolute bottom-[-1px] left-0 right-0 h-[2.5px] bg-[#0078D4] dark:bg-[#2899F5] rounded-full" />
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
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition cursor-pointer ${
                    quickFilter === chip.id
                      ? 'bg-[#0078D4] text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Select All Subheader Bar */}
      <div className="px-3 py-1.5 bg-[#FAF9F8] dark:bg-[#1B1A19] border-b border-[#EDEBE9] dark:border-[#292827] flex items-center justify-between text-gray-500 text-[11.5px]">
        <button
          type="button"
          onClick={toggleSelectAll}
          className="flex items-center gap-2 hover:text-gray-900 dark:hover:text-white cursor-pointer font-medium"
        >
          {selectedIds.size > 0 && selectedIds.size === displayedEmails.length ? (
            <CheckSquare className="w-3.5 h-3.5 text-[#0078D4]" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          <span>{selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}</span>
        </button>

        <span>{displayedEmails.length} items</span>
      </div>

      {/* 3. Scrollable List of Messages */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#F3F2F1] dark:divide-[#252423]">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="w-6 h-6 border-2 border-[#0078D4] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : displayedEmails.length === 0 ? (
          <div className="p-10 text-center flex flex-col items-center justify-center text-gray-400 gap-2.5">
            <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-[#0078D4]">
              <Inbox className="w-7 h-7 stroke-[1.8]" />
            </div>
            <h4 className="font-bold text-[14px] text-gray-800 dark:text-gray-200">All caught up!</h4>
            <p className="text-[12px] text-gray-500 max-w-[220px]">
              No messages found matching your active filter criteria
            </p>
          </div>
        ) : (
          displayedEmails.map((mail) => {
            const isSelected = selectedEmail?.id === mail.id;
            const isChecked = selectedIds.has(mail.id);

            return (
              <div
                key={mail.id}
                onClick={() => openEmail(mail)}
                className={`relative group p-3 cursor-pointer transition flex gap-3 text-left ${
                  isSelected
                    ? 'bg-[#EFF6FC] dark:bg-[#10233F]'
                    : isChecked
                    ? 'bg-[#F3F2F1] dark:bg-[#252423]'
                    : mail.isUnread
                    ? 'bg-white dark:bg-[#201F1E] font-medium'
                    : 'bg-white dark:bg-[#201F1E] hover:bg-[#F8F7F6] dark:hover:bg-[#252423]'
                }`}
              >
                {/* Unread Accent Pill */}
                {mail.isUnread && (
                  <span className="absolute left-0 top-3 bottom-3 w-1 bg-[#0078D4] rounded-r-md" />
                )}

                {/* Avatar with Initials or Photo */}
                <div
                  onClick={(e) => toggleSelectOne(mail.id, e)}
                  className="relative flex-shrink-0 cursor-pointer pt-0.5"
                >
                  {/* Select Checkbox on hover */}
                  <div className={`absolute -left-1 -top-1 w-5 h-5 rounded bg-white dark:bg-[#201F1E] shadow-sm flex items-center justify-center z-10 transition-opacity ${
                    isChecked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                  }`}>
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-[#0078D4]" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400" />
                    )}
                  </div>

                  {mail.sender?.avatar ? (
                    <img
                      src={mail.sender.avatar}
                      alt={mail.sender.name}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className={`w-8 h-8 rounded-full ${mail.sender?.avatarColor || 'bg-[#0078D4]'} text-white font-bold text-[12px] flex items-center justify-center shadow-xs`}>
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
                        ? 'font-bold text-[#201F1E] dark:text-white'
                        : 'font-semibold text-[#323130] dark:text-[#E1DFDD]'
                    }`}>
                      {mail.sender?.name}
                    </span>
                    <span className={`text-[11px] whitespace-nowrap ml-2 ${
                      mail.isUnread ? 'text-[#0078D4] font-bold' : 'text-gray-400'
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
                        ? 'font-bold text-[#201F1E] dark:text-white'
                        : 'text-[#484644] dark:text-[#D2D0CE]'
                    }`}>
                      {mail.subject}
                    </h3>
                  </div>

                  {/* Row 3: Snippet Body */}
                  <p className="text-[12px] text-[#605E5C] dark:text-[#A19F9D] line-clamp-2 leading-relaxed">
                    {mail.preview}
                  </p>

                  {/* Row 4: Badges (Attachment, Category) */}
                  <div className="flex items-center gap-2 mt-1.5">
                    {mail.hasAttachments && (
                      <span className="flex items-center gap-1 text-[11px] text-gray-500 font-medium">
                        <Paperclip className="w-3 h-3 text-gray-400" />
                        <span>Attachment</span>
                      </span>
                    )}
                    {mail.category && (
                      <span
                        className="text-[10.5px] font-semibold px-1.5 py-0.2 rounded-sm text-white"
                        style={{ backgroundColor: mail.categoryColor || '#0078D4' }}
                      >
                        {mail.category}
                      </span>
                    )}
                  </div>
                </div>

                {/* 4. Outlook Signature Hover Micro-Actions */}
                <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1 bg-white/95 dark:bg-[#201F1E]/95 p-1 rounded-md shadow-md border border-black/5 dark:border-white/10 z-20">
                  <button
                    type="button"
                    onClick={(e) => handleDeleteEmail(mail.id, e)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-[#D83B01] transition"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleToggleRead(mail.id, !mail.isUnread, e)}
                    className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 transition"
                    title={mail.isUnread ? 'Mark as read' : 'Mark as unread'}
                  >
                    {mail.isUnread ? <MailOpen className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleToggleFlag(mail.id, e)}
                    className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition ${
                      mail.isFlagged ? 'text-[#D83B01]' : 'text-gray-400'
                    }`}
                    title="Flag message"
                  >
                    <Flag className={`w-3.5 h-3.5 ${mail.isFlagged ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleTogglePin(mail.id, e)}
                    className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition ${
                      mail.isPinned ? 'text-[#0078D4]' : 'text-gray-400'
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
