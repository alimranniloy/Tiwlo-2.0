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
  Check
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
            name: 'Google Design & Material Workspace',
            description: 'Minimal, clean, and spacious UI/UX systems inspired by modern Google products.',
            category: 'Design',
            membersCount: 3120,
            isPrivate: false,
            isJoined: false,
            coverImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=600&h=200&fit=crop',
          },
          {
            id: 'sp_creators',
            name: 'Tiwi Monetized Creators',
            description: 'Best practices for content monetization, sponsorships, and high-fidelity video streams.',
            category: 'Creators',
            membersCount: 1950,
            isPrivate: true,
            isJoined: false,
            coverImage: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=200&fit=crop',
          },
          {
            id: 'sp_startup',
            name: 'SaaS Founders & Indie Hackers',
            description: 'Building, launching, and scaling sustainable products in 2026.',
            category: 'Business',
            membersCount: 2640,
            isPrivate: false,
            isJoined: true,
            coverImage: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=600&h=200&fit=crop',
          },
        ]);
      }
    });
  }, []);

  const handleToggleJoin = (spaceId) => {
    setSpaces((prev) =>
      prev.map((s) => {
        if (s.id === spaceId) {
          const next = !s.isJoined;
          showToast(next ? `Joined "${s.name}"` : `Left "${s.name}"`, 'info');
          return {
            ...s,
            isJoined: next,
            membersCount: next ? s.membersCount + 1 : Math.max(1, s.membersCount - 1),
          };
        }
        return s;
      })
    );

    if (selectedSpace?.id === spaceId) {
      setSelectedSpace((prev) => ({
        ...prev,
        isJoined: !prev.isJoined,
        membersCount: !prev.isJoined ? prev.membersCount + 1 : Math.max(1, prev.membersCount - 1),
      }));
    }
  };

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    if (!newSpaceName.trim()) return;

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
    <div className="w-full flex flex-col min-h-screen max-w-4xl mx-auto">
      {/* 1. Header Bar */}
      <div className="sticky top-0 z-20 bg-[#f8f9fa]/95 dark:bg-[#202124]/95 backdrop-blur-md px-2 py-3 flex items-center justify-between border-b border-[#dadce0] dark:border-[#3c4043] mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (selectedSpace) setSelectedSpace(null);
              else if (showCreateForm) setShowCreateForm(false);
              else navigateTo('feed');
            }}
            className="w-9 h-9 rounded-full hover:bg-[#f1f3f4] dark:hover:bg-[#303134] flex items-center justify-center text-[#5f6368] dark:text-[#9aa0a6] transition cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-[17px] font-medium text-[#202124] dark:text-[#e8eaed] leading-tight">
              {showCreateForm ? 'Create a Space' : selectedSpace ? selectedSpace.name : 'Spaces & Circles'}
            </h1>
            <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
              {selectedSpace ? `${selectedSpace.membersCount.toLocaleString()} members` : 'Connect with shared interest communities'}
            </span>
          </div>
        </div>

        {!selectedSpace && !showCreateForm && (
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-1.5 rounded-md font-medium text-[13px] shadow-xs active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Space</span>
          </button>
        )}
      </div>

      {/* 2. Create Space Form (No Popups!) */}
      {showCreateForm ? (
        <form onSubmit={handleCreateSpace} className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-5 shadow-xs flex flex-col gap-4 max-w-xl mx-auto w-full">
          <div>
            <h2 className="text-[16px] font-medium text-[#202124] dark:text-[#e8eaed]">
              Set up your Space
            </h2>
            <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
              Spaces allow your community to share ideas, post updates, and collaborate.
            </p>
          </div>

          <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-md p-3 focus-within:border-[#1a73e8] bg-white dark:bg-[#202124]">
            <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">
              Space Name
            </label>
            <input
              type="text"
              required
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
              placeholder="e.g. Next.js Developers"
              className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none mt-0.5"
            />
          </div>

          <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-md p-3 focus-within:border-[#1a73e8] bg-white dark:bg-[#202124]">
            <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">
              Category
            </label>
            <select
              value={newSpaceCategory}
              onChange={(e) => setNewSpaceCategory(e.target.value)}
              className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none mt-0.5 cursor-pointer"
            >
              <option value="Technology" className="dark:bg-[#303134]">Technology</option>
              <option value="Design" className="dark:bg-[#303134]">Design</option>
              <option value="Creators" className="dark:bg-[#303134]">Creators</option>
              <option value="Business" className="dark:bg-[#303134]">Business</option>
            </select>
          </div>

          <div className="border border-[#dadce0] dark:border-[#5f6368] rounded-md p-3 focus-within:border-[#1a73e8] bg-white dark:bg-[#202124]">
            <label className="block text-[11px] font-medium text-[#5f6368] dark:text-[#9aa0a6] uppercase tracking-wider">
              Description
            </label>
            <textarea
              rows={3}
              value={newSpaceDesc}
              onChange={(e) => setNewSpaceDesc(e.target.value)}
              placeholder="What is the purpose of this Space?"
              className="w-full bg-transparent text-[14px] text-[#202124] dark:text-[#e8eaed] outline-none resize-none mt-0.5 leading-relaxed"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-1.5 rounded-md text-[13px] font-medium text-[#5f6368] dark:text-[#9aa0a6] hover:bg-[#f1f3f4] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newSpaceName.trim() || submittingSpace}
              className="bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-40 text-white font-medium text-[13px] px-5 py-1.5 rounded-md transition shadow-xs cursor-pointer"
            >
              Create Space
            </button>
          </div>
        </form>
      ) : selectedSpace ? (
        /* 3. Space Drilldown View */
        <div className="flex flex-col gap-4 pb-20">
          <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] overflow-hidden shadow-xs">
            <div className="h-40 w-full bg-gray-200 dark:bg-gray-800">
              <img src={selectedSpace.coverImage} alt={selectedSpace.name} className="w-full h-full object-cover" />
            </div>
            <div className="p-4 flex items-center justify-between">
              <div>
                <h2 className="text-[18px] font-medium text-[#202124] dark:text-[#e8eaed]">
                  {selectedSpace.name}
                </h2>
                <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] mt-0.5">
                  {selectedSpace.description}
                </p>
              </div>
              <button
                onClick={() => handleToggleJoin(selectedSpace.id)}
                className={`font-medium text-[13px] px-5 py-1.5 rounded-md transition cursor-pointer shadow-xs ${
                  selectedSpace.isJoined
                    ? 'border border-[#dadce0] dark:border-[#5f6368] text-[#202124] dark:text-[#e8eaed]'
                    : 'bg-[#1a73e8] text-white hover:bg-[#1557b0]'
                }`}
              >
                {selectedSpace.isJoined ? 'Joined' : 'Join Space'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] p-6 text-center">
            <h3 className="font-medium text-[16px] text-[#202124] dark:text-[#e8eaed] mb-1">
              Start the discussion in {selectedSpace.name}
            </h3>
            <p className="text-[13px] text-[#5f6368] dark:text-[#9aa0a6] mb-4">
              Share an announcement or ask a question to everyone in this Space.
            </p>
            <button
              onClick={() => navigateTo('create-post')}
              className="bg-[#1a73e8] hover:bg-[#1557b0] text-white font-medium text-[13px] px-5 py-2 rounded-md shadow-xs active:scale-95 transition"
            >
              Post to Space
            </button>
          </div>
        </div>
      ) : (
        /* 4. Spaces Catalog */
        <div className="flex flex-col gap-4 pb-20">
          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 px-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1 rounded-full text-[13px] font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#1a73e8] text-white shadow-xs'
                    : 'bg-white dark:bg-[#303134] text-[#5f6368] dark:text-[#9aa0a6] border border-[#dadce0] dark:border-[#3c4043] hover:bg-[#f1f3f4]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Cards Grid (rounded-lg) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {filteredSpaces.map((space) => (
              <div
                key={space.id}
                onClick={() => setSelectedSpace(space)}
                className="bg-white dark:bg-[#303134] rounded-lg border border-[#dadce0] dark:border-[#3c4043] overflow-hidden shadow-xs hover:shadow-sm transition-all duration-150 cursor-pointer flex flex-col justify-between"
              >
                <div className="h-28 w-full relative">
                  <img src={space.coverImage} alt={space.name} className="w-full h-full object-cover" />
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-[15px] text-[#202124] dark:text-[#e8eaed] line-clamp-1">
                      {space.name}
                    </h3>
                    <p className="text-[12px] text-[#5f6368] dark:text-[#9aa0a6] mt-0.5 line-clamp-2 leading-relaxed">
                      {space.description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-[#f1f3f4] dark:border-[#3c4043]">
                    <span className="text-[11px] text-[#5f6368] dark:text-[#9aa0a6]">
                      {space.membersCount.toLocaleString()} members
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleJoin(space.id);
                      }}
                      className={`text-[12px] font-medium px-3.5 py-1 rounded-md transition active:scale-95 cursor-pointer shadow-xs ${
                        space.isJoined
                          ? 'border border-[#dadce0] dark:border-[#5f6368] text-[#202124] dark:text-[#e8eaed]'
                          : 'bg-[#1a73e8] text-white hover:bg-[#1557b0]'
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
