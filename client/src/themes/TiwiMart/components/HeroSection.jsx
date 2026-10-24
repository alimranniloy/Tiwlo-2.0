import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useStoreSettings } from '../../../context/StoreSettingsContext';

export default function HeroSection() {
  const { storeSettings } = useStoreSettings();
  const banners = Array.isArray(storeSettings?.heroBanners)
    ? storeSettings.heroBanners.filter(banner => banner.active !== false && banner.image)
    : [];
  const [activeIndex, setActiveIndex] = useState(0);
  const slidingSpeed = Math.max(2, Number(storeSettings?.bannerSlidingSpeed) || 5);
  const activeBannerIndex = banners.length ? activeIndex % banners.length : 0;

  useEffect(() => {
    if (banners.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveIndex(index => (index + 1) % banners.length);
    }, slidingSpeed * 1000);
    return () => window.clearInterval(timer);
  }, [banners.length, slidingSpeed]);

  const getSafeHref = value => {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
      const url = new URL(value, window.location.origin);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      return url.href;
    } catch {
      return null;
    }
  };

  if (!banners.length) return null;

  const banner = banners[activeBannerIndex];
  const href = getSafeHref(banner.link);
  const isExternal = href && new URL(href).origin !== window.location.origin;
  const content = (
    <div className="relative min-h-48 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <img src={banner.image} alt={banner.title || ''} className="h-full min-h-48 w-full object-cover" />
      {(banner.title || banner.subtitle) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-5 pb-4 pt-12 text-white">
          {banner.title && <h2 className="text-lg font-bold">{banner.title}</h2>}
          {banner.subtitle && <p className="mt-1 text-xs text-white/90">{banner.subtitle}</p>}
        </div>
      )}
    </div>
  );

  return (
    <section className="max-w-[1440px] mx-auto px-4 lg:px-8 py-4">
      <div className="relative">
        {href ? (
          <a
            href={href}
            className="block"
            rel={isExternal ? 'noopener noreferrer' : undefined}
            target={isExternal ? '_blank' : undefined}
          >
            {content}
          </a>
        ) : content}

        {banners.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={() => setActiveIndex(index => (index - 1 + banners.length) % banners.length)}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow hover:bg-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={() => setActiveIndex(index => (index + 1) % banners.length)}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow hover:bg-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 right-1/2 translate-x-1/2 flex gap-1.5">
              {banners.map((item, index) => (
                <button
                  key={item.id || item.image}
                  type="button"
                  aria-label={`Show banner ${index + 1}`}
                  aria-current={index === activeBannerIndex}
                  onClick={() => setActiveIndex(index)}
                  className={`h-2 rounded-full transition-all ${index === activeBannerIndex ? 'w-5 bg-white' : 'w-2 bg-white/60'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
