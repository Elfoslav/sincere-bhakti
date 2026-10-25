"use client";

import { useEffect, useRef } from "react";

/**
 * Thin brass bar fixed to the top of the viewport showing how far down the
 * page the reader is. Decorative (aria-hidden): the scroll position is
 * already conveyed by the browser. It is driven by a ref + requestAnimationFrame
 * so scrolling never triggers React renders, and has no transition so it
 * needs no reduced-motion handling.
 */
export default function ReadingProgress() {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      const bar = barRef.current;
      if (!bar) return;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(Math.max(window.scrollY / scrollable, 0), 1) : 0;
      bar.style.transform = `scaleX(${progress})`;
    }
    function onScroll() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5">
      <div ref={barRef} className="h-full origin-left scale-x-0 bg-primary" />
    </div>
  );
}
