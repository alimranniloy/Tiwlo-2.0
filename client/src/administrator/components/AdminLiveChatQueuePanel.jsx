import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

export default function AdminLiveChatQueuePanel({
  apiBase = '/api',
  isSuperAdmin = false,
  aiEnabled = true,
  showToast,
  onCountsChange,
}) {
  const [statusTab, setStatusTab] = useState('waiting'); // 'waiting' | 'my_active' | 'active' | 'on_hold' | 'closed'
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

  const loadChats = useCallback(async () => {
    setLoadingList(true);
    try {
      const apiStatus = statusTab === 'my_active' ? 'active' : statusTab;
      const params = new URLSearchParams();
      if (apiStatus) params.set('status', apiStatus);
      if (statusTab === 'my_active') params.set('mine', '1');
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

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
          if (prev && list.some((c) => c.id === prev)) return prev;
          return list[0]?.id || null;
        });
      }
    } catch {
      // Non-fatal
    } finally {
      setLoadingList(false);
    }
  }, [apiBase, statusTab, searchQuery, onCountsChange]);

  const loadChatDetail = useCallback(
    async (chatId) => {
      if (!chatId) {
        setActiveChat(null);
        setChatMessages([]);
        return;
      }
      setLoadingChat(true);
      try {
        const res = await fetch(`${apiBase}/admin/support/live-chats/${encodeURIComponent(chatId)}`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.chat) {
          setActiveChat(json.chat);
          setChatMessages(Array.isArray(json.messages) ? json.messages : []);
        }
      } catch {
        // Ignore transient
      } finally {
        setLoadingChat(false);
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

  // Live poll every 6s for waiting queue updates & active co-browse telemetry
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadChats();
      if (selectedChatId) loadChatDetail(selectedChatId);
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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || `Could not perform ${action}`);
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
      await Promise.all([loadChats(), loadChatDetail(activeChat.id)]);
    } catch (err) {
      showToast?.(err.message || 'Action failed', 'error');
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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'Could not send reply');
      }
      setReplyText('');
      await Promise.all([loadChatDetail(activeChat.id), loadChats()]);
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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
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
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            selector: guideSelector.trim(),
            note: guideNote.trim(),
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
  const isClosedChat = String(activeChat?.status || '').toLowerCase() === 'closed';

  return (
    <div className="space-y-4">
      {/* Strict Session Isolation + Presence Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3.5">
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
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
            onClick={loadChats}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 dark:border-neutral-800 px-2.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Split Live Chat Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        {/* Left: Paginated Queue Table/List */}
        <div className="xl:col-span-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col overflow-hidden">
          <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800 max-h-[540px] overflow-y-auto flex-1">
            {loadingList && chats.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">Loading live queue...</div>
            ) : pagedChats.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500">
                No live chat sessions in this view.
              </div>
            ) : (
              pagedChats.map((chat) => {
                const selected = selectedChatId === chat.id;
                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setSelectedChatId(chat.id)}
                    className={`w-full text-left p-3.5 transition cursor-pointer ${
                      selected
                        ? 'bg-[#1ED760]/10 border-l-2 border-l-[#1ED760]'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-semibold text-neutral-800 dark:text-neutral-200">
                        {chat.serialNumber || `#${chat.id}`}
                      </span>
                      <span className="rounded-full border border-neutral-200 dark:border-neutral-700 px-2 py-0.5 text-[10px] font-medium capitalize text-neutral-600 dark:text-neutral-300">
                        {String(chat.status || 'waiting').replace(/_/g, ' ')}
                      </span>
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
        <div className="xl:col-span-8 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-8 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex flex-col min-h-[540px] overflow-hidden">
            {!activeChat ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <Headphones className="h-8 w-8 text-neutral-300 dark:text-neutral-700" />
                <p className="mt-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {loadingChat ? 'Loading session...' : 'Select a live chat session'}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  Accept waiting visitors to claim exclusive isolation and start helping.
                </p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200/80 dark:border-neutral-800 p-3.5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {activeChat.serialNumber || `#${activeChat.id}`}
                      </span>
                      <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        {activeChat.customerName || activeChat.guestName || 'Visitor'}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-0.5">
                      {activeChat.customerEmail || activeChat.guestEmail || 'No email'} · {activeChat.topic || 'Live Queue'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {!activeChat.assignedAgentId && !isClosedChat && (
                      <button
                        type="button"
                        disabled={actingChat}
                        onClick={() => handleChatAction('accept')}
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1ED760] px-3 text-xs font-semibold text-neutral-950 hover:bg-[#19c355] cursor-pointer"
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        Accept Chat
                      </button>
                    )}
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
                    const isStaff = msg.senderRole === 'agent' || msg.senderRole === 'staff';
                    const isSystem = msg.senderRole === 'system';
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
                              : 'bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          <p className="text-[10px] opacity-70 mb-0.5 font-semibold">
                            {msg.senderName || (isStaff ? 'Specialist' : 'Visitor')} · {formatDateTime(msg.createdAt)}
                          </p>
                          <p className="whitespace-pre-wrap">{msg.body || msg.text || msg.message}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Staff Composer + Templates + AI Assist Toolbar */}
                {isClosedChat ? (
                  <div className="border-t border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3 flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>This live chat session is closed and archived.</span>
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
                            className="inline-flex h-7 items-center gap-1 rounded-md border border-neutral-200 dark:border-neutral-700 px-2 text-[11px] font-medium text-neutral-700 dark:text-neutral-200 disabled:opacity-40 cursor-pointer"
                          >
                            <Wand2 className="h-3 w-3" />
                            Polish
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
          <div className="lg:col-span-4 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-4 space-y-3 h-fit">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
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
