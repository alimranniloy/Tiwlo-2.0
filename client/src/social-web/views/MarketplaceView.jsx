import React, { useState } from 'react';
import {
  ShoppingBag,
  Search,
  MapPin,
  Tag,
  Plus,
  Heart,
  MessageCircle,
  Share2,
  CheckCircle2,
  Star,
  Sparkles,
  SlidersHorizontal
} from 'lucide-react';
import { useSocial } from '../context/SocialContext';

export default function MarketplaceView() {
  const { currentUser, navigateTo, showToast } = useSocial();
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedItems, setSavedItems] = useState({});

  const categories = [
    'All Items',
    'Electronics & Gadgets',
    'Office & Workspace',
    'Cameras & Gear',
    'Audio & Sound',
    'Design Books'
  ];

  const products = [
    {
      id: 'prod_1',
      title: 'Apple Studio Display 27-inch 5K with Tilt Stand',
      price: '$1,299',
      location: 'San Francisco, CA',
      distance: '2.4 miles away',
      condition: 'Like New',
      category: 'Electronics & Gadgets',
      image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&h=450&fit=crop',
      seller: {
        name: 'Alexander Wright',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
        rating: '4.9 (42 reviews)'
      }
    },
    {
      id: 'prod_2',
      title: 'Herman Miller Aeron Ergonomic Chair - Size B Graphite',
      price: '$780',
      location: 'Oakland, CA',
      distance: '6.1 miles away',
      condition: 'Excellent',
      category: 'Office & Workspace',
      image: 'https://images.unsplash.com/photo-1580481077195-c3a82145d875?w=600&h=450&fit=crop',
      seller: {
        name: 'Sophia Martinez',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
        rating: '5.0 (18 reviews)'
      }
    },
    {
      id: 'prod_3',
      title: 'Sony Alpha A7 IV Full-Frame Camera Body + 24-70mm GM',
      price: '$1,850',
      location: 'San Jose, CA',
      distance: '12 miles away',
      condition: 'Mint / Boxed',
      category: 'Cameras & Gear',
      image: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=600&h=450&fit=crop',
      seller: {
        name: 'David Kim',
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop',
        rating: '4.8 (31 reviews)'
      }
    },
    {
      id: 'prod_4',
      title: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
      price: '$165',
      location: 'Berkeley, CA',
      distance: '4.8 miles away',
      condition: 'Brand New',
      category: 'Electronics & Gadgets',
      image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&h=450&fit=crop',
      seller: {
        name: 'Marcus Chen',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
        rating: '4.9 (15 reviews)'
      }
    },
    {
      id: 'prod_5',
      title: 'Universal Audio Apollo Twin X Thunderbolt Interface',
      price: '$720',
      location: 'San Francisco, CA',
      distance: '1.5 miles away',
      condition: 'Like New',
      category: 'Audio & Sound',
      image: 'https://images.unsplash.com/photo-1598488035139-bdbb2231ce04?w=600&h=450&fit=crop',
      seller: {
        name: 'Lucas Dupont',
        avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=100&h=100&fit=crop',
        rating: '5.0 (9 reviews)'
      }
    },
    {
      id: 'prod_6',
      title: 'Dieter Rams: As Little Design as Possible Hardcover',
      price: '$65',
      location: 'San Francisco, CA',
      distance: '3.0 miles away',
      condition: 'New in Shrinkwrap',
      category: 'Design Books',
      image: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&h=450&fit=crop',
      seller: {
        name: 'Elena Rostova',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop',
        rating: '4.9 (24 reviews)'
      }
    }
  ];

  const handleToggleSave = (id, title) => {
    const next = !savedItems[id];
    setSavedItems((prev) => ({ ...prev, [id]: next }));
    showToast(next ? `Saved "${title}" to your wishlist` : `Removed "${title}"`, 'info');
  };

  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'All Items' || p.category === selectedCategory;
    const matchesQuery = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.location.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  return (
    <div className="w-full flex flex-col gap-5 pb-20">
      {/* 1. Header Card */}
      <div className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.02)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#1E75FF]/10 text-[#1E75FF] flex items-center justify-center flex-shrink-0">
            <ShoppingBag className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-[#111827] dark:text-white tracking-tight flex items-center gap-2">
              Marketplace
              <span className="text-[12px] font-semibold bg-[#1E75FF]/10 text-[#1E75FF] px-2.5 py-0.5 rounded-full">
                Verified Community
              </span>
            </h1>
            <p className="text-[13px] text-[#6B7280] dark:text-[#9CA3AF] flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-[#1E75FF]" />
              <span>San Francisco Bay Area • Within 25 miles</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-[38px] pl-9 pr-3 bg-[#F4F5F7] dark:bg-[#1A1D27] text-[13px] rounded-xl outline-none focus:ring-2 focus:ring-[#1E75FF]/30 transition"
            />
            <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-2.5" />
          </div>

          <button
            type="button"
            onClick={() => showToast('Create listing opened', 'info')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#1E75FF] hover:bg-[#1A66E5] text-white text-[12.5px] font-bold shadow-xs transition cursor-pointer flex-shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Create Listing</span>
          </button>
        </div>
      </div>

      {/* 2. Category Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#1E75FF] text-white shadow-xs'
                : 'bg-white dark:bg-[#161822] text-[#6B7280] dark:text-[#9CA3AF] hover:text-[#111827] border border-[#EAECF0] dark:border-[#1E232F]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 3. Product Listings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {filteredProducts.map((prod) => {
          const isSaved = savedItems[prod.id];
          return (
            <div
              key={prod.id}
              className="bg-white dark:bg-[#161822] rounded-2xl border border-[#EAECF0] dark:border-[#1E232F] overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.02)] hover:shadow-md transition flex flex-col justify-between group"
            >
              {/* Product Image */}
              <div className="relative aspect-[4/3] bg-gray-100 dark:bg-gray-800 overflow-hidden">
                <img
                  src={prod.image}
                  alt={prod.title}
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                />
                {/* Condition Badge */}
                <span className="absolute top-3 left-3 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  {prod.condition}
                </span>

                {/* Save Heart Button */}
                <button
                  type="button"
                  onClick={() => handleToggleSave(prod.id, prod.title)}
                  className={`absolute top-3 right-3 p-2 rounded-full backdrop-blur-md transition cursor-pointer shadow-md ${
                    isSaved
                      ? 'bg-rose-500 text-white'
                      : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                  title="Save Item"
                >
                  <Heart className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Product Info */}
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[19px] font-extrabold text-[#111827] dark:text-white">
                      {prod.price}
                    </span>
                    <span className="text-[11px] font-semibold text-[#1E75FF] bg-[#1E75FF]/10 px-2 py-0.5 rounded-md">
                      {prod.category}
                    </span>
                  </div>

                  <h3 className="font-bold text-[14px] text-[#374151] dark:text-[#E2E8F0] line-clamp-2 leading-snug group-hover:text-[#1E75FF] transition-colors">
                    {prod.title}
                  </h3>

                  <p className="text-[12px] text-[#9CA3AF] mt-1.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-gray-400" />
                    <span>{prod.location} • {prod.distance}</span>
                  </p>
                </div>

                {/* Seller & Action */}
                <div className="pt-3 border-t border-[#F2F4F7] dark:border-[#1E232F] flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <img
                      src={prod.seller.avatar}
                      alt={prod.seller.name}
                      className="w-7 h-7 rounded-full object-cover ring-1 ring-black/5"
                    />
                    <span className="text-[12px] font-medium text-[#4B5563] dark:text-[#9CA3AF] truncate">
                      {prod.seller.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigateTo('messages', prod.seller.name);
                      showToast(`Chat started with ${prod.seller.name}`, 'info');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1E75FF] hover:bg-[#1A66E5] text-white text-[12px] font-bold transition cursor-pointer shadow-xs"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Message
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
