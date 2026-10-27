"use client";

import FeedPaginationError from "@/components/FeedPaginationError";
import FeedEmptyState from "@/components/FeedEmptyState";
import { useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import AlbumCard from "@/components/AlbumCard";
import EditAlbumModal from "@/components/EditAlbumModal";
import ContentCreateAction from "@/components/ContentCreateAction";
import ContentCreationDialog from "@/components/ContentCreationDialog";
import { isAuthenticated } from "@/lib/session";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfiniteAlbums } from "@/lib/hooks/useInfiniteAlbums";
import { useIdentity } from "@/components/IdentityProvider";
import type { Album } from "@/types/album";
import PageHeader from "@/components/PageHeader";

export default function GalleryPageClient({
  initialPublic,
  channelId,
  channelName,
}: {
  initialPublic?: { posts: Album[]; hasMore: boolean };
  channelId?: string;
  channelName?: string;
}) {
  const { data: session, status } = useSession();
  const authenticated = isAuthenticated(status);
  const { activeChannelId, identities } = useIdentity();
  const locale = useLocale();
  const t = useTranslations("Gallery");
  const common = useTranslations("Common");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const effectiveChannelId = channelId ?? undefined;
  const { posts, setPosts, loading, loadingMore, hasMore, sentinelRef, error, retry, loadMoreError, retryLoadMore } = useInfiniteAlbums({
    scope: "public",
    channelId: effectiveChannelId,
    language: locale,
    initialData: initialPublic,
  });
  const {
    posts: myPosts,
    setPosts: setMyPosts,
    loading: myLoading,
    loadingMore: myLoadingMore,
    hasMore: myHasMore,
    sentinelRef: mySentinelRef,
    error: myError,
    retry: myRetry,
    loadMoreError: myLoadMoreError,
    retryLoadMore: myRetryLoadMore,
  } = useInfiniteAlbums({
    channelId: effectiveChannelId ?? activeChannelId ?? undefined,
    disabled: !authenticated || !(effectiveChannelId ?? activeChannelId),
    language: locale,
  });

  const myPublicPosts = useMemo(
    () => myPosts.filter((p) => p.isPublic),
    [myPosts],
  );
  const myPrivatePosts = useMemo(
    () => myPosts.filter((p) => !p.isPublic),
    [myPosts],
  );
  const manageableChannelIds = useMemo(() => identities.map((identity) => identity.id), [identities]);
  const postingChannel = useMemo(() => {
    const id = effectiveChannelId ?? activeChannelId;
    const identity = identities.find((i) => i.id === id);
    return id && identity ? { id, name: identity.name, avatarUrl: null } : undefined;
  }, [effectiveChannelId, activeChannelId, identities]);

  function handleCreateSuccess(album: Album) {
    setMyPosts((prev) => (prev.some((p) => p.id === album.id) ? prev.map((p) => (p.id === album.id ? album : p)) : [album, ...prev]));
    if (album.isPublic && (!effectiveChannelId || album.channel.id === effectiveChannelId)) {
      setPosts((prev) => (prev.some((p) => p.id === album.id) ? prev.map((p) => (p.id === album.id ? album : p)) : [album, ...prev]));
    } else if (!album.isPublic) {
      setPosts((prev) => prev.filter((p) => p.id !== album.id));
    }
  }

  function handleDelete(id: string) {
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
    setPosts((prev) => prev.filter((p) => p.id !== id));
    setEditingAlbum((prev) => (prev?.id === id ? null : prev));
  }

  const handleEdit = useCallback((albumId: string) => {
    const found = [...posts, ...myPosts].find((p) => p.id === albumId);
    if (found) setEditingAlbum(found);
  }, [posts, myPosts]);

  const handleEditSuccess = useCallback((updated: Album) => {
    setMyPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setPosts((prev) => {
      if (updated.isPublic) {
        return prev.some((p) => p.id === updated.id) ? prev.map((p) => (p.id === updated.id ? updated : p)) : [updated, ...prev];
      }
      return prev.filter((p) => p.id !== updated.id);
    });
    setEditingAlbum(null);
  }, [setMyPosts, setPosts]);

  function renderList(
    items: Album[],
    isLoading: boolean,
    isLoadingMore: boolean,
    more: boolean,
    ref: (node: HTMLDivElement | null) => void,
    emptyKey: string,
    failed = false,
    recover?: () => void,
    moreFailed = false,
    recoverMore?: () => void,
  ) {
    if (isLoading) {
      return (
        <div className="flex flex-col">
          {[0, 1, 2].map((i) => <PostCardSkeleton key={i} />)}
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        {items.length === 0 && <FeedEmptyState message={t(emptyKey)} error={failed} onRetry={recover} action={
          <div className="flex flex-wrap justify-center gap-3">
            <ContentCreateAction kind="album" authenticated={authenticated} onClick={() => setComposerOpen(true)} />
            <Button href="/posts" variant="outline">{common("browsePosts")}</Button>
          </div>
        } />}
        {items.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            currentUserId={session?.user?.id}
            manageableChannelIds={manageableChannelIds}
            onDelete={handleDelete}
            onEdit={handleEdit}
          />
        ))}
        <FeedPaginationError error={moreFailed} retry={recoverMore} />
        {more && <div ref={ref} className="h-4" aria-hidden />}
        {isLoadingMore && <PostCardSkeleton />}
      </div>
    );
  }

  return (
    <div className="reading-container page-space">
      <PageHeader title={channelName ?? t("title")} description={t("subtitle")}
        action={<ContentCreateAction kind="album" authenticated={authenticated} onClick={() => setComposerOpen(true)} />} />
      <ContentCreationDialog kind="album" open={composerOpen} onOpenChange={setComposerOpen} onSuccess={handleCreateSuccess} postingChannel={postingChannel} />

      <TabsRoot defaultValue="public">
        <TabsList>
          <TabsTab value="public">{t("publicTab")}</TabsTab>
          {authenticated && <TabsTab value="mine-public">{t("myPublicTab")}</TabsTab>}
          {authenticated && <TabsTab value="mine-private">{t("myPrivateTab")}</TabsTab>}
        </TabsList>
        <TabsPanel value="public">
          {renderList(posts, loading, loadingMore, hasMore, sentinelRef, "emptyPublic", error, retry, loadMoreError, retryLoadMore)}
        </TabsPanel>
        {authenticated && (
          <TabsPanel value="mine-public">
            {renderList(myPublicPosts, myLoading, myLoadingMore, myHasMore, mySentinelRef, "emptyMyPublic", myError, myRetry, myLoadMoreError, myRetryLoadMore)}
          </TabsPanel>
        )}
        {authenticated && (
          <TabsPanel value="mine-private">
            {renderList(myPrivatePosts, myLoading, myLoadingMore, myHasMore, mySentinelRef, "emptyMyPrivate", myError, myRetry, myLoadMoreError, myRetryLoadMore)}
          </TabsPanel>
        )}
      </TabsRoot>

      <EditAlbumModal album={editingAlbum} open={editingAlbum !== null} onOpenChange={(next) => { if (!next) setEditingAlbum(null); }} onSuccess={handleEditSuccess} />
    </div>
  );
}
