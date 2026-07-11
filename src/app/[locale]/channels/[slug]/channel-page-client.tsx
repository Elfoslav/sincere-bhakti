"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import PostCard from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";
import type { Post } from "@/types/post";
import type { ChannelWithPostCount } from "@/types/channel";

export default function ChannelPageClient({
  channel: initialChannel,
}: {
  channel: ChannelWithPostCount;
}) {
  const { data: session } = useSession();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("ChannelPage");
  const isOwner = session?.user?.id === initialChannel.ownerId;

  const [channel, setChannel] = useState(initialChannel);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const {
    posts: publicPosts,
    setPosts: setPublicPosts,
    loading: publicLoading,
    loadingMore: publicLoadingMore,
    hasMore: publicHasMore,
    sentinelRef: publicSentinelRef,
  } = useInfinitePosts({ channelId: channel.id, scope: "public", language: locale });

  const {
    posts: myPosts,
    setPosts: setMyPosts,
    loading: myPostsLoading,
    loadingMore: myPostsLoadingMore,
    hasMore: myPostsHasMore,
    sentinelRef: myPostsSentinelRef,
  } = useInfinitePosts({ channelId: channel.id, scope: "private", disabled: !isOwner, language: locale });

  const myPrivatePosts = useMemo(() => myPosts.filter((p) => !p.isPublic), [myPosts]);

  const handleDelete = useCallback((id: string) => {
    setPublicPosts((prev) => prev.filter((p) => p.id !== id));
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
  }, [setPublicPosts, setMyPosts]);

  async function handleRename() {
    if (!newName.trim()) return;
    setSaving(true);
    setNameError("");
    try {
      const res = await fetch(`/api/channels/${channel.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setChannel((prev) => ({ ...prev, name: updated.name, slug: updated.slug }));
        setRenameOpen(false);
        router.replace(`/${locale}/channels/${updated.slug}`);
      } else {
        const data = await res.json().catch(() => ({}));
        if (data.error === "name_taken") {
          setNameError(t("nameTaken"));
        } else {
          setNameError(t("saveError"));
        }
      }
    } catch {
      setNameError(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  function renderPostList(
    posts: Post[],
    loading: boolean,
    loadingMore: boolean,
    hasMore: boolean,
    sentinelRef: (node: HTMLDivElement | null) => void,
    emptyKey: string,
  ) {
    if (loading) {
      return (
        <div className="space-y-4">
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      );
    }
    if (posts.length === 0) {
      return (
        <Card variant="ghost-muted" className="text-center py-8 text-deep/50">
          {t(emptyKey)}
        </Card>
      );
    }
    return (
      <div>
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={isOwner ? session?.user?.id : undefined} onDelete={handleDelete} />
          ))}
        </div>
        {hasMore && (
          <div ref={sentinelRef} className="flex justify-center py-8">
            {loadingMore ? (
              <p className="text-deep/50 text-sm">{t("loadingMore")}</p>
            ) : (
              <div className="w-6 h-6" />
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8">
      <Card variant="default" padding="lg" className="mb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gold flex items-center justify-center text-deep text-3xl font-bold mx-auto mb-4">
          {channel.name[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold text-deep">{channel.name}</h1>
          {isOwner && (
            channel.isPersonal ? (
              <Tooltip>
                <TooltipTrigger aria-label={t("changeNameInProfile")}>
                  <Pencil className="w-[18px] h-[18px] text-deep/20 cursor-not-allowed" />
                </TooltipTrigger>
                <TooltipContent>
                  {t("changeNameInProfile")}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Dialog open={renameOpen} onOpenChange={(open) => { setRenameOpen(open); if (open) { setNewName(channel.name); setNameError(""); } }}>
                <DialogTrigger
                  className="text-gold hover:text-gold-light transition-colors cursor-pointer"
                  title={t("editName")}
                  aria-label={t("editName")}
                >
                  <Pencil className="w-[18px] h-[18px]" />
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("editNameTitle")}</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRename();
                    }}
                    className="space-y-4 pt-2"
                  >
                    <Input
                      name="name"
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        setNameError("");
                      }}
                      placeholder={channel.name}
                      autoComplete="off"
                      autoFocus
                      errorMessage={nameError || undefined}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                        {t("cancel")}
                      </Button>
                      <Button type="submit" disabled={saving || !newName.trim()}>
                        {saving ? t("saving") : t("save")}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )
          )}
        </div>
        <p className="text-deep/50 text-sm mt-2">
          {channel.postCount} {t("posts")}
        </p>
      </Card>

      {isOwner ? (
        <TabsRoot defaultValue="public">
          <TabsList>
            <TabsTab value="public">{t("publicPosts", { count: publicPosts.length })}</TabsTab>
            <TabsTab value="private">{t("privatePosts", { count: myPrivatePosts.length })}</TabsTab>
          </TabsList>

          <TabsPanel value="public">
            {renderPostList(publicPosts, publicLoading, publicLoadingMore, publicHasMore, publicSentinelRef, "noPublicPosts")}
          </TabsPanel>

          <TabsPanel value="private">
            {renderPostList(myPrivatePosts, myPostsLoading, myPostsLoadingMore, myPostsHasMore, myPostsSentinelRef, "noPrivatePosts")}
          </TabsPanel>
        </TabsRoot>
      ) : (
        <>
          <Heading as="h2" className="mb-4">{t("publicPosts", { count: publicPosts.length })}</Heading>
          {renderPostList(publicPosts, publicLoading, publicLoadingMore, publicHasMore, publicSentinelRef, "noPublicPosts")}
        </>
      )}
    </div>
  );
}
