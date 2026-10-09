import React, { useState, useEffect } from 'react';
import {
  Search,
  Star,
  ArrowRight,
  Shield,
  MessageSquare,
  BarChart2,
  TrendingUp,
  Users,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Filter,
  Download,
  RotateCw,
  Sparkles,
  ExternalLink,
  Layers,
  SlidersHorizontal,
  Bot
} from 'lucide-react';
import { WorkspaceAPI } from '../../api/workspaceApi';

export default function MarketplaceView({ onNavigate }) {
  const [products, setProducts] = useState([]);
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
          if (pricing === 'free') return p.price === 'Free' || p.price === 0 || p.pricingModel === 'Free';
          if (pricing === 'paid') return p.price !== 'Free' && p.price !== 0;
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
      console.warn('Could not load marketplace products:', e);
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

  // Google Cloud styled icon renderer
  const renderProductIcon = (iconType) => {
    switch (iconType) {
      case 'shield':
        return (
          <div className="w-11 h-11 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0 border border-[#D2E3FC]">
            <Shield className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'ticket':
        return (
          <div className="w-11 h-11 rounded-lg bg-[#E6F4EA] text-[#137333] flex items-center justify-center shrink-0 border border-[#CEEAD6]">
            <MessageSquare className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'chart':
        return (
          <div className="w-11 h-11 rounded-lg bg-[#FEF7E0] text-[#B06000] flex items-center justify-center shrink-0 border border-[#FEEFC3]">
            <BarChart2 className="w-5 h-5 stroke-[2]" />
          </div>
        );
      case 'trending':
        return (
          <div className="w-11 h-11 rounded-lg bg-[#FCE8E6] text-[#C5221F] flex items-center justify-center shrink-0 border border-[#FAD2CF]">
            <TrendingUp className="w-5 h-5 stroke-[2]" />
          </div>
        );
      default:
        return (
          <div className="w-11 h-11 rounded-lg bg-[#F1F3F4] text-[#5F6368] flex items-center justify-center shrink-0 border border-[#DADCE0]">
            <Bot className="w-5 h-5 stroke-[2]" />
          </div>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 font-sans">
      {/* 1. Google Cloud Console Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#DADCE0] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-normal text-[#202124] tracking-tight">
              Marketplace
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-[#E8F0FE] text-[#1A73E8] font-medium border border-[#D2E3FC]">
              Verified Catalog
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5F6368] mt-1">
            Discover, evaluate, and deploy verified enterprise bots, extensions, and integrations.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadProducts(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-medium text-[#1A73E8] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => onNavigate?.('workspace')}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-medium text-white bg-[#1A73E8] hover:bg-[#174EA6] rounded-md transition-colors shadow-2xs cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Go to Workspace</span>
          </button>
        </div>
      </div>

      {/* 2. Google Cloud Search & Filter Toolbar */}
      <div className="bg-white border border-[#DADCE0] rounded-lg p-3 sm:p-4 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          {/* Search Input Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#5F6368] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search solutions, bots, providers, or capabilities..."
              className="w-full bg-[#F8F9FA] hover:bg-[#F1F3F4] focus:bg-white border border-[#DADCE0] focus:border-[#1A73E8] focus:ring-1 focus:ring-[#1A73E8] rounded-md pl-10 pr-4 py-2 text-[13px] text-[#202124] placeholder-[#5F6368] transition-all outline-none"
            />
          </div>

          {/* Pricing Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={pricing}
              onChange={(e) => setPricing(e.target.value)}
              className="bg-white border border-[#DADCE0] text-[#3C4043] text-[13px] rounded-md px-3 py-2 hover:bg-[#F8F9FA] focus:outline-none focus:border-[#1A73E8] cursor-pointer"
            >
              <option value="all">Pricing: All</option>
              <option value="free">Free</option>
              <option value="paid">Commercial</option>
            </select>

            {/* Sort Selector */}
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-white border border-[#DADCE0] text-[#3C4043] text-[13px] rounded-md px-3 py-2 hover:bg-[#F8F9FA] focus:outline-none focus:border-[#1A73E8] cursor-pointer"
            >
              <option value="recommended">Sort: Recommended</option>
              <option value="rating">Highest Rated</option>
              <option value="installs">Most Installed</option>
              <option value="name">Alphabetical</option>
            </select>
          </div>
        </form>

        {/* Google Cloud Style Category Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-[12px] transition-all cursor-pointer ${
                category === cat.id
                  ? 'bg-[#E8F0FE] text-[#1A73E8] font-medium border border-[#1A73E8]'
                  : 'bg-white text-[#3C4043] border border-[#DADCE0] hover:bg-[#F8F9FA]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Catalog Products Grid */}
      {loading ? (
        <div className="bg-white border border-[#DADCE0] rounded-lg p-16 text-center">
          <RotateCw className="w-6 h-6 text-[#1A73E8] animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[#5F6368]">Loading Marketplace solutions...</p>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-[#DADCE0] rounded-lg p-16 text-center">
          <Bot className="w-10 h-10 text-[#BDC1C6] mx-auto mb-3" />
          <h3 className="text-base font-medium text-[#202124]">No solutions match your search</h3>
          <p className="text-[13px] text-[#5F6368] mt-1 max-w-md mx-auto">
            Try adjusting your search query, clearing filters, or browsing other categories.
          </p>
          <button
            onClick={() => {
              setSearch('');
              setCategory('all');
              setPricing('all');
            }}
            className="mt-4 px-4 py-1.5 text-[13px] font-medium text-[#1A73E8] bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] rounded-md transition-colors cursor-pointer"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product) => (
            <div
              key={product.id}
              onClick={() => onNavigate?.(`marketplace/${product.id}`)}
              className="group bg-white border border-[#DADCE0] hover:border-[#1A73E8] rounded-lg p-5 flex flex-col justify-between transition-all hover:shadow-[0_1px_3px_0_rgba(60,64,67,0.3)] cursor-pointer"
            >
              <div>
                {/* Header: Icon, Name, Provider */}
                <div className="flex items-start gap-3.5 mb-3">
                  {renderProductIcon(product.icon || product.category)}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[14px] font-medium text-[#202124] group-hover:text-[#1A73E8] transition-colors truncate">
                      {product.name}
                    </h3>
                    <p className="text-[12px] text-[#5F6368] truncate">
                      by {product.developer || 'Tiwlo Ecosystem'}
                    </p>
                  </div>
                  {product.verified && (
                    <span className="shrink-0 text-[#1A73E8]" title="Verified Provider">
                      <CheckCircle2 className="w-4 h-4 fill-[#1A73E8] text-white" />
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-[13px] text-[#5F6368] line-clamp-2 leading-relaxed mb-4">
                  {product.description}
                </p>
              </div>

              {/* Footer: Rating, Installs, Price & CTA */}
              <div className="border-t border-[#F1F3F4] pt-3 flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-3 text-[#5F6368]">
                  <div className="flex items-center gap-1 font-medium text-[#202124]">
                    <Star className="w-3.5 h-3.5 fill-[#F29900] text-[#F29900]" />
                    <span>{product.rating ? Number(product.rating).toFixed(1) : '5.0'}</span>
                  </div>
                  <span>•</span>
                  <span>{(product.installCount || 100).toLocaleString()} installs</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`font-medium ${product.price === 'Free' ? 'text-[#137333]' : 'text-[#202124]'}`}>
                    {product.price || 'Free'}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#5F6368] group-hover:text-[#1A73E8] group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
