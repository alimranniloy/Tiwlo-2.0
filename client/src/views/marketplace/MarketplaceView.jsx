import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  ArrowRight,
  Shield,
  MessageSquare,
  BarChart2,
  TrendingUp,
  CheckCircle2,
  RotateCw,
  Layers,
  Bot
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function MarketplaceView({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [pricing, setPricing] = useState('all');
  const [provider, setProvider] = useState('all');
  const [rating, setRating] = useState('all');
  const [sort, setSort] = useState('recommended');

  const categories = [
    { id: 'all', label: 'All solutions' },
    { id: 'moderation', label: 'Moderation & Safety' },
    { id: 'community', label: 'Community & Engagement' },
    { id: 'support', label: 'Support & Ticketing' },
    { id: 'analytics', label: 'Analytics & Insights' }
  ];

  const loadProducts = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    try {
      const allCatalog = await WorkspaceAPI.getMarketplaceCatalog();
      let list = Array.isArray(allCatalog) ? allCatalog : [];

      // Filter by category
      if (category !== 'all') {
        list = list.filter((p) => p.category?.toLowerCase() === category.toLowerCase());
      }
      // Filter by pricing
      if (pricing !== 'all') {
        list = list.filter((p) => {
          if (pricing === 'free') return ['free', 'freemium'].includes(String(p.pricingType || '').toLowerCase());
          if (pricing === 'paid') return String(p.pricingType || '').toLowerCase() === 'paid';
          return true;
        });
      }
      // Filter by search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        list = list.filter((p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.developer?.toLowerCase().includes(q)
        );
      }
      // Filter by provider
      if (provider !== 'all') {
        list = list.filter((p) => p.developer?.toLowerCase().includes(provider.toLowerCase()));
      }
      // Filter by rating
      if (rating !== 'all') {
        const minRating = parseFloat(rating);
        list = list.filter((p) => (p.rating || 0) >= minRating);
      }
      // Sort
      if (sort === 'rating') {
        list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      } else if (sort === 'installs') {
        list.sort((a, b) => (b.installCount || 0) - (a.installCount || 0));
      } else if (sort === 'name') {
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      }

      setProducts(list);
    } catch (e) {
      setLoadError(e.message || 'Could not load Marketplace products.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [category, pricing, provider, rating, sort]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadProducts();
  };

  const renderProductIcon = (iconType) => {
    switch (iconType) {
      case 'shield':
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] text-[#0B57D0] flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#C4EED0] text-[#072711] flex items-center justify-center shrink-0">
            <MessageSquare className="w-6 h-6 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#FEEDAD] text-[#2C1F00] flex items-center justify-center shrink-0">
            <BarChart2 className="w-6 h-6 stroke-[2]" />
          </div>
        );
      case 'trending':
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#FCE8E6] text-[#B3261E] flex items-center justify-center shrink-0">
            <TrendingUp className="w-6 h-6 stroke-[2]" />
          </div>
        );
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-[#F0F4F9] text-[#444746] flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 stroke-[2]" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans bg-white">
      {/* 1. Modern Google Marketplace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E0E2EC] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-normal text-[#1F1F1F] tracking-tight">
              Marketplace
            </h1>
            <span className="text-xs px-3 py-1 rounded-full bg-[#E8F0FE] text-[#0B57D0] font-medium">
              Verified Solutions
            </span>
          </div>
          <p className="text-sm text-[#444746] mt-1">
            Discover, evaluate, and provision enterprise-verified bots, server extensions, and automations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadProducts(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F2F6FC] rounded-full transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigate?.('workspace')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-medium text-white bg-[#0B57D0] hover:bg-[#0842A0] rounded-full transition-all shadow-xs cursor-pointer"
          >
            <Layers className="w-4 h-4" />
            <span>Go to Workspace</span>
          </button>
        </div>
      </div>

      {/* 2. Modern Google Omnibox & Filter Chips Toolbar */}
      <div className="bg-[#F8FAFD] border border-[#E0E2EC] rounded-2xl p-4 sm:p-5 space-y-4">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          {/* Omnibox Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#444746] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search solutions, bots, providers, or capabilities..."
              className="w-full bg-white hover:bg-[#F0F4F9] focus:bg-white border border-[#E0E2EC] focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0] rounded-full pl-11 pr-4 py-2.5 text-[13px] text-[#1F1F1F] placeholder-[#444746] transition-all outline-none"
            />
          </div>

          {/* Pricing Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              className="bg-white border border-[#E0E2EC] text-[#1F1F1F] text-[13px] rounded-full px-4 py-2 hover:bg-[#F2F6FC] focus:outline-none focus:border-[#0B57D0] cursor-pointer"
            >
              <option value="all">Pricing: All</option>
              <option value="free">Free</option>
              <option value="paid">Commercial</option>
            </select>

            {/* Sort Selector */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-white border border-[#E0E2EC] text-[#1F1F1F] text-[13px] rounded-full px-4 py-2 hover:bg-[#F2F6FC] focus:outline-none focus:border-[#0B57D0] cursor-pointer"
            >
              <option value="recommended">Sort: Recommended</option>
              <option value="rating">Highest Rated</option>
              <option value="installs">Most Installed</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </form>

        {/* Modern Google Material 3 Category Pill Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] transition-all cursor-pointer ${
                category === cat.id
                  ? 'bg-[#C2E7FF] text-[#001D35] font-semibold shadow-xs'
                  : 'bg-white text-[#444746] border border-[#747775]/30 hover:bg-[#F2F6FC]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Catalog Products Grid (Modern Google 2026 Cards) */}
      {loading ? (
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-16 text-center">
          <RotateCw className="w-6 h-6 text-[#0B57D0] animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[#444746]">Loading Marketplace solutions...</p>
        </div>
      ) : loadError ? (
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-16 text-center text-[13px] text-[#B3261E]">{loadError}</div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-[#E0E2EC] rounded-2xl p-16 text-center">
          <Bot className="w-12 h-12 text-[#C4C7C5] mx-auto mb-3" />
          <h3 className="text-base font-medium text-[#1F1F1F]">{search || category !== 'all' || pricing !== 'all' ? 'No solutions match your filters' : 'No published Marketplace products'}</h3>
          <p className="text-[13px] text-[#444746] mt-1 max-w-md mx-auto">
            Try adjusting your query or resetting filters to browse all verified extensions.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setCategory('all');
              setPricing('all');
            }}
            className="mt-4 px-5 py-2 text-[13px] font-medium text-[#0B57D0] bg-white border border-[#747775]/30 hover:bg-[#F2F6FC] rounded-full transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => onNavigate?.(`marketplace/${product.id}`)}
              className="group bg-white border border-[#E0E2EC] hover:border-[#0B57D0] rounded-2xl p-6 flex flex-col justify-between transition-all hover:shadow-md cursor-pointer"
            >
              <div>
                {/* Header: Icon, Name, Provider */}
                <div className="flex items-start gap-4 mb-3.5">
                  {product.logoUrl ? (
                    <img src={product.logoUrl} alt="" className="w-12 h-12 rounded-2xl object-contain shrink-0" />
                  ) : renderProductIcon(product.iconType || product.category)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[15px] font-medium text-[#1F1F1F] group-hover:text-[#0B57D0] transition-colors truncate">
                      {product.name}
                    </h3>
                    <p className="text-[12px] text-[#444746] truncate mt-0.5">
                      by {product.developer || 'Publisher not specified'}
                    </p>
                  </div>
                  {product.verified && (
                    <span className="shrink-0 text-[#0B57D0]" title="Verified Provider">
                      <CheckCircle2 className="w-4 h-4 fill-[#0B57D0] text-white" />
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-[13px] text-[#444746] line-clamp-2 leading-relaxed mb-4">
                  {product.description}
                </p>
              </div>

              {/* Footer: Rating, Installs, Price & CTA */}
              <div className="border-t border-[#F1F3F8] pt-3.5 flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-3 text-[#444746]">
                  {product.rating != null && <span className="flex items-center gap-1 font-medium text-[#1F1F1F]"><Star className="w-3.5 h-3.5 fill-[#F29900] text-[#F29900]" />{Number(product.rating).toFixed(1)}</span>}
                  {product.installCount != null && <span>{Number(product.installCount).toLocaleString()} installs</span>}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${product.price === 'Free' ? 'text-[#072711]' : 'text-[#1F1F1F]'}`}>
                    {product.price || 'Pricing not specified'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#444746] group-hover:text-[#0B57D0] group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
