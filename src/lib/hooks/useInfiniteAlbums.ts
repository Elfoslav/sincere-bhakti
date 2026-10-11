import type { Album } from "@/types/album";
import { useInfiniteFeed, type FeedParams } from "@/lib/hooks/useInfiniteFeed";

type ApiParams = FeedParams<Album>;

export function useInfiniteAlbums(params?: ApiParams) {
  return useInfiniteFeed<Album>("/api/albums", params);
}
