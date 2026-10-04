import React, { useState, useEffect } from 'react';
import {
  Bell,
  Heart,
  MessageSquare,
  Repeat2,
  UserPlus,
  CheckCheck,
  Settings,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function NotificationsView() {
  const { currentUser, navigateTo, setUnreadNotifications, showToast } = useSocial();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'mentions' | 'unread'

  useEffect(() => {
    async function loadNotifications() {
      try {
        setLoading(true);
        const data = await TiwiSocialAPI.getNotifications(currentUser?.id);
        if (Array.isArray(data) && data.length > 0) {
          setNotifications(data);
        } else {
          setNotifications([
            {
              id: 'n1',
              type: 'like',
              senderName: 'Sarah Jenkins',
              senderHandle: 'sarah_j',
              senderAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
              text: 'liked your announcement on web design',
              timeAgo: '12m ago',
              isRead: false,
            },
            {
              id: 'n2',
              type: 'comment',
              senderName: 'Alex Rivera',
              senderHandle: 'arivera',
              senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
              text: 'commented: "The new UI architecture looks remarkably clean and fast."',
              timeAgo: '1h ago',
              isRead: false,
            },
            {
              id: 'n3',
              type: 'follow',
              senderName: 'David Kim',
              senderHandle: 'dkim',
              senderAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop',
              text: 'started following you',
              timeAgo: '3h ago',
              isRead: true,
            },
            {
              id: 'n4',
              type: 'mention',
              senderName: 'Elena Rostova',
              senderHandle: 'elena_dev',
              senderAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop',
              text: 'mentioned you in a discussion about modern UI components',
              timeAgo: '5h ago',
              isRead: true,
            },
          ]);
        }
      } catch (err) {
        console.warn('Error loading notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadNotifications();
  }, [currentUser?.id]);

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadNotifications(0);
    showToast('All notifications marked as read', 'info');
    try {
      await TiwiSocialAPI.markNotificationsRead(currentUser?.id);
    } catch {
      // quiet
    }
  };

  const getNotifIconBadge = (type) => {
    switch (type) {
      case 'like':
        return (
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Heart className="w-4 h-4 fill-current" />
          </div>
        );
      case 'comment':
      case 'reply':
        return (
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
        );
      case 'repost':
        return (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Repeat2 className="w-4 h-4" />
          </div>
        );
      case 'follow':
        return (
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <UserPlus className="w-4 h-4" />
          </div>
        );
      case 'mention':
        return (
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
            <Bell className="w-4 h-4" />
          </div>
        );
    }
  };

  const filtered = notifications.filter((n) => {
    if (activeTab === 'mentions') return n.type === 'mention';
    if (activeTab === 'unread') return !n.isRead && !n.read;
    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead && !n.read).length;

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Header Bar with Modern Floating Pills */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl pb-3 mb-3 border-b border-black/[0.05] dark:border-white/[0.06]">
        <div className="h-14 flex items-center justify-between px-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[20px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-violet-500 text-white shadow-sm">
                {unreadCount} new
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#65676b] dark:text-[#b0b3b8] hover:text-violet-600 dark:hover:text-violet-400 text-xs font-semibold transition cursor-pointer active:scale-95"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Mark all read</span>
            </button>
            <button
              onClick={() => navigateTo('settings', 'notifications')}
              className="p-2 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modern Pill Filter Tabs */}
        <div className="flex items-center gap-2 px-1 mt-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'unread', label: 'Unread' },
            { id: 'mentions', label: 'Mentions' },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-1.5 rounded-xl text-[13px] font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20 font-semibold'
                    : 'bg-white dark:bg-[#16161f] text-[#65676b] dark:text-[#b0b3b8] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.06]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Notifications List */}
      <div className="flex flex-col gap-2.5 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((notif) => {
            const isUnread = !notif.isRead && !notif.read;

            return (
              <div
                key={notif.id}
                onClick={() => {
                  if (notif.postId) navigateTo('post-detail', notif.postId);
                  else if (notif.senderHandle) navigateTo('profile', notif.senderHandle);
                }}
                className={`group bg-white dark:bg-[#16161f] rounded-2xl border p-4 transition-all duration-200 cursor-pointer flex items-start gap-3.5 hover:shadow-md dark:hover:shadow-black/30 hover:-translate-y-[1px] ${
                  isUnread
                    ? 'border-violet-500/30 bg-violet-500/[0.02] dark:bg-violet-500/[0.03]'
                    : 'border-black/[0.05] dark:border-white/[0.06]'
                }`}
              >
                {/* Badge Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {getNotifIconBadge(notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src={notif.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop'}
                      alt={notif.senderName}
                      className="w-5 h-5 rounded-lg object-cover ring-1 ring-black/10 dark:ring-white/10"
                    />
                    <span className="font-semibold text-[13.5px] text-[#1c1e21] dark:text-[#e4e6eb] truncate">
                      {notif.senderName}
                    </span>
                    <span className="text-[11.5px] text-[#65676b] dark:text-[#8a8d91]">
                      · {notif.timeAgo || 'recently'}
                    </span>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-violet-500 ml-auto flex-shrink-0 animate-pulse" />
                    )}
                  </div>

                  <p className="text-[13px] text-[#4b4f56] dark:text-[#b0b3b8] leading-relaxed">
                    {notif.text}
                  </p>
                </div>

                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-center text-violet-500">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-8 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3">
              <Bell className="w-7 h-7" />
            </div>
            <h3 className="font-semibold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] mb-1">
              You're all caught up
            </h3>
            <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91] max-w-sm mx-auto">
              New alerts regarding your posts, mentions, and stream interactions will appear here in real-time.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
