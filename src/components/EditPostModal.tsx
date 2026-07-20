"use client";

import { useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogHeader,
  dialogActionButtonClassName,
} from "@/components/ui/dialog";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import PostForm, { type PostFormHandle } from "@/components/PostForm";
import PostCard from "@/components/PostCard";
import type { Post, MediaType } from "@/types/post";
import { localeFlags } from "@/i18n/routing";

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
  const postT = useTranslations("PostsPage");
  const formRef = useRef<PostFormHandle>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewValues, setPreviewValues] = useState<{
    content: string;
    isPublic: boolean;
    mediaPreviews: { url: string; type: string; width: number | null; height: number | null }[];
  } | null>(null);

  const handleSuccess = useCallback(
    (updatedPost: Post) => {
      onSuccess(updatedPost);
      onOpenChange(false);
    },
    [onSuccess, onOpenChange],
  );

  const handleSubmittingChange = useCallback((s: boolean) => {
    setSubmitting(s);
  }, []);

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
        createdAt: post.createdAt,
        channel: post.channel,
      }
    : post;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader
          text={(
            <>
              {t("title")}
              <span className="ml-2 text-base" title={post.language}>
                {localeFlags[post.language] || post.language}
              </span>
            </>
          )}
        />

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
              onSuccess={handleSuccess}
              onCancel={() => onOpenChange(false)}
              onSubmittingChange={handleSubmittingChange}
            />
          </TabsPanel>

          <TabsPanel value="preview" keepMounted>
            <PostCard
              post={previewPost}
              currentUserId={post.channel.ownerId}
              hideEdit
              hideExternalLink
            />

            <DialogActions className="mt-4 border-t border-sand pt-4">
              <Button type="button" variant="outline" className={dialogActionButtonClassName} onClick={() => onOpenChange(false)} disabled={submitting}>
                {postT("cancel")}
              </Button>
              <Button type="submit" form={FORM_ID} variant="default" className={dialogActionButtonClassName} disabled={submitting}>
                {submitting ? postT("posting") : postT("saveButton")}
              </Button>
            </DialogActions>
          </TabsPanel>
        </TabsRoot>
      </DialogContent>
    </Dialog>
  );
}
