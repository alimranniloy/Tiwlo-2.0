import React, { useState, useEffect } from 'react';
import { Clock, Sparkles, ArrowLeft } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function MemoriesView() {
  const { currentUser, navigateTo } = useSocial();
  const [memories, setMemories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    TiwiSocialAPI.getMemories(currentUser?.id).then((data) => {
      setMemories(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, [currentUser?.id]);

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateTo('feed')} className="p-1 text-gray-500 hover:text-[#0B57D0]">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#0B57D0]" />
              On This Day • Memories
            </h2>
            <p className="text-xs text-gray-500">Revisit moments you shared on Tiwi in past years</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-gray-400">Loading memories...</div>
      ) : memories.length > 0 ? (
        <div className="flex flex-col gap-4">
          {memories.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#1E293B] rounded-3xl p-12 border border-gray-200/70 dark:border-gray-800/80 text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#E8F0FE] dark:bg-[#1E293B] flex items-center justify-center text-[#0B57D0] mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#1F1F1F] dark:text-white mb-1">No memories today</h3>
          <p className="text-xs text-gray-500 max-w-xs">
            As you continue sharing posts on Tiwi, past moments and anniversary flashbacks will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
