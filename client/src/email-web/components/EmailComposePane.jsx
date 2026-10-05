import React, { useState } from 'react';
import {
  Send,
  Trash2,
  Paperclip,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  Smile,
  X,
  ArrowLeft,
  Lock,
  Tag,
  AlertCircle
} from 'lucide-react';
import { useEmail } from '../context/EmailContext';

export default function EmailComposePane() {
  const {
    closeCompose,
    composeData,
    setComposeData,
    handleSendEmail,
    setMobileView,
    showToast
  } = useEmail();

  const [showCc, setShowCc] = useState(!!composeData.cc);
  const [showBcc, setShowBcc] = useState(!!composeData.bcc);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importance, setImportance] = useState('normal'); // 'normal', 'high', 'low'

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!composeData.to.trim()) {
      showToast('Please specify at least one recipient in the To field.', 'error');
      return;
    }
    if (!composeData.subject.trim()) {
      showToast('Please enter a subject line for your message.', 'error');
      return;
    }

    setIsSubmitting(true);
    const success = await handleSendEmail({
      to: composeData.to.trim(),
      subject: composeData.subject.trim(),
      bodyHtml: `<p>${(composeData.body || '').replace(/\n/g, '<br/>')}</p>`,
      attachments: composeData.attachments || [],
      category: importance === 'high' ? 'Urgent' : 'Work'
    });
    setIsSubmitting(false);
  };

  const handleAttachMock = () => {
    const mockFile = {
      id: `att_${Date.now()}`,
      filename: 'Document_Attachment.pdf',
      size: '1.4 MB',
      type: 'pdf'
    };
    setComposeData((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), mockFile]
    }));
    showToast('Attached Document_Attachment.pdf', 'info');
  };

  const handleRemoveAttachment = (id) => {
    setComposeData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((a) => a.id !== id)
    }));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#18181B] select-none text-[13px] min-w-0 overflow-y-auto">
      {/* 1. Compose Header Toolbar (Always Sticky & Fully Visible) */}
      <div className="p-2.5 sm:p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between sticky top-0 bg-white/95 dark:bg-[#18181B]/95 backdrop-blur-xs z-30 shadow-xs">
        <div className="flex items-center gap-2">
          {/* Mobile Back button */}
          <button
            type="button"
            onClick={closeCompose}
            className="md:hidden flex items-center gap-1 p-1.5 rounded-lg hover:bg-slate-100 text-slate-700 dark:text-slate-300 cursor-pointer"
            title="Back to messages"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Primary Send Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] disabled:opacity-40 text-white font-bold px-4 py-1.5 rounded-lg text-[13px] transition cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Sending...' : 'Send'}</span>
          </button>

          {/* Discard */}
          <button
            type="button"
            onClick={closeCompose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition cursor-pointer"
            title="Discard draft"
          >
            <Trash2 className="w-4 h-4 text-[#D83B01]" />
            <span className="hidden sm:inline">Discard</span>
          </button>

          {/* Attach */}
          <button
            type="button"
            onClick={handleAttachMock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium transition cursor-pointer"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">Attach</span>
          </button>

          {/* Encrypt Indicator */}
          <span className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-[11.5px] font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Encrypted</span>
          </span>
        </div>

        <button
          type="button"
          onClick={closeCompose}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 cursor-pointer"
          title="Close composer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Recipient Fields (To, Cc, Bcc, Subject) */}
      <div className="p-4 sm:p-5 flex flex-col gap-2.5 border-b border-slate-200 dark:border-slate-800">
        {/* To field */}
        <div className="flex items-center gap-2">
          <label className="w-14 text-right text-slate-500 font-semibold text-[13px]">
            To
          </label>
          <div className="flex-1 flex items-center border-b border-slate-200 dark:border-slate-700 focus-within:border-[#0078D4] py-1">
            <input
              type="text"
              placeholder="Enter email addresses or contacts..."
              value={composeData.to}
              onChange={(e) => setComposeData((prev) => ({ ...prev, to: e.target.value }))}
              className="w-full bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400 text-[13.5px]"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="hover:text-[#0078D4] cursor-pointer"
              >
                Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                onClick={() => setShowBcc(true)}
                className="hover:text-[#0078D4] cursor-pointer"
              >
                Bcc
              </button>
            )}
          </div>
        </div>

        {/* Cc field */}
        {showCc && (
          <div className="flex items-center gap-2">
            <label className="w-14 text-right text-slate-500 font-semibold text-[13px]">
              Cc
            </label>
            <div className="flex-1 flex items-center border-b border-slate-200 dark:border-slate-700 focus-within:border-[#0078D4] py-1">
              <input
                type="text"
                placeholder="Cc recipients..."
                value={composeData.cc}
                onChange={(e) => setComposeData((prev) => ({ ...prev, cc: e.target.value }))}
                className="w-full bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400 text-[13.5px]"
              />
            </div>
          </div>
        )}

        {/* Bcc field */}
        {showBcc && (
          <div className="flex items-center gap-2">
            <label className="w-14 text-right text-slate-500 font-semibold text-[13px]">
              Bcc
            </label>
            <div className="flex-1 flex items-center border-b border-slate-200 dark:border-slate-700 focus-within:border-[#0078D4] py-1">
              <input
                type="text"
                placeholder="Bcc recipients..."
                value={composeData.bcc}
                onChange={(e) => setComposeData((prev) => ({ ...prev, bcc: e.target.value }))}
                className="w-full bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400 text-[13.5px]"
              />
            </div>
          </div>
        )}

        {/* Subject field */}
        <div className="flex items-center gap-2">
          <label className="w-14 text-right text-slate-500 font-semibold text-[13px]">
            Subject
          </label>
          <div className="flex-1 flex items-center border-b border-slate-200 dark:border-slate-700 focus-within:border-[#0078D4] py-1">
            <input
              type="text"
              placeholder="Add a subject line"
              value={composeData.subject}
              onChange={(e) => setComposeData((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full bg-transparent outline-none font-semibold text-slate-900 dark:text-white placeholder-slate-400 text-[14px]"
            />
          </div>
        </div>

        {/* Attached files pills */}
        {composeData.attachments && composeData.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 pl-16">
            {composeData.attachments.map((att) => (
              <span
                key={att.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-[#0078D4] dark:text-[#38BDF8] text-[12px] font-medium border border-blue-200 dark:border-blue-800"
              >
                <Paperclip className="w-3.5 h-3.5" />
                <span>{att.filename}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="hover:text-red-500 cursor-pointer ml-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 3. Text Formatting Toolbar */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-1 bg-slate-50/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => showToast('Format: Bold', 'info')}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer font-bold"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Format: Italic', 'info')}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer italic"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Format: Underline', 'info')}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer underline"
          title="Underline"
        >
          <Underline className="w-4 h-4" />
        </button>

        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => showToast('List: Bullets', 'info')}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          title="Bulleted list"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('List: Numbered', 'info')}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <span className="w-px h-4 bg-slate-200 dark:bg-slate-700 mx-1" />

        <button
          type="button"
          onClick={() => showToast('Insert link', 'info')}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          title="Insert hyperlink"
        >
          <Link className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Insert emoji', 'info')}
          className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          title="Insert emoji"
        >
          <Smile className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Message Content Body Textarea */}
      <div className="flex-1 p-5 min-h-[220px]">
        <textarea
          rows={12}
          placeholder="Write your email here..."
          value={composeData.body}
          onChange={(e) => setComposeData((prev) => ({ ...prev, body: e.target.value }))}
          className="w-full h-full bg-transparent outline-none text-slate-900 dark:text-white placeholder-slate-400 text-[14px] leading-relaxed resize-none"
        />
      </div>

      {/* 5. Bottom Send Bar (Always Sticky at Bottom) */}
      <div className="sticky bottom-0 p-3 sm:p-3.5 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#18181B] z-30 shadow-lg">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] disabled:opacity-40 text-white font-bold px-5 py-2 rounded-lg text-[13px] transition cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Sending...' : 'Send'}</span>
          </button>
          <button
            type="button"
            onClick={closeCompose}
            className="px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-[13px] font-medium transition cursor-pointer"
          >
            Discard
          </button>
        </div>

        <span className="text-[12px] text-slate-400">
          Saved as draft
        </span>
      </div>
    </div>
  );
}
