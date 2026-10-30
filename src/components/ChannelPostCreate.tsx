"use client";

import { useState } from "react";
import ContentCreateAction from "@/components/ContentCreateAction";
import ContentCreationDialog from "@/components/ContentCreationDialog";
import type { PostingChannel } from "@/types/content-composer";
import type { Post } from "@/types/post";

/** Adapter for channel pages, whose permission gate is owned by the parent. */
export default function ChannelPostCreate({ postingChannel, onSuccess }: { postingChannel: PostingChannel; onSuccess: (post: Post) => void }) {
  const [open, setOpen] = useState(false);
  return <>
    <ContentCreateAction kind="post" authenticated onClick={() => setOpen(true)} />
    <ContentCreationDialog kind="post" open={open} onOpenChange={setOpen} onSuccess={(post) => {
      // A different posting identity publishes to its own channel, not this feed.
      if (post.channel.id === postingChannel.id) onSuccess(post);
    }} postingChannel={postingChannel} />
  </>;
}
