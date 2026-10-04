import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Users,
  Plus,
  Compass,
  CheckCircle2,
  Lock,
  Globe,
  MessageSquare,
  Sparkles,
  Camera,
  Check,
  Shield
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';

export default function CommunityCirclesView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [spaces, setSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // New Space Form State (Strictly In-Page routing, no popups)
  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDesc, setNewSpaceDesc] = useState('');
  const [newSpaceCategory, setNewSpaceCategory] = useState('Technology');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submittingSpace, setSubmittingSpace] = useState(false);

  useEffect(() => {
    TiwiSocialAPI.getCommunitySpaces().then((data) => {
      if (Array.isArray(data) && data.length > 0) {
        setSpaces(data);
      } else {
        setSpaces([
          {
            id: 'sp_tech',
            name: 'Full Stack & AI Builders',
            description: 'Discuss modern web architecture, PostgreSQL, and autonomous agent workflows.',
            category: 'Technology',
            membersCount: 4820,
            isPrivate: false,
            isJoined: true,
            coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=200&fit=crop',
          },
          {
            id: 'sp_design',
            name: 'Design Systems & UI Excellence',
            description: 'Minimal, clean, and spacious UI/UX systems inspired by modern Google and Apple products.',
            category: 'Design',
            membersCount: 3120,
            isPrivate: false,
            isJoined: false,
            coverImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&h=200&fit=crop',
          },
          {
            id: 'sp_creators',
            name: 'Tiwi Monetized Creators',
            description: 'Strategies for subscriber growth, digital product sales, and video engagement.',
            category: 'Creators',
            membersCount: 1940,
            isPrivate: true,
            isJoined: false,
            coverImage: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=600&h=200&fit=crop',
          },
          {
            id: 'sp_founders',
            name: 'SaaS Founders Circle',
            description: 'From zero to $100k MRR. Architecture blueprints, pricing strategies, and customer retention.',
            category: 'Business',
            membersCount: 2450,
            isPrivate: false,
            isJoined: true,
            coverImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=200&fit=crop',
          }
        ]);
      }
    });
  }, []);

  const handleToggleJoin = (spaceId) => {
    setSpaces((prev) =>
      prev.map((s) => {
        if (s.id === spaceId) {
          const nextJoined = !s.isJoined;
          showToast(nextJoined ? `Joined "${s.name}"` : `Left "${s.name}"`, 'info');
          return {
            ...s,
            isJoined: nextJoined,
            membersCount: nextJoined ? s.membersCount + 1 : s.membersCount - 1,
          };
        }
        return s;
      })
    );

    if (selectedSpace && selectedSpace.id === spaceId) {
      setSelectedSpace((prev) => ({
        ...prev,
        isJoined: !prev.isJoined,
        membersCount: !prev.isJoined ? prev.membersCount + 1 : prev.membersCount - 1,
      }));
    }
  };

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!newSpaceName.trim()) {
      showToast('Space name is required', 'error');
      return;
    }

    setSubmittingSpace(true);
    try {
      const created = await TiwiSocialAPI.createCommunitySpace(
        {
          name: newSpaceName.trim(),
          description: newSpaceDesc.trim(),
          category: newSpaceCategory,
          isPrivate,
        },
        currentUser?.id
      );

      const spaceObj = created || {
        id: `sp_${Date.now()}`,
        name: newSpaceName.trim(),
        description: newSpaceDesc.trim() || 'Community discussion space on Tiwi.',
        category: newSpaceCategory,
        membersCount: 1,
        isPrivate,
        isJoined: true,
        coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=200&fit=crop',
      };

      setSpaces((prev) => [spaceObj, ...prev]);
      setSelectedSpace(spaceObj);
      setShowCreateForm(false);
      setNewSpaceName('');
      setNewSpaceDesc('');
      showToast('Space created successfully', 'info');
    } catch {
      showToast('Failed to create space', 'error');
    } finally {
      setSubmittingSpace(false);
    }
  };

  const categories = ['All', 'Technology', 'Design', 'Creators', 'Business'];

  const filteredSpaces = spaces.filter((s) => {
    if (selectedCategory === 'All') return true;
    return s.category.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="w-full flex flex-col min-h-screen max-w-4xl mx-auto pb-20">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f0f2f5]/90 dark:bg-[#0a0a0f]/90 backdrop-blur-xl px-2 py-3 flex items-center justify-between border-b border-black/[0.05] dark:border-white/[0.06] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedSpace) setSelectedSpace(null);
              else if (showCreateForm) setShowCreateForm(false);
              else navigateTo('feed');
            }}
            className="w-10 h-10 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] flex items-center justify-center text-[#65676b] dark:text-[#b0b3b8] transition cursor-pointer active:scale-95"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[18px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] leading-tight">
              {showCreateForm ? 'Create a Space' : selectedSpace ? selectedSpace.name : 'Spaces & Circles'}
            </h1>
            <span className="text-[12px] text-[#65676b] dark:text-[#8a8d91]">
              {selectedSpace ? `${selectedSpace.membersCount.toLocaleString()} members` : 'Connect with shared interest communities'}
            </span>
          </div>
        </div>

        {!selectedSpace && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-[13px] shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Space</span>
          </button>
        )}
      </div>

      {/* 2. In-Page Create Space Form (Strictly No Popups) */}
      {showCreateForm ? (
        <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] p-6 shadow-sm">
          <h2 className="text-[17px] font-bold text-[#1c1e21] dark:text-[#e4e6eb] mb-1">
            Build your Community Space
          </h2>
          <p className="text-[13px] text-[#65676b] dark:text-[#8a8d91] mb-5">
            Create an open or private circle for discussions, live audio hangouts, and collaborative posts.
          </p>

          <form onSubmit={handleCreateSpace} className="space-y-4">
            <div>
              <label className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1.5">
                Space Name
              </label>
              <input
                type="text"
                placeholder="e.g. NextGen Web Architects"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30"
              />
            </div>

            <div>
              <label className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1.5">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="What is this community about? Who should join?"
                value={newSpaceDesc}
                onChange={(e) => setNewSpaceDesc(e.target.value)}
                className="w-full p-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30 resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1.5">
                  Category
                </label>
                <select
                  value={newSpaceCategory}
                  onChange={(e) => setNewSpaceCategory(e.target.value)}
                  className="w-full h-11 px-4 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] border border-black/[0.05] dark:border-white/[0.08] text-[14px] text-[#1c1e21] dark:text-[#e4e6eb] outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer"
                >
                  {categories.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[12px] font-semibold text-[#65676b] dark:text-[#8a8d91] block mb-1.5">
                  Privacy
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrivate(false)}
                    className={`flex-1 h-11 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      !isPrivate
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                        : 'bg-black/[0.03] dark:bg-white/[0.05] text-[#65676b] dark:text-[#8a8d91]'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span>Public</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(true)}
                    className={`flex-1 h-11 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      isPrivate
                        ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                        : 'bg-black/[0.03] dark:bg-white/[0.05] text-[#65676b] dark:text-[#8a8d91]'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span>Private</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/[0.05] dark:border-white/[0.06]">
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="px-5 py-2.5 rounded-xl hover:bg-black/[0.04] dark:hover:bg-white/[0.06] font-semibold text-[13px] text-[#65676b] dark:text-[#8a8d91] transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submittingSpace}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-40 text-white font-semibold text-[13px] px-6 py-2.5 rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition cursor-pointer"
              >
                {submittingSpace ? 'Creating...' : 'Create Space'}
              </button>
            </div>
          </form>
        </div>
      ) : selectedSpace ? (
        /* 3. Space Detail View */
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm overflow-hidden">
            <div className="h-44 sm:h-52 w-full relative">
              <img src={selectedSpace.coverImage} alt={selectedSpace.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex items-end p-6">
                <div className="text-white">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 backdrop-blur-md">
                      {selectedSpace.category}
                    </span>
                    {selectedSpace.isPrivate && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/80 text-white backdrop-blur-md">
                        <Lock className="w-3 h-3" />
                        Private
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold">{selectedSpace.name}</h2>
                </div>
              </div>
            </div>

            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/[0.05] dark:border-white/[0.06]">
              <div>
                <p className="text-[14px] text-[#4b4f56] dark:text-[#b0b3b8] max-w-xl leading-relaxed">
                  {selectedSpace.description}
                </p>
                <div className="flex items-center gap-4 mt-2 text-[12px] text-[#65676b] dark:text-[#8a8d91]">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-violet-500" />
                    <b>{selectedSpace.membersCount.toLocaleString()}</b> members
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleJoin(selectedSpace.id)}
                  className={`px-5 py-2.5 rounded-xl font-semibold text-[13px] transition cursor-pointer shadow-sm ${
                    selectedSpace.isJoined
                      ? 'bg-black/[0.05] dark:bg-white/[0.08] text-[#1c1e21] dark:text-[#e4e6eb]'
                      : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-violet-500/20'
                  }`}
                >
                  {selectedSpace.isJoined ? 'Joined' : 'Join Space'}
                </button>
                <button
                  onClick={() => navigateTo('create-post')}
                  className="px-4 py-2.5 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 font-semibold text-[13px] hover:bg-violet-500/20 transition cursor-pointer"
                >
                  Post in Space
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 4. Spaces Catalog Grid */
        <div className="space-y-4">
          {/* Category Chips */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-4 py-1.5 rounded-xl text-[13px] font-medium transition cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20 font-semibold'
                      : 'bg-white dark:bg-[#16161f] text-[#65676b] dark:text-[#b0b3b8] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] border border-black/[0.05] dark:border-white/[0.06]'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSpaces.map((s) => (
              <div
                key={s.id}
                onClick={() => setSelectedSpace(s)}
                className="group bg-white dark:bg-[#16161f] rounded-2xl border border-black/[0.05] dark:border-white/[0.06] shadow-sm hover:shadow-md dark:hover:shadow-black/30 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="h-32 w-full relative overflow-hidden bg-violet-500/10">
                    <img
                      src={s.coverImage}
                      alt={s.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-black/50 text-white backdrop-blur-md">
                        {s.category}
                      </span>
                      {s.isPrivate && (
                        <span className="p-1 rounded-full bg-amber-500/80 text-white backdrop-blur-md" title="Private Space">
                          <Lock className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <h3 className="font-bold text-[16px] text-[#1c1e21] dark:text-[#e4e6eb] group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {s.name}
                    </h3>
                    <p className="text-[12.5px] text-[#65676b] dark:text-[#8a8d91] line-clamp-2 mt-1 leading-relaxed">
                      {s.description}
                    </p>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 flex items-center justify-between border-t border-black/[0.04] dark:border-white/[0.05]">
                  <span className="text-[12px] font-medium text-[#65676b] dark:text-[#8a8d91]">
                    {s.membersCount.toLocaleString()} members
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleJoin(s.id);
                    }}
                    className={`text-[12px] font-semibold px-4 py-1.5 rounded-xl transition cursor-pointer shadow-xs ${
                      s.isJoined
                        ? 'bg-black/[0.04] dark:bg-white/[0.08] text-[#1c1e21] dark:text-[#e4e6eb]'
                        : 'bg-violet-600 hover:bg-violet-700 text-white shadow-violet-500/20'
                    }`}
                  >
                    {s.isJoined ? 'Joined' : 'Join'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
