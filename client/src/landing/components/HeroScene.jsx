import React, { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export default function HeroScene() {
  const host = useRef(null);
  const controller = useRef(null);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const element = host.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const connection = navigator.connection;
    let cancelled = false;
    let idle;
    let timer;
    let started = false;
    let generation = 0;
    const start = () => {
      if (
        started ||
        cancelled ||
        motion.matches ||
        connection?.saveData ||
        /(^|-)2g$/.test(connection?.effectiveType || "")
      )
        return;
      started = true;
      const currentGeneration = ++generation;
      const load = async () => {
        try {
          const { createHeroScene } = await import("./createHeroScene");
          if (cancelled || motion.matches || currentGeneration !== generation)
            return;
          controller.current = createHeroScene(element, () => setReady(false));
          setReady(true);
        } catch {
          setReady(false);
        }
      };
      if ("requestIdleCallback" in window)
        idle = window.requestIdleCallback(load, { timeout: 1800 });
      else timer = window.setTimeout(load, 300);
    };
    const visibility = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) start();
      },
      { rootMargin: "80px" },
    );
    visibility.observe(element);
    const motionChanged = () => {
      if (motion.matches) {
        generation++;
        if (idle !== undefined) window.cancelIdleCallback(idle);
        window.clearTimeout(timer);
        controller.current?.dispose();
        controller.current = null;
        setReady(false);
        started = false;
      } else start();
    };
    motion.addEventListener("change", motionChanged);
    return () => {
      cancelled = true;
      visibility.disconnect();
      motion.removeEventListener("change", motionChanged);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
      controller.current?.dispose();
      controller.current = null;
    };
  }, []);
  useEffect(() => {
    controller.current?.setPaused(paused);
  }, [paused, ready]);
  return (
    <>
      <div
        className={`tl-scene ${ready ? "tl-scene-ready" : ""}`}
        ref={host}
        aria-hidden="true"
      >
        <div className="tl-scene-fallback">
          <div className="tl-fallback-orbit" />
          <div className="tl-fallback-orbit tl-fallback-orbit-2" />
          <div className="tl-fallback-core" />
          <span />
          <span />
        </div>
      </div>
      {ready && (
        <button
          className="tl-motion-control"
          onClick={() => setPaused(!paused)}
          aria-label={paused ? "Play 3D animation" : "Pause 3D animation"}
          aria-pressed={paused}
        >
          {paused ? <Play size={12} /> : <Pause size={12} />}
          <span>{paused ? "Play motion" : "Pause motion"}</span>
        </button>
      )}
    </>
  );
}
