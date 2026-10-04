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
    <div className="flex flex-col gap-4 max-w-2xl mx-auto w-full pb-20 md:pb-10">
      <div className="bg-white dark:bg-[#202124] p-5 rounded-lg border border-[#dadce0] dark:border-[#3c4043] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigateTo('feed')} className="p-1.5 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] hover:text-[#1a73e8] transition cursor-pointer">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-[17px] font-bold text-[#202124] dark:text-[#e8eaed] flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#1a73e8]" />
              On This Day • Memories
            </h2>
            <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6]">Revisit moments you shared on Tiwi in past years</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-xs text-[#5f6368] dark:text-[#9aa0a6]">Loading memories...</div>
      ) : memories.length > 0 ? (
        <div className="flex flex-col gap-3">
          {memories.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-[#202124] rounded-lg p-12 border border-[#dadce0] dark:border-[#3c4043] text-center flex flex-col items-center justify-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#e8f0fe] dark:bg-[#174ea6] flex items-center justify-center text-[#1a73e8] mb-3">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#202124] dark:text-[#e8eaed] mb-1">No memories today</h3>
          <p className="text-xs text-[#5f6368] dark:text-[#9aa0a6] max-w-xs">
            As you continue sharing posts on Tiwi, past moments and anniversary flashbacks will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
