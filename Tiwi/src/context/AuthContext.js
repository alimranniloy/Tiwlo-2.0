import React, { createContext, useContext, useState, useEffect } from 'react';
import { TiwiAPI, setAccountDisabledListener } from '../services/tiwiApi';
import AppStorage from '../utils/appStorage';
import { setAuthToken, setActiveUserId } from '../config/api';
import { lightTheme, darkTheme } from '../config/colors';

const AuthContext = createContext();
export { lightTheme, darkTheme };

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isSessionRestoring, setIsSessionRestoring] = useState(true);
  const [activeBanner, setActiveBanner] = useState(null);
  const [accountDisabledData, setAccountDisabledData] = useState(null);
  const [followingMap, setFollowingMap] = useState({});
  const [followRequestMap, setFollowRequestMap] = useState({});

  const setFollowStatus = (targetIdOrHandle, isFollowing) => {
    if (!targetIdOrHandle) return;
    const cleanKey = String(targetIdOrHandle).toLowerCase();
    setFollowingMap((prev) => ({ ...prev, [cleanKey]: isFollowing }));
  };

  const isUserFollowed = (userId, handle) => {
    if (userId && followingMap[String(userId).toLowerCase()] !== undefined) {
      return followingMap[String(userId).toLowerCase()];
    }
    if (handle) {
      const cleanH = String(handle).toLowerCase();
      if (followingMap[cleanH] !== undefined) return followingMap[cleanH];
      const withAt = cleanH.startsWith('@') ? cleanH : `@${cleanH}`;
      if (followingMap[withAt] !== undefined) return followingMap[withAt];
    }
    return undefined;
  };

  const isFollowRequestPending = (userId, handle) => {
    if (userId && followRequestMap[String(userId).toLowerCase()] !== undefined) {
      return followRequestMap[String(userId).toLowerCase()];
    }
    if (handle) {
      const cleanHandle = String(handle).toLowerCase();
      if (followRequestMap[cleanHandle] !== undefined) return followRequestMap[cleanHandle];
      const withAt = cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle}`;
      if (followRequestMap[withAt] !== undefined) return followRequestMap[withAt];
    }
    return undefined;
  };

  const toggleFollowUser = async (targetUser) => {
    if (!targetUser || !currentUser) return null;
    const targetId = typeof targetUser === 'object' ? (targetUser.id || targetUser.tiwiId) : targetUser;
    const targetHandle = typeof targetUser === 'object' ? targetUser.handle : null;
    const knownState = isUserFollowed(targetId, targetHandle);
    const nextState = knownState !== undefined ? !knownState : !(targetUser?.isFollowing || targetUser?.isFollowed);

    // Optimistically update map
    setFollowingMap((prev) => {
      const updated = { ...prev };
      if (targetId) updated[String(targetId).toLowerCase()] = nextState;
      if (targetHandle) {
        const cleanH = String(targetHandle).toLowerCase();
        updated[cleanH] = nextState;
        updated[cleanH.startsWith('@') ? cleanH : `@${cleanH}`] = nextState;
      }
      return updated;
    });

    try {
      const res = await TiwiAPI.toggleFollow(targetId, currentUser.id);
      if (res && res.isFollowing !== undefined) {
        setFollowingMap((prev) => {
          const updated = { ...prev };
          if (targetId) updated[String(targetId).toLowerCase()] = res.isFollowing;
          if (targetHandle) {
            const cleanH = String(targetHandle).toLowerCase();
            updated[cleanH] = res.isFollowing;
            updated[cleanH.startsWith('@') ? cleanH : `@${cleanH}`] = res.isFollowing;
          }
          return updated;
        });
      }
      setFollowRequestMap((prev) => {
        const updated = { ...prev };
        if (targetId) updated[String(targetId).toLowerCase()] = !!res?.requestPending;
        if (targetHandle) {
          const cleanH = String(targetHandle).toLowerCase();
          updated[cleanH] = !!res?.requestPending;
          updated[cleanH.startsWith('@') ? cleanH : `@${cleanH}`] = !!res?.requestPending;
        }
        return updated;
      });
      return res;
    } catch (err) {
      console.warn('[toggleFollowUser] error:', err);
      // Revert optimistic update on error
      setFollowingMap((prev) => {
        const updated = { ...prev };
        if (targetId) updated[String(targetId).toLowerCase()] = !nextState;
        if (targetHandle) {
          const cleanH = String(targetHandle).toLowerCase();
          updated[cleanH] = !nextState;
          updated[cleanH.startsWith('@') ? cleanH : `@${cleanH}`] = !nextState;
        }
        return updated;
      });
      throw err;
    }
  };

  // Trigger Immediate Kickout & Account Disabled Screen
  const triggerAccountDisabled = (banData = {}) => {
    console.warn('[AuthContext] IMMEDIATE KICKOUT: Account disabled by policy enforcement.');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAuthToken(null);
    setActiveUserId(null);
    AppStorage.removeItem('@tiwi_user_session').catch(() => {});
    setAccountDisabledData({
      banReason: banData.banReason || 'Your Tiwi Account has been disabled for safety policy violation.',
      email: banData.email || '',
      name: banData.name || 'User',
    });
  };

  const clearAccountDisabled = () => {
    setAccountDisabledData(null);
  };

  // Register Global Network API Ban Listener
  useEffect(() => {
    setAccountDisabledListener((banData) => {
      triggerAccountDisabled(banData);
    });
  }, []);

  // Restore session from persistent storage on startup
  useEffect(() => {
    async function restoreSession() {
      try {
        const saved = await AppStorage.getItem('@tiwi_user_session');
        if (saved) {
          const storedSession = JSON.parse(saved);
          const user = storedSession?.user || storedSession;
          const rawToken = storedSession?.token || storedSession?.sessionToken || null;
          const token = typeof rawToken === 'object' && rawToken !== null ? (rawToken.sessionToken || rawToken.token) : rawToken;
          if (user && user.id && token) {
            setAuthToken(token);
            setActiveUserId(user.id);
            setCurrentUser(user);
            setIsAuthenticated(true);
            // Verify if still valid or disabled
            TiwiAPI.getMe(user.id).then((meRes) => {
              if (meRes?.isBanned) {
                triggerAccountDisabled(meRes);
              }
            }).catch(() => {});
          } else if (user && user.id) {
            // Legacy local sessions only stored a user ID and could be forged.
            // Require one fresh sign-in to migrate them to a real session token.
            await AppStorage.removeItem('@tiwi_user_session');
          }
        }
      } catch (e) {
        console.warn('[restoreSession]', e);
      } finally {
        setIsSessionRestoring(false);
      }
    }
    restoreSession();
  }, []);

  const showInAppNotification = (notif) => {
    if (!notif) return;
    setActiveBanner({
      id: Date.now(),
      title: notif.title || 'Tiwi Notification',
      message: notif.message || '',
      type: notif.type || 'info',
      onPress: notif.onPress || null,
    });
  };

  const dismissBanner = () => {
    setActiveBanner(null);
  };

  const theme = isDarkMode ? darkTheme : lightTheme;

  // Refresh profile & notifications from live server for current authenticated user
  const refreshUser = async () => {
    if (!currentUser?.id) return;
    try {
      // 1. Verify user status via /me
      const meRes = await TiwiAPI.getMe(currentUser.id);
      if (meRes?.isBanned) {
        triggerAccountDisabled(meRes);
        return;
      }

      const profile = await TiwiAPI.getProfile(currentUser.id);
      if (profile && profile.id) {
        if (profile.isBanned) {
          triggerAccountDisabled(profile);
          return;
        }
        setCurrentUser(profile);
        const saved = await AppStorage.getItem('@tiwi_user_session');
        const existingSession = saved ? JSON.parse(saved) : {};
        AppStorage.setItem('@tiwi_user_session', JSON.stringify({ user: profile, token: existingSession?.token || existingSession?.sessionToken || null })).catch(() => {});
      }
      const notifs = await TiwiAPI.getNotifications(currentUser.id);
      const unreadN = Array.isArray(notifs) ? notifs.filter((n) => n && !n.read).length : 0;
      setUnreadNotificationsCount(unreadN);

      const convs = await TiwiAPI.getConversations(currentUser.id);
      const unreadM = Array.isArray(convs) ? convs.filter((c) => c && c.unread).length : 0;
      setUnreadMessagesCount(unreadM);
    } catch (err) {
      console.warn('[refreshUser]', err);
    }
  };

  // Real-Time Background Heartbeat (checks every 12s if user was banned in another tab or background)
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    refreshUser();
    const interval = setInterval(async () => {
      try {
        const meRes = await TiwiAPI.getMe(currentUser.id);
        if (meRes?.isBanned) {
          triggerAccountDisabled(meRes);
        }
      } catch (e) {}
    }, 12000);

    return () => clearInterval(interval);
  }, [isAuthenticated, currentUser?.id]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const login = async (emailOrPhone, password) => {
    setLoading(true);
    try {
      const data = await TiwiAPI.login(emailOrPhone, password);
      if (data.user && !data.requires2FA && !data.isBanned) {
        const rawToken = data.sessionToken || data.token;
        const token = typeof rawToken === 'object' && rawToken !== null ? (rawToken.sessionToken || rawToken.token) : rawToken;
        if (!token) throw new Error('Login succeeded but no secure session was returned. Please try again.');
        setAuthToken(token);
        setActiveUserId(data.user.id);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        AppStorage.setItem('@tiwi_user_session', JSON.stringify({ user: data.user, token })).catch(() => {});
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const verify2FA = async (tempToken, otpCode) => {
    setLoading(true);
    try {
      const data = await TiwiAPI.verify2FA(tempToken, otpCode);
      if (data && data.user) {
        const rawToken = data.sessionToken || data.token;
        const token = typeof rawToken === 'object' && rawToken !== null ? (rawToken.sessionToken || rawToken.token) : rawToken;
        if (!token) throw new Error('Verification succeeded but no secure session was returned. Please try again.');
        setAuthToken(token);
        setActiveUserId(data.user.id);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        AppStorage.setItem('@tiwi_user_session', JSON.stringify({ user: data.user, token })).catch(() => {});
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const resend2FA = async (tempToken) => {
    return await TiwiAPI.resend2FA(tempToken);
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const data = await TiwiAPI.register(userData);
      if (data && data.user && data.sessionToken) {
        const rawToken = data.sessionToken || data.token;
        const token = typeof rawToken === 'object' && rawToken !== null ? (rawToken.sessionToken || rawToken.token) : rawToken;
        setAuthToken(token);
        setActiveUserId(data.user.id);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        AppStorage.setItem('@tiwi_user_session', JSON.stringify({ user: data.user, token })).catch(() => {});
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const verifyEmail = async (tempToken, otpCode) => {
    setLoading(true);
    try {
      return await TiwiAPI.verifyEmail(tempToken, otpCode);
    } finally {
      setLoading(false);
    }
  };

  const resendEmailVerification = async (tempToken) => {
    return await TiwiAPI.resendEmailVerification(tempToken);
  };

  const setup2FA = async (tempToken, otpCode) => {
    setLoading(true);
    try {
      const data = await TiwiAPI.setup2FA(tempToken, otpCode);
      if (data && data.user) {
        const rawToken = data.sessionToken || data.token;
        const token = typeof rawToken === 'object' && rawToken !== null ? (rawToken.sessionToken || rawToken.token) : rawToken;
        if (!token) throw new Error('2-Step Verification succeeded but no secure session was returned. Please try again.');
        setAuthToken(token);
        setActiveUserId(data.user.id);
        setCurrentUser(data.user);
        setIsAuthenticated(true);
        AppStorage.setItem('@tiwi_user_session', JSON.stringify({ user: data.user, token })).catch(() => {});
      }
      return data;
    } finally {
      setLoading(false);
    }
  };

  const resendSetup2FA = async (tempToken) => {
    return await TiwiAPI.resendSetup2FA(tempToken);
  };

  const forgotPassword = async (emailOrPhone) => {
    setLoading(true);
    try {
      return await TiwiAPI.forgotPassword(emailOrPhone);
    } finally {
      setLoading(false);
    }
  };

  const verifyResetCode = async (tempToken, code) => {
    setLoading(true);
    try {
      return await TiwiAPI.verifyResetCode(tempToken, code);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (resetToken, newPassword) => {
    setLoading(true);
    try {
      return await TiwiAPI.resetPassword(resetToken, newPassword);
    } finally {
      setLoading(false);
    }
  };

  const submitAppeal = async (identifier, appealReason) => {
    setLoading(true);
    try {
      return await TiwiAPI.submitAppeal(identifier, appealReason);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setAuthToken(null);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setUnreadNotificationsCount(0);
    setUnreadMessagesCount(0);
    AppStorage.removeItem('@tiwi_user_session').catch(() => {});
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        isAuthenticated,
        setIsAuthenticated,
        isDarkMode,
        toggleDarkMode,
        isVideoMuted,
        setIsVideoMuted,
        theme,
        unreadNotificationsCount,
        setUnreadNotificationsCount,
        unreadMessagesCount,
        setUnreadMessagesCount,
        login,
        verify2FA,
        resend2FA,
        register,
        verifyEmail,
        resendEmailVerification,
        setup2FA,
        resendSetup2FA,
        forgotPassword,
        verifyResetCode,
        resetPassword,
        submitAppeal,
        logout,
        refreshUser,
        loading,
        isSessionRestoring,
        activeBanner,
        showInAppNotification,
        dismissBanner,
        accountDisabledData,
        clearAccountDisabled,
        followingMap,
        followRequestMap,
        setFollowStatus,
        isUserFollowed,
        isFollowRequestPending,
        toggleFollowUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
