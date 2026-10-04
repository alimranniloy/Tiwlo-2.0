import React, { useState } from 'react';
import {
  Users,
  Plus,
  Check,
  ArrowLeft,
  Lock,
  Globe,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function CommunityCirclesView() {
  const { navigateTo, showToast } = useSocial();
  const [activeTab, setActiveTab] = useState('explore'); // 'explore' | 'joined'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [newSpaceName, setNewSpaceName] = useState('');
  const [newSpaceDesc, setNewSpaceDesc] = useState('');
  const [newSpaceAccess, setNewSpaceAccess] = useState('open');

  const [spaces, setSpaces] = useState([
    {
      id: 'space_web',
      name: 'Modern Web & React Architects',
      category: 'Technology',
      description: 'A collaborative space for frontend engineers discussing component systems, micro-interactions, and performance.',
      membersCount: 14820,
      isJoined: true,
      isOpen: true,
      coverImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=100&h=100&fit=crop',
    },
    {
      id: 'space_ai',
      name: 'AI Engineering & Agentic Systems',
      category: 'AI',
      description: 'Discussing multimodal agents, structured schema generation, tool-use execution, and local reasoning models.',
      membersCount: 28940,
      isJoined: true,
      isOpen: true,
      coverImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=100&h=100&fit=crop',
    },
    {
      id: 'space_design',
      name: 'Google-Inspired Minimalist UI',
      category: 'Design',
      description: 'Exploring whitespace, semantic colors, Material 3 elevation, and calm digital product craft.',
      membersCount: 9340,
      isJoined: false,
      isOpen: true,
      coverImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1542744094-3a31f272c490?w=100&h=100&fit=crop',
    },
    {
      id: 'space_builders',
      name: 'Bootstrapped Founders Space',
      category: 'Business',
      description: 'Transparent metrics, user onboarding strategies, and customer feedback loops.',
      membersCount: 11200,
      isJoined: false,
      isOpen: false,
      coverImage: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=100&h=100&fit=crop',
    },
  ]);

  const categories = ['All', 'Technology', 'AI', 'Design', 'Business'];

  const handleToggleJoin = (id) => {
    setSpaces((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const next = !s.isJoined;
          showToast(next ? `Joined ${s.name}` : `Left ${s.name}`, 'info');
          return { ...s, isJoined: next, membersCount: s.membersCount + (next ? 1 : -1) };
        }
        return s;
      })
    );
  };

  const handleCreateSpace = (e) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

    const newSpace = {
      id: `space_${Date.now()}`,
      name: newSpaceName.trim(),
      category: 'Technology',
      description: newSpaceDesc.trim() || 'A community space on Tiwi.',
      membersCount: 1,
      isJoined: true,
      isOpen: newSpaceAccess === 'open',
      coverImage: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&h=300&fit=crop',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
    };

    setSpaces((prev) => [newSpace, ...prev]);
    setShowCreateForm(false);
    setNewSpaceName('');
    setNewSpaceDesc('');
    showToast(`Space "${newSpace.name}" created!`, 'info');
  };

  const filteredSpaces = spaces.filter((s) => {
    if (activeTab === 'joined' && !s.isJoined) return false;
    if (selectedCategory !== 'All' && s.category !== selectedCategory) return false;
    return true;
  });

  return (
    <div className="w-full flex flex-col min-h-screen max-w-4xl mx-auto">
      {/* 1. Header App Bar */}
      <div className="sticky top-0 z-20 bg-[#F8FAFD]/90 dark:bg-[#131314]/90 backdrop-blur-md px-2 py-3 flex items-center justify-between border-b border-[#E0E2EC] dark:border-[#313335] mb-4">
        <div className="flex items-center gap-3">
          {selectedSpace || showCreateForm ? (
            <button
              onClick={() => {
                setSelectedSpace(null);
                setShowCreateForm(false);
              }}
              className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => navigateTo('feed')}
              className="w-10 h-10 rounded-full hover:bg-[#E9EEF6] dark:hover:bg-[#282A2C] flex items-center justify-center text-[#444746] dark:text-[#C4C7C5] transition cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div>
            <h1 className="text-[20px] font-extrabold text-[#1F1F1F] dark:text-[#E3E3E3] leading-tight">
              {showCreateForm ? 'Create a Space' : selectedSpace ? selectedSpace.name : 'Community Spaces'}
            </h1>
            <p className="text-[12px] text-[#747775] dark:text-[#8E918F]">
              {selectedSpace ? `${selectedSpace.membersCount.toLocaleString()} members` : 'Connect around shared interests'}
            </p>
          </div>
        </div>

        {!selectedSpace && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 bg-[#0B57D0] hover:bg-[#0842A0] text-white px-4 py-2 rounded-full font-semibold text-[13px] shadow-xs active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Space</span>
          </button>
        )}
      </div>

      {/* 2. Create Space Form (No Popups!) */}
      {showCreateForm ? (
        <form onSubmit={handleCreateSpace} className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-6 shadow-xs flex flex-col gap-5 max-w-xl mx-auto w-full">
          <div>
            <h2 className="text-[18px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
              Set up your Space
            </h2>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F] mt-0.5">
              Spaces allow your community to share ideas, post updates, and collaborate.
            </p>
          </div>

          <div className="border border-[#747775] rounded-2xl p-3 focus-within:border-[#0B57D0] focus-within:ring-1 focus-within:ring-[#0B57D0]">
            <label className="block text-[12px] font-semibold text-[#747775] dark:text-[#8E918F]">
              Space Name
            </label>
            <input
              type="text"
              required
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="e.g. Next.js Developers"
              className="w-full bg-transparent text-[15px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none mt-0.5"
            />
          </div>

          <div className="border border-[#747775] rounded-2xl p-3 focus-within:border-[#0B57D0] focus-within:ring-1 focus-within:ring-[#0B57D0]">
            <label className="block text-[12px] font-semibold text-[#747775] dark:text-[#8E918F]">
              Description
            </label>
            <textarea
              rows={3}
              value={newSpaceDesc}
              onChange={(e) => setNewSpaceDesc(e.target.value)}
              placeholder="What topics are discussed here?"
              className="w-full bg-transparent text-[14px] text-[#1F1F1F] dark:text-[#E3E3E3] outline-none mt-0.5 resize-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-5 py-2 rounded-full font-medium text-[13px] text-[#747775] hover:bg-[#F0F4F9] dark:hover:bg-[#282A2C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newSpaceName.trim()}
              className="bg-[#0B57D0] hover:bg-[#0842A0] disabled:opacity-40 text-white font-semibold text-[13px] px-6 py-2 rounded-full shadow-xs cursor-pointer"
            >
              Create Space
            </button>
          </div>
        </form>
      ) : selectedSpace ? (
        /* 3. Space Drilldown View */
        <div className="flex flex-col gap-4 pb-20">
          <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] overflow-hidden shadow-xs">
            <div className="h-44 w-full bg-gray-200 dark:bg-gray-800">
              <img src={selectedSpace.coverImage} alt={selectedSpace.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-5 flex items-center justify-between">
              <div>
                <h2 className="text-[20px] font-bold text-[#1F1F1F] dark:text-[#E3E3E3]">
                  {selectedSpace.name}
                </h2>
                <p className="text-[13px] text-[#747775] dark:text-[#8E918F] mt-1">
                  {selectedSpace.description}
                </p>
              </div>
              <button
                onClick={() => handleToggleJoin(selectedSpace.id)}
                className={`font-semibold text-[13px] px-5 py-2 rounded-full transition cursor-pointer shadow-xs ${
                  selectedSpace.isJoined
                    ? 'border border-[#747775] text-[#1F1F1F] dark:text-[#E3E3E3]'
                    : 'bg-[#0B57D0] text-white'
                }`}
              >
                {selectedSpace.isJoined ? 'Joined' : 'Join Space'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] p-8 text-center">
            <h3 className="font-bold text-[18px] text-[#1F1F1F] dark:text-[#E3E3E3] mb-1">
              Start the discussion in {selectedSpace.name}
            </h3>
            <p className="text-[13px] text-[#747775] dark:text-[#8E918F] mb-4">
              Share an update or ask a question to everyone in this Space.
            </p>
            <button
              onClick={() => navigateTo('create-post')}
              className="bg-[#0B57D0] hover:bg-[#0842A0] text-white font-semibold text-[13px] px-5 py-2 rounded-full shadow-xs cursor-pointer"
            >
              Post to Space
            </button>
          </div>
        </div>
      ) : (
        /* 4. Spaces Grid */
        <div className="flex flex-col gap-4 pb-20">
          {/* Category Chips Bar */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0B57D0] text-white shadow-xs'
                    : 'bg-white dark:bg-[#1E1F20] text-[#444746] dark:text-[#C4C7C5] border border-[#E0E2EC] dark:border-[#313335] hover:bg-[#F0F4F9]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredSpaces.map((space) => (
              <div
                key={space.id}
                onClick={() => setSelectedSpace(space)}
                className="bg-white dark:bg-[#1E1F20] rounded-3xl border border-[#E0E2EC] dark:border-[#313335] overflow-hidden shadow-xs hover:shadow-sm transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div className="h-32 w-full relative">
                  <img src={space.coverImage} alt={space.name} className="w-full h-full object-cover" />
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-[16px] text-[#1F1F1F] dark:text-[#E3E3E3] line-clamp-1">
                      {space.name}
                    </h3>
                    <p className="text-[13px] text-[#747775] dark:text-[#8E918F] mt-1 line-clamp-2 leading-relaxed">
                      {space.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#E0E2EC]/70 dark:border-[#313335]">
                    <span className="text-[12px] text-[#747775] dark:text-[#8E918F]">
                      {space.membersCount.toLocaleString()} members
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleJoin(space.id);
                      }}
                      className={`text-[12px] font-semibold px-4 py-1.5 rounded-full transition active:scale-95 cursor-pointer shadow-xs ${
                        space.isJoined
                          ? 'border border-[#747775] text-[#1F1F1F] dark:text-[#E3E3E3]'
                          : 'bg-[#0B57D0] text-white hover:bg-[#0842A0]'
                      }`}
                    >
                      {space.isJoined ? 'Joined' : 'Join'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
