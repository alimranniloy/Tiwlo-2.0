import React, { useState, useEffect } from 'react';
import HelpSupportHome from './help-support/HelpSupportHome';
import TicketsView from './help-support/TicketsView';
import CreateTicketView from './help-support/CreateTicketView';
import SupportInboxView from './help-support/SupportInboxView';
import HelpCenterView from './help-support/HelpCenterView';
import GuidesView from './help-support/GuidesView';

export default function HelpSupportView({
  currentUser,
  onBackToDashboard,
  initialSubRoute = 'home',
  showToast
}) {
  // Determine initial sub-route from URL pathname (e.g. /help-support/tickets) or props
  const getSubRouteFromPath = () => {
    try {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (pathname === 'help-support/tickets' || pathname === 'tickets') return 'tickets';
      if (pathname === 'help-support/create-ticket' || pathname === 'create-ticket') return 'create-ticket';
      if (pathname === 'help-support/inbox' || pathname === 'inbox' || pathname === 'support-inbox') return 'inbox';
      if (pathname === 'help-support/help-center' || pathname === 'help-center') return 'help-center';
      if (pathname === 'help-support/guides' || pathname === 'guides') return 'guides';
    } catch (e) {}
    return initialSubRoute || 'home';
  };

  const [currentView, setCurrentView] = useState(getSubRouteFromPath);
  const [searchContext, setSearchContext] = useState('');

  // Sync when initialSubRoute prop changes
  useEffect(() => {
    if (initialSubRoute && initialSubRoute !== currentView) {
      setCurrentView(initialSubRoute);
    }
  }, [initialSubRoute]);

  // Synchronize state on browser back/forward buttons
  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(getSubRouteFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Clean URL Navigation Handler
  const handleNavigate = (viewName, extraData = {}) => {
    setCurrentView(viewName);
    if (extraData?.query) {
      setSearchContext(extraData.query);
    }

    try {
      const newPath = viewName === 'home' ? '/help-support' : `/help-support/${viewName}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState(null, '', newPath);
      }
    } catch (e) {}
  };

  // Handler for creating a new ticket
  const handleTicketCreated = (newTicket) => {
    showToast?.(`Ticket #${newTicket.ticketId || newTicket.id} created successfully! Our team is reviewing it.`);
    handleNavigate('tickets');
  };

  // Handler for contacting live support (also triggers widget)
  const handleContactSupport = () => {
    window.dispatchEvent(new CustomEvent('tiwlo:open-support'));
    handleNavigate('inbox');
  };

  return (
    <div className="w-full">
      {/* VIEW 1: Help & Support Home Landing Page */}
      {currentView === 'home' && (
        <HelpSupportHome
          onNavigate={handleNavigate}
          onContactSupport={handleContactSupport}
        />
      )}

      {/* VIEW 2: Tickets List Page (Real Data from database) */}
      {currentView === 'tickets' && (
        <TicketsView
          onBack={() => handleNavigate('home')}
          onCreateTicket={() => handleNavigate('create-ticket')}
          onSelectTicket={(ticket) => handleNavigate('inbox')}
        />
      )}

      {/* VIEW 3: Create Ticket Form (Real Data submission to database) */}
      {currentView === 'create-ticket' && (
        <CreateTicketView
          currentUser={currentUser}
          onBack={() => handleNavigate('tickets')}
          onTicketCreated={handleTicketCreated}
        />
      )}

      {/* VIEW 4: Support Inbox Chat (Real Data from database & Gemini AI) */}
      {currentView === 'inbox' && (
        <SupportInboxView
          currentUser={currentUser}
          onBack={() => handleNavigate('home')}
        />
      )}

      {/* VIEW 5: Help Center Knowledge Base */}
      {currentView === 'help-center' && (
        <HelpCenterView
          initialQuery={searchContext}
          onBack={() => handleNavigate('home')}
          onOpenInbox={() => handleNavigate('inbox')}
        />
      )}

      {/* VIEW 6: Guides */}
      {currentView === 'guides' && (
        <GuidesView
          onBack={() => handleNavigate('home')}
        />
      )}
    </div>
  );
}
