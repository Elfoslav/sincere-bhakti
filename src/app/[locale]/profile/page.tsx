"use client";

import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import ProfileContent from "@/components/ProfileContent";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyProfilePage() {
  const { data: session, status } = useSession();
  const t = useTranslations("ProfilePage");

  if (status === "loading") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!session?.user?.id) {
    return (
      <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-deep mb-2">{t("noProfileTitle")}</h1>
          <p className="text-deep/60 mb-6">{t("noProfile")}</p>
          <Link href="/posts">
            <Button variant="default">{t("backToPosts")}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return <ProfileContent authorId={session.user.id} />;
}