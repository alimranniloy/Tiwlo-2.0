import { useEffect, useRef } from 'react';
import lottie from 'lottie-web';
import emptyStateLottie from '../assets/empty-state-lottie.json';

export default function UnavailablePage({
  label,
  title = 'Nothing in this bowl yet',
  description = 'The page you tried to open is not here, moved, or no longer active on Tiwlo.',
  actionHref = '/',
  onAction,
  loading = false,
}) {
  const lottieRef = useRef(null);

  useEffect(() => {
    const el = lottieRef.current;
    if (!el) return undefined;

    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: emptyStateLottie,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
      },
    });

    return () => {
      anim.destroy();
    };
  }, []);

  const handleActionClick = (e) => {
    if (onAction) {
      e.preventDefault();
      onAction();
    }
  };

  const blockDownload = (e) => {
    e.preventDefault();
  };

  return (
    <div className="min-h-screen w-full bg-white text-[#121212] flex flex-col antialiased">
      <header className="w-full px-6 py-5 sm:px-10 sm:py-6 flex items-center">
        <a
          href={actionHref}
          onClick={handleActionClick}
          onContextMenu={blockDownload}
          onDragStart={blockDownload}
          aria-label="Tiwlo Home"
          className="inline-flex items-center select-none"
        >
          <img
            src="/tiwlo-light-logo.png"
            alt="Tiwlo"
            draggable={false}
            className="h-7 w-auto pointer-events-none select-none"
            style={{ WebkitTouchCallout: 'none' }}
          />
        </a>
      </header>

      <main
        className="flex-1 flex flex-col items-center justify-center px-6 pb-16 pt-2 text-center"
        role={loading ? 'status' : 'main'}
      >
        <div
          aria-hidden="true"
          onContextMenu={blockDownload}
          onDragStart={blockDownload}
          className="pointer-events-none select-none mx-auto mb-3 h-[210px] w-[210px] sm:h-[240px] sm:w-[240px]"
          style={{ WebkitTouchCallout: 'none', WebkitUserSelect: 'none' }}
        >
          <div ref={lottieRef} className="h-full w-full pointer-events-none select-none" />
        </div>

        {label ? (
          <p className="mb-2.5 text-[13.5px] font-semibold tracking-[0.01em] text-[#0f7a37] break-all max-w-[480px]">
            {label}
          </p>
        ) : null}

        {!loading ? (
          <>
            <h1 className="max-w-[520px] text-[clamp(1.65rem,3.6vw,2.25rem)] font-bold leading-[1.18] tracking-[-0.025em] text-[#121212]">
              {title}
            </h1>
            <p className="mt-2.5 mb-7 max-w-[420px] text-[15px] leading-relaxed text-[#6a6a6a]">
              {description}
            </p>
            <a
              href={actionHref}
              onClick={handleActionClick}
              className="inline-flex items-center justify-center rounded-full bg-[#121212] px-7 py-2.75 text-sm font-semibold text-white transition-colors hover:bg-[#262626]"
            >
              Tiwlo
            </a>
          </>
        ) : null}
      </main>
    </div>
  );
}

