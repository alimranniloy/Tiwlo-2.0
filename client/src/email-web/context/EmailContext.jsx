import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { EmailAPI } from '../api/emailApi';

const EmailContext = createContext(null);

export function EmailProvider({ children, initialUser = null, onNavigateHome = null }) {
  const [currentUser] = useState(() => {
    if (initialUser) return initialUser;
    try {
      const u = localStorage.getItem('stockpro_user');
      return u ? JSON.parse(u) : {
        name: 'Ahmad Nur Fawaid',
        email: 'fawait@tiwlo.com',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
      };
    } catch {
      return {
        name: 'Ahmad Nur Fawaid',
        email: 'fawait@tiwlo.com',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'
      };
    }
  });

  // Parse initial route
  const parseCurrentRoute = () => {
    try {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const parts = pathname.split('/');
      // Expected: /email or /email/:folder or /email/view/:id or /email/compose
      if (parts[0] === 'email' || parts[0] === 'mail') {
        if (parts[1] === 'compose') {
          return { folder: 'inbox', isCompose: true, mailId: null };
        }
        if (parts[1] === 'view' && parts[2]) {
          return { folder: 'inbox', isCompose: false, mailId: parts[2] };
        }
        const folder = parts[1] || 'inbox';
        return { folder, isCompose: false, mailId: null };
      }
    } catch (e) {}
    return { folder: 'inbox', isCompose: false, mailId: null };
  };

  const initialRoute = parseCurrentRoute();

  const [activeFolder, setActiveFolderState] = useState(initialRoute.folder);
  const [activeTab, setActiveTab] = useState('focused'); // 'focused', 'other', 'all', 'unread'
  const [activeCategoryFilter, setActiveCategoryFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [counts, setCounts] = useState({
    inboxUnread: 2,
    junkCount: 0,
    draftsCount: 1,
    sentCount: 1,
    trashCount: 0,
    archiveCount: 0,
    flaggedCount: 1
  });

  const [isComposeOpen, setIsComposeOpen] = useState(initialRoute.isCompose);
  const [composeData, setComposeData] = useState({
    to: '',
    cc: '',
    bcc: '',
    subject: '',
    body: '',
    attachments: []
  });

  // Mobile navigation state
  const [mobileView, setMobileView] = useState(
    initialRoute.mailId ? 'reading' : initialRoute.isCompose ? 'compose' : 'list'
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Synchronize route with browser history
  const navigateFolder = useCallback((folder, replace = false) => {
    setActiveFolderState(folder);
    setIsComposeOpen(false);
    setSelectedIds(new Set());
    setMobileView('list');
    setMobileDrawerOpen(false);

    const targetUrl = folder === 'inbox' ? '/email' : `/email/${folder}`;
    try {
      if (replace) {
        window.history.replaceState({ folder }, '', targetUrl);
      } else {
        window.history.pushState({ folder }, '', targetUrl);
      }
    } catch (e) {}
  }, []);

  const openEmail = useCallback((email) => {
    setSelectedEmail(email);
    setIsComposeOpen(false);
    setMobileView('reading');

    // Mark as read in local state
    if (email?.isUnread) {
      email.isUnread = false;
      EmailAPI.toggleRead(email.id, false);
      setCounts((prev) => ({
        ...prev,
        inboxUnread: Math.max(0, prev.inboxUnread - 1)
      }));
    }

    try {
      window.history.pushState({ mailId: email.id }, '', `/email/view/${email.id}`);
    } catch (e) {}
  }, []);

  const openCompose = useCallback((preset = null) => {
    if (preset) {
      setComposeData({
        to: preset.to || '',
        cc: preset.cc || '',
        bcc: preset.bcc || '',
        subject: preset.subject || '',
        body: preset.body || '',
        attachments: preset.attachments || []
      });
    } else {
      setComposeData({
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        body: '',
        attachments: []
      });
    }
    setIsComposeOpen(true);
    setMobileView('compose');
    try {
      window.history.pushState({ compose: true }, '', '/email/compose');
    } catch (e) {}
  }, []);

  const closeCompose = useCallback(() => {
    setIsComposeOpen(false);
    setMobileView(selectedEmail ? 'reading' : 'list');
    try {
      window.history.pushState({}, '', activeFolder === 'inbox' ? '/email' : `/email/${activeFolder}`);
    } catch (e) {}
  }, [activeFolder, selectedEmail]);

  // Load emails whenever activeFolder, activeTab, or searchQuery changes
  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const data = await EmailAPI.getMessages({
        folder: activeFolder,
        tab: activeTab,
        q: searchQuery
      });
      if (data && Array.isArray(data.emails)) {
        let list = data.emails;
        if (activeCategoryFilter) {
          list = list.filter((m) => m.category === activeCategoryFilter);
        }
        setEmails(list);
        if (data.counts) setCounts(data.counts);

        // Auto select first email on desktop if none selected
        if (!selectedEmail && list.length > 0 && window.innerWidth >= 1024) {
          setSelectedEmail(list[0]);
        }
      }
    } catch (err) {
      console.warn('Failed to load emails:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFolder, activeTab, searchQuery, activeCategoryFilter, selectedEmail]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  // Listen to browser popstate (Back/Forward)
  useEffect(() => {
    const handlePopState = () => {
      const route = parseCurrentRoute();
      setActiveFolderState(route.folder);
      setIsComposeOpen(route.isCompose);
      if (route.mailId) {
        EmailAPI.getMessageById(route.mailId).then((m) => {
          if (m) setSelectedEmail(m);
        });
        setMobileView('reading');
      } else if (route.isCompose) {
        setMobileView('compose');
      } else {
        setMobileView('list');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Actions
  const handleToggleFlag = async (id, e) => {
    if (e) e.stopPropagation();
    const res = await EmailAPI.toggleFlag(id);
    if (res.success) {
      setEmails((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isFlagged: res.isFlagged } : m))
      );
      if (selectedEmail?.id === id) {
        setSelectedEmail((prev) => ({ ...prev, isFlagged: res.isFlagged }));
      }
      showToast(res.isFlagged ? 'Message flagged' : 'Flag removed', 'info');
    }
  };

  const handleToggleRead = async (id, isUnread, e) => {
    if (e) e.stopPropagation();
    const res = await EmailAPI.toggleRead(id, isUnread);
    if (res.success) {
      setEmails((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isUnread: res.isUnread } : m))
      );
      if (selectedEmail?.id === id) {
        setSelectedEmail((prev) => ({ ...prev, isUnread: res.isUnread }));
      }
      setCounts((prev) => ({
        ...prev,
        inboxUnread: res.isUnread
          ? prev.inboxUnread + 1
          : Math.max(0, prev.inboxUnread - 1)
      }));
      showToast(res.isUnread ? 'Marked as unread' : 'Marked as read', 'info');
    }
  };

  const handleTogglePin = async (id, e) => {
    if (e) e.stopPropagation();
    const res = await EmailAPI.togglePin(id);
    if (res.success) {
      setEmails((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isPinned: res.isPinned } : m))
      );
      if (selectedEmail?.id === id) {
        setSelectedEmail((prev) => ({ ...prev, isPinned: res.isPinned }));
      }
      showToast(res.isPinned ? 'Pinned to top' : 'Unpinned', 'info');
    }
  };

  const handleDeleteEmail = async (id, e) => {
    if (e) e.stopPropagation();
    await EmailAPI.deleteEmail(id);
    setEmails((prev) => prev.filter((m) => m.id !== id));
    if (selectedEmail?.id === id) {
      setSelectedEmail(null);
      setMobileView('list');
    }
    showToast('Conversation moved to Deleted Items', 'info');
  };

  const handleArchiveEmail = async (id, e) => {
    if (e) e.stopPropagation();
    await EmailAPI.archiveEmail(id);
    setEmails((prev) => prev.filter((m) => m.id !== id));
    if (selectedEmail?.id === id) {
      setSelectedEmail(null);
      setMobileView('list');
    }
    showToast('Conversation moved to Archive', 'info');
  };

  const handleSweepSender = async (senderEmail) => {
    const matching = emails.filter((m) => m.sender?.email === senderEmail);
    for (const m of matching) {
      await EmailAPI.archiveEmail(m.id);
    }
    setEmails((prev) => prev.filter((m) => m.sender?.email !== senderEmail));
    if (selectedEmail?.sender?.email === senderEmail) {
      setSelectedEmail(null);
      setMobileView('list');
    }
    showToast(`Sweep complete: cleaned ${matching.length} messages from ${senderEmail}`, 'info');
  };

  const handleSendEmail = async (payload) => {
    const res = await EmailAPI.sendEmail(payload);
    if (res.success) {
      showToast('Message sent successfully!', 'info');
      setIsComposeOpen(false);
      setMobileView('list');
      try {
        window.history.pushState({}, '', activeFolder === 'inbox' ? '/email' : `/email/${activeFolder}`);
      } catch (e) {}
      loadEmails();
      return true;
    }
    showToast('Failed to send message', 'error');
    return false;
  };

  const handleMarkAllAsRead = async () => {
    for (const m of emails) {
      if (m.isUnread) {
        await EmailAPI.toggleRead(m.id, false);
      }
    }
    setEmails((prev) => prev.map((m) => ({ ...m, isUnread: false })));
    setCounts((prev) => ({ ...prev, inboxUnread: 0 }));
    showToast('All messages marked as read', 'info');
  };

  return (
    <EmailContext.Provider
      value={{
        currentUser,
        activeFolder,
        navigateFolder,
        activeTab,
        setActiveTab,
        activeCategoryFilter,
        setActiveCategoryFilter,
        searchQuery,
        setSearchQuery,
        emails,
        loading,
        selectedEmail,
        setSelectedEmail,
        openEmail,
        selectedIds,
        setSelectedIds,
        counts,
        isComposeOpen,
        composeData,
        setComposeData,
        openCompose,
        closeCompose,
        mobileView,
        setMobileView,
        mobileDrawerOpen,
        setMobileDrawerOpen,
        showToast,
        onNavigateHome,
        // Actions
        handleToggleFlag,
        handleToggleRead,
        handleTogglePin,
        handleDeleteEmail,
        handleArchiveEmail,
        handleSweepSender,
        handleSendEmail,
        handleMarkAllAsRead
      }}
    >
      {children}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#201F1E] dark:bg-[#292827] text-white px-4 py-3 rounded-lg shadow-xl text-[13px] font-medium border border-black/10 dark:border-white/10 animate-fadeIn">
          <span className="w-2.5 h-2.5 rounded-full bg-[#0078D4]" />
          <span>{toastMessage.message}</span>
        </div>
      )}
    </EmailContext.Provider>
  );
}

export function useEmail() {
  const context = useContext(EmailContext);
  if (!context) {
    throw new Error('useEmail must be used within an EmailProvider');
  }
  return context;
}
