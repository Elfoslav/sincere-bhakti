"use client";

import { useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, Settings } from "lucide-react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogHeader,
  DialogTrigger,
  dialogActionButtonClassName,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import PostCard from "@/components/PostCard";
import PostForm from "@/components/PostForm";
import EditPostModal from "@/components/EditPostModal";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { useIdentity } from "@/components/IdentityProvider";
import { PostCardSkeleton } from "@/components/ui/skeleton";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { isApiErrorCode } from "@/lib/api-error";
import { ERROR_TOO_MANY_REQUESTS } from "@/lib/error-messages";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";
import { CHANNEL_ROLE_ADMIN } from "@/lib/channel-roles";
import { NAME_MAX_LENGTH, MAX_RENAME_COUNT } from "@/lib/validation";
import type { Post } from "@/types/post";
import type { ChannelWithPostCount } from "@/types/channel";

export default function ChannelPageClient({
  channel: initialChannel,
}: {
  channel: ChannelWithPostCount;
}) {
  const { data: session } = useSession();
  const { identities, refreshIdentities } = useIdentity();
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("ChannelPage");
  const channelsT = useTranslations("ChannelsPage");
  const common = useTranslations("Common");
  const isOwner = session?.user?.id === initialChannel.ownerId;
  const manageableChannelIds = useMemo(() => identities.map((identity) => identity.id), [identities]);
  const canManageSettings = isOwner || identities.some((identity) => identity.id === initialChannel.id && identity.role === CHANNEL_ROLE_ADMIN);
  const canAuthorChannel = isOwner || manageableChannelIds.includes(initialChannel.id);

  const [channel, setChannel] = useState(initialChannel);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");
  const [editingPost, setEditingPost] = useState<Post | null>(null);

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
  } = useInfinitePosts({ channelId: channel.id, scope: "private", disabled: !canAuthorChannel, language: locale });

  const myPrivatePosts = useMemo(() => myPosts.filter((p) => !p.isPublic), [myPosts]);

  const handleDelete = useCallback((id: string) => {
    const deletedPost = [...publicPosts, ...myPosts].find((post) => post.id === id);
    if (deletedPost?.isPublic) {
      setChannel((prev) => ({ ...prev, postCount: Math.max(0, prev.postCount - 1) }));
    }
    setPublicPosts((prev) => prev.filter((p) => p.id !== id));
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
  }, [myPosts, publicPosts, setPublicPosts, setMyPosts]);

  const handleCreateSuccess = useCallback((post: Post) => {
    if (post.isPublic) {
      setChannel((prev) => ({ ...prev, postCount: prev.postCount + 1 }));
    }
    if (post.isPublic) {
      setPublicPosts((prev) => [post, ...prev]);
    } else {
      setMyPosts((prev) => [post, ...prev]);
    }
  }, [setMyPosts, setPublicPosts]);

  const handleEdit = useCallback((postId: string) => {
    const found = [...publicPosts, ...myPosts].find((p) => p.id === postId);
    if (found) setEditingPost(found);
  }, [publicPosts, myPosts]);

  const handleEditSuccess = useCallback((updatedPost: Post) => {
    const previousPost = [...publicPosts, ...myPosts].find((post) => post.id === updatedPost.id);
    if (previousPost && previousPost.isPublic !== updatedPost.isPublic) {
      setChannel((prev) => ({
        ...prev,
        postCount: Math.max(0, prev.postCount + (updatedPost.isPublic ? 1 : -1)),
      }));
    }
    setPublicPosts((prev) => {
      const exists = prev.some((post) => post.id === updatedPost.id);
      if (updatedPost.isPublic) {
        return exists
          ? prev.map((post) => (post.id === updatedPost.id ? updatedPost : post))
          : [updatedPost, ...prev];
      }
      return prev.filter((post) => post.id !== updatedPost.id);
    });
    setMyPosts((prev) => {
      const exists = prev.some((post) => post.id === updatedPost.id);
      if (!updatedPost.isPublic) {
        return exists
          ? prev.map((post) => (post.id === updatedPost.id ? updatedPost : post))
          : [updatedPost, ...prev];
      }
      return prev.filter((post) => post.id !== updatedPost.id);
    });
    setEditingPost(null);
  }, [myPosts, publicPosts, setPublicPosts, setMyPosts]);

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
        setChannel((prev) => ({ ...prev, name: updated.name, slug: updated.slug, renameCount: updated.renameCount }));
        setRenameOpen(false);
        refreshIdentities().catch(() => {});
        router.replace(`/channels/${updated.slug}`);
      } else {
        const data = await res.json().catch(() => ({}));
        if (isApiErrorCode(data, ERROR_TOO_MANY_REQUESTS)) {
          setNameError(common("tooManyRequests"));
        } else if (data.error === "name_taken") {
          setNameError(t("nameTaken"));
        } else if (data.error === "rename_limit_reached") {
          setNameError(t("saveError"));
        } else if (data.error === "validation_error:name:too_big") {
          setNameError(t("nameTooLong", { max: NAME_MAX_LENGTH }));
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
            <PostCard
              key={post.id}
              post={post}
              currentUserId={session?.user?.id}
              manageableChannelIds={manageableChannelIds}
              onDelete={canAuthorChannel ? handleDelete : undefined}
              onEdit={canAuthorChannel ? handleEdit : undefined}
            />
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
      <Breadcrumb
        items={[
          { label: channelsT("title"), href: "/channels" },
          { label: channel.name },
        ]}
        className="mb-4"
      />
      <Card variant="default" padding="lg" className="relative mb-8 text-center">
        {canManageSettings && (
          <Button
            href={`/channels/${channel.slug}/settings`}
            className="absolute right-3 top-3 text-deep/40 hover:text-gold-light sm:right-4 sm:top-4"
            title={t("settings")}
            aria-label={t("settings")}
            icon={<Settings />}
          />
        )}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
          {channel.name[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold text-deep">{channel.name}</h1>
          {isOwner && (
            channel.isPersonal ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      aria-disabled="true"
                      className="cursor-not-allowed text-deep/20 hover:bg-transparent hover:text-deep/20 active:bg-transparent"
                      icon={<Pencil />}
                    />
                  }
                  aria-label={t("changeNameInProfile")}
                />
                <TooltipContent>
                  {t("changeNameInProfile")}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Dialog open={renameOpen} onOpenChange={(open) => { setRenameOpen(open); if (open) { setNewName(channel.name); setNameError(""); } }}>
                <DialogTrigger
                  render={
                    <Button
                      className="text-gold hover:text-gold-light"
                      icon={<Pencil />}
                    />
                  }
                  title={t("editName")}
                  aria-label={t("editName")}
                />
                <DialogContent className="gap-3 sm:max-w-md">
                  <DialogHeader
                    className="gap-1"
                    text={t("editNameTitle")}
                    subheading={common("renameCountInfo")}
                    subheadingRight={common("renameCount", { count: channel.renameCount, max: MAX_RENAME_COUNT })}
                    subheadingClassName="text-deep/50"
                    subheadingRightClassName="text-deep/50"
                  />
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleRename();
                    }}
                    className="space-y-3"
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
                      maxLength={NAME_MAX_LENGTH}
                    />
                    <DialogActions>
                      <Button type="button" variant="outline" className={dialogActionButtonClassName} onClick={() => setRenameOpen(false)}>
                        {t("cancel")}
                      </Button>
                      <Button type="submit" className={dialogActionButtonClassName} disabled={saving || !newName.trim() || channel.renameCount >= MAX_RENAME_COUNT}>
                        {saving ? t("saving") : t("save")}
                      </Button>
                    </DialogActions>
                  </form>
                </DialogContent>
              </Dialog>
            )
          )}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2 text-sm text-deep/50">
          <span>{t("channelLabel")}</span>
          <span aria-hidden="true" className="text-deep/25">·</span>
          <span>{t("postCount", { count: channel.postCount })}</span>
        </div>
        {isOwner && (
          <p className="mt-1 text-sm text-deep/50">
            <span>{t("ownerLabel")}: </span>
            <Link href={`/profile/${channel.ownerId}`} className="font-medium text-deep/70 hover:text-gold">
              {channel.ownerName}
            </Link>
          </p>
        )}
      </Card>

      {canAuthorChannel && (
        <Card variant="default" padding="lg" className="mb-8">
          <PostForm
            mode="create"
            onSuccess={handleCreateSuccess}
            postingChannel={{ id: channel.id, name: channel.name, avatarUrl: channel.avatarUrl }}
          />
        </Card>
      )}

      {canAuthorChannel ? (
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
          {renderPostList(publicPosts, publicLoading, publicLoadingMore, publicHasMore, publicSentinelRef, "noPublicPostsVisitor")}
        </>
      )}
      <EditPostModal
        post={editingPost}
        open={editingPost !== null}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
