import React, { useState, useEffect } from 'react';
import { Users, Plus, Check, Sparkles, ArrowLeft, MessageSquare } from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function CommunityCirclesView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [circles, setCircles] = useState([]);
  const [joinedMap, setJoinedMap] = useState({});
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    TiwiSocialAPI.getCircles().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setCircles(data);
      } else {
        setCircles([
          {
            id: 'circle_1',
            name: 'React & Frontend Artisans',
            description: 'A community for developers passionate about UI architecture and performance.',
            membersCount: 1240,
            coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=400&h=200&fit=crop'
          },
          {
            id: 'circle_2',
            name: 'Minimalist Designers',
            description: 'Discussing Google-inspired typography, whitespace, and micro-interactions.',
            membersCount: 890,
            coverImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=400&h=200&fit=crop'
          },
          {
            id: 'circle_3',
            name: 'AI Innovators Hub',
            description: 'Exploring machine learning, intelligent workflows, and next-gen tools.',
            membersCount: 2150,
            coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=200&fit=crop'
          }
        ]);
      }
    });
  }, []);

  const handleToggleJoin = (id) => {
    const next = !joinedMap[id];
    setJoinedMap((prev) => ({ ...prev, [id]: next }));
    showToast(next ? 'Joined Circle!' : 'Left Circle', 'info');
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newCircle = {
      id: `c_${Date.now()}`,
      name: name.trim(),
      description: desc.trim() || 'A vibrant Tiwi community circle.',
      membersCount: 1,
      coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&h=200&fit=crop'
    };
    setCircles((prev) => [newCircle, ...prev]);
    setJoinedMap((prev) => ({ ...prev, [newCircle.id]: true }));
    setShowCreate(false);
    setName('');
    setDesc('');
    showToast('Community Circle created!', 'info');
  };

  return (
    <div className="flex flex-col gap-5 max-w-4xl mx-auto w-full pb-20 md:pb-10">
      {/* Header */}
      <div className="bg-white dark:bg-[#1E293B] p-5 sm:p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#1F1F1F] dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-[#0B57D0]" />
            Community Circles
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">Connect with communities around shared passions</p>
        </div>

        <button
          onClick={() => setShowCreate((prev) => !prev)}
          className="flex items-center gap-1.5 bg-[#0B57D0] hover:bg-[#0842A0] text-white px-4 py-2 rounded-full text-xs font-semibold shadow-xs transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Create Circle</span>
        </button>
      </div>

      {/* Create Modal Form (Dedicated Card, No Popups!) */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-[#1E293B] p-6 rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs flex flex-col gap-4 animate-fadeIn">
          <h3 className="text-sm font-bold text-[#1F1F1F] dark:text-white">Create a Community Circle</h3>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Circle Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Clean Code & Architecture"
              className="w-full bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl px-4 py-2.5 focus:outline-none focus:border-[#0B57D0]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1 block">Description</label>
            <textarea
              rows={2}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="What is this circle about?"
              className="w-full bg-[#F1F3F4] dark:bg-[#111827] text-xs text-[#1F1F1F] dark:text-white rounded-2xl p-3 focus:outline-none focus:border-[#0B57D0]"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 rounded-full text-xs font-semibold text-gray-500 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white px-5 py-2 rounded-full text-xs font-semibold shadow-xs"
            >
              Create
            </button>
          </div>
        </form>
      )}

      {/* Circles Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {circles.map((c) => {
          const isJoined = joinedMap[c.id];
          return (
            <div
              key={c.id}
              className="bg-white dark:bg-[#1E293B] rounded-3xl border border-gray-200/70 dark:border-gray-800/80 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-sm transition-all"
            >
              <div className="h-28 w-full bg-gray-200 dark:bg-gray-800 relative">
                <img src={c.coverImage} alt={c.name} className="w-full h-full object-cover" />
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="font-bold text-sm text-[#1F1F1F] dark:text-white line-clamp-1">{c.name}</h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 leading-relaxed">{c.description}</p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-[11px] text-gray-400 font-medium">
                    {c.membersCount + (isJoined ? 1 : 0)} members
                  </span>

                  <button
                    onClick={() => handleToggleJoin(c.id)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isJoined
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                        : 'bg-[#0B57D0] text-white hover:bg-[#0842A0]'
                    }`}
                  >
                    {isJoined ? 'Joined' : 'Join Circle'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
