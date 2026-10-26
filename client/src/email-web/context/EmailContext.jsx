import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { EmailAPI } from '../api/emailApi';
import { isMailSubdomain } from '../../utils/navigation';
import ToastNotification from '../../components/ToastNotification';

const EmailContext = createContext(null);
const VALID_FOLDERS = new Set(['inbox', 'sent', 'drafts', 'junk', 'trash', 'archive', 'flagged']);

export function EmailProvider({ children, initialUser = null, onNavigateHome = null, onSignOut = null }) {
  const [currentUser] = useState(() => {
    if (initialUser) return initialUser;
    try {
      const u = localStorage.getItem('stockpro_user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  });

  // Parse initial route
  const parseCurrentRoute = () => {
    try {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const parts = pathname.split('/');
      if (isMailSubdomain()) {
        if (!pathname) return { folder: 'inbox', isCompose: false, mailId: null };
        if (parts[0] === 'compose') return { folder: 'inbox', isCompose: true, mailId: null };
        if (parts[0] === 'view' && parts[1]) return { folder: 'inbox', isCompose: false, mailId: parts[1] };
        return { folder: parts[0], isCompose: false, mailId: null };
      }
      // Expected: /email or /email/:folder or /email/view/:id or /email/compose
      if (parts[0] === 'email' || parts[0] === 'mail') {
        if (parts[1] === 'compose') {
          return { folder: 'inbox', isCompose: true, mailId: null };
        }
        if (parts[1] === 'view' && parts[2]) {
          return { folder: 'inbox', isCompose: false, mailId: parts[2] };
        }
        const folder = VALID_FOLDERS.has(parts[1]) ? parts[1] : 'inbox';
        return { folder, isCompose: false, mailId: null };
      }
    } catch {}
    return { folder: 'inbox', isCompose: false, mailId: null };
  };

  const initialRoute = parseCurrentRoute();
  const [initialMailId] = useState(() => initialRoute.mailId);
  const emailPath = useCallback((path = '') => {
    const cleanPath = path.replace(/^\/+/, '');
    if (isMailSubdomain()) return cleanPath ? `/${cleanPath}` : '/';
    return cleanPath ? `/email/${cleanPath}` : '/email';
  }, []);

  const [activeFolder, setActiveFolderState] = useState(initialRoute.folder);
  const [activeTab, setActiveTab] = useState('all');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mailbox, setMailbox] = useState(null);
  const [mailboxLoading, setMailboxLoading] = useState(true);
  const [mailboxError, setMailboxError] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [counts, setCounts] = useState({
    inboxUnread: 0,
    junkCount: 0,
    draftsCount: 0,
    sentCount: 0,
    trashCount: 0,
    archiveCount: 0,
    flaggedCount: 0
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
  const [draftStatus, setDraftStatus] = useState('will save as you type');
  const lastSavedDraftRef = useRef('');

  // Mobile navigation state
  const [mobileView, setMobileView] = useState(
    initialRoute.mailId ? 'reading' : initialRoute.isCompose ? 'compose' : 'list'
  );
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = useCallback((message, type = 'info') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => setToastMessage(null), 3500);
  }, []);

  const refreshMailbox = useCallback(async () => {
    setMailboxLoading(true);
    setMailboxError(null);
    try {
      const result = await EmailAPI.getMailbox();
      setMailbox(result.mailbox);
    } catch (error) {
      setMailboxError(error.message);
      showToast(error.message, 'error');
    } finally {
      setMailboxLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    refreshMailbox();
  }, [refreshMailbox]);

  // Synchronize route with browser history
  const navigateFolder = useCallback((folder, replace = false) => {
    setActiveFolderState(folder);
    setIsComposeOpen(false);
    setSelectedEmail(null);
    setSelectedIds(new Set());
    setMobileView('list');
    setMobileDrawerOpen(false);

    const targetUrl = folder === 'inbox' ? emailPath() : emailPath(folder);
    try {
      if (replace) {
        window.history.replaceState({ folder }, '', targetUrl);
      } else {
        window.history.pushState({ folder }, '', targetUrl);
      }
    } catch {}
  }, [emailPath]);

  const openEmail = useCallback((email) => {
    if (email.folder === 'drafts') {
      lastSavedDraftRef.current = '';
      setComposeData({
        draftId: email.id,
        to: (email.to || []).map((recipient) => recipient.email).join(', '),
        cc: (email.cc || []).map((recipient) => recipient.email).join(', '),
        bcc: (email.bcc || []).map((recipient) => recipient.email).join(', '),
        subject: email.subject || '',
        body: email.bodyText || '',
        attachments: []
      });
      setIsComposeOpen(true);
      setMobileView('compose');
      window.history.pushState({ compose: true }, '', emailPath('compose'));
      return;
    }
    setSelectedEmail(email);
    setIsComposeOpen(false);
    setMobileView('reading');

    if (email?.isUnread) {
      setEmails((previous) => previous.map((message) =>
        message.id === email.id ? { ...message, isUnread: false } : message
      ));
      setCounts((prev) => ({
        ...prev,
        inboxUnread: Math.max(0, prev.inboxUnread - 1)
      }));
    }

    EmailAPI.getMessageById(email.id)
      .then((message) => {
        setSelectedEmail((current) => current?.id === email.id ? message : current);
        setEmails((previous) => previous.map((entry) => entry.id === email.id ? message : entry));
      })
      .catch((error) => showToast(error.message, 'error'));

    try {
      window.history.pushState({ mailId: email.id }, '', emailPath(`view/${email.id}`));
    } catch {}
  }, [emailPath, showToast]);

  const openCompose = useCallback((preset = null) => {
    lastSavedDraftRef.current = '';
    if (preset) {
      setComposeData({
        draftId: null,
        to: preset.to || '',
        cc: preset.cc || '',
        bcc: preset.bcc || '',
        subject: preset.subject || '',
        body: preset.body || '',
        attachments: preset.attachments || []
      });
    } else {
      setComposeData({
        draftId: null,
        to: '',
        cc: '',
        bcc: '',
        subject: '',
        body: '',
        attachments: []
      });
    }
    setIsComposeOpen(true);
    setDraftStatus('will save as you type');
    setMobileView('compose');
    try {
      window.history.pushState({ compose: true }, '', emailPath('compose'));
    } catch {}
  }, [emailPath]);

  const closeCompose = useCallback(() => {
    setIsComposeOpen(false);
    setMobileView(selectedEmail ? 'reading' : 'list');
    try {
      window.history.replaceState({}, '', activeFolder === 'inbox' ? emailPath() : emailPath(activeFolder));
    } catch (e) {}
  }, [activeFolder, emailPath, selectedEmail]);

  // Load emails whenever activeFolder, activeTab, or searchQuery changes
  const loadEmails = useCallback(async () => {
    if (mailboxLoading) return;
    if (!mailbox) {
      setEmails([]);
      setLoading(false);
      return;
    }
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
        if (list.length > 0 && window.innerWidth >= 1024) {
          setSelectedEmail((current) => {
            if (current || activeFolder === 'drafts') return current;
            return list[0];
          });
        } else if (selectedEmail && !list.some((message) => message.id === selectedEmail.id)) {
          setSelectedEmail(null);
        }
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [activeFolder, activeTab, searchQuery, activeCategoryFilter, mailbox, mailboxLoading, selectedEmail, showToast]);

  useEffect(() => {
    if (!isComposeOpen) return undefined;
    const draft = {
      draftId: composeData.draftId,
      to: composeData.to || '',
      cc: composeData.cc || '',
      bcc: composeData.bcc || '',
      subject: composeData.subject || '',
      body: composeData.body || ''
    };
    if (![draft.to, draft.cc, draft.bcc, draft.subject, draft.body].some((value) => value.trim())) {
      setDraftStatus('will save as you type');
      return undefined;
    }
    const fingerprint = JSON.stringify({
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body
    });
    if (fingerprint === lastSavedDraftRef.current) {
      setDraftStatus('saved');
      return undefined;
    }
    setDraftStatus('saving…');
    const timer = window.setTimeout(async () => {
      try {
        const result = await EmailAPI.saveDraft(draft);
        lastSavedDraftRef.current = fingerprint;
        setComposeData((previous) => previous.draftId
          ? previous
          : { ...previous, draftId: result.email.id });
        setDraftStatus('saved');
        if (!draft.draftId) loadEmails();
      } catch (saveError) {
        setDraftStatus('save failed');
        showToast(saveError.message, 'error');
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [
    isComposeOpen, composeData.draftId, composeData.to, composeData.cc,
    composeData.bcc, composeData.subject, composeData.body,
    activeFolder, loadEmails, showToast
  ]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  useEffect(() => {
    if (!initialMailId) return;
    EmailAPI.getMessageById(initialMailId)
      .then(setSelectedEmail)
      .catch((error) => showToast(error.message, 'error'));
  }, [initialMailId, showToast]);

  // Listen to browser popstate (Back/Forward)
  useEffect(() => {
    const handlePopState = () => {
      const route = parseCurrentRoute();
      setActiveFolderState(route.folder);
      setIsComposeOpen(route.isCompose);
      if (route.mailId) {
        EmailAPI.getMessageById(route.mailId).then((m) => {
          if (m) setSelectedEmail(m);
        }).catch((error) => showToast(error.message, 'error'));
        setMobileView('reading');
      } else if (route.isCompose) {
        setSelectedEmail(null);
        setMobileView('compose');
      } else {
        setSelectedEmail(null);
        setSelectedIds(new Set());
        setMobileView('list');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showToast]);

  // Actions
  const handleToggleFlag = async (id, e) => {
    if (e) e.stopPropagation();
    try {
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
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleToggleRead = async (id, isUnread, e) => {
    if (e) e.stopPropagation();
    try {
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
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleTogglePin = async (id, e) => {
    if (e) e.stopPropagation();
    try {
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
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleDeleteEmail = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await EmailAPI.deleteEmail(id);
      setEmails((prev) => prev.filter((m) => m.id !== id));
      if (selectedEmail?.id === id) {
        setSelectedEmail(null);
        setMobileView('list');
        window.history.replaceState({}, '', activeFolder === 'inbox' ? emailPath() : emailPath(activeFolder));
      }
      showToast(activeFolder === 'trash' ? 'Message permanently deleted' : 'Conversation moved to Deleted Items', 'info');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleArchiveEmail = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await EmailAPI.archiveEmail(id);
      setEmails((prev) => prev.filter((m) => m.id !== id));
      if (selectedEmail?.id === id) {
        setSelectedEmail(null);
        setMobileView('list');
        window.history.replaceState({}, '', activeFolder === 'inbox' ? emailPath() : emailPath(activeFolder));
      }
      showToast('Conversation moved to Archive', 'info');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleSweepSender = async (senderEmail) => {
    const matching = emails.filter((m) => m.sender?.email === senderEmail);
    try {
      for (const m of matching) {
        await EmailAPI.archiveEmail(m.id);
      }
    } catch (error) {
      showToast(error.message, 'error');
      return;
    }
    setEmails((prev) => prev.filter((m) => m.sender?.email !== senderEmail));
    if (selectedEmail?.sender?.email === senderEmail) {
      setSelectedEmail(null);
      setMobileView('list');
      window.history.replaceState({}, '', activeFolder === 'inbox' ? emailPath() : emailPath(activeFolder));
    }
    showToast(`Sweep complete: cleaned ${matching.length} messages from ${senderEmail}`, 'info');
  };

  const handleSendEmail = async (payload) => {
    try {
      const res = await EmailAPI.sendEmail(payload);
      if (!res.success) throw new Error(res.error || 'Email could not be delivered.');
      showToast('Message sent successfully!', 'info');
      setIsComposeOpen(false);
      setComposeData({ to: '', cc: '', bcc: '', subject: '', body: '', attachments: [] });
      setDraftStatus('will save as you type');
      lastSavedDraftRef.current = '';
      setMobileView('list');
      window.history.replaceState({}, '', activeFolder === 'inbox' ? emailPath() : emailPath(activeFolder));
      await loadEmails();
      return true;
    } catch (error) {
      showToast(error.message, 'error');
      return false;
    }
  };

  const handleCreateMailbox = async (localPart) => {
    const result = await EmailAPI.createMailbox(localPart);
    setMailbox(result.mailbox);
    showToast('Your Tiwlo Mail address is ready.', 'info');
  };

  const handleDiscardDraft = async () => {
    try {
      if (composeData.draftId) await EmailAPI.discardDraft(composeData.draftId);
      lastSavedDraftRef.current = '';
      setComposeData({ to: '', cc: '', bcc: '', subject: '', body: '', attachments: [] });
      setDraftStatus('will save as you type');
      closeCompose();
      await loadEmails();
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      for (const m of emails) {
        if (m.isUnread) {
          await EmailAPI.toggleRead(m.id, false);
        }
      }
    } catch (error) {
      showToast(error.message, 'error');
      return;
    }
    setEmails((prev) => prev.map((m) => ({ ...m, isUnread: false })));
    setCounts((prev) => ({ ...prev, inboxUnread: 0 }));
    showToast('All messages marked as read', 'info');
  };

  return (
    <EmailContext.Provider
      value={{
        currentUser,
        mailbox,
        mailboxLoading,
        mailboxError,
        refreshMailbox,
        handleCreateMailbox,
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
        draftStatus,
        openCompose,
        closeCompose,
        handleDiscardDraft,
        mobileView,
        setMobileView,
        mobileDrawerOpen,
        setMobileDrawerOpen,
        showToast,
        onNavigateHome,
        onSignOut,
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
        <ToastNotification message={toastMessage.message} type={toastMessage.type} />
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
