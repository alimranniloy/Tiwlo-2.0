import { applicationFetch as fetch } from '../api/graphqlTransport.js';
import React, { useState, useEffect, useCallback } from 'react';
import HelpSupportHome from './help-support/HelpSupportHome';
import TicketsView from './help-support/TicketsView';
import CreateTicketView from './help-support/CreateTicketView';
import TicketDetailView from './help-support/TicketDetailView';
import SupportInboxView from './help-support/SupportInboxView';
import HelpCenterView from './help-support/HelpCenterView';
import GuidesView from './help-support/GuidesView';

function parseSubRouteFromPath(fallback = 'home') {
  try {
    const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
    if (pathname.startsWith('help-support/ticket/')) {
      const id = decodeURIComponent(pathname.replace('help-support/ticket/', '').split('/')[0] || '');
      if (id) return `ticket/${id}`;
    }
    if (pathname.startsWith('support/ticket/')) {
      const id = decodeURIComponent(pathname.replace('support/ticket/', '').split('/')[0] || '');
      if (id) return `ticket/${id}`;
    }
    if (pathname === 'help-support/tickets' || pathname === 'tickets' || pathname === 'support-tickets') return 'tickets';
    if (pathname === 'help-support/create-ticket' || pathname === 'create-ticket') return 'create-ticket';
    if (pathname === 'help-support/lookup' || pathname === 'support/lookup') return 'lookup';
    if (pathname === 'help-support/inbox' || pathname === 'inbox' || pathname === 'support-inbox') return 'inbox';
    if (pathname === 'help-support/help-center' || pathname === 'help-center') return 'help-center';
    if (pathname === 'help-support/guides' || pathname === 'guides') return 'guides';
    if (pathname === 'help-support' || pathname === 'help' || pathname === 'support') return 'home';
  } catch {}
  return fallback || 'home';
}

