import React, { useState, useEffect } from 'react';
import {
  Settings,
  Heart,
  Repeat2,
  UserPlus,
  MessageCircle,
  Sparkles,
  CheckCircle2,
  CheckCheck
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function NotificationsView() {
  const { currentUser, navigateTo, setUnreadNotifications, showToast } = useSocial();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'verified' | 'mentions'

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

  const filtered = notifications.filter((notif) => {
    if (activeTab === 'verified') return notif.isVerifiedSender || notif.senderVerified;
    if (activeTab === 'mentions') return notif.type === 'mention' || notif.type === 'comment';
    return true;
  });

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header: Notifications + Settings */}
      <div className="sticky top-0 z-20 bg-white/80 dark:bg-black/80 backdrop-blur-md border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
          <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA]">
            Notifications
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMarkAllRead}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#536471] dark:text-[#71767B] hover:text-[#1D9BF0] transition"
              title="Mark all as read"
            >
              <CheckCheck className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigateTo('settings')}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-[#536471] dark:text-[#71767B] transition"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Twitter Tabs: All, Verified, Mentions */}
        <div className="flex border-t border-[#EFF3F4] dark:border-[#2F3336]">
          {[
            { id: 'all', label: 'All' },
            { id: 'verified', label: 'Verified' },
            { id: 'mentions', label: 'Mentions' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 py-3.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative text-center cursor-pointer"
            >
              <span
                className={`text-[15px] ${
                  activeTab === tab.id
                    ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                    : 'font-medium text-[#536471] dark:text-[#71767B]'
                }`}
              >
                {tab.label}
              </span>
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Notifications List */}
      <div className="flex flex-col pb-24 md:pb-12 divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-7 h-7 rounded-full border-2 border-[#1D9BF0] border-t-transparent animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((notif) => {
            const isUnread = !notif.isRead && !notif.read;

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`px-4 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition flex gap-3 ${
                  isUnread ? 'bg-[#1D9BF0]/[0.04]' : ''
                }`}
              >
                {/* Left Notification Icon */}
                <div className="w-8 flex justify-end flex-shrink-0 pt-0.5">
                  {notif.type === 'like' ? (
                    <Heart className="w-6 h-6 text-[#F91880] fill-current" />
                  ) : notif.type === 'repost' ? (
                    <Repeat2 className="w-6 h-6 text-[#00BA7C]" />
                  ) : notif.type === 'follow' ? (
                    <UserPlus className="w-6 h-6 text-[#1D9BF0]" />
                  ) : notif.type === 'comment' ? (
                    <MessageCircle className="w-6 h-6 text-[#1D9BF0]" />
                  ) : (
                    <Sparkles className="w-6 h-6 text-[#1D9BF0]" />
                  )}
                </div>

                {/* Right Body */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <img
                      src={
                        notif.senderAvatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop'
                      }
                      alt={notif.senderName || 'Sender'}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  </div>

                  <p className="text-[15px] leading-snug text-[#0F1419] dark:text-[#E7E9EA]">
                    <span className="font-bold hover:underline">
                      {notif.senderName || 'Someone'}
                    </span>{' '}
                    {notif.text || notif.message || 'interacted with your content.'}
                  </p>

                  {notif.postSnippet && (
                    <p className="text-[15px] text-[#536471] dark:text-[#71767B] mt-1 line-clamp-2">
                      {notif.postSnippet}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-20 px-6 text-center flex flex-col items-center">
            <h3 className="font-extrabold text-[22px] text-[#0F1419] dark:text-[#E7E9EA] mb-2">
              Nothing to see here — yet
            </h3>
            <p className="text-[15px] text-[#536471] dark:text-[#71767B] max-w-sm">
              From likes to reposts and a whole lot more, this is where all the action about your posts and account happens.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
