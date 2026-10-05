import React, { useState } from 'react';
import {
  Reply,
  ReplyAll,
  Forward,
  Trash2,
  Archive,
  ShieldCheck,
  Paperclip,
  Download,
  Printer,
  Send,
  ArrowLeft,
  Star,
  HardDrive,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function EmailReadingPane() {
  const {
    selectedEmail,
    setMobileView,
    handleDeleteEmail,
    handleArchiveEmail,
    handleToggleFlag,
    handleSendEmail,
    openCompose,
    showToast
  } = useEmail();

  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Smart Suggested Quick Replies
  const smartReplies = [
    'Thank you for the update!',
    'Received with thanks, looking into this now.',
    'Will get back to you shortly.'
  ];

  const handleQuickReplySubmit = async (e) => {
    if (e) e.preventDefault();
    if (!replyText.trim()) return;

    setIsReplying(true);
    const success = await handleSendEmail({
      to: selectedEmail.sender.email,
      subject: `Re: ${selectedEmail.subject}`,
      bodyHtml: `<p>${replyText.replace(/\n/g, '<br/>')}</p><br/><hr/><p style="color:#888; font-size:12px;">On ${selectedEmail.fullDate}, ${selectedEmail.sender.name} wrote:</p>${selectedEmail.bodyHtml}`,
      category: selectedEmail.category || 'Work'
    });

    if (success) {
      setReplyText('');
    }
    setIsReplying(false);
  };

  // If no email selected
  if (!selectedEmail) {
    return (
      <div className="flex-1 hidden md:flex flex-col items-center justify-center p-8 bg-slate-50/50 dark:bg-[#121214] text-slate-400 select-none">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] flex items-center justify-center mb-3">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="font-bold text-[16px] text-slate-800 dark:text-slate-100 mb-1">
          Select an item to read
        </h3>
        <p className="text-[12.5px] text-slate-500 max-w-[280px] text-center">
          Click any email from the message list to view its full conversation and attachments here
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#18181B] select-none text-[13px] min-w-0 overflow-y-auto pb-24 sm:pb-6">
      {/* 1. Reading Action Toolbar (Always Sticky & Fully Visible) */}
      <div className="p-2.5 sm:p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-xs z-20 shadow-xs">
        <div className="flex items-center gap-1.5">
          {/* Mobile Back button */}
          <button
            type="button"
            onClick={() => setMobileView('list')}
            className="md:hidden flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 font-semibold cursor-pointer"
            title="Back to messages"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-[12px]">Back</span>
          </button>

          {/* Reply */}
          <button
            type="button"
            onClick={() => openCompose({
              to: selectedEmail.sender?.email,
              subject: `Re: ${selectedEmail.subject}`,
              body: `<br/><br/><hr/><p style="color:#888;">On ${selectedEmail.fullDate}, ${selectedEmail.sender?.name} wrote:</p>${selectedEmail.bodyHtml}`
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] text-white font-bold transition cursor-pointer shadow-xs"
          >
            <Reply className="w-4 h-4" />
            <span>Reply</span>
          </button>

          {/* Reply All */}
          <button
            type="button"
            onClick={() => openCompose({
              to: selectedEmail.sender?.email,
              subject: `Re: ${selectedEmail.subject}`,
              body: `<br/><br/><hr/><p style="color:#888;">On ${selectedEmail.fullDate}, ${selectedEmail.sender?.name} wrote:</p>${selectedEmail.bodyHtml}`
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer hidden sm:flex"
          >
            <ReplyAll className="w-4 h-4 text-slate-400" />
            <span>Reply all</span>
          </button>

          {/* Forward */}
          <button
            type="button"
            onClick={() => openCompose({
              to: '',
              subject: `Fwd: ${selectedEmail.subject}`,
              body: `<br/><br/><hr/><p style="color:#888;">---------- Forwarded message ---------<br/>From: ${selectedEmail.sender?.name} &lt;${selectedEmail.sender?.email}&gt;<br/>Date: ${selectedEmail.fullDate}<br/>Subject: ${selectedEmail.subject}</p>${selectedEmail.bodyHtml}`
            })}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition cursor-pointer hidden sm:flex"
          >
            <Forward className="w-4 h-4 text-slate-400" />
            <span>Forward</span>
          </button>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700 mx-1 hidden sm:block" />

          {/* Delete */}
          <button
            type="button"
            onClick={() => {
              handleDeleteEmail(selectedEmail.id);
              setMobileView('list');
            }}
            className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 text-[#D83B01] transition cursor-pointer"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* Archive */}
          <button
            type="button"
            onClick={() => {
              handleArchiveEmail(selectedEmail.id);
              setMobileView('list');
            }}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
            title="Archive"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleToggleFlag(selectedEmail.id)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer"
            title="Flag message"
          >
            <Star className={`w-4 h-4 ${selectedEmail.isFlagged ? 'fill-[#D83B01] text-[#D83B01]' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition cursor-pointer hidden sm:block"
            title="Print message"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Message Body & Details */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col gap-4">
        {/* Subject Header */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[19px] sm:text-[22px] font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {selectedEmail.subject}
            </h1>
            {selectedEmail.category && (
              <span
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full text-white flex-shrink-0 shadow-xs"
                style={{ backgroundColor: selectedEmail.categoryColor || '#0078D4' }}
              >
                {selectedEmail.category}
              </span>
            )}
          </div>

          {/* Verified Security Banner */}
          <div className="flex items-center gap-2 p-2 px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-[11.5px] text-emerald-800 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">Security Verified:</span>
            <span>Sender DKIM & SPF authenticated • TLS 1.3 encrypted</span>
          </div>
        </div>

        {/* Sender Info Card */}
        <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 flex items-start justify-between gap-4 shadow-xs">
          <div className="flex items-start gap-3 min-w-0">
            {selectedEmail.sender?.avatar ? (
              <img
                src={selectedEmail.sender.avatar}
                alt={selectedEmail.sender.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/20 mt-0.5"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full ${selectedEmail.sender?.avatarColor || 'bg-[#0078D4]'} text-white font-bold text-[14px] flex items-center justify-center shadow-xs mt-0.5`}>
                {selectedEmail.sender?.initials || 'U'}
              </div>
            )}

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[15px] text-slate-900 dark:text-white">
                  {selectedEmail.sender?.name}
                </span>
                {selectedEmail.sender?.isVerified && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100/70 dark:bg-emerald-900/40 px-2 py-0.2 rounded-full">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Verified</span>
                  </span>
                )}
              </div>

              <span className="text-[12px] text-slate-500 truncate">
                &lt;{selectedEmail.sender?.email}&gt;
              </span>

              <div className="text-[11.5px] text-slate-600 dark:text-slate-400 mt-1">
                <span className="font-medium text-slate-400">To: </span>
                {selectedEmail.to && selectedEmail.to.map((r, i) => (
                  <span key={i} className="font-medium text-slate-700 dark:text-slate-300">
                    {r.name} &lt;{r.email}&gt;{i < selectedEmail.to.length - 1 ? '; ' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="text-right text-[11.5px] text-slate-400 whitespace-nowrap flex-shrink-0">
            {selectedEmail.fullDate}
          </div>
        </div>

        {/* Attachments Section */}
        {selectedEmail.hasAttachments && Array.isArray(selectedEmail.attachments) && selectedEmail.attachments.length > 0 && (
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#18181B] flex flex-col gap-2">
            <span className="text-[11.5px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              <span>{selectedEmail.attachments.length} Attachment(s)</span>
            </span>

            <div className="flex flex-wrap gap-2.5">
              {selectedEmail.attachments.map((att) => (
                <div
                  key={att.id || att.filename}
                  className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 hover:border-[#0078D4] transition group"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center font-bold text-[10px]">
                    PDF
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-semibold text-[12.5px] text-slate-800 dark:text-slate-200 truncate max-w-[180px]">
                      {att.filename}
                    </span>
                    <span className="text-[11px] text-slate-400">{att.size}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      type="button"
                      onClick={() => showToast(`Downloading ${att.filename}`, 'info')}
                      className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 transition cursor-pointer"
                      title="Download"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => showToast(`Saved to Cloud`, 'info')}
                      className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 transition cursor-pointer"
                      title="Save to Cloud"
                    >
                      <HardDrive className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Email HTML Body */}
        <div
          className="prose dark:prose-invert max-w-none text-[13.5px] text-slate-800 dark:text-slate-200 leading-relaxed py-2"
          dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
        />

        {/* 3. Smart Suggested Quick Replies */}
        <div className="flex flex-wrap gap-2 mt-4">
          {smartReplies.map((reply, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setReplyText(reply);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 hover:border-[#0078D4] hover:bg-blue-50/50 dark:hover:bg-blue-950/30 text-[12px] text-slate-700 dark:text-slate-300 transition cursor-pointer group"
            >
              <Sparkles className="w-3 h-3 text-[#0078D4] group-hover:scale-110 transition-transform" />
              <span>{reply}</span>
            </button>
          ))}
        </div>

        {/* 4. Inline Quick Reply Composer (Always visible with Send button) */}
        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <form
            onSubmit={handleQuickReplySubmit}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex flex-col gap-2.5 focus-within:ring-2 focus-within:ring-[#0078D4]/40 focus-within:border-[#0078D4] transition shadow-xs"
          >
            <div className="flex items-center gap-2 text-[12px] text-slate-600 font-semibold">
              <Reply className="w-3.5 h-3.5 text-[#0078D4]" />
              <span>Reply to {selectedEmail.sender?.name}...</span>
            </div>

            <textarea
              rows={3}
              placeholder="Type your reply here..."
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              className="w-full bg-transparent outline-none text-[13px] text-slate-900 dark:text-white placeholder-slate-400 resize-none leading-relaxed"
            />

            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Direct response
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openCompose({
                    to: selectedEmail.sender?.email,
                    subject: `Re: ${selectedEmail.subject}`,
                    body: replyText
                  })}
                  className="px-3 py-1.5 rounded-lg text-[12px] text-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition cursor-pointer font-medium"
                >
                  Pop out
                </button>
                <button
                  type="submit"
                  disabled={!replyText.trim() || isReplying}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] disabled:opacity-40 text-white text-[12.5px] font-bold shadow-xs transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isReplying ? 'Sending...' : 'Send'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
