"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";

const HISTORY_KEY = "mediaLightbox";

/** One history entry per viewer, so Back dismisses it without leaving the page. */
export function useLightboxHistory(onClose: () => void) {
  const entry = useRef<string | null>(null);
  const active = useRef(false);
  const generation = useRef(0);
  const closed = useRef(false);
  const closeFromHistory = useEffectEvent(() => onClose());

  useEffect(() => {
    active.current = true;
    const version = ++generation.current;
    closed.current = false;
    entry.current ??= crypto.randomUUID();
    const id = entry.current;
    const url = window.location.href;
    if (window.history.state?.[HISTORY_KEY] !== id) {
      window.history.pushState({ ...window.history.state, [HISTORY_KEY]: id }, "", url);
    }
    function handlePopState() {
      if (window.history.state?.[HISTORY_KEY] !== id && !closed.current) {
        closed.current = true;
        closeFromHistory();
      }
    }
    window.addEventListener("popstate", handlePopState);
    function cleanupHistory() {
      if (generation.current === version && !active.current && !closed.current && window.location.href === url && window.history.state?.[HISTORY_KEY] === id) {
        window.history.back();
      }
    }
    return () => {
      active.current = false;
      window.removeEventListener("popstate", handlePopState);
      // Defer cleanup so React Strict Mode's effect replay reuses the entry.
      queueMicrotask(cleanupHistory);
    };
  }, []);

  return useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    if (entry.current && window.history.state?.[HISTORY_KEY] === entry.current) window.history.back();
    onClose();
  }, [onClose]);
}
