import { useCallback, useEffect, useRef } from "react";
import { cleanupUploadedMedia, uploadMediaFiles, type UploadItem } from "@/lib/client-upload";
import type { MediaInput } from "@/lib/services/post";

/** Retain completed uploads for retries; only discard uploads not linked by a successful save. */
export function usePendingMediaUploads() {
  const cache = useRef(new Map<File, { media: MediaInput; scope: string; committed: boolean }>());
  useEffect(() => {
    const uploads = cache.current;
    return () => { void cleanupUploadedMedia([...uploads.values()].filter(item => !item.committed).map(item => item.media.url)); };
  }, []);

  const upload = useCallback(async (id: string, items: UploadItem[], channelId?: string, folder?: string) => {
    const scope = JSON.stringify([id, channelId, folder]);
    const missing = items.filter(item => cache.current.get(item.file)?.scope !== scope);
    if (missing.length) {
      const result = await uploadMediaFiles(id, missing, channelId, folder);
      if (result.error) {
        await cleanupUploadedMedia(result.media.map(item => item.url));
        return { media: [], error: result.error };
      }
      missing.forEach((item, index) => cache.current.set(item.file, { media: result.media[index], scope, committed: false }));
    }
    return { media: items.map(item => cache.current.get(item.file)!.media), error: null };
  }, []);

  const commit = useCallback((urls: string[]) => {
    const used = new Set(urls);
    cache.current.forEach(item => { if (used.has(item.media.url)) item.committed = true; });
  }, []);
  return { upload, commit };
}
