import React from 'react';
import { ArrowRight, LayoutGrid } from 'lucide-react';

export default function FeaturedCategoriesSection({ onSelectCategory, onViewAllCategories }) {
  const categories = [
    {
      id: 'cat-1',
      name: 'Electronics',
      filterName: 'Electronics',
      image: '/default-product.svg'
    },
    {
      id: 'cat-2',
      name: 'Fashion',
      filterName: 'Fashion & Apparel',
      image: '/default-product.svg'
    },
    {
      id: 'cat-4',
      name: 'Home & Living',
      filterName: 'Home & Living',
      image: '/default-product.svg'
    },
    {
      id: 'cat-5',
      name: 'Beauty',
      filterName: 'Beauty & Personal Care',
      image: '/default-product.svg'
    },
    {
      id: 'cat-3',
      name: 'Sports',
      filterName: 'Sports & Outdoors',
      image: '/default-product.svg'
    },
    {
      id: 'cat-auto',
      name: 'Automotive',
      filterName: 'Automotive',
      image: '/default-product.svg'
    },
    {
      id: 'cat-ind',
      name: 'Industrial',
      filterName: 'Industrial & Business',
      image: '/default-product.svg'
    },
    {
      id: 'cat-more',
      name: 'More Categories',
      filterName: 'All Categories',
      isMore: true
    }
  ];

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-4">
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
          <div
            key={cat.id}
            onClick={() => onSelectCategory?.(cat.filterName)}
            className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-300 p-3 flex flex-col items-center justify-between text-center cursor-pointer transition-all duration-200 group h-[135px]"
          >
            {/* Image container */}
            <div className="w-full flex-1 flex items-center justify-center overflow-hidden py-1">
              {cat.isMore ? (
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#2563eb] flex items-center justify-center group-hover:scale-110 transition">
                  <LayoutGrid className="w-6 h-6 stroke-[2]" />
                </div>
              ) : (
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="h-16 w-full object-contain group-hover:scale-108 transition-transform duration-300"
                  loading="lazy"
                />
              )}
            </div>

            {/* Title */}
            <p className="text-xs font-bold text-slate-800 group-hover:text-[#2563eb] transition mt-1 truncate w-full">
              {cat.name}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
