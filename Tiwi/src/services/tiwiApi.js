/**
 * Tiwi Social Media App - Centralized API Service
 * Handles all network requests to Tiwlo Server with robust error handling
 */

import { BASE_URL, ENDPOINTS, getAuthHeaders } from '../config/api';
import { getScreenDataCache, setScreenDataCache } from '../utils/screenDataCache';

const feedCacheKey = (userId, filter) => `feed:${userId || 'guest'}:${filter}`;
const profilePostsCacheKey = (targetUserId, viewerId) =>
  `profile-posts:${viewerId || targetUserId}:${targetUserId}`;
const conversationsCacheKey = (userId, archived) => `conversations:${userId}:${archived}`;
const chatMessagesCacheKey = (userId, conversationId) => `chat-messages:${userId || 'guest'}:${conversationId}`;

/**
 * Native React Native XMLHttpRequest uploader.
 * Bypasses WinterCG fetch limitations for FormDataPart { uri, name, type }
 */
const uploadWithXHR = (url, formData, headers = {}) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.timeout = 120000;

    if (headers && typeof headers === 'object') {
      Object.keys(headers).forEach((key) => {
        if (key.toLowerCase() !== 'content-type') {
          xhr.setRequestHeader(key, headers[key]);
        }
      });
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const json = JSON.parse(xhr.responseText);
          resolve(json);
        } catch (e) {
          resolve({ url: xhr.responseText });
        }
      } else {
        let errMsg = `Upload failed with status ${xhr.status}`;
        try {
          const json = JSON.parse(xhr.responseText);
          errMsg = json.message || json.reason || json.error || errMsg;
        } catch (e) {}
        reject(new Error(errMsg));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during media upload. Check server connection.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out. File might be too large.'));
    };

    xhr.send(formData);
  });
};

