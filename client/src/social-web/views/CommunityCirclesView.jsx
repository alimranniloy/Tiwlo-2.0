import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Check,
  Sparkles,
  ArrowLeft,
  Search,
  Lock,
  Globe,
  MessageSquare,
  Share2,
  MoreHorizontal
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';
import { TiwiSocialAPI } from '../api/tiwiSocialApi';
import PostCard from '../components/PostCard';

export default function CommunityCirclesView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' | 'joined'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCommunity, setSelectedCommunity] = useState(null); // When viewing a community's feed
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create Form State
  const [newCommName, setNewCommName] = useState('');
  const [newCommDesc, setNewCommDesc] = useState('');
  const [newCommType, setNewCommType] = useState('open'); // 'open' | 'restricted'

  // Communities List
  const [communities, setCommunities] = useState([
    {
      id: 'comm_tech',
      name: 'Modern Web & React Architecture',
      category: 'Technology',
      description: 'The premier community for frontend engineers, UI architects, and performance obsessives.',
      membersCount: 14820,
      isJoined: true,
      isOpen: true,
      coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=100&h=100&fit=crop',
      rules: ['Respect fellow builders', 'No spam or unsolicited self-promotion', 'Share code and insights'],
    },
    {
      id: 'comm_ai',
      name: 'Artificial Intelligence & Agents',
      category: 'AI',
      description: 'Discussing LLMs, autonomous agentic reasoning, multimodal workflows, and future frontiers.',
      membersCount: 28940,
      isJoined: true,
      isOpen: true,
      coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=100&h=100&fit=crop',
      rules: ['Focus on technical rigor', 'Cite benchmark sources', 'Constructive critique only'],
    },
    {
      id: 'comm_design',
      name: 'Minimalist UI / UX Designers',
      category: 'Design',
      description: 'Dedicated to clean Google-inspired layouts, typography hierarchy, and effortless digital products.',
      membersCount: 9340,
      isJoined: false,
      isOpen: true,
      coverImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=100&h=100&fit=crop',
      rules: ['High fidelity design only', 'No cookie-cutter templates'],
    },
    {
      id: 'comm_founders',
      name: 'Bootstrapped Founders Club',
      category: 'Business',
      description: 'Founders sharing revenue numbers, launch strategies, real metrics, and customer feedback.',
      membersCount: 11200,
      isJoined: false,
      isOpen: false,
      coverImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=100&h=100&fit=crop',
      rules: ['Transparent metrics only', 'Founder peer support'],
    },
  ]);

  const categories = ['All', 'Technology', 'AI', 'Design', 'Business'];

  const handleToggleJoin = (id) => {
    setCommunities((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          const next = !c.isJoined;
          showToast(next ? `Joined ${c.name}` : `Left ${c.name}`, 'info');
          return { ...c, isJoined: next, membersCount: c.membersCount + (next ? 1 : -1) };
        }
        return c;
      })
    );
  };

  const handleCreateCommunity = (e) => {
    e.preventDefault();
    if (!newCommName.trim()) return;

    const newComm = {
      id: `comm_${Date.now()}`,
      name: newCommName.trim(),
      category: 'Technology',
      description: newCommDesc.trim() || 'A vibrant community on Tiwi.',
      membersCount: 1,
      isJoined: true,
      isOpen: newCommType === 'open',
      coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
      rules: ['Be helpful and respectful'],
    };

    setCommunities((prev) => [newComm, ...prev]);
    setShowCreateForm(false);
    setNewCommName('');
    setNewCommDesc('');
    showToast(`Community "${newComm.name}" created!`, 'info');
  };

  const filteredCommunities = communities.filter((c) => {
    if (activeTab === 'joined' && !c.isJoined) return false;
    if (selectedCategory !== 'All' && c.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="w-full flex flex-col min-h-screen">
      {/* 1. Sticky Header: 53px height */}
      <div className="sticky top-0 z-20 bg-white/85 dark:bg-black/85 backdrop-blur-md px-4 h-[53px] flex items-center justify-between border-b border-[#EFF3F4] dark:border-[#2F3336]">
        <div className="flex items-center gap-7">
          {selectedCommunity || showCreateForm ? (
            <button
              onClick={() => {
                setSelectedCommunity(null);
                setShowCreateForm(false);
              }}
              className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => navigateTo('feed')}
              className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="flex flex-col min-w-0">
            <h1 className="text-[20px] font-extrabold text-[#0F1419] dark:text-[#E7E9EA] leading-tight truncate">
              {showCreateForm
                ? 'Create a Community'
                : selectedCommunity
                ? selectedCommunity.name
                : 'Communities'}
            </h1>
            <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
              {selectedCommunity
                ? `${selectedCommunity.membersCount.toLocaleString()} members`
                : 'Find your people on Tiwi'}
            </span>
          </div>
        </div>

        {!selectedCommunity && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="w-9 h-9 rounded-full hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-[#0F1419] dark:text-[#E7E9EA] transition cursor-pointer"
            title="Create Community"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ============================================================== */}
      {/* VIEW A: CREATE COMMUNITY FORM (NO MODALS, STRICT PAGE ROUTING) */}
      {/* ============================================================== */}
      {showCreateForm ? (
        <form onSubmit={handleCreateCommunity} className="p-4 sm:p-6 flex flex-col gap-5 max-w-xl mx-auto w-full">
          <div>
            <h2 className="text-[20px] font-black text-[#0F1419] dark:text-[#E7E9EA]">
              Set up your Community
            </h2>
            <p className="text-[14px] text-[#536471] dark:text-[#71767B] mt-1">
              Give your Community a name and description that lets members know what it’s about.
            </p>
          </div>

          <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-3 focus-within:border-[#1D9BF0]">
            <label className="block text-[13px] text-[#536471] dark:text-[#71767B] font-semibold">
              Community Name
            </label>
            <input
              type="text"
              required
              value={newCommName}
              onChange={(e) => setNewCommName(e.target.value)}
              placeholder="e.g. Next.js Developers"
              className="w-full bg-transparent text-[16px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-1"
            />
          </div>

          <div className="border border-[#CFD9DE] dark:border-[#536471] rounded-sm p-3 focus-within:border-[#1D9BF0]">
            <label className="block text-[13px] text-[#536471] dark:text-[#71767B] font-semibold">
              Description
            </label>
            <textarea
              rows={3}
              value={newCommDesc}
              onChange={(e) => setNewCommDesc(e.target.value)}
              placeholder="What happens in this community?"
              className="w-full bg-transparent text-[15px] text-[#0F1419] dark:text-[#E7E9EA] outline-none mt-1 resize-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-[#536471] dark:text-[#71767B]">
              Membership Access
            </span>
            <div className="grid grid-cols-2 gap-3">
              <label
                onClick={() => setNewCommType('open')}
                className={`p-3 rounded-2xl border cursor-pointer flex flex-col gap-1 ${
                  newCommType === 'open'
                    ? 'border-[#1D9BF0] bg-[#1D9BF0]/5'
                    : 'border-[#EFF3F4] dark:border-[#2F3336]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-[14px] text-[#0F1419] dark:text-[#E7E9EA]">
                  <Globe className="w-4 h-4 text-[#1D9BF0]" />
                  <span>Open</span>
                </div>
                <span className="text-[12px] text-[#536471] dark:text-[#71767B]">
                  Anyone can view and join.
                </span>
              </label>

              <label
                onClick={() => setNewCommType('restricted')}
                className={`p-3 rounded-2xl border cursor-pointer flex flex-col gap-1 ${
                  newCommType === 'restricted'
                    ? 'border-[#1D9BF0] bg-[#1D9BF0]/5'
                    : 'border-[#EFF3F4] dark:border-[#2F3336]'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-[14px] text-[#0F1419] dark:text-[#E7E9EA]">
                  <Lock className="w-4 h-4 text-[#FF7A00]" />
                  <span>Restricted</span>
                </div>
                <span className="text-[12px] text-[#536471] dark:text-[#71767B]">
                  Only approved members can post.
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-5 py-2.5 rounded-full font-bold text-[14px] text-[#536471] hover:bg-black/5 dark:hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newCommName.trim()}
              className="bg-[#1D9BF0] hover:bg-[#1A8CD8] disabled:opacity-50 text-white font-bold text-[14px] px-6 py-2.5 rounded-full transition shadow-xs"
            >
              Create Community
            </button>
          </div>
        </form>
      ) : selectedCommunity ? (
        /* ============================================================== */
        /* VIEW B: SINGLE COMMUNITY FEED                                 */
        /* ============================================================== */
        <div className="flex flex-col pb-24 md:pb-12">
          {/* Community Cover Banner */}
          <div className="h-44 sm:h-52 w-full relative overflow-hidden bg-gray-200 dark:bg-gray-800">
            <img
              src={selectedCommunity.coverImage}
              alt={selectedCommunity.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Details Bar */}
          <div className="px-4 pb-4 border-b border-[#EFF3F4] dark:border-[#2F3336] relative">
            <div className="flex justify-between items-end -mt-10 mb-3">
              <img
                src={selectedCommunity.avatar}
                alt={selectedCommunity.name}
                className="w-20 h-20 rounded-2xl border-4 border-white dark:border-black object-cover bg-black"
              />
              <button
                onClick={() => handleToggleJoin(selectedCommunity.id)}
                className={`font-bold text-[14px] px-5 py-1.5 rounded-full transition active:scale-95 ${
                  selectedCommunity.isJoined
                    ? 'border border-[#CFD9DE] dark:border-[#536471] text-[#0F1419] dark:text-[#E7E9EA] hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
                    : 'bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] hover:opacity-90'
                }`}
              >
                {selectedCommunity.isJoined ? 'Joined' : 'Join'}
              </button>
            </div>

            <h2 className="text-[20px] font-black text-[#0F1419] dark:text-[#E7E9EA] leading-tight">
              {selectedCommunity.name}
            </h2>
            <div className="flex items-center gap-2 text-[13px] text-[#536471] dark:text-[#71767B] mt-1">
              <span>{selectedCommunity.membersCount.toLocaleString()} members</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                {selectedCommunity.isOpen ? <Globe className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                {selectedCommunity.isOpen ? 'Open community' : 'Restricted membership'}
              </span>
            </div>
            <p className="text-[14px] text-[#0F1419] dark:text-[#E7E9EA] mt-2 leading-relaxed">
              {selectedCommunity.description}
            </p>
          </div>

          {/* Community Timeline Empty / Active Posts */}
          <div className="p-8 text-center flex flex-col items-center">
            <h3 className="font-extrabold text-[20px] text-[#0F1419] dark:text-[#E7E9EA] mb-1">
              Welcome to {selectedCommunity.name}
            </h3>
            <p className="text-[14px] text-[#536471] dark:text-[#71767B] max-w-sm mb-4">
              Be the first to post a new thought or start a discussion in this community.
            </p>
            <button
              onClick={() => navigateTo('create-post')}
              className="bg-[#1D9BF0] hover:bg-[#1A8CD8] text-white font-bold text-[14px] px-5 py-2 rounded-full transition"
            >
              Post to Community
            </button>
          </div>
        </div>
      ) : (
        /* ============================================================== */
        /* VIEW C: COMMUNITIES DISCOVERY DIRECTORY                        */
        /* ============================================================== */
        <div className="flex flex-col pb-24 md:pb-12">
          {/* Top Tabs: Explore vs Joined */}
          <div className="h-[53px] flex border-b border-[#EFF3F4] dark:border-[#2F3336]">
            <button
              onClick={() => setActiveTab('explore')}
              className="flex-1 h-full flex items-center justify-center hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative cursor-pointer"
            >
              <span
                className={`text-[15px] ${
                  activeTab === 'explore'
                    ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                    : 'font-medium text-[#536471] dark:text-[#71767B]'
                }`}
              >
                Explore
              </span>
              {activeTab === 'explore' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('joined')}
              className="flex-1 h-full flex items-center justify-center hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition relative cursor-pointer"
            >
              <span
                className={`text-[15px] ${
                  activeTab === 'joined'
                    ? 'font-bold text-[#0F1419] dark:text-[#E7E9EA]'
                    : 'font-medium text-[#536471] dark:text-[#71767B]'
                }`}
              >
                Joined
              </span>
              {activeTab === 'joined' && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 h-1 bg-[#1D9BF0] rounded-full" />
              )}
            </button>
          </div>

          {/* Category Pills Bar */}
          <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto no-scrollbar border-b border-[#EFF3F4] dark:border-[#2F3336]">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1 rounded-full text-[13px] font-bold whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419]'
                    : 'bg-[#EFF3F4] dark:bg-[#202327] text-[#536471] dark:text-[#71767B] hover:bg-black/10 dark:hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Communities Cards Grid */}
          <div className="flex flex-col divide-y divide-[#EFF3F4] dark:divide-[#2F3336]">
            {filteredCommunities.map((comm) => (
              <div
                key={comm.id}
                onClick={() => setSelectedCommunity(comm)}
                className="p-4 hover:bg-black/[0.02] dark:hover:bg-white/[0.03] cursor-pointer transition flex flex-col gap-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={comm.avatar}
                      alt={comm.name}
                      className="w-12 h-12 rounded-2xl object-cover flex-shrink-0"
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5 font-bold text-[16px] text-[#0F1419] dark:text-[#E7E9EA] truncate">
                        <span className="truncate">{comm.name}</span>
                        {!comm.isOpen && <Lock className="w-3.5 h-3.5 text-[#536471]" />}
                      </div>
                      <span className="text-[13px] text-[#536471] dark:text-[#71767B]">
                        {comm.membersCount.toLocaleString()} members
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleJoin(comm.id);
                    }}
                    className={`font-bold text-[14px] px-5 py-1.5 rounded-full transition active:scale-95 flex-shrink-0 ${
                      comm.isJoined
                        ? 'border border-[#CFD9DE] dark:border-[#536471] text-[#0F1419] dark:text-[#E7E9EA] hover:border-red-500 hover:text-red-500 hover:bg-red-500/10'
                        : 'bg-[#0F1419] dark:bg-[#EFF3F4] text-white dark:text-[#0F1419] hover:opacity-90'
                    }`}
                  >
                    {comm.isJoined ? 'Joined' : 'Join'}
                  </button>
                </div>

                <p className="text-[14px] text-[#536471] dark:text-[#71767B] line-clamp-2 leading-relaxed">
                  {comm.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
