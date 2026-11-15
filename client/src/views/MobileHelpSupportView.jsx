import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  ExternalLink,
  Headphones,
  HelpCircle,
  Loader2,
  Lock,
  MessageSquare,
  PlusCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
} from 'lucide-react';
import { getOptimalMediaUrl } from '../utils/mediaUtils';
import CreateTicketView from './help-support/CreateTicketView';
import TicketsView from './help-support/TicketsView';
import TicketDetailView from './help-support/TicketDetailView';
import HelpCenterView from './help-support/HelpCenterView';

let mobileMsgSeq = 0;
function nextMobileMsgId(prefix) {
  mobileMsgSeq += 1;
  return `${prefix}_${Date.now()}_${mobileMsgSeq}`;
}

function normalizeStatus(status) {
  const s = String(status || 'open').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'closed') return 'closed';
  if (s === 'resolved') return 'resolved';
  if (s === 'escalated') return 'escalated';
  if (s === 'in_progress' || s === 'inprogress') return 'in_progress';
  if (s === 'waiting_customer' || s === 'waiting_for_customer') return 'waiting_customer';
  return 'open';
}

export default function MobileHelpSupportView({
  currentUser,
  setCurrentUser,
  showToast,
  onBackToApp,
}) {
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'tickets' | 'new-ticket' | 'faq' | 'ticket-detail'
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState({});
  const [deviceInfo, setDeviceInfo] = useState(null);

  // System config & Guest session
  const [supportConfig, setSupportConfig] = useState({
    liveChatWidgetEnabled: true,
    allowNewTicketCreation: true,
    allowAttachments: true,
  });
  const [guestSession, setGuestSession] = useState(null);
  const [checkingGuest, setCheckingGuest] = useState(!currentUser);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestError, setGuestError] = useState('');
  const [verifyingGuest, setVerifyingGuest] = useState(false);

  // Live Chat State
  const [activeConvId, setActiveConvId] = useState(null);
  const [linkedTicket, setLinkedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [convertingTicket, setConvertingTicket] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'chat') {
      scrollToBottom();
    }
  }, [messages, isTyping, activeTab]);

  // Fetch system config
  useEffect(() => {
    fetch('/api/support/config', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSupportConfig(data.config || data);
      })
      .catch(() => {});
  }, []);

  // Check guest session if not logged in
  useEffect(() => {
    if (currentUser) {
      setGuestSession(null);
      setCheckingGuest(false);
      return;
    }
    setCheckingGuest(true);
    fetch('/api/support/guest/session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const sess = data?.guestSession || data?.session || (data?.verified ? data : null);
        if (sess && (sess.email || sess.verified)) {
          setGuestSession(sess);
        }
      })
      .catch(() => {})
      .finally(() => setCheckingGuest(false));
  }, [currentUser]);

  // Automatic Cryptographic SSO Handshake Consumption
  useEffect(() => {
    const consumeSsoHandshake = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const ssoToken = params.get('sso_token') || params.get('token');
        const ssoNonce = params.get('sso_nonce') || params.get('nonce');
        if (!ssoToken || !ssoNonce) return;

        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 2500) : null;

        const res = await fetch('/api/auth/sso/consume-handshake', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ssoToken, nonce: ssoNonce }),
          signal: controller ? controller.signal : undefined,
        });

        if (timeoutId) clearTimeout(timeoutId);
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          if (data.sessionToken) localStorage.setItem('stockpro_session', data.sessionToken);
          localStorage.setItem('stockpro_user', JSON.stringify(data.user));
          setCurrentUser?.(data.user);
          setDeviceInfo(data.deviceFingerprint || null);
          showToast?.(`Authenticated as ${data.user.name || data.user.storeName}!`, 'success');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      } catch (err) {
        console.warn('SSO consume non-blocking error:', err);
      }
    };
    consumeSsoHandshake();
  }, [setCurrentUser, showToast]);

  const isAuthorizedForChat = Boolean(currentUser || guestSession);

  // Initialize welcome message once authorized
  useEffect(() => {
    if (!isAuthorizedForChat || messages.length > 0) return;
    const displayName =
      currentUser?.name || currentUser?.storeName || guestSession?.name || guestSession?.fullName || 'Customer';
    setMessages([
      {
        id: 'welcome_1',
        sender: 'agent',
        name: 'Tiwlo Support',
        role: 'Support Specialist',
        text: `Hello ${displayName}! Welcome to Tiwlo Mobile Support. Ask a question below or convert this session into an official support ticket anytime.`,
        time: 'Just now',
      },
    ]);
  }, [isAuthorizedForChat, currentUser, guestSession, messages.length]);

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
      if (!res.ok) throw new Error(data?.error || 'Could not verify contact details.');
      const sess = data?.guestSession || data?.session || { name, fullName: name, email, phone, verified: true };
      setGuestSession(sess);
      showToast?.('Guest contact verified');
    } catch (err) {
      setGuestError(err.message || 'Verification failed.');
    } finally {
      setVerifyingGuest(false);
    }
  };

  const ensureConversationSession = async (firstMessageText) => {
    if (activeConvId) return { sessionId: activeConvId, ticket: linkedTicket };
    const displayName =
      currentUser?.name || currentUser?.storeName || guestSession?.name || guestSession?.fullName || 'Customer';
    const res = await fetch('/api/support/initiate', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userName: displayName,
        channel: 'Mobile',
        initialSubject: firstMessageText.slice(0, 80),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.sessionId) {
      setActiveConvId(data.sessionId);
      if (data.ticket) setLinkedTicket(data.ticket);
      return { sessionId: data.sessionId, ticket: data.ticket || null };
    }
    return { sessionId: null, ticket: null };
  };

  const handleSendMessage = async (customText = null) => {
    if (!isAuthorizedForChat) return;
    if (normalizeStatus(linkedTicket?.status) === 'closed') return;
    const textToSend = typeof customText === 'string' ? customText : inputText;
    if (!textToSend || !textToSend.trim()) return;

    const userText = textToSend.trim();
    setInputText('');

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const newUserMsg = {
      id: nextMobileMsgId('msg_u'),
      sender: 'user',
      text: userText,
      time: timeStr,
    };

    setMessages((prev) => [...prev, newUserMsg]);
    setIsTyping(true);

    try {
      const { sessionId, ticket } = await ensureConversationSession(userText);
      const history = messages.slice(-6).map((m) => ({
        role: m.sender === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));
      const displayName =
        currentUser?.name || currentUser?.storeName || guestSession?.name || guestSession?.fullName || 'Customer';

      const res = await fetch('/api/support/message', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-client-source': 'tiwi_mobile_app',
          'x-client-platform': 'mobile',
          'x-session-id': sessionId || '',
        },
        body: JSON.stringify({
          agentName: 'Support Specialist',
          agentRole: 'Support Specialist',
          userId: currentUser?.id || '',
          userName: displayName,
          message: userText,
          activeTicketId: ticket?.ticketId || ticket?.id || undefined,
          sessionId: sessionId || undefined,
          conversationHistory: history,
          clientSource: 'tiwi_mobile_app',
          deviceFingerprint: deviceInfo || {
            platform: 'mobile',
            appVersion: '1.0.0',
          },
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_a_${Date.now()}`,
            sender: 'agent',
            name: 'Support Specialist',
            role: 'Support Team',
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } else {
        throw new Error('Support response unavailable');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'agent',
          name: 'Support Specialist',
          role: 'Support Team',
          text: `We received your query: "${userText}". Our specialist team has logged it.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleConvertToTicket = async () => {
    if (!isAuthorizedForChat || convertingTicket || supportConfig?.allowNewTicketCreation === false) return;
    setConvertingTicket(true);
    try {
      const { sessionId } = await ensureConversationSession('Mobile Support Inquiry');
      if (!sessionId) throw new Error('Could not initialize conversation');
      const res = await fetch(`/api/support/conversations/${encodeURIComponent(sessionId)}/convert-to-ticket`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'Mobile Support Inquiry',
          category: 'General Inquiry',
          priority: 'MEDIUM',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ticket) {
        throw new Error(data?.error || 'Could not convert to official ticket');
      }
      const created = data.ticket;
      const cId = created.ticketId || created.id;
      const rec = data.guestRecoveryCode || data.recoveryCode || created.guestRecoveryCode || '';
      if (rec && cId) {
        setRecoveryCodes((prev) => ({ ...prev, [cId]: rec }));
        try {
          sessionStorage.setItem(`tiwlo.support.recovery.${cId}`, rec);
        } catch {}
      }
      setLinkedTicket(created);
      showToast?.(`Ticket ${created.serialNumber || `#${cId}`} created!`);
    } catch (err) {
      showToast?.(err.message || 'Conversion failed', 'error');
    } finally {
      setConvertingTicket(false);
    }
  };

  const handleOpenTicketDetail = (ticket) => {
    setSelectedTicket(ticket);
    setActiveTab('ticket-detail');
  };

  const handleBack = () => {
    if (activeTab === 'ticket-detail') {
      setActiveTab('tickets');
      return;
    }
    if (onBackToApp) {
      onBackToApp();
    } else {
      try {
        if (window.history.length > 1) window.history.back();
        else window.close();
      } catch {}
    }
  };

  const avatarUrl = getOptimalMediaUrl(currentUser?.avatar) || '/default-avatar.svg';
  const allowNewTicket = supportConfig?.allowNewTicketCreation !== false;
  const isChatTicketClosed = normalizeStatus(linkedTicket?.status) === 'closed';
  const displayUserLabel =
    currentUser?.name || currentUser?.storeName || guestSession?.name || guestSession?.fullName || 'Guest';

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col justify-between max-w-lg mx-auto border-x border-neutral-200/80 dark:border-neutral-800 relative">
      {/* Top Mobile Header */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl border-b border-neutral-200/80 dark:border-neutral-800 px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleBack}
              className="w-9 h-9 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 flex items-center justify-center text-neutral-700 dark:text-neutral-200 cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-neutral-950 dark:text-white">
                Tiwlo Support
              </h1>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Mobile Help Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 py-1">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-5 h-5 rounded-full object-cover"
            />
            <span className="text-xs font-medium text-neutral-800 dark:text-neutral-200 max-w-[90px] truncate">
              {displayUserLabel}
            </span>
          </div>
        </div>

        {/* Guest Status Indicator */}
        {!currentUser && guestSession && (
          <div className="flex items-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 py-1.5 text-[11px] text-neutral-700 dark:text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full bg-[#1ED760] shrink-0" />
            <span className="truncate">
              Guest Session Active ({guestSession.email}
              {guestSession.phone ? ` · ${guestSession.phone}` : ''})
            </span>
          </div>
        )}

        {/* Segmented Tabs */}
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-1">
          {[
            { id: 'chat', label: 'Live Chat', icon: MessageSquare },
            { id: 'tickets', label: 'Tickets', icon: Ticket },
            { id: 'new-ticket', label: 'New', icon: PlusCircle, disabled: !allowNewTicket },
            { id: 'faq', label: 'FAQ', icon: HelpCircle },
          ].map(({ id, label, icon: Icon, disabled }) => {
            const active = activeTab === id || (id === 'tickets' && activeTab === 'ticket-detail');
            return (
              <button
                key={id}
                type="button"
                disabled={disabled}
                onClick={() => setActiveTab(id)}
                className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer disabled:opacity-45 ${
                  active
                    ? 'bg-[#1ED760] text-neutral-950 font-semibold shadow-2xs'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col p-4 overflow-y-auto">
        {activeTab === 'chat' && (
          !currentUser && checkingGuest ? (
            <div className="flex-1 flex items-center justify-center text-xs text-neutral-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking support session...
            </div>
          ) : !isAuthorizedForChat ? (
            <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xs space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">
                    Verify Contact Details
                  </h2>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    Please provide your name, email, and phone number before starting live chat.
                  </p>
                </div>
              </div>

              <form onSubmit={handleVerifyGuest} className="space-y-3">
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Full Name"
                  className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm focus:border-[#1ED760] focus:outline-none"
                />
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="Email Address"
                  className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm focus:border-[#1ED760] focus:outline-none"
                />
                <input
                  type="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="Phone Number"
                  className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm focus:border-[#1ED760] focus:outline-none"
                />
                {guestError && <p className="text-xs text-red-600 dark:text-red-400">{guestError}</p>}
                <button
                  type="submit"
                  disabled={verifyingGuest}
                  className="w-full h-10 rounded-lg bg-[#1ED760] hover:bg-[#19c355] text-xs font-semibold text-neutral-950 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {verifyingGuest ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {verifyingGuest ? 'Verifying...' : 'Verify & Start Chat'}
                </button>
              </form>
            </section>
          ) : (
            <div className="flex-1 flex flex-col justify-between space-y-3">
              {/* Ticket Linkage Bar */}
              <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-xs">
                {linkedTicket ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-neutral-900 dark:text-neutral-100">
                      <Ticket className="h-3.5 w-3.5 text-[#1ED760]" />
                      {linkedTicket.serialNumber || `#${linkedTicket.ticketId || linkedTicket.id}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleOpenTicketDetail(linkedTicket)}
                      className="inline-flex items-center gap-1 font-semibold text-[#16a34a] dark:text-[#1ED760] cursor-pointer"
                    >
                      View Ticket
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-neutral-500 dark:text-neutral-400">Live specialist chat</span>
                    {allowNewTicket && (
                      <button
                        type="button"
                        disabled={convertingTicket}
                        onClick={handleConvertToTicket}
                        className="inline-flex items-center gap-1 font-semibold text-neutral-900 dark:text-neutral-100 hover:text-[#1ED760] cursor-pointer disabled:opacity-50"
                      >
                        {convertingTicket ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ticket className="h-3 w-3 text-[#1ED760]" />}
                        Convert to Ticket
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Suggestion Chips */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {[
                  'Check cloud server status',
                  'Explain my subscription plan',
                  'Help me add a product',
                ].map((suggestion, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={isChatTicketClosed}
                    onClick={() => handleSendMessage(suggestion)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-neutral-950 border border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-[#1ED760] transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                  >
                    <Sparkles className="w-3 h-3 text-[#1ED760]" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>

              {/* Messages */}
              <div className="flex-1 space-y-3 py-2">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                    {msg.sender === 'agent' && (
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-neutral-500">
                        <Headphones className="w-3 h-3 text-[#1ED760]" />
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">{msg.name}</span>
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-br-xs'
                          : 'bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 border border-neutral-200/80 dark:border-neutral-800 rounded-bl-xs'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                      <span className="block text-[10px] mt-1 text-right opacity-60">{msg.time}</span>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1ED760]" />
                    <span>Specialist is replying...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Closed Lock OR Input */}
              {isChatTicketClosed ? (
                <div className="sticky bottom-0 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                  <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
                  <span>This ticket is closed and locked. New replies cannot be sent.</span>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="sticky bottom-0 bg-[#fafafa] dark:bg-neutral-950 pt-2"
                >
                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1.5 focus-within:border-[#1ED760]">
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Ask Tiwlo support..."
                      className="flex-1 bg-transparent text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none py-1.5"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isTyping}
                      className="w-8 h-8 rounded-lg bg-[#1ED760] hover:bg-[#19c355] disabled:opacity-40 flex items-center justify-center text-neutral-950 cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}
            </div>
          )
        )}

        {activeTab === 'tickets' && (
          <TicketsView
            currentUser={currentUser}
            guestSession={guestSession}
            supportConfig={supportConfig}
            onBack={() => setActiveTab('chat')}
            onCreateTicket={() => setActiveTab('new-ticket')}
            onSelectTicket={handleOpenTicketDetail}
          />
        )}

        {activeTab === 'ticket-detail' && selectedTicket && (
          <TicketDetailView
            ticketId={selectedTicket.ticketId || selectedTicket.id}
            initialTicket={selectedTicket}
            initialRecoveryCode={recoveryCodes[selectedTicket.ticketId || selectedTicket.id] || ''}
            currentUser={currentUser}
            guestSession={guestSession}
            supportConfig={supportConfig}
            onBack={() => setActiveTab('tickets')}
            showToast={showToast}
          />
        )}

        {activeTab === 'new-ticket' && (
          <CreateTicketView
            currentUser={currentUser}
            guestSession={guestSession}
            supportConfig={supportConfig}
            channel="Mobile"
            onBack={() => setActiveTab('tickets')}
            onSelectTicket={handleOpenTicketDetail}
            onGuestSessionVerified={setGuestSession}
            onTicketCreated={(ticket, recoveryCode) => {
              const id = ticket.ticketId || ticket.id;
              if (recoveryCode && id) {
                setRecoveryCodes((prev) => ({ ...prev, [id]: recoveryCode }));
              }
              showToast?.(`Ticket #${id} submitted!`, 'success');
              handleOpenTicketDetail(ticket);
            }}
            showToast={showToast}
          />
        )}

        {activeTab === 'faq' && (
          <HelpCenterView
            onBack={() => setActiveTab('chat')}
            onOpenInbox={() => setActiveTab('chat')}
          />
        )}
      </main>
    </div>
  );
}
