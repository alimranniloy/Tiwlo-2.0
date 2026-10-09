import React, { useState, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  Star,
  ArrowRight,
  Shield,
  MessageSquare,
  BarChart2,
  TrendingUp,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { DiscordAPI } from '../api/discordApi';

export default function MarketplaceView({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [pricing, setPricing] = useState('all');
  const [provider, setProvider] = useState('all');
  const [rating, setRating] = useState('all');
  const [sort, setSort] = useState('recommended');

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await DiscordAPI.getMarketplace({
        category: category !== 'all' ? category : undefined,
        pricing: pricing !== 'all' ? pricing : undefined,
        search: search.trim() || undefined,
        sort
      });
      let list = res.products || [];
      if (provider !== 'all') {
        list = list.filter((p) => p.developer.toLowerCase().includes(provider.toLowerCase()));
      }
      if (rating !== 'all') {
        const minRating = parseFloat(rating);
        list = list.filter((p) => p.rating >= minRating);
      }
      setProducts(list);
    } catch (e) {
      console.warn('Could not load marketplace products:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [category, pricing, provider, rating, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadProducts();
  };

  // Icon mapping helper
  const renderProductIcon = (iconType) => {
    switch (iconType) {
      case 'shield':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#0F2D6B] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-6 h-6 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-xs">
            <MessageSquare className="w-6 h-6 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#7C3AED] text-white flex items-center justify-center shrink-0 shadow-xs">
            <BarChart2 className="w-6 h-6 stroke-[2]" />
          </div>
        );
      case 'trending':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#0284C7] text-white flex items-center justify-center shrink-0 shadow-xs">
            <TrendingUp className="w-6 h-6 stroke-[2]" />
          </div>
        );
      case 'users':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#16A34A] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Users className="w-6 h-6 stroke-[2]" />
          </div>
        );
      case 'calendar':
        return (
          <div className="w-12 h-12 rounded-xl bg-[#2563EB] text-white flex items-center justify-center shrink-0 shadow-xs">
            <Calendar className="w-6 h-6 stroke-[2]" />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Shield className="w-6 h-6" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* 1. Header */}
      <div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight">
          Marketplace
        </h1>
        <p className="text-gray-500 text-base mt-1">
          Discover trusted bots and services for your Discord community.
        </p>
      </div>

      {/* 2. Main Search Bar */}
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Marketplace"
            className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-12 pr-4 py-3 text-sm sm:text-base text-[#0F172A] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-xs transition-all"
          />
        </div>
        <button
          type="submit"
          className="px-5 sm:px-6 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      </form>

      {/* 3. Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Category Dropdown */}
          <div className="relative">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 pr-8 text-sm font-medium text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Category</option>
              <option value="security & moderation">Security & moderation</option>
              <option value="customer support">Customer support</option>
              <option value="community engagement">Community engagement</option>
              <option value="analytics">Analytics</option>
              <option value="onboarding">Onboarding</option>
              <option value="events & scheduling">Events & scheduling</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Pricing Dropdown */}
          <div className="relative">
            <select
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 pr-8 text-sm font-medium text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Pricing</option>
              <option value="free">Free</option>
              <option value="paid">Paid</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Provider Dropdown */}
          <div className="relative">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 pr-8 text-sm font-medium text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Provider</option>
              <option value="sentinel labs">Sentinel Labs</option>
              <option value="flow labs">Flow Labs</option>
              <option value="orbit studio">Orbit Studio</option>
              <option value="metric labs">Metric Labs</option>
              <option value="hello studio">Hello Studio</option>
              <option value="gather">Gather</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Rating Dropdown */}
          <div className="relative">
            <select
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 pr-8 text-sm font-medium text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
            >
              <option value="all">Rating</option>
              <option value="4.8">4.8 & up</option>
              <option value="4.6">4.6 & up</option>
            </select>
            <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="appearance-none bg-white border border-[#E2E8F0] rounded-xl px-3.5 py-2 pr-8 text-sm font-medium text-[#1E293B] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
          >
            <option value="recommended">Sort: Recommended</option>
            <option value="rating">Sort: Highest Rating</option>
            <option value="name">Sort: Name (A-Z)</option>
          </select>
          <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* 4. Curated Collection Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#F0F7FF] via-[#F5FAFF] to-[#EFF6FF] border border-[#BFDBFE]/60 p-6 sm:p-8 flex items-center justify-between shadow-xs">
        <div className="relative z-10 max-w-xl">
          <span className="text-xs font-bold text-[#2563EB] tracking-wider uppercase inline-block mb-1">
            Curated Collection
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0F172A] tracking-tight">
            Build a better community
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Explore tools for moderation, support and growth.
          </p>
          <button
            onClick={() => {
              setCategory('all');
              setSearch('');
            }}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2563EB] hover:text-[#1D4ED8] mt-4 transition-colors cursor-pointer"
          >
            <span>Explore collection</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Subtle geometric wave design on right */}
        <div className="hidden sm:block absolute right-0 top-0 bottom-0 w-80 pointer-events-none opacity-80">
          <svg viewBox="0 0 300 160" fill="none" className="w-full h-full">
            <circle cx="240" cy="80" r="60" stroke="#93C5FD" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="210" cy="110" r="40" stroke="#60A5FA" strokeWidth="1.5" />
            <rect x="230" y="40" width="50" height="50" rx="8" stroke="#93C5FD" strokeWidth="1.5" />
            <circle cx="260" cy="50" r="16" fill="#DBEAFE" />
            <circle cx="200" cy="110" r="12" fill="#EFF6FF" />
          </svg>
        </div>
      </div>

      {/* 5. Recommended Products Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#0F172A]">Recommended products</h2>
          <span className="text-sm text-gray-500 font-medium">
            Showing {products.length} of 128 products
          </span>
        </div>

        {/* Products Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Header: Icon + Details */}
                <div className="flex items-start gap-4">
                  {renderProductIcon(product.iconType)}
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-[#0F172A] truncate">
                      {product.name}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">
                      by {product.developer}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {product.category}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mt-4 leading-relaxed line-clamp-2">
                  {product.description}
                </p>
              </div>

              {/* Bottom Row: Rating, Divider, Pricing, View product */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between text-xs font-medium text-gray-600">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-[#0F172A] font-bold">
                    <Star className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
                    <span>{product.rating}</span>
                    <span className="text-gray-400 font-normal">({product.reviewsCount})</span>
                  </div>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-600 font-normal truncate max-w-[110px]">
                    {product.pricingLabel}
                  </span>
                </div>

                <button
                  onClick={() => onNavigate(`/discord/marketplace/${product.id}`)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors cursor-pointer shrink-0"
                >
                  <span>View product</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 6. Bottom Pagination Bar */}
        <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100 text-sm text-gray-500">
          <span>1–{products.length} of 128 products</span>
          <div className="flex items-center gap-1">
            <button
              disabled
              className="p-1.5 rounded-lg border border-[#E2E8F0] text-gray-300 disabled:opacity-40 cursor-not-allowed"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {}}
              className="p-1.5 rounded-lg border border-[#E2E8F0] text-gray-600 hover:bg-gray-50 cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
