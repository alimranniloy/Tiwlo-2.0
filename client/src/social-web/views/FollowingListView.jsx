import React, { useState, useEffect } from 'react';
import { ArrowLeft, UserCheck, CheckCircle2 } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function FollowingListView() {
  const { tabParams, currentUser, navigateTo } = useSocial();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const targetUserId = tabParams?.id || currentUser?.id;

  useEffect(() => {
    TiwiSocialAPI.getFollowing(targetUserId).then((data) => {
      setUsers(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [targetUserId]);

  return (
    <div className="flex flex-col gap-5 max-w-xl mx-auto w-full pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#1E293B] p-5 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateTo('profile', targetUserId)} className="p-1.5 text-gray-500 hover:text-[#0B57D0]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-[#0B57D0]" />
              Following
            </h2>
            <p className="text-xs text-gray-500">Accounts followed by this user</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs p-4 flex flex-col gap-2">
        {loading ? (
          <div className="text-center py-10 text-xs text-gray-400">Loading following list...</div>
        ) : users.length > 0 ? (
          users.map((u) => (
            <div
              key={u.id}
              onClick={() => navigateTo('profile', u.handle || u.id)}
              className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 dark:hover:bg-[#111827] cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-3">
                <img
                  src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                  alt={u.name}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <div className="text-sm font-bold text-[#1F1F1F] dark:text-white flex items-center gap-1">
                    {u.name}
                    {u.isVerified && <CheckCircle2 className="w-3.5 h-3.5 text-[#0B57D0]" />}
                  </div>
                  <div className="text-xs text-gray-500">@{u.handle}</div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-xs text-gray-400">Not following anyone yet.</div>
        )}
      </div>
    </div>
  );
}
