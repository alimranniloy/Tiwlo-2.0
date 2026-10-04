import React, { useState, useEffect } from 'react';
import {
  Bell,
  Heart,
  MessageSquare,
  Repeat2,
  UserPlus,
  CheckCheck,
  Settings,
  Sparkles
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function NotificationsView() {
  const { currentUser, navigateTo, setUnreadNotifications, showToast } = useSocial();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'mentions'

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
              text: 'gave +1 to your announcement',
              timeAgo: '12m',
              isRead: false,
            },
            {
              id: 'n2',
              type: 'comment',
              senderName: 'Alex Rivera',
              senderHandle: 'arivera',
              senderAvatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
              text: 'commented: "The Google UI architecture looks very clean."',
              timeAgo: '1h',
              isRead: false,
            },
            {
              id: 'n3',
              type: 'follow',
              senderName: 'David Kim',
              senderHandle: 'dkim',
              senderAvatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&h=100&fit=crop',
              text: 'added you to their circles',
              timeAgo: '3h',
              isRead: true,
            },
            {
              id: 'n4',
              type: 'mention',
              senderName: 'Elena Rostova',
              senderHandle: 'elena_dev',
              senderAvatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop',
              text: 'mentioned you in a discussion on web components',
              timeAgo: '5h',
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

  const getNotifIcon = (type) => {
    switch (type) {
      case 'like':
        return <span className="font-bold text-[#1a73e8] text-xs">+1</span>;
      case 'comment':
      case 'reply':
        return <MessageSquare className="w-4 h-4 text-[#1a73e8]" />;
      case 'repost':
        return <Repeat2 className="w-4 h-4 text-[#1e8e3e]" />;
      case 'follow':
        return <UserPlus className="w-4 h-4 text-[#1a73e8]" />;
      case 'mention':
        return <Sparkles className="w-4 h-4 text-[#d93025]" />;
      default:
        return <Bell className="w-4 h-4 text-[#5f6368]" />;
    }
  };

  const filtered = notifications.filter((n) => {
    if (activeTab === 'mentions') return n.type === 'mention';
    return true;
  });

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Header App Bar with Google Underline Tabs */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md pb-2 mb-3 border-b border-[#dadce0] dark:border-[#3c4043]">
        <div className="h-[48px] flex items-center justify-between px-1">
          <h1 className="text-[18px] font-medium text-[#202124] dark:text-[#e8eaed]">
            Notifications
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={handleMarkAllRead}
              className="p-2 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#1a73e8] transition cursor-pointer"
              title="Mark all as read"
            >
              <CheckCheck className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigateTo('settings', 'notifications')}
              className="p-2 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Google Underline Tabs */}
        <div className="flex items-center gap-6 px-1 mt-1">
          {[
            { id: 'all', label: 'All alerts' },
            { id: 'mentions', label: 'Mentions' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2 text-[14px] font-medium transition cursor-pointer relative ${
                activeTab === tab.id
                  ? 'text-[#1a73e8] dark:text-[#8ab4f8] font-semibold'
                  : 'text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#202124]'
              }`}
            >
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#1a73e8] dark:bg-[#8ab4f8] rounded-t-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Notifications List as Google Cards */}
      <div className="flex flex-col gap-2 pb-20">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-3 border-[#1a73e8] border-t-transparent animate-spin" />
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
                className={`bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-4 shadow-xs hover:shadow-sm transition cursor-pointer flex items-start gap-3.5 ${
                  isUnread ? 'border-l-4 border-l-[#1a73e8]' : ''
                }`}
              >
                <div className="w-8 h-8 rounded-full bg-[#f1f3f4] dark:bg-[#202124] flex items-center justify-center flex-shrink-0 mt-0.5">
                  {getNotifIcon(notif.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <img
                      src={notif.senderAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=60&h=60&fit=crop'}
                      alt={notif.senderName}
                      className="w-6 h-6 rounded-full object-cover border border-[#dadce0]"
                    />
                    <span className="font-medium text-[13px] text-[#202124] dark:text-[#e8eaed] truncate">
                      {notif.senderName}
                    </span>
                    <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                      · {notif.timeAgo || 'recently'}
                    </span>
                  </div>

                  <p className="text-[13px] text-[#3c4043] dark:text-[#bdc1c6] mt-1 leading-relaxed">
                    {notif.text}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-6 shadow-xs">
            <Bell className="w-8 h-8 text-[#5f6368] mx-auto mb-2" />
            <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed] mb-1">
              You are all caught up
            </h3>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6]">
              New alerts regarding your stream will appear here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
