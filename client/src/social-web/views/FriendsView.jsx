import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Search,
  MessageCircle,
  MoreHorizontal,
  Check,
  X,
  Sparkles,
  ArrowLeft,
  Filter
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function FriendsView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'requests', 'suggestions'
  const [searchQuery, setSearchQuery] = useState('');
  const [requests, setRequests] = useState([
    {
      id: 'req_1',
      name: 'Alexander Wright',
      handle: 'alexander_w',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop',
      mutualCount: 14,
      mutualPreview: 'Cynthia & Danny Club',
      timeAgo: '1d ago'
    },
    {
      id: 'req_2',
      name: 'Elena Rostova',
      handle: 'elena_ux',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
      mutualCount: 8,
      mutualPreview: 'Sebo Studio & 7 others',
      timeAgo: '3d ago'
    },
    {
      id: 'req_3',
      name: 'Marcus Chen',
      handle: 'marcus_c',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
      mutualCount: 22,
      mutualPreview: 'Topcode & UI/UX Community',
      timeAgo: '5d ago'
    }
  ]);

  const [suggestions, setSuggestions] = useState([
    {
      id: 'sug_1',
      name: 'Sophia Martinez',
      handle: 'sophia_m',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
      role: 'Product Designer at Spotify',
      mutualCount: 19
    },
    {
      id: 'sug_2',
      name: 'David Kim',
      handle: 'davidk',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&h=120&fit=crop',
      role: 'Full Stack Engineer',
      mutualCount: 11
    },
    {
      id: 'sug_3',
      name: 'Amina Al-Mansoor',
      handle: 'amina_dev',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop',
      role: 'Mobile Specialist',
      mutualCount: 16
    },
    {
      id: 'sug_4',
      name: 'Lucas Dupont',
      handle: 'lucas_d',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=120&h=120&fit=crop',
      role: 'Creative Director',
      mutualCount: 25
    }
  ]);

  const [friendsList, setFriendsList] = useState([
    {
      id: 'fr_1',
      name: 'Cynthia Perez',
      handle: 'cynthia_p',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop',
      status: 'Active now',
      isOnline: true
    },
    {
      id: 'fr_2',
      name: 'Danny Club Manager',
      handle: 'dannyclub',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop',
      status: 'Active 10m ago',
      isOnline: true
    },
    {
      id: 'fr_3',
      name: 'Pan Feng Shui',
      handle: 'panfengshui',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&h=120&fit=crop',
      status: 'Active 1h ago',
      isOnline: false
    },
    {
      id: 'fr_4',
      name: 'Clara Kim',
      handle: 'clarakim',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&h=120&fit=crop',
      status: 'Active now',
      isOnline: true
    },
    {
      id: 'fr_5',
      name: 'Reza Pratama',
      handle: 'rezapratama',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&fit=crop',
      status: 'Active 2h ago',
      isOnline: false
    },
    {
      id: 'fr_6',
      name: 'Sarah Connor',
      handle: 'sarah_c',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120&h=120&fit=crop',
      status: 'Active now',
      isOnline: true
    }
  ]);

  const handleAcceptRequest = (id, name) => {
    const accepted = requests.find((r) => r.id === id);
    setRequests((prev) => prev.filter((r) => r.id !== id));
    if (accepted) {
      setFriendsList((prev) => [
        {
          id: accepted.id,
          name: accepted.name,
          handle: accepted.handle,
          avatar: accepted.avatar,
          status: 'Active just now',
          isOnline: true
        },
        ...prev
      ]);
    }
    showToast(`You and ${name} are now friends!`, 'info');
  };

  const handleDeleteRequest = (id, name) => {
    setRequests((prev) => prev.filter((r) => r.id !== id));
    showToast(`Declined friend request from ${name}`, 'info');
  };

  const handleAddFriend = (id, name) => {
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
    showToast(`Friend request sent to ${name}`, 'info');
  };

  const filteredFriends = friendsList.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.handle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col gap-5 pb-20">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1E75FF]/10 text-[#1E75FF] flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-[#111827] dark:text-white tracking-tight flex items-center gap-2">
              Friends Hub
              <span className="text-[12px] font-semibold bg-[#1E75FF]/10 text-[#1E75FF] px-2.5 py-0.5 rounded-full">
                {friendsList.length} Connected
              </span>
            </h1>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF]">
              Connect, discover mutual friends, and grow your professional network
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center bg-[#F4F5F7] dark:bg-[#1A1D27] p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white dark:bg-[#161822] text-[#1E75FF] shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]'
            }`}
          >
            All Friends ({friendsList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('requests')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer relative ${
              activeTab === 'requests'
                ? 'bg-white dark:bg-[#161822] text-[#1E75FF] shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]'
            }`}
          >
            Requests
            {requests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 bg-[#FF3B30] text-white text-[10px] font-bold rounded-full">
                {requests.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('suggestions')}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-[13px] font-semibold transition-all cursor-pointer ${
              activeTab === 'suggestions'
                ? 'bg-white dark:bg-[#161822] text-[#1E75FF] shadow-xs'
                : 'text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827]'
            }`}
          >
            Suggestions
          </button>
        </div>
      </div>

      {/* 2. Friend Requests Section (Shown when active or has pending requests) */}
      {(activeTab === 'requests' || (activeTab === 'all' && requests.length > 0)) && (
        <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <span>Friend Requests</span>
              <span className="text-[12px] font-semibold text-[#FF3B30] bg-[#FF3B30]/10 px-2 py-0.5 rounded-full">
                {requests.length} New
              </span>
            </h2>
          </div>

          {requests.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">No pending friend requests.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl border border-[#EAECF0] dark:border-[#1E232F] bg-[#FAFBFD] dark:bg-[#14161F] flex flex-col justify-between gap-3 hover:border-gray-300 dark:hover:border-gray-700 transition"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={req.avatar}
                      alt={req.name}
                      className="w-12 h-12 rounded-xl object-cover ring-1 ring-black/5"
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="font-bold text-[14px] text-[#111827] dark:text-white truncate">
                        {req.name}
                      </span>
                      <span className="text-[11.5px] text-[#9CA3AF] truncate">
                        @{req.handle}
                      </span>
                      <span className="text-[11px] text-[#1E75FF] font-medium mt-0.5">
                        {req.mutualCount} mutual friends
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => handleAcceptRequest(req.id, req.name)}
                      className="flex-1 py-1.5 rounded-lg bg-[#1E75FF] hover:bg-[#1A66E5] text-white text-[12.5px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRequest(req.id, req.name)}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[12.5px] font-semibold transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3. People You May Know / Suggestions */}
      {(activeTab === 'suggestions' || activeTab === 'all') && (
        <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#1E75FF]" />
              <span>People You May Know</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {suggestions.map((sug) => (
              <div
                key={sug.id}
                className="p-4 rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] bg-white dark:bg-[#161822] flex flex-col items-center text-center gap-2 hover:shadow-md transition group"
              >
                <img
                  src={sug.avatar}
                  alt={sug.name}
                  className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#1E75FF]/20 group-hover:scale-105 transition-transform"
                />
                <div className="flex flex-col min-w-0 mt-1">
                  <span className="font-bold text-[14px] text-[#111827] dark:text-white truncate">
                    {sug.name}
                  </span>
                  <span className="text-[11.5px] text-[#9CA3AF] truncate">
                    {sug.role}
                  </span>
                  <span className="text-[11px] text-[#6B7280] dark:text-[#9CA3AF] mt-1 font-medium">
                    {sug.mutualCount} mutual friends
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleAddFriend(sug.id, sug.name)}
                  className="w-full mt-2 py-2 rounded-xl bg-[#1E75FF]/10 hover:bg-[#1E75FF] text-[#1E75FF] hover:text-white text-[12.5px] font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add Friend
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. All Connected Friends Grid */}
      {(activeTab === 'all') && (
        <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <h2 className="text-[16px] font-bold text-[#111827] dark:text-white flex items-center gap-2">
              <span>All Friends</span>
              <span className="text-[12px] font-medium text-[#9CA3AF]">
                ({filteredFriends.length})
              </span>
            </h2>

            {/* Friend Search Box */}
            <div className="relative max-w-xs w-full">
              <input
                type="text"
                placeholder="Search friends..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-[36px] pl-9 pr-3 bg-[#F4F5F7] dark:bg-[#1A1D27] text-[13px] rounded-xl outline-none focus:ring-2 focus:ring-[#1E75FF]/30 transition"
              />
              <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {filteredFriends.map((friend) => (
              <div
                key={friend.id}
                className="p-3.5 rounded-xl border border-[#EAECF0] dark:border-[#1E232F] bg-[#FAFBFD] dark:bg-[#14161F] flex items-center justify-between gap-3 hover:border-gray-300 dark:hover:border-gray-700 transition"
              >
                <div
                  onClick={() => navigateTo('profile', friend.handle)}
                  className="flex items-center gap-3 cursor-pointer min-w-0"
                >
                  <div className="relative">
                    <img
                      src={friend.avatar}
                      alt={friend.name}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                    {friend.isOnline && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#10B981] rounded-full ring-2 ring-white dark:ring-[#161822]" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-bold text-[13.5px] text-[#111827] dark:text-white truncate hover:text-[#1E75FF] transition-colors">
                      {friend.name}
                    </span>
                    <span className="text-[11.5px] text-[#9CA3AF] truncate">
                      @{friend.handle}
                    </span>
                    <span className="text-[10.5px] text-[#10B981] font-medium">
                      {friend.status}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigateTo('messages', friend.id)}
                  className="p-2 rounded-lg bg-white dark:bg-[#1C202C] text-[#6B7280] hover:text-[#1E75FF] border border-[#EAECF0] dark:border-[#1E232F] shadow-xs cursor-pointer transition"
                  title="Send Message"
                >
                  <MessageCircle className="w-4 h-4 stroke-[1.8]" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
