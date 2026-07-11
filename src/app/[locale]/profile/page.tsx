"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import ProfileContent from "@/components/ProfileContent";
import { Skeleton } from "@/components/ui/skeleton";

export default function MyProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!session?.user?.id) return null;

  return <ProfileContent authorId={session.user.id} />;
}
