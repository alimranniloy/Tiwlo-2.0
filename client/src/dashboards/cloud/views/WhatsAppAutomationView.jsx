import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Plus,
  RefreshCw,
  Check,
  CheckCircle2,
  QrCode,
  Smartphone,
  Bot,
  Sparkles,
  Sliders,
  Globe,
  Trash2,
  LogOut,
  Copy,
  ExternalLink,
  Send,
  Clock,
  ArrowRight,
  Shield,
  Layers,
  ChevronRight,
  AlertCircle,
  HelpCircle,
  Zap,
  Tag,
  Activity,
  BarChart3,
  TrendingUp,
  Cpu,
  FileText,
  PlusCircle,
  Settings,
  Link,
  Store,
  ChevronDown
} from 'lucide-react';

export default function WhatsAppAutomationView({
  currentUser,
  currentStore,
  userStores = [],
  showToast = () => {}
}) {
  // Navigation Tabs: 'sessions' | 'connect' | 'automation' | 'simulator' | 'logs'
  const [activeTab, setActiveTab] = useState('sessions');

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // Telemetry Chart State (for Activity Logs tab)
  const [chartRange, setChartRange] = useState('24h'); // '1h' | '24h' | '7d'
  const [chartMetric, setChartMetric] = useState('volume'); // 'volume' | 'latency'

  // Connect / QR Code Generation State
  const [newSessionName, setNewSessionName] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [regeneratingQr, setRegeneratingQr] = useState(false);
  const [connectingSession, setConnectingSession] = useState(null);
  const [copiedId, setCopiedId] = useState(false);

  // Automation Config State (Per-Session)
  const [automationForm, setAutomationForm] = useState({
    enabled: true,
    preset: 'sales',
    customPrompt: '',
    responseDelayMs: 1500,
    enableBengali: true
  });

  // Storefront Connection State (Per-Session)
  const [storeConnectionType, setStoreConnectionType] = useState('registered'); // 'registered' | 'custom_domain'
  const [selectedStoreTiwiId, setSelectedStoreTiwiId] = useState(currentStore?.tiwiId || '');
  const [customDomainUrl, setCustomDomainUrl] = useState('');
  const [customKnowledgeNotes, setCustomKnowledgeNotes] = useState('');
  const [extraPages, setExtraPages] = useState([]); // [{ id, title, url, content }]
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageUrl, setNewPageUrl] = useState('');
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [syncingStore, setSyncingStore] = useState(false);

  // Simulator State
  const [simMessage, setSimMessage] = useState('');
  const [simLoading, setSimLoading] = useState(false);
  const [simChat, setSimChat] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'আসসালামু আলাইকুম! Tiwi 2.0 WhatsApp অ্যাসিস্ট্যান্ট হিসেবে আপনাকে স্বাগতম। আমাদের স্টোরের প্রোডাক্ট সম্পর্কে কি জানতে চান?',
      time: 'Just now'
    }
  ]);

  const pollIntervalRef = useRef(null);

  // 1. Fetch Sessions List
  const fetchSessions = async (keepSelection = true) => {
    try {
      const res = await fetch('/api/whatsapp/sessions', {
        headers: currentUser?.id ? { Authorization: `Bearer ${localStorage.getItem('stockpro_session') || ''}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        const list = data.sessions || [];
        setSessions(list);
        if (!keepSelection || !selectedSessionId) {
          if (list.length > 0) {
            setSelectedSessionId(list[0].sessionId);
            loadSessionIntoForm(list[0]);
          }
        } else {
          const current = list.find(s => s.sessionId === selectedSessionId);
          if (current) loadSessionIntoForm(current);
        }
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions(false);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Helper: Load session config into local state
  const loadSessionIntoForm = (sess) => {
    if (!sess) return;
    setAutomationForm(sess.automationConfig || {
      enabled: true,
      preset: 'sales',
      customPrompt: '',
      responseDelayMs: 1500,
      enableBengali: true
    });

    const sk = sess.storeKnowledge;
    if (sk) {
      setStoreConnectionType(sk.storeType || (sk.storeUrl?.startsWith('http') ? 'custom_domain' : 'registered'));
      if (sk.tiwiId) setSelectedStoreTiwiId(sk.tiwiId);
      setCustomDomainUrl(sk.storeUrl || '');
      setCustomKnowledgeNotes(sk.customKnowledge || '');
      setExtraPages(sk.customPages || []);
    } else {
      setStoreConnectionType('registered');
      setSelectedStoreTiwiId(sess.storeId || currentStore?.tiwiId || '');
      setCustomDomainUrl('');
      setCustomKnowledgeNotes('');
      setExtraPages([]);
    }
  };

  const currentSession = sessions.find(s => s.sessionId === selectedSessionId) || sessions[0] || connectingSession;

  // When selectedSessionId changes, update form
  useEffect(() => {
    if (selectedSessionId) {
      const sess = sessions.find(s => s.sessionId === selectedSessionId);
      if (sess) loadSessionIntoForm(sess);
    }
  }, [selectedSessionId]);

  // 2. Poll connecting session when QR scanner is visible
  useEffect(() => {
    if (connectingSession?.sessionId && activeTab === 'connect') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

      pollIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/whatsapp/sessions/${connectingSession.sessionId}`);
          const data = await res.json();
          if (data.success && data.session) {
            setConnectingSession(data.session);

            setSessions(prev =>
              prev.map(s => s.sessionId === data.session.sessionId ? data.session : s)
            );

            if (data.session.status === 'CONNECTED') {
              clearInterval(pollIntervalRef.current);
              showToast('WhatsApp connected successfully!', 'success');
              setSelectedSessionId(data.session.sessionId);
              loadSessionIntoForm(data.session);
            }
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 2000);

      return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      };
    }
  }, [connectingSession?.sessionId, activeTab]);

  // Create New Session handler
  const handleCreateSession = async () => {
    setCreatingSession(true);
    try {
      const storeTiwiId = selectedStoreTiwiId || currentStore?.tiwiId || '';
      const name = newSessionName.trim() || `WhatsApp Store ${sessions.length + 1}`;

      const res = await fetch('/api/whatsapp/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser?.id,
          storeId: storeTiwiId,
          sessionName: name
        })
      });
      const data = await res.json();
      if (data.success && data.session) {
        setConnectingSession(data.session);
        setSelectedSessionId(data.session.sessionId);
        setSessions(prev => [data.session, ...prev]);
        setNewSessionName('');
        setActiveTab('connect');
        showToast('QR Code generated! Scan with WhatsApp Linked Devices.', 'info');
      } else {
        showToast(data.error || 'Failed to generate QR session', 'error');
      }
    } catch (err) {
      showToast('Error generating QR code: ' + err.message, 'error');
    } finally {
      setCreatingSession(false);
    }
  };

  // Regenerate QR Code for current connecting session
  const handleRegenerateQr = async () => {
    const targetSessionId = connectingSession?.sessionId || selectedSessionId;
    if (!targetSessionId) {
      handleCreateSession();
      return;
    }
    setRegeneratingQr(true);
    try {
      const res = await fetch(`/api/whatsapp/sessions/${targetSessionId}/regenerate-qr`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.session) {
        setConnectingSession(data.session);
        setSessions(prev => prev.map(s => s.sessionId === data.session.sessionId ? data.session : s));
        showToast('QR Code refreshed! Scan with WhatsApp.', 'info');
      } else {
        showToast(data.error || 'Failed to refresh QR', 'error');
      }
    } catch (err) {
      showToast('Error refreshing QR: ' + err.message, 'error');
    } finally {
      setRegeneratingQr(false);
    }
  };

  // Toggle Auto-Reply Directly on Session Card
  const handleToggleAutoReply = async (session, e) => {
    e?.stopPropagation();
    const updated = !session.automationConfig?.enabled;
    try {
      const res = await fetch(`/api/whatsapp/sessions/${session.sessionId}/automation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: updated })
      });
      const data = await res.json();
      if (data.success) {
        setSessions(prev =>
          prev.map(s => s.sessionId === session.sessionId ? { ...s, automationConfig: { ...s.automationConfig, enabled: updated } } : s)
        );
        if (selectedSessionId === session.sessionId) {
          setAutomationForm(prev => ({ ...prev, enabled: updated }));
        }
        showToast(`Tiwi 2.0 Auto-Reply ${updated ? 'Activated' : 'Paused'}`, 'info');
      }
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  // Save Automation Config handler (for current session)
  const handleSaveAutomation = async () => {
    if (!currentSession) return;
    setSavingAutomation(true);
    try {
      const res = await fetch(`/api/whatsapp/sessions/${currentSession.sessionId}/automation`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(automationForm)
      });
      const data = await res.json();
      if (data.success && data.session) {
        setSessions(prev =>
          prev.map(s => s.sessionId === data.session.sessionId ? data.session : s)
        );
        showToast(`Settings saved for ${currentSession.sessionName}!`, 'success');
      } else {
        showToast(data.error || 'Failed to save settings', 'error');
      }
    } catch (err) {
      showToast('Error saving settings: ' + err.message, 'error');
    } finally {
      setSavingAutomation(false);
    }
  };

  // Sync Storefront Knowledge & Domain Pages handler
  const handleSyncStore = async () => {
    if (!currentSession) return;
    setSyncingStore(true);
    try {
      const payload = {
        storeType: storeConnectionType,
        storeId: storeConnectionType === 'registered' ? selectedStoreTiwiId : null,
        storeUrl: storeConnectionType === 'custom_domain' ? customDomainUrl.trim() : '',
        customPages: extraPages,
        customKnowledge: customKnowledgeNotes.trim()
      };

      const res = await fetch(`/api/whatsapp/sessions/${currentSession.sessionId}/sync-store`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success && data.storeKnowledge) {
        showToast(`Store connected! ${data.storeKnowledge.productCount} products and ${data.storeKnowledge.customPages?.length || 0} pages synced.`, 'success');
        fetchSessions(true);
      } else {
        showToast(data.error || 'Store sync failed', 'error');
      }
    } catch (err) {
      showToast('Error syncing store: ' + err.message, 'error');
    } finally {
      setSyncingStore(false);
    }
  };

  // Add Extra Page URL
  const handleAddExtraPage = () => {
    if (!newPageUrl.trim()) return;
    const page = {
      id: 'page_' + Date.now(),
      title: newPageTitle.trim() || 'Store Page',
      url: newPageUrl.trim(),
      content: ''
    };
    setExtraPages(prev => [...prev, page]);
    setNewPageTitle('');
    setNewPageUrl('');
    showToast('Page added to sync queue. Click Sync to apply.', 'info');
  };

  const handleRemoveExtraPage = (pageId) => {
    setExtraPages(prev => prev.filter(p => p.id !== pageId));
  };

  // Disconnect Session handler
  const handleDisconnect = async (sessionId, e) => {
    e?.stopPropagation();
    if (!confirm('Are you sure you want to disconnect this WhatsApp session?')) return;
    try {
      const res = await fetch(`/api/whatsapp/sessions/${sessionId}/disconnect`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast('Session disconnected successfully', 'info');
        fetchSessions(true);
      }
    } catch (err) {
      showToast('Error disconnecting: ' + err.message, 'error');
    }
  };

  // Delete Session handler
  const handleDelete = async (sessionId, e) => {
    e?.stopPropagation();
    if (!confirm('Permanently delete this WhatsApp session?')) return;
    try {
      const res = await fetch(`/api/whatsapp/sessions/${sessionId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Session deleted', 'info');
        setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
        if (selectedSessionId === sessionId) {
          setSelectedSessionId(null);
        }
      }
    } catch (err) {
      showToast('Error deleting session: ' + err.message, 'error');
    }
  };

  // Test Simulator Send Message
  const handleSimSend = async (e) => {
    e?.preventDefault();
    if (!simMessage.trim() || !currentSession) return;

    const userText = simMessage.trim();
    setSimMessage('');
    setSimChat(prev => [
      ...prev,
      { id: 'user_' + Date.now(), sender: 'user', text: userText, time: 'Now' }
    ]);
    setSimLoading(true);

    try {
      const res = await fetch(`/api/whatsapp/sessions/${currentSession.sessionId}/test-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText })
      });
      const data = await res.json();
      if (data.success && data.result) {
        setSimChat(prev => [
          ...prev,
          { id: 'bot_' + Date.now(), sender: 'bot', text: data.result.reply, time: 'Now' }
        ]);
      } else {
        setSimChat(prev => [
          ...prev,
          { id: 'bot_' + Date.now(), sender: 'bot', text: 'I am here to assist! Could you specify your inquiry?', time: 'Now' }
        ]);
      }
    } catch (err) {
      setSimChat(prev => [
        ...prev,
        { id: 'bot_' + Date.now(), sender: 'bot', text: 'Error in simulation test: ' + err.message, time: 'Now' }
      ]);
    } finally {
      setSimLoading(false);
    }
  };

  // Persona Presets (Tiwi 2.0 Engine)
  const personaPresets = [
    {
      id: 'sales',
      title: 'Sales & Orders Assistant',
      desc: 'Recommends products, answers pricing, calculates totals, and provides store checkout links.',
      badge: 'High Conversion',
      badgeColor: 'bg-[#e8f0fe] text-[#0b57d0] border-[#c2e7ff]'
    },
    {
      id: 'support',
      title: 'Customer Support Specialist',
      desc: 'Assists with order delivery status, returns, store hours, warranty, and customer satisfaction.',
      badge: '24/7 Care',
      badgeColor: 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
    },
    {
      id: 'leads',
      title: 'Lead Capture & Inquiries',
      desc: 'Warmly greets prospective buyers, collects specific requirements, and records customer notes.',
      badge: 'Growth Engine',
      badgeColor: 'bg-[#fef7e0] text-[#b06000] border-[#feefc3]'
    },
    {
      id: 'custom',
      title: 'Custom Store Persona',
      desc: 'Craft your own personalized system instructions, tailored tone of voice, and store guidelines.',
      badge: 'Flexible',
      badgeColor: 'bg-[#f3e8fd] text-[#7c3aed] border-[#e9d5ff]'
    }
  ];

  // Dynamic Chart Points (Google Cloud Style Area Chart)
  const chartPoints = [
    { time: '00:00', volume: 12, latency: 1.4 },
    { time: '04:00', volume: 8, latency: 1.2 },
    { time: '08:00', volume: 34, latency: 1.6 },
    { time: '12:00', volume: 58, latency: 1.8 },
    { time: '16:00', volume: 72, latency: 1.5 },
    { time: '20:00', volume: 46, latency: 1.4 },
    { time: 'Now', volume: 64, latency: 1.5 }
  ];
  const maxVal = chartMetric === 'volume' ? 80 : 2.5;

  // Active stores available for selection
  const availableStores = userStores.length > 0 ? userStores : [
    { tiwiId: currentStore?.tiwiId || '', storeName: currentStore?.storeName || 'Primary Store' }
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {/* ======================================================== */}
      {/* 1. GOOGLE CLOUD STYLE HEADER */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#5f6368] dark:text-gray-400 mb-1">
            <span>Tiwlo Cloud</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[#1f1f1f] dark:text-gray-200 font-semibold">WhatsApp Automation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-[#1f1f1f] dark:text-white">
            WhatsApp Automation
          </h1>
          <p className="text-xs sm:text-sm text-[#5f6368] dark:text-gray-400 mt-1 max-w-2xl">
            Orchestrate smart WhatsApp instances powered by Tiwi 2.0 AI, synchronize live store catalogs, and close sales automatically.
          </p>
        </div>

        {/* Action Button: Connect / Generate QR */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              if (sessions.length > 0 && !connectingSession) {
                setConnectingSession(sessions[0]);
              }
              setActiveTab('connect');
            }}
            className="px-5 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] active:bg-[#062e6f] text-white text-xs sm:text-sm font-medium transition-all shadow-xs hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4 stroke-[2.2]" />
            <span>Scan QR Code</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. GOOGLE CLOUD CONSOLE TOP MENU / TAB BAR */}
      {/* ======================================================== */}
      <div className="border-b border-[#dadce0] dark:border-gray-800 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
        {[
          { id: 'sessions', label: 'Sessions & Devices', icon: Smartphone, badge: sessions.length },
          { id: 'connect', label: 'Scan QR Code', icon: QrCode },
          { id: 'automation', label: 'Automation Settings', icon: Sliders },
          { id: 'simulator', label: 'Live Test Simulator', icon: Sparkles },
          { id: 'logs', label: 'Activity Logs', icon: Activity }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-[#0b57d0] text-[#0b57d0] dark:text-[#8ab4f8] font-semibold -mb-[1px]'
                  : 'border-transparent text-[#5f6368] dark:text-gray-400 hover:text-[#1f1f1f] dark:hover:text-gray-200 hover:border-[#dadce0]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.badge !== 'undefined' && tab.badge > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-[#e8f0fe] text-[#0b57d0] dark:bg-blue-950/60 dark:text-blue-300'
                    : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ======================================================== */}
      {/* TAB 1: SESSIONS & DEVICES */}
      {/* ======================================================== */}
      {activeTab === 'sessions' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[#1f1f1f] dark:text-white">
                Registered WhatsApp Business Numbers
              </h2>
              <p className="text-xs text-[#5f6368] dark:text-gray-400">
                Click any session to configure its independent Tiwi 2.0 persona, synced store, and automation rules.
              </p>
            </div>

            <button
              onClick={() => setActiveTab('connect')}
              className="px-4 py-2 rounded-full border border-[#dadce0] dark:border-gray-800 hover:bg-[#f8f9fa] dark:hover:bg-gray-800 text-xs font-semibold text-[#0b57d0] transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Number</span>
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-[22px] border border-[#dadce0] dark:border-gray-800 shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#e8f0fe] text-[#0b57d0] flex items-center justify-center mx-auto">
                <Smartphone className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-white">
                  No active WhatsApp sessions
                </h3>
                <p className="text-xs text-[#5f6368] dark:text-gray-400">
                  Connect your business phone number via QR scan to activate automated Tiwi 2.0 customer replies.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('connect')}
                className="px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-xs font-medium transition cursor-pointer inline-flex items-center gap-2"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan WhatsApp QR Code</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map(sess => {
                const isSelected = selectedSessionId === sess.sessionId;
                const isConnected = sess.status === 'CONNECTED';
                const isWaitingQr = sess.status === 'SCAN_QR' || sess.status === 'INITIALIZING';

                return (
                  <div
                    key={sess.sessionId}
                    onClick={() => {
                      setSelectedSessionId(sess.sessionId);
                      loadSessionIntoForm(sess);
                      setActiveTab('automation');
                    }}
                    className={`p-6 rounded-[22px] bg-white dark:bg-gray-900 border transition-all cursor-pointer space-y-4 group ${
                      isSelected
                        ? 'border-[#0b57d0] ring-2 ring-[#0b57d0]/10 shadow-[0_4px_16px_rgba(11,87,208,0.08)]'
                        : 'border-[#dadce0] dark:border-gray-800 hover:border-[#747775] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 ${
                          isConnected
                            ? 'bg-[#25D366]/10 text-[#25D366]'
                            : isWaitingQr
                              ? 'bg-[#fef7e0] text-[#b06000]'
                              : 'bg-slate-100 text-slate-500'
                        }`}>
                          <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-medium text-[#1f1f1f] dark:text-white group-hover:text-[#0b57d0] transition-colors">
                              {sess.sessionName}
                            </h3>
                            {isConnected && (
                              <span className="w-2 h-2 rounded-full bg-[#137333] animate-pulse" />
                            )}
                          </div>
                          <div className="text-xs text-[#5f6368] dark:text-gray-400 mt-0.5 font-mono">
                            {sess.phoneNumber ? `+${sess.phoneNumber}` : 'Pending QR Link'}
                          </div>
                        </div>
                      </div>

                      {/* Status Pill */}
                      <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                        isConnected
                          ? 'bg-[#e6f4ea] text-[#137333] border-[#ceead6]'
                          : isWaitingQr
                            ? 'bg-[#fef7e0] text-[#b06000] border-[#feefc3]'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {isConnected ? '● Connected' : isWaitingQr ? 'Scan QR' : 'Disconnected'}
                      </span>
                    </div>

                    {/* Summary Metric Chips */}
                    <div className="grid grid-cols-3 gap-2 py-2.5 px-3 bg-[#f8f9fa] dark:bg-gray-800/50 rounded-xl text-center text-xs">
                      <div>
                        <span className="text-[10px] text-[#747775] block">Tiwi 2.0 Persona</span>
                        <span className="font-medium text-[#1f1f1f] dark:text-gray-200 capitalize">
                          {sess.automationConfig?.preset || 'Sales'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#747775] block">Synced Store</span>
                        <span className="font-medium text-[#1f1f1f] dark:text-gray-200 truncate block">
                          {sess.storeKnowledge?.storeName || (sess.storeKnowledge?.storeUrl ? 'Custom Domain' : 'Not Connected')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#747775] block">AI Replies</span>
                        <span className="font-medium text-[#1f1f1f] dark:text-gray-200">
                          {sess.stats?.aiRepliesSent || 0}
                        </span>
                      </div>
                    </div>

                    {/* Direct Controls */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#f1f3f4] dark:border-gray-800">
                      {/* Auto-Reply Master Toggle */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleToggleAutoReply(sess, e)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                            sess.automationConfig?.enabled ? 'bg-[#137333]' : 'bg-slate-300 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              sess.automationConfig?.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="text-xs text-[#5f6368] font-medium">
                          {sess.automationConfig?.enabled ? 'Tiwi 2.0 Active' : 'Paused'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isWaitingQr && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConnectingSession(sess);
                              setActiveTab('connect');
                            }}
                            className="px-3 py-1 rounded-full bg-[#fef7e0] text-[#b06000] text-xs font-semibold hover:bg-[#feefc3] transition cursor-pointer"
                          >
                            Scan QR
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSessionId(sess.sessionId);
                            loadSessionIntoForm(sess);
                            setActiveTab('automation');
                          }}
                          className="px-3.5 py-1 rounded-full bg-[#e8f0fe] dark:bg-blue-950/40 text-[#0b57d0] dark:text-blue-300 hover:bg-[#d2e3fc] text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Configure</span>
                        </button>

                        {isConnected && (
                          <button
                            onClick={(e) => handleDisconnect(sess.sessionId, e)}
                            title="Disconnect Session"
                            className="p-1.5 rounded-full text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(sess.sessionId, e)}
                          title="Delete Session"
                          className="p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: SCAN QR CODE */}
      {/* ======================================================== */}
      {activeTab === 'connect' && (
        <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dadce0] dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#dadce0] dark:border-gray-800">
            <div>
              <span className="text-xs font-semibold text-[#0b57d0] uppercase tracking-wider block">
                WHATSAPP LINKED DEVICES GATEWAY
              </span>
              <h3 className="text-xl font-medium text-[#1f1f1f] dark:text-white mt-0.5">
                Scan QR Code to Link WhatsApp Number
              </h3>
              <p className="text-xs text-[#5f6368] dark:text-gray-400 mt-1">
                Zero data leakage with Multi-File Auth. Scan from Android or iPhone in seconds.
              </p>
            </div>

            {connectingSession && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#5f6368] bg-[#f1f3f4] dark:bg-gray-800 px-3 py-1 rounded-full">
                  ID: {connectingSession.sessionId}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(connectingSession.sessionId);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 2000);
                  }}
                  className="text-xs text-[#0b57d0] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">

            {/* QR Code Container */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-[#f8f9fa] dark:bg-gray-800/40 rounded-[20px] border border-[#dadce0]/60 min-h-[340px]">
              {connectingSession?.status === 'CONNECTED' ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#e6f4ea] text-[#137333] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#1f1f1f] dark:text-white">
                      Device Connected Successfully!
                    </h4>
                    <p className="text-xs text-[#5f6368] dark:text-gray-400 mt-1 font-mono">
                      +{connectingSession.phoneNumber}
                    </p>
                  </div>
                  <div className="pt-2 flex flex-col gap-2">
                    <button
                      onClick={() => {
                        setSelectedSessionId(connectingSession.sessionId);
                        loadSessionIntoForm(connectingSession);
                        setActiveTab('automation');
                      }}
                      className="px-6 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Configure Automation Settings</span>
                    </button>
                  </div>
                </div>
              ) : connectingSession?.qrCodeDataUrl ? (
                <div className="space-y-4 text-center">
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-[#dadce0] inline-block">
                    <img
                      src={connectingSession.qrCodeDataUrl}
                      alt="Scan WhatsApp QR"
                      className="w-56 h-56 object-contain"
                    />
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={handleRegenerateQr}
                      disabled={regeneratingQr}
                      className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-[#dadce0] text-xs font-medium text-[#1f1f1f] dark:text-white hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#0b57d0] ${regeneratingQr ? 'animate-spin' : ''}`} />
                      <span>{regeneratingQr ? 'Refreshing...' : 'Regenerate QR Code'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#5f6368]">
                    Scanning active • Listening on WhatsApp socket
                  </p>
                </div>
              ) : (
                <div className="py-8 text-center space-y-4 max-w-xs">
                  <div className="w-14 h-14 rounded-2xl bg-[#e8f0fe] text-[#0b57d0] flex items-center justify-center mx-auto">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1f1f1f] dark:text-white">
                      Instant WhatsApp QR Pairing
                    </h4>
                    <p className="text-xs text-[#5f6368] mt-1">
                      Click below to generate an active QR code linked to Tiwi 2.0 AI.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      placeholder="Session Name (e.g. Sales Desk)"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#dadce0] dark:border-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#0b57d0]"
                    />
                    <button
                      onClick={handleCreateSession}
                      disabled={creatingSession}
                      className="w-full py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {creatingSession ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Generating QR Code...</span>
                        </>
                      ) : (
                        <>
                          <QrCode className="w-4 h-4" />
                          <span>Generate QR Code</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Step by Step Instructions */}
            <div className="md:col-span-7 space-y-4 text-sm text-[#444746] dark:text-gray-300">
              <h4 className="text-sm font-semibold text-[#1f1f1f] dark:text-white">
                How to link your WhatsApp number in 4 simple steps:
              </h4>

              <div className="space-y-3.5 text-xs leading-relaxed">
                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#0b57d0] text-white font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    Open <span className="font-semibold text-[#1f1f1f] dark:text-white">WhatsApp</span> on your smartphone.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#0b57d0] text-white font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    Go to <span className="font-semibold text-[#1f1f1f] dark:text-white">Settings</span> (iOS) or tap <span className="font-semibold text-[#1f1f1f] dark:text-white">Three Dots (⋮)</span> (Android) and choose <span className="font-semibold text-[#1f1f1f] dark:text-white">Linked Devices</span>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#0b57d0] text-white font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    Tap <span className="font-semibold text-[#1f1f1f] dark:text-white">Link a Device</span> and point your phone camera at the QR code on the left.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#0b57d0] text-white font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    As soon as verified, your phone connects and Tiwi 2.0 starts answering customer inquiries according to your chosen persona.
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="p-3.5 rounded-xl bg-[#e8f0fe] dark:bg-blue-950/30 text-xs text-[#0b57d0] dark:text-blue-300 flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span>End-to-end encrypted session credentials with zero storage of personal chats.</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: AUTOMATION SETTINGS (PER-SESSION CONFIGURATION) */}
      {/* ======================================================== */}
      {activeTab === 'automation' && (
        <div className="space-y-6 animate-in fade-in duration-150">

          {/* Active Session Indicator & Switcher */}
          <div className="p-4 sm:p-5 rounded-[20px] bg-white dark:bg-gray-900 border border-[#dadce0] dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#e8f0fe] text-[#0b57d0] flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#5f6368] font-medium">Configuring WhatsApp Session</div>
                <div className="text-base font-semibold text-[#1f1f1f] dark:text-white flex items-center gap-2">
                  <span>{currentSession?.sessionName || 'Select a session'}</span>
                  {currentSession?.phoneNumber && (
                    <span className="text-xs font-mono font-normal text-[#5f6368]">
                      (+{currentSession.phoneNumber})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Session Switcher Dropdown */}
            {sessions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#5f6368]">Switch Session:</span>
                <select
                  value={selectedSessionId || ''}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setSelectedSessionId(sid);
                    const found = sessions.find(s => s.sessionId === sid);
                    if (found) loadSessionIntoForm(found);
                  }}
                  className="px-3 py-1.5 rounded-full border border-[#dadce0] dark:border-gray-800 text-xs font-medium text-[#1f1f1f] dark:text-white bg-white dark:bg-gray-800 focus:outline-hidden"
                >
                  {sessions.map(s => (
                    <option key={s.sessionId} value={s.sessionId}>
                      {s.sessionName} ({s.phoneNumber ? `+${s.phoneNumber}` : 'Pending QR'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Persona Selection */}
          <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dadce0] dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-6">
            <div>
              <span className="text-xs font-semibold text-[#0b57d0] uppercase tracking-wider block">
                TIWI 2.0 AI BRAIN
              </span>
              <h3 className="text-xl font-medium text-[#1f1f1f] dark:text-white mt-1">
                Choose Persona for This Session
              </h3>
              <p className="text-xs text-[#5f6368] dark:text-gray-400 mt-1">
                Each session can run an independent persona tailored to Sales, Customer Support, or Custom Business Logic.
              </p>
            </div>

            {/* Persona Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {personaPresets.map(preset => {
                const isSelected = automationForm.preset === preset.id;
                return (
                  <div
                    key={preset.id}
                    onClick={() => setAutomationForm(prev => ({ ...prev, preset: preset.id }))}
                    className={`p-5 rounded-[20px] border transition-all cursor-pointer space-y-3 ${
                      isSelected
                        ? 'border-[#0b57d0] bg-[#e8f0fe]/20 ring-2 ring-[#0b57d0]/10 shadow-xs'
                        : 'border-[#dadce0] dark:border-gray-800 hover:border-[#747775]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${preset.badgeColor}`}>
                        {preset.badge}
                      </span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-[#0b57d0] bg-[#0b57d0]' : 'border-slate-300'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1f1f1f] dark:text-white">
                        {preset.title}
                      </h4>
                      <p className="text-xs text-[#5f6368] dark:text-gray-400 mt-1 leading-relaxed">
                        {preset.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Prompt Box */}
            {automationForm.preset === 'custom' && (
              <div className="space-y-2 pt-2 animate-in fade-in duration-150">
                <label className="text-xs font-semibold text-[#1f1f1f] dark:text-white">
                  Custom Tiwi 2.0 System Prompt
                </label>
                <textarea
                  rows={4}
                  value={automationForm.customPrompt}
                  onChange={(e) => setAutomationForm(prev => ({ ...prev, customPrompt: e.target.value }))}
                  placeholder="e.g. You are a senior fashion advisor for Tiwlo Apparel. Welcome buyers, suggest outfits, and quote prices in BDT."
                  className="w-full p-3.5 rounded-xl border border-[#dadce0] dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#0b57d0]"
                />
              </div>
            )}
          </div>

          {/* Storefront Connection & Domain Pages (No random hardcoded URLs!) */}
          <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dadce0] dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-6">
            <div>
              <span className="text-xs font-semibold text-[#0b57d0] uppercase tracking-wider block">
                STOREFRONT & KNOWLEDGE SYNC
              </span>
              <h3 className="text-xl font-medium text-[#1f1f1f] dark:text-white mt-1">
                Connect Store Catalog & Domain Pages
              </h3>
              <p className="text-xs text-[#5f6368] dark:text-gray-400 mt-1">
                Select your registered store or provide custom domain URLs so Tiwi 2.0 accurately recommends products and answers store policies.
              </p>
            </div>

            {/* Mode Selector: Registered Store vs Custom Domain */}
            <div className="flex items-center gap-2 p-1 bg-[#f1f3f4] dark:bg-gray-800 rounded-full w-fit text-xs font-medium">
              <button
                type="button"
                onClick={() => setStoreConnectionType('registered')}
                className={`px-4 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                  storeConnectionType === 'registered'
                    ? 'bg-white dark:bg-gray-900 text-[#0b57d0] font-semibold shadow-xs'
                    : 'text-[#5f6368] dark:text-gray-400'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Connect Registered Store</span>
              </button>

              <button
                type="button"
                onClick={() => setStoreConnectionType('custom_domain')}
                className={`px-4 py-1.5 rounded-full transition cursor-pointer flex items-center gap-1.5 ${
                  storeConnectionType === 'custom_domain'
                    ? 'bg-white dark:bg-gray-900 text-[#0b57d0] font-semibold shadow-xs'
                    : 'text-[#5f6368] dark:text-gray-400'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Custom Domain / Website</span>
              </button>
            </div>

            {/* Registered Store Selector */}
            {storeConnectionType === 'registered' ? (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#1f1f1f] dark:text-white">
                  Select Registered Tiwlo Store
                </label>
                <div className="relative max-w-xl">
                  <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedStoreTiwiId}
                    onChange={(e) => setSelectedStoreTiwiId(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 rounded-full border border-[#dadce0] dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#0b57d0]"
                  >
                    {availableStores.map(st => (
                      <option key={st.tiwiId} value={st.tiwiId}>
                        {st.storeName} ({st.tiwiId})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-[#5f6368]">
                  Tiwi 2.0 will automatically sync products, stock levels, and pricing from this store.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#1f1f1f] dark:text-white">
                  Storefront Domain / Website URL
                </label>
                <div className="relative max-w-xl">
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={customDomainUrl}
                    onChange={(e) => setCustomDomainUrl(e.target.value)}
                    placeholder="https://yourstore.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#dadce0] dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#0b57d0]"
                  />
                </div>
                <p className="text-[11px] text-[#5f6368]">
                  Input your store URL or custom domain to reference in customer replies.
                </p>
              </div>
            )}

            {/* Extra Domain Pages & Policy Links */}
            <div className="pt-4 border-t border-[#f1f3f4] dark:border-gray-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-[#1f1f1f] dark:text-white">
                    Additional Domain Pages & Store URLs
                  </h4>
                  <p className="text-[11px] text-[#5f6368]">
                    Add specific policy or catalog pages (e.g. Return Policy, Size Guide, Pricing) that Tiwi 2.0 can cite.
                  </p>
                </div>
              </div>

              {/* Add Page Form */}
              <div className="flex flex-col sm:flex-row items-center gap-2 max-w-2xl">
                <input
                  type="text"
                  value={newPageTitle}
                  onChange={(e) => setNewPageTitle(e.target.value)}
                  placeholder="Page Label (e.g. Return Policy)"
                  className="w-full sm:w-1/3 px-3.5 py-2 rounded-xl border border-[#dadce0] dark:border-gray-800 text-xs bg-white dark:bg-gray-800 text-[#1f1f1f] dark:text-white focus:outline-hidden"
                />
                <input
                  type="url"
                  value={newPageUrl}
                  onChange={(e) => setNewPageUrl(e.target.value)}
                  placeholder="https://yourstore.com/returns"
                  className="w-full sm:w-2/3 px-3.5 py-2 rounded-xl border border-[#dadce0] dark:border-gray-800 text-xs bg-white dark:bg-gray-800 text-[#1f1f1f] dark:text-white focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddExtraPage}
                  className="px-4 py-2 rounded-xl bg-[#f1f3f4] hover:bg-[#e8eaed] text-[#0b57d0] text-xs font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Page</span>
                </button>
              </div>

              {/* List of Extra Pages */}
              {extraPages.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {extraPages.map(page => (
                    <div
                      key={page.id}
                      className="px-3 py-1.5 rounded-full bg-[#f8f9fa] dark:bg-gray-800 border border-[#dadce0] dark:border-gray-700 text-xs flex items-center gap-2"
                    >
                      <Link className="w-3 h-3 text-[#0b57d0]" />
                      <span className="font-medium text-[#1f1f1f] dark:text-white">{page.title}:</span>
                      <span className="text-[#5f6368] font-mono text-[11px] truncate max-w-xs">{page.url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraPage(page.id)}
                        className="text-slate-400 hover:text-red-600 transition cursor-pointer ml-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Knowledge Notes & FAQs */}
              <div className="space-y-1.5 pt-2">
                <label className="text-xs font-semibold text-[#1f1f1f] dark:text-white flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#0b57d0]" />
                  <span>Custom Store Knowledge & Delivery Policies</span>
                </label>
                <textarea
                  rows={3}
                  value={customKnowledgeNotes}
                  onChange={(e) => setCustomKnowledgeNotes(e.target.value)}
                  placeholder="e.g. Delivery: Dhaka 60 BDT (24 hrs), Outside Dhaka 120 BDT (48 hrs). Return within 7 days with intact tags. Payment: bKash, Nagad, Cash on Delivery."
                  className="w-full p-3.5 rounded-xl border border-[#dadce0] dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#0b57d0]"
                />
              </div>

              {/* Connect & Sync Storefront Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSyncStore}
                  disabled={syncingStore}
                  className="px-6 py-2.5 rounded-full bg-[#f1f3f4] dark:bg-gray-800 hover:bg-[#e8eaed] text-[#0b57d0] text-xs font-semibold transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingStore ? 'animate-spin' : ''}`} />
                  <span>{syncingStore ? 'Syncing Store Knowledge...' : 'Connect & Sync Storefront'}</span>
                </button>

                {currentSession?.storeKnowledge && (
                  <span className="text-xs text-[#137333] flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{currentSession.storeKnowledge.productCount} Products Synced</span>
                  </span>
                )}
              </div>

              {/* Synced Products Preview */}
              {currentSession?.storeKnowledge && (currentSession.storeKnowledge.products || []).length > 0 && (
                <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-gray-800/40 border border-[#dadce0]/60 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#1f1f1f] dark:text-white">
                      Active Synced Catalog Preview ({currentSession.storeKnowledge.products.length} items)
                    </span>
                    <span className="text-[#747775]">
                      Synced: {new Date(currentSession.storeKnowledge.syncedAt).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {currentSession.storeKnowledge.products.slice(0, 12).map((p, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-[#dadce0] text-[11px] text-[#444746] dark:text-gray-300"
                      >
                        {p.name} ({p.price} {currentSession.storeKnowledge.currency})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Preferences & Save Button */}
            <div className="pt-4 border-t border-[#f1f3f4] dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                {/* Bengali toggle */}
                <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#1f1f1f] dark:text-white">
                  <input
                    type="checkbox"
                    checked={automationForm.enableBengali}
                    onChange={(e) => setAutomationForm(prev => ({ ...prev, enableBengali: e.target.checked }))}
                    className="rounded border-[#dadce0] text-[#0b57d0] focus:ring-[#0b57d0]"
                  />
                  <span>Smart Bilingual Support (Bengali + English)</span>
                </label>
              </div>

              <button
                onClick={handleSaveAutomation}
                disabled={savingAutomation}
                className="px-7 py-2.5 rounded-full bg-[#0b57d0] hover:bg-[#0842a0] text-white text-xs font-semibold transition shadow-xs cursor-pointer flex items-center gap-2 self-end sm:self-auto disabled:opacity-50"
              >
                {savingAutomation && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Session Settings</span>
              </button>
            </div>
          </div>

        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: LIVE TEST SIMULATOR */}
      {/* ======================================================== */}
      {activeTab === 'simulator' && (
        <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dadce0] dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#dadce0] dark:border-gray-800">
            <div>
              <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0b57d0]" />
                <span>Interactive Tiwi 2.0 Test Simulator</span>
              </h3>
              <p className="text-xs text-[#5f6368] dark:text-gray-400">
                Test how Tiwi 2.0 responds to real buyer questions for <strong>{currentSession?.sessionName}</strong> before replying on live WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#5f6368]">
                Persona: <strong className="text-[#0b57d0] capitalize">{automationForm.preset}</strong>
              </span>
              <span className="text-[10px] font-semibold bg-[#e6f4ea] text-[#137333] px-2.5 py-0.5 rounded-full border border-[#ceead6]">
                Live Sandbox
              </span>
            </div>
          </div>

          {/* Quick Question Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#5f6368] font-medium">Quick Test:</span>
            {[
              'দাম কত?',
              'Do you have running shoes in stock?',
              'How long does delivery take to Dhaka?',
              'আমি অর্ডার করতে চাই'
            ].map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSimMessage(q)}
                className="px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-gray-800 hover:bg-[#e8eaed] text-[11px] text-[#1f1f1f] dark:text-white transition cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="max-w-2xl mx-auto rounded-[20px] bg-[#efeae2] dark:bg-gray-950 border border-[#dadce0] overflow-hidden">
            <div className="p-3.5 bg-[#25D366] text-white flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <span>{currentSession?.sessionName || 'Store Assistant'} (Tiwi 2.0)</span>
              </div>
              <span className="opacity-90 font-mono text-[11px]">
                {currentSession?.phoneNumber ? `+${currentSession.phoneNumber}` : 'Simulation Mode'}
              </span>
            </div>

            <div className="p-4 h-80 overflow-y-auto space-y-3">
              {simChat.map(msg => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-[#d9fdd3] text-[#111b21] rounded-tr-none'
                        : 'bg-white dark:bg-gray-800 text-[#111b21] dark:text-gray-100 rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span className="text-[9px] text-[#667781] block text-right mt-1">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
              {simLoading && (
                <div className="flex justify-start">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none text-xs text-[#5f6368] flex items-center gap-2 shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#25D366]" />
                    <span>Tiwi 2.0 thinking & composing response...</span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSimSend} className="p-3 bg-white dark:bg-gray-900 border-t border-[#dadce0] flex items-center gap-2">
              <input
                type="text"
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="Type customer message (e.g. 'দাম কত?', 'What products are available?')..."
                className="flex-1 px-4 py-2.5 rounded-full border border-[#dadce0] dark:border-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#25D366]"
              />
              <button
                type="submit"
                disabled={simLoading || !simMessage.trim()}
                className="p-2.5 rounded-full bg-[#25D366] text-white hover:bg-[#1ebd59] transition cursor-pointer disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 5: ACTIVITY LOGS & TELEMETRY */}
      {/* ======================================================== */}
      {activeTab === 'logs' && (
        <div className="space-y-6 animate-in fade-in duration-150">

          {/* Telemetry Chart */}
          <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dadce0] dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#e8f0fe] text-[#0b57d0] flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-white">
                    Real-Time Automation Telemetry
                  </h3>
                  <p className="text-xs text-[#5f6368] dark:text-gray-400">
                    Message throughput, Tiwi 2.0 auto-reply distribution, and latency.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-[#f1f3f4] dark:bg-gray-800 p-1 rounded-full text-xs">
                  <button
                    onClick={() => setChartMetric('volume')}
                    className={`px-3 py-1 rounded-full transition cursor-pointer ${
                      chartMetric === 'volume'
                        ? 'bg-white dark:bg-gray-900 text-[#0b57d0] font-semibold shadow-xs'
                        : 'text-[#5f6368] dark:text-gray-400'
                    }`}
                  >
                    Volume
                  </button>
                  <button
                    onClick={() => setChartMetric('latency')}
                    className={`px-3 py-1 rounded-full transition cursor-pointer ${
                      chartMetric === 'latency'
                        ? 'bg-white dark:bg-gray-900 text-[#0b57d0] font-semibold shadow-xs'
                        : 'text-[#5f6368] dark:text-gray-400'
                    }`}
                  >
                    Latency
                  </button>
                </div>
              </div>
            </div>

            {/* SVG Area Chart */}
            <div className="relative pt-4 pb-2">
              <svg className="w-full h-36 overflow-visible" viewBox="0 0 700 140">
                <defs>
                  <linearGradient id="chartGlowLogs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0b57d0" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#0b57d0" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0, 35, 70, 105].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="700"
                    y2={y}
                    stroke="#e0e2ec"
                    strokeDasharray="4 4"
                    className="opacity-40 dark:opacity-20"
                  />
                ))}

                <path
                  d={`M 0,${130 - (chartPoints[0][chartMetric] / maxVal) * 100} ` +
                    chartPoints.map((pt, i) => `L ${(i / (chartPoints.length - 1)) * 700},${130 - (pt[chartMetric] / maxVal) * 100}`).join(' ') +
                    ` L 700,140 L 0,140 Z`}
                  fill="url(#chartGlowLogs)"
                />

                <path
                  d={`M 0,${130 - (chartPoints[0][chartMetric] / maxVal) * 100} ` +
                    chartPoints.map((pt, i) => `L ${(i / (chartPoints.length - 1)) * 700},${130 - (pt[chartMetric] / maxVal) * 100}`).join(' ')}
                  fill="none"
                  stroke="#0b57d0"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />

                {chartPoints.map((pt, idx) => {
                  const cx = (idx / (chartPoints.length - 1)) * 700;
                  const cy = 130 - (pt[chartMetric] / maxVal) * 100;
                  return (
                    <g key={idx} className="cursor-pointer group">
                      <circle
                        cx={cx}
                        cy={cy}
                        r="4"
                        fill="#0b57d0"
                        stroke="#ffffff"
                        strokeWidth="2"
                        className="group-hover:r-6 transition-all"
                      />
                      <text
                        x={cx}
                        y="155"
                        textAnchor="middle"
                        className="text-[10px] fill-[#747775] font-sans"
                      >
                        {pt.time}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Real-Time Message Logs Table */}
          <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dadce0] dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#dadce0] dark:border-gray-800">
              <div>
                <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-white">
                  Live Message Stream ({currentSession?.sessionName || 'Selected Session'})
                </h3>
                <p className="text-xs text-[#5f6368] dark:text-gray-400">
                  Real-time transcript of customer messages and Tiwi 2.0 auto-replies.
                </p>
              </div>

              <button
                onClick={() => fetchSessions(true)}
                className="px-3 py-1.5 rounded-full border border-[#dadce0] text-xs font-medium text-[#5f6368] hover:bg-[#f8f9fa] transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            {(!currentSession?.messageLogs || currentSession.messageLogs.length === 0) ? (
              <div className="text-center py-12 text-[#5f6368] text-xs">
                No incoming messages recorded yet for this session. Test via the simulator or send a message to the linked WhatsApp number.
              </div>
            ) : (
              <div className="space-y-3">
                {currentSession.messageLogs.slice(-20).reverse().map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      log.direction === 'inbound'
                        ? 'bg-[#f8f9fa] dark:bg-gray-800/40 border-[#dadce0]/80'
                        : 'bg-[#e8f0fe]/30 dark:bg-blue-950/20 border-[#c2e7ff]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        log.direction === 'inbound'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-[#e6f4ea] text-[#137333]'
                      }`}>
                        {log.direction === 'inbound' ? 'Inbound Customer' : 'Tiwi 2.0 Reply'}
                      </span>
                      <div className="space-y-0.5">
                        <span className="font-mono text-[11px] text-[#5f6368] block">
                          {log.from || log.to || 'WhatsApp User'}
                        </span>
                        <p className="text-[#1f1f1f] dark:text-gray-200">{log.text}</p>
                      </div>
                    </div>

                    <span className="text-[10px] text-[#747775] whitespace-nowrap self-end sm:self-center font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
