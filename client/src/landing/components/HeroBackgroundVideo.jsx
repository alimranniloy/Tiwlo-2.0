import React, { useRef, useEffect } from 'react';

/**
 * HeroBackgroundVideo Component
 * High-performance background video streamer with glassmorphic blur, 
 * auto-looping, muted audio, and adaptive screen coverage.
 */
export default function HeroBackgroundVideo({
  videoSrc = '/landing/hero-bg.mp4',
  opacity = 0.55,
  blurAmount = 8
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.loop = true;

    // Force playback start
    const startPlayback = () => {
      video.play().catch(() => {
        // Retry on user interaction if browser policy requires it
        const retry = () => {
          video.play().catch(() => {});
          window.removeEventListener('click', retry);
          window.removeEventListener('touchstart', retry);
        };
        window.addEventListener('click', retry, { once: true });
        window.addEventListener('touchstart', retry, { once: true });
      });
    };

    startPlayback();
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
      {/* High-Performance Background HTML5 Video */}
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="w-full h-full object-cover"
        style={{
          opacity: opacity,
          filter: `blur(${blurAmount}px) saturate(125%)`,
          transform: 'scale(1.12)' // Scale to prevent blur cutoff around edges
        }}
      >
        <source src="/api/landing/hero-video" type="video/mp4" />
        <source src="/landing/hero-bg.mp4" type="video/mp4" />
      </video>

      {/* Frosted Glass Soft White Wash (Allows Video to Shine Through Crisply) */}
      <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />
      
      {/* Smooth Bottom Gradient Fade */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-white" />
    </div>
  );
}
