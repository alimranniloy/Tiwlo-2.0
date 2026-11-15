import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowLeft,
  Bug,
  Cloud,
  CreditCard,
  FileText,
  Flame,
  HelpCircle,
  KeyRound,
  Lightbulb,
  Loader2,
  Lock,
  MonitorSmartphone,
  Send,
  ShieldCheck,
  Sparkles,
  Store,
  UploadCloud,
  X,
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'tiwlo.support.ticketDraft';

const TOPIC_CARDS = [
  { id: 'Payment & Billing', label: 'Payment & Billing', desc: 'Invoices, plans & charges', icon: CreditCard },
  { id: 'Store & Domains', label: 'Store & Domains', desc: 'Storefront, DNS & SSL', icon: Store },
  { id: 'Cloud & Droplets', label: 'Cloud & Droplets', desc: 'Servers, SSH & uptime', icon: Cloud },
  { id: 'POS & Hardware', label: 'POS & Hardware', desc: 'Scanners, printers & sync', icon: MonitorSmartphone },
  { id: 'Login & Security', label: 'Login & Security', desc: '2FA, passwords & access', icon: KeyRound },
  { id: 'Bug Report', label: 'Bug Report', desc: 'Unexpected errors or crashes', icon: Bug },
  { id: 'Feature Request', label: 'Feature Request', desc: 'Suggest product improvements', icon: Lightbulb },
  { id: 'General Inquiry', label: 'General Inquiry', desc: 'Questions & onboarding', icon: HelpCircle },
];

const PRIORITIES = [
  { id: 'Low', label: 'Low', hint: 'General guidance' },
  { id: 'Medium', label: 'Medium', hint: 'Standard issue' },
  { id: 'High', label: 'High', hint: 'Degraded workflow' },
  { id: 'Urgent', label: 'Urgent', hint: 'Production outage' },
];

const LOCAL_FAQ_HINTS = [
  { keyword: 'domain', title: 'Custom domains & SSL provisioning', tip: 'Verify your TXT record and point your A/AAAA record or Tiwlo nameservers before provisioning SSL.' },
  { keyword: 'ssl', title: 'Automated SSL certificates', tip: 'Ensure DNS propagation is complete; SSL activates automatically once DNS points to Tiwlo.' },
  { keyword: 'droplet', title: 'Rebooting or sizing a Cloud Droplet', tip: 'Open Cloud Dashboard -> Droplets Actions menu to power-cycle or resize compute tiers.' },
  { keyword: 'pos', title: 'Connecting USB or Bluetooth barcode scanners', tip: 'HID scanners work plug-and-play inside Tiwlo POS with no extra drivers.' },
  { keyword: 'login', title: 'Recovering account or 2FA access', tip: 'Use backup codes or submit a security verification ticket with your registered email.' },
];

function loadSavedDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function CreateTicketView({
  currentUser,
  guestSession: externalGuestSession = null,
  supportConfig: externalConfig = null,
  channel = 'Web',
  onBack,
  onTicketCreated,
  onSelectTicket,
  onGuestSessionVerified,
  showToast,
}) {
  const initialDraft = loadSavedDraft();

  const [subject, setSubject] = useState(initialDraft?.subject || '');
  const [category, setCategory] = useState(initialDraft?.category || 'General Inquiry');
  const [priority, setPriority] = useState(initialDraft?.priority || 'Medium');
  const [selectedStoreId, setSelectedStoreId] = useState(initialDraft?.selectedStoreId || '');
  const [referenceId, setReferenceId] = useState(initialDraft?.referenceId || '');
  const [description, setDescription] = useState(initialDraft?.description || '');
  const [expectedOutcome, setExpectedOutcome] = useState(initialDraft?.expectedOutcome || '');
  const [attachments, setAttachments] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Guest session & verification gate
  const [guestSession, setGuestSession] = useState(externalGuestSession);
  const [checkingGuest, setCheckingGuest] = useState(!currentUser && !externalGuestSession);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestError, setGuestError] = useState('');
  const [verifyingGuest, setVerifyingGuest] = useState(false);

  // Config toggles
  const [supportConfig, setSupportConfig] = useState(
    externalConfig || { allowNewTicketCreation: true, allowAttachments: true }
  );

  // Live duplicate detector
  const [similarTickets, setSimilarTickets] = useState([]);
  const [similarFaqs, setSimilarFaqs] = useState([]);
  const [checkingSimilar, setCheckingSimilar] = useState(false);

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

  // Fetch config and guest session
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
          if (sess && (sess.email || sess.verified)) {
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

  // Autosave draft
  useEffect(() => {
    try {
      const hasContent =
        subject.trim() || description.trim() || expectedOutcome.trim() || referenceId.trim();
      if (hasContent) {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            subject,
            category,
            priority,
            selectedStoreId,
            referenceId,
            description,
            expectedOutcome,
          })
        );
      }
    } catch {}
  }, [subject, category, priority, selectedStoreId, referenceId, description, expectedOutcome]);

  // Live Duplicate Detector on subject change
  useEffect(() => {
    const q = subject.trim();
    if (q.length < 3) {
      setSimilarTickets([]);
      setSimilarFaqs([]);
      return undefined;
    }

    const lower = q.toLowerCase();
    const localHints = LOCAL_FAQ_HINTS.filter(
      (h) => lower.includes(h.keyword) || h.title.toLowerCase().includes(lower)
    );

    const timer = setTimeout(async () => {
      setCheckingSimilar(true);
      try {
        const res = await fetch(`/api/support/tickets/similar?q=${encodeURIComponent(q)}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setSimilarTickets(Array.isArray(data?.tickets) ? data.tickets.slice(0, 3) : []);
          const apiFaqs = Array.isArray(data?.faqs)
            ? data.faqs
            : Array.isArray(data?.articles)
            ? data.articles
            : Array.isArray(data?.suggestions)
            ? data.suggestions
            : [];
          setSimilarFaqs(apiFaqs.length > 0 ? apiFaqs.slice(0, 3) : localHints);
        } else {
          setSimilarTickets([]);
          setSimilarFaqs(localHints);
        }
      } catch {
        setSimilarTickets([]);
        setSimilarFaqs(localHints);
      } finally {
        setCheckingSimilar(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [subject]);

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
      setGuestError('Please enter a valid phone number (at least 7 digits).');
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
      if (!res.ok) {
        throw new Error(data?.error || 'Could not verify guest contact details.');
      }
      const verified = data?.guestSession || data?.session || { name, fullName: name, email, phone, verified: true };
      setGuestSession(verified);
      onGuestSessionVerified?.(verified);
      showToast?.('Guest contact verified');
    } catch (err) {
      setGuestError(err.message || 'Verification failed. Please try again.');
    } finally {
      setVerifyingGuest(false);
    }
  };

  const allowNewTicket = supportConfig?.allowNewTicketCreation !== false;
  const allowAttachments = supportConfig?.allowAttachments !== false;

  const handleFileSelect = async (e) => {
    if (!allowAttachments) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const remainingSlots = Math.max(0, 10 - attachments.length);
    if (remainingSlots <= 0) {
      setSubmitError('Maximum 10 attachments allowed per ticket.');
      if (e.target) e.target.value = '';
      return;
    }

    const batch = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setSubmitError(`Only ${remainingSlots} more file(s) can be added (max 10 files).`);
    } else {
      setSubmitError('');
    }

    const oversized = batch.filter((f) => f.size > 10 * 1024 * 1024);
    const validFiles = batch.filter((f) => f.size <= 10 * 1024 * 1024);
    if (oversized.length > 0) {
      setSubmitError(`"${oversized[0].name}" exceeds the 10 MB size limit.`);
    }
    if (validFiles.length === 0) {
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
      if (!res.ok) {
        throw new Error(data?.error || 'Could not upload attachments.');
      }
      const returned = Array.isArray(data?.attachments)
        ? data.attachments
        : data?.attachment
          ? [data.attachment]
          : [];
      const uploaded = returned.map((att, idx) => {
        const srcFile = validFiles[idx];
        return {
          id: att.id || `att_${Date.now()}_${idx}`,
          name: att.filename || att.name || srcFile?.name || 'Attachment',
          url: att.url || '',
          mimeType: att.contentType || att.mimeType || srcFile?.type || 'application/octet-stream',
          size: `${Math.max(1, Math.round((att.size || srcFile?.size || 0) / 1024))} KB`,
        };
      });
      if (uploaded.length) {
        setAttachments((prev) => [...prev, ...uploaded].slice(0, 10));
      }
    } catch (err) {
      setSubmitError(err.message || 'Could not upload attachment.');
    } finally {
      setUploadingFile(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleClearDraft = () => {
    setSubject('');
    setCategory('General Inquiry');
    setPriority('Medium');
    setSelectedStoreId('');
    setReferenceId('');
    setDescription('');
    setExpectedOutcome('');
    setAttachments([]);
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {}
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allowNewTicket) return;
    setSubmitError('');

    if (!subject.trim()) {
      setSubmitError('Please enter a short subject for your ticket.');
      return;
    }
    if (!description.trim()) {
      setSubmitError('Please describe the issue in detail.');
      return;
    }

    const userStores = Array.isArray(currentUser?.stores) ? currentUser.stores : [];
    const chosenStore = userStores.find((s) => (s.id || s.tiwiId) === selectedStoreId);

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority: priority.toUpperCase(),
          description: description.trim(),
          expectedOutcome: expectedOutcome.trim() || undefined,
          referenceId: referenceId.trim() || undefined,
          storeId: chosenStore?.id || chosenStore?.tiwiId || undefined,
          storeName: chosenStore?.storeName || chosenStore?.name || currentUser?.storeName || undefined,
          attachments,
          channel,
          userId: currentUser?.id || currentUser?.tiwiId || undefined,
          userName: currentUser?.name || currentUser?.storeName || guestSession?.name || guestSession?.fullName || 'Customer',
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ticket) {
        throw new Error(data?.error || 'Could not create ticket. Please try again.');
      }

      const recoveryCode =
        data.guestRecoveryCode || data.recoveryCode || data.ticket?.guestRecoveryCode || '';
      const createdId = data.ticket.ticketId || data.ticket.id;
      if (recoveryCode && createdId) {
        try {
          sessionStorage.setItem(`tiwlo.support.recovery.${createdId}`, recoveryCode);
        } catch {}
      }

      handleClearDraft();
      onTicketCreated?.(data.ticket, recoveryCode);
    } catch (err) {
      setSubmitError(err.message || 'Error creating ticket. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stores = Array.isArray(currentUser?.stores) ? currentUser.stores : [];
  const isGuestLocked = !currentUser && !guestSession;

  return (
    <div className="w-full space-y-6 pb-12">
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
              Create Support Ticket
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Submit a structured request directly to our specialist team
            </p>
          </div>
        </div>

        {(subject || description || expectedOutcome || referenceId) && (
          <button
            type="button"
            onClick={handleClearDraft}
            className="self-start sm:self-auto rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
          >
            Clear saved draft
          </button>
        )}
      </div>

      {/* System Toggle Notice */}
      {!allowNewTicket && (
        <div className="flex items-center gap-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-4 text-sm text-neutral-700 dark:text-neutral-300">
          <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
          <span>New ticket creation is temporarily paused by support administration. Please check back shortly or use the Knowledge Base.</span>
        </div>
      )}

      {/* Guest Verification Gate OR Active Guest Pill */}
      {!currentUser && (
        checkingGuest ? (
          <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-4 text-xs text-neutral-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking guest verification session...
          </div>
        ) : guestSession ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
              <span className="h-2 w-2 rounded-full bg-[#1ED760]" />
              <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
              <span>
                Guest Session Active (<span className="font-medium">{guestSession.email}</span>
                {guestSession.phone ? ` · ${guestSession.phone}` : ''})
              </span>
            </div>
            <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
              Verified contact
            </span>
          </div>
        ) : (
          <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1ED760]/15 text-emerald-700 dark:text-[#1ED760]">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
                  Verify Your Contact Details
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Please confirm your name, email, and phone number so we can send ticket updates and your Guest Recovery Code.
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyGuest} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Alex Rivera"
                  className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  placeholder="alex@company.com"
                  className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  placeholder="+1 555 234 5678"
                  className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
                />
              </div>

              {guestError && (
                <p role="alert" className="sm:col-span-3 text-xs font-medium text-red-600 dark:text-red-400">
                  {guestError}
                </p>
              )}

              <div className="sm:col-span-3 flex justify-end">
                <button
                  type="submit"
                  disabled={verifyingGuest}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-5 py-2.5 text-xs sm:text-sm font-semibold text-neutral-950 transition disabled:opacity-50 cursor-pointer"
                >
                  {verifyingGuest ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {verifyingGuest ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </div>
            </form>
          </section>
        )
      )}

      {/* Structured Ticket Form */}
      {!isGuestLocked && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-7 shadow-xs space-y-6"
        >
          {/* Topic / Category Cards */}
          <div className="space-y-2.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
              1. Select Topic
            </label>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {TOPIC_CARDS.map(({ id, label, desc, icon: Icon }) => {
                const selected = category === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={!allowNewTicket}
                    onClick={() => setCategory(id)}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 text-left transition cursor-pointer disabled:opacity-60 ${
                      selected
                        ? 'border-[#1ED760] bg-[#1ED760]/10 ring-1 ring-[#1ED760]/40'
                        : 'border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 hover:border-neutral-300 dark:hover:border-neutral-700'
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        selected
                          ? 'bg-[#1ED760] text-neutral-950'
                          : 'bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{label}</p>
                      <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-1">{desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject + Live Duplicate Detector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="ticket-subject" className="font-semibold text-neutral-800 dark:text-neutral-200">
                2. Subject <span className="text-red-500">*</span>
              </label>
              <span className="font-mono text-[11px] text-neutral-400">{subject.length}/120</span>
            </div>
            <input
              id="ticket-subject"
              type="text"
              maxLength={120}
              required
              disabled={!allowNewTicket}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Briefly summarize what you need help with..."
              className="h-11 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none disabled:opacity-60"
            />

            {/* Similar Tickets & FAQ Detector */}
            {(checkingSimilar || similarTickets.length > 0 || similarFaqs.length > 0) && (
              <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-medium text-neutral-700 dark:text-neutral-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#1ED760]" />
                    Related tickets &amp; quick solutions
                  </span>
                  {checkingSimilar && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-400" />}
                </div>

                {similarTickets.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Existing tickets:</p>
                    {similarTickets.map((t) => {
                      const sId = t.serialNumber || `#${t.ticketId || t.id}`;
                      return (
                        <button
                          key={t.id || t.ticketId}
                          type="button"
                          onClick={() => onSelectTicket?.(t)}
                          className="flex w-full items-center justify-between rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-left text-xs hover:border-[#1ED760] transition cursor-pointer"
                        >
                          <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
                            <span className="font-mono text-neutral-500 mr-2">{sId}</span>
                            {t.subject}
                          </span>
                          <span className="ml-2 shrink-0 text-[11px] font-semibold text-[#16a34a] dark:text-[#1ED760]">
                            View
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {similarFaqs.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">Helpful tips:</p>
                    {similarFaqs.map((faq, idx) => (
                      <div
                        key={faq.id || idx}
                        className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3 py-2 text-xs"
                      >
                        <p className="font-semibold text-neutral-900 dark:text-neutral-100">{faq.title}</p>
                        <p className="text-neutral-500 dark:text-neutral-400 mt-0.5">{faq.tip || faq.snippet}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Priority + Store Selector + Reference ID */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="space-y-2 lg:col-span-6">
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                3. Priority
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PRIORITIES.map((p) => {
                  const active = priority === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!allowNewTicket}
                      onClick={() => setPriority(p.id)}
                      className={`rounded-lg border px-3 py-2 text-left transition cursor-pointer disabled:opacity-60 ${
                        active
                          ? 'border-[#1ED760] bg-[#1ED760]/10 text-neutral-950 dark:text-white'
                          : 'border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        {p.id === 'Urgent' && <Flame className="h-3.5 w-3.5 text-red-500" />}
                        <span>{p.label}</span>
                      </div>
                      <p className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5">{p.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {stores.length > 0 && (
              <div className="space-y-2 lg:col-span-3">
                <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                  Related Store
                </label>
                <select
                  value={selectedStoreId}
                  disabled={!allowNewTicket}
                  onChange={(e) => setSelectedStoreId(e.target.value)}
                  className="h-11 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                >
                  <option value="">All / Account-wide</option>
                  {stores.map((s) => (
                    <option key={s.id || s.tiwiId} value={s.id || s.tiwiId}>
                      {s.storeName || s.name || s.tiwiId}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className={`space-y-2 ${stores.length > 0 ? 'lg:col-span-3' : 'lg:col-span-6'}`}>
              <label htmlFor="ticket-ref" className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Reference ID (optional)
              </label>
              <input
                id="ticket-ref"
                type="text"
                disabled={!allowNewTicket}
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="Order #, Store TIW-..., or Droplet ID"
                className="h-11 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
              />
            </div>
          </div>

          {/* Description & Expected Outcome */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="ticket-desc" className="font-semibold text-neutral-800 dark:text-neutral-200">
                  4. Issue Description <span className="text-red-500">*</span>
                </label>
                <span className="font-mono text-[11px] text-neutral-400">{description.length}/2000</span>
              </div>
              <textarea
                id="ticket-desc"
                rows={5}
                maxLength={2000}
                required
                disabled={!allowNewTicket}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened, error messages, and when it started..."
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="ticket-expected" className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Expected Outcome / Steps to Reproduce (optional)
              </label>
              <textarea
                id="ticket-expected"
                rows={5}
                maxLength={1000}
                disabled={!allowNewTicket}
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                placeholder="1. Steps to reproduce&#10;2. What you expected to happen"
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
              />
            </div>
          </div>

          {/* Real Attachment Upload */}
          {allowAttachments && (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                Attachments (optional)
              </label>
              <div
                onClick={() => allowNewTicket && fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-[#fafafa] dark:bg-neutral-900 p-5 text-center transition hover:border-[#1ED760] cursor-pointer"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  disabled={!allowNewTicket}
                  onChange={handleFileSelect}
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.txt,.log,.zip"
                  className="hidden"
                />
                {uploadingFile ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[#1ED760]" />
                ) : (
                  <UploadCloud className="h-6 w-6 text-neutral-500 dark:text-neutral-400" />
                )}
                <p className="text-xs text-neutral-700 dark:text-neutral-300">
                  <span className="font-semibold">Click to upload screenshots or logs</span> (Up to 10 files · JPG, PNG, PDF, TXT, ZIP up to 10MB each)
                </p>
              </div>

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {attachments.map((file, idx) => (
                    <div
                      key={file.id || idx}
                      className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-1.5 text-xs"
                    >
                      {file.mimeType?.startsWith('image/') && file.url ? (
                        <img src={file.url} alt={file.name} className="h-6 w-6 rounded object-cover" />
                      ) : (
                        <FileText className="h-4 w-4 text-neutral-500" />
                      )}
                      <span className="max-w-[160px] truncate font-medium text-neutral-800 dark:text-neutral-200">
                        {file.name}
                      </span>
                      <span className="text-[10px] text-neutral-400">{file.size}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-neutral-400 hover:text-red-500 cursor-pointer"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {submitError && (
            <p role="alert" className="text-xs sm:text-sm font-medium text-red-600 dark:text-red-400">
              {submitError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-neutral-200/80 dark:border-neutral-800 pt-5">
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Draft autosaved locally · Average first response under 2 hours
            </p>
            <button
              type="submit"
              disabled={!allowNewTicket || isSubmitting || uploadingFile}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-6 py-2.5 text-sm font-semibold text-neutral-950 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isSubmitting ? 'Submitting Ticket...' : 'Submit Ticket'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
