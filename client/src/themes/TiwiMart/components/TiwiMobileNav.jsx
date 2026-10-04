import React from 'react';
import { Home, LayoutGrid, Flame, Heart, ShoppingBag, ArrowLeft } from 'lucide-react';

export default function TiwiMobileNav({
  activeTab,
  cartCount = 0,
  wishlistCount = 0,
  onOpenHome,
  onOpenCategories,
  onOpenDeals,
  onOpenWishlist,
  onOpenCart,
  onOpenAdmin
}) {
  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-2 px-3 z-40 shadow-lg">
      <div className="flex items-center justify-around">
        <button
          onClick={onOpenHome}
          className="flex flex-col items-center text-slate-700 hover:text-[#2563eb]"
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Home</span>
        </button>

        <button
          onClick={onOpenCategories}
          className="flex flex-col items-center text-slate-700 hover:text-[#2563eb]"
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[10px] font-medium mt-0.5">Categories</span>
        </button>

        <button
          onClick={onOpenDeals}
          className="flex flex-col items-center text-rose-600 hover:text-rose-700"
        >
          <Flame className="w-5 h-5 fill-rose-500" />
          <span className="text-[10px] font-bold mt-0.5">Deals</span>
        </button>

        <button
          onClick={onOpenWishlist}
          className="flex flex-col items-center text-slate-700 hover:text-[#2563eb] relative"
        >
          <Heart className="w-5 h-5" />
          {wishlistCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1 rounded-full">
              {wishlistCount}
            </span>
          )}
          <span className="text-[10px] font-medium mt-0.5">Saved</span>
        </button>

        <button
          onClick={onOpenCart}
          className="flex flex-col items-center text-slate-700 hover:text-[#2563eb] relative"
        >
          <ShoppingBag className="w-5 h-5" />
          {cartCount > 0 && (
            <span className="absolute -top-1 -right-2 bg-[#ef4444] text-white text-[9px] font-black px-1 rounded-full">
              {cartCount}
            </span>
          )}
          <span className="text-[10px] font-medium mt-0.5">Cart</span>
        </button>

        {onOpenAdmin && (
          <button
            onClick={onOpenAdmin}
            className="flex flex-col items-center text-blue-600"
            title="Tiwlo Admin"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-[10px] font-bold mt-0.5">Admin</span>
          </button>
        )}
      </div>
    </div>
  );
}
