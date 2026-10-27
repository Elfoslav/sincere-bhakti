"use client";

import { useTranslations } from "next-intl";
import ContentComposer from "@/components/ContentComposer";
import PostForm from "@/components/PostForm";
import BlogForm from "@/components/BlogForm";
import AlbumForm from "@/components/AlbumForm";
import type { Post } from "@/types/post";
import type { BlogPost } from "@/types/blog";
import type { Album } from "@/types/album";
import type { PostingChannel } from "@/types/content-composer";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postingChannel?: PostingChannel;
} & (
  { kind: "post"; onSuccess: (post: Post) => void } |
  { kind: "article"; onSuccess: (post: BlogPost) => void } |
  { kind: "album"; onSuccess: (album: Album) => void }
);

export default function ContentCreationDialog(props: Props) {
  const t = useTranslations("ContentComposer");
  return <ContentComposer open={props.open} onOpenChange={props.onOpenChange} title={t(`new${props.kind}`)} wide={props.kind === "article"}>
    {({ complete, requestClose, formState }) => props.kind === "post" ? (
      <PostForm mode="create" {...formState} postingChannel={props.postingChannel} onCancel={requestClose}
        onSuccess={(post) => { props.onSuccess(post); complete(); }} />
    ) : props.kind === "article" ? (
      <BlogForm mode="create" {...formState} postingChannel={props.postingChannel} onCancel={requestClose}
        onSuccess={(post, exit) => { props.onSuccess(post); if (post.isPublic || exit) complete(); }} />
    ) : (
      <AlbumForm mode="create" {...formState} postingChannel={props.postingChannel} onCancel={requestClose}
        onSuccess={(album) => { props.onSuccess(album); complete(); }} />
    )}
  </ContentComposer>;
}
