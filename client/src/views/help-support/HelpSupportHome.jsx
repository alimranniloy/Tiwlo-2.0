import { applicationFetch as fetch } from '../../api/graphqlTransport.js';
import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Compass,
  KeyRound,
  LifeBuoy,
  Loader2,
  Lock,
  MessageSquare,
  PlusCircle,
  Search,
  ShieldCheck,
  Ticket,
} from 'lucide-react';

export default function HelpSupportHome({
  onNavigate,
  onSelectTicket,
  currentUser,
  guestSession: externalGuestSession = null,
  supportConfig: externalConfig = null,
  onGuestSessionVerified,
  lookupOnly = false,
  showToast,
}) {
  const [guestSession, setGuestSession] = useState(externalGuestSession);
  const [supportConfig, setSupportConfig] = useState(
    externalConfig || { allowNewTicketCreation: true, liveChatWidgetEnabled: true }
  );

  // Guest Verification inline drawer/card on home if needed
  const [showGuestGate, setShowGuestGate] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestError, setGuestError] = useState('');
  const [verifyingGuest, setVerifyingGuest] = useState(false);

  // Quick ticket search (authenticated / active session)
  const [quickQuery, setQuickQuery] = useState('');
  const [quickResults, setQuickResults] = useState([]);
  const [searchingQuick, setSearchingQuick] = useState(false);
  const [quickSearched, setQuickSearched] = useState(false);

  // Guest Ticket Lookup by ID + Email + Recovery Code or Phone
  const [lookupTicketId, setLookupTicketId] = useState('');
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupSecret, setLookupSecret] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    if (externalGuestSession) setGuestSession(externalGuestSession);
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
      fetch('/api/support/guest/session', { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const sess = data?.guestSession || data?.session || (data?.verified ? data : null);
          if (sess && (sess.email || sess.verified)) {
            setGuestSession(sess);
            onGuestSessionVerified?.(sess);
          }
        })
        .catch(() => {});
    }
  }, [currentUser, externalConfig, externalGuestSession, onGuestSessionVerified]);

  const allowNewTicket = supportConfig?.allowNewTicketCreation !== false;

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
      setShowGuestGate(false);
      onGuestSessionVerified?.(sess);
      showToast?.('Guest session activated');
    } catch (err) {
      setGuestError(err.message || 'Verification failed.');
    } finally {
      setVerifyingGuest(false);
    }
  };

  const handleQuickSearch = async (e) => {
    e.preventDefault();
    const q = quickQuery.trim().toLowerCase();
    if (!q) return;
    setSearchingQuick(true);
    setQuickSearched(true);
    try {
      const res = await fetch('/api/support/tickets', { credentials: 'include' });
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.tickets) ? data.tickets : [];
      const qNoHash = q.replace(/^#/, '');
      const matched = list.filter((t) => {
        const serial = String(t.serialNumber || `#${t.ticketId || t.id || ''}`).toLowerCase();
        const subj = String(t.subject || '').toLowerCase();
        const cat = String(t.category || '').toLowerCase();
        return (
          serial.includes(q) ||
          serial.replace(/^#/, '').includes(qNoHash) ||
          subj.includes(q) ||
          cat.includes(q)
        );
      });
      setQuickResults(matched.slice(0, 5));
    } catch {
      setQuickResults([]);
    } finally {
      setSearchingQuick(false);
    }
  };

  const handleGuestLookup = async (e) => {
    e.preventDefault();
    setLookupError('');
    const rawId = lookupTicketId.trim();
    const email = lookupEmail.trim();
    const secret = lookupSecret.trim();

    if (!rawId) {
      setLookupError('Please enter your Ticket ID (e.g. #TWTK-1024).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLookupError('Please enter the email address associated with this ticket.');
      return;
    }
    if (!secret) {
      setLookupError('Please enter your Guest Recovery Code or Phone Number.');
      return;
    }

    const cleanId = rawId.replace(/^#/, '');
    const looksLikePhone = /^[+\d\s()-]{7,}$/.test(secret) && !/[a-z]/i.test(secret);

    setLookupBusy(true);
    try {
      const res = await fetch('/api/support/guest/lookup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: cleanId,
          serialNumber: rawId.startsWith('#') ? rawId : `#${cleanId}`,
          email,
          recoveryCode: looksLikePhone ? undefined : secret,
          phone: looksLikePhone ? secret : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ticket) {
        throw new Error(data?.error || 'No matching ticket found for those details.');
      }
      if (data.guestSession) {
        setGuestSession(data.guestSession);
        onGuestSessionVerified?.(data.guestSession);
      }
      onSelectTicket?.(data.ticket);
    } catch (err) {
      setLookupError(err.message || 'Ticket lookup failed.');
    } finally {
      setLookupBusy(false);
    }
  };

  const quickActions = [
    {
      id: 'create-ticket',
      title: 'Create Ticket',
      description: 'Open a structured support ticket with attachments and priority routing.',
      icon: PlusCircle,
      action: allowNewTicket ? 'Open ticket form' : 'Temporarily paused',
      disabled: !allowNewTicket,
      accent: true,
    },
    {
      id: 'tickets',
      title: 'My Tickets',
      description: 'Track ticket progress, SLA response times, and specialist replies.',
      icon: Ticket,
      action: 'View ticket queue',
    },
    {
      id: 'lookup',
      title: 'Guest Ticket Lookup',
      description: 'Resume any ticket across devices using your ID and Recovery Code.',
      icon: KeyRound,
      action: 'Track by ID',
    },
    {
      id: 'inbox',
      title: 'Live Specialist Chat',
      description: 'Chat with support specialists and convert threads into official tickets.',
      icon: MessageSquare,
      action: 'Open support inbox',
    },
    {
      id: 'help-center',
      title: 'Knowledge Base',
      description: 'Browse searchable troubleshooting articles for stores, cloud, and POS.',
      icon: BookOpen,
      action: 'Browse articles',
    },
    {
      id: 'guides',
      title: 'Step-by-Step Guides',
      description: 'Follow technical walkthroughs for domains, SSL, droplets, and hardware.',
      icon: Compass,
      action: 'Explore guides',
    },
  ];

  const lookupPanel = (
    <section
      id="support-ticket-lookup"
      className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 sm:p-6 shadow-xs space-y-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fafafa] dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 text-neutral-700 dark:text-neutral-200">
          <KeyRound className="h-4 w-4 text-[#1ED760]" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-neutral-950 dark:text-white">
            Track Ticket by ID &amp; Recovery Code
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Resume a guest ticket from any browser or device using your ticket serial, email, and recovery code or phone number.
          </p>
        </div>
      </div>

      <form onSubmit={handleGuestLookup} className="grid grid-cols-1 gap-3 sm:grid-cols-12">
        <div className="sm:col-span-3">
          <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            Ticket ID
          </label>
          <input
            type="text"
            value={lookupTicketId}
            onChange={(e) => setLookupTicketId(e.target.value)}
            placeholder="#TWTK-1042"
            required
            className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 font-mono text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
          />
        </div>
        <div className="sm:col-span-4">
          <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            Email Address
          </label>
          <input
            type="email"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            placeholder="you@company.com"
            required
            className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-[11px] font-medium text-neutral-600 dark:text-neutral-400">
            Recovery Code or Phone
          </label>
          <input
            type="text"
            value={lookupSecret}
            onChange={(e) => setLookupSecret(e.target.value)}
            placeholder="REC-XXXX or +1..."
            required
            className="h-10 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-xs sm:text-sm text-neutral-900 dark:text-neutral-100 focus:bg-white dark:focus:bg-neutral-950 focus:border-[#1ED760] focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2 flex items-end">
          <button
            type="submit"
            disabled={lookupBusy}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 text-xs font-semibold text-neutral-950 transition disabled:opacity-50 cursor-pointer"
          >
            {lookupBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            {lookupBusy ? 'Checking...' : 'Track'}
          </button>
        </div>
      </form>

      {lookupError && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {lookupError}
        </p>
      )}
    </section>
  );

  if (lookupOnly) {
    return (
      <div className="w-full space-y-6 pb-12">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 text-neutral-700 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
            title="Back to Support Home"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-950 dark:text-white">
              Guest Ticket Lookup
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400">
              Access your ticket thread directly with your ID and Recovery Code
            </p>
          </div>
        </div>
        {lookupPanel}
      </div>
    );
  }

  return (
    <div className="w-full space-y-7 pb-12">
      {/* Header + Guest Status Pill */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-600 dark:text-neutral-300">
            <LifeBuoy className="h-3.5 w-3.5 text-[#1ED760]" />
            Tiwlo Support Portal
          </div>
          <h1 className="mt-2.5 text-3xl sm:text-4xl font-bold tracking-tight text-neutral-950 dark:text-white">
            Help &amp; Support
          </h1>
          <p className="mt-1.5 text-sm text-neutral-600 dark:text-neutral-400">
            Manage support tickets, consult specialists, and explore technical guides.
          </p>
        </div>

        {!currentUser && (
          <div className="flex flex-wrap items-center gap-2">
            {guestSession ? (
              <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 py-2 text-xs text-neutral-700 dark:text-neutral-200">
                <span className="h-2 w-2 rounded-full bg-[#1ED760]" />
                <span>
                  Guest Session Active ({guestSession.email}
                  {guestSession.phone ? ` · ${guestSession.phone}` : ''})
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowGuestGate((v) => !v)}
                className="inline-flex items-center gap-2 rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-800 dark:text-neutral-200 transition hover:bg-[#fafafa] dark:hover:bg-neutral-900 cursor-pointer"
              >
                <ShieldCheck className="h-4 w-4 text-[#1ED760]" />
                Verify Guest Contact
              </button>
            )}
          </div>
        )}
      </header>

      {/* Optional Inline Guest Verification Card */}
      {!currentUser && !guestSession && showGuestGate && (
        <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">Verify Guest Contact Details</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Activate a persistent guest session to create tickets or chat with specialists.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGuestGate(false)}
              className="text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 cursor-pointer"
            >
              Close
            </button>
          </div>
          <form onSubmit={handleVerifyGuest} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Full Name"
              required
              className="h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
            />
            <input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="Email Address"
              required
              className="h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
            />
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="Phone Number"
              required
              className="h-10 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-3 text-sm text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
            />
            {guestError && <p className="sm:col-span-3 text-xs text-red-600 dark:text-red-400">{guestError}</p>}
            <div className="sm:col-span-3 flex justify-end">
              <button
                type="submit"
                disabled={verifyingGuest}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1ED760] hover:bg-[#19c355] px-4 py-2 text-xs font-semibold text-neutral-950 disabled:opacity-50 cursor-pointer"
              >
                {verifyingGuest ? 'Verifying...' : 'Activate Guest Session'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* System Notice if New Ticket Creation is Paused */}
      {!allowNewTicket && (
        <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 px-4 py-3 text-xs text-neutral-600 dark:text-neutral-300">
          <Lock className="h-4 w-4 shrink-0 text-neutral-500" />
          <span>New ticket creation is temporarily paused. You can still view existing tickets, browse guides, or look up a ticket below.</span>
        </div>
      )}

      {/* Quick Action Cards */}
      <section aria-label="Support Portal Actions" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {quickActions.map(({ id, title, description, icon: Icon, action, disabled, accent }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => {
              if (id === 'lookup') {
                onNavigate('lookup');
              } else {
                onNavigate(id);
              }
            }}
            className={`group flex flex-col justify-between rounded-xl border p-5 text-left transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
              accent
                ? 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-[#1ED760]'
                : 'border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            <div>
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  accent
                    ? 'bg-[#1ED760] text-neutral-950'
                    : 'border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200'
                }`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-base font-semibold text-neutral-950 dark:text-white">{title}</h2>
              <p className="mt-1 text-xs sm:text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                {description}
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-900 dark:text-neutral-100 group-hover:text-[#16a34a] dark:group-hover:text-[#1ED760] transition">
              {action}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </button>
        ))}
      </section>

      {/* Inline Quick Ticket Search (for active user / guest session) */}
      {(currentUser || guestSession) && (
        <section className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-[#fafafa] dark:bg-neutral-900 p-5 space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-950 dark:text-white">Quick Ticket Search</h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Jump directly to a ticket by serial (#TWTK-...) or subject
              </p>
            </div>
            <form onSubmit={handleQuickSearch} className="flex w-full sm:w-auto sm:min-w-[340px] gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400" />
                <input
                  type="search"
                  value={quickQuery}
                  onChange={(e) => setQuickQuery(e.target.value)}
                  placeholder="#TWTK-... or keyword"
                  className="h-9 w-full rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 pl-8 pr-3 text-xs text-neutral-900 dark:text-neutral-100 focus:border-[#1ED760] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={searchingQuick || !quickQuery.trim()}
                className="h-9 rounded-lg bg-neutral-900 dark:bg-white px-3.5 text-xs font-semibold text-white dark:text-neutral-950 disabled:opacity-50 cursor-pointer"
              >
                {searchingQuick ? 'Searching...' : 'Find'}
              </button>
            </form>
          </div>

          {quickSearched && (
            <div className="space-y-1.5 pt-1">
              {quickResults.length === 0 ? (
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  No tickets matched "{quickQuery}".
                </p>
              ) : (
                quickResults.map((t) => {
                  const sId = t.serialNumber || `#${t.ticketId || t.id}`;
                  return (
                    <button
                      key={t.id || t.ticketId}
                      type="button"
                      onClick={() => onSelectTicket?.(t)}
                      className="flex w-full items-center justify-between rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-950 px-3.5 py-2.5 text-left text-xs hover:border-[#1ED760] transition cursor-pointer"
                    >
                      <span className="truncate font-medium text-neutral-900 dark:text-neutral-100">
                        <span className="font-mono text-neutral-500 mr-2">{sId}</span>
                        {t.subject}
                      </span>
                      <span className="ml-2 shrink-0 font-semibold text-[#16a34a] dark:text-[#1ED760]">
                        Open Ticket
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </section>
      )}

      {/* Track Ticket by ID & Recovery Code Panel */}
      {lookupPanel}
    </div>
  );
}
