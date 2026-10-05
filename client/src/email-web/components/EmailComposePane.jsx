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
      filename: 'Project_Specification_Summary.pdf',
      size: '1.8 MB',
      type: 'pdf'
    };
    setComposeData((prev) => ({
      ...prev,
      attachments: [...(prev.attachments || []), mockFile]
    }));
    showToast('Attached Project_Specification_Summary.pdf', 'info');
  };

  const handleRemoveAttachment = (id) => {
    setComposeData((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((a) => a.id !== id)
    }));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-[#201F1E] select-none text-[13px] min-w-0 overflow-y-auto">
      {/* 1. Compose Ribbon Toolbar */}
      <div className="p-2.5 sm:p-3 border-b border-[#EDEBE9] dark:border-[#292827] flex items-center justify-between sticky top-0 bg-white dark:bg-[#201F1E] z-20">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={closeCompose}
            className="md:hidden p-1.5 rounded-sm hover:bg-gray-100 text-gray-700 dark:text-gray-300 mr-1 cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* Primary Send Button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] disabled:opacity-40 text-white font-bold px-4 py-1.5 rounded text-[13px] transition cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Sending...' : 'Send'}</span>
          </button>

          {/* Discard */}
          <button
            type="button"
            onClick={closeCompose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-gray-700 dark:text-gray-300 font-medium transition cursor-pointer"
            title="Discard draft"
          >
            <Trash2 className="w-4 h-4 text-[#D83B01]" />
            <span className="hidden sm:inline">Discard</span>
          </button>

          {/* Attach */}
          <button
            type="button"
            onClick={handleAttachMock}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-gray-700 dark:text-gray-300 font-medium transition cursor-pointer"
            title="Attach file"
          >
            <Paperclip className="w-4 h-4 text-gray-500" />
            <span className="hidden sm:inline">Attach</span>
          </button>

          {/* Encrypt Indicator */}
          <button
            type="button"
            onClick={() => showToast('Tiwlo Cryptographic End-to-End Encryption is active', 'info')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-[#F3F2F1] dark:hover:bg-[#252423] text-[#107C41] font-medium transition cursor-pointer hidden md:flex"
            title="Encryption: Active"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Encrypted</span>
          </button>
        </div>

        <button
          type="button"
          onClick={closeCompose}
          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 cursor-pointer"
          title="Close composer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Recipient Fields (To, Cc, Bcc, Subject) */}
      <div className="p-4 sm:p-5 flex flex-col gap-2.5 border-b border-[#EDEBE9] dark:border-[#292827]">
        {/* To field */}
        <div className="flex items-center gap-2">
          <label className="w-14 text-right text-gray-500 font-semibold text-[13px]">
            To
          </label>
          <div className="flex-1 flex items-center border-b border-gray-200 dark:border-gray-700 focus-within:border-[#0078D4] py-1">
            <input
              type="text"
              placeholder="Enter email addresses or contacts..."
              value={composeData.to}
              onChange={(e) => setComposeData((prev) => ({ ...prev, to: e.target.value }))}
              className="w-full bg-transparent outline-none text-[#201F1E] dark:text-white placeholder-gray-400 text-[13px]"
            />
          </div>
          <div className="flex items-center gap-1.5 text-[12px] font-semibold text-gray-500">
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

        {/* Cc field (conditional) */}
        {showCc && (
          <div className="flex items-center gap-2">
            <label className="w-14 text-right text-gray-500 font-semibold text-[13px]">
              Cc
            </label>
            <div className="flex-1 flex items-center border-b border-gray-200 dark:border-gray-700 focus-within:border-[#0078D4] py-1">
              <input
                type="text"
                placeholder="Cc recipients..."
                value={composeData.cc}
                onChange={(e) => setComposeData((prev) => ({ ...prev, cc: e.target.value }))}
                className="w-full bg-transparent outline-none text-[#201F1E] dark:text-white placeholder-gray-400 text-[13px]"
              />
            </div>
          </div>
        )}

        {/* Bcc field (conditional) */}
        {showBcc && (
          <div className="flex items-center gap-2">
            <label className="w-14 text-right text-gray-500 font-semibold text-[13px]">
              Bcc
            </label>
            <div className="flex-1 flex items-center border-b border-gray-200 dark:border-gray-700 focus-within:border-[#0078D4] py-1">
              <input
                type="text"
                placeholder="Bcc recipients..."
                value={composeData.bcc}
                onChange={(e) => setComposeData((prev) => ({ ...prev, bcc: e.target.value }))}
                className="w-full bg-transparent outline-none text-[#201F1E] dark:text-white placeholder-gray-400 text-[13px]"
              />
            </div>
          </div>
        )}

        {/* Subject field */}
        <div className="flex items-center gap-2">
          <label className="w-14 text-right text-gray-500 font-semibold text-[13px]">
            Subject
          </label>
          <div className="flex-1 flex items-center border-b border-gray-200 dark:border-gray-700 focus-within:border-[#0078D4] py-1">
            <input
              type="text"
              placeholder="Add a subject"
              value={composeData.subject}
              onChange={(e) => setComposeData((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full bg-transparent outline-none text-[#201F1E] dark:text-white font-medium placeholder-gray-400 text-[14px]"
            />
          </div>
        </div>

        {/* Attachments chips */}
        {composeData.attachments && composeData.attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 pl-16 pt-1">
            {composeData.attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-2 px-2.5 py-1 rounded bg-gray-100 dark:bg-gray-800 text-[12px] border border-gray-200 dark:border-gray-700"
              >
                <Paperclip className="w-3 h-3 text-[#0078D4]" />
                <span className="font-medium text-gray-800 dark:text-gray-200">{att.filename}</span>
                <span className="text-gray-400">({att.size})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(att.id)}
                  className="hover:text-red-500 cursor-pointer ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Rich Text Formatting Ribbon */}
      <div className="p-2 px-4 bg-[#FAF9F8] dark:bg-[#1B1A19] border-b border-[#EDEBE9] dark:border-[#292827] flex items-center gap-1 text-gray-600 dark:text-gray-300 overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => showToast('Bold applied', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Bold (Ctrl + B)"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Italic applied', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Italic (Ctrl + I)"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Underline applied', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Underline (Ctrl + U)"
        >
          <Underline className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Strikethrough applied', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Strikethrough"
        >
          <Strikethrough className="w-4 h-4" />
        </button>

        <span className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />

        <button
          type="button"
          onClick={() => showToast('Bullet list toggled', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Bullet list"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Numbered list toggled', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Numbered list"
        >
          <ListOrdered className="w-4 h-4" />
        </button>

        <span className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />

        <button
          type="button"
          onClick={() => showToast('Align left', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Align left"
        >
          <AlignLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Align center', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Align center"
        >
          <AlignCenter className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Align right', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Align right"
        >
          <AlignRight className="w-4 h-4" />
        </button>

        <span className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />

        <button
          type="button"
          onClick={() => showToast('Insert link dialog', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Insert hyperlink"
        >
          <Link className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => showToast('Emoji picker', 'info')}
          className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-800 cursor-pointer"
          title="Insert emoji"
        >
          <Smile className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Message Content Body Textarea */}
      <div className="flex-1 p-5">
        <textarea
          rows={14}
          placeholder="Write your email here..."
          value={composeData.body}
          onChange={(e) => setComposeData((prev) => ({ ...prev, body: e.target.value }))}
          className="w-full h-full bg-transparent outline-none text-[#201F1E] dark:text-white placeholder-gray-400 text-[14px] leading-relaxed resize-none"
        />
      </div>

      {/* 5. Bottom Send Bar */}
      <div className="p-3 border-t border-[#EDEBE9] dark:border-[#292827] flex items-center justify-between bg-[#FAF9F8] dark:bg-[#1B1A19]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 bg-[#0078D4] hover:bg-[#106EBE] active:bg-[#005A9E] disabled:opacity-40 text-white font-bold px-5 py-2 rounded text-[13px] transition cursor-pointer shadow-xs"
          >
            <Send className="w-4 h-4" />
            <span>{isSubmitting ? 'Sending...' : 'Send'}</span>
          </button>
          <button
            type="button"
            onClick={closeCompose}
            className="px-3 py-2 rounded hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 text-[13px] font-medium transition cursor-pointer"
          >
            Discard
          </button>
        </div>

        <span className="text-[12px] text-gray-400">
          Saved as draft
        </span>
      </div>
    </div>
  );
}
