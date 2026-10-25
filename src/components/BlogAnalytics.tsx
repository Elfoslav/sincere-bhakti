"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ANALYTICS_READ_TIME_MS } from "@/lib/analytics";
import type { AnalyticsCounts } from "@/types/analytics";

/** One in-memory visit token per mounted article. No cookies or web storage. */
export default function BlogAnalytics({ postId }: { postId: string }) {
  const t = useTranslations("BlogPage");
  const [counts, setCounts] = useState<AnalyticsCounts | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const visitRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let viewed = false;
    let read = false;
    let pending = false;
    let endReached = false;
    let visibleMs = 0;
    let last = performance.now();
    let wasVisible = document.visibilityState === "visible";
    let attempts = 0;
    const visitId = visitRef.current ??= crypto.randomUUID();
    const url = `/api/analytics?${new URLSearchParams({ resourceType: "blogPost", resourceId: postId })}`;
    const collect = navigator.doNotTrack !== "1" && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl;
    async function send(event?: "view" | "read") {
      pending = true;
      try {
        const response = await fetch(url, event ? {
          method: "POST", credentials: "omit", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event, visitId }),
        } : { credentials: "omit" });
        if (!response.ok) return;
        const result: AnalyticsCounts = await response.json();
        if (!active) return;
        setCounts(result);
        if (event === "view") {
          viewed = true;
          // Start the read clock after the server acknowledged the visit:
          // network latency must not put the read ahead of its server receipt.
          visibleMs = 0;
          last = performance.now();
          wasVisible = document.visibilityState === "visible";
        }
        if (event === "read") read = true;
      } catch { /* Analytics must not interrupt reading. */ }
      finally { pending = false; }
    }
    const checkEnd = () => {
      if (document.visibilityState === "visible" && endRef.current && endRef.current.getBoundingClientRect().bottom <= window.innerHeight) endReached = true;
    };
    const visibility = () => {
      const now = performance.now();
      if (wasVisible) visibleMs += now - last;
      last = now;
      wasVisible = document.visibilityState === "visible";
      checkEnd();
    };
    const tick = () => {
      visibility();
      if (!collect || !wasVisible || pending) return;
      if (!viewed && attempts < 3) { attempts++; void send("view"); }
      else if (viewed && !read && endReached && visibleMs >= ANALYTICS_READ_TIME_MS) void send("read");
    };
    if (collect) tick();
    else void send();
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("scroll", checkEnd, { passive: true });
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("scroll", checkEnd);
    };
  }, [postId]);

  return (
    <div ref={endRef} className="mt-6 text-center text-xs text-muted-foreground" title={t("analyticsExplanation")}>
      {counts ? <span>{t("views", { count: counts.views })} · {t("reads", { count: counts.reads })} · {t("uniqueVisitors", { count: counts.uniqueVisitors })}</span> : null}
    </div>
  );
}
