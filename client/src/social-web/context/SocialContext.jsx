import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

const SocialContext = createContext(null);

export function SocialProvider({ children, initialUser = null }) {
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [userLoading, setUserLoading] = useState(!initialUser);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return localStorage.getItem('tiwi_theme') === 'dark' || document.documentElement.classList.contains('dark');
    } catch (e) {
      return false;
    }
  });

  // Parse path from window.location
  const parseCurrentRoute = () => {
    try {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const parts = pathname.split('/');
      // Expected: /tiwi or /tiwi/subpath or /tiwi/subpath/:id
      if (parts[0] === 'tiwi') {
        const sub = parts[1] || 'feed';
        const param = parts[2] || null;
        return { tab: sub, params: param ? { id: param, handle: param } : null };
      }
    } catch (e) {}
    return { tab: 'feed', params: null };
  };

  const initialRoute = parseCurrentRoute();
  const [activeTab, setActiveTabState] = useState(initialRoute.tab);
  const [tabParams, setTabParams] = useState(initialRoute.params);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [toastMessage, setToastMessage] = useState(null);

  // Sync route with browser history
  const navigateTo = useCallback((tab, params = null, replace = false) => {
    setActiveTabState(tab);
    setTabParams(params);

    let targetUrl = `/tiwi/${tab}`;
    if (tab === 'feed') {
      targetUrl = '/tiwi';
    } else if (params) {
      if (typeof params === 'string') {
        targetUrl = `/tiwi/${tab}/${encodeURIComponent(params)}`;
      } else if (params.id || params.handle) {
        targetUrl = `/tiwi/${tab}/${encodeURIComponent(params.id || params.handle)}`;
      }
    }

    try {
      if (replace) {
        window.history.replaceState({ tab, params }, '', targetUrl);
      } else {
        window.history.pushState({ tab, params }, '', targetUrl);
      }
    } catch (e) {}
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Listen to browser popstate (Back/Forward)
  useEffect(() => {
    const handlePopState = () => {
      const route = parseCurrentRoute();
      setActiveTabState(route.tab);
      setTabParams(route.params);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Load initial user on mount
  useEffect(() => {
    let mounted = true;
    TiwiSocialAPI.getInitialUser().then((user) => {
      if (mounted && user) {
        setCurrentUser(user);
        setUserLoading(false);
      }
    }).catch(() => {
      if (mounted) setUserLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch unread counters
  useEffect(() => {
    if (!currentUser?.id) return;
    TiwiSocialAPI.getNotifications(currentUser.id).then((notifs) => {
      if (Array.isArray(notifs)) {
        const unread = notifs.filter(n => !n.isRead && !n.read).length;
        setUnreadNotifications(unread);
      }
    }).catch(() => {});

    TiwiSocialAPI.getConversations(currentUser.id).then((convs) => {
      if (Array.isArray(convs)) {
        const unread = convs.filter(c => c.unreadCount > 0).length;
        setUnreadMessages(unread);
      }
    }).catch(() => {});
  }, [currentUser?.id, activeTab]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('tiwi_theme', next ? 'dark' : 'light');
        if (next) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
      return next;
    });
  };

  const showToast = (message, type = 'info') => {
    setToastMessage({ message, type, id: Date.now() });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  return (
    <SocialContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        userLoading,
        activeTab,
        tabParams,
        navigateTo,
        isDarkMode,
        toggleDarkMode,
        unreadNotifications,
        setUnreadNotifications,
        unreadMessages,
        setUnreadMessages,
        showToast,
      }}
    >
      {children}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-3 bg-[#202124] text-white px-4 py-3 rounded-md shadow-lg text-sm font-medium border border-[#3c4043]">
          <span className="w-2 h-2 rounded-full bg-[#1a73e8]" />
          {toastMessage.message}
        </div>
      )}
    </SocialContext.Provider>
  );
}

export function useSocial() {
  const context = useContext(SocialContext);
  if (!context) {
    throw new Error('useSocial must be used within a SocialProvider');
  }
  return context;
}
