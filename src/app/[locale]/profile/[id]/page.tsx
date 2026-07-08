"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton, PostCardSkeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { useInfinitePosts } from "@/lib/hooks/useInfinitePosts";
import type { UserProfile } from "@/types/user";
import type { Post } from "@/types/post";

export default function ProfilePage() {
  const params = useParams();
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("ProfilePage");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const authorId = params.id as string;
  const isOwnProfile = session?.user?.id === authorId;

  const {
    posts: publicPosts,
    setPosts: setPublicPosts,
    loading: publicLoading,
    loadingMore: publicLoadingMore,
    hasMore: publicHasMore,
    sentinelRef: publicSentinelRef,
  } = useInfinitePosts({ authorId, disabled: !authorId, language: locale });

  const {
    posts: myPosts,
    setPosts: setMyPosts,
    loading: myPostsLoading,
    loadingMore: myPostsLoadingMore,
    hasMore: myPostsHasMore,
    sentinelRef: myPostsSentinelRef,
  } = useInfinitePosts({ scope: "private", disabled: !isOwnProfile, language: locale });

  const myPrivatePosts = useMemo(() => myPosts.filter((p) => !p.isPublic), [myPosts]);

  useEffect(() => {
    if (!authorId) return;
    let mounted = true;
    fetch(`/api/users/${authorId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (mounted && data) {
          setProfile(data);
          setNewName(data.name);
        }
      })
      .finally(() => { if (mounted) setProfileLoading(false); });
    return () => { mounted = false; };
  }, [authorId]);

  async function handleSave() {
    if (!newName.trim() || !profile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${profile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setProfile(updated);
        setOpen(false);
      }
    } catch {
      /* empty */
    } finally {
      setSaving(false);
    }
  }

  const handleDelete = useCallback((id: string) => {
    setPublicPosts((prev) => prev.filter((p) => p.id !== id));
    setMyPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  if (profileLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-sand text-center space-y-4">
          <Skeleton className="w-20 h-20 rounded-full mx-auto" />
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-4 w-24 mx-auto" />
        </div>
        <PostCardSkeleton />
        <PostCardSkeleton />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <p className="text-deep/60">{t("noProfile")}</p>
      </div>
    );
  }

  const date = new Date(profile.createdAt).toLocaleDateString(locale === "en" ? "en-US" : locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
        <p className="text-center text-deep/50 py-8 bg-white/60 rounded-lg border border-sand">
          {t(emptyKey)}
        </p>
      );
    }
    return (
      <div>
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={session?.user?.id} onDelete={handleDelete} />
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6 border border-sand mb-8 text-center">
        <div className="w-20 h-20 rounded-full bg-gold flex items-center justify-center text-deep text-3xl font-bold mx-auto mb-4">
          {profile.name[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex items-center justify-center gap-2">
          <h1 className="text-2xl font-bold text-deep">{profile.name}</h1>
          {isOwnProfile && (
            <Dialog open={open} onOpenChange={setOpen}>
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
                  onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                  className="space-y-4 pt-2"
                >
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      {t("cancel")}
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving || !newName.trim()}
                    >
                      {saving ? t("saving") : t("save")}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <p className="text-deep/50 text-sm mt-1">
          {t("joined", { date })}
        </p>
      </div>

      {isOwnProfile ? (
        <TabsRoot defaultValue="my-public">
          <TabsList>
            <TabsTab value="my-public">{t("myPublicPosts", { count: publicPosts.length })}</TabsTab>
            <TabsTab value="my-private">{t("myPrivatePosts", { count: myPrivatePosts.length })}</TabsTab>
          </TabsList>

          <TabsPanel value="my-public">
            {renderPostList(publicPosts, publicLoading, publicLoadingMore, publicHasMore, publicSentinelRef, "noPosts")}
          </TabsPanel>

          <TabsPanel value="my-private">
            {renderPostList(myPrivatePosts, myPostsLoading, myPostsLoadingMore, myPostsHasMore, myPostsSentinelRef, "noPrivatePosts")}
          </TabsPanel>
        </TabsRoot>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-deep mb-4">
            {t("publicPosts", { count: publicPosts.length })}
          </h2>
          {renderPostList(publicPosts, publicLoading, publicLoadingMore, publicHasMore, publicSentinelRef, "noPosts")}
        </>
      )}
    </div>
  );
}
