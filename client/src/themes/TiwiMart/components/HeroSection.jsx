import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  Shirt,
  Home,
  Sparkles,
  Trophy,
  Gamepad2,
  Car,
  HeartPulse,
  Wrench,
  Grid,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function HeroSection({
  selectedCategory,
  onSelectCategory,
  onShopFlashSale,
  onExploreNewArrivals,
  onBecomeSeller
}) {
  const { storeSettings } = useStoreSettings();
  const primaryColor = storeSettings?.themeColor || '#2563eb';
  // Flash sale countdown timer (ticks live)
  const [timeLeft, setTimeLeft] = useState({ hours: 2, minutes: 14, seconds: 36 });

  // Banner Sliding System State (100% PURE BANNER IMAGES, ZERO TEXT CODING ON CENTER BANNER)
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Live countdown timer for the Flash Sale card
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 2, minutes: 14, seconds: 36 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const format2 = (num) => String(num).padStart(2, '0');

  // Dynamic Banner Sliding System from Store Settings
  const configuredBanners = (Array.isArray(storeSettings?.heroBanners) && storeSettings.heroBanners.length > 0)
    ? storeSettings.heroBanners.filter(b => b.active !== false)
    : [];

  const bannerSlides = configuredBanners.length > 0 ? configuredBanners : [
    {
      id: 'slide-1',
      image: '/banners/hero_banner_main.png',
      alt: 'Global Marketplace - Discover Amazing Products from Millions of Sellers',
      title: 'Global Marketplace Super Sale',
      link: '/?view=store#flash-sale'
    },
    {
      id: 'slide-2',
      image: '/banners/hero_banner_tech.jpg',
      alt: 'Upgrade Your Digital World - Limited Time Offers',
      title: 'Next-Gen Tech & Electronics',
      link: '/?view=store#deals'
    },
    {
      id: 'slide-3',
      image: '/banners/hero_banner_shipping.jpg',
      alt: 'Worldwide Fast Delivery - Reliable Global Cargo',
      title: 'Worldwide Express Freight Delivery',
      link: '/?view=store'
    }
  ];

  // Auto-slide configured from store settings (default 5s)
  const slideIntervalMs = Math.max(2, Number(storeSettings?.bannerSlidingSpeed) || 5) * 1000;

  useEffect(() => {
    if (isHovered || bannerSlides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % bannerSlides.length);
    }, slideIntervalMs);
    return () => clearInterval(interval);
  }, [isHovered, bannerSlides.length, slideIntervalMs]);

  const nextSlide = () => {
    setCurrentSlide(prev => (prev + 1) % bannerSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide(prev => (prev - 1 + bannerSlides.length) % bannerSlides.length);
  };

  const handleBannerClick = (banner) => {
    if (banner?.link) {
      if (banner.link.includes('#flash-sale')) {
        onShopFlashSale?.();
      } else if (banner.link.startsWith('http://') || banner.link.startsWith('https://')) {
        window.open(banner.link, '_blank');
      } else {
        window.location.href = banner.link;
      }
    } else {
      onShopFlashSale?.();
    }
  };

  // Categories list matching exact screenshot items
  const menuCategories = [
    { id: 'cat-1', name: 'Electronics', sub: 'Phones, Laptops, Accessories', icon: Smartphone },
    { id: 'cat-2', name: 'Fashion & Apparel', sub: 'Men, Women, Kids', icon: Shirt },
    { id: 'cat-4', name: 'Home & Living', sub: 'Furniture, Decor, Kitchen', icon: Home },
    { id: 'cat-5', name: 'Beauty & Personal Care', sub: 'Skincare, Makeup, Hair', icon: Sparkles },
    { id: 'cat-3', name: 'Sports & Outdoors', sub: 'Fitness, Camping, Sports Gear', icon: Trophy },
    { id: 'cat-toys', name: 'Toys & Games', sub: 'Toys, Board Games, Gaming', icon: Gamepad2 },
    { id: 'cat-auto', name: 'Automotive', sub: 'Car Parts, Accessories', icon: Car },
    { id: 'cat-health', name: 'Health & Medical', sub: 'Supplements, Medical Supplies', icon: HeartPulse },
    { id: 'cat-ind', name: 'Industrial & Business', sub: 'Machinery, Tools, Raw Materials', icon: Wrench },
    { id: 'cat-more', name: 'More Categories', sub: 'View all categories', icon: Grid }
  ];

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-4">
      <div className="flex flex-col lg:flex-row items-stretch gap-3.5">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: Vertical Categories Menu matching screenshot */}
        {/* ========================================================= */}
        <div className="hidden lg:block w-[205px] shrink-0">
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-2 h-[320px] flex flex-col justify-between overflow-hidden">
            <div className="space-y-0.5">
              {menuCategories.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedCategory === item.name;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectCategory?.(item.name === 'More Categories' ? 'All Categories' : item.name)}
                    className={`w-full flex items-center justify-between px-2.5 py-1 rounded-lg text-left transition group ${
                      isSelected
                        ? 'bg-blue-50 text-[#2563eb]'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center space-x-2 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-slate-100 group-hover:bg-blue-100/70 text-slate-600 group-hover:text-[#2563eb] flex items-center justify-center shrink-0 transition">
                        <Icon className="w-3.5 h-3.5 stroke-[1.8]" />
                      </div>
                      <div className="truncate">
                        <p className="text-[11.5px] font-bold tracking-tight text-slate-800 group-hover:text-[#2563eb] transition leading-tight truncate">
                          {item.name}
                        </p>
                        <p className="text-[9px] text-slate-400 font-medium truncate leading-none">
                          {item.sub}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-[#2563eb] transition shrink-0 ml-1" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* CENTER COLUMN: WIDE Banner Sliding System (PURE IMAGE)    */}
        {/* ========================================================= */}
        <div
          className="flex-1 min-w-0 h-[320px] relative group"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xs border border-slate-200/90 relative bg-slate-100">
            {/* Banner Image - 100% PURE IMAGE, ZERO TEXT CODING */}
            <img
              key={currentSlide}
              src={bannerSlides[currentSlide].image}
              alt={bannerSlides[currentSlide].alt}
              className="w-full h-full object-cover transition-opacity duration-300 select-none cursor-pointer"
              onClick={() => handleBannerClick(bannerSlides[currentSlide])}
            />

            {/* Slider Navigation Arrows */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                prevSlide();
              }}
              className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition shadow-md opacity-0 group-hover:opacity-100 cursor-pointer"
              aria-label="Previous Slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                nextSlide();
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-xs transition shadow-md opacity-0 group-hover:opacity-100 cursor-pointer"
              aria-label="Next Slide"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Carousel Pagination Dots */}
            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-1.5">
              {bannerSlides.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSlide(idx);
                  }}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    currentSlide === idx
                      ? 'w-5 h-1.5'
                      : 'w-1.5 h-1.5 bg-white/70 hover:bg-white'
                  }`}
                  style={currentSlide === idx ? { backgroundColor: primaryColor } : {}}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: 3 Promo Cards (100% CODED UI + 3D PNG ICONS) */}
        {/* ========================================================= */}
        <div className="w-full lg:w-[235px] shrink-0 flex flex-col justify-between h-[320px] gap-2.5">
          
          {/* CARD 1: Flash Sale (Coded Dark Navy card with live countdown & 3D PNG cutout) */}
          <div
            onClick={onShopFlashSale}
            className="flex-1 rounded-2xl p-3 text-white relative overflow-hidden flex flex-col justify-between border border-slate-800 shadow-2xs bg-[#0b1329] group cursor-pointer"
            title="Flash Sale - Up to 70% Off"
          >
            {/* Top row */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-black tracking-tight text-white leading-tight">
                  Flash Sale
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  Limited time offer!
                </p>
              </div>
              <span className="bg-[#ef4444] text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-2xs uppercase">
                Up to 70% OFF
              </span>
            </div>

            {/* Countdown & Products Preview */}
            <div className="flex items-center justify-between gap-1 my-1">
              <div className="space-y-1">
                {/* Live Countdown Clocks */}
                <div className="flex items-center space-x-1 font-mono font-bold text-[11px]">
                  <div className="bg-slate-800/90 border border-slate-700 px-1 py-0.5 rounded text-center min-w-5">
                    <span className="text-white text-[10px]">{format2(timeLeft.hours)}</span>
                    <span className="block text-[7px] text-slate-400 font-normal uppercase">Hrs</span>
                  </div>
                  <span className="text-slate-500 font-bold">:</span>
                  <div className="bg-slate-800/90 border border-slate-700 px-1 py-0.5 rounded text-center min-w-5">
                    <span className="text-white text-[10px]">{format2(timeLeft.minutes)}</span>
                    <span className="block text-[7px] text-slate-400 font-normal uppercase">Min</span>
                  </div>
                  <span className="text-slate-500 font-bold">:</span>
                  <div className="bg-slate-800/90 border border-slate-700 px-1 py-0.5 rounded text-center min-w-5">
                    <span className="text-white text-[10px]">{format2(timeLeft.seconds)}</span>
                    <span className="block text-[7px] text-slate-400 font-normal uppercase">Sec</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShopFlashSale?.();
                  }}
                  className="mt-1.5 px-3 py-1 rounded-full bg-white hover:bg-slate-100 text-slate-900 font-bold text-[10.5px] transition shadow-xs"
                >
                  Shop Now
                </button>
              </div>

              {/* 3D PNG Cutout of Headphones & Smartwatch */}
              <div className="relative w-18 h-16 flex items-center justify-end shrink-0">
                <img
                  src="/crops/promo_flash_sale_3d.png"
                  alt="Headphones & Smartwatch"
                  className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition"
                />
              </div>
            </div>
          </div>

          {/* CARD 2: New Arrivals (Coded Soft Lavender/Blue card with 3D PNG phone cutout) */}
          <div
            onClick={onExploreNewArrivals}
            className="h-[88px] rounded-2xl p-2.5 px-3 bg-gradient-to-r from-[#eef2ff] to-[#e0e7ff] text-slate-900 flex items-center justify-between border border-blue-100 shadow-2xs group cursor-pointer"
            title="New Arrivals - Explore Now"
          >
            <div className="space-y-1">
              <h3 className="text-xs font-extrabold tracking-tight text-slate-900 leading-tight">
                New Arrivals
              </h3>
              <p className="text-[9.5px] text-slate-500 font-medium">
                Latest products, fresh styles
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onExploreNewArrivals?.();
                }}
                className="mt-1 px-3 py-1 rounded-full bg-[#1e293b] hover:bg-slate-800 text-white font-bold text-[10px] transition shadow-2xs"
              >
                Explore Now
              </button>
            </div>

            <div className="w-16 h-16 flex items-center justify-center shrink-0">
              <img
                src="/crops/promo_new_arrivals_3d.png"
                alt="New Arrival Phones"
                className="w-full h-full object-contain drop-shadow-md group-hover:scale-105 transition"
              />
            </div>
          </div>

          {/* CARD 3: Become a Seller (Coded Soft Mint/Green card with 3D PNG storefront cutout) */}
          <div
            onClick={onBecomeSeller}
            className="h-[88px] rounded-2xl p-2.5 px-3 bg-gradient-to-r from-[#ecfdf5] to-[#d1fae5] text-slate-900 flex items-center justify-between border border-emerald-100 shadow-2xs group cursor-pointer"
            title="Become a Seller - Join Now"
          >
            <div className="space-y-1">
              <h3 className="text-xs font-extrabold tracking-tight text-slate-900 leading-tight">
                Become a Seller
              </h3>
              <p className="text-[9.5px] text-emerald-800/80 font-medium">
                Grow your business globally
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBecomeSeller?.();
                }}
                className="mt-1 px-3 py-1 rounded-full bg-[#065f46] hover:bg-emerald-800 text-white font-bold text-[10px] transition shadow-2xs"
              >
                Join Now
              </button>
            </div>

            <div className="w-16 h-16 flex items-center justify-center shrink-0">
              <img
                src="/crops/promo_become_seller_3d.png"
                alt="Market Storefront Booth"
                className="w-full h-full object-contain drop-shadow-md rounded-lg group-hover:rotate-2 transition"
              />
            </div>
          </div>

        </div>

      </div>
    </section>
  );
}
