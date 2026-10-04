import React from 'react';
import { ArrowRight, Star, ShieldCheck, MapPin } from 'lucide-react';

export default function TopRatedSellersSection({ sellers = [], onSelectSeller, onViewAllSellers }) {
  // Sellers data matching screenshot
  const displaySellers = [
    {
      id: 'sup-tw',
      name: 'TechWorld Store',
      badge: 'Top Rated',
      rating: 4.7,
      followers: '150K+ Followers',
      shipsFrom: 'Ships from China',
      avatarText: 'T',
      avatarBg: 'bg-[#0f172a]'
    },
    {
      id: 'sup-fh',
      name: 'FashionHub',
      badge: 'Top Rated',
      rating: 4.7,
      followers: '98K+ Followers',
      shipsFrom: 'Ships from China',
      avatarText: 'HK',
      avatarBg: 'bg-[#0f172a]'
    },
    {
      id: 'sup-he',
      name: 'HomeEssentials',
      badge: 'Top Rated',
      rating: 4.9,
      followers: '75K+ Followers',
      shipsFrom: 'Ships from USA',
      avatarText: 'HE',
      avatarBg: 'bg-[#0f172a]'
    },
    {
      id: 'sup-bw',
      name: 'BeautyWorld',
      badge: 'Top Rated',
      rating: 4.8,
      followers: '120K+ Followers',
      shipsFrom: 'Ships from USA',
      avatarText: 'P',
      avatarBg: 'bg-[#f43f5e]'
    },
    {
      id: 'sup-sz',
      name: 'SportZone',
      badge: 'Top Rated',
      rating: 4.8,
      followers: '55K+ Followers',
      shipsFrom: 'Ships from Germany',
      avatarText: 'SZ',
      avatarBg: 'bg-[#be123c]'
    }
  ];

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-5">
      {/* Header matching screenshot */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline space-x-2.5">
          <div className="w-1.5 h-5 bg-[#2563eb] rounded-full self-center"></div>
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Top Rated Sellers
          </h2>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Trusted by millions of buyers
          </span>
        </div>

        <button
          onClick={onViewAllSellers}
          className="text-xs font-semibold text-[#2563eb] hover:text-blue-700 flex items-center space-x-1 group transition"
        >
          <span>View All Sellers</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Sellers Cards Row matching screenshot */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {displaySellers.map((seller) => (
          <div
            key={seller.id}
            onClick={() => onSelectSeller?.(seller)}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 p-3.5 flex items-center space-x-3 cursor-pointer transition-all duration-200 group"
          >
            {/* Avatar Circle */}
            <div
              className={`w-11 h-11 rounded-full ${seller.avatarBg} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition`}
            >
              {seller.avatarText}
            </div>

            {/* Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <span className="text-xs font-bold text-slate-900 truncate group-hover:text-[#2563eb] transition">
                  {seller.name}
                </span>
                <span className="bg-blue-50 text-[#2563eb] text-[9.5px] font-bold px-1.5 py-0.2 rounded-full whitespace-nowrap">
                  {seller.badge}
                </span>
              </div>

              {/* Rating */}
              <div className="flex items-center space-x-1 text-[11px] text-slate-600 mt-0.5">
                <Star className="w-3 h-3 fill-amber-400 stroke-amber-400" />
                <span className="font-bold text-slate-800 text-[10.5px]">{seller.rating}</span>
              </div>

              {/* Meta */}
              <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                {seller.followers} • {seller.shipsFrom}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
