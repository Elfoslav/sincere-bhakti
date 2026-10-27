"use client";

import { useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import ContentComposer from "@/components/ContentComposer";
import ContentFormActions from "@/components/ContentFormActions";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import PostForm, { type PostFormHandle } from "@/components/PostForm";
import PostCard from "@/components/PostCard";
import type { Post, MediaType } from "@/types/post";
import { localeFlags } from "@/i18n/routing";
import { deriveCategorySlug } from "@/lib/validation";

const FORM_ID = "edit-post-form";

export default function EditPostModal({
  post,
  open,
  onOpenChange,
  onSuccess,
}: {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (post: Post) => void;
}) {
  const t = useTranslations("EditPost");
  const formRef = useRef<PostFormHandle>(null);
  const [previewValues, setPreviewValues] = useState<{
    content: string;
    isPublic: boolean;
    mediaPreviews: { url: string; type: string; width: number | null; height: number | null }[];
    categories: string[];
  } | null>(null);

  const handleTabChange = useCallback(
    (tab: string | null) => {
      if (tab === "preview" && formRef.current) {
        setPreviewValues(formRef.current.getValues());
      }
    },
    [],
  );

  if (!post) return null;

  const previewPost: Post = previewValues
    ? {
        id: post.id,
        shortId: post.shortId,
        slug: post.slug,
        content: previewValues.content || null,
        media: previewValues.mediaPreviews.map((m, i) => ({
          url: m.url,
          type: m.type as MediaType,
          position: i,
          width: m.width,
          height: m.height,
        })),
        isPublic: previewValues.isPublic,
        language: post.language,
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        channel: post.channel,
        blogPost: post.blogPost,
        blogPostId: post.blogPostId,
        categories: previewValues.categories.map((name) => (
          post.categories.find((c) => c.name === name) ?? { id: name, name, slug: deriveCategorySlug(name), language: post.language }
        )),
      }
    : post;

  return (
    <ContentComposer open={open} onOpenChange={onOpenChange} title={<>{t("title")} <span className="ml-2 text-base" title={post.language}>{localeFlags[post.language] || post.language}</span></>}>
      {({ complete, requestClose, busy: submitting, formState }) => (
        <TabsRoot defaultValue="edit" onValueChange={handleTabChange}>
          <TabsList>
            <TabsTab value="edit">{t("editTab")}</TabsTab>
            <TabsTab value="preview">{t("previewTab")}</TabsTab>
          </TabsList>

          <TabsPanel value="edit" keepMounted>
            <PostForm
              ref={formRef}
              formId={FORM_ID}
              mode="edit"
              postId={post.id}
              initialContent={post.content || ""}
              initialIsPublic={post.isPublic}
              initialMedia={post.media}
              initialCategories={post.categories.map((c) => c.name)}
              onSuccess={(updated) => { onSuccess(updated); complete(); }}
              onCancel={requestClose}
              {...formState}
            />
          </TabsPanel>

          <TabsPanel value="preview" keepMounted>
            <PostCard
              post={previewPost}
              currentUserId={post.channel.ownerId}
              hideEdit
            />

            <ContentFormActions mode="edit" isPublic={previewPost.isPublic} busy={submitting} disabled={submitting} onCancel={requestClose} formId={FORM_ID} />
          </TabsPanel>
        </TabsRoot>
      )}
    </ContentComposer>
  );
}
