"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image: string | null;
  createdAt: string;
}

interface Post {
  id: string;
  content: string | null;
  mediaUrl: string | null;
  mediaType: string | null;
  isPublic: boolean;
  createdAt: string;
  author: { id: string; name: string | null; image: string | null };
}

export default function ProfilePage() {
  const params = useParams();
  const { data: session } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const isOwnProfile = session?.user?.id === params.id;

  useEffect(() => {
    if (params.id) fetchProfile();
  }, [params.id]);

  useEffect(() => {
    if (profile) setNewName(profile.name);
  }, [profile]);

  async function fetchProfile() {
    try {
      const [profileRes, postsRes] = await Promise.all([
        fetch(`/api/users/${params.id}`),
        fetch(`/api/posts?scope=public`),
      ]);

      if (profileRes.ok) setProfile(await profileRes.json());
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(data.posts.filter((p: Post) => p.author.id === params.id));
      }
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }

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

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <p className="text-deep/60">Loading...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <p className="text-deep/60">Devotee not found</p>
      </div>
    );
  }

  const date = new Date(profile.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

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
                title="Edit name"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Edit Name</DialogTitle>
                </DialogHeader>
                <form
                  onSubmit={(e) => { e.preventDefault(); handleSave(); }}
                  className="space-y-4 pt-2"
                >
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Your name"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving || !newName.trim()}
                    >
                      {saving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
        <p className="text-deep/50 text-sm mt-1">
          Joined {date}
        </p>
      </div>

      <h2 className="text-xl font-semibold text-deep mb-4">
        Public Posts ({posts.length})
      </h2>

      {posts.length === 0 ? (
        <p className="text-center text-deep/50 py-8 bg-white/60 rounded-lg border border-sand">
          No public posts yet.
        </p>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
