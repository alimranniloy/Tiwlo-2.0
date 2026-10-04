import React, { useState, useEffect } from 'react';
import {
  Bell,
  Heart,
  Repeat2,
  UserPlus,
  MessageSquare,
  Settings,
  CheckCircle2,
  CheckCheck
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function NotificationsView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'mentions'
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
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
            text: 'applauded your post about clean UI architecture',
            timeAgo: '12m',
            isRead: false,
          },
          {
            id: 'n2',
            type: 'follow',
            senderName: 'Alex Rivera',
            senderHandle: 'arivera',
            senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
            text: 'started following you',
            timeAgo: '1h',
            isRead: true,
          },
          {
            id: 'n3',
            type: 'comment',
            senderName: 'David Chen',
            senderHandle: 'dchen_tech',
            senderAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop',
            text: 'replied: "Completely agree on eliminating visual noise!"',
            timeAgo: '3h',
            isRead: true,
          },
        ]);
      }
    } catch {
      console.warn('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [currentUser?.id]);

  const handleMarkAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await TiwiSocialAPI.markAllNotificationsRead(currentUser?.id);
      showToast('All notifications marked as read', 'info');
    } catch {
      // ignore
    }
  };

  const getNotifIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="w-4 h-4 text-[#B3261E] fill-current" />;
      case 'repost':
        return <Repeat2 className="w-4 h-4 text-[#0F5223]" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-[#0B57D0]" />;
      case 'comment':
      case 'mention':
      default:
        return <MessageSquare className="w-4 h-4 text-[#7856FF]" />;
    }
  };

  const filtered = notifications.filter((notif) => {
    if (activeTab === 'mentions') return notif.type === 'mention' || notif.type === 'comment';
    return true;
  });

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Header App Bar with Google Segmented Tabs */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md pb-3 mb-2 border-b border-[#E0E2EC] dark:border-[#313335]">
        <div className="h-[56px] flex items-center justify-between px-2 sm:px-0">
          <h1 className="text-[22px] font-extrabold text-[#1F1F1F] dark:text-[#E3E3E3] tracking-tight">
            Notifications
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMarkAllRead}
              className="p-2 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] text-[#747775] dark:text-[#8E918F] hover:text-[#0B57D0] transition cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigateTo('settings', 'notifications')}
              className="p-2 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] text-[#747775] dark:text-[#8E918F] transition cursor-pointer"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Material 3 Segmented Pill Tabs */}
        <div className="flex bg-[#EEF2F6] dark:bg-[#1E1F20] p-1 rounded-full w-full max-w-xs mt-1">
          {[
            { id: 'all', label: 'All' },
            { id: 'mentions', label: 'Mentions' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-1.5 rounded-full text-[13px] font-semibold transition cursor-pointer text-center ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-[#282A2C] text-[#0B57D0] dark:text-[#A8C7FA] shadow-xs'
                  : 'text-[#444746] dark:text-[#C4C7C5] hover:text-[#1F1F1F]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Notifications List as Google Material Cards */}
      <div className="flex flex-col gap-2.5 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#0B57D0] border-t-transparent animate-spin" />
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
                className={`bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-4.5 shadow-xs hover:shadow-sm transition cursor-pointer flex items-start gap-3.5 ${
                  isUnread ? 'ring-2 ring-[#0B57D0]/20' : ''
                }`}
              >
                <div className="w-10 h-10 rounded-2xl bg-[#F0F4F9] dark:bg-[#282A2C] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getNotifIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <img
                      src={notif.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop'}
                      alt={notif.senderName}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-[#E0E2EC]"
                    />
                    <span className="font-semibold text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] truncate">
                      {notif.senderName}
                    </span>
                    <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
                      · {notif.timeAgo || 'recently'}
                    </span>
                  </div>

                  <p className="text-[14px] text-[#444746] dark:text-[#C4C7C5] mt-1 leading-relaxed">
                    {notif.text}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-20 text-center bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6 shadow-xs">
            <Bell className="w-10 h-10 text-[#747775] mx-auto mb-2" />
            <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
              You are all caught up
            </h3>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F]">
              New alerts regarding your stream will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
