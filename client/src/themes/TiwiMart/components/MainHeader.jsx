import React, { useState } from 'react';
import { Search, Heart, ShoppingBag, ShoppingCart, User, ChevronDown } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function MainHeader({
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  categories = [],
  cartCount = 3,
  wishlistCount = 0,
  onOpenCart,
  onOpenWishlist,
  onOpenAccount
}) {
  const [isCatDropdownOpen, setIsCatDropdownOpen] = useState(false);
  const { storeSettings } = useStoreSettings();

  const primaryColor = storeSettings?.themeColor || '#2563eb';
  const storeName = storeSettings?.storeName || 'TiwloMart';
  const storeTagline = storeSettings?.storeTagline || 'Shop Global • Sell Global';
  const storeLogo = storeSettings?.storeLogo;

  return (
    <div className="bg-white border-b border-slate-100 py-4 px-4 lg:px-8 sticky top-0 z-30 shadow-xs">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-4 lg:gap-8">
        {/* Brand Logo matching user configuration */}
        <div className="flex items-center space-x-3 shrink-0 cursor-pointer select-none">
          <div className="flex items-center space-x-2.5">
            {storeLogo ? (
              <img
                src={storeLogo}
                alt={storeName}
                className="h-10 max-h-12 w-auto max-w-[170px] object-contain drop-shadow-xs"
              />
            ) : (
              <div className="relative flex items-center justify-center">
                {/* Shopping cart icon with custom dynamic color */}
                <div className="relative" style={{ color: primaryColor }}>
                  <ShoppingCart className="w-8 h-8 stroke-[2.3]" />
                  <span
                    className="absolute -left-1.5 top-1.5 w-1.5 h-0.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  ></span>
                  <span
                    className="absolute -left-2.5 top-3 w-2.5 h-0.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  ></span>
                  <span
                    className="absolute -left-1.5 top-4.5 w-1.5 h-0.5 rounded-full"
                    style={{ backgroundColor: primaryColor }}
                  ></span>
                </div>
              </div>
            )}
            <div>
              <div className="flex items-center">
                <span className="text-[25px] font-black tracking-tight text-slate-900 leading-none">
                  {storeName}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-500 tracking-normal mt-0.5">
                {storeTagline}
              </p>
            </div>
          </div>
        </div>

        {/* Central Search Bar with Category Dropdown and Action Button */}
        <div className="flex-1 max-w-3xl hidden md:flex items-center">
          <div
            className="w-full flex items-center border-2 rounded-xl overflow-hidden bg-white shadow-xs focus-within:ring-2"
            style={{ borderColor: primaryColor }}
          >
            {/* Main Search Input */}
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for products, brands and sellers..."
              className="flex-1 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none"
            />

            {/* Category Dropdown Selector */}
            <div className="relative border-l border-slate-200 shrink-0">
              <button
                type="button"
                onClick={() => setIsCatDropdownOpen(!isCatDropdownOpen)}
                className="flex items-center space-x-2 px-3.5 py-2.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white"
              >
                <span className="max-w-[110px] truncate">{selectedCategory || 'All Categories'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {isCatDropdownOpen && (
                <div className="absolute right-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 max-h-60 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedCategory('All Categories');
                      setIsCatDropdownOpen(false);
                    }}
                    className="w-full text-left px-3.5 py-2 text-xs font-semibold hover:bg-blue-50 text-slate-700 hover:text-blue-600 transition"
                  >
                    All Categories
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id || c.name}
                      onClick={() => {
                        setSelectedCategory(c.name);
                        setIsCatDropdownOpen(false);
                      }}
                      className="w-full text-left px-3.5 py-1.5 text-xs hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Dynamic Search Button */}
            <button
              type="button"
              className="text-white px-5 py-3 flex items-center justify-center transition hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              <Search className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Right Header Navigation Icons */}
        <div className="flex items-center space-x-4 lg:space-x-7 shrink-0">
          {/* Wishlist */}
          <button
            onClick={onOpenWishlist}
            className="flex items-center space-x-1.5 text-slate-700 hover:text-[#2563eb] transition group"
          >
            <div className="relative">
              <Heart className="w-5 h-5 text-slate-600 group-hover:text-[#2563eb] transition stroke-[1.8]" />
              {wishlistCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {wishlistCount}
                </span>
              )}
            </div>
            <span className="hidden sm:inline text-xs font-medium text-slate-700 group-hover:text-[#2563eb]">
              Wishlist
            </span>
          </button>

          {/* Cart */}
          <button
            onClick={onOpenCart}
            className="flex items-center space-x-1.5 text-slate-700 hover:text-[#2563eb] transition group"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 text-slate-600 group-hover:text-[#2563eb] transition stroke-[1.8]" />
              <span className="absolute -top-2 -right-2 bg-[#ef4444] text-white text-[10px] font-black px-1.5 py-0.2 rounded-full min-w-4 text-center shadow-xs">
                {cartCount}
              </span>
            </div>
            <span className="hidden sm:inline text-xs font-medium text-slate-700 group-hover:text-[#2563eb]">
              Cart
            </span>
          </button>

          {/* My Account */}
          <button
            onClick={onOpenAccount}
            className="flex items-center space-x-2.5 pl-2 text-left hover:opacity-90 transition group cursor-pointer"
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200 group-hover:border-blue-300">
              <User className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div className="hidden lg:block leading-tight">
              <p className="text-xs font-bold text-slate-900 group-hover:text-[#2563eb] transition">
                My Account
              </p>
              <p className="text-[11px] text-slate-400 font-normal">
                Welcome back!
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Mobile Search Input Row */}
      <div className="md:hidden mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center border border-slate-300 rounded-xl overflow-hidden bg-white shadow-xs">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products, brands..."
            className="flex-1 px-3 py-2 text-xs text-slate-800 outline-none"
          />
          <button className="bg-[#2563eb] text-white px-3.5 py-2">
            <Search className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
