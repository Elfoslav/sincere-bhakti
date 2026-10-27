import { useEffect, useRef } from "react";

/** Release file previews on discard/unmount without revoking previews still in use. */
export function useObjectUrlCleanup(urls: Array<string | null | undefined>) {
  const previews = useRef(new Set<string>());
  useEffect(() => { urls.forEach(url => { if (url?.startsWith("blob:")) previews.current.add(url); }); }, [urls]);
  useEffect(() => {
    const allocated = previews.current;
    return () => { allocated.forEach(url => URL.revokeObjectURL(url)); allocated.clear(); };
  }, []);
}