export const TiwiAPI = {
  // 1. Feed & Posts
  async getFeed(userId = null, filter = 'for_you') {
    const cacheKey = feedCacheKey(userId, filter);
    try {
      const url = typeof ENDPOINTS.FEED === 'function' ? ENDPOINTS.FEED(filter) : ENDPOINTS.FEED;
      const res = await fetch(url, {
        headers: getAuthHeaders(userId),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Message send failed (${res.status})`);
      if (Array.isArray(data)) {
        setScreenDataCache(cacheKey, data.slice(0, 60));
      }
      return data;
    } catch (err) {
      console.warn('[TiwiAPI.getFeed]', err.message);
      return (await getScreenDataCache(cacheKey)) || [];
    }
  },

  async createDirectChat(recipientId, userId = null) {
    const res = await fetch(ENDPOINTS.CHAT_CONVERSATIONS, {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ type: 'direct', memberIds: [recipientId] }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Could not start conversation (${res.status})`);
    return data;
  },

  async getUserPosts(targetUserId, currentUserId = null) {
    if (!targetUserId) return [];
    const cacheKey = profilePostsCacheKey(targetUserId, currentUserId);
    try {
      const url = typeof ENDPOINTS.USER_POSTS === 'function'
        ? ENDPOINTS.USER_POSTS(targetUserId)
        : `${ENDPOINTS.POSTS}?userId=${encodeURIComponent(targetUserId)}`;
      const res = await fetch(url, {
        headers: getAuthHeaders(currentUserId || targetUserId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setScreenDataCache(cacheKey, data.slice(0, 60));
      }
      return data;
    } catch (err) {
      console.warn('[TiwiAPI.getUserPosts]', err.message);
      return (await getScreenDataCache(cacheKey)) || [];
    }
  },

  async createPost({ caption, image = null, images = [], userId = null }) {
    try {
      const finalImages = Array.isArray(images) && images.length > 0 ? images : (image ? [image] : []);
      const body = { caption, images: finalImages };
      const res = await fetch(ENDPOINTS.POSTS, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || errJson.reason || errJson.error || `Post failed with status ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.createPost]', err);
      throw err;
    }
  },

  async toggleLikePost(postId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.LIKE_POST(postId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.toggleLikePost]', err.message);
      return null;
    }
  },

  async recordPostView(postId, userId = null) {
    const res = await fetch(ENDPOINTS.VIEW_POST(postId), {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Could not record video view (${res.status})`);
    return data;
  },

  async toggleBookmarkPost(postId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.SAVE_POST(postId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.toggleBookmarkPost]', err.message);
      return null;
    }
  },

  async toggleRepost(postId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.REPOST_POST(postId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.toggleRepost]', err.message);
      return null;
    }
  },

  async addComment(postId, text, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.COMMENT_POST(postId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.addComment]', err);
      throw err;
    }
  },

  async deletePost(postId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.DELETE_POST(postId), {
        method: 'DELETE',
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to delete post (${res.status})`);
      }
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.deletePost]', err);
      throw err;
    }
  },

  async editPost(postId, caption, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.EDIT_POST(postId), {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ caption }),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Failed to edit post (${res.status})`);
      }
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.editPost]', err);
      throw err;
    }
  },

  async pinPost(postId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.PIN_POST(postId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.pinPost]', err);
      throw err;
    }
  },

  async getTrending() {
    try {
      const res = await fetch(ENDPOINTS.TRENDING);
      if (!res.ok) return [];
      return await res.json();
    } catch (err) {
      return [];
    }
  },

  // 2. Stories
  async getStories(userId = null) {
    try {
      const res = await fetch(ENDPOINTS.STORIES, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getStories]', err.message);
      return [];
    }
  },

  async createStory(mediaUrl, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.STORIES, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ mediaUrl }),
      });
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.createStory]', err);
      throw err;
    }
  },

  // 3. Reels & YouTube Shorts
  async getReels(userId = null) {
    const cacheKey = `reels:${userId || 'guest'}`;
    try {
      const res = await fetch(ENDPOINTS.REELS, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setScreenDataCache(cacheKey, data.slice(0, 30));
      }
      return data;
    } catch (err) {
      console.warn('[TiwiAPI.getReels]', err.message);
      return (await getScreenDataCache(cacheKey)) || [];
    }
  },

  async createReel({ caption, videoUrl, image = null, audioTitle = 'Original sound', userId = null }) {
    try {
      const body = { caption, videoUrl, image, audioTitle };
      const res = await fetch(ENDPOINTS.CREATE_REEL, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.createReel]', err);
      throw err;
    }
  },

  async toggleLikeReel(reelId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.LIKE_REEL(reelId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.toggleLikeReel]', err.message);
      return null;
    }
  },

  async deleteReel(reelId, userId = null) {
    const res = await fetch(ENDPOINTS.DELETE_REEL(reelId), { method: 'DELETE', headers: getAuthHeaders(userId) });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Failed to delete Short (${res.status})`);
    }
    return res.json();
  },

  async markReelNotInterested(reelId, userId = null) {
    const res = await fetch(ENDPOINTS.REEL_NOT_INTERESTED(reelId), { method: 'POST', headers: getAuthHeaders(userId) });
    if (!res.ok) throw new Error(`Failed to save feedback (${res.status})`);
    return res.json();
  },

  async reportReel(reelId, reason = 'inappropriate', userId = null) {
    const res = await fetch(ENDPOINTS.REPORT_REEL(reelId), {
      method: 'POST', headers: getAuthHeaders(userId), body: JSON.stringify({ reason }),
    });
    if (!res.ok) throw new Error(`Failed to submit report (${res.status})`);
    return res.json();
  },

  // 3. Notifications
  async getNotifications(userId = null) {
    try {
      const res = await fetch(ENDPOINTS.NOTIFICATIONS, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getNotifications]', err.message);
      return [];
    }
  },

  async markNotificationRead(notifId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.READ_NOTIFICATION(notifId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.markNotificationRead]', err.message);
      return null;
    }
  },

  async markAllNotificationsRead(userId = null) {
    try {
      const res = await fetch(ENDPOINTS.READ_ALL_NOTIFICATIONS, {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.markAllNotificationsRead]', err.message);
      return null;
    }
  },

  // 4. Messages & Conversations
  async getConversations(userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CONVERSATIONS, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getConversations]', err.message);
      return [];
    }
  },

  async getMessages(conversationId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.MESSAGES(conversationId), {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getMessages]', err.message);
      return [];
    }
  },

  async sendMessage(conversationId, text, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.MESSAGES(conversationId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.sendMessage]', err);
      throw err;
    }
  },

  // =========================================================================
  // REAL-TIME MESSENGER & WEBRTC CALLING METHODS
  // =========================================================================
  async getChatConversations(userId, archived = false) {
    const cacheKey = conversationsCacheKey(userId, archived);
    try {
      const url = `${ENDPOINTS.CHAT_CONVERSATIONS}?archived=${archived}`;
      const res = await fetch(url, { headers: getAuthHeaders(userId) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setScreenDataCache(cacheKey, data);
      }
      return data;
    } catch (err) {
      console.warn('[TiwiAPI.getChatConversations]', err.message);
      return (await getScreenDataCache(cacheKey)) || [];
    }
  },

  async createGroupChat(title, memberIds, avatar = '', userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_CONVERSATIONS, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ type: 'group', title, avatar, memberIds }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.createGroupChat]', err.message);
      throw err;
    }
  },

  async getChatConversation(conversationId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_CONVERSATION(conversationId), {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getChatConversation]', err.message);
      return null;
    }
  },

  async updateChatSettings(conversationId, settings, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_SETTINGS(conversationId), {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.updateChatSettings]', err.message);
      return null;
    }
  },

  async getChatMessages(conversationId, userId = null, { before = null, beforeId = null, since = null, limit = 50 } = {}) {
    const cacheKey = chatMessagesCacheKey(userId, conversationId);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (before) params.set('before', before);
      if (beforeId) params.set('beforeId', beforeId);
      if (since) params.set('since', since);
      const res = await fetch(`${ENDPOINTS.CHAT_MESSAGES(conversationId)}?${params.toString()}`, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const cachedMessages = (await getScreenDataCache(cacheKey)) || [];
        const merged = new Map(cachedMessages.map((message) => [message.id, message]));
        data.forEach((message) => merged.set(message.id, message));
        const sortedMessages = Array.from(merged.values())
          .sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
          .slice(-100);
        setScreenDataCache(cacheKey, sortedMessages);
      }
      return data;
    } catch (err) {
      console.warn('[TiwiAPI.getChatMessages]', err.message);
      if (!before && !since) return (await getScreenDataCache(cacheKey)) || [];
      throw err;
    }
  },

  async getAllChatMessages(conversationId, userId = null) {
    const messages = [];
    let before = null;
    let beforeId = null;
    while (true) {
      const page = await TiwiAPI.getChatMessages(conversationId, userId, {
        before,
        beforeId,
        limit: 100,
      });
      if (!Array.isArray(page)) throw new Error('Invalid chat message response');
      messages.unshift(...page);
      if (page.length < 100) return messages;
      before = page[0].created_at;
      beforeId = page[0].id;
    }
  },

  async sendChatMessage(conversationId, { content, messageType = 'text', mediaUrl = null, replyToId = null }, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_MESSAGES(conversationId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ content, messageType, mediaUrl, replyToId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.sendChatMessage]', err.message);
      throw err;
    }
  },

  async unsendChatMessage(messageId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_UNSEND_MESSAGE(messageId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.unsendChatMessage]', err.message);
      return { success: false };
    }
  },

  async editChatMessage(messageId, content, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_EDIT_MESSAGE(messageId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ content }),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.editChatMessage]', err.message);
      return { success: false };
    }
  },

  async reactToChatMessage(messageId, reaction, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_REACT_MESSAGE(messageId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ reaction }),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.reactToChatMessage]', err.message);
      return { success: false };
    }
  },

  async markChatSeen(conversationId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_SEEN(conversationId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.markChatSeen]', err.message);
      return { success: false };
    }
  },

  async getGroupMembers(conversationId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_MEMBERS(conversationId), {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getGroupMembers]', err.message);
      return [];
    }
  },

  async addGroupMember(conversationId, targetUserId, role = 'member', requesterId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_MEMBERS(conversationId), {
        method: 'POST',
        headers: getAuthHeaders(requesterId),
        body: JSON.stringify({ userId: targetUserId, role }),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.addGroupMember]', err.message);
      return { success: false };
    }
  },

  async updateMemberRole(conversationId, targetUserId, role, requesterId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_MEMBER_ROLE(conversationId, targetUserId), {
        method: 'PUT',
        headers: getAuthHeaders(requesterId),
        body: JSON.stringify({ role }),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.updateMemberRole]', err.message);
      return { success: false };
    }
  },

  async removeGroupMember(conversationId, targetUserId, requesterId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHAT_REMOVE_MEMBER(conversationId, targetUserId), {
        method: 'DELETE',
        headers: getAuthHeaders(requesterId),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.removeGroupMember]', err.message);
      return { success: false };
    }
  },

  // WebRTC Signaling
  async initiateCall(conversationId, receiverId, callType = 'video', callerId = null) {
    try {
      const res = await fetch(ENDPOINTS.CALL_INITIATE, {
        method: 'POST',
        headers: getAuthHeaders(callerId),
        body: JSON.stringify({ conversationId, receiverId, callType }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.initiateCall]', err.message);
      throw err;
    }
  },

  async signalCall(callId, { sdpOffer, sdpAnswer, iceCandidate, status }) {
    try {
      const res = await fetch(ENDPOINTS.CALL_SIGNAL(callId), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ sdpOffer, sdpAnswer, iceCandidate, status }),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.signalCall]', err.message);
      return null;
    }
  },

  async getCallSignal(callId) {
    try {
      const res = await fetch(ENDPOINTS.CALL_SIGNAL(callId));
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      return null;
    }
  },

  async endCall(callId, durationSeconds = 0) {
    try {
      const res = await fetch(ENDPOINTS.CALL_END(callId), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ durationSeconds }),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.endCall]', err.message);
      return null;
    }
  },

  async getCallHistory(userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CALL_HISTORY, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getCallHistory]', err.message);
      return [];
    }
  },

  async updatePresence(isOnline = true, customStatus = '', userId = null) {
    try {
      await fetch(ENDPOINTS.USER_PRESENCE, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ isOnline, customStatus }),
      });
    } catch (err) {
      console.warn('[TiwiAPI.updatePresence]', err.message);
    }
  },

  async getPresence(targetUserId) {
    try {
      const res = await fetch(ENDPOINTS.GET_PRESENCE(targetUserId));
      if (!res.ok) return { is_online: false, last_active_at: null };
      return await res.json();
    } catch (err) {
      return { is_online: false, last_active_at: null };
    }
  },

  // 5. Profiles & Settings
  async getProfile(handleOrId, currentUserId = null) {
    if (!handleOrId) return null;
    try {
      const res = await fetch(ENDPOINTS.PROFILE(handleOrId), {
        headers: getAuthHeaders(currentUserId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getProfile]', err.message);
      return null;
    }
  },

  async updateProfile(fields, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.UPDATE_PROFILE, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.updateProfile]', err);
      throw err;
    }
  },

  async updatePrivacySettings(settings, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.SETTINGS_PRIVACY, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.updatePrivacySettings]', err);
      throw err;
    }
  },

  async updateAdvancedSettings(settings, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.SETTINGS_ADVANCED, {
        method: 'PUT',
        headers: getAuthHeaders(userId),
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[TiwiAPI.updateAdvancedSettings]', err);
      throw err;
    }
  },

  async changePassword(oldPassword, newPassword, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.CHANGE_PASSWORD, {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      return data;
    } catch (err) {
      console.error('[TiwiAPI.changePassword]', err);
      throw err;
    }
  },

  async toggleFollow(targetUserId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.FOLLOW_USER(targetUserId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Follow update failed (${res.status})`);
      return data;
    } catch (err) {
      console.warn('[TiwiAPI.toggleFollow]', err.message);
      throw err;
    }
  },

  async getFollowRequests(userId = null) {
    const res = await fetch(ENDPOINTS.FOLLOW_REQUESTS, {
      headers: getAuthHeaders(userId),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Could not load follow requests (${res.status})`);
    return Array.isArray(data) ? data : [];
  },

  async respondToFollowRequest(requestId, decision, userId = null) {
    const res = await fetch(ENDPOINTS.RESPOND_FOLLOW_REQUEST(requestId), {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ decision }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Could not update follow request (${res.status})`);
    return data;
  },

  async getUserFollowers(targetUserId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.USER_FOLLOWERS(targetUserId), {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.followers) ? data.followers : [];
    } catch (err) {
      console.warn('[TiwiAPI.getUserFollowers]', err.message);
      return [];
    }
  },

  async getUserFollowing(targetUserId, userId = null) {
    try {
      const res = await fetch(ENDPOINTS.USER_FOLLOWING(targetUserId), {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.following) ? data.following : [];
    } catch (err) {
      console.warn('[TiwiAPI.getUserFollowing]', err.message);
      return [];
    }
  },

  async getAudioSpaces() {
    try {
      const res = await fetch(ENDPOINTS.AUDIO_SPACES);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.spaces) ? data.spaces : [];
    } catch (err) {
      console.warn('[TiwiAPI.getAudioSpaces]', err.message);
      return [];
    }
  },

  async joinAudioSpace(spaceId, { userId, username, name, avatar }) {
    try {
      const res = await fetch(ENDPOINTS.JOIN_AUDIO_SPACE(spaceId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ userId, username, name, avatar }),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.joinAudioSpace]', err.message);
      return null;
    }
  },

  async leaveAudioSpace(spaceId, userId) {
    try {
      const res = await fetch(ENDPOINTS.LEAVE_AUDIO_SPACE(spaceId), {
        method: 'POST',
        headers: getAuthHeaders(userId),
        body: JSON.stringify({ userId }),
      });
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.leaveAudioSpace]', err.message);
      return null;
    }
  },

  // 6. Media Upload (Cover photo, Profile picture, Posts, Videos) - Supports Multi-Tier Resilient Ingestion
  async uploadMedia(uri, type = 'posts', base64 = null, userId = null, fileMeta = {}) {
    try {
      const authHeaders = getAuthHeaders(userId);
      const isVideo = fileMeta?.mediaType === 'video' || /\.(mp4|mov|webm|mkv|m4v|avi)(\?|$)/i.test(fileMeta?.fileName || uri) || fileMeta?.mimeType?.startsWith('video/');
      const uploadFolder = isVideo && type === 'posts' ? 'reels' : type;
      const uploadUrl = `${ENDPOINTS.UPLOAD}?type=${encodeURIComponent(uploadFolder)}`;

      // 1. Direct Base64 string / Data URI payload (Images only)
      if ((base64 || uri?.startsWith('data:image')) && !isVideo) {
        try {
          const payload = {
            base64: base64 || uri,
            type: uploadFolder,
          };
          const res = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            const data = await res.json();
            const relativeOrFull = data.url;
            return relativeOrFull?.startsWith('http')
              ? relativeOrFull
              : `${BASE_URL}${relativeOrFull}`;
          }
        } catch (b64Err) {
          console.warn('[TiwiAPI.uploadMedia] Direct Base64 upload attempt failed:', b64Err.message);
        }
      }

      // Metadata normalization
      let filename = fileMeta?.fileName || uri.split('/').pop() || (isVideo ? `video_${Date.now()}.mp4` : `upload_${Date.now()}.jpg`);
      if (isVideo && !/\.(mp4|mov|webm|mkv|m4v|avi)(\?|$)/i.test(filename)) {
        filename = `${filename}.mp4`;
      }

      let mimeType = fileMeta?.mimeType;
      if (!mimeType) {
        const match = /\.(\w+)$/.exec(filename);
        const ext = match ? match[1].toLowerCase() : (isVideo ? 'mp4' : 'jpg');
        if (ext === 'mp4' || ext === 'm4v') mimeType = 'video/mp4';
        else if (ext === 'mov') mimeType = 'video/quicktime';
        else if (ext === 'webm') mimeType = 'video/webm';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (ext === 'gif') mimeType = 'image/gif';
        else mimeType = 'image/jpeg';
      }

      const formHeaders = {
        ...authHeaders,
        'Accept': 'application/json',
      };
      // uploadWithXHR deliberately omits Content-Type so React Native supplies
      // the multipart boundary; the bearer token remains attached.
      delete formHeaders['Content-Type'];

      // 2. Tier 2: React Native Native XMLHttpRequest (handles { uri, name, type } FormData natively)
      try {
        const formData = new FormData();
        formData.append('file', {
          uri,
          name: filename,
          type: mimeType,
        });

        const data = await uploadWithXHR(uploadUrl, formData, formHeaders);
        const relativeOrFull = data?.url;
        if (relativeOrFull) {
          return relativeOrFull.startsWith('http')
            ? relativeOrFull
            : `${BASE_URL}${relativeOrFull}`;
        }
      } catch (xhrErr) {
        console.warn('[TiwiAPI.uploadMedia] Native XHR upload failed, trying Blob:', xhrErr.message);
      }

      // 3. Tier 3: Fetch Blob conversion fallback (WinterCG compliant)
      try {
        const fileResponse = await fetch(uri);
        const blob = await fileResponse.blob();
        const formData = new FormData();
        formData.append('file', blob, filename);

        const res = await fetch(uploadUrl, {
          method: 'POST',
          headers: formHeaders,
          body: formData,
        });
        if (res.ok) {
          const data = await res.json();
          const relativeOrFull = data.url;
          return relativeOrFull?.startsWith('http')
            ? relativeOrFull
            : `${BASE_URL}${relativeOrFull}`;
        }
      } catch (blobErr) {
        console.warn('[TiwiAPI.uploadMedia] Blob upload failed:', blobErr.message);
      }

      // 4. Tier 4: FileReader to Base64 JSON fallback for images
      if (!isVideo) {
        try {
          const fileResponse = await fetch(uri);
          const blob = await fileResponse.blob();
          const base64Str = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          if (base64Str) {
            const res = await fetch(uploadUrl, {
              method: 'POST',
              headers: {
                ...authHeaders,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ base64: base64Str, type: uploadFolder }),
            });
            if (res.ok) {
              const data = await res.json();
              const relativeOrFull = data.url;
              return relativeOrFull?.startsWith('http')
                ? relativeOrFull
                : `${BASE_URL}${relativeOrFull}`;
            }
          }
        } catch (base64FallbackErr) {
          console.warn('[TiwiAPI.uploadMedia] FileReader Base64 fallback failed:', base64FallbackErr.message);
        }
      }

      throw new Error('Unable to upload media. Please try again.');
    } catch (err) {
      console.error('[TiwiAPI.uploadMedia]', err);
      throw err;
    }
  },

  // 7. Auth (Unified with Tiwlo Master Platform + 2FA + Blocking Flow)
  async checkAvailability({ email = '', handle = '', userId = null }) {
    try {
      const params = new URLSearchParams();
      if (email) params.append('email', email.trim());
      if (handle) params.append('handle', handle.trim());
      if (userId) params.append('userId', userId);

      const res = await fetch(`${ENDPOINTS.CHECK_AVAILABILITY}?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.checkAvailability]', err.message);
      // Do not treat an unavailable check as proof that a name is free.
      return {
        available: false,
        emailAvailable: false,
        handleAvailable: false,
        emailError: 'Could not check availability. Check your connection and try again.',
        handleError: 'Could not check availability. Check your connection and try again.',
      };
    }
  },

  async login(emailOrPhone, password) {
    const res = await fetch(ENDPOINTS.LOGIN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: emailOrPhone, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async verify2FA(tempToken, otpCode) {
    const res = await fetch(ENDPOINTS.VERIFY_2FA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, otpCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Two-Step verification failed');
    return data;
  },

  async resend2FA(tempToken) {
    const res = await fetch(ENDPOINTS.RESEND_2FA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend 2FA code');
    return data;
  },

  async register({ name, email, handle, password, accountType = 'personal', birthday = '', gender = '', phone = '', billingAddress = null }) {
    const res = await fetch(ENDPOINTS.REGISTER, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, handle, password, accountType, birthday, gender, phone, billingAddress }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async verifyEmail(tempToken, otpCode) {
    const res = await fetch(ENDPOINTS.VERIFY_EMAIL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, otpCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Email verification failed');
    return data;
  },

  async resendEmailVerification(tempToken) {
    const res = await fetch(ENDPOINTS.RESEND_EMAIL_VERIFICATION, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend email verification code');
    return data;
  },

  async setup2FA(tempToken, otpCode) {
    const res = await fetch(ENDPOINTS.SETUP_2FA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken, otpCode }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to set up 2-Step Verification');
    return data;
  },

  async resendSetup2FA(tempToken) {
    const res = await fetch(ENDPOINTS.RESEND_SETUP_2FA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tempToken }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to resend confirmation code');
    return data;
  },

  async search(query, currentUserId = null) {
    try {
      const res = await fetch(ENDPOINTS.SEARCH(query), {
        headers: getAuthHeaders(currentUserId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.search]', err.message);
      return { users: [], posts: [] };
    }
  },

  async forgotPassword(emailOrPhone) {
    const res = await fetch(ENDPOINTS.FORGOT_PASSWORD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: emailOrPhone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password recovery request failed');
    return { ...data, tempToken: data.resetToken };
  },

  async verifyResetCode(tempToken, code) {
    const res = await fetch(ENDPOINTS.VERIFY_RESET_CODE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken: tempToken, otpCode: code }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Invalid code');
    return data;
  },

  async resetPassword(resetToken, newPassword) {
    const res = await fetch(ENDPOINTS.RESET_PASSWORD, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetToken, newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password reset failed');
    return data;
  },

  async submitAppeal(identifier, appealReason) {
    const res = await fetch(ENDPOINTS.APPEAL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, appealReason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Appeal submission failed');
    return data;
  },

  async getMe(userId = null) {
    if (!userId) return null;
    try {
      const res = await fetch(ENDPOINTS.ME, {
        headers: getAuthHeaders(userId),
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (data.error === 'ACCOUNT_DISABLED' || data.isBanned) {
          if (accountDisabledListener) {
            accountDisabledListener(data);
          }
          return { isBanned: true, ...data };
        }
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (err) {
      console.warn('[TiwiAPI.getMe]', err.message);
      return null;
    }
  },
};

let accountDisabledListener = null;

export const setAccountDisabledListener = (listener) => {
  accountDisabledListener = listener;
};
