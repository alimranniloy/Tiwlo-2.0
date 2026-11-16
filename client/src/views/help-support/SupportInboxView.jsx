import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  ExternalLink,
  FileText,
  Headphones,
  Loader2,
  Lock,
  MessageSquarePlus,
  Paperclip,
  Search,
  Send,
  ShieldCheck,
  Ticket,
  User,
  X,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/mediaUtils';

const ACTIVE_CONV_STORAGE_KEY = 'tiwlo.support.activeInboxConv';

function normalizeStatus(status) {
  const s = String(status || 'open').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'closed') return 'closed';
  if (s === 'resolved') return 'resolved';
  if (s === 'on_hold' || s === 'hold') return 'on_hold';
  if (s === 'escalated') return 'escalated';
  if (s === 'in_progress' || s === 'inprogress') return 'in_progress';
  if (s === 'waiting_customer' || s === 'waiting_for_customer') return 'waiting_customer';
  return 'open';
}

export default function SupportInboxView({
  currentUser,
  guestSession: externalGuestSession = null,
  supportConfig: externalConfig = null,
  onBack,
  onSelectTicket,
  onGuestSessionVerified,
  showToast,
}) {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(() => {
    try {
      return sessionStorage.getItem(ACTIVE_CONV_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [startingNew, setStartingNew] = useState(false);
  const [convertingTicket, setConvertingTicket] = useState(false);
  const [mobileChatView, setMobileChatView] = useState(false);

  // Guest verification gate
  const [guestSession, setGuestSession] = useState(externalGuestSession);
  const [checkingGuest, setCheckingGuest] = useState(!currentUser && !externalGuestSession);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestError, setGuestError] = useState('');
  const [verifyingGuest, setVerifyingGuest] = useState(false);

  // System config
  const [supportConfig, setSupportConfig] = useState(
    externalConfig || { allowAttachments: true, allowNewTicketCreation: true }
  );

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (externalGuestSession) {
      setGuestSession(externalGuestSession);
      setCheckingGuest(false);
    }
  }, [externalGuestSession]);

  useEffect(() => {
    if (externalConfig) setSupportConfig(externalConfig);
  }, [externalConfig]);

  useEffect(() => {
    if (!externalConfig) {
      fetch('/api/support/config', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) setSupportConfig(data.config || data);
        })
        .catch(() => {});
    }

    if (!currentUser && !externalGuestSession) {
      setCheckingGuest(true);
      fetch('/api/support/guest/session', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const sess = data?.guestSession || data?.session || (data?.verified ? data : null);
          if (sess && (sess.visitorEmail || sess.email || sess.verified || sess.id)) {
            setGuestSession(sess);
            onGuestSessionVerified?.(sess);
          }
        })
        .catch(() => {})
        .finally(() => setCheckingGuest(false));
    } else {
      setCheckingGuest(false);
    }
  }, [currentUser, externalConfig, externalGuestSession, onGuestSessionVerified]);

  const isAuthorizedForChat = Boolean(currentUser || guestSession);

  const loadConversations = useCallback(async (options = {}) => {
    const silent = Boolean(options?.silent);
    if (!isAuthorizedForChat) {
      if (!silent) setLoading(false);
      return;
    }
    try {
      if (!silent) setLoading(true);
      const userId = currentUser?.id || currentUser?.tiwiId || '';
      const url = userId
        ? `/api/support/conversations?userId=${encodeURIComponent(userId)}`
        : '/api/support/conversations';
      const res = await fetch(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.conversations) ? data.conversations : [];
        setConversations(list);
        if (list.length > 0) {
          setActiveConvId((prev) => {
            const exists = prev && list.some((c) => c.id === prev);
            const nextId = exists ? prev : list[0].id;
            try {
              sessionStorage.setItem(ACTIVE_CONV_STORAGE_KEY, nextId);
            } catch {}
            return nextId;
          });
        }
      }
    } catch (err) {
      if (!silent) console.warn('Failed to load conversations:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [currentUser, isAuthorizedForChat]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const activeConv =
    conversations.find((c) => c.id === activeConvId) || conversations[0] || null;
  const activeMessages = activeConv?.messages || [];
  const activeConvClosed = Boolean(
    activeConv && normalizeStatus(activeConv.ticketStatus || activeConv.status) === 'closed'
  );

  // Gentle 6s silent poll so staff replies posted to linked tickets sync automatically
  useEffect(() => {
    if (!isAuthorizedForChat || activeConvClosed) return undefined;
    const timer = window.setInterval(() => {
      if (!isTyping) {
        loadConversations({ silent: true });
      }
    }, 6000);
    return () => window.clearInterval(timer);
  }, [isAuthorizedForChat, activeConvClosed, isTyping, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, isTyping]);

  const handleSelectConversation = (conv) => {
    setActiveConvId(conv.id);
    setMobileChatView(true);
    try {
      sessionStorage.setItem(ACTIVE_CONV_STORAGE_KEY, conv.id);
    } catch {}
  };

  const handleVerifyGuest = async (e) => {
    e.preventDefault();
    setGuestError('');
    const name = guestName.trim();
    const email = guestEmail.trim();
    const phone = guestPhone.trim();

    if (name.length < 2) {
      setGuestError('Please enter your full name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGuestError('Please enter a valid email address.');
      return;
    }
    if (phone.replace(/\D/g, '').length < 7) {
      setGuestError('Please enter a valid phone number.');
      return;
    }

    setVerifyingGuest(true);
    try {
      const res = await fetch('/api/support/guest/session', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, fullName: name, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not verify guest contact.');
      const sess = data?.guestSession || data?.session || { name, fullName: name, email, phone, verified: true };
      setGuestSession(sess);
      onGuestSessionVerified?.(sess);
      showToast?.('Guest session activated');
    } catch (err) {
      setGuestError(err.message || 'Verification failed.');
    } finally {
      setVerifyingGuest(false);
    }
  };

  const handleStartNewConversation = async () => {
    if (!isAuthorizedForChat || startingNew) return;
    setStartingNew(true);
    try {
      const displayName =
        currentUser?.name ||
        currentUser?.storeName ||
        guestSession?.visitorName ||
        guestSession?.name ||
        guestSession?.fullName ||
        'Customer';
      const res = await fetch('/api/support/initiate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userName: displayName,
          initialSubject: `Support Chat (${displayName})`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.sessionId) {
        throw new Error(data?.error || 'Could not start conversation.');
      }
      const newConv = {
        id: data.sessionId,
        ticketId: data.ticket?.ticketId || data.ticket?.id || null,
        serialNumber: data.ticket?.serialNumber || null,
        ticketStatus: data.ticket?.status || 'OPEN',
        name: data.agent?.name ? `${data.agent.name}` : 'Support Specialist',
        role: data.agent?.tierTitle || 'Support Specialist',
        avatar: data.agent?.avatar || null,
        time: 'Just now',
        lastMessage: data.welcomeGreeting,
        messages: [
          {
            id: `msg_welcome_${Date.now()}`,
            sender: 'agent',
            agentName: data.agent?.name || 'Support Specialist',
            avatar: data.agent?.avatar || null,
            text: data.welcomeGreeting,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ],
      };
      setConversations((prev) => [newConv, ...prev.filter((c) => c.id !== newConv.id)]);
      handleSelectConversation(newConv);
    } catch (err) {
      showToast?.(err.message || 'Could not start a new chat', 'error');
    } finally {
      setStartingNew(false);
    }
  };

  const handleFileSelect = async (e) => {
    if (supportConfig?.allowAttachments === false) return;
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const remaining = Math.max(0, 10 - attachments.length);
    if (remaining <= 0) {
      showToast?.('Maximum 10 attachments allowed per message', 'error');
      if (e.target) e.target.value = '';
      return;
    }
    const validFiles = files.slice(0, remaining).filter((f) => {
      if (f.size > 10 * 1024 * 1024) {
        showToast?.(`${f.name} exceeds 10MB limit`, 'error');
        return false;
      }
      return true;
    });
    if (!validFiles.length) {
      if (e.target) e.target.value = '';
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      for (const file of validFiles) {
        formData.append('files', file);
      }
      const res = await fetch('/api/support/attachments', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Upload failed');
      const returned = Array.isArray(data?.attachments)
        ? data.attachments
        : data?.attachment
          ? [data.attachment]
          : [];
      const uploaded = returned.map((att, idx) => ({
        id: att.id || `att_${Date.now()}_${idx}`,
        name: att.filename || att.name || validFiles[idx]?.name || 'Attachment',
        url: att.url || '',
        mimeType: att.contentType || att.mimeType || validFiles[idx]?.type || 'application/octet-stream',
      }));
      if (uploaded.length) setAttachments((prev) => [...prev, ...uploaded].slice(0, 10));
    } catch (err) {
      showToast?.(err.message || 'Upload failed', 'error');
    } finally {
      setUploadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!isAuthorizedForChat || !activeConv) return;
    const linkedTicketClosed = normalizeStatus(activeConv.ticketStatus || activeConv.status) === 'closed';
    if (linkedTicketClosed) return;
    if (!inputText.trim() && attachments.length === 0) return;

    const userText = inputText.trim() || `Sent ${attachments.length} attachment(s)`;
    const outgoingAttachments = [...attachments];
    setInputText('');
    setAttachments([]);

    const targetConvId = activeConv.id;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempUserMsg = {
      id: `temp_${Date.now()}`,
      sender: 'user',
      text: userText,
      attachments: outgoingAttachments,
      time: timeStr,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === targetConvId
          ? { ...c, lastMessage: userText, time: timeStr, messages: [...(c.messages || []), tempUserMsg] }
          : c
      )
    );
    setIsTyping(true);

    try {
      const displayName =
        currentUser?.name ||
        currentUser?.storeName ||
        guestSession?.visitorName ||
        guestSession?.name ||
        guestSession?.fullName ||
        'Customer';
      const res = await fetch(`/api/support/conversations/${encodeURIComponent(targetConvId)}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: userText,
          attachments: outgoingAttachments,
          sender: 'user',
          userName: displayName,
          userId: currentUser?.id || currentUser?.tiwiId || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Message could not be sent.');
      }
      if (data?.conversation) {
        setConversations((prev) =>
          prev.map((c) => (c.id === targetConvId ? data.conversation : c))
        );
      }
    } catch (err) {
      showToast?.(err.message || 'Failed to send message', 'error');
    } finally {
      setIsTyping(false);
    }
  };

  const handleConvertToTicket = async () => {
    if (!activeConv || convertingTicket || supportConfig?.allowNewTicketCreation === false) return;
    setConvertingTicket(true);
    try {
      const res = await fetch(`/api/support/conversations/${encodeURIComponent(activeConv.id)}/convert-to-ticket`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: activeConv.name || 'Support Chat Escalation',
          category: 'General Inquiry',
          priority: 'MEDIUM',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ticket) {
        throw new Error(data?.error || 'Could not convert conversation to ticket.');
      }
      const created = data.ticket;
      const ticketId = created.ticketId || created.id;
      const serial = created.serialNumber || `#${ticketId}`;
      const recoveryCode = data.guestRecoveryCode || data.recoveryCode || created.guestRecoveryCode || '';
      if (recoveryCode && ticketId) {
        try {
          sessionStorage.setItem(`tiwlo.support.recovery.${ticketId}`, recoveryCode);
        } catch {}
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConv.id
            ? { ...c, ticketId, serialNumber: serial, ticketStatus: created.status || 'OPEN', ticket: created }
            : c
        )
      );
      showToast?.(`Official ticket ${serial} created`);
    } catch (err) {
      showToast?.(err.message || 'Conversion failed', 'error');
    } finally {
      setConvertingTicket(false);
    }
  };

  const filteredConversations = conversations.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.lastMessage || '').toLowerCase().includes(q) ||
      String(c.ticketId || c.serialNumber || '').toLowerCase().includes(q)
    );
  });

  const activeTicketId = activeConv?.ticketId || activeConv?.ticket?.ticketId || activeConv?.ticket?.id;
  const activeTicketSerial =
    activeConv?.serialNumber || (activeTicketId ? (String(activeTicketId).startsWith('#') ? activeTicketId : `#${activeTicketId}`) : '');
  const isLinkedTicketClosed =
    normalizeStatus(activeConv?.ticketStatus || activeConv?.ticket?.status || activeConv?.status) === 'closed';
  const allowAttachments = supportConfig?.allowAttachments !== false;
  const allowNewTicket = supportConfig?.allowNewTicketCreation !== false;

  return (
    <div className="w-full space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Support Inbox
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Live specialist messaging with instant official ticket conversion
            </p>
          </div>
        </div>

        {isAuthorizedForChat && (
          <button
            type="button"
            disabled={startingNew}
            onClick={handleStartNewConversation}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-2 text-xs font-semibold text-neutral-950 transition disabled:opacity-50 cursor-pointer self-start sm:self-auto"
          >
            {startingNew ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />}
            New Conversation
          </button>
        )}
      </div>

      {/* Guest Active Indicator */}
      {!currentUser && guestSession && (
        <div className="flex items-center gap-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-4 py-2.5 text-xs text-neutral-700 dark:text-neutral-200">
          <span className="h-2 w-2 rounded-full bg-[#1ED760]" />
          <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
          <span>
            Guest Session Active (<span className="font-medium">{guestSession.email}</span>
            {guestSession.phone ? ` · ${guestSession.phone}` : ''})
          </span>
        </div>
      )}

      {/* Guest Gate OR 2-Column Chat Interface */}
      {!currentUser && checkingGuest ? (
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-8 text-center text-xs text-neutral-500 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Verifying support session...
        </div>
      ) : !isAuthorizedForChat ? (
        <section className="mx-auto max-w-2xl rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-xs space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                Verify Contact Details to Start Chatting
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Enter your full name, email, and phone number so specialists can link your conversation and preserve your history.
              </p>
            </div>
          </div>

          <form onSubmit={handleVerifyGuest} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <input
              type="text"
              required
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Full Name"
              className="h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
            />
            <input
              type="email"
              required
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="Email Address"
              className="h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
            />
            <input
              type="tel"
              required
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="Phone Number"
              className="h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
            />
            {guestError && (
              <p role="alert" className="sm:col-span-3 text-xs font-medium text-red-600 dark:text-red-400">
                {guestError}
              </p>
            )}
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={verifyingGuest}
                className="inline-flex items-center gap-2 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-5 py-2 text-xs sm:text-sm font-semibold text-neutral-950 transition disabled:opacity-50 cursor-pointer"
              >
                {verifyingGuest ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                {verifyingGuest ? 'Verifying...' : 'Verify & Open Inbox'}
              </button>
            </div>
          </form>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden min-h-[560px] sm:min-h-[620px] bg-white dark:bg-neutral-950 shadow-xs">
          {/* Left Column: Conversations */}
          <div className={`lg:col-span-4 border-r border-neutral-200/80 dark:border-neutral-800 flex flex-col bg-[#fafafa] dark:bg-neutral-900 ${mobileChatView ? 'hidden lg:flex' : 'flex'}`}>
            <div className="p-3.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search conversations or #TWTK-..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-xs bg-[#fafafa] dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-[#1ED760] text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-neutral-200/60 dark:divide-neutral-800">
              {loading ? (
                <div className="p-6 text-center text-xs text-neutral-500">Loading conversations...</div>
              ) : filteredConversations.length === 0 ? (
                <div className="p-6 text-center space-y-3">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    No active conversations yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleStartNewConversation}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-3 py-1.5 text-xs font-semibold text-neutral-950 cursor-pointer"
                  >
                    <MessageSquarePlus className="h-3.5 w-3.5" />
                    Start Conversation
                  </button>
                </div>
              ) : (
                filteredConversations.map((conv) => {
                  const isActive = conv.id === activeConv?.id;
                  const cSerial = conv.serialNumber || (conv.ticketId ? `#${conv.ticketId}` : '');
                  return (
                    <button
                      key={conv.id}
                      type="button"
                      onClick={() => handleSelectConversation(conv)}
                      className={`w-full p-3.5 flex items-start gap-3 text-left transition cursor-pointer ${
                        isActive
                          ? 'bg-white dark:bg-neutral-950 border-l-2 border-l-[#1ED760]'
                          : 'hover:bg-white/60 dark:hover:bg-neutral-950/60'
                      }`}
                    >
                      <div className="h-9 w-9 rounded-full overflow-hidden flex items-center justify-center shrink-0 border border-neutral-200/80 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-300">
                        {conv.avatar ? (
                          <img src={resolveAvatarUrl(conv.avatar)} alt={conv.name} className="h-full w-full object-cover" />
                        ) : conv.isSupport !== false ? (
                          <Headphones className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                            {conv.name || 'Support Specialist'}
                          </h4>
                          <span className="text-[10px] text-neutral-400 whitespace-nowrap">{conv.time}</span>
                        </div>
                        {cSerial && (
                          <span className="mt-0.5 inline-block font-mono text-[10px] text-[#16a34a] dark:text-[#1ED760]">
                            {cSerial}
                          </span>
                        )}
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                          {conv.lastMessage}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Chat */}
          <div className={`lg:col-span-8 flex flex-col h-[560px] sm:h-[620px] bg-white dark:bg-neutral-950 ${!mobileChatView ? 'hidden lg:flex' : 'flex'}`}>
            {!activeConv ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3">
                <Headphones className="h-10 w-10 text-neutral-300 dark:text-neutral-700" />
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    Start a Conversation
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    Connect with a Tiwlo Support Specialist or select a thread on the left.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleStartNewConversation}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-2 text-xs font-semibold text-neutral-950 cursor-pointer"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  Start New Chat
                </button>
              </div>
            ) : (
              <>
                {/* Top Conversation Bar */}
                <div className="px-4 py-3 border-b border-neutral-200/80 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-neutral-950">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileChatView(false)}
                      className="lg:hidden p-1.5 -ml-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-neutral-600 dark:text-neutral-300 cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div className="h-9 w-9 rounded-full overflow-hidden border border-neutral-200/80 dark:border-neutral-700 bg-[#fafafa] dark:bg-neutral-900 flex items-center justify-center shrink-0">
                      {activeConv.avatar ? (
                        <img src={resolveAvatarUrl(activeConv.avatar)} alt={activeConv.name} className="h-full w-full object-cover" />
                      ) : (
                        <Headphones className="w-4 h-4 text-neutral-600 dark:text-neutral-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-xs sm:text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {activeConv.name || 'Support Specialist'}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1ED760]" />
                        <span>{activeConv.role || 'Support Team'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Ticket Linkage / Convert to Official Ticket */}
                  <div className="flex items-center gap-2">
                    {activeTicketId ? (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectTicket?.(
                            activeConv.ticket || {
                              id: activeTicketId,
                              ticketId: activeTicketId,
                              serialNumber: activeTicketSerial,
                              status: activeConv.ticketStatus || 'OPEN',
                              subject: activeConv.name,
                            }
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#1ED760]/40 bg-[#1ED760]/10 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:text-[#1ED760] hover:bg-[#1ED760]/20 transition cursor-pointer"
                      >
                        <Ticket className="h-3.5 w-3.5" />
                        <span className="font-mono">{activeTicketSerial}</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={convertingTicket || !allowNewTicket}
                        onClick={handleConvertToTicket}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200 hover:border-[#1ED760] transition disabled:opacity-50 cursor-pointer"
                      >
                        {convertingTicket ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ticket className="h-3.5 w-3.5 text-[#1ED760]" />}
                        Convert to Official Ticket
                      </button>
                    )}
                  </div>
                </div>

                {/* Messages Stream */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#fafafa] dark:bg-neutral-900/40">
                  {activeMessages.map((msg) => {
                    const senderLower = String(msg.senderType || msg.sender || '').toLowerCase();
                    const isUser = ['user', 'customer', 'guest', 'requester'].includes(senderLower);
                    return (
                      <div key={msg.id} className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                          <div className="w-7 h-7 rounded-full overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 flex items-center justify-center shrink-0 mb-1">
                            {msg.avatar ? (
                              <img src={resolveAvatarUrl(msg.avatar)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Headphones className="w-3.5 h-3.5 text-neutral-600 dark:text-neutral-300" />
                            )}
                          </div>
                        )}
                        <div className={`max-w-[78%] sm:max-w-[68%] space-y-1 ${isUser ? 'items-end' : 'items-start'}`}>
                          {!isUser && msg.agentName && (
                            <p className="px-1 text-[10px] font-semibold text-neutral-500 dark:text-neutral-400">
                              {msg.agentName}
                            </p>
                          )}
                          <div
                            className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                              isUser
                                ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-br-xs'
                                : 'bg-white dark:bg-neutral-950 text-neutral-800 dark:text-neutral-100 border border-neutral-200/80 dark:border-neutral-800 rounded-bl-xs'
                            }`}
                          >
                            {msg.text}
                          </div>
                          {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {msg.attachments.map((att, aIdx) => (
                                <span
                                  key={att.id || aIdx}
                                  className="inline-flex items-center gap-1 rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2 py-0.5 text-[10px] text-neutral-600 dark:text-neutral-300"
                                >
                                  <FileText className="h-3 w-3" />
                                  {att.name}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className={`flex items-center gap-1 text-[10px] text-neutral-400 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                            <span>{msg.time}</span>
                            {isUser && <CheckCheck className="w-3.5 h-3.5 text-[#1ED760]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isTyping && (
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <Headphones className="w-4 h-4 text-[#1ED760]" />
                      <span>Specialist is typing...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Strict Closed Ticket Lock OR Chat Composer */}
                {isLinkedTicketClosed ? (
                  <div className="p-4 border-t border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 flex items-center gap-2.5 text-xs text-neutral-600 dark:text-neutral-400">
                    <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
                    <span>This ticket is closed and locked. New replies cannot be sent.</span>
                  </div>
                ) : (
                  <div className="border-t border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 space-y-2">
                    {attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {attachments.map((att, idx) => (
                          <span
                            key={att.id || idx}
                            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2 py-1 text-[11px] text-neutral-700 dark:text-neutral-200"
                          >
                            <FileText className="h-3 w-3" />
                            <span className="max-w-[120px] truncate">{att.name}</span>
                            <button
                              type="button"
                              onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                              className="text-neutral-400 hover:text-red-500 cursor-pointer"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                      {allowAttachments && (
                        <>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileSelect}
                            accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.zip"
                            className="hidden"
                          />
                          <button
                            type="button"
                            disabled={uploadingFile}
                            onClick={() => fileInputRef.current?.click()}
                            className="h-9 w-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center justify-center transition cursor-pointer shrink-0"
                            title="Attach file"
                          >
                            {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                          </button>
                        </>
                      )}

                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type your message to support..."
                        className="flex-1 h-9 px-3.5 rounded-lg text-xs sm:text-sm bg-[#fafafa] dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:border-[#1ED760] text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
                      />

                      <button
                        type="submit"
                        disabled={(!inputText.trim() && attachments.length === 0) || isTyping}
                        className="h-9 px-3.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] text-neutral-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40 cursor-pointer shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Send</span>
                      </button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
