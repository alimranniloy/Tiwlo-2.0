/**
 * Tiwi Social Media App - API Configuration
 * Connects to the configured Tiwlo API server.
 */

const configuredBaseUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
export const BASE_URL = (configuredBaseUrl || 'https://tiwlo.com').replace(/\/+$/, '');
export const API_BASE_URL = BASE_URL;

// The session token is kept in memory by the API layer and restored by
// AuthContext.
let activeAuthToken = null;
let activeUserId = null;

export const setAuthToken = (token) => {
  if (typeof token === 'object' && token !== null) {
    activeAuthToken = token.sessionToken || token.token || null;
  } else {
    activeAuthToken = (typeof token === 'string' && token !== '[object Object]') ? token.trim() : null;
  }
};

export const setActiveUserId = (id) => {
  activeUserId = id ? String(id).trim() : null;
};

export const ENDPOINTS = {
  // Auth
  LOGIN: `${BASE_URL}/api/auth/login`,
  VERIFY_2FA: `${BASE_URL}/api/auth/verify-2fa`,
  RESEND_2FA: `${BASE_URL}/api/auth/resend-2fa`,
  REGISTER: `${BASE_URL}/api/tiwi/register`,
  VERIFY_EMAIL: `${BASE_URL}/api/auth/verify-email`,
  RESEND_EMAIL_VERIFICATION: `${BASE_URL}/api/auth/resend-email-verification`,
  SETUP_2FA: `${BASE_URL}/api/auth/setup-2fa`,
  RESEND_SETUP_2FA: `${BASE_URL}/api/auth/resend-setup-2fa`,
  CHECK_AVAILABILITY: `${BASE_URL}/api/auth/check-availability`,
  ME: `${BASE_URL}/api/tiwi/me`,
  FORGOT_PASSWORD: `${BASE_URL}/api/auth/forgot-password/request`,
  VERIFY_RESET_CODE: `${BASE_URL}/api/auth/forgot-password/verify-code`,
  RESET_PASSWORD: `${BASE_URL}/api/auth/forgot-password/reset`,
  APPEAL: `${BASE_URL}/api/tiwi/appeal`,

  // Feed & Posts
  FEED: (filter = 'for_you') => `${BASE_URL}/api/tiwi/feed?filter=${encodeURIComponent(filter)}`,
  POSTS: `${BASE_URL}/api/tiwi/posts`,
  USER_POSTS: (userId) => `${BASE_URL}/api/tiwi/users/${encodeURIComponent(userId)}/posts`,
  LIKE_POST: (id) => `${BASE_URL}/api/tiwi/posts/${id}/like`,
  VIEW_POST: (id) => `${BASE_URL}/api/tiwi/posts/${id}/view`,
  SAVE_POST: (id) => `${BASE_URL}/api/tiwi/posts/${id}/bookmark`,
  REPOST_POST: (id) => `${BASE_URL}/api/tiwi/posts/${id}/repost`,
  COMMENT_POST: (id) => `${BASE_URL}/api/tiwi/posts/${id}/comment`,
  DELETE_POST: (id) => `${BASE_URL}/api/tiwi/posts/${id}`,
  EDIT_POST: (id) => `${BASE_URL}/api/tiwi/posts/${id}`,
  PIN_POST: (id) => `${BASE_URL}/api/tiwi/posts/${id}/pin`,
  TRENDING: `${BASE_URL}/api/tiwi/explore/trending`,

  // Stories
  STORIES: `${BASE_URL}/api/tiwi/stories`,

  // Reels / Shorts
  REELS: `${BASE_URL}/api/tiwi/reels`,
  LIKE_REEL: (id) => `${BASE_URL}/api/tiwi/reels/${id}/like`,
  CREATE_REEL: `${BASE_URL}/api/tiwi/reels`,
  DELETE_REEL: (id) => `${BASE_URL}/api/tiwi/reels/${id}`,
  REEL_NOT_INTERESTED: (id) => `${BASE_URL}/api/tiwi/reels/${id}/not-interested`,
  REPORT_REEL: (id) => `${BASE_URL}/api/tiwi/reels/${id}/report`,

  // Notifications
  NOTIFICATIONS: `${BASE_URL}/api/tiwi/notifications`,
  READ_NOTIFICATION: (id) => `${BASE_URL}/api/tiwi/notifications/${id}/read`,
  READ_ALL_NOTIFICATIONS: `${BASE_URL}/api/tiwi/notifications/read-all`,

  // Messages & Conversations
  CONVERSATIONS: `${BASE_URL}/api/tiwi/conversations`,
  MESSAGES: (id) => `${BASE_URL}/api/tiwi/conversations/${id}/messages`,

  // Profiles & Users
  PROFILE: (handleOrId) => `${BASE_URL}/api/tiwi/profile/${handleOrId}`,
  UPDATE_PROFILE: `${BASE_URL}/api/tiwi/profile`,
  SETTINGS_PRIVACY: `${BASE_URL}/api/tiwi/settings/privacy`,
  SETTINGS_ADVANCED: `${BASE_URL}/api/tiwi/settings/advanced`,
  CHANGE_PASSWORD: `${BASE_URL}/api/tiwi/change-password`,
  FOLLOW_USER: (id) => `${BASE_URL}/api/tiwi/users/${id}/follow`,
  FOLLOW_REQUESTS: `${BASE_URL}/api/tiwi/follow-requests`,
  RESPOND_FOLLOW_REQUEST: (id) => `${BASE_URL}/api/tiwi/follow-requests/${encodeURIComponent(id)}/respond`,
  USER_FOLLOWERS: (id) => `${BASE_URL}/api/tiwi/users/${encodeURIComponent(id)}/followers`,
  USER_FOLLOWING: (id) => `${BASE_URL}/api/tiwi/users/${encodeURIComponent(id)}/following`,
  USERS: `${BASE_URL}/api/tiwi/users`,
  SEARCH: (q) => `${BASE_URL}/api/tiwi/search?q=${encodeURIComponent(q)}`,

  // Live Audio Spaces
  AUDIO_SPACES: `${BASE_URL}/api/social/audio-spaces`,
  JOIN_AUDIO_SPACE: (id) => `${BASE_URL}/api/social/audio-spaces/${encodeURIComponent(id)}/join`,
  LEAVE_AUDIO_SPACE: (id) => `${BASE_URL}/api/social/audio-spaces/${encodeURIComponent(id)}/leave`,

  // Upload
  UPLOAD: `${BASE_URL}/api/tiwi/upload`,

  // Real-Time Messenger & WebRTC Calling Endpoints
  CHAT_CONVERSATIONS: `${BASE_URL}/api/tiwi/chat/conversations`,
  CHAT_CONVERSATION: (id) => `${BASE_URL}/api/tiwi/chat/conversations/${id}`,
  CHAT_SETTINGS: (id) => `${BASE_URL}/api/tiwi/chat/conversations/${id}/settings`,
  CHAT_MESSAGES: (id) => `${BASE_URL}/api/tiwi/chat/conversations/${id}/messages`,
  CHAT_UNSEND_MESSAGE: (id) => `${BASE_URL}/api/tiwi/chat/messages/${id}/unsend`,
  CHAT_EDIT_MESSAGE: (id) => `${BASE_URL}/api/tiwi/chat/messages/${id}/edit`,
  CHAT_REACT_MESSAGE: (id) => `${BASE_URL}/api/tiwi/chat/messages/${id}/react`,
  CHAT_SEEN: (id) => `${BASE_URL}/api/tiwi/chat/conversations/${id}/seen`,
  CHAT_MEMBERS: (id) => `${BASE_URL}/api/tiwi/chat/conversations/${id}/members`,
  CHAT_MEMBER_ROLE: (id, targetUserId) => `${BASE_URL}/api/tiwi/chat/conversations/${id}/members/${targetUserId}/role`,
  CHAT_REMOVE_MEMBER: (id, targetUserId) => `${BASE_URL}/api/tiwi/chat/conversations/${id}/members/${targetUserId}`,
  CALL_INITIATE: `${BASE_URL}/api/tiwi/chat/calls/initiate`,
  CALL_SIGNAL: (id) => `${BASE_URL}/api/tiwi/chat/calls/${id}/signal`,
  CALL_END: (id) => `${BASE_URL}/api/tiwi/chat/calls/${id}/end`,
  CALL_HISTORY: `${BASE_URL}/api/tiwi/chat/calls/history`,
  USER_PRESENCE: `${BASE_URL}/api/tiwi/chat/presence`,
  GET_PRESENCE: (userId) => `${BASE_URL}/api/tiwi/chat/presence/${userId}`,
  GRAPHQL: `${BASE_URL}/graphql`,
};

export const getAuthHeaders = (userId = null, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };
  let sessionToken = token || activeAuthToken;
  if (typeof sessionToken === 'object' && sessionToken !== null) {
    sessionToken = sessionToken.sessionToken || sessionToken.token || null;
  }
  if (typeof sessionToken === 'string' && sessionToken.trim() && sessionToken !== '[object Object]') {
    headers['Authorization'] = `Bearer ${sessionToken.trim()}`;
  }
  const effectiveUserId = userId || activeUserId;
  if (effectiveUserId && effectiveUserId !== 'anonymous') {
    headers['x-user-id'] = String(effectiveUserId);
  }
  return headers;
};
