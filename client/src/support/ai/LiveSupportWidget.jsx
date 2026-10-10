import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useState, useEffect, useRef } from 'react';
import { getAuthUrl } from '../../utils/navigation';
import {
  MessageSquare,
  X,
  Send,
  Minimize2,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Headphones,
  History,
  CheckCheck,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Ticket,
  ExternalLink,
  Plus
} from 'lucide-react';

// ====================================================================
// GOOGLE-STYLE MESSAGE TEXT FORMATTER (CLEAN, TYPOGRAPHIC, NO ASTERISKS)
// ====================================================================
function renderFormattedMessage(text) {
  if (!text) return null;

  const lines = text.split('\n');

  return (
    <div className="space-y-1.5 text-xs leading-relaxed">
      {lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} className="h-1" />;

        const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
        const cleanLine = isBullet ? trimmed.replace(/^[\*\-]\s+/, '') : line;

        const parts = [];
        let remaining = cleanLine;
        let partIdx = 0;

        const inlineRegex = /(\*\*([^*]+)\*\*|`([^`]+)`)/;

        while (remaining) {
          const match = remaining.match(inlineRegex);
          if (!match) {
            parts.push(<span key={partIdx++}>{remaining}</span>);
            break;
          }

          const matchIndex = match.index;
          if (matchIndex > 0) {
            parts.push(<span key={partIdx++}>{remaining.slice(0, matchIndex)}</span>);
          }

          if (match[2] !== undefined) {
            parts.push(
              <strong key={partIdx++} className="font-semibold text-[#202124] dark:text-[#f1f3f4]">
                {match[2]}
              </strong>
            );
          } else if (match[3] !== undefined) {
            parts.push(
              <code key={partIdx++} className="px-1.5 py-0.5 rounded-md bg-[#e8eaed] dark:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8] font-mono text-[11px]">
                {match[3]}
              </code>
            );
          }

          remaining = remaining.slice(matchIndex + match[0].length);
        }

        if (isBullet) {
          return (
            <div key={lineIdx} className="flex items-start gap-2 pl-1 my-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] mt-1.5 shrink-0" />
              <div className="flex-1">{parts}</div>
            </div>
          );
        }

        return <p key={lineIdx}>{parts}</p>;
      })}
    </div>
  );
}

// Verified Human Specialist Avatars for Welcome Screen
const WELCOME_SPECIALISTS = [
  {
    name: 'Sarah Jenkins',
    avatar: '/default-avatar.svg'
  },
  {
    name: 'Michael Miller',
    avatar: '/default-avatar.svg'
  },
  {
    name: 'Emma Anderson',
    avatar: '/default-avatar.svg'
  },
  {
    name: 'David Taylor',
    avatar: '/default-avatar.svg'
  }
];

// Material 3 Prompt Suggestions
const PROMPT_SUGGESTIONS = [
  { label: '📦 Store & Products', prompt: 'How do I add and manage products in my store?' },
  { label: '💳 Plan & Billing', prompt: 'I have a question regarding my subscription plan and billing.' },
  { label: '⚡ POS & Sync', prompt: 'How does live POS barcode scanning and inventory sync work?' },
  { label: '🔒 Account Security', prompt: 'How do I update my store credentials and access security?' }
];

const GUEST_PROMPTS = [
  { label: '🔑 Login Assistance', prompt: 'I am having trouble logging into my account. Can you help me access it?' },
  { label: '🚀 Create Store', prompt: 'How do I create and launch an online store on Tiwlo?' },
  { label: '💳 Plans & Pricing', prompt: 'What are the subscription plans and features available on Tiwlo?' },
  { label: '💬 General Inquiry', prompt: 'I have a general question about Tiwlo eCommerce & Cloud platform.' }
];

export default function LiveSupportWidget({ currentUser }) {
  const [isOpen, setIsOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [widgetView, setWidgetView] = useState('home'); // 'home' | 'chat' | 'history'
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  // Real Database State
  const [userConversations, setUserConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);

  // Active Session & Assigned Agent State
  const [assignedAgent, setAssignedAgent] = useState(null);
  const [currentTier, setCurrentTier] = useState(1);
  const [ticketInfo, setTicketInfo] = useState(null);

  // Chat and Transfer State
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferNotice, setTransferNotice] = useState('');
  const [actionNotice, setActionNotice] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Current logged in user context (strict guest isolation)
  const isLoggedIn = Boolean(currentUser && (currentUser.id || currentUser.tiwiId || currentUser.email));
  const userName = isLoggedIn ? (currentUser?.name || currentUser?.storeName?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'Store Owner') : 'Guest';
  const userEmail = isLoggedIn ? (currentUser?.email || '') : '';
  const storeName = isLoggedIn ? (currentUser?.storeName || '') : '';
  const userId = isLoggedIn ? (currentUser?.id || currentUser?.tiwiId || 'user') : 'guest';

  // 1. Fetch conversations on mount & when userId changes (strictly when authenticated)
  useEffect(() => {
    if (!isLoggedIn || !userId || userId === 'guest' || userId === 'guest_session') {
      setUserConversations([]);
    } else {
      loadUserSupportData();
    }
  }, [isLoggedIn, userId]);

  const loadUserSupportData = async () => {
    if (!isLoggedIn || !userId || userId === 'guest' || userId === 'guest_session') {
      setUserConversations([]);
      return;
    }
    try {
      const convsRes = await fetch(`/api/support/conversations?userId=${encodeURIComponent(userId)}`).then(r => r.json()).catch(() => null);
      if (convsRes?.conversations && Array.isArray(convsRes.conversations)) {
        setUserConversations(convsRes.conversations);
      } else {
        setUserConversations([]);
      }
    } catch (e) {
      console.warn('Error loading support data:', e);
      setUserConversations([]);
    }
  };

  // 2. Auto-scroll on new message
  useEffect(() => {
    if (isOpen && !minimized && widgetView === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isTransferring, isOpen, minimized, widgetView]);

  // 3. Listen for global open requests (e.g. from Sidebar Help button)
  useEffect(() => {
    const handleGlobalTrigger = () => {
      setIsOpen(true);
      setMinimized(false);
      setWidgetView('home');
    };
    window.addEventListener('tiwlo:open-support', handleGlobalTrigger);
    return () => window.removeEventListener('tiwlo:open-support', handleGlobalTrigger);
  }, []);

  // 4. Start New Chat Session & Create Real Tracked Ticket
  const handleStartNewChat = async (initialPrompt = null) => {
    setIsTyping(true);
    setWidgetView('chat');
    setShowHistoryDrawer(false);

    try {
      const res = await fetch('/api/support/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isLoggedIn,
          userName,
          userId,
          userEmail,
          storeName,
          initialSubject: typeof initialPrompt === 'string' ? initialPrompt : (isLoggedIn ? `Support Request (${userName})` : 'Guest Support Inquiry')
        })
      });
      const data = await res.json();

      if (data?.agent && data?.ticket) {
        setActiveConvId(data.sessionId);
        setTicketInfo(data.ticket);
        setAssignedAgent(data.agent);
        setCurrentTier(1);

        const initialMessages = [
          {
            id: 'msg_welcome',
            sender: 'agent',
            agentName: data.agent.name,
            avatar: data.agent.avatar,
            tierTitle: data.agent.tierTitle,
            text: data.welcomeGreeting,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ];

        setMessages(initialMessages);

        // Update local conversation list immediately (only for authenticated accounts)
        if (isLoggedIn) {
          setUserConversations(prev => {
            const filtered = prev.filter(c => c.id !== data.sessionId);
            return [
              {
                id: data.sessionId,
                ticketId: data.ticket.ticketId,
                serialNumber: data.ticket.serialNumber,
                name: `${data.agent.name} (${data.ticket.serialNumber})`,
                lastMessage: data.welcomeGreeting,
                time: 'Just now',
                status: 'Open'
              },
              ...filtered
            ];
          });
        }

        // If a suggestion chip prompt was clicked, automatically send it
        if (typeof initialPrompt === 'string' && initialPrompt.trim()) {
          setTimeout(() => {
            dispatchUserMessage(initialPrompt.trim(), data.ticket.ticketId, data.sessionId, data.agent);
          }, 350);
        }
      }
    } catch (err) {
      console.warn('Failed to initiate support session:', err);
    } finally {
      setIsTyping(false);
    }
  };

  // 5. Resume an existing conversation
  const handleSelectConversation = (conv) => {
    setActiveConvId(conv.id);
    setWidgetView('chat');
    setShowHistoryDrawer(false);

    if (conv.messages && conv.messages.length > 0) {
      setMessages(conv.messages);
    } else {
      setMessages([
        {
          id: 'msg_conv_init',
          sender: 'agent',
          agentName: conv.name || 'Support Team',
          tierTitle: 'Specialist',
          text: `Resumed session for Ticket ${conv.ticketId || conv.serialNumber || '#TWTK-1008'}. How can we continue assisting you?`,
          time: conv.time || 'Today'
        }
      ]);
    }

    if (conv.ticketId) {
      setTicketInfo({
        ticketId: conv.ticketId,
        serialNumber: conv.ticketId.startsWith('#') ? conv.ticketId : `#${conv.ticketId}`,
        status: conv.status || 'Open'
      });
    }
  };

  // 6. Multi-Tier Support Handover Handler (Tier 1 -> Tier 2 -> Tier 3)
  const handleTransferTier = async (targetTier) => {
    if (isTransferring || !assignedAgent) return;
    setIsTransferring(true);
    const notice = targetTier === 2
      ? `Transferring your session to Tier-2 Technical & Cloud Operations Specialist...`
      : `Escalating your session to Tier-3 Senior Systems Architect...`;
    setTransferNotice(notice);

    try {
      const res = await fetch('/api/support/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetTier,
          currentAgentId: assignedAgent.id,
          userName
        })
      });
      const data = await res.json();

      setTimeout(() => {
        setIsTransferring(false);
        setTransferNotice('');
        if (data?.agent) {
          setAssignedAgent(data.agent);
          setCurrentTier(data.newTier);

          setMessages(prev => [
            ...prev,
            {
              id: `handover_${Date.now()}`,
              isSystemNotice: true,
              text: `Ticket #${ticketInfo?.ticketId || 'TWTK-1008'} reassigned to ${data.agent.name} (${data.agent.tierTitle})`
            },
            {
              id: `msg_intro_${Date.now()}`,
              sender: 'agent',
              agentName: data.agent.name,
              avatar: data.agent.avatar,
              tierTitle: data.agent.tierTitle,
              text: data.introGreeting,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
        }
      }, 750);
    } catch (err) {
      setIsTransferring(false);
      setTransferNotice('');
    }
  };

  // Internal dispatch helper for sending messages
  const dispatchUserMessage = async (userText, ticketIdOverride, sessionIdOverride, agentOverride) => {
    const activeTicket = ticketIdOverride || ticketInfo?.ticketId || 'TWTK-1008';
    const activeSession = sessionIdOverride || activeConvId;
    const currentAgent = agentOverride || assignedAgent;

    const newMsg = {
      id: `msg_u_${Date.now()}`,
      sender: 'user',
      text: userText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setIsTyping(true);

    try {
      const res = await fetch('/api/support/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': activeSession || ''
        },
        body: JSON.stringify({
          isLoggedIn,
          agentName: currentAgent?.name || 'Sarah Jenkins',
          agentRole: currentAgent?.tierTitle || 'Senior Support Specialist',
          userId,
          userName,
          userEmail,
          currentTier,
          message: userText,
          activeTicketId: activeTicket,
          conversationHistory: messages,
          sessionId: activeSession
        })
      });

      const data = await res.json();

      if (data?.reply) {
        setMessages(prev => [
          ...prev,
          {
            id: `msg_a_${Date.now()}`,
            sender: 'agent',
            agentName: currentAgent?.name || 'Sarah Jenkins',
            avatar: currentAgent?.avatar,
            tierTitle: currentAgent?.tierTitle || 'Support Specialist',
            text: data.reply,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);

        if (data?.actionExecuted) {
          setActionNotice(data.actionExecuted.message);
          setTimeout(() => setActionNotice(null), 8000);
          loadUserSupportData();
        }

        if (data.shouldOfferTransfer && data.transferToTier && data.transferToTier > currentTier) {
          setTimeout(() => {
            handleTransferTier(data.transferToTier);
          }, 1200);
        }
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          sender: 'agent',
          agentName: currentAgent?.name || 'Sarah Jenkins',
          text: `Thank you for your message, ${userName}. Your request has been recorded under Ticket #${activeTicket}. Please let me know how else I can assist.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  // 7. Form Send Message Handler
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || isTyping || isTransferring) return;

    const userText = inputText.trim();
    setInputText('');
    await dispatchUserMessage(userText);
  };

  // ====================================================================
  // 1. MINIMIZED FLOATING PILL (Clean Round Pill, No Shadow)
  // ====================================================================
  if (isOpen && minimized) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 animate-in fade-in slide-in-from-bottom-2 max-w-[calc(100vw-32px)]">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white transition-all cursor-pointer"
        >
          <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.7919 3.52331 15.4616 4.42597 16.8672L3.17678 20.3015C3.02324 20.7235 3.39829 21.134 3.82424 21.0112L7.38202 19.9856C8.80231 20.6368 10.3683 21 12 21Z"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="12" r="1.1" fill="white" />
            <circle cx="12" cy="12" r="1.1" fill="white" />
            <circle cx="16" cy="12" r="1.1" fill="white" />
          </svg>
          <span className="text-xs font-medium truncate">Tiwlo Support</span>
          {ticketInfo?.serialNumber && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/20 text-white font-semibold shrink-0">
              {ticketInfo.serialNumber}
            </span>
          )}
        </button>
      </div>
    );
  }

  // ====================================================================
  // 2. CLOSED FLOATING LAUNCHER (Clean, Round, No Shadow, Beautiful Chat Icon)
  // Zero shadows, zero glow, zero live beacons - pure, elegant, round
  // ====================================================================
  if (!isOpen) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
        <button
          onClick={() => {
            setIsOpen(true);
            setMinimized(false);
            setWidgetView('home');
          }}
          className="w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] active:scale-95 text-white flex items-center justify-center transition-transform cursor-pointer outline-none"
          title="Tiwlo Support"
          aria-label="Open Tiwlo Support"
        >
          {/* Beautiful, clean, crisp circular chat icon */}
          <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 sm:w-6.5 sm:h-6.5 text-white" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 13.7919 3.52331 15.4616 4.42597 16.8672L3.17678 20.3015C3.02324 20.7235 3.39829 21.134 3.82424 21.0112L7.38202 19.9856C8.80231 20.6368 10.3683 21 12 21Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="12" r="1.2" fill="currentColor" />
            <circle cx="12" cy="12" r="1.2" fill="currentColor" />
            <circle cx="16" cy="12" r="1.2" fill="currentColor" />
          </svg>
        </button>
      </div>
    );
  }

  // ====================================================================
  // 3. EXPANDED WIDGET CONTAINER (Google Material 3 Clean Surface)
  // Responsive: On mobile inset-x-2.5 bottom-2.5, h-[86dvh] max-h-[620px]
  // ====================================================================
  return (
    <div
      className={`fixed inset-x-2.5 bottom-2.5 sm:inset-auto sm:bottom-6 sm:right-6 z-50 rounded-[24px] bg-white dark:bg-[#1e1f20] border border-[#dadce0] dark:border-[#3c4043] shadow-[0_4px_24px_rgba(0,0,0,0.14),0_1px_4px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden transition-all duration-200 ease-out animate-in fade-in slide-in-from-bottom-4 ${
        widgetView === 'home'
          ? 'sm:w-[380px] h-[85dvh] sm:h-[540px] max-h-[600px]'
          : 'sm:w-[410px] h-[88dvh] sm:h-[610px] max-h-[660px]'
      }`}
    >
      
      {/* ================================================================ */}
      {/* VIEW A: GOOGLE-STYLE WELCOME / HOME SCREEN */}
      {/* ================================================================ */}
      {widgetView === 'home' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#1e1f20]">
          {/* Google Clean Header App Bar */}
          <div className="p-3.5 px-4 bg-white dark:bg-[#1e1f20] border-b border-[#dadce0] dark:border-[#3c4043] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-[#1a73e8] via-[#2563eb] to-[#38bdf8] text-white flex items-center justify-center shrink-0 shadow-xs">
                <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4 text-white" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3C7.03 3 3 7.03 3 12C3 13.88 3.5 15.58 4.44 17.01L3.25 20.46C3.12 20.82 3.47 21.17 3.83 21.05L7.28 19.85C8.71 20.8 10.42 21 12 21Z"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="8" cy="12" r="1.1" fill="white" />
                  <circle cx="12" cy="12" r="1.1" fill="white" />
                  <circle cx="16" cy="12" r="1.1" fill="white" />
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-[#202124] dark:text-[#e8eaed]">Tiwlo Support</span>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-[#e6f4ea] dark:bg-[#137333]/20 text-[#137333] dark:text-[#81c995] text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1e8e3e]" />
                    <span>Live</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Top Window Actions */}
            <div className="flex items-center gap-0.5">
              {isLoggedIn && (
                <button
                  onClick={() => setWidgetView('history')}
                  className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer relative"
                  title="Recent Conversations"
                >
                  <Clock className="w-4 h-4" />
                  {userConversations.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#1a73e8]" />
                  )}
                </button>
              )}
              <button
                onClick={() => setMinimized(true)}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Welcome Screen Body (Clean Google Help / Gemini Style) */}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col justify-between">
            <div>
              {/* Account Context Banner (Explicitly shows Ticket Linking) */}
              <div className="mb-4 p-2.5 px-3 rounded-xl bg-[#f8fafd] dark:bg-[#282a2d] border border-[#dadce0]/80 dark:border-[#3c4043] flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full bg-[#e8f0fe] dark:bg-[#1a73e8]/20 text-[#1a73e8] dark:text-[#8ab4f8] flex items-center justify-center shrink-0 text-xs font-semibold">
                    {isLoggedIn ? (userName[0]?.toUpperCase() || 'U') : 'G'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#202124] dark:text-[#e8eaed] truncate">
                      {isLoggedIn ? userName : 'Guest Visitor'}
                    </p>
                    <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] truncate">
                      {isLoggedIn ? (storeName ? `${storeName} Store` : (userEmail || 'Active Account')) : 'Unauthenticated Session'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 text-[10px] font-medium text-[#137333] dark:text-[#81c995] shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{isLoggedIn ? 'Verified' : 'Guest'}</span>
                </div>
              </div>

              {/* Greeting & Headline */}
              <div className="mb-4">
                <div className="flex items-center -space-x-2 mb-3">
                  {WELCOME_SPECIALISTS.slice(0, 3).map((spec, idx) => (
                    <img
                      key={idx}
                      src={spec.avatar}
                      alt={spec.name}
                      className="w-8 h-8 rounded-full border-2 border-white dark:border-[#1e1f20] object-cover shadow-2xs"
                    />
                  ))}
                  <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#1e1f20] bg-[#f1f3f4] dark:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] text-[10px] font-semibold flex items-center justify-center">
                    +4
                  </div>
                </div>

                <h2 className="text-lg font-semibold text-[#202124] dark:text-[#e8eaed] tracking-tight">
                  {isLoggedIn ? `Hi ${userName},` : 'Welcome to Tiwlo Support,'}
                </h2>
                <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
                  {isLoggedIn ? 'How can we help you today?' : 'How can we assist you with your account or store?'}
                </p>
              </div>

              {/* Material 3 Prompt Starter Chips */}
              <div className="space-y-1.5 mb-5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#80868b] dark:text-[#9aa0a6]">
                  Suggested topics
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(isLoggedIn ? PROMPT_SUGGESTIONS : GUEST_PROMPTS).map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStartNewChat(item.prompt)}
                      className="text-left px-3 py-1.5 rounded-full text-[11px] font-medium bg-[#f1f3f4] dark:bg-[#282a2d] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] text-[#3c4043] dark:text-[#e8eaed] border border-transparent hover:border-[#dadce0] dark:hover:border-[#5f6368] transition cursor-pointer"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Primary Action Button (Start Chat with Real Ticket Creation Notice) */}
            <div className="space-y-2 pt-2 border-t border-[#dadce0]/70 dark:border-[#3c4043]/70">
              <button
                onClick={() => handleStartNewChat()}
                className="w-full py-2.5 px-4 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] active:scale-[0.99] text-white text-xs font-medium shadow-xs hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer group"
              >
                <MessageSquare className="w-4 h-4 stroke-[2.2]" />
                <span>Start a chat</span>
                <ArrowRight className="w-3.5 h-3.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#5f6368] dark:text-[#9aa0a6] text-center">
                <Ticket className="w-3 h-3 text-[#1a73e8]" />
                <span>
                  {isLoggedIn
                    ? 'Creates an official support ticket linked to your account'
                    : 'Instant support assistance • Response time: < 1 min'}
                </span>
              </div>

              {isLoggedIn && userConversations.length > 0 && (
                <button
                  onClick={() => setWidgetView('history')}
                  className="w-full py-1.5 px-3 rounded-lg text-[11px] font-medium text-[#1a73e8] dark:text-[#8ab4f8] hover:bg-[#f1f3f4] dark:hover:bg-[#282a2d] transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3 h-3" />
                  <span>View previous chats ({userConversations.length})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* VIEW B: RECENT CONVERSATIONS SCREEN (Google List View) */}
      {/* ================================================================ */}
      {widgetView === 'history' && (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#1e1f20]">
          {/* Header */}
          <div className="p-3.5 px-4 bg-white dark:bg-[#1e1f20] border-b border-[#dadce0] dark:border-[#3c4043] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setWidgetView('home')}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer"
                title="Back to Support Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <h3 className="text-xs font-semibold text-[#202124] dark:text-[#e8eaed]">Your Conversations</h3>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                onClick={() => setMinimized(true)}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List of Conversations */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {!isLoggedIn ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#e8f0fe] dark:bg-[#1a73e8]/20 text-[#1a73e8] dark:text-[#8ab4f8] flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 stroke-[1.8]" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#202124] dark:text-[#e8eaed]">Account Sign-In Required</h4>
                  <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1">Please sign in to your store account to view your past conversation history and support tickets.</p>
                </div>
                <a
                  href={getAuthUrl('/login')}
                  className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#1a73e8] text-white text-xs font-medium hover:bg-[#1557b0] transition shadow-xs"
                >
                  Sign In to Account
                </a>
              </div>
            ) : userConversations.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                <div className="w-12 h-12 rounded-full bg-[#f1f3f4] dark:bg-[#282a2d] text-[#1a73e8] flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 stroke-[1.8]" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#202124] dark:text-[#e8eaed]">No previous conversations</h4>
                  <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] mt-1">Start a chat to get assistance from our support specialists.</p>
                </div>
              </div>
            ) : (
              userConversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className="p-3.5 rounded-2xl bg-white dark:bg-[#282a2d] border border-[#dadce0] dark:border-[#3c4043] hover:border-[#1a73e8] dark:hover:border-[#8ab4f8] transition cursor-pointer shadow-2xs group flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#e8f0fe] dark:bg-[#1a73e8]/20 text-[#1a73e8] dark:text-[#8ab4f8] flex items-center justify-center shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-[#202124] dark:text-[#e8eaed] truncate group-hover:text-[#1a73e8] dark:group-hover:text-[#8ab4f8] transition-colors">
                        {conv.name || conv.lastMessage || 'Support Session'}
                      </h4>
                      <p className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6] truncate mt-0.5">
                        {conv.time || 'Recent'} &bull; {conv.ticketId || conv.serialNumber || '#TWTK-1008'}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#80868b] group-hover:translate-x-0.5 group-hover:text-[#1a73e8] transition shrink-0" />
                </div>
              ))
            )}
          </div>

          {/* Bottom Action Button */}
          <div className="p-3.5 border-t border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#1e1f20]">
            <button
              onClick={() => handleStartNewChat()}
              className="w-full py-2.5 px-4 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Start New Conversation</span>
            </button>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* VIEW C: ACTIVE CHAT SCREEN (Google Messages / Gemini Style) */}
      {/* ================================================================ */}
      {widgetView === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-[#1e1f20]">
          {/* Header Bar */}
          <div className="p-3 px-4 bg-white dark:bg-[#1e1f20] border-b border-[#dadce0] dark:border-[#3c4043] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {/* Back Button */}
              <button
                onClick={() => setWidgetView('home')}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer shrink-0"
                title="Back to Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Agent Avatar */}
              <div className="relative shrink-0">
                <div className="w-8.5 h-8.5 rounded-full overflow-hidden bg-[#e8f0fe] dark:bg-[#282a2d] border border-[#dadce0] dark:border-[#3c4043] flex items-center justify-center">
                  {assignedAgent?.avatar ? (
                    <img src={assignedAgent.avatar} alt={assignedAgent.name} className="w-full h-full object-cover" />
                  ) : (
                    <Headphones className="w-4 h-4 text-[#1a73e8]" />
                  )}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#1e8e3e] ring-2 ring-white dark:ring-[#1e1f20]" />
              </div>

              {/* Agent Details & Ticket Chip */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-semibold text-[#202124] dark:text-[#e8eaed] truncate">
                    {assignedAgent?.name || 'Sarah Jenkins'}
                  </h3>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.2 rounded-full bg-[#e8f0fe] dark:bg-[#1a73e8]/20 text-[#1a73e8] dark:text-[#8ab4f8] shrink-0">
                    {ticketInfo?.serialNumber || '#TWTK-1008'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
                  <span className="text-[#1e8e3e] font-medium">Online</span>
                  <span>&bull;</span>
                  <span className="truncate">{assignedAgent?.tierTitle || 'Support Specialist'}</span>
                </div>
              </div>
            </div>

            {/* Window Controls */}
            <div className="flex items-center gap-0.5 shrink-0 ml-1">
              <button
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                  showHistoryDrawer ? 'bg-[#e8f0fe] text-[#1a73e8] dark:bg-[#1a73e8]/30 dark:text-[#8ab4f8]' : 'hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6]'
                }`}
                title="History Drawer"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMinimized(true)}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer"
                title="Minimize"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124] dark:hover:text-[#e8eaed] flex items-center justify-center transition cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* History Drawer Overlay */}
          {showHistoryDrawer && (
            <div className="absolute top-14 left-0 bottom-0 w-64 bg-white dark:bg-[#1e1f20] border-r border-[#dadce0] dark:border-[#3c4043] z-20 p-4 space-y-3 shadow-lg animate-in slide-in-from-left duration-200 overflow-y-auto">
              <div className="flex items-center justify-between pb-2 border-b border-[#dadce0] dark:border-[#3c4043]">
                <span className="text-xs font-semibold text-[#202124] dark:text-[#e8eaed] flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-[#1a73e8]" />
                  <span>Your Tickets</span>
                </span>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="text-[#5f6368] hover:text-[#202124] dark:hover:text-[#e8eaed] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => handleStartNewChat()}
                className="w-full py-2 px-3 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ New Conversation</span>
              </button>

              <div className="space-y-1.5 pt-1">
                {userConversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c)}
                    className="p-2.5 rounded-xl hover:bg-[#f1f3f4] dark:hover:bg-[#282a2d] transition cursor-pointer text-left space-y-0.5 border border-transparent hover:border-[#dadce0] dark:hover:border-[#3c4043]"
                  >
                    <div className="text-xs font-medium text-[#202124] dark:text-[#e8eaed] truncate">
                      {c.name || c.lastMessage}
                    </div>
                    <div className="text-[10px] text-[#5f6368] dark:text-[#9aa0a6]">
                      {c.time || 'Recent'} &bull; {c.ticketId || '#TWTK-1008'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Notification Banner */}
          {actionNotice && (
            <div className="px-4 py-2 bg-[#e6f4ea] dark:bg-[#137333]/20 border-b border-[#ceead6] dark:border-[#137333]/40 text-[#137333] dark:text-[#81c995] text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-[#1e8e3e] shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Transfer Notification Banner */}
          {isTransferring && (
            <div className="px-4 py-2 bg-[#e8f0fe] dark:bg-[#1a73e8]/20 border-b border-[#d2e3fc] dark:border-[#1a73e8]/40 text-[#1a73e8] dark:text-[#8ab4f8] text-xs font-medium flex items-center gap-2 animate-in fade-in">
              <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
              <span>{transferNotice}</span>
            </div>
          )}

          {/* Ticket Context Pinned Strip */}
          <div className="px-4 py-1.5 bg-[#f8fafd] dark:bg-[#282a2d] border-b border-[#dadce0]/60 dark:border-[#3c4043]/60 flex items-center justify-between text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
            <div className="flex items-center gap-1.5">
              <Ticket className="w-3.5 h-3.5 text-[#1a73e8]" />
              <span className="font-medium text-[#202124] dark:text-[#e8eaed]">
                Ticket {ticketInfo?.serialNumber || '#TWTK-1008'}
              </span>
              <span>&bull;</span>
              <span className="text-[#1e8e3e] font-medium">Open</span>
            </div>
            <span>Linked to {userName}</span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-3.5 sm:p-4 space-y-3 bg-[#ffffff] dark:bg-[#1e1f20]">
            {messages.map((msg) => {
              if (msg.isSystemNotice) {
                return (
                  <div key={msg.id} className="text-center py-1">
                    <span className="inline-block px-3 py-1 rounded-full text-[10px] font-medium bg-[#f1f3f4] dark:bg-[#282a2d] text-[#5f6368] dark:text-[#9aa0a6] border border-[#dadce0] dark:border-[#3c4043]">
                      {msg.text}
                    </span>
                  </div>
                );
              }

              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-6 h-6 rounded-full overflow-hidden bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center shrink-0 mb-1 border border-[#dadce0] dark:border-[#3c4043]">
                      {msg.avatar ? (
                        <img src={msg.avatar} alt="Agent" className="w-full h-full object-cover" />
                      ) : (
                        <Headphones className="w-3 h-3" />
                      )}
                    </div>
                  )}

                  <div className={`max-w-[82%] space-y-0.5 ${isUser ? 'items-end' : 'items-start'}`}>
                    <div
                      className={`p-3 rounded-[18px] text-xs leading-relaxed ${
                        isUser
                          ? 'bg-[#1a73e8] text-white rounded-br-xs shadow-2xs'
                          : 'bg-[#f1f3f4] dark:bg-[#282a2d] text-[#202124] dark:text-[#e8eaed] border border-[#dadce0]/70 dark:border-[#3c4043]/70 rounded-bl-xs'
                      }`}
                    >
                      {renderFormattedMessage(msg.text)}
                    </div>

                    <div className={`flex items-center gap-1 text-[10px] text-[#80868b] dark:text-[#9aa0a6] px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.time}</span>
                      {isUser && <CheckCheck className="w-3 h-3 text-[#1a73e8] stroke-[2.5]" />}
                    </div>
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#e8f0fe] text-[#1a73e8] flex items-center justify-center shrink-0 border border-[#dadce0] dark:border-[#3c4043]">
                  <Headphones className="w-3 h-3" />
                </div>
                <div className="px-3.5 py-2 rounded-[18px] bg-[#f1f3f4] dark:bg-[#282a2d] border border-[#dadce0]/70 dark:border-[#3c4043]/70 text-[#5f6368] text-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1a73e8] animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Specialist Escalation Options */}
          {currentTier < 3 && (
            <div className="px-4 py-1.5 bg-[#f8fafd] dark:bg-[#282a2d] border-t border-[#dadce0]/60 dark:border-[#3c4043]/60 flex items-center justify-between text-[11px]">
              <span className="text-[#5f6368] dark:text-[#9aa0a6] text-[10px]">Escalate to specialist:</span>
              <div className="flex items-center gap-1.5">
                {currentTier === 1 && (
                  <button
                    onClick={() => handleTransferTier(2)}
                    className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1e1f20] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] text-[#1a73e8] dark:text-[#8ab4f8] border border-[#dadce0] dark:border-[#3c4043] font-medium transition cursor-pointer text-[10px]"
                  >
                    &rarr; Tier-2 Cloud Ops
                  </button>
                )}
                {currentTier <= 2 && (
                  <button
                    onClick={() => handleTransferTier(3)}
                    className="px-2.5 py-0.5 rounded-full bg-white dark:bg-[#1e1f20] hover:bg-[#e8eaed] dark:hover:bg-[#3c4043] text-[#7627bb] dark:text-[#c58af9] border border-[#dadce0] dark:border-[#3c4043] font-medium transition cursor-pointer text-[10px]"
                  >
                    &rarr; Tier-3 Architect
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Google Search-Style Pill Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 border-t border-[#dadce0] dark:border-[#3c4043] bg-white dark:bg-[#1e1f20] flex items-center gap-2"
          >
            <div className="flex-1 rounded-full bg-[#f1f3f4] dark:bg-[#282a2d] border border-transparent focus-within:border-[#1a73e8] focus-within:bg-white dark:focus-within:bg-[#1e1f20] px-4 py-1.5 flex items-center gap-2 transition-all">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask about your store, orders, or server..."
                className="flex-1 text-xs bg-transparent text-[#202124] dark:text-[#e8eaed] placeholder-[#80868b] focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={!inputText.trim() || isTyping}
              className="w-8 h-8 rounded-full bg-[#1a73e8] hover:bg-[#1557b0] text-white flex items-center justify-center transition disabled:opacity-35 cursor-pointer shrink-0"
              title="Send message"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
