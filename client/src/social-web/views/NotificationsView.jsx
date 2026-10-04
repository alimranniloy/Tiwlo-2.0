import React, { useState, useEffect } from 'react';
import { Bell, Heart, MessageCircle, UserPlus, CheckCheck, Sparkles } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function NotificationsView() {
  const { currentUser, navigateTo, setUnreadNotifications, showToast } = useSocial();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread'

  useEffect(() => {
    fetchNotifications();
  }, [currentUser?.id]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await TiwiSocialAPI.getNotifications(currentUser?.id);
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await TiwiSocialAPI.markAllNotificationsRead(currentUser?.id);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true, read: true })));
      setUnreadNotifications(0);
      showToast('All notifications marked as read', 'info');
    } catch (e) {
      showToast('Failed to mark notifications', 'error');
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead && !notif.read) {
      try {
        await TiwiSocialAPI.markNotificationRead(notif.id, currentUser?.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, isRead: true, read: true } : n))
        );
        setUnreadNotifications((prev) => Math.max(0, prev - 1));
      } catch (e) {}
    }

    if (notif.postId) {
      navigateTo('post-detail', notif.postId);
    } else if (notif.senderHandle || notif.senderId) {
      navigateTo('profile', notif.senderHandle || notif.senderId);
    }
  };

  const filteredNotifications = filter === 'unread'
    ? notifications.filter((n) => !n.isRead && !n.read)
    : notifications;

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      {/* Header Banner */}
      <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#0B57D0]" />
            Notifications
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Stay updated with your community activities</p>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#0B57D0] dark:text-[#8AB4F8] hover:bg-[#E8F0FE] dark:hover:bg-[#111827] transition-colors"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Mark all read</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            filter === 'all'
              ? 'bg-[#0B57D0] text-white shadow-xs'
              : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-gray-300 border border-gray-200/70 dark:border-gray-800'
          }`}
        >
          All Activity
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
            filter === 'unread'
              ? 'bg-[#0B57D0] text-white shadow-xs'
              : 'bg-white dark:bg-[#1E293B] text-gray-600 dark:text-gray-300 border border-gray-200/70 dark:border-gray-800'
          }`}
        >
          Unread Only
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 animate-pulse flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-1.5" />
                <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredNotifications.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {filteredNotifications.map((notif) => {
            const isUnread = !notif.isRead && !notif.read;
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                  isUnread
                    ? 'bg-[#E8F0FE]/40 dark:bg-[#1E293B] border-[#0B57D0]/30 shadow-xs'
                    : 'bg-white dark:bg-[#1E293B] border-gray-200/60 dark:border-gray-800/80 hover:bg-gray-50 dark:hover:bg-[#111827]'
                }`}
              >
                <div className="relative">
                  <img
                    src={notif.senderAvatar || notif.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                    alt="Sender"
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-[#0B57D0] text-white">
                    {notif.type === 'like' ? (
                      <Heart className="w-2.5 h-2.5 fill-current" />
                    ) : notif.type === 'comment' ? (
                      <MessageCircle className="w-2.5 h-2.5" />
                    ) : (
                      <UserPlus className="w-2.5 h-2.5" />
                    )}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-relaxed text-[#1F1F1F] dark:text-gray-200">
                    <span className="font-bold mr-1">{notif.senderName || notif.author || 'Someone'}</span>
                    {notif.message || notif.text || 'interacted with your content.'}
                  </p>
                  <span className="text-[11px] text-gray-400 mt-0.5 block">{notif.timeAgo || 'Recently'}</span>
                </div>

                {isUnread && <span className="w-2 h-2 rounded-full bg-[#0B57D0] flex-shrink-0" />}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-10 border border-gray-200/70 dark:border-gray-800/80 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#E8F0FE] dark:bg-[#1E293B] flex items-center justify-center text-[#0B57D0] mb-3">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#1F1F1F] dark:text-white mb-1">No notifications yet</h3>
          <p className="text-xs text-gray-500">When someone likes, comments, or follows you, you'll see it here.</p>
        </div>
      )}
    </div>
  );
}
