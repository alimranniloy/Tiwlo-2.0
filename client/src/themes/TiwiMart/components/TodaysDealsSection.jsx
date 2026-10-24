import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Heart, Star, ShoppingBag } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';
import { formatStoreCurrency, getProductDiscount } from '../storefrontUtils';

export default function TodaysDealsSection({
  products = [],
  wishlist = [],
  onToggleWishlist,
  onAddToCart,
  onViewProduct
}) {
  const scrollRef = useRef(null);
  const { storeSettings } = useStoreSettings();
  const primaryColor = storeSettings?.themeColor || '#2563eb';

  const dealProducts = products;

  if (!dealProducts.length) return null;

  const scroll = (direction) => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const offset = direction === 'left' ? -clientWidth * 0.75 : clientWidth * 0.75;
      scrollRef.current.scrollTo({ left: scrollLeft + offset, behavior: 'smooth' });
    }
  };

  return (
    <section id="store-products" className="max-w-[1440px] mx-auto px-4 lg:px-8 py-5">
      {/* Header matching screenshot */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline space-x-2.5">
          <div className="w-1.5 h-5 bg-[#ef4444] rounded-full self-center"></div>
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">Store Products</h2>
        </div>

        <div className="flex items-center space-x-4">
          {/* Arrow navigation buttons matching screenshot */}
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => scroll('left')}
              className="w-7 h-7 rounded-full border border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-[#2563eb] flex items-center justify-center transition shadow-2xs"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="w-7 h-7 rounded-full border border-slate-300 hover:border-blue-500 hover:bg-blue-50 text-slate-600 hover:text-[#2563eb] flex items-center justify-center transition shadow-2xs"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Products Row matching screenshot */}
      <div
        ref={scrollRef}
        className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5 overflow-x-auto no-scrollbar scroll-smooth py-1"
      >
        {dealProducts.map((prod) => {
          const discount = getProductDiscount(prod);
          const isWishlisted = wishlist.includes(prod.id);

          return (
            <div
              key={prod.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-lg hover:border-blue-300 p-3.5 flex flex-col justify-between transition-all duration-200 group relative select-none"
            >
              {/* Top row: Discount pill & Wishlist heart button */}
              <div className="flex items-center justify-between z-10">
                {discount && (
                  <span className="bg-[#ef4444] text-white text-[10px] font-black px-1.5 py-0.5 rounded shadow-2xs">
                    -{discount.percent}%
                  </span>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleWishlist?.(prod.id);
                  }}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition ${
                    isWishlisted ? 'text-[#ef4444]' : 'text-slate-400 hover:text-[#ef4444]'
                  }`}
                  title="Save to wishlist"
                >
                  <Heart
                    className={`w-4 h-4 ${isWishlisted ? 'fill-[#ef4444]' : 'stroke-[1.8]'}`}
                  />
                </button>
              </div>

              {/* Product Image on Clean White Canvas - Direct Navigation to Product Detail Page (NO POPUP!) */}
              <div
                onClick={() => onViewProduct?.(prod)}
                className="w-full h-36 flex items-center justify-center my-2 cursor-pointer overflow-hidden relative"
              >
                <img
                  src={prod.image || prod.images?.[0]}
                  alt={prod.name}
                  className="max-h-32 max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
              </div>

              {/* Product Info */}
              <div className="space-y-1">
                {/* Title matching screenshot - Direct Navigation to Product Detail Page (NO POPUP!) */}
                <h3
                  onClick={() => onViewProduct?.(prod)}
                  className="text-xs font-bold text-slate-900 line-clamp-1 group-hover:text-[#2563eb] transition cursor-pointer"
                  title={prod.name}
                >
                  {prod.name}
                </h3>

                {prod.rating != null && (
                <div className="flex items-center space-x-1.5 text-[11px]">
                  <div className="flex items-center text-amber-400">
                    <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                  </div>
                  <span className="font-bold text-slate-700 text-[10.5px]">
                    {prod.rating}
                  </span>
                  <span className="text-slate-400 text-[10px]">
                    {prod.reviews != null ? `(${prod.reviews})` : ''}
                  </span>
                </div>
                )}

                {/* Price & Original Price */}
                <div className="flex items-baseline space-x-2 pt-0.5">
                  <span className="text-[13.5px] font-black text-slate-900 tracking-tight">
                    {formatStoreCurrency(prod.price, storeSettings)}
                  </span>
                  {discount && (
                    <span className="text-[11px] text-slate-400 line-through font-normal">
                      {formatStoreCurrency(discount.originalPrice, storeSettings)}
                    </span>
                  )}
                </div>

                {/* Add to Cart Button - Directly adds item to cart without popups */}
                <button
                  type="button"
                  onClick={() => onAddToCart?.(prod)}
                  className="w-full mt-2.5 py-1.5 px-3 rounded-lg border text-[11px] font-bold transition-all duration-150 flex items-center justify-center space-x-1 shadow-2xs active:scale-98 cursor-pointer"
                  style={{
                    borderColor: primaryColor,
                    color: primaryColor,
                    backgroundColor: `${primaryColor}0d`
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = primaryColor;
                    e.currentTarget.style.color = '#ffffff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = `${primaryColor}0d`;
                    e.currentTarget.style.color = primaryColor;
                  }}
                >
                  <ShoppingBag className="w-3 h-3" />
                  <span>Add to Cart</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
