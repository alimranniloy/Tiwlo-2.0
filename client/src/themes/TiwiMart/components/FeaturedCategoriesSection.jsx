import React from 'react';
import { ArrowRight, LayoutGrid } from 'lucide-react';

export default function FeaturedCategoriesSection({ categories = [], onSelectCategory, onViewAllCategories }) {
  if (!categories.length) return null;

  return (
    <section id="store-categories" className="max-w-[1440px] mx-auto px-4 lg:px-8 py-4">
      {/* Section Header matching screenshot */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2.5">
          <div className="w-1.5 h-5 bg-[#2563eb] rounded-full"></div>
          <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
            Featured Categories
          </h2>
        </div>

        <button
          onClick={onViewAllCategories}
          className="text-xs font-semibold text-[#2563eb] hover:text-blue-700 flex items-center space-x-1 group transition"
        >
          <span>View All Categories</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Categories Grid matching screenshot */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {categories.map((cat) => (
          <button
            key={cat.id || cat.name}
            type="button"
            onClick={() => onSelectCategory?.(cat.name)}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-200 group h-[135px]"
          >
            {/* Image container */}
            <div className="w-full flex-1 flex items-center justify-center overflow-hidden py-1">
              {cat.image ? (
                <img src={cat.image} alt="" className="w-full h-full max-h-16 object-contain group-hover:scale-105 transition" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563eb] flex items-center justify-center group-hover:scale-110 transition">
                  <LayoutGrid className="w-6 h-6 stroke-[2]" />
                </div>
              )}
            </div>

            {/* Title */}
            <p className="text-xs font-bold text-slate-800 group-hover:text-[#2563eb] transition mt-1 truncate w-full">
              {cat.name}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
