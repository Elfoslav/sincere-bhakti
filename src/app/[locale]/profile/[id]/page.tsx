"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Hash, FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { UserProfile, ChannelInfo } from "@/types/user";

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
        setProfile((prev) => prev ? { ...prev, name: updated.name } : prev);
        setOpen(false);
      }
    } catch {
      /* empty */
    } finally {
      setSaving(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-white rounded-lg shadow-md p-6 border border-sand text-center space-y-4">
          <Skeleton className="w-20 h-20 rounded-full mx-auto" />
          <Skeleton className="h-6 w-40 mx-auto" />
          <Skeleton className="h-4 w-24 mx-auto" />
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
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
                    name="name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    autoComplete="name"
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

      <section>
        <h2 className="text-xl font-semibold text-deep mb-4">
          {t("channels")}
        </h2>
        {profile.channels.length === 0 ? (
          <p className="text-center text-deep/50 py-8 bg-white/60 rounded-lg border border-sand">
            {t("noChannels")}
          </p>
        ) : (
          <div className="space-y-3">
            {profile.channels.map((ch) => (
              <Link
                key={ch.id}
                href={`/channels/${ch.slug}`}
                className="block bg-white hover:bg-sand/30 active:bg-sand/50 rounded-lg border border-sand p-4 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {ch.avatarUrl ? (
                    <img
                      src={ch.avatarUrl}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                      <Hash className="w-5 h-5 text-gold" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-deep truncate">{ch.name}</p>
                    <p className="text-xs text-deep/50 flex items-center gap-1 mt-0.5">
                      <FileText className="w-3 h-3" />
                      {t("postCount", { count: ch.postCount })}
                    </p>
                  </div>
                  <span className="text-sm text-gold hover:text-gold-light shrink-0">
                    {t("viewChannel")} →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}