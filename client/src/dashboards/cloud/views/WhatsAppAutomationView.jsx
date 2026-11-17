import { applicationFetch as fetch } from '../../../api/graphqlTransport.js';
import { openMaterialDialog } from '../../../components/MaterialDialogProvider.jsx';
import ServiceSubscriptionGateView from '../../../views/ServiceSubscriptionGateView.jsx';
import { getCloudBillingData } from '../graphql/cloudQueries.js';
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
  ArrowUpRight,
  Shield,
  Layers,
  ChevronRight,
  AlertCircle,
  AlertTriangle,
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
  ChevronDown,
  CreditCard,
  Wallet,
  X,
  Loader2
} from 'lucide-react';

async function resilientWaFetch(url, options = {}) {
  const token =
    localStorage.getItem('stockpro_session') ||
    sessionStorage.getItem('stockpro_session') ||
    '';
  const reqOptions = {
    credentials: 'include',
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  };
  try {
    return await fetch(url, reqOptions);
  } catch (err) {
    if (String(err?.message || '').includes('No GraphQL operation is registered')) {
      return globalThis.fetch(url, reqOptions);
    }
    throw err;
  }
}

export default function WhatsAppAutomationView({
  currentUser,
  currentStore,
  userStores = [],
  onBack,
  onNavigateBilling,
  showToast = () => {}
}) {
  // Navigation Tabs: 'sessions' | 'connect' | 'automation' | 'simulator' | 'logs'
  const [activeTab, setActiveTab] = useState('sessions');

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [subChecking, setSubChecking] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState(null);

  // Paid Subscription & Quota State
  const [waSubscription, setWaSubscription] = useState(null);
  const [waPackages, setWaPackages] = useState([]);
  const [waTierInsight, setWaTierInsight] = useState(null);
  const [waNotifications, setWaNotifications] = useState([]);
  const [waUsage, setWaUsage] = useState({ sessionsCount: 0, autoReplyFlowsCount: 0, monthlyMessagesUsed: 0, dailyBroadcastsUsed: 0 });
  const [creditsBalance, setCreditsBalance] = useState(null);
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [purchasingPlanId, setPurchasingPlanId] = useState(null);
  const [modalAutoRenew, setModalAutoRenew] = useState(true);
  const [togglingAutoRenew, setTogglingAutoRenew] = useState(false);
  const [dismissingAlert, setDismissingAlert] = useState(false);
  const [subError, setSubError] = useState('');

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

  const navigateToBilling = (path = '/billing/credits', tab = 'credits') => {
    if (typeof onNavigateBilling === 'function') {
      onNavigateBilling(path, tab);
      return;
    }
    try {
      window.history.pushState(null, '', path);
      window.dispatchEvent(new PopStateEvent('popstate'));
    } catch {
      window.location.assign(path);
    }
  };

  // 1. Fetch Sessions List (ONLY invoked when subscription is verified active)
  const fetchSessions = async (keepSelection = true) => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/sessions', {
        headers: currentUser?.id ? { Authorization: `Bearer ${localStorage.getItem('stockpro_session') || ''}` } : {}
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.code === 'SUBSCRIPTION_REQUIRED') {
        setWaSubscription((prev) => ({ ...(prev || {}), isActive: false }));
        return;
      }
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

  const fetchSubscriptionState = async () => {
    try {
      const [subRes, pkgsRes, notifRes, billingRes] = await Promise.all([
        resilientWaFetch('/api/whatsapp/subscription'),
        resilientWaFetch('/api/whatsapp/packages'),
        resilientWaFetch('/api/whatsapp/subscription/notifications').catch(() => null),
        currentUser?.id
          ? getCloudBillingData(currentUser.id).catch(() => null)
          : Promise.resolve(null),
      ]);
      const subJson = await subRes.json().catch(() => ({}));
      const pkgsJson = pkgsRes.ok ? await pkgsRes.json().catch(() => ({})) : {};
      const notifJson = notifRes && notifRes.ok ? await notifRes.json().catch(() => ({})) : {};

      if (subRes.status === 402 || subJson.code === 'SUBSCRIPTION_REQUIRED') {
        setWaSubscription(subJson.subscription || { isActive: false });
      } else if (subJson.subscription !== undefined) {
        setWaSubscription(subJson.subscription);
        if (typeof subJson.subscription?.autoRenew === 'boolean') {
          setModalAutoRenew(subJson.subscription.autoRenew);
        }
      }

      if (subJson.usage) setWaUsage(subJson.usage);
      if (subJson.tierInsight !== undefined) setWaTierInsight(subJson.tierInsight);
      if (Array.isArray(notifJson.notifications)) setWaNotifications(notifJson.notifications);
      else if (Array.isArray(subJson.notifications)) setWaNotifications(subJson.notifications);

      if (Array.isArray(pkgsJson.packages)) setWaPackages(pkgsJson.packages);
      else if (Array.isArray(subJson.packages)) setWaPackages(subJson.packages);

      const rawCredits = billingRes?.account?.credits ?? billingRes?.credits;
      if (rawCredits !== undefined && rawCredits !== null && Number.isFinite(Number(rawCredits))) {
        setCreditsBalance(Number(rawCredits));
      }
      return subJson?.subscription || null;
    } catch (err) {
      console.warn('Could not load WhatsApp subscription state:', err);
      return null;
    }
  };

  const handleToggleAutoRenew = async () => {
    if (togglingAutoRenew || !waSubscription) return;
    const nextAutoRenew = !(waSubscription.autoRenew !== false);
    setTogglingAutoRenew(true);
    try {
      const res = await resilientWaFetch('/api/whatsapp/subscription/auto-renew', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoRenew: nextAutoRenew }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'Could not update auto-renewal preference.');
      }
      setWaSubscription((prev) => ({
        ...(data.subscription || prev || {}),
        autoRenew: data.subscription?.autoRenew ?? nextAutoRenew,
      }));
      setModalAutoRenew(data.subscription?.autoRenew ?? nextAutoRenew);
      window.dispatchEvent(new CustomEvent('tiwlo:service-subscriptions-changed'));
      showToast(`Monthly auto-renewal ${nextAutoRenew ? 'enabled' : 'disabled'}.`, 'success');
    } catch (err) {
      showToast(err.message || 'Could not update auto-renewal preference.', 'error');
    } finally {
      setTogglingAutoRenew(false);
    }
  };

  const handleDismissAlerts = async () => {
    if (dismissingAlert) return;
    setDismissingAlert(true);
    try {
      const unreadIds = waNotifications
        .filter((n) => (n.kind === 'payment_failed' || n.type === 'payment_failed') && !n.readAt && !n.read)
        .map((n) => n.id)
        .filter(Boolean);
      await resilientWaFetch('/api/whatsapp/subscription/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unreadIds.length ? { notificationIds: unreadIds } : {}),
      });
      const readAt = new Date().toISOString();
      setWaNotifications((prev) =>
        prev.map((n) =>
          n.kind === 'payment_failed' || n.type === 'payment_failed' ? { ...n, readAt, read: true } : n
        )
      );
      showToast('Payment alert dismissed.', 'info');
    } catch (err) {
      showToast(err.message || 'Could not dismiss alert.', 'error');
    } finally {
      setDismissingAlert(false);
    }
  };

  const handlePurchasePlan = async (planId, autoRenew = modalAutoRenew) => {
    setPurchasingPlanId(planId);
    setSubError('');
    try {
      const res = await resilientWaFetch('/api/whatsapp/subscription/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, autoRenew: Boolean(autoRenew) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setSubError(data.error || 'Failed to activate WhatsApp subscription.');
        showToast(data.error || 'Insufficient credits or plan error', 'error');
        return;
      }
      setWaSubscription(data.subscription);
      if (data.billing?.remainingCredits !== undefined && data.billing?.remainingCredits !== null) {
        setCreditsBalance(Number(data.billing.remainingCredits));
      }
      window.dispatchEvent(new CustomEvent('tiwlo:service-subscriptions-changed'));
      showToast(data.message || 'WhatsApp Bot subscription activated!', 'success');
      await fetchSubscriptionState();
      setShowPlanModal(false);
    } catch (err) {
      setSubError(err.message || 'Payment request failed');
      showToast(err.message || 'Payment request failed', 'error');
    } finally {
      setPurchasingPlanId(null);
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function verifyAndInit() {
      setSubChecking(true);
      const sub = await fetchSubscriptionState();
      if (cancelled) return;
      setSubChecking(false);
      if (sub?.isActive) {
        await fetchSessions(false);
      }
    }
    verifyAndInit();
    return () => {
      cancelled = true;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!waSubscription?.isActive) return undefined;
    const handleSubChange = () => {
      fetchSubscriptionState();
    };
    window.addEventListener('tiwlo:service-subscriptions-changed', handleSubChange);
    return () => window.removeEventListener('tiwlo:service-subscriptions-changed', handleSubChange);
  }, [waSubscription?.isActive]);

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
        fetchSubscriptionState();
        showToast('QR Code generated! Scan with WhatsApp Linked Devices.', 'info');
      } else {
        if (Array.isArray(data.packages)) setWaPackages(data.packages);
        if (res.status === 402 || res.status === 403 || data.code === 'SUBSCRIPTION_REQUIRED' || data.code === 'LIMIT_EXCEEDED') {
          setSubError(data.error || 'Paid subscription or upgrade required.');
          setShowPlanModal(true);
        }
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
        fetchSubscriptionState();
        showToast(`Tiwi 2.0 Auto-Reply ${updated ? 'Activated' : 'Paused'}`, 'info');
      } else {
        if (res.status === 402 || res.status === 403 || data.code === 'SUBSCRIPTION_REQUIRED' || data.code === 'LIMIT_EXCEEDED') {
          setSubError(data.error || 'Upgrade required for additional auto-reply flows.');
          setShowPlanModal(true);
        }
        showToast(data.error || 'Failed to update auto-reply status', 'error');
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
        fetchSubscriptionState();
        showToast(`Settings saved for ${currentSession.sessionName}!`, 'success');
      } else {
        if (res.status === 402 || res.status === 403 || data.code === 'SUBSCRIPTION_REQUIRED' || data.code === 'LIMIT_EXCEEDED') {
          setSubError(data.error || 'Paid subscription or plan upgrade required.');
          setShowPlanModal(true);
        }
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
    if (!await openMaterialDialog({ title: 'Disconnect WhatsApp?', message: 'This session will stop sending and receiving messages until it is connected again.', confirmLabel: 'Disconnect', tone: 'danger' })) return;
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
    if (!await openMaterialDialog({ title: 'Delete WhatsApp session?', message: 'This permanently removes the saved session and cannot be undone.', confirmLabel: 'Delete session', tone: 'danger' })) return;
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
      badgeColor: 'bg-[#efefef] text-[#000000] border-[#e1e1e1]'
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
      badgeColor: 'bg-[#ececec] text-[#555555] border-[#dcdcdc]'
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
  const availableStores = userStores.length > 0 ? userStores : (currentStore?.tiwiId ? [currentStore] : []);

  if (subChecking) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded-2xl border border-neutral-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
          <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
          <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-white dark:border-gray-800 dark:bg-gray-900" />
        </div>
      </div>
    );
  }

  if (!waSubscription?.isActive) {
    return (
      <ServiceSubscriptionGateView
        serviceType="whatsapp"
        currentUser={currentUser}
        initialData={{
          subscription: waSubscription,
          packages: waPackages,
          tierInsight: waTierInsight,
          notifications: waNotifications,
          usage: waUsage,
        }}
        onBack={onBack}
        onNavigateBilling={navigateToBilling}
        onActivated={async (purchaseData) => {
          if (purchaseData?.subscription) {
            setWaSubscription(purchaseData.subscription);
          }
          await fetchSubscriptionState();
          await fetchSessions(false);
        }}
        showToast={showToast}
      />
    );
  }

  const unreadPaymentAlerts = waNotifications.filter(
    (n) => (n.kind === 'payment_failed' || n.type === 'payment_failed') && !n.readAt && !n.read
  );
  const hasPaymentAlert = Boolean(
    waSubscription?.status === 'past_due' ||
      waSubscription?.lastRenewalError ||
      unreadPaymentAlerts.length > 0
  );

  const quotaMetrics = [
    { label: 'Active Sessions', used: waUsage.sessionsCount ?? sessions.length, limit: waSubscription.limits?.maxSessions ?? 1 },
    { label: 'Monthly Messages', used: waUsage.monthlyMessagesUsed ?? waSubscription.usage?.monthlyMessages ?? 0, limit: waSubscription.limits?.monthlyMessagesLimit ?? 2000 },
    { label: 'Daily Broadcasts', used: waUsage.dailyBroadcastsUsed ?? waSubscription.usage?.dailyBroadcasts ?? 0, limit: waSubscription.limits?.dailyBroadcastLimit ?? 100 },
    { label: 'Auto-Reply Flows', used: waUsage.autoReplyFlowsCount ?? sessions.filter(s => s.automationConfig?.enabled).length, limit: waSubscription.limits?.autoReplyFlowsLimit ?? 3 },
  ];
  const computedPeakPct = quotaMetrics.reduce((max, item) => {
    const pct = Math.min(100, Math.round((Number(item.used || 0) / Math.max(1, Number(item.limit || 1))) * 100));
    return Math.max(max, pct);
  }, 0);
  const peakUsagePct = Number.isFinite(Number(waTierInsight?.peakUsagePercent))
    ? Number(waTierInsight.peakUsagePercent)
    : computedPeakPct;
  const sortedPackages = [...waPackages].sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
  const nextUpgradePlan =
    (waTierInsight?.recommendedPlanId &&
      sortedPackages.find((p) => p.planId === waTierInsight.recommendedPlanId && p.planId !== waSubscription.planId)) ||
    sortedPackages.find((p) => Number(p.price || 0) > Number(waSubscription.price || 0)) ||
    null;
  const shouldSuggestUpgrade = Boolean(
    nextUpgradePlan && (peakUsagePct >= 75 || waTierInsight?.shouldUpgrade)
  );
  const autoRenewEnabled = waSubscription?.autoRenew !== false;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">

      {hasPaymentAlert && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-xs text-rose-800 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            <div>
              <p className="font-semibold text-rose-950">
                {waSubscription?.status === 'past_due'
                  ? 'Renewal Payment Failed — Action Required'
                  : 'Subscription Payment Alert'}
              </p>
              <p className="mt-0.5">
                {waSubscription?.lastRenewalError ||
                  unreadPaymentAlerts[0]?.message ||
                  'Your last auto-renewal payment failed. Top up your Tiwlo Credits to keep WhatsApp automation uninterrupted.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateToBilling('/billing/credits', 'credits')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Top Up Credits</span>
            </button>
            {unreadPaymentAlerts.length > 0 && (
              <button
                type="button"
                disabled={dismissingAlert}
                onClick={handleDismissAlerts}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
                <span>{dismissingAlert ? 'Dismissing...' : 'Dismiss'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. GOOGLE CLOUD STYLE HEADER */}
      {/* ======================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#636363] dark:text-gray-400 mb-1">
            <span>Tiwlo Cloud</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-[#1f1f1f] dark:text-gray-200 font-semibold">WhatsApp Automation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-[#1f1f1f] dark:text-white">
            WhatsApp Automation
          </h1>
          <p className="text-xs sm:text-sm text-[#636363] dark:text-gray-400 mt-1 max-w-2xl">
            Orchestrate smart WhatsApp instances powered by Tiwi 2.0 AI, synchronize live store catalogs, and close sales automatically.
          </p>
        </div>

        {/* Action Button: Plan & Connect / Generate QR */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => {
              setSubError('');
              setShowPlanModal(true);
            }}
            className="px-4 py-2.5 rounded-full border border-[#dcdcdc] bg-white hover:bg-[#f8f9fa] text-[#1f1f1f] text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer"
          >
            <CreditCard className="w-4 h-4 text-[#1ED760]" />
            <span>{waSubscription?.isActive ? `${waSubscription.planName} Plan` : 'Subscribe with Credits'}</span>
          </button>
          <button
            onClick={() => {
              if (!waSubscription?.isActive) {
                setSubError('Please activate a paid WhatsApp Bot package using Tiwlo Credits before linking QR sessions.');
                setShowPlanModal(true);
                return;
              }
              if (sessions.length > 0 && !connectingSession) {
                setConnectingSession(sessions[0]);
              }
              setActiveTab('connect');
            }}
            className="px-5 py-2.5 rounded-full bg-[#000000] hover:bg-[#3c3c3c] active:bg-[#2a2a2a] text-white text-xs sm:text-sm font-medium transition-all shadow-xs hover:shadow-[0_1px_3px_1px_rgba(60,64,67,0.15)] flex items-center gap-2 cursor-pointer"
          >
            <QrCode className="w-4 h-4 stroke-[2.2]" />
            <span>Scan QR Code</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1b. PAID SUBSCRIPTION & QUOTA BAR */}
      {/* ======================================================== */}
      <div className="rounded-2xl border border-[#dcdcdc] dark:border-gray-800 bg-white dark:bg-gray-900 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#f0f0f0] dark:border-gray-800 pb-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" /> Active Plan: {waSubscription.planName}
            </span>
            <span className="text-xs text-[#636363] dark:text-gray-400">
              ${Number(waSubscription.price || 0).toFixed(2)}/mo · Expires {waSubscription.expiresAt ? new Date(waSubscription.expiresAt).toLocaleDateString() : 'Monthly'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {creditsBalance !== null && (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1f1f1f] dark:text-gray-200">
                <Wallet className="w-3.5 h-3.5 text-[#1ED760]" />
                Credits: ${creditsBalance.toFixed(2)}
              </span>
            )}
            <button
              type="button"
              disabled={togglingAutoRenew}
              onClick={handleToggleAutoRenew}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold transition cursor-pointer disabled:opacity-60 ${
                autoRenewEnabled
                  ? 'border-[#1ED760]/50 bg-[#1ED760]/10 text-emerald-900 hover:bg-[#1ED760]/20'
                  : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              {togglingAutoRenew ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              <span>Auto-Renew: {autoRenewEnabled ? 'On' : 'Off'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPlanModal(true)}
              className="rounded-full bg-[#1ED760] hover:bg-[#19c354] px-3.5 py-1.5 text-xs font-semibold text-black transition cursor-pointer"
            >
              Upgrade Plan
            </button>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200/80 dark:border-gray-800 bg-neutral-50/70 dark:bg-gray-950/50 px-3.5 py-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-neutral-700 dark:text-gray-300">
              <TrendingUp className="w-3.5 h-3.5 text-[#1ED760]" />
              Tier Capacity Meter
            </span>
            <span className={`font-semibold tabular-nums ${peakUsagePct >= 75 ? 'text-amber-700' : 'text-neutral-900 dark:text-white'}`}>
              {peakUsagePct}% peak utilization
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full rounded-full bg-neutral-200/80 dark:bg-gray-800 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${peakUsagePct >= 85 ? 'bg-rose-500' : peakUsagePct >= 75 ? 'bg-amber-500' : 'bg-[#1ED760]'}`}
              style={{ width: `${Math.min(100, peakUsagePct)}%` }}
            />
          </div>
        </div>

        {shouldSuggestUpgrade && nextUpgradePlan && (
          <div className="flex flex-col gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-amber-950">
                {peakUsagePct}% tier usage reached — upgrade to {nextUpgradePlan.planName}
              </p>
              <p className="text-[11px] text-amber-800">
                Scale to {nextUpgradePlan.maxSessions} session(s) &amp; {Number(nextUpgradePlan.monthlyMessagesLimit || 0).toLocaleString()} monthly msgs for ${Number(nextUpgradePlan.price || 0).toFixed(2)}/mo.
              </p>
            </div>
            <button
              type="button"
              disabled={purchasingPlanId !== null}
              onClick={() => handlePurchasePlan(nextUpgradePlan.planId, autoRenewEnabled)}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] px-3.5 text-xs font-semibold text-black hover:bg-[#19c354] disabled:opacity-60 cursor-pointer"
            >
              {purchasingPlanId === nextUpgradePlan.planId ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Upgrading...</span>
                </>
              ) : (
                <>
                  <span>Upgrade to {nextUpgradePlan.planName}</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quotaMetrics.map((q) => {
            const pct = Math.min(100, Math.round((Number(q.used || 0) / Math.max(1, Number(q.limit || 1))) * 100));
            return (
              <div key={q.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#636363] dark:text-gray-400">{q.label}</span>
                  <span className="font-semibold tabular-nums text-[#1f1f1f] dark:text-white">
                    {Number(q.used || 0).toLocaleString()} / {Number(q.limit || 0).toLocaleString()}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-gray-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 85 ? 'bg-amber-500' : 'bg-[#1ED760]'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 2. GOOGLE CLOUD CONSOLE TOP MENU / TAB BAR */}
      {/* ======================================================== */}
      <div className="border-b border-[#dcdcdc] dark:border-gray-800 flex items-center gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
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
                  ? 'border-[#000000] text-[#000000] dark:text-[#b0b0b0] font-semibold -mb-[1px]'
                  : 'border-transparent text-[#636363] dark:text-gray-400 hover:text-[#1f1f1f] dark:hover:text-gray-200 hover:border-[#dcdcdc]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {typeof tab.badge !== 'undefined' && tab.badge > 0 && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  isActive
                    ? 'bg-[#efefef] text-[#000000] dark:bg-neutral-950/60 dark:text-neutral-300'
                    : 'bg-neutral-100 dark:bg-gray-800 text-neutral-600 dark:text-gray-300'
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
              <p className="text-xs text-[#636363] dark:text-gray-400">
                Click any session to configure its independent Tiwi 2.0 persona, synced store, and automation rules.
              </p>
            </div>

            <button
              onClick={() => setActiveTab('connect')}
              className="px-4 py-2 rounded-full border border-[#dcdcdc] dark:border-gray-800 hover:bg-[#f8f9fa] dark:hover:bg-gray-800 text-xs font-semibold text-[#000000] transition cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Number</span>
            </button>
          </div>

          {sessions.length === 0 ? (
            <div className="text-center py-16 px-4 bg-white dark:bg-gray-900 rounded-[22px] border border-[#dcdcdc] dark:border-gray-800 shadow-xs space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-[#efefef] text-[#000000] flex items-center justify-center mx-auto">
                <Smartphone className="w-7 h-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-white">
                  No active WhatsApp sessions
                </h3>
                <p className="text-xs text-[#636363] dark:text-gray-400">
                  Connect your business phone number via QR scan to activate automated Tiwi 2.0 customer replies.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('connect')}
                className="px-6 py-2.5 rounded-full bg-[#000000] hover:bg-[#3c3c3c] text-white text-xs font-medium transition cursor-pointer inline-flex items-center gap-2"
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
                        ? 'border-[#000000] ring-2 ring-[#000000]/10 shadow-[0_4px_16px_rgba(11,87,208,0.08)]'
                        : 'border-[#dcdcdc] dark:border-gray-800 hover:border-[#747775] shadow-xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3.5">
                        <div className={`w-12 h-12 rounded-[16px] flex items-center justify-center shrink-0 ${
                          isConnected
                            ? 'bg-[#25D366]/10 text-[#25D366]'
                            : isWaitingQr
                              ? 'bg-[#fef7e0] text-[#b06000]'
                              : 'bg-neutral-100 text-neutral-500'
                        }`}>
                          <Smartphone className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-medium text-[#1f1f1f] dark:text-white group-hover:text-[#000000] transition-colors">
                              {sess.sessionName}
                            </h3>
                            {isConnected && (
                              <span className="w-2 h-2 rounded-full bg-[#137333] animate-pulse" />
                            )}
                          </div>
                          <div className="text-xs text-[#636363] dark:text-gray-400 mt-0.5 font-mono">
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
                            : 'bg-neutral-100 text-neutral-600 border-neutral-200'
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
                            sess.automationConfig?.enabled ? 'bg-[#137333]' : 'bg-neutral-300 dark:bg-gray-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out ${
                              sess.automationConfig?.enabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                        <span className="text-xs text-[#636363] font-medium">
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
                          className="px-3.5 py-1 rounded-full bg-[#efefef] dark:bg-neutral-950/40 text-[#000000] dark:text-neutral-300 hover:bg-[#e1e1e1] text-xs font-semibold transition cursor-pointer flex items-center gap-1.5"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Configure</span>
                        </button>

                        {isConnected && (
                          <button
                            onClick={(e) => handleDisconnect(sess.sessionId, e)}
                            title="Disconnect Session"
                            className="p-1.5 rounded-full text-neutral-400 hover:text-amber-600 hover:bg-amber-50 transition cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDelete(sess.sessionId, e)}
                          title="Delete Session"
                          className="p-1.5 rounded-full text-neutral-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
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
        <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dcdcdc] dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#dcdcdc] dark:border-gray-800">
            <div>
              <span className="text-xs font-semibold text-[#000000] uppercase tracking-wider block">
                WHATSAPP LINKED DEVICES GATEWAY
              </span>
              <h3 className="text-xl font-medium text-[#1f1f1f] dark:text-white mt-0.5">
                Scan QR Code to Link WhatsApp Number
              </h3>
              <p className="text-xs text-[#636363] dark:text-gray-400 mt-1">
                Zero data leakage with Multi-File Auth. Scan from Android or iPhone in seconds.
              </p>
            </div>

            {connectingSession && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[#636363] bg-[#f1f3f4] dark:bg-gray-800 px-3 py-1 rounded-full">
                  ID: {connectingSession.sessionId}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(connectingSession.sessionId);
                    setCopiedId(true);
                    setTimeout(() => setCopiedId(false), 2000);
                  }}
                  className="text-xs text-[#000000] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {copiedId ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">

            {/* QR Code Container */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-6 bg-[#f8f9fa] dark:bg-gray-800/40 rounded-[20px] border border-[#dcdcdc]/60 min-h-[340px]">
              {connectingSession?.status === 'CONNECTED' ? (
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-[#e6f4ea] text-[#137333] flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h4 className="text-base font-semibold text-[#1f1f1f] dark:text-white">
                      Device Connected Successfully!
                    </h4>
                    <p className="text-xs text-[#636363] dark:text-gray-400 mt-1 font-mono">
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
                      className="px-6 py-2.5 rounded-full bg-[#000000] hover:bg-[#3c3c3c] text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Configure Automation Settings</span>
                    </button>
                  </div>
                </div>
              ) : connectingSession?.qrCodeDataUrl ? (
                <div className="space-y-4 text-center">
                  <div className="p-3 bg-white rounded-xl shadow-xs border border-[#dcdcdc] inline-block">
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
                      className="px-4 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-[#dcdcdc] text-xs font-medium text-[#1f1f1f] dark:text-white hover:bg-neutral-50 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-[#000000] ${regeneratingQr ? 'animate-spin' : ''}`} />
                      <span>{regeneratingQr ? 'Refreshing...' : 'Regenerate QR Code'}</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#636363]">
                    Scanning active • Listening on WhatsApp socket
                  </p>
                </div>
              ) : (
                <div className="py-8 text-center space-y-4 max-w-xs">
                  <div className="w-14 h-14 rounded-2xl bg-[#efefef] text-[#000000] flex items-center justify-center mx-auto">
                    <QrCode className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-[#1f1f1f] dark:text-white">
                      Instant WhatsApp QR Pairing
                    </h4>
                    <p className="text-xs text-[#636363] mt-1">
                      Click below to generate an active QR code linked to Tiwi 2.0 AI.
                    </p>
                  </div>

                  <div className="space-y-2 pt-2">
                    <input
                      type="text"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      placeholder="Session Name (e.g. Sales Desk)"
                      className="w-full px-3.5 py-2 rounded-xl border border-[#dcdcdc] dark:border-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#000000]"
                    />
                    <button
                      onClick={handleCreateSession}
                      disabled={creatingSession}
                      className="w-full py-2.5 rounded-full bg-[#000000] hover:bg-[#3c3c3c] text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
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
                  <span className="w-5 h-5 rounded-full bg-[#000000] text-white font-bold flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    Open <span className="font-semibold text-[#1f1f1f] dark:text-white">WhatsApp</span> on your smartphone.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#000000] text-white font-bold flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    Go to <span className="font-semibold text-[#1f1f1f] dark:text-white">Settings</span> (iOS) or tap <span className="font-semibold text-[#1f1f1f] dark:text-white">Three Dots (⋮)</span> (Android) and choose <span className="font-semibold text-[#1f1f1f] dark:text-white">Linked Devices</span>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#000000] text-white font-bold flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    Tap <span className="font-semibold text-[#1f1f1f] dark:text-white">Link a Device</span> and point your phone camera at the QR code on the left.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#000000] text-white font-bold flex items-center justify-center shrink-0">
                    4
                  </span>
                  <div>
                    As soon as verified, your phone connects and Tiwi 2.0 starts answering customer inquiries according to your chosen persona.
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <div className="p-3.5 rounded-xl bg-[#efefef] dark:bg-neutral-950/30 text-xs text-[#000000] dark:text-neutral-300 flex items-center gap-2">
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
          <div className="p-4 sm:p-5 rounded-[20px] bg-white dark:bg-gray-900 border border-[#dcdcdc] dark:border-gray-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#efefef] text-[#000000] flex items-center justify-center shrink-0">
                <Settings className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs text-[#636363] font-medium">Configuring WhatsApp Session</div>
                <div className="text-base font-semibold text-[#1f1f1f] dark:text-white flex items-center gap-2">
                  <span>{currentSession?.sessionName || 'Select a session'}</span>
                  {currentSession?.phoneNumber && (
                    <span className="text-xs font-mono font-normal text-[#636363]">
                      (+{currentSession.phoneNumber})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Session Switcher Dropdown */}
            {sessions.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#636363]">Switch Session:</span>
                <select
                  value={selectedSessionId || ''}
                  onChange={(e) => {
                    const sid = e.target.value;
                    setSelectedSessionId(sid);
                    const found = sessions.find(s => s.sessionId === sid);
                    if (found) loadSessionIntoForm(found);
                  }}
                  className="px-3 py-1.5 rounded-full border border-[#dcdcdc] dark:border-gray-800 text-xs font-medium text-[#1f1f1f] dark:text-white bg-white dark:bg-gray-800 focus:outline-hidden"
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
          <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dcdcdc] dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-6">
            <div>
              <span className="text-xs font-semibold text-[#000000] uppercase tracking-wider block">
                TIWI 2.0 AI BRAIN
              </span>
              <h3 className="text-xl font-medium text-[#1f1f1f] dark:text-white mt-1">
                Choose Persona for This Session
              </h3>
              <p className="text-xs text-[#636363] dark:text-gray-400 mt-1">
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
                        ? 'border-[#000000] bg-[#efefef]/20 ring-2 ring-[#000000]/10 shadow-xs'
                        : 'border-[#dcdcdc] dark:border-gray-800 hover:border-[#747775]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${preset.badgeColor}`}>
                        {preset.badge}
                      </span>
                      <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-[#000000] bg-[#000000]' : 'border-neutral-300'
                      }`}>
                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-[#1f1f1f] dark:text-white">
                        {preset.title}
                      </h4>
                      <p className="text-xs text-[#636363] dark:text-gray-400 mt-1 leading-relaxed">
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
                  className="w-full p-3.5 rounded-xl border border-[#dcdcdc] dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#000000]"
                />
              </div>
            )}
          </div>

          {/* Storefront Connection & Domain Pages (No random hardcoded URLs!) */}
          <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dcdcdc] dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-6">
            <div>
              <span className="text-xs font-semibold text-[#000000] uppercase tracking-wider block">
                STOREFRONT & KNOWLEDGE SYNC
              </span>
              <h3 className="text-xl font-medium text-[#1f1f1f] dark:text-white mt-1">
                Connect Store Catalog & Domain Pages
              </h3>
              <p className="text-xs text-[#636363] dark:text-gray-400 mt-1">
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
                    ? 'bg-white dark:bg-gray-900 text-[#000000] font-semibold shadow-xs'
                    : 'text-[#636363] dark:text-gray-400'
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
                    ? 'bg-white dark:bg-gray-900 text-[#000000] font-semibold shadow-xs'
                    : 'text-[#636363] dark:text-gray-400'
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
                  <Store className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    value={selectedStoreTiwiId}
                    onChange={(e) => setSelectedStoreTiwiId(e.target.value)}
                    className="w-full pl-10 pr-8 py-2.5 rounded-full border border-[#dcdcdc] dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#000000]"
                  >
                    {availableStores.map(st => (
                      <option key={st.tiwiId} value={st.tiwiId}>
                        {st.storeName} ({st.tiwiId})
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-[#636363]">
                  Tiwi 2.0 will automatically sync products, stock levels, and pricing from this store.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-[#1f1f1f] dark:text-white">
                  Storefront Domain / Website URL
                </label>
                <div className="relative max-w-xl">
                  <Globe className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="url"
                    value={customDomainUrl}
                    onChange={(e) => setCustomDomainUrl(e.target.value)}
                    placeholder="https://yourstore.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-full border border-[#dcdcdc] dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#000000]"
                  />
                </div>
                <p className="text-[11px] text-[#636363]">
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
                  <p className="text-[11px] text-[#636363]">
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
                  className="w-full sm:w-1/3 px-3.5 py-2 rounded-xl border border-[#dcdcdc] dark:border-gray-800 text-xs bg-white dark:bg-gray-800 text-[#1f1f1f] dark:text-white focus:outline-hidden"
                />
                <input
                  type="url"
                  value={newPageUrl}
                  onChange={(e) => setNewPageUrl(e.target.value)}
                  placeholder="https://yourstore.com/returns"
                  className="w-full sm:w-2/3 px-3.5 py-2 rounded-xl border border-[#dcdcdc] dark:border-gray-800 text-xs bg-white dark:bg-gray-800 text-[#1f1f1f] dark:text-white focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleAddExtraPage}
                  className="px-4 py-2 rounded-xl bg-[#f1f3f4] hover:bg-[#eaeaea] text-[#000000] text-xs font-semibold transition cursor-pointer flex items-center gap-1 shrink-0"
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
                      className="px-3 py-1.5 rounded-full bg-[#f8f9fa] dark:bg-gray-800 border border-[#dcdcdc] dark:border-gray-700 text-xs flex items-center gap-2"
                    >
                      <Link className="w-3 h-3 text-[#000000]" />
                      <span className="font-medium text-[#1f1f1f] dark:text-white">{page.title}:</span>
                      <span className="text-[#636363] font-mono text-[11px] truncate max-w-xs">{page.url}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExtraPage(page.id)}
                        className="text-neutral-400 hover:text-red-600 transition cursor-pointer ml-1"
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
                  <FileText className="w-3.5 h-3.5 text-[#000000]" />
                  <span>Custom Store Knowledge & Delivery Policies</span>
                </label>
                <textarea
                  rows={3}
                  value={customKnowledgeNotes}
                  onChange={(e) => setCustomKnowledgeNotes(e.target.value)}
                  placeholder="e.g. Delivery: Dhaka 60 BDT (24 hrs), Outside Dhaka 120 BDT (48 hrs). Return within 7 days with intact tags. Payment: bKash, Nagad, Cash on Delivery."
                  className="w-full p-3.5 rounded-xl border border-[#dcdcdc] dark:border-gray-800 bg-white dark:bg-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#000000]"
                />
              </div>

              {/* Connect & Sync Storefront Button */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSyncStore}
                  disabled={syncingStore}
                  className="px-6 py-2.5 rounded-full bg-[#f1f3f4] dark:bg-gray-800 hover:bg-[#eaeaea] text-[#000000] text-xs font-semibold transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
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
                <div className="p-4 rounded-2xl bg-[#f8f9fa] dark:bg-gray-800/40 border border-[#dcdcdc]/60 space-y-2">
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
                        className="px-2.5 py-1 rounded-full bg-white dark:bg-gray-800 border border-[#dcdcdc] text-[11px] text-[#444746] dark:text-gray-300"
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
                    className="rounded border-[#dcdcdc] text-[#000000] focus:ring-[#000000]"
                  />
                  <span>Smart Bilingual Support (Bengali + English)</span>
                </label>
              </div>

              <button
                onClick={handleSaveAutomation}
                disabled={savingAutomation}
                className="px-7 py-2.5 rounded-full bg-[#000000] hover:bg-[#3c3c3c] text-white text-xs font-semibold transition shadow-xs cursor-pointer flex items-center gap-2 self-end sm:self-auto disabled:opacity-50"
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
        <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dcdcdc] dark:border-gray-800 p-6 sm:p-8 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-5 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#dcdcdc] dark:border-gray-800">
            <div>
              <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#000000]" />
                <span>Interactive Tiwi 2.0 Test Simulator</span>
              </h3>
              <p className="text-xs text-[#636363] dark:text-gray-400">
                Test how Tiwi 2.0 responds to real buyer questions for <strong>{currentSession?.sessionName}</strong> before replying on live WhatsApp.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[#636363]">
                Persona: <strong className="text-[#000000] capitalize">{automationForm.preset}</strong>
              </span>
              <span className="text-[10px] font-semibold bg-[#e6f4ea] text-[#137333] px-2.5 py-0.5 rounded-full border border-[#ceead6]">
                Live Sandbox
              </span>
            </div>
          </div>

          {/* Quick Question Chips */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#636363] font-medium">Quick Test:</span>
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
                className="px-3 py-1 rounded-full bg-[#f1f3f4] dark:bg-gray-800 hover:bg-[#eaeaea] text-[11px] text-[#1f1f1f] dark:text-white transition cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>

          <div className="max-w-2xl mx-auto rounded-[20px] bg-[#efeae2] dark:bg-gray-950 border border-[#dcdcdc] overflow-hidden">
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
                        ? 'bg-[#d9fdd3] text-[#191919] rounded-tr-none'
                        : 'bg-white dark:bg-gray-800 text-[#191919] dark:text-gray-100 rounded-tl-none whitespace-pre-wrap'
                    }`}
                  >
                    <p>{msg.text}</p>
                    <span className="text-[9px] text-[#747474] block text-right mt-1">
                      {msg.time}
                    </span>
                  </div>
                </div>
              ))}
              {simLoading && (
                <div className="flex justify-start">
                  <div className="p-3 bg-white dark:bg-gray-800 rounded-2xl rounded-tl-none text-xs text-[#636363] flex items-center gap-2 shadow-xs">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#25D366]" />
                    <span>Tiwi 2.0 thinking & composing response...</span>
                  </div>
                </div>
              )}
            </div>

            <form onSubmit={handleSimSend} className="p-3 bg-white dark:bg-gray-900 border-t border-[#dcdcdc] flex items-center gap-2">
              <input
                type="text"
                value={simMessage}
                onChange={(e) => setSimMessage(e.target.value)}
                placeholder="Type customer message (e.g. 'দাম কত?', 'What products are available?')..."
                className="flex-1 px-4 py-2.5 rounded-full border border-[#dcdcdc] dark:border-gray-800 text-xs text-[#1f1f1f] dark:text-white focus:outline-hidden focus:border-[#25D366]"
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
          <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dcdcdc] dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#efefef] text-[#000000] flex items-center justify-center">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-white">
                    Real-Time Automation Telemetry
                  </h3>
                  <p className="text-xs text-[#636363] dark:text-gray-400">
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
                        ? 'bg-white dark:bg-gray-900 text-[#000000] font-semibold shadow-xs'
                        : 'text-[#636363] dark:text-gray-400'
                    }`}
                  >
                    Volume
                  </button>
                  <button
                    onClick={() => setChartMetric('latency')}
                    className={`px-3 py-1 rounded-full transition cursor-pointer ${
                      chartMetric === 'latency'
                        ? 'bg-white dark:bg-gray-900 text-[#000000] font-semibold shadow-xs'
                        : 'text-[#636363] dark:text-gray-400'
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
                    <stop offset="0%" stopColor="#000000" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {[0, 35, 70, 105].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="700"
                    y2={y}
                    stroke="#e2e2e2"
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
                  stroke="#000000"
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
                        fill="#000000"
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
          <div className="rounded-[24px] bg-white dark:bg-gray-900 border border-[#dcdcdc] dark:border-gray-800 p-6 shadow-[0_1px_3px_rgba(60,64,67,0.06)] space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#dcdcdc] dark:border-gray-800">
              <div>
                <h3 className="text-base font-semibold text-[#1f1f1f] dark:text-white">
                  Live Message Stream ({currentSession?.sessionName || 'Selected Session'})
                </h3>
                <p className="text-xs text-[#636363] dark:text-gray-400">
                  Real-time transcript of customer messages and Tiwi 2.0 auto-replies.
                </p>
              </div>

              <button
                onClick={() => fetchSessions(true)}
                className="px-3 py-1.5 rounded-full border border-[#dcdcdc] text-xs font-medium text-[#636363] hover:bg-[#f8f9fa] transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Logs</span>
              </button>
            </div>

            {(!currentSession?.messageLogs || currentSession.messageLogs.length === 0) ? (
              <div className="text-center py-12 text-[#636363] text-xs">
                No incoming messages recorded yet for this session. Test via the simulator or send a message to the linked WhatsApp number.
              </div>
            ) : (
              <div className="space-y-3">
                {currentSession.messageLogs.slice(-20).reverse().map((log, idx) => (
                  <div
                    key={log.id || idx}
                    className={`p-3.5 rounded-2xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                      log.direction === 'inbound'
                        ? 'bg-[#f8f9fa] dark:bg-gray-800/40 border-[#dcdcdc]/80'
                        : 'bg-[#efefef]/30 dark:bg-neutral-950/20 border-[#e1e1e1]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                        log.direction === 'inbound'
                          ? 'bg-neutral-200 text-neutral-700'
                          : 'bg-[#e6f4ea] text-[#137333]'
                      }`}>
                        {log.direction === 'inbound' ? 'Inbound Customer' : 'Tiwi 2.0 Reply'}
                      </span>
                      <div className="space-y-0.5">
                        <span className="font-mono text-[11px] text-[#636363] block">
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

      {/* ======================================================== */}
      {/* WHATSAPP SUBSCRIPTION PACKAGES MODAL (TIWLO CREDITS) */}
      {/* ======================================================== */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white dark:bg-gray-900 dark:border-gray-800 p-6 shadow-xl space-y-5">
            <div className="flex items-start justify-between gap-4 border-b border-neutral-100 dark:border-gray-800 pb-4">
              <div>
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-white">
                  WhatsApp Messaging &amp; AI Bot Packages
                </h2>
                <p className="text-xs text-neutral-500 dark:text-gray-400">
                  Paid monthly subscriptions using verified Tiwlo Credits. Free activation is not available.
                </p>
              </div>
              <div className="flex items-center gap-3">
                {creditsBalance !== null && (
                  <span className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 dark:border-gray-700 bg-neutral-50 dark:bg-gray-800 px-3 py-1.5 text-xs font-semibold">
                    <Wallet className="w-3.5 h-3.5 text-[#1ED760]" />
                    Credits: ${creditsBalance.toFixed(2)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowPlanModal(false)}
                  className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-gray-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 dark:border-gray-800 bg-neutral-50 dark:bg-gray-950 px-4 py-3 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-[#1ED760]" />
                <div>
                  <p className="text-xs font-semibold text-neutral-900 dark:text-white">Auto-Renew Monthly with Tiwlo Credits</p>
                  <p className="text-[11px] text-neutral-500">Automatically renew every 30 days using your wallet balance.</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={modalAutoRenew}
                onChange={(e) => setModalAutoRenew(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 accent-[#1ED760] cursor-pointer"
              />
            </label>

            {subError && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{subError}</span>
                </div>
                <button
                  type="button"
                  onClick={() => navigateToBilling('/billing/credits', 'credits')}
                  className="font-semibold underline cursor-pointer"
                >
                  Top Up Credits →
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {waPackages.map((pkg) => {
                const isCurrent = waSubscription?.isActive && waSubscription?.planId === pkg.planId;
                const isRecommended = waTierInsight?.recommendedPlanId === pkg.planId || pkg.recommended;
                const badgeText = pkg.badge || (isRecommended ? 'Recommended' : null);
                return (
                  <div
                    key={pkg.planId}
                    className={`flex flex-col justify-between rounded-xl border p-5 transition ${
                      isCurrent
                        ? 'border-[#1ED760] bg-[#1ED760]/5 ring-1 ring-[#1ED760]/40'
                        : 'border-neutral-200 dark:border-gray-800 bg-white dark:bg-gray-950'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="text-base font-semibold text-neutral-950 dark:text-white">{pkg.planName}</h3>
                          <p className="mt-0.5 text-xs text-neutral-500">{pkg.description}</p>
                        </div>
                        {badgeText && (
                          <span className="shrink-0 rounded-full bg-[#1ED760]/15 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                            {badgeText}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1 border-b border-neutral-100 dark:border-gray-800 pb-3">
                        <span className="text-2xl font-bold tabular-nums text-neutral-950 dark:text-white">
                          ${Number(pkg.price || 0).toFixed(2)}
                        </span>
                        <span className="text-xs text-neutral-500">/ month (Credits)</span>
                      </div>

                      <div className="space-y-1.5 text-xs text-neutral-700 dark:text-gray-300">
                        <div className="flex justify-between">
                          <span className="text-neutral-500">WhatsApp Sessions</span>
                          <span className="font-semibold">{pkg.maxSessions}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Monthly Messages</span>
                          <span className="font-semibold tabular-nums">{Number(pkg.monthlyMessagesLimit || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Daily Broadcasts</span>
                          <span className="font-semibold tabular-nums">{Number(pkg.dailyBroadcastLimit || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Auto-Reply Flows</span>
                          <span className="font-semibold">{pkg.autoReplyFlowsLimit}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-neutral-500">Custom Webhooks</span>
                          <span className="font-semibold">{pkg.webhookEnabled ? 'Included' : 'Pro+'}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={purchasingPlanId !== null || isCurrent}
                      onClick={() => handlePurchasePlan(pkg.planId)}
                      className={`mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold transition ${
                        isCurrent
                          ? 'border border-[#1ED760] bg-[#1ED760]/15 text-emerald-800 cursor-default'
                          : 'bg-[#1ED760] text-black hover:bg-[#19c354] cursor-pointer'
                      } disabled:opacity-60`}
                    >
                      {purchasingPlanId === pkg.planId ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Charging Credits...
                        </>
                      ) : isCurrent ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Current Active Plan
                        </>
                      ) : (
                        <>
                          <CreditCard className="w-3.5 h-3.5" />
                          Pay ${Number(pkg.price || 0).toFixed(2)} Credits
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
