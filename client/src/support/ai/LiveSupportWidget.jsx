import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCheck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  Headphones,
  History,
  Loader2,
  Lock,
  MessageSquare,
  Minimize2,
  Monitor,
  PauseCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { supportFetch as fetch } from '../../utils/supportFetch';
import { resolveAvatarUrl } from '../../utils/mediaUtils';

const WIDGET_SESSION_STORAGE_KEY = 'tiwlo.support.widgetSession';
const LIVE_CHAT_STORAGE_KEY = 'tiwlo.support.liveQueueChatId';
const CSAT_TAGS = ['Fast', 'Helpful', 'Resolved', 'Clear'];

let widgetMsgSeq = 0;
function nextWidgetMsgId(prefix) {
  widgetMsgSeq += 1;
  return `${prefix}_${Date.now()}_${widgetMsgSeq}`;
}

function normalizeStatus(status) {
  const s = String(status || 'open').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (s === 'closed') return 'closed';
  if (s === 'on_hold' || s === 'hold') return 'on_hold';
  if (s === 'waiting' || s === 'queued') return 'waiting';
  if (s === 'active' || s === 'in_progress') return 'active';
  return s || 'open';
}

function normalizeGuestSession(sess) {
  if (!sess) return null;
  const name = sess.visitorName || sess.name || sess.fullName || '';
  const email = sess.visitorEmail || sess.email || '';
  const phone = sess.visitorPhone || sess.phone || '';
  if (!email && !sess.verified && !sess.id) return null;
  return {
    ...sess,
    visitorName: name,
    visitorEmail: email,
    visitorPhone: phone,
    name,
    fullName: name,
    email,
    phone,
  };
}

