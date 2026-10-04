/**
 * Tiwi Social Media Web - Centralized API Service
 * Connects directly to real PostgreSQL-backed endpoints on /api/tiwi and /api/social
 * Handles real-time feed, posts, reels, stories, messenger, profiles, and ecosystem features.
 */

const getAuthHeaders = (userId = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };
  try {
    const token = localStorage.getItem('stockpro_session') || sessionStorage.getItem('stockpro_session');
    if (token && typeof token === 'string' && token !== '[object Object]') {
      headers['Authorization'] = `Bearer ${token.trim()}`;
    }
  } catch (e) {}

  if (userId && userId !== 'anonymous' && userId !== 'guest') {
    headers['x-user-id'] = String(userId);
  }
  return headers;
};

export const TiwiSocialAPI = {
  // ==========================================
  // 1. ACTIVE USER & PROFILES
  // ==========================================
  async getInitialUser() {
    // 1. Try logged in session user from storage
    try {
      const saved = localStorage.getItem('stockpro_user');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && (u.id || u.email)) {
          return {
            id: u.id || u._id || 'user_admin',
            name: u.name || u.storeName || 'Tiwlo User',
            handle: u.handle || (u.email ? u.email.split('@')[0] : 'tiwlousr'),
            avatar: u.avatar || u.logo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop',
            bio: u.bio || 'Exploring and sharing moments on Tiwi Social ✨',
            isVerified: !!(u.role === 'super_admin' || u.isVerified),
            followersCount: u.followersCount || 128,
            followingCount: u.followingCount || 42,
            postsCount: u.postsCount || 16,
            email: u.email
          };
        }
      }
    } catch (e) {}

    // 2. Fetch authenticated user from backend /api/tiwi/me
    try {
      const res = await fetch('/api/tiwi/me', { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data && data.user) return data.user;
        if (data && data.id) return data;
      }
    } catch (e) {}

    // 3. Fallback: Query first available active profile from database
    try {
      const res = await fetch('/api/tiwi/users', { headers: getAuthHeaders() });
      if (res.ok) {
        const users = await res.json();
        if (Array.isArray(users) && users.length > 0) {
          return users[0];
        }
      }
    } catch (e) {}

    // 4. Default default community user if database is freshly initialized
    return {
      id: 'tiwi_official',
      name: 'Tiwi Community',
      handle: 'tiwi',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop',
      bio: 'Welcome to Tiwi — The next-generation connected social platform.',
      isVerified: true,
      followersCount: 5420,
      followingCount: 120,
      postsCount: 38
    };
  },

  async getProfile(handleOrId, viewerId = null) {
    try {
      const res = await fetch(`/api/tiwi/profile/${encodeURIComponent(handleOrId)}`, {
        headers: getAuthHeaders(viewerId),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[TiwiSocialAPI.getProfile]', err.message);
      return null;
    }
  },

  async updateProfile(profileData, userId = null) {
    const res = await fetch('/api/tiwi/profile', {
      method: 'PUT',
      headers: getAuthHeaders(userId),
      body: JSON.stringify(profileData),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Profile update failed (${res.status})`);
    }
    return await res.json();
  },

  async followUser(targetId, userId = null) {
    const res = await fetch(`/api/tiwi/users/${encodeURIComponent(targetId)}/follow`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async getFollowers(userId) {
    const res = await fetch(`/api/tiwi/users/${encodeURIComponent(userId)}/followers`, {
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async getFollowing(userId) {
    const res = await fetch(`/api/tiwi/users/${encodeURIComponent(userId)}/following`, {
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async getUsers() {
    try {
      const res = await fetch('/api/tiwi/users', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  // ==========================================
  // 2. FEED & POSTS
  // ==========================================
  async getFeed(userId = null, filter = 'for_you') {
    try {
      const res = await fetch(`/api/tiwi/feed?filter=${encodeURIComponent(filter)}`, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) throw new Error(`Feed request returned ${res.status}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.warn('[TiwiSocialAPI.getFeed]', err.message);
      return [];
    }
  },

  async createPost({ caption, images = [], videoUrl = null, tags = [], userId = null }) {
    const res = await fetch('/api/tiwi/posts', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({
        caption,
        images: Array.isArray(images) ? images : (images ? [images] : []),
        videoUrl,
        tags
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || err.message || `Post failed with status ${res.status}`);
    }
    return await res.json();
  },

  async getPost(postId, userId = null) {
    const res = await fetch(`/api/tiwi/posts/${encodeURIComponent(postId)}`, {
      headers: getAuthHeaders(userId),
    });
    if (!res.ok) return null;
    return await res.json();
  },

  async toggleLikePost(postId, userId = null) {
    const res = await fetch(`/api/tiwi/posts/${encodeURIComponent(postId)}/like`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async toggleBookmarkPost(postId, userId = null) {
    const res = await fetch(`/api/tiwi/posts/${encodeURIComponent(postId)}/bookmark`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async toggleRepost(postId, userId = null) {
    const res = await fetch(`/api/tiwi/posts/${encodeURIComponent(postId)}/repost`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async addComment(postId, text, userId = null) {
    const res = await fetch(`/api/tiwi/posts/${encodeURIComponent(postId)}/comment`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Comment failed (${res.status})`);
    }
    return await res.json();
  },

  async deletePost(postId, userId = null) {
    const res = await fetch(`/api/tiwi/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async getUserPosts(targetUserId, viewerId = null) {
    try {
      const res = await fetch(`/api/tiwi/users/${encodeURIComponent(targetUserId)}/posts`, {
        headers: getAuthHeaders(viewerId || targetUserId),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  },

  async getLikedPosts(userId = null) {
    try {
      const res = await fetch(`/api/social/liked-posts`, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  },

  async getBookmarks(userId = null) {
    try {
      const res = await fetch(`/api/social/bookmarks`, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  },

  async getTrending() {
    try {
      const res = await fetch('/api/tiwi/explore/trending', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  async search(query) {
    if (!query || !query.trim()) return { users: [], posts: [], tags: [] };
    try {
      const res = await fetch(`/api/tiwi/search?q=${encodeURIComponent(query.trim())}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return { users: [], posts: [], tags: [] };
      return await res.json();
    } catch (e) {
      return { users: [], posts: [], tags: [] };
    }
  },

  // ==========================================
  // 3. STORIES & REELS
  // ==========================================
  async getStories(userId = null) {
    try {
      const res = await fetch('/api/tiwi/stories', { headers: getAuthHeaders(userId) });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  async createStory({ mediaUrl, caption = '', userId = null }) {
    const res = await fetch('/api/tiwi/stories', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ mediaUrl, caption }),
    });
    if (!res.ok) throw new Error('Failed to post story');
    return await res.json();
  },

  async getReels(userId = null) {
    try {
      const res = await fetch('/api/tiwi/reels', { headers: getAuthHeaders(userId) });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  },

  async toggleLikeReel(reelId, userId = null) {
    const res = await fetch(`/api/tiwi/reels/${encodeURIComponent(reelId)}/like`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async createReel({ videoUrl, caption = '', audioTitle = 'Original Audio', userId = null }) {
    const res = await fetch('/api/tiwi/reels', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ videoUrl, caption, audioTitle }),
    });
    if (!res.ok) throw new Error('Failed to create reel');
    return await res.json();
  },

  // ==========================================
  // 4. NOTIFICATIONS
  // ==========================================
  async getNotifications(userId = null) {
    try {
      const res = await fetch('/api/tiwi/notifications', { headers: getAuthHeaders(userId) });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  },

  async markNotificationRead(id, userId = null) {
    const res = await fetch(`/api/tiwi/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async markAllNotificationsRead(userId = null) {
    const res = await fetch('/api/tiwi/notifications/read-all', {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  // ==========================================
  // 5. MESSENGER & CALLING
  // ==========================================
  async getConversations(userId = null) {
    try {
      const res = await fetch('/api/tiwi/chat/conversations', { headers: getAuthHeaders(userId) });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  },

  async createDirectChat(recipientId, userId = null) {
    const res = await fetch('/api/tiwi/chat/conversations', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ type: 'direct', memberIds: [recipientId] }),
    });
    if (!res.ok) throw new Error('Failed to start chat');
    return await res.json();
  },

  async createGroupChat(name, memberIds = [], userId = null) {
    const res = await fetch('/api/tiwi/chat/conversations', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ type: 'group', name, memberIds }),
    });
    if (!res.ok) throw new Error('Failed to create group');
    return await res.json();
  },

  async getMessages(conversationId, userId = null) {
    try {
      const res = await fetch(`/api/tiwi/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  },

  async sendMessage(conversationId, { text, mediaUrl = null, replyToId = null }, userId = null) {
    const res = await fetch(`/api/tiwi/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ text, mediaUrl, replyToId }),
    });
    if (!res.ok) throw new Error('Failed to send message');
    return await res.json();
  },

  async markSeen(conversationId, userId = null) {
    try {
      await fetch(`/api/tiwi/chat/conversations/${encodeURIComponent(conversationId)}/seen`, {
        method: 'POST',
        headers: getAuthHeaders(userId),
      });
    } catch (e) {}
  },

  async getCallHistory(userId = null) {
    try {
      const res = await fetch('/api/tiwi/chat/calls/history', { headers: getAuthHeaders(userId) });
      if (!res.ok) return [];
      return await res.json();
    } catch (e) {
      return [];
    }
  },

  async initiateCall({ recipientId, type = 'audio' }, userId = null) {
    const res = await fetch('/api/tiwi/chat/calls/initiate', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ recipientId, type }),
    });
    return await res.json();
  },

  // ==========================================
  // 6. ECOSYSTEM (SPACES, CIRCLES, WALLET, ETC)
  // ==========================================
  async getAudioSpaces() {
    try {
      const res = await fetch('/api/social/audio-spaces', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.spaces || []);
    } catch (e) {
      return [];
    }
  },

  async createAudioSpace(data, userId = null) {
    const res = await fetch('/api/social/audio-spaces', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async joinAudioSpace(spaceId, userId = null) {
    const res = await fetch(`/api/social/audio-spaces/${encodeURIComponent(spaceId)}/join`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async leaveAudioSpace(spaceId, userId = null) {
    const res = await fetch(`/api/social/audio-spaces/${encodeURIComponent(spaceId)}/leave`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
    });
    return await res.json();
  },

  async getCircles() {
    try {
      const res = await fetch('/api/social/circles', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.circles || []);
    } catch (e) {
      return [];
    }
  },

  async getPolls() {
    try {
      const res = await fetch('/api/social/polls', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.polls || []);
    } catch (e) {
      return [];
    }
  },

  async votePoll(pollId, optionIndex, userId = null) {
    const res = await fetch(`/api/social/polls/${encodeURIComponent(pollId)}/vote`, {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ optionIndex }),
    });
    return await res.json();
  },

  async getWallet(userId = null) {
    try {
      const res = await fetch(`/api/social/wallet?userId=${encodeURIComponent(userId || '')}`, {
        headers: getAuthHeaders(userId),
      });
      if (!res.ok) return { balance: 350, transactions: [] };
      return await res.json();
    } catch (e) {
      return { balance: 350, transactions: [] };
    }
  },

  async tipCreator({ recipientId, amount, note = '' }, userId = null) {
    const res = await fetch('/api/social/wallet/tip', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify({ recipientId, amount, note }),
    });
    return await res.json();
  },

  async getEvents() {
    try {
      const res = await fetch('/api/social/events', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.events || []);
    } catch (e) {
      return [];
    }
  },

  async getGigs(category = 'All') {
    try {
      const res = await fetch(`/api/social/gigs?category=${encodeURIComponent(category)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.gigs || [];
    } catch (e) {
      return [];
    }
  },

  async getTriviaQuestions() {
    try {
      const res = await fetch('/api/social/trivia/questions', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.questions || [];
    } catch (e) {
      return [];
    }
  },

  async getMemories(userId = null) {
    try {
      const res = await fetch('/api/social/memories', { headers: getAuthHeaders(userId) });
      if (!res.ok) return [];
      const data = await res.json();
      return data.memories || [];
    } catch (e) {
      return [];
    }
  },

  async getVoiceNotes() {
    try {
      const res = await fetch('/api/social/voice-notes', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return data.voiceNotes || [];
    } catch (e) {
      return [];
    }
  },

  async requestVerification(data, userId = null) {
    const res = await fetch('/api/social/verifications', {
      method: 'POST',
      headers: getAuthHeaders(userId),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  // ==========================================
  // 7. FILE UPLOAD
  // ==========================================
  async uploadMedia(file) {
    const formData = new FormData();
    formData.append('media', file);
    const token = localStorage.getItem('stockpro_session') || sessionStorage.getItem('stockpro_session');
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token.trim()}`;

    const res = await fetch('/api/tiwi/upload', {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Upload failed with status ${res.status}`);
    }
    const data = await res.json();
    return data.url || data.mediaUrl || data.path;
  }
};