export default function HelpSupportView({
  currentUser,
  initialSubRoute = 'home',
  showToast,
}) {
  const [currentView, setCurrentView] = useState(() => parseSubRouteFromPath(initialSubRoute));
  const [searchContext, setSearchContext] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState({});
  const [guestSession, setGuestSession] = useState(null);
  const [prevSubRoute, setPrevSubRoute] = useState(initialSubRoute);
  const [supportConfig, setSupportConfig] = useState({
    liveChatWidgetEnabled: true,
    allowNewTicketCreation: true,
    allowAttachments: true,
  });

  if (initialSubRoute && initialSubRoute !== prevSubRoute) {
    setPrevSubRoute(initialSubRoute);
    const parsed = parseSubRouteFromPath(initialSubRoute);
    if (parsed !== currentView) setCurrentView(parsed);
  }

  const activeGuestSession = currentUser ? null : guestSession;

  useEffect(() => {
    fetch('/api/support/config', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setSupportConfig(data.config || data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (currentUser) return;
    fetch('/api/support/guest/session', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const sess = data?.guestSession || data?.session || (data?.verified ? data : null);
        if (sess && (sess.email || sess.verified)) {
          setGuestSession(sess);
        }
      })
      .catch(() => {});
  }, [currentUser]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(parseSubRouteFromPath('home'));
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = useCallback((viewName, extraData = {}) => {
    setCurrentView(viewName);
    if (extraData?.query !== undefined) {
      setSearchContext(extraData.query);
    }
    if (extraData?.ticket) {
      setSelectedTicket(extraData.ticket);
    }

    try {
      const newPath = viewName === 'home' ? '/help-support' : `/help-support/${viewName}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    } catch {}
  }, []);

  const handleSelectTicket = useCallback(
    (ticket) => {
      const rawId = ticket?.ticketId || ticket?.id;
      if (!rawId) return;
      const cleanId = String(rawId).replace(/^#/, '');
      setSelectedTicket(ticket);
      handleNavigate(`ticket/${encodeURIComponent(cleanId)}`, { ticket });
    },
    [handleNavigate]
  );

  const handleTicketCreated = useCallback(
    (newTicket, recoveryCode = '') => {
      const rawId = newTicket?.ticketId || newTicket?.id;
      const cleanId = String(rawId || '').replace(/^#/, '');
      if (recoveryCode && cleanId) {
        setRecoveryCodes((prev) => ({ ...prev, [cleanId]: recoveryCode }));
      }
      setSelectedTicket(newTicket);
      showToast?.(`Ticket #${cleanId} created successfully!`);
      if (cleanId) {
        handleNavigate(`ticket/${encodeURIComponent(cleanId)}`, { ticket: newTicket });
      } else {
        handleNavigate('tickets');
      }
    },
    [handleNavigate, showToast]
  );

  const isTicketDetail = typeof currentView === 'string' && currentView.startsWith('ticket/');
  const activeTicketId = isTicketDetail
    ? decodeURIComponent(currentView.slice('ticket/'.length))
    : '';

  return (
    <div className="tiwi-v3-help w-full">
      {currentView === 'home' && (
        <HelpSupportHome
          onNavigate={handleNavigate}
          onSelectTicket={handleSelectTicket}
          currentUser={currentUser}
          guestSession={activeGuestSession}
          supportConfig={supportConfig}
          onGuestSessionVerified={setGuestSession}
          showToast={showToast}
        />
      )}

      {currentView === 'lookup' && (
        <HelpSupportHome
          onNavigate={handleNavigate}
          onSelectTicket={handleSelectTicket}
          currentUser={currentUser}
          guestSession={activeGuestSession}
          supportConfig={supportConfig}
          onGuestSessionVerified={setGuestSession}
          lookupOnly
          showToast={showToast}
        />
      )}

      {currentView === 'tickets' && (
        <TicketsView
          currentUser={currentUser}
          guestSession={activeGuestSession}
          supportConfig={supportConfig}
          onBack={() => handleNavigate('home')}
          onCreateTicket={() => handleNavigate('create-ticket')}
          onSelectTicket={handleSelectTicket}
          onOpenLookup={() => handleNavigate('lookup')}
        />
      )}

      {currentView === 'create-ticket' && (
        <CreateTicketView
          currentUser={currentUser}
          guestSession={activeGuestSession}
          supportConfig={supportConfig}
          channel="Web"
          onBack={() => handleNavigate('tickets')}
          onTicketCreated={handleTicketCreated}
          onSelectTicket={handleSelectTicket}
          onGuestSessionVerified={setGuestSession}
          showToast={showToast}
        />
      )}

      {isTicketDetail && (
        <TicketDetailView
          ticketId={activeTicketId}
          initialTicket={
            selectedTicket &&
            String(selectedTicket.ticketId || selectedTicket.id || '').replace(/^#/, '') === activeTicketId
              ? selectedTicket
              : null
          }
          initialRecoveryCode={recoveryCodes[activeTicketId] || ''}
          currentUser={currentUser}
          guestSession={activeGuestSession}
          supportConfig={supportConfig}
          onBack={() => handleNavigate('tickets')}
          showToast={showToast}
        />
      )}

      {currentView === 'inbox' && (
        <SupportInboxView
          currentUser={currentUser}
          guestSession={activeGuestSession}
          supportConfig={supportConfig}
          onBack={() => handleNavigate('home')}
          onSelectTicket={handleSelectTicket}
          onGuestSessionVerified={setGuestSession}
          showToast={showToast}
        />
      )}

      {currentView === 'help-center' && (
        <HelpCenterView
          initialQuery={searchContext}
          onBack={() => handleNavigate('home')}
          onOpenInbox={() => handleNavigate('inbox')}
        />
      )}

      {currentView === 'guides' && (
        <GuidesView
          onBack={() => handleNavigate('home')}
        />
      )}
    </div>
  );
}
