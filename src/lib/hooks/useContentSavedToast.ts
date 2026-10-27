import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "sonner";
import { getPostUrl } from "@/lib/post-url";
import { getBlogUrl } from "@/lib/blog-url";
import { getAlbumUrl } from "@/lib/album-url";
import type { ContentKind } from "@/types/content-composer";
import type { Post } from "@/types/post";

/** Confirmation remains actionable when a filter or private/scheduled state hides the item. */
export function useContentSavedToast(kind: ContentKind) {
  const t = useTranslations("ContentComposer");
  const router = useRouter();
  return (item: Pick<Post, "shortId" | "slug" | "isPublic"> & { publishedAt?: string | null }, mode: "create" | "edit") => {
    const href = kind === "post" ? getPostUrl(item.shortId, item.slug) : kind === "article" ? getBlogUrl(item.shortId, item.slug) : getAlbumUrl(item.shortId, item.slug);
    const scheduled = item.isPublic && item.publishedAt && new Date(item.publishedAt) > new Date();
    const message = !item.isPublic ? "privateNotice" : scheduled ? "scheduledNotice" : mode === "edit" ? "updatedNotice" : "publishedNotice";
    toast.success(t(message), { action: { label: t("viewContent"), onClick: () => router.push(href) } });
  };
}
