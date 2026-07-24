"use client";

import { useState } from "react";
import { SessionProvider, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import EditPostModal from "@/components/EditPostModal";
import PostCard from "@/components/PostCard";
import type { Post } from "@/types/post";
import type { Session } from "next-auth";

const TEST_USER_ID = "test-user-1";

const mockSession: Session = {
  user: {
    id: TEST_USER_ID,
    name: "Test User",
    email: "test@example.com",
    channelId: "test-channel-1",
  },
  expires: "2099-01-01T00:00:00.000Z",
};

const initialPost: Post = {
  id: "test-post-1",
  content: "Test post with media",
  isPublic: true,
  language: "en",
  createdAt: "2026-07-19T12:00:00.000Z",
  channel: {
    id: "test-channel-1",
    name: "Test User",
    slug: "test-user",
    avatarUrl: null,
    ownerId: TEST_USER_ID,
  },
  media: [
    {
      url: "https://example.com/uploads/test-image.png",
      type: "image",
      position: 0,
      width: 800,
      height: 600,
    },
    {
      url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      type: "youtube",
      position: 1,
      width: null,
      height: null,
    },
  ],
};

export default function EditPostHarness() {
  return (
    <SessionProvider session={mockSession}>
      <EditPostHarnessContent />
    </SessionProvider>
  );
}

function EditPostHarnessContent() {
  const { status } = useSession();
  const [post, setPost] = useState<Post>(initialPost);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const isAuthenticated = status === "authenticated";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8">
      <Button
        onClick={() => setEditingPostId(post.id)}
        aria-label="Edit post"
        data-testid="open-edit-modal"
        disabled={!isAuthenticated}
      >
        Edit post
      </Button>
      <PostCard
        post={post}
        currentUserId={TEST_USER_ID}
        manageableChannelIds={[post.channel.id]}
        onEdit={setEditingPostId}
      />
      <EditPostModal
        post={editingPostId ? post : null}
        open={!!editingPostId}
        onOpenChange={(open) => {
          if (!open) setEditingPostId(null);
        }}
        onSuccess={setPost}
      />
    </div>
  );
}
