import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookmarkPlus,
  Eye,
  Headphones,
  Loader2,
  Lock,
  Monitor,
  PauseCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trash2,
  UserCheck,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { supportFetch as fetch } from '../../utils/supportFetch';
import PaginationBar from '../../components/PaginationBar';

function getAuthHeaders(extra = {}) {
  const token = typeof window !== 'undefined' ? window.localStorage?.getItem('stockpro_session') : null;
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatDateTime(val) {
  if (!val) return '—';
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return String(val);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getChatReplyLockInfo(chat, { currentActorId = '', isSuperAdmin = false, canReplyPermission = true } = {}) {
  if (!chat) {
    return { canReply: false, requiresAccept: false, rowBadge: null, badgeTone: null, reason: null };
  }
  const statusLower = String(chat.status || '').toLowerCase();
  if (statusLower === 'closed' || statusLower === 'cancelled') {
    return {
      canReply: false,
      requiresAccept: false,
      rowBadge: 'Unable · Closed',
      badgeTone: 'closed',
      reason: 'Conversation is closed.',
    };
  }
  if (!canReplyPermission) {
    return {
      canReply: false,
      requiresAccept: false,
      rowBadge: 'Locked',
      badgeTone: 'locked',
      reason: 'Read-only permission.',
    };
  }
  const assignedId = chat.assignedAgentId ? String(chat.assignedAgentId) : '';
  const ownedByMe = Boolean(assignedId && currentActorId && assignedId === currentActorId);
  if (statusLower === 'active' && assignedId && !ownedByMe && !isSuperAdmin) {
    return {
      canReply: false,
      requiresAccept: false,
      rowBadge: 'Locked',
      badgeTone: 'locked',
      reason: `Handled by ${chat.assignedAgentName || 'another specialist'}.`,
    };
  }
  if (statusLower === 'active' && assignedId && !ownedByMe) {
    return {
      canReply: false,
      requiresAccept: false,
      rowBadge: 'Locked',
      badgeTone: 'locked',
      reason: `Handled by ${chat.assignedAgentName || 'another specialist'}.`,
    };
  }
  if (statusLower !== 'active' || !assignedId) {
    return {
      canReply: false,
      requiresAccept: true,
      rowBadge: 'Accept to Reply',
      badgeTone: 'accept',
      reason: statusLower === 'on_hold' ? 'Chat is on hold — Resume & Accept required first.' : 'Accept required first.',
    };
  }
  return {
    canReply: true,
    requiresAccept: false,
    rowBadge: null,
    badgeTone: null,
    reason: null,
  };
}

export default function AdminLiveChatQueuePanel({
  apiBase = '/api',
  currentUser = null,
  isSuperAdmin = false,
  canReply = true,
  aiEnabled = true,
  showToast,
  onCountsChange,
}) {
  const [statusTab, setStatusTab] = useState('waiting'); // 'waiting' | 'my_active' | 'active' | 'on_hold' | 'closed'
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'thread' | 'cobrowse'
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState([]);
  const [counts, setCounts] = useState({
    all: 0,
    waiting: 0,
    active: 0,
    on_hold: 0,
    closed: 0,
    myActive: 0,
    flagged: 0,
  });
  const [presence, setPresence] = useState({
    onlineAgentsCount: 0,
    freeAgentsCount: 0,
    busyAgentsCount: 0,
  });
  const [isOnline, setIsOnline] = useState(true);
  const [togglingOnline, setTogglingOnline] = useState(false);

  const [loadingList, setLoadingList] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [selectedChatId, setSelectedChatId] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [loadingChat, setLoadingChat] = useState(false);

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [actingChat, setActingChat] = useState(false);

  // Staff Response Templates
  const [templates, setTemplates] = useState([]);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [tplTitle, setTplTitle] = useState('');
  const [tplCategory, setTplCategory] = useState('General');
  const [tplBody, setTplBody] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  // AI Draft / Polish / Summarize
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState('');

  // Co-Browsing Guidance Push
  const [guideSelector, setGuideSelector] = useState('');
  const [guideNote, setGuideNote] = useState('');
  const [pushingGuide, setPushingGuide] = useState(false);

  const selectedChatIdRef = useRef(selectedChatId);
  useEffect(() => {
    selectedChatIdRef.current = selectedChatId;
  }, [selectedChatId]);

  const messagesEndRef = useRef(null);

  const loadChats = useCallback(async (options = {}) => {
    const preserveSelection = Boolean(options?.preserveSelection);
    const silent = Boolean(options?.silent);
    if (!silent) setLoadingList(true);
    try {
      const apiStatus = statusTab === 'my_active' ? 'active' : statusTab;
      const params = new URLSearchParams();
      if (apiStatus) params.set('status', apiStatus);
      if (statusTab === 'my_active') params.set('mine', '1');
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      params.set('deskIsolation', '1');

      const res = await fetch(`${apiBase}/admin/support/live-chats?${params.toString()}`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success !== false) {
        const list = Array.isArray(json.chats) ? json.chats : [];
        setChats(list);
        if (json.counts) {
          setCounts((prev) => ({ ...prev, ...json.counts }));
          onCountsChange?.(json.counts);
        }
        if (json.presence) setPresence((prev) => ({ ...prev, ...json.presence }));
        setSelectedChatId((prev) => {
          const current = prev || selectedChatIdRef.current;
          if (current && list.some((c) => c.id === current)) return current;
          if (preserveSelection && current) return current;
          return list[0]?.id || null;
        });
      }
    } catch {
      // Non-fatal
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, [apiBase, statusTab, searchQuery, onCountsChange]);

  const loadChatDetail = useCallback(
    async (chatId, options = {}) => {
      const silent = Boolean(options?.silent);
      if (!chatId) {
        setActiveChat(null);
        setChatMessages([]);
        return;
      }
      if (!silent) setLoadingChat(true);
      try {
        const res = await fetch(`${apiBase}/admin/support/live-chats/${encodeURIComponent(chatId)}?deskIsolation=1`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.chat) {
          setActiveChat(json.chat);
          setChatMessages(Array.isArray(json.messages) ? json.messages : []);
        } else if (res.status === 403 || res.status === 404) {
          setActiveChat(null);
          setChatMessages([]);
          setSelectedChatId(null);
        }
      } catch {
        // Ignore transient
      } finally {
        if (!silent) setLoadingChat(false);
      }
    },
    [apiBase]
  );

  const loadTemplates = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/admin/support/live-chats/templates`, {
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(json.templates)) {
        setTemplates(json.templates);
      }
    } catch {
      // Optional
    }
  }, [apiBase]);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    if (selectedChatId) {
      setAiSummary('');
      loadChatDetail(selectedChatId);
    } else {
      setActiveChat(null);
      setChatMessages([]);
    }
  }, [selectedChatId, loadChatDetail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages.length, selectedChatId]);

  // Live poll every 6s for waiting queue updates & active co-browse telemetry
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadChats({ preserveSelection: true, silent: true });
      if (selectedChatId) loadChatDetail(selectedChatId, { silent: true });
    }, 6000);
    return () => window.clearInterval(timer);
  }, [loadChats, loadChatDetail, selectedChatId]);

  const pagedChats = useMemo(() => {
    const start = (page - 1) * pageSize;
    return chats.slice(start, start + pageSize);
  }, [chats, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [statusTab, searchQuery, pageSize]);

  const handleTogglePresence = async () => {
    const next = !isOnline;
    setTogglingOnline(true);
    setIsOnline(next);
    try {
      await fetch(`${apiBase}/admin/support/live-chats/presence`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', 'x-desk-strict': '1' }),
        body: JSON.stringify({ isOnline: next }),
      });
      await loadChats();
    } catch {
      setIsOnline(!next);
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleChatAction = async (action, payload = {}) => {
    if (!activeChat?.id || actingChat) return;
    setActingChat(true);
    try {
      const res = await fetch(`${apiBase}/admin/support/live-chats/${encodeURIComponent(activeChat.id)}/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', 'x-desk-strict': '1' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Could not perform ${action}`);
      }
      if (json.chat) setActiveChat(json.chat);
      if (Array.isArray(json.messages)) setChatMessages(json.messages);
      if (action === 'accept') {
        setStatusTab('my_active');
      }
      showToast?.(
        action === 'accept'
          ? 'Live chat accepted.'
          : action === 'hold'
            ? 'Live chat placed on hold.'
            : action === 'end'
              ? 'Live chat closed.'
              : 'Converted to support ticket.',
        'success'
      );
      await Promise.all([
        loadChats({ preserveSelection: true, silent: true }),
        loadChatDetail(activeChat.id, { silent: true }),
      ]);
    } catch (err) {
      showToast?.(err.message || 'Action failed', 'error');
    } finally {
      setActingChat(false);
    }
  };

  const handleRowQueueAction = async (targetChatId, action, e) => {
    e?.stopPropagation();
    if (!targetChatId || actingChat) return;
    setActingChat(true);
    try {
      const res = await fetch(
        `${apiBase}/admin/support/live-chats/${encodeURIComponent(targetChatId)}/${action}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json', 'x-desk-strict': '1' }),
          body: '{}',
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Could not ${action} chat.`);
      }
      if (action === 'accept') {
        setSelectedChatId(targetChatId);
        setStatusTab('my_active');
        setMobileView('thread');
        showToast?.('Live chat accepted.', 'success');
      } else {
        setChats((prev) => prev.filter((item) => item.id !== targetChatId));
        if (selectedChatId === targetChatId) setSelectedChatId(null);
        showToast?.('Live chat removed from your queue.', 'info');
      }
      await loadChats({ preserveSelection: true, silent: true });
    } catch (err) {
      showToast?.(err.message || 'Queue action failed.', 'error');
    } finally {
      setActingChat(false);
    }
  };

  const handleSendReply = async (e) => {
    e?.preventDefault();
    const text = replyText.trim();
    if (!text || !activeChat?.id || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await fetch(`${apiBase}/admin/support/live-chats/${encodeURIComponent(activeChat.id)}/reply`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', 'x-desk-strict': '1' }),
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not send reply');
      }
      if (Array.isArray(json.messages)) {
        setChatMessages(json.messages);
      } else if (json.message) {
        setChatMessages((prev) => [...prev, json.message]);
      }
      if (json.chat) setActiveChat(json.chat);
      setReplyText('');
      await Promise.all([
        loadChatDetail(activeChat.id, { silent: true }),
        loadChats({ preserveSelection: true, silent: true }),
      ]);
    } catch (err) {
      showToast?.(err.message || 'Reply failed', 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleAiAssist = async (mode) => {
    if (!activeChat?.id || !aiEnabled || aiBusy) return;
    setAiBusy(true);
    try {
      const res = await fetch(`${apiBase}/admin/support/live-chats/${encodeURIComponent(activeChat.id)}/ai-assist`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', 'x-desk-strict': '1' }),
        body: JSON.stringify({ mode, draft: replyText }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'AI assist unavailable');
      }
      const resultText = json.suggestion || json.reply || json.text || json.summary || '';
      if (mode === 'summarize') {
        setAiSummary(resultText);
      } else if (resultText) {
        setReplyText(resultText);
      }
    } catch (err) {
      showToast?.(err.message || 'AI assist failed', 'error');
    } finally {
      setAiBusy(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    if (!tplTitle.trim() || !tplBody.trim() || savingTpl) return;
    setSavingTpl(true);
    try {
      const res = await fetch(`${apiBase}/admin/support/live-chats/templates`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders({ 'Content-Type': 'application/json', 'x-desk-strict': '1' }),
        body: JSON.stringify({
          title: tplTitle.trim(),
          category: tplCategory.trim() || 'General',
          body: tplBody.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to save template');
      setTplTitle('');
      setTplBody('');
      showToast?.('Staff template saved.', 'success');
      await loadTemplates();
    } catch (err) {
      showToast?.(err.message || 'Could not save template', 'error');
    } finally {
      setSavingTpl(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    try {
      const res = await fetch(`${apiBase}/admin/support/live-chats/templates/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // Ignore
    }
  };

  const handlePushCoBrowseGuide = async (e) => {
    e.preventDefault();
    if (!activeChat?.id || (!guideNote.trim() && !guideSelector.trim()) || pushingGuide) return;
    setPushingGuide(true);
    try {
      const res = await fetch(
        `${apiBase}/admin/support/live-chats/${encodeURIComponent(activeChat.id)}/co-browse-guide`,
        {
          method: 'POST',
          credentials: 'include',
          headers: getAuthHeaders({ 'Content-Type': 'application/json', 'x-desk-strict': '1' }),
          body: JSON.stringify({
            highlightSelector: guideSelector.trim(),
            agentGuidanceNote: guideNote.trim(),
          }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 404) {
        throw new Error(json.error || 'Could not push co-browse guidance');
      }
      showToast?.('Co-browsing step guidance sent to visitor.', 'success');
      setGuideNote('');
      setGuideSelector('');
      await loadChatDetail(activeChat.id);
    } catch (err) {
      showToast?.(err.message || 'Failed to push guidance', 'error');
    } finally {
      setPushingGuide(false);
    }
  };

  const queueTabs = [
    { id: 'waiting', label: 'Waiting', badge: counts.waiting || 0 },
    { id: 'my_active', label: 'My Active', badge: counts.myActive || 0 },
    ...(isSuperAdmin ? [{ id: 'active', label: 'All Active (Super Admin)', badge: counts.active || 0 }] : []),
    { id: 'on_hold', label: `On Hold (${counts.on_hold || 0})` },
    { id: 'closed', label: `Closed (${counts.closed || 0})` },
  ];

  const coBrowseTelemetry = activeChat?.coBrowse || activeChat?.coBrowseTelemetry || null;
  const coBrowseConsented = Boolean(coBrowseTelemetry?.consent || activeChat?.coBrowseConsent);
  const activeStatusLower = String(activeChat?.status || '').toLowerCase();
  const isClosedChat = activeStatusLower === 'closed' || activeStatusLower === 'cancelled';
  const currentActorId = currentUser?.id ? String(currentUser.id) : '';
  const activeChatReplyLock = getChatReplyLockInfo(activeChat, {
    currentActorId,
    isSuperAdmin,
    canReplyPermission: canReply,
  });
  const needsAcceptanceToReply = Boolean(activeChat && !isClosedChat && activeStatusLower !== 'active' && canReply);

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Strict Session Isolation + Presence Header */}
      <div className={`flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 sm:p-3.5 ${mobileView !== 'list' ? 'hidden xl:flex' : 'flex'}`}>
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              Strict Session Isolation Active
            </p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Specialists only see the unassigned Waiting Queue and chats they personally accept. Active/Closed threads assigned to other staff remain isolated.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-700 dark:text-neutral-300 tabular-nums">
            <Users className="h-3.5 w-3.5 text-[#1ED760]" />
            <span>{presence.onlineAgentsCount} Online · {presence.freeAgentsCount} Free</span>
          </div>
          <button
            type="button"
            disabled={togglingOnline}
            onClick={handleTogglePresence}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition cursor-pointer ${
              isOnline
                ? 'bg-[#1ED760] text-neutral-950 hover:bg-[#19c355]'
                : 'border border-neutral-300 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${isOnline ? 'bg-neutral-950' : 'bg-neutral-400'}`} />
            {isOnline ? 'Agent Online' : 'Agent Offline'}
          </button>
          <button
            type="button"
            onClick={() => setTemplateManagerOpen((v) => !v)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 text-xs font-medium text-neutral-700 dark:text-neutral-200 hover:border-[#1ED760] cursor-pointer"
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            Templates ({templates.length})
          </button>
        </div>
      </div>

      {/* Staff Response Template Manager */}
      {templateManagerOpen && (
        <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              Staff Response Templates
            </h3>
            <button
              type="button"
              onClick={() => setTemplateManagerOpen(false)}
              className="text-neutral-400 hover:text-neutral-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleCreateTemplate} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <input
              type="text"
              required
              value={tplTitle}
              onChange={(e) => setTplTitle(e.target.value)}
              placeholder="Template title..."
              className="h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100"
            />
            <input
              type="text"
              value={tplCategory}
              onChange={(e) => setTplCategory(e.target.value)}
              placeholder="Category"
              className="h-9 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100"
            />
            <input
              type="text"
              required
              value={tplBody}
              onChange={(e) => setTplBody(e.target.value)}
              placeholder="Response body..."
              className="h-9 sm:col-span-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100"
            />
            <div className="sm:col-span-4 flex justify-end">
              <button
                type="submit"
                disabled={savingTpl}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-neutral-950 hover:bg-[#19c355] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Save Template
              </button>
            </div>
          </form>

          {templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3 flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                        {tpl.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteTemplate(tpl.id)}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        title="Delete template"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                      {tpl.body}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyText((prev) => (prev ? `${prev}\n${tpl.body}` : tpl.body))}
                    className="self-start text-[11px] font-semibold text-emerald-700 dark:text-[#1ED760] hover:underline cursor-pointer"
                  >
                    Insert into composer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Queue Tabs + Search */}
      <div className={`flex-wrap items-center justify-between gap-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3 ${mobileView !== 'list' ? 'hidden xl:flex' : 'flex'}`}>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {queueTabs.map((tab) => {
            const active = statusTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTab(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                  active
                    ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950 font-semibold'
                    : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70'
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badge === 'number' && tab.badge > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                      tab.id === 'waiting'
                        ? 'bg-[#1ED760] text-neutral-950'
                        : 'bg-black/15 dark:bg-white/15'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search visitor, serial, topic..."
            className="h-8 w-52 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => loadChats()}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split Live Chat Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left: Paginated Queue Table/List */}
        <div className={`xl:col-span-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex-col overflow-hidden ${mobileView === 'list' ? 'flex' : 'hidden xl:flex'}`}>
          <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800 max-h-[65dvh] xl:max-h-[540px] overflow-y-auto flex-1">
            {loadingList && chats.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">Loading live queue...</div>
            ) : pagedChats.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No live chat sessions in this view.
              </div>
            ) : (
              pagedChats.map((chat) => {
                const selected = selectedChatId === chat.id;
                const rowReplyLock = getChatReplyLockInfo(chat, {
                  currentActorId,
                  isSuperAdmin,
                  canReplyPermission: canReply,
                });
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => {
                      setSelectedChatId(chat.id);
                      setMobileView('thread');
                    }}
                    className={`w-full text-left p-3.5 transition cursor-pointer ${
                      selected
                        ? 'bg-[#1ED760]/10 border-l-2 border-l-[#1ED760]'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">
                        {chat.serialNumber || chat.chatNumber || `#${chat.id}`}
                      </span>
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {rowReplyLock.rowBadge && (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                              rowReplyLock.badgeTone === 'closed'
                                ? 'border-neutral-300/80 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/80 dark:text-neutral-400'
                                : rowReplyLock.badgeTone === 'accept'
                                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                                  : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
                            }`}
                          >
                            <Lock className="h-2.5 w-2.5" />
                            {rowReplyLock.rowBadge}
                          </span>
                        )}
                        <span className="rounded-full border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-medium capitalize text-neutral-600 dark:text-neutral-300">
                          {String(chat.status || 'waiting').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                      {chat.customerName || chat.guestName || 'Visitor'}
                    </p>
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                      {chat.topic || chat.department || 'General Support'}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
                      <span>{chat.assignedAgentName || 'Waiting Specialist'}</span>
                      <span>{formatDateTime(chat.updatedAt || chat.createdAt)}</span>
                    </div>
                    {chat.status === 'waiting' && (
                      <div className="mt-2 flex items-center gap-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleRowQueueAction(chat.id, 'accept', e)}
                          className="inline-flex h-6 items-center gap-1 rounded-md bg-[#1ED760] px-2.5 text-[10px] font-semibold text-neutral-950 hover:bg-[#19c354]"
                        >
                          <UserCheck className="h-3 w-3" />
                          Accept
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => handleRowQueueAction(chat.id, 'cancel', e)}
                          className="inline-flex h-6 items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <PaginationBar
            page={page}
            pageSize={pageSize}
            total={chats.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
            itemLabel="chats"
          />
        </div>

        {/* Center/Right: Active Live Chat Thread + Co-Browse Sync + Composer */}
        <div className={`xl:col-span-8 grid grid-cols-1 lg:grid-cols-12 gap-4 ${mobileView === 'list' ? 'hidden xl:grid' : 'grid'}`}>
          <div className={`lg:col-span-8 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex-col h-[calc(100dvh-165px)] min-h-[480px] xl:h-[600px] overflow-hidden ${mobileView === 'cobrowse' ? 'hidden lg:flex' : 'flex'}`}>
            {!activeChat ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <Headphones className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {loadingChat ? 'Loading session...' : 'Select a live chat session'}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Accept waiting visitors to claim exclusive isolation and start helping.
                </p>
                <button
                  type="button"
                  onClick={() => setMobileView('list')}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 xl:hidden cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Queue
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 dark:border-neutral-800 p-3 sm:p-3.5">
                  <div className="flex items-start gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={() => setMobileView('list')}
                      aria-label="Back to live chat queue"
                      className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 xl:hidden cursor-pointer"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">
                          {activeChat.serialNumber || `#${activeChat.id}`}
                        </span>
                        <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
                          {activeChat.customerName || activeChat.guestName || 'Visitor'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5 truncate">
                        {activeChat.customerEmail || activeChat.guestEmail || 'No email'} · {activeChat.topic || 'Live Queue'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {needsAcceptanceToReply && (
                      <button
                        type="button"
                        disabled={actingChat}
                        onClick={() => handleChatAction('accept')}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-neutral-950 hover:bg-[#19c355] cursor-pointer"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        {activeStatusLower === 'on_hold' ? 'Resume & Accept' : 'Accept Chat'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMobileView('cobrowse')}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium lg:hidden cursor-pointer ${
                        coBrowseConsented
                          ? 'border-[#1ED760]/40 bg-[#1ED760]/10 text-emerald-700 dark:text-[#1ED760]'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200'
                      }`}
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      Co-Browse
                    </button>
                    {!isClosedChat && (
                      <button
                        type="button"
                        disabled={actingChat}
                        onClick={() => handleChatAction('hold', { reason: 'Awaiting review' })}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                      >
                        <PauseCircle className="h-3.5 w-3.5" />
                        On Hold
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={actingChat}
                      onClick={() => handleChatAction('convert-to-ticket')}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-700 px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                    >
                      <Ticket className="h-3.5 w-3.5 text-[#1ED760]" />
                      To Ticket
                    </button>
                    {!isClosedChat && (
                      <button
                        type="button"
                        disabled={actingChat}
                        onClick={() => handleChatAction('end')}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/50 px-2.5 text-xs font-medium text-red-600 dark:text-red-400 cursor-pointer"
                      >
                        End
                      </button>
                    )}
                  </div>
                </div>

                {aiSummary && (
                  <div className="border-b border-neutral-200/80 dark:border-neutral-800 bg-emerald-50/70 dark:bg-emerald-950/20 px-4 py-2.5 text-xs text-neutral-800 dark:text-neutral-200">
                    <div className="flex items-center justify-between font-semibold text-emerald-700 dark:text-[#1ED760] mb-1">
                      <span className="inline-flex items-center gap-1">
                        <Sparkles className="h-3.5 w-3.5" /> AI Thread Summary
                      </span>
                      <button type="button" onClick={() => setAiSummary('')} className="text-neutral-400 cursor-pointer">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-[11px]">{aiSummary}</p>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#fafafa]/40 dark:bg-neutral-950">
                  {chatMessages.map((msg, idx) => {
                    const senderType = String(msg.senderType || msg.senderRole || '').toLowerCase();
                    const isSystem = senderType === 'system';
                    const isStaff = senderType === 'staff' || senderType === 'agent';
                    const isAi = senderType === 'ai' || senderType === 'bot';
                    if (isSystem) {
                      return (
                        <div key={msg.id || idx} className="text-center">
                          <span className="inline-block rounded-full border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-1 text-[10px] text-neutral-500">
                            {msg.body || msg.text}
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div key={msg.id || idx} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-xl px-3.5 py-2 text-xs ${
                            isStaff
                              ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-950'
                              : isAi
                                ? 'bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/70 text-neutral-900 dark:text-neutral-100'
                                : 'bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 text-[10px] opacity-80 mb-0.5 font-semibold">
                            <span>{msg.senderName || (isStaff ? 'Specialist' : isAi ? 'Tiwi AI Assistant' : 'Visitor')}</span>
                            {isAi && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-indigo-300/70 bg-indigo-100/80 px-1.5 py-0 text-[9px] font-semibold text-indigo-700 dark:border-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                                <Sparkles className="h-2.5 w-2.5" />
                                AI
                              </span>
                            )}
                            <span>· {formatDateTime(msg.createdAt)}</span>
                          </div>
                          <p className="whitespace-pre-wrap">{msg.body || msg.text || msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Staff Composer + Accept Lock + Templates + AI Assist Toolbar */}
                {!activeChatReplyLock.canReply ? (
                  <div className="border-t border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300">
                        <Lock className={`h-4 w-4 shrink-0 ${activeChatReplyLock.badgeTone === 'accept' ? 'text-[#1ED760]' : 'text-neutral-500'}`} />
                        <span className="font-medium">
                          {`Unable to reply — ${activeChatReplyLock.reason || 'Reply access restricted.'}`}
                        </span>
                      </div>
                      {needsAcceptanceToReply && (
                        <button
                          type="button"
                          disabled={actingChat}
                          onClick={() => handleChatAction('accept')}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-neutral-950 hover:bg-[#19c355] disabled:opacity-50 cursor-pointer"
                        >
                          <UserCheck className="h-3.5 w-3.5" />
                          {activeStatusLower === 'on_hold' ? 'Resume & Accept' : 'Accept Chat to Reply'}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      disabled
                      readOnly
                      value=""
                      placeholder={`Unable to reply — ${activeChatReplyLock.reason || 'Reply access restricted.'}`}
                      aria-label="Disabled live chat reply composer"
                      className="h-9 w-full cursor-not-allowed rounded-lg border border-neutral-200/80 bg-neutral-100/80 px-3 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/70 dark:text-neutral-400"
                    />
                  </div>
                ) : (
                  <form onSubmit={handleSendReply} className="border-t border-neutral-200/80 dark:border-neutral-800 p-3 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        value=""
                        onChange={(e) => {
                          const found = templates.find((t) => String(t.id) === e.target.value);
                          if (found) setReplyText((prev) => (prev ? `${prev}\n${found.body}` : found.body));
                        }}
                        className="h-7 rounded-md border border-neutral-200 dark:border-neutral-700 bg-[#fafafa] dark:bg-neutral-900 px-2 text-[11px] text-neutral-700 dark:text-neutral-200"
                      >
                        <option value="">1-Click Response Template...</option>
                        {templates.map((tpl) => (
                          <option key={tpl.id} value={tpl.id}>
                            {tpl.title}
                          </option>
                        ))}
                      </select>

                      {aiEnabled && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={aiBusy}
                            onClick={() => handleAiAssist('suggest_reply')}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#1ED760]/40 bg-[#1ED760]/10 px-2 text-[11px] font-semibold text-emerald-800 dark:text-[#1ED760] hover:bg-[#1ED760]/20 cursor-pointer"
                          >
                            <Sparkles className="h-3 w-3" />
                            AI Draft
                          </button>
                          <button
                            type="button"
                            disabled={aiBusy || !replyText.trim()}
                            onClick={() => handleAiAssist('polish_reply')}
                            title="Rewrite your draft following Tiwlo Brand Guidelines and preview it in the box before sending"
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-[#1ED760]/40 bg-[#1ED760]/10 px-2 text-[11px] font-semibold text-emerald-800 dark:text-[#1ED760] hover:bg-[#1ED760]/20 disabled:opacity-40 cursor-pointer"
                          >
                            <Wand2 className="h-3 w-3" />
                            AI Write
                          </button>
                          <button
                            type="button"
                            disabled={aiBusy}
                            onClick={() => handleAiAssist('summarize')}
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
                          >
                            Summarize
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-end gap-2">
                      <textarea
                        rows={2}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write your specialist reply..."
                        className="flex-1 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={!replyText.trim() || sendingReply}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-neutral-950 hover:bg-[#19c355] disabled:opacity-40 cursor-pointer"
                      >
                        {sendingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>

          {/* Co-Browsing Live Sync Card (Consent telemetry + Push step guidance, NO voice-to-text) */}
          <div className={`lg:col-span-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-3 h-fit ${mobileView === 'cobrowse' ? 'block' : 'hidden lg:block'}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileView('thread')}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 lg:hidden cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <Monitor className={`h-4 w-4 ${coBrowseConsented ? 'text-[#1ED760]' : 'text-neutral-400'}`} />
                <h3 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  Co-Browsing Live Sync
                </h3>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  coBrowseConsented
                    ? 'bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]'
                    : 'bg-neutral-100 dark:bg-neutral-900 text-neutral-500'
                }`}
              >
                {coBrowseConsented ? 'Consent Active' : 'Not Shared'}
              </span>
            </div>

            {!activeChat ? (
              <p className="text-xs text-neutral-500">Select a chat to view consented visitor telemetry.</p>
            ) : !coBrowseConsented ? (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Waiting for the visitor to toggle &ldquo;Share Current Screen View&rdquo; inside their chat widget.
              </p>
            ) : (
              <>
                <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Current Route</span>
                    <span className="font-mono text-[11px] font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[160px]">
                      {coBrowseTelemetry?.route || '/'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Scroll Position</span>
                    <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                      {coBrowseTelemetry?.scrollPct ?? 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-neutral-500">Viewport</span>
                    <span className="tabular-nums text-[11px] text-neutral-700 dark:text-neutral-300">
                      {coBrowseTelemetry?.viewport?.width || 0}×{coBrowseTelemetry?.viewport?.height || 0}
                    </span>
                  </div>
                </div>

                <form onSubmit={handlePushCoBrowseGuide} className="space-y-2 pt-1">
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    Push Highlight Selector (optional)
                  </label>
                  <input
                    type="text"
                    value={guideSelector}
                    onChange={(e) => setGuideSelector(e.target.value)}
                    placeholder="e.g. #billing-upgrade-btn"
                    className="h-8 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 font-mono text-[11px] text-neutral-900 dark:text-neutral-100"
                  />
                  <label className="block text-[11px] font-medium text-neutral-700 dark:text-neutral-300">
                    Step Guidance Note
                  </label>
                  <textarea
                    rows={2}
                    value={guideNote}
                    onChange={(e) => setGuideNote(e.target.value)}
                    placeholder="Tell the visitor what step to click next..."
                    className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100"
                  />
                  <button
                    type="submit"
                    disabled={pushingGuide || (!guideNote.trim() && !guideSelector.trim())}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] py-2 text-xs font-semibold text-neutral-950 disabled:opacity-40 cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {pushingGuide ? 'Sending Guide...' : 'Push Guided Highlight'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
