"use client";

import { useMemo, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import AlbumCard from "@/components/AlbumCard";
import AlbumForm from "@/components/AlbumForm";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfiniteAlbums } from "@/lib/hooks/useInfiniteAlbums";
import { useIdentity } from "@/components/IdentityProvider";
import type { Album } from "@/types/album";

export default function GalleryPageClient({
  initialPublic,
  channelId,
  channelName,
}: {
  initialPublic?: { posts: Album[]; hasMore: boolean };
  channelId?: string;
  channelName?: string;
}) {
  const { data: session } = useSession();
  const { activeChannelId, identities } = useIdentity();
  const locale = useLocale();
  const t = useTranslations("Gallery");
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const effectiveChannelId = channelId ?? undefined;
  const { posts, setPosts, loading, loadingMore, hasMore, sentinelRef } = useInfiniteAlbums({
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
  } = useInfiniteAlbums({
    channelId: effectiveChannelId ?? activeChannelId ?? undefined,
    disabled: !session || !(effectiveChannelId ?? activeChannelId),
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
  ) {
    if (isLoading) {
      return (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => <PostCardSkeleton key={i} />)}
        </div>
      );
    }
    if (items.length === 0) {
      return <Card><p className="text-deep/60 text-sm">{t(emptyKey)}</p></Card>;
    }
    return (
      <div className="space-y-4">
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
        {more && <div ref={ref} className="h-4" aria-hidden />}
        {isLoadingMore && <PostCardSkeleton />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-3xl font-bold text-deep">{channelName ?? t("title")}</h1>
        <p className="mt-1 text-deep/60">{t("subtitle")}</p>
      </div>

      {session ? (
        <Card>
          <AlbumForm mode="create" onSuccess={handleCreateSuccess} postingChannel={postingChannel} />
        </Card>
      ) : (
        <Card>
          <p className="text-sm text-deep/60">
            <Link href="/login" className="text-gold font-medium hover:underline">{t("signIn")}</Link>{" "}
            {t("signInToPost")}
          </p>
        </Card>
      )}

      <TabsRoot defaultValue="public">
        <TabsList>
          <TabsTab value="public">{t("publicTab")}</TabsTab>
          {session && <TabsTab value="mine-public">{t("myPublicTab")}</TabsTab>}
          {session && <TabsTab value="mine-private">{t("myPrivateTab")}</TabsTab>}
        </TabsList>
        <TabsPanel value="public">
          {renderList(posts, loading, loadingMore, hasMore, sentinelRef, "emptyPublic")}
        </TabsPanel>
        {session && (
          <TabsPanel value="mine-public">
            {renderList(myPublicPosts, myLoading, myLoadingMore, myHasMore, mySentinelRef, "emptyMyPublic")}
          </TabsPanel>
        )}
        {session && (
          <TabsPanel value="mine-private">
            {renderList(myPrivatePosts, myLoading, myLoadingMore, myHasMore, mySentinelRef, "emptyMyPrivate")}
          </TabsPanel>
        )}
      </TabsRoot>

      <Dialog open={editingAlbum !== null} onOpenChange={(open) => { if (!open) setEditingAlbum(null); }}>
        <DialogContent className="max-h-[90svh] overflow-y-auto">
          <DialogHeader text={t("editTitle")} />
          {editingAlbum && (
            <AlbumForm
              mode="edit"
              albumId={editingAlbum.id}
              initialTitle={editingAlbum.title}
              initialDescription={editingAlbum.description ?? ""}
              initialIsPublic={editingAlbum.isPublic}
              initialMedia={editingAlbum.items}
              onSuccess={handleEditSuccess}
              onCancel={() => setEditingAlbum(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