function renderFormattedMessage(text) {
  if (!text) return null;
  const lines = String(text).split('\n');
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} className="h-1" />;

        const isBullet =
          trimmed.startsWith('- ') ||
          trimmed.startsWith('* ') ||
          trimmed.startsWith('• ');
        const cleanLine = isBullet ? trimmed.slice(2) : line;

        const parts = [];
        let remaining = cleanLine;
        let partIdx = 0;

        while (remaining.length > 0) {
          const match = remaining.match(/(\*\*([^*]+)\*\*|`([^`]+)`)/);
          if (!match) {
            parts.push(<span key={partIdx++}>{remaining}</span>);
            break;
          }
          if (match.index > 0) {
            parts.push(<span key={partIdx++}>{remaining.slice(0, match.index)}</span>);
          }
          if (match[2] !== undefined) {
            parts.push(
              <strong key={partIdx++} className="font-semibold">
                {match[2]}
              </strong>
            );
          } else if (match[3] !== undefined) {
            parts.push(
              <code
                key={partIdx++}
                className="rounded bg-neutral-200/70 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[11px]"
              >
                {match[3]}
              </code>
            );
          }
          remaining = remaining.slice(match.index + match[0].length);
        }

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1ED760]" />
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        return <p key={lineIdx}>{parts}</p>;
      })}
    </div>
  );
}

const PROMPT_SUGGESTIONS = [
  { label: 'Store & Products', prompt: 'How do I add and manage products in my store?' },
  { label: 'Plan & Billing', prompt: 'I have a question regarding my subscription plan and billing.' },
  { label: 'POS & Sync', prompt: 'How does live POS barcode scanning and inventory sync work?' },
  { label: 'Account Security', prompt: 'How do I update my store credentials and access security?' },
];

const GUEST_PROMPTS = [
  { label: 'Login Assistance', prompt: 'I am having trouble logging into my account. Can you help me access it?' },
  { label: 'Create Store', prompt: 'How do I create and launch an online store on Tiwlo?' },
  { label: 'Plans & Pricing', prompt: 'What are the subscription plans and features available on Tiwlo?' },
  { label: 'General Inquiry', prompt: 'I have a general question about Tiwlo eCommerce & Cloud platform.' },
];

function computeScrollPct() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return 0;
  const docEl = document.documentElement;
  const maxScroll = Math.max(0, (docEl?.scrollHeight || 0) - window.innerHeight);
  if (maxScroll <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((window.scrollY / maxScroll) * 100)));
}

export default function LiveSupportWidget({ currentUser, onNavigateSupport }) {
  const [supportConfig, setSupportConfig] = useState({
    liveChatWidgetEnabled: true,
    allowNewTicketCreation: true,
    allowAttachments: true,
    aiAutoReplyEnabled: true,
    liveChatBlocked: false,
  });
  const [configLoaded, setConfigLoaded] = useState(false);

  const [isOpen, setIsOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [widgetView, setWidgetView] = useState('home'); // 'home' | 'chat' | 'queue-chat' | 'history' | 'guest-gate'
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [pendingStarterPrompt, setPendingStarterPrompt] = useState(null);
  const [pendingMode, setPendingMode] = useState('ai'); // 'ai' | 'queue'

  // Guest session state
  const [guestSession, setGuestSession] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestError, setGuestError] = useState('');
  const [verifyingGuest, setVerifyingGuest] = useState(false);

  // Conversations & Active AI Chat
  const [userConversations, setUserConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [assignedAgent, setAssignedAgent] = useState(null);
  const [currentTier, setCurrentTier] = useState(1);
  const [ticketInfo, setTicketInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferNotice, setTransferNotice] = useState('');
  const [actionNotice, setActionNotice] = useState(null);
  const [convertingTicket, setConvertingTicket] = useState(false);

  // Human Live Chat Queue State
  const [liveQueueChat, setLiveQueueChat] = useState(null);
  const [liveQueueMessages, setLiveQueueMessages] = useState([]);
  const [liveQueueStats, setLiveQueueStats] = useState({
    queuePosition: null,
    totalWaiting: 0,
    onlineAgentsCount: 0,
    freeAgentsCount: 0,
    estimatedWaitSeconds: null,
  });
  const [queueInputText, setQueueInputText] = useState('');
  const [queueLoading, setQueueLoading] = useState(false);
  const [sendingQueueMsg, setSendingQueueMsg] = useState(false);

  // Consent-based Visitor Co-Browsing (strictly telemetry: route + scrollPct + viewport, NO voice-to-text)
  const [coBrowseShared, setCoBrowseShared] = useState(false);
  const [coBrowseBusy, setCoBrowseBusy] = useState(false);
  const [coBrowseGuide, setCoBrowseGuide] = useState(null);

  // Automated CSAT Survey when live chat closes
  const [csatOpen, setCsatOpen] = useState(false);
  const [csatRating, setCsatRating] = useState(0);
  const [csatHover, setCsatHover] = useState(0);
  const [csatTags, setCsatTags] = useState([]);
  const [csatComment, setCsatComment] = useState('');
  const [csatSubmitting, setCsatSubmitting] = useState(false);
  const [csatSubmittedForChatId, setCsatSubmittedForChatId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const lastCoBrowseSentAtRef = useRef(0);
  const isTypingRef = useRef(false);
  useEffect(() => {
    isTypingRef.current = isTyping;
  }, [isTyping]);

  const isLoggedIn = Boolean(currentUser && (currentUser.id || currentUser.tiwiId || currentUser.email));
  const userName = isLoggedIn
    ? currentUser?.name || currentUser?.storeName?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'Store Owner'
    : guestSession?.visitorName || guestSession?.name || guestSession?.fullName || 'Guest';
  const userEmail = isLoggedIn
    ? currentUser?.email || ''
    : guestSession?.visitorEmail || guestSession?.email || '';
  const storeName = isLoggedIn ? currentUser?.storeName || '' : '';
  const userId = isLoggedIn ? currentUser?.id || currentUser?.tiwiId || 'user' : 'guest';

  const persistWidgetSession = useCallback((sessionData) => {
    try {
      if (sessionData) {
        sessionStorage.setItem(WIDGET_SESSION_STORAGE_KEY, JSON.stringify(sessionData));
      } else {
        sessionStorage.removeItem(WIDGET_SESSION_STORAGE_KEY);
      }
    } catch {}
  }, []);

  const navigateSupportRoute = useCallback(
    (subRoute) => {
      if (onNavigateSupport) {
        onNavigateSupport(subRoute);
      } else {
        const path = subRoute ? `/help-support/${subRoute}` : '/help-support';
        window.history.pushState(null, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
      setIsOpen(false);
    },
    [onNavigateSupport]
  );

  // Fetch public support config + initial live-chat status
  const refreshConfigAndQueueStatus = useCallback(async (chatIdOverride = null) => {
    try {
      const savedLiveId =
        chatIdOverride ||
        liveQueueChat?.id ||
        (() => {
          try {
            return sessionStorage.getItem(LIVE_CHAT_STORAGE_KEY) || '';
          } catch {
            return '';
          }
        })();

      const statusUrl = savedLiveId
        ? `/api/support/live-chat/status?chatId=${encodeURIComponent(savedLiveId)}`
        : '/api/support/live-chat/status';

      const [cfgRes, statusRes] = await Promise.all([
        fetch('/api/support/config', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
        fetch(statusUrl, { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      ]);

      if (cfgRes) {
        setSupportConfig((prev) => ({ ...prev, ...(cfgRes.config || cfgRes) }));
      }

      if (statusRes) {
        if (statusRes.queue) {
          setLiveQueueStats((prev) => ({ ...prev, ...statusRes.queue }));
        }
        if (statusRes.chat) {
          setLiveQueueChat(statusRes.chat);
          if (Array.isArray(statusRes.messages)) {
            setLiveQueueMessages(statusRes.messages);
          }
          const cb = statusRes.chat.coBrowsing || statusRes.chat.coBrowsingState || null;
          const guide =
            statusRes.chat.coBrowseGuide ||
            statusRes.coBrowseGuide ||
            (cb?.agentGuidanceNote || cb?.highlightSelector
              ? {
                  note: cb.agentGuidanceNote || '',
                  selector: cb.highlightSelector || '',
                }
              : null) ||
            (statusRes.chat.guidanceNote || statusRes.chat.guideSelector
              ? {
                  note: statusRes.chat.guidanceNote || '',
                  selector: statusRes.chat.guideSelector || '',
                }
              : null);
          if (guide && (guide.note || guide.selector)) {
            setCoBrowseGuide(guide);
          }
          if (normalizeStatus(statusRes.chat.status) === 'closed') {
            setCoBrowseShared(false);
            if (csatSubmittedForChatId !== statusRes.chat.id && !statusRes.chat.csatSubmitted) {
              setCsatOpen(true);
            }
          }
        }
      }
    } finally {
      setConfigLoaded(true);
    }
  }, [liveQueueChat?.id, csatSubmittedForChatId]);

  const initialFetchDoneRef = useRef(false);
  useEffect(() => {
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    refreshConfigAndQueueStatus();
  }, [refreshConfigAndQueueStatus]); // initial fetch on mount

  // Poll queue status while widget is open and user has a live queue chat
  useEffect(() => {
    if (!isOpen || widgetView !== 'queue-chat' || !liveQueueChat?.id) return undefined;
    if (normalizeStatus(liveQueueChat.status) === 'closed') return undefined;
    refreshConfigAndQueueStatus(liveQueueChat.id);
    const timer = window.setInterval(() => {
      refreshConfigAndQueueStatus(liveQueueChat.id);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [isOpen, widgetView, liveQueueChat?.id, liveQueueChat?.status, refreshConfigAndQueueStatus]);

  // Fetch guest session if not logged in
  useEffect(() => {
    if (isLoggedIn) {
      setGuestSession(null);
      return;
    }
    fetch('/api/support/guest/session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const rawSess = data?.guestSession || data?.session || (data?.verified ? data : null);
        const sess = normalizeGuestSession(rawSess);
        if (sess) {
          setGuestSession(sess);
        }
      })
      .catch(() => {});
  }, [isLoggedIn]);

  // Restore saved widget session on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(WIDGET_SESSION_STORAGE_KEY) || 'null');
      if (saved?.activeConvId) {
        setActiveConvId(saved.activeConvId);
        if (saved.ticketInfo) setTicketInfo(saved.ticketInfo);
        if (saved.assignedAgent) setAssignedAgent(saved.assignedAgent);
        if (Array.isArray(saved.messages)) setMessages(saved.messages);
        if (saved.currentTier) setCurrentTier(saved.currentTier);
      }
    } catch {}
  }, []);

  const loadUserSupportData = useCallback(async () => {
    if (!isLoggedIn && !guestSession) {
      setUserConversations([]);
      return;
    }
    try {
      const url = isLoggedIn
        ? `/api/support/conversations?userId=${encodeURIComponent(userId)}`
        : '/api/support/conversations';
      const convsRes = await fetch(url, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (Array.isArray(convsRes?.conversations)) {
        setUserConversations(convsRes.conversations);
        if (activeConvId) {
          const matched = convsRes.conversations.find((c) => c.id === activeConvId);
          if (matched) {
            if (Array.isArray(matched.messages) && matched.messages.length > 0) {
              setMessages(matched.messages);
            }
            if (matched.ticketId || matched.ticket) {
              setTicketInfo((prev) => ({
                ...(prev || {}),
                ticketId: matched.ticketId || matched.ticket?.ticketId || matched.ticket?.id,
                serialNumber:
                  matched.serialNumber ||
                  matched.ticket?.serialNumber ||
                  `#${matched.ticketId || matched.ticket?.id}`,
                status: matched.ticketStatus || matched.ticket?.status || prev?.status || 'OPEN',
              }));
            }
          }
        }
      }
    } catch (e) {
      console.warn('Error loading support data:', e);
    }
  }, [isLoggedIn, guestSession, userId, activeConvId]);

  useEffect(() => {
    loadUserSupportData();
  }, [loadUserSupportData]);

  // Poll active AI/ticket-linked chat every 5s so human ticket replies appear automatically
  useEffect(() => {
    if (!isOpen || widgetView !== 'chat' || !activeConvId) return undefined;
    if (normalizeStatus(ticketInfo?.status) === 'closed') return undefined;
    const timer = window.setInterval(() => {
      if (!isTypingRef.current) {
        loadUserSupportData();
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [isOpen, widgetView, activeConvId, ticketInfo?.status, loadUserSupportData]);

  useEffect(() => {
    if (isOpen && !minimized && (widgetView === 'chat' || widgetView === 'queue-chat')) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, liveQueueMessages, isTyping, isTransferring, isOpen, minimized, widgetView]);

  useEffect(() => {
    const handleGlobalTrigger = () => {
      setIsOpen(true);
      setMinimized(false);
      if (liveQueueChat?.id) {
        setWidgetView('queue-chat');
      } else {
        setWidgetView(activeConvId ? 'chat' : 'home');
      }
    };
    window.addEventListener('tiwlo:open-support', handleGlobalTrigger);
    return () => window.removeEventListener('tiwlo:open-support', handleGlobalTrigger);
  }, [activeConvId, liveQueueChat?.id]);

  // Consent-based Co-Browsing telemetry emitter (safe route + scrollPct + viewport ONLY; NO voice-to-text)
  const pushCoBrowseTelemetry = useCallback(
    async (consentFlag) => {
      const chatId = liveQueueChat?.id;
      if (!chatId) return;
      const now = Date.now();
      if (consentFlag && now - lastCoBrowseSentAtRef.current < 1500) return;
      lastCoBrowseSentAtRef.current = now;

      try {
        await fetch('/api/support/live-chat/co-browse', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId,
            consent: Boolean(consentFlag),
            route:
              typeof window !== 'undefined'
                ? `${window.location.pathname}${window.location.search}`
                : '/',
            scrollPct: computeScrollPct(),
            viewport:
              typeof window !== 'undefined'
                ? { width: window.innerWidth, height: window.innerHeight }
                : { width: 0, height: 0 },
          }),
        });
      } catch {
        // Endpoint may be disabled in sandbox; keep local consent UX responsive
      }
    },
    [liveQueueChat?.id]
  );

  useEffect(() => {
    if (!coBrowseShared || !liveQueueChat?.id || normalizeStatus(liveQueueChat?.status) === 'closed') {
      return undefined;
    }
    pushCoBrowseTelemetry(true);

    const onScrollOrResize = () => pushCoBrowseTelemetry(true);
    const onPopState = () => pushCoBrowseTelemetry(true);

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('popstate', onPopState);
    const interval = window.setInterval(() => pushCoBrowseTelemetry(true), 6000);

    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('popstate', onPopState);
      window.clearInterval(interval);
    };
  }, [coBrowseShared, liveQueueChat?.id, liveQueueChat?.status, pushCoBrowseTelemetry]);

  // Safe DOM step highlight when agent sends co-browse guidance selector
  useEffect(() => {
    if (!coBrowseShared || !coBrowseGuide?.selector) return undefined;
    try {
      const selector = String(coBrowseGuide.selector).trim();
      if (!selector || selector.length > 120) return undefined;
      const target = document.querySelector(selector);
      if (!target) return undefined;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const prevOutline = target.style.outline;
      const prevOutlineOffset = target.style.outlineOffset;
      target.style.outline = '2px solid #1ED760';
      target.style.outlineOffset = '4px';
      return () => {
        target.style.outline = prevOutline;
        target.style.outlineOffset = prevOutlineOffset;
      };
    } catch {
      return undefined;
    }
  }, [coBrowseShared, coBrowseGuide?.selector]);

  const handleToggleCoBrowse = async (nextConsent) => {
    if (!liveQueueChat?.id || coBrowseBusy) return;
    setCoBrowseBusy(true);
    setCoBrowseShared(nextConsent);
    if (!nextConsent) {
      setCoBrowseGuide(null);
    }
    try {
      await fetch('/api/support/live-chat/co-browse', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: liveQueueChat.id,
          consent: nextConsent,
          route: `${window.location.pathname}${window.location.search}`,
          scrollPct: computeScrollPct(),
          viewport: { width: window.innerWidth, height: window.innerHeight },
        }),
      });
    } catch {
      // Ignore transient network errors cleanly
    } finally {
      setCoBrowseBusy(false);
    }
  };

  const navigateToTicketDetail = (ticketIdValue) => {
    if (!ticketIdValue) return;
    const cleanId = String(ticketIdValue).replace(/^#/, '');
    navigateSupportRoute(`ticket/${encodeURIComponent(cleanId)}`);
  };

  const startLiveQueueChat = async (initialPrompt = null, verifiedGuest = null) => {
    if (supportConfig?.liveChatBlocked) return;
    const activeGuest = verifiedGuest || guestSession;
    if (!isLoggedIn && !activeGuest) {
      setPendingMode('queue');
      setPendingStarterPrompt(typeof initialPrompt === 'string' ? initialPrompt : null);
      setWidgetView('guest-gate');
      return;
    }

    setQueueLoading(true);
    setWidgetView('queue-chat');
    setShowHistoryDrawer(false);
    try {
      const res = await fetch('/api/support/live-chat/request', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestName: isLoggedIn
            ? userName
            : activeGuest?.visitorName || activeGuest?.name || activeGuest?.fullName || 'Guest',
          guestEmail: isLoggedIn
            ? userEmail
            : activeGuest?.visitorEmail || activeGuest?.email || '',
          guestPhone: isLoggedIn
            ? currentUser?.phone || ''
            : activeGuest?.visitorPhone || activeGuest?.phone || '',
          topic: typeof initialPrompt === 'string' && initialPrompt.trim() ? initialPrompt.trim().slice(0, 80) : 'Live Specialist Queue',
          department: 'General Support',
          initialMessage:
            typeof initialPrompt === 'string' && initialPrompt.trim()
              ? initialPrompt.trim()
              : 'Hello, I would like to connect with a human support specialist.',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.liveChatBlocked || res.status === 403) {
          setSupportConfig((prev) => ({ ...prev, liveChatBlocked: true }));
          setWidgetView('home');
          return;
        }
        throw new Error(data?.error || 'Could not enter live chat queue.');
      }
      if (data?.chat) {
        setLiveQueueChat(data.chat);
        try {
          sessionStorage.setItem(LIVE_CHAT_STORAGE_KEY, data.chat.id);
        } catch {}
      }
      if (Array.isArray(data?.messages)) {
        setLiveQueueMessages(data.messages);
      }
      if (data?.queue) {
        setLiveQueueStats((prev) => ({ ...prev, ...data.queue }));
      }
      setCsatOpen(false);
    } catch (err) {
      setActionNotice(err.message || 'Could not connect to live support queue.');
      setTimeout(() => setActionNotice(null), 5000);
    } finally {
      setQueueLoading(false);
    }
  };

  const handleSendQueueMessage = async (e) => {
    e?.preventDefault();
    const text = queueInputText.trim();
    if (!text || sendingQueueMsg || !liveQueueChat?.id) return;
    if (normalizeStatus(liveQueueChat.status) === 'closed') return;

    setQueueInputText('');
    setSendingQueueMsg(true);
    try {
      const res = await fetch('/api/support/live-chat/messages', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: liveQueueChat.id,
          message: text,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.messages)) {
        setLiveQueueMessages(data.messages);
      } else if (data?.message) {
        setLiveQueueMessages((prev) => [...prev, data.message]);
      }
      if (data?.chat) setLiveQueueChat(data.chat);
      if (data?.queue) setLiveQueueStats((prev) => ({ ...prev, ...data.queue }));
    } catch {
      setActionNotice('Message queued. Refreshing chat status...');
      setTimeout(() => setActionNotice(null), 3500);
    } finally {
      setSendingQueueMsg(false);
    }
  };

  const handleEndLiveQueueChat = async () => {
    if (!liveQueueChat?.id) return;
    try {
      if (coBrowseShared) {
        await pushCoBrowseTelemetry(false);
        setCoBrowseShared(false);
      }
      const res = await fetch('/api/support/live-chat/end', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: liveQueueChat.id }),
      });
      const data = await res.json().catch(() => ({}));
      const closedChat = data?.chat || { ...liveQueueChat, status: 'closed' };
      setLiveQueueChat(closedChat);
      setCsatOpen(true);
    } catch {
      setLiveQueueChat((prev) => (prev ? { ...prev, status: 'closed' } : prev));
      setCsatOpen(true);
    }
  };

  const handleSubmitCsat = async (e) => {
    e.preventDefault();
    if (!csatRating || csatSubmitting) return;
    setCsatSubmitting(true);
    const targetChatId = liveQueueChat?.id || null;
    try {
      await fetch('/api/support/csat-survey', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: targetChatId,
          ticketId: ticketInfo?.ticketId || ticketInfo?.id || undefined,
          rating: csatRating,
          tags: csatTags,
          comment: csatComment.trim(),
        }),
      });
    } catch {
      // Acknowledge cleanly even if optional telemetry endpoint is unavailable
    } finally {
      setCsatSubmittedForChatId(targetChatId || 'submitted');
      setCsatOpen(false);
      setCsatSubmitting(false);
      setActionNotice('Thank you for rating your support experience!');
      setTimeout(() => setActionNotice(null), 5000);
    }
  };

  const dispatchUserMessage = async (userText, ticketIdOverride, sessionIdOverride, agentOverride) => {
    const activeTicket = ticketIdOverride || ticketInfo?.ticketId || null;
    const activeSession = sessionIdOverride || activeConvId;
    const currentAgent = agentOverride || assignedAgent;

    if (normalizeStatus(ticketInfo?.status) === 'closed') return;

    const newMsg = {
      id: nextWidgetMsgId('msg_u'),
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => {
      const next = [...prev, newMsg];
      persistWidgetSession({
        activeConvId: activeSession,
        ticketInfo,
        assignedAgent: currentAgent,
        currentTier,
        messages: next,
      });
      return next;
    });
    setIsTyping(true);

    try {
      const res = await fetch('/api/support/message', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': activeSession || '',
        },
        body: JSON.stringify({
          isLoggedIn,
          agentName: currentAgent?.name || 'Support Specialist',
          agentRole: currentAgent?.tierTitle || 'Support Specialist',
          userId,
          userName,
          userEmail,
          currentTier,
          message: userText,
          activeTicketId: activeTicket,
          conversationHistory: messages,
          sessionId: activeSession,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.reply) {
        const agentMsg = {
          id: nextWidgetMsgId('msg_a'),
          sender: 'agent',
          agentName: currentAgent?.name || 'Support Specialist',
          avatar: currentAgent?.avatar || null,
          tierTitle: currentAgent?.tierTitle || 'Support Specialist',
          text: data.reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => {
          const next = [...prev, agentMsg];
          persistWidgetSession({
            activeConvId: activeSession,
            ticketInfo,
            assignedAgent: currentAgent,
            currentTier,
            messages: next,
          });
          return next;
        });

        if (data?.actionExecuted) {
          setActionNotice(data.actionExecuted.message);
          setTimeout(() => setActionNotice(null), 7000);
          loadUserSupportData();
        }
        if (data.shouldOfferTransfer && data.transferToTier && data.transferToTier > currentTier) {
          setTimeout(() => handleTransferTier(data.transferToTier), 1200);
        }
      }
    } catch {
      const fallbackMsg = {
        id: nextWidgetMsgId('msg_err'),
        sender: 'agent',
        agentName: currentAgent?.name || 'Support Specialist',
        text: `Thank you for your message, ${userName}. Your request has been recorded${activeTicket ? ` under ${activeTicket}` : ''}.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const initiateChatSession = async (initialPrompt = null, verifiedGuest = null) => {
    if (supportConfig?.liveChatBlocked) return;
    if (supportConfig?.aiAutoReplyEnabled === false) {
      await startLiveQueueChat(initialPrompt, verifiedGuest);
      return;
    }

    const activeGuest = verifiedGuest || guestSession;
    if (!isLoggedIn && !activeGuest) {
      setPendingMode('ai');
      setPendingStarterPrompt(typeof initialPrompt === 'string' ? initialPrompt : null);
      setWidgetView('guest-gate');
      return;
    }

    setIsTyping(true);
    setWidgetView('chat');
    setShowHistoryDrawer(false);

    const displayName = isLoggedIn
      ? userName
      : activeGuest?.visitorName || activeGuest?.name || activeGuest?.fullName || 'Guest';

    try {
      const res = await fetch('/api/support/initiate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLoggedIn,
          userName: displayName,
          userId,
          userEmail: isLoggedIn ? userEmail : activeGuest?.visitorEmail || activeGuest?.email || '',
          storeName,
          channel: 'Widget',
          initialSubject:
            typeof initialPrompt === 'string'
              ? initialPrompt
              : isLoggedIn
              ? `Support Request (${displayName})`
              : `Guest Inquiry (${displayName})`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data?.sessionId) {
        const nextTicket = data.ticket || null;
        const nextAgent = data.agent || { name: 'Support Specialist', tierTitle: 'Tier-1 Specialist' };
        const initialMessages = [
          {
            id: 'msg_welcome',
            sender: 'agent',
            agentName: nextAgent.name,
            avatar: nextAgent.avatar,
            tierTitle: nextAgent.tierTitle,
            text: data.welcomeGreeting || `Hello ${displayName}! How can we assist you today?`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ];

        setActiveConvId(data.sessionId);
        setTicketInfo(nextTicket);
        setAssignedAgent(nextAgent);
        setCurrentTier(1);
        setMessages(initialMessages);
        persistWidgetSession({
          activeConvId: data.sessionId,
          ticketInfo: nextTicket,
          assignedAgent: nextAgent,
          currentTier: 1,
          messages: initialMessages,
        });

        loadUserSupportData();

        if (typeof initialPrompt === 'string' && initialPrompt.trim()) {
          setTimeout(() => {
            dispatchUserMessage(initialPrompt.trim(), nextTicket?.ticketId, data.sessionId, nextAgent);
          }, 300);
        }
      }
    } catch (err) {
      console.warn('Failed to initiate support session:', err);
    } finally {
      setIsTyping(false);
    }
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
      const verified = normalizeGuestSession(
        data?.guestSession ||
          data?.session || {
            visitorName: name,
            visitorEmail: email,
            visitorPhone: phone,
            name,
            fullName: name,
            email,
            phone,
            verified: true,
          }
      );
      setGuestSession(verified);
      const starter = pendingStarterPrompt;
      const mode = pendingMode;
      setPendingStarterPrompt(null);
      setPendingMode('ai');
      if (mode === 'queue') {
        await startLiveQueueChat(starter, verified);
      } else {
        await initiateChatSession(starter, verified);
      }
    } catch (err) {
      setGuestError(err.message || 'Verification failed.');
    } finally {
      setVerifyingGuest(false);
    }
  };

  const handleSelectConversation = (conv) => {
    setActiveConvId(conv.id);
    setWidgetView('chat');
    setShowHistoryDrawer(false);
    const msgs =
      Array.isArray(conv.messages) && conv.messages.length > 0
        ? conv.messages
        : [
            {
              id: 'msg_conv_init',
              sender: 'agent',
              agentName: conv.name || 'Support Specialist',
              tierTitle: conv.role || 'Specialist',
              text: `Resumed conversation${conv.serialNumber ? ` (${conv.serialNumber})` : ''}. How can we help?`,
              time: conv.time || 'Today',
            },
          ];
    setMessages(msgs);
    const nextTicket = conv.ticketId
      ? {
          ticketId: conv.ticketId,
          serialNumber: conv.serialNumber || (String(conv.ticketId).startsWith('#') ? conv.ticketId : `#${conv.ticketId}`),
          status: conv.ticketStatus || conv.status || 'OPEN',
        }
      : null;
    setTicketInfo(nextTicket);
    persistWidgetSession({
      activeConvId: conv.id,
      ticketInfo: nextTicket,
      assignedAgent,
      currentTier,
      messages: msgs,
    });
  };

  const handleTransferTier = async (targetTier) => {
    if (isTransferring || !assignedAgent) return;
    setIsTransferring(true);
    setTransferNotice(
      targetTier === 2
        ? 'Transferring to Tier-2 Technical Cloud Operations...'
        : 'Escalating to Tier-3 Senior Systems Architect...'
    );
    try {
      const res = await fetch('/api/support/transfer', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTier,
          currentAgentId: assignedAgent.id,
          userName,
        }),
      });
      const data = await res.json().catch(() => ({}));
      setTimeout(() => {
        setIsTransferring(false);
        setTransferNotice('');
        if (data?.agent) {
          setAssignedAgent(data.agent);
          setCurrentTier(data.newTier);
          setMessages((prev) => [
            ...prev,
            {
              id: `handover_${Date.now()}`,
              isSystemNotice: true,
              text: `Reassigned to ${data.agent.name} (${data.agent.tierTitle})`,
            },
            {
              id: `msg_intro_${Date.now()}`,
              sender: 'agent',
              agentName: data.agent.name,
              avatar: data.agent.avatar,
              tierTitle: data.agent.tierTitle,
              text: data.introGreeting,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            },
          ]);
        }
      }, 650);
    } catch {
      setIsTransferring(false);
      setTransferNotice('');
    }
  };

  const handleConvertToTicket = async () => {
    if (!activeConvId || convertingTicket || supportConfig?.allowNewTicketCreation === false) return;
    setConvertingTicket(true);
    try {
      const res = await fetch(`/api/support/conversations/${encodeURIComponent(activeConvId)}/convert-to-ticket`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: ticketInfo?.subject || 'Live Support Inquiry',
          category: 'General Inquiry',
          priority: 'MEDIUM',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ticket) {
        throw new Error(data?.error || 'Could not convert to official ticket');
      }
      const created = data.ticket;
      const recoveryCode = data.guestRecoveryCode || data.recoveryCode || created.guestRecoveryCode || '';
      const createdId = created.ticketId || created.id;
      if (recoveryCode && createdId) {
        try {
          sessionStorage.setItem(`tiwlo.support.recovery.${createdId}`, recoveryCode);
        } catch {}
      }
      setTicketInfo(created);
      setActionNotice(`Official ticket ${created.serialNumber || `#${createdId}`} created!`);
      setTimeout(() => setActionNotice(null), 6000);
      persistWidgetSession({
        activeConvId,
        ticketInfo: created,
        assignedAgent,
        currentTier,
        messages,
      });
    } catch (err) {
      setActionNotice(err.message || 'Ticket conversion failed');
      setTimeout(() => setActionNotice(null), 4000);
    } finally {
      setConvertingTicket(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isTyping || isTransferring) return;
    if (!isLoggedIn && !guestSession) {
      setWidgetView('guest-gate');
      return;
    }
    if (normalizeStatus(ticketInfo?.status) === 'closed') return;
    const text = inputText.trim();
    setInputText('');
    await dispatchUserMessage(text);
  };

  if (configLoaded && supportConfig?.liveChatWidgetEnabled === false) {
    return null;
  }

  const isBlocked = Boolean(supportConfig?.liveChatBlocked);
  const isClosed = normalizeStatus(ticketInfo?.status) === 'closed';
  const isLiveQueueClosed = normalizeStatus(liveQueueChat?.status) === 'closed';
  const linkedTicketId = ticketInfo?.ticketId || ticketInfo?.id;
  const linkedSerial = ticketInfo?.serialNumber || (linkedTicketId ? `#${linkedTicketId}` : '');
  const aiOff = supportConfig?.aiAutoReplyEnabled === false;

  if (isOpen && minimized) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 max-w-[calc(100vw-32px)]">
        <button
          type="button"
          onClick={() => setMinimized(false)}
          className={`flex items-center gap-2 rounded-full border bg-neutral-950 dark:bg-neutral-900 px-4 py-2.5 text-white shadow-lg transition hover:bg-neutral-900 cursor-pointer ${
            coBrowseShared
              ? 'border-[#1ED760] ring-2 ring-[#1ED760]/40 animate-pulse'
              : 'border-neutral-200 dark:border-neutral-800'
          }`}
        >
          <span className="h-2 w-2 rounded-full bg-[#1ED760]" />
          <span className="text-xs font-semibold">
            {coBrowseShared ? 'Co-Browse Active · Support' : 'Tiwlo Support'}
          </span>
          {linkedSerial && (
            <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[10px]">
              {linkedSerial}
            </span>
          )}
        </button>
      </div>
    );
  }

  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            setMinimized(false);
            if (isBlocked) {
              setWidgetView('home');
            } else if (liveQueueChat?.id) {
              setWidgetView('queue-chat');
            } else {
              setWidgetView(activeConvId ? 'chat' : 'home');
            }
          }}
          className={`flex h-13 w-13 sm:h-14 sm:w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 cursor-pointer ${
            isBlocked
              ? 'bg-neutral-900 text-white hover:bg-neutral-800'
              : 'bg-[#1ED760] hover:bg-[#19c355] text-neutral-950'
          }`}
          title="Tiwlo Support"
          aria-label="Open Tiwlo Support"
        >
          {isBlocked ? <ShieldAlert className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        </button>
      </div>
    );
  }

  return (
    <div
      className={`fixed inset-0 h-[100dvh] w-full rounded-none border-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 flex flex-col overflow-hidden sm:rounded-2xl bg-white dark:bg-neutral-950 shadow-2xl transition-all ${
        coBrowseShared
          ? 'sm:border-2 sm:border-[#1ED760] sm:ring-4 sm:ring-[#1ED760]/20'
          : 'sm:border sm:border-neutral-200/80 dark:sm:border-neutral-800'
      } ${
        widgetView === 'home' || widgetView === 'guest-gate'
          ? 'sm:w-[390px] sm:h-[580px] sm:max-h-[640px]'
          : 'sm:w-[420px] sm:h-[640px] sm:max-h-[680px]'
      }`}
    >
      {/* VIEW 1: HOME */}
      {widgetView === 'home' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1ED760] text-neutral-950">
                <Headphones className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-neutral-950 dark:text-white">Tiwlo Support</span>
                  {!isBlocked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#1ED760]/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#1ED760]" />
                      {liveQueueStats.onlineAgentsCount > 0
                        ? `${liveQueueStats.onlineAgentsCount} Online`
                        : 'Live'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!isBlocked && (isLoggedIn || guestSession) && (
                <button
                  type="button"
                  onClick={() => setWidgetView('history')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 hover:text-neutral-900 dark:hover:text-neutral-100 cursor-pointer"
                  title="Conversations"
                >
                  <Clock className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
                title="Minimize"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-1 flex-col justify-between overflow-y-auto p-5 space-y-4">
            {isBlocked ? (
              <div className="flex flex-1 flex-col justify-between space-y-4">
                <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/25 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <Ban className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-semibold">Live Chat Unavailable</span>
                  </div>
                  <p className="text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                    Live specialist chat is unavailable for restricted or high-risk accounts. Please open or track a formal Support Appeal Ticket so a compliance specialist can review your account.
                  </p>
                </div>

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => navigateSupportRoute('create-ticket')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-2.5 text-xs font-semibold text-neutral-950 transition cursor-pointer"
                  >
                    <Ticket className="h-4 w-4" />
                    <span>Open Support Appeal Ticket</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateSupportRoute('tickets')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-4 py-2 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>View My Appeal Tickets</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {/* Session Context Pill */}
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 dark:bg-white text-xs font-semibold text-white dark:text-neutral-950">
                        {isLoggedIn ? (userName[0]?.toUpperCase() || 'U') : guestSession ? 'G' : '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {isLoggedIn ? userName : guestSession ? 'Guest Session Active' : 'Guest Visitor'}
                        </p>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                          {isLoggedIn
                            ? storeName || userEmail || 'Verified Account'
                            : guestSession
                            ? `${guestSession.visitorEmail || guestSession.email || ''}${
                                guestSession.visitorPhone || guestSession.phone
                                  ? ` · ${guestSession.visitorPhone || guestSession.phone}`
                                  : ''
                              }`
                            : 'Contact verification required before chat'}
                        </p>
                      </div>
                    </div>
                    <ShieldCheck className={`h-4 w-4 shrink-0 ${isLoggedIn || guestSession ? 'text-[#1ED760]' : 'text-neutral-400'}`} />
                  </div>

                  {/* Queue Availability Bar */}
                  <div className="flex items-center justify-between rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900/60 px-3 py-2 text-[11px]">
                    <div className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-300">
                      <Users className="h-3.5 w-3.5 text-[#1ED760]" />
                      <span className="tabular-nums font-medium">
                        {liveQueueStats.onlineAgentsCount} Online · {liveQueueStats.freeAgentsCount} Available
                      </span>
                    </div>
                    <span className="text-[10px] font-medium text-neutral-500 dark:text-neutral-400 tabular-nums">
                      Queue: {liveQueueStats.totalWaiting || 0} waiting
                    </span>
                  </div>

                  {aiOff && (
                    <div className="rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-2 text-[11px] font-medium text-emerald-800 dark:text-emerald-300">
                      Your live chat has been transferred to our human support queue
                    </div>
                  )}

                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-neutral-950 dark:text-white">
                      {isLoggedIn || guestSession ? `Hi ${userName},` : 'Welcome to Tiwlo Support'}
                    </h2>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                      Chat with Tiwi Support, join the live specialist queue, or track formal tickets.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      Quick topics
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(isLoggedIn ? PROMPT_SUGGESTIONS : GUEST_PROMPTS).map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => initiateChatSession(item.prompt)}
                          className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-1.5 text-[11px] font-medium text-neutral-800 dark:text-neutral-200 hover:border-[#1ED760] transition cursor-pointer"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-neutral-200/80 dark:border-neutral-800 pt-3">
                  <button
                    type="button"
                    onClick={() => initiateChatSession()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-2.5 text-xs font-semibold text-neutral-950 transition cursor-pointer"
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>
                      {aiOff
                        ? 'Join Human Support Queue'
                        : isLoggedIn || guestSession
                        ? 'Start Support Chat'
                        : 'Verify & Start Chat'}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>

                  {!aiOff && (
                    <button
                      type="button"
                      onClick={() => startLiveQueueChat()}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 py-2 text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
                    >
                      <Headphones className="h-3.5 w-3.5 text-[#1ED760]" />
                      Connect to Live Human Queue
                    </button>
                  )}

                  {(isLoggedIn || guestSession) && userConversations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setWidgetView('history')}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 py-1.5 text-[11px] font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900 cursor-pointer"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      View conversations ({userConversations.length})
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: GUEST VERIFICATION GATE */}
      {widgetView === 'guest-gate' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWidgetView('home')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-neutral-950 dark:text-white">Guest Verification</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleVerifyGuest} className="flex flex-1 flex-col justify-between overflow-y-auto p-5 space-y-4">
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3">
                <ShieldCheck className="h-4 w-4 shrink-0 text-[#1ED760] mt-0.5" />
                <p className="text-xs text-neutral-600 dark:text-neutral-300">
                  Please confirm your name, email, and phone number before starting live chat.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">Full Name</label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">Email Address</label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-700 dark:text-neutral-300">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+1 555 234 5678"
                  className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                />
              </div>

              {guestError && <p className="text-xs font-medium text-red-600 dark:text-red-400">{guestError}</p>}
            </div>

            <button
              type="submit"
              disabled={verifyingGuest}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1ED760] hover:bg-[#19c355] py-2.5 text-xs font-semibold text-neutral-950 disabled:opacity-50 cursor-pointer"
            >
              {verifyingGuest ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
              {verifyingGuest ? 'Verifying...' : 'Verify & Start Chat'}
            </button>
          </form>
        </div>
      )}

      {/* VIEW 3: HISTORY */}
      {widgetView === 'history' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setWidgetView('home')}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h3 className="text-xs font-semibold text-neutral-950 dark:text-white">Your Conversations</h3>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
            {userConversations.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">No conversations yet.</div>
            ) : (
              userConversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => handleSelectConversation(conv)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3 text-left hover:border-[#1ED760] transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {conv.name || 'Support Conversation'}
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {conv.time || 'Recent'} {conv.serialNumber ? `· ${conv.serialNumber}` : ''}
                    </p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-400" />
                </button>
              ))
            )}
          </div>

          <div className="border-t border-neutral-200/80 dark:border-neutral-800 p-3.5">
            <button
              type="button"
              onClick={() => initiateChatSession()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] py-2 text-xs font-semibold text-neutral-950 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              New Conversation
            </button>
          </div>
        </div>
      )}

      {/* VIEW 4: ACTIVE HUMAN LIVE QUEUE + CO-BROWSING + CSAT */}
      {widgetView === 'queue-chat' && (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setWidgetView('home')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1ED760]/15 text-[#16a34a] dark:text-[#1ED760]">
                <Headphones className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-950 dark:text-white truncate">
                  {liveQueueChat?.assignedAgentName || 'Human Support Queue'}
                </p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate tabular-nums">
                  {liveQueueStats.onlineAgentsCount} Online · {liveQueueStats.freeAgentsCount} Available
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!isLiveQueueClosed && liveQueueChat?.id && (
                <button
                  type="button"
                  onClick={handleEndLiveQueueChat}
                  className="rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:border-red-300 hover:text-red-600 cursor-pointer"
                >
                  End Chat
                </button>
              )}
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Queue Serial Position & AI-Off Explicit Notice */}
          <div className="border-b border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 py-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
                <Clock className="h-3.5 w-3.5 text-[#1ED760]" />
                {normalizeStatus(liveQueueChat?.status) === 'waiting' || liveQueueStats.queuePosition
                  ? `Queue Position #${liveQueueStats.queuePosition || 1}`
                  : isLiveQueueClosed
                  ? 'Session Closed'
                  : 'Connected to Specialist'}
              </span>
              {liveQueueChat?.serialNumber && (
                <span className="rounded bg-neutral-200/70 dark:bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-neutral-700 dark:text-neutral-300">
                  {liveQueueChat.serialNumber}
                </span>
              )}
            </div>
            {aiOff && (
              <p className="text-[11px] font-medium text-emerald-700 dark:text-[#1ED760]">
                Your live chat has been transferred to our human support queue
              </p>
            )}
          </div>

          {/* Consent-Based Co-Browsing Control Bar (NO voice-to-text) */}
          {!isLiveQueueClosed && liveQueueChat?.id && (
            <div
              className={`border-b px-3.5 py-2 transition-colors ${
                coBrowseShared
                  ? 'border-[#1ED760]/40 bg-emerald-50/70 dark:bg-emerald-950/30'
                  : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Monitor className={`h-3.5 w-3.5 shrink-0 ${coBrowseShared ? 'text-[#16a34a] dark:text-[#1ED760]' : 'text-neutral-400'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                        Share Current Screen View / Co-Browse with Agent
                      </span>
                    </div>
                    {coBrowseShared && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-[#1ED760]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#1ED760] animate-ping" />
                        Consent Active · Route & Scroll Synced
                      </span>
                    )}
                  </div>
                </div>
                {coBrowseShared ? (
                  <button
                    type="button"
                    disabled={coBrowseBusy}
                    onClick={() => handleToggleCoBrowse(false)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-200 dark:border-red-900 bg-white dark:bg-neutral-900 px-2 py-1 text-[10px] font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 cursor-pointer"
                  >
                    <PauseCircle className="h-3 w-3" />
                    Pause / Revoke
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={coBrowseBusy}
                    onClick={() => handleToggleCoBrowse(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-neutral-900 dark:bg-white px-2.5 py-1 text-[10px] font-semibold text-white dark:text-neutral-950 hover:opacity-90 cursor-pointer"
                  >
                    <Eye className="h-3 w-3" />
                    Allow Co-Browse
                  </button>
                )}
              </div>

              {coBrowseShared && coBrowseGuide && (coBrowseGuide.note || coBrowseGuide.selector) && (
                <div className="mt-2 rounded-lg border border-[#1ED760]/40 bg-white dark:bg-neutral-900 p-2 text-[11px] text-neutral-800 dark:text-neutral-200">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-emerald-700 dark:text-[#1ED760]">
                      Specialist Guided Step
                    </span>
                    <button
                      type="button"
                      onClick={() => setCoBrowseGuide(null)}
                      className="text-neutral-400 hover:text-neutral-600 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {coBrowseGuide.note && <p className="mt-0.5">{coBrowseGuide.note}</p>}
                  {coBrowseGuide.selector && (
                    <p className="mt-0.5 font-mono text-[10px] text-neutral-500">
                      Highlighted: {coBrowseGuide.selector}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {actionNotice && (
            <div className="flex items-center gap-2 border-b border-[#1ED760]/30 bg-[#1ED760]/10 px-3.5 py-2 text-xs text-emerald-800 dark:text-[#1ED760]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Queue Message Stream */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-white dark:bg-neutral-950">
            {queueLoading && liveQueueMessages.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-xs text-neutral-500 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-[#1ED760]" />
                <span>Entering human support queue...</span>
              </div>
            ) : liveQueueMessages.length === 0 ? (
              <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3 text-xs text-neutral-600 dark:text-neutral-300">
                You are in the live specialist queue. Share details below while our next available specialist connects.
              </div>
            ) : (
              liveQueueMessages.map((m, idx) => {
                const senderType = String(m.senderType || m.senderRole || m.sender || '').toLowerCase();
                const isSystem = senderType === 'system' || Boolean(m.isSystemNotice);
                const isVisitor =
                  !isSystem &&
                  (senderType === 'customer' ||
                    senderType === 'visitor' ||
                    senderType === 'user' ||
                    senderType === 'guest');
                const isAi = !isSystem && (senderType === 'ai' || senderType === 'bot');
                if (isSystem) {
                  return (
                    <div key={m.id || idx} className="text-center py-1">
                      <span className="inline-block rounded-full border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-1 text-[10px] font-medium text-neutral-500">
                        {m.body || m.text}
                      </span>
                    </div>
                  );
                }
                return (
                  <div key={m.id || idx} className={`flex items-end gap-2 ${isVisitor ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[84%] space-y-0.5`}>
                      {!isVisitor && (m.senderName || m.agentName || isAi) && (
                        <p className="flex items-center gap-1 text-[10px] font-semibold text-neutral-500 px-1">
                          {isAi && <Sparkles className="h-2.5 w-2.5 text-indigo-500" />}
                          <span>{m.senderName || m.agentName || 'Tiwi AI Assistant'}</span>
                        </p>
                      )}
                      <div
                        className={`rounded-xl px-3 py-2 text-xs ${
                          isVisitor
                            ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-br-xs'
                            : isAi
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/30 text-neutral-900 dark:text-neutral-100 border border-indigo-200/80 dark:border-indigo-800/70 rounded-bl-xs'
                            : 'bg-[#fafafa] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200/80 dark:border-neutral-800 rounded-bl-xs'
                        }`}
                      >
                        {renderFormattedMessage(m.body || m.text || m.message)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Automated CSAT Survey Modal/Card on Live Chat Close */}
            {(isLiveQueueClosed || csatOpen) &&
              csatSubmittedForChatId !== (liveQueueChat?.id || 'submitted') && (
                <form
                  onSubmit={handleSubmitCsat}
                  className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3.5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        Rate your support experience
                      </p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        This live chat has ended. Your feedback helps us improve.
                      </p>
                    </div>
                    <Sparkles className="h-4 w-4 text-[#1ED760]" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((star) => {
                      const active = (csatHover || csatRating) >= star;
                      return (
                        <button
                          key={star}
                          type="button"
                          onMouseEnter={() => setCsatHover(star)}
                          onMouseLeave={() => setCsatHover(0)}
                          onClick={() => setCsatRating(star)}
                          className="p-1 rounded-md hover:bg-white dark:hover:bg-neutral-800 cursor-pointer"
                          aria-label={`Rate ${star} stars`}
                        >
                          <Star
                            className={`h-5 w-5 transition-colors ${
                              active ? 'fill-[#1ED760] text-[#1ED760]' : 'text-neutral-300 dark:text-neutral-700'
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {CSAT_TAGS.map((tag) => {
                      const selected = csatTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setCsatTags((prev) =>
                              prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium border transition cursor-pointer ${
                            selected
                              ? 'border-[#1ED760] bg-[#1ED760]/15 text-emerald-800 dark:text-[#1ED760]'
                              : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-600 dark:text-neutral-300'
                          }`}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  <textarea
                    rows={2}
                    value={csatComment}
                    onChange={(e) => setCsatComment(e.target.value)}
                    placeholder="Optional comment about your specialist..."
                    className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-2.5 py-2 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:border-[#1ED760] focus:outline-none"
                  />

                  <button
                    type="submit"
                    disabled={!csatRating || csatSubmitting}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] py-2 text-xs font-semibold text-neutral-950 disabled:opacity-40 cursor-pointer"
                  >
                    {csatSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Submit Feedback
                  </button>
                </form>
              )}

            <div ref={messagesEndRef} />
          </div>

          {isLiveQueueClosed ? (
            <div className="flex items-center justify-between gap-2 border-t border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3 text-xs text-neutral-600 dark:text-neutral-400">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
                <span>Live chat session closed.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLiveQueueChat(null);
                  setLiveQueueMessages([]);
                  setCsatSubmittedForChatId(null);
                  setCsatRating(0);
                  setCsatTags([]);
                  setCsatComment('');
                  try {
                    sessionStorage.removeItem(LIVE_CHAT_STORAGE_KEY);
                  } catch {}
                  setWidgetView('home');
                }}
                className="text-xs font-semibold text-[#16a34a] dark:text-[#1ED760] hover:underline cursor-pointer"
              >
                New Chat
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSendQueueMessage}
              className="flex items-center gap-2 border-t border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3"
            >
              <input
                type="text"
                value={queueInputText}
                onChange={(e) => setQueueInputText(e.target.value)}
                placeholder="Write a message to our support team..."
                className="h-9 flex-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!queueInputText.trim() || sendingQueueMsg}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1ED760] hover:bg-[#19c355] text-neutral-950 disabled:opacity-40 cursor-pointer"
                title="Send"
              >
                {sendingQueueMsg ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          )}
        </div>
      )}

      {/* VIEW 5: ACTIVE AI CHAT */}
      {widgetView === 'chat' && (
        <div className="relative flex flex-1 flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-neutral-800 px-3.5 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setWidgetView('home')}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <img
                src={resolveAvatarUrl(assignedAgent?.avatar)}
                alt={assignedAgent?.name || 'Specialist'}
                className="h-8 w-8 shrink-0 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-950 dark:text-white truncate">
                  {assignedAgent?.name || 'Support Specialist'}
                </p>
                <p className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                  {assignedAgent?.tierTitle || 'Online'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => startLiveQueueChat()}
                className="rounded-md border border-neutral-200 dark:border-neutral-700 px-2 py-1 text-[10px] font-semibold text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
                title="Switch to Live Human Queue"
              >
                Human Queue
              </button>
              <button
                type="button"
                onClick={() => setShowHistoryDrawer((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
                title="Conversations"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {showHistoryDrawer && (
            <div className="absolute top-13 left-0 bottom-0 z-20 w-64 overflow-y-auto border-r border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3.5 shadow-xl space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-200/80 dark:border-neutral-800">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">Conversations</span>
                <button type="button" onClick={() => setShowHistoryDrawer(false)} className="text-neutral-400 cursor-pointer">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => initiateChatSession()}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] py-2 text-xs font-semibold text-neutral-950 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                New Conversation
              </button>
              <div className="space-y-1.5">
                {userConversations.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectConversation(c)}
                    className="w-full rounded-lg border border-neutral-200/70 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-2 text-left text-xs hover:border-[#1ED760] cursor-pointer"
                  >
                    <p className="font-medium text-neutral-900 dark:text-neutral-100 truncate">{c.name}</p>
                    <p className="text-[10px] text-neutral-500">{c.serialNumber || c.time}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Ticket Linkage Strip */}
          <div className="flex items-center justify-between gap-2 border-b border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 py-2 text-[11px]">
            {linkedTicketId ? (
              <>
                <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
                  <Ticket className="h-3.5 w-3.5 text-[#1ED760]" />
                  <span className="font-mono">{linkedSerial}</span>
                </span>
                <button
                  type="button"
                  onClick={() => navigateToTicketDetail(linkedTicketId)}
                  className="inline-flex items-center gap-1 font-semibold text-[#16a34a] dark:text-[#1ED760] hover:underline cursor-pointer"
                >
                  Open Ticket
                  <ExternalLink className="h-3 w-3" />
                </button>
              </>
            ) : (
              <>
                <span className="text-neutral-500 dark:text-neutral-400">Live chat session</span>
                {supportConfig?.allowNewTicketCreation !== false && (
                  <button
                    type="button"
                    disabled={convertingTicket}
                    onClick={handleConvertToTicket}
                    className="inline-flex items-center gap-1 font-semibold text-neutral-900 dark:text-neutral-100 hover:text-[#1ED760] cursor-pointer disabled:opacity-50"
                  >
                    {convertingTicket ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ticket className="h-3 w-3 text-[#1ED760]" />}
                    Convert to Official Ticket
                  </button>
                )}
              </>
            )}
          </div>

          {actionNotice && (
            <div className="flex items-center gap-2 border-b border-[#1ED760]/30 bg-[#1ED760]/10 px-3.5 py-2 text-xs text-emerald-800 dark:text-[#1ED760]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {isTransferring && (
            <div className="flex items-center gap-2 border-b border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 py-2 text-xs text-neutral-600 dark:text-neutral-300">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>{transferNotice}</span>
            </div>
          )}

          {/* Stream */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-white dark:bg-neutral-950">
            {messages.map((msg) => {
              if (msg.isSystemNotice) {
                return (
                  <div key={msg.id} className="text-center py-1">
                    <span className="inline-block rounded-full border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-1 text-[10px] font-medium text-neutral-500">
                      {msg.text}
                    </span>
                  </div>
                );
              }
              const senderLower = String(msg.senderType || msg.sender || '').toLowerCase();
              const isUser = ['user', 'customer', 'guest', 'requester'].includes(senderLower);
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (
                    <img
                      src={resolveAvatarUrl(msg.avatar)}
                      alt=""
                      className="h-6 w-6 shrink-0 rounded-full border border-neutral-200 dark:border-neutral-700 object-cover mb-1"
                    />
                  )}
                  <div className={`max-w-[82%] space-y-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                    {!isUser && msg.agentName && (
                      <p className="px-1 text-[10px] font-semibold text-neutral-500">{msg.agentName}</p>
                    )}
                    <div
                      className={`rounded-xl px-3 py-2.5 text-xs ${
                        isUser
                          ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 rounded-br-xs'
                          : 'bg-[#fafafa] dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 border border-neutral-200/80 dark:border-neutral-800 rounded-bl-xs'
                      }`}
                    >
                      {renderFormattedMessage(msg.text)}
                    </div>
                    <div className={`flex items-center gap-1 px-1 text-[10px] text-neutral-400 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.time}</span>
                      {isUser && <CheckCheck className="h-3 w-3 text-[#1ED760]" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#1ED760]" />
                <span>Specialist is typing...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isClosed && currentTier < 3 && (
            <div className="flex items-center justify-between border-t border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 py-1.5 text-[10px]">
              <span className="text-neutral-500">Need deeper review?</span>
              <div className="flex items-center gap-1.5">
                {currentTier === 1 && (
                  <button
                    type="button"
                    onClick={() => handleTransferTier(2)}
                    className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-0.5 font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
                  >
                    Tier-2 Cloud Ops
                  </button>
                )}
                {currentTier <= 2 && (
                  <button
                    type="button"
                    onClick={() => handleTransferTier(3)}
                    className="rounded-md border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 px-2 py-0.5 font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
                  >
                    Tier-3 Architect
                  </button>
                )}
              </div>
            </div>
          )}

          {isClosed ? (
            <div className="flex items-center gap-2 border-t border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3 text-xs text-neutral-600 dark:text-neutral-400">
              <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
              <span>This ticket is closed and locked. New replies cannot be sent.</span>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 border-t border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about your store, orders, or server..."
                className="h-9 flex-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isTyping}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1ED760] hover:bg-[#19c355] text-neutral-950 disabled:opacity-40 cursor-pointer"
                title="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
