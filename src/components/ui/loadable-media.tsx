"use client";

import { Fragment, useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type MediaLoadStatus = "loading" | "loaded" | "error";

export interface LoadableMediaHandlers {
  status: MediaLoadStatus;
  onLoad: () => void;
  onError: () => void;
  /**
   * Ref callback for `<img>`: an image that finished (or failed) before
   * hydration never fires `load`/`error` into React, so settle it from
   * `complete`/`naturalWidth` on mount.
   */
  ref: (el: HTMLImageElement | null) => void;
}

/**
 * Wraps one piece of external media with explicit loading, unavailable and
 * retry states. The media renders through `children` (render prop) so it can
 * be an `<img>`, `next/image` or `<video>`; the overlay is a sibling so a
 * Retry button never nests inside an interactive parent (e.g. the gallery's
 * open-image button). Set `showLoading={false}` for media that stays idle on
 * purpose (`preload="none"` video) so only the error state applies.
 */
export function LoadableMedia({
  children,
  className,
  style,
  showLoading = true,
}: {
  children: (handlers: LoadableMediaHandlers) => React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  showLoading?: boolean;
}) {
  const t = useTranslations("MediaStatus");
  const [status, setStatus] = useState<MediaLoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);

  const onLoad = useCallback(() => setStatus("loaded"), []);
  const onError = useCallback(() => setStatus("error"), []);
  const ref = useCallback((el: HTMLImageElement | null) => {
    if (el?.complete) setStatus(el.naturalWidth > 0 ? "loaded" : "error");
  }, []);

  function retry() {
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  return (
    <div className={cn("relative data-[status=error]:min-h-32", className)} style={style} data-status={status}>
      {/* New key on retry remounts the element so the browser refetches it. */}
      <Fragment key={attempt}>{children({ status, onLoad, onError, ref })}</Fragment>
      {showLoading && status === "loading" && (
        <Skeleton aria-hidden className="pointer-events-none absolute inset-0 rounded-none" />
      )}
      {status === "error" && (
        <div
          role="status"
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-muted p-3 text-center text-sm text-muted-foreground"
        >
          <p>{t("unavailable")}</p>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            {t("retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
