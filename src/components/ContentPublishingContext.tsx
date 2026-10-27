"use client";

import { useSession } from "next-auth/react";
import { InfoBox } from "@/components/ui/info-box";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useIdentity } from "@/components/IdentityProvider";
import ChannelAvatar from "@/components/ChannelAvatar";
import ContentLanguageNotice from "@/components/ContentLanguageNotice";
import type { PostingChannel } from "@/types/content-composer";

export default function ContentPublishingContext({ channel }: { channel?: PostingChannel }) {
  const t = useTranslations("ContentComposer");
  const verify = useTranslations("Auth.verifyEmail");
  const { data: session } = useSession();
  const { activeIdentity } = useIdentity();
  const identity = channel ?? activeIdentity;
  return <div className="content-publishing-context">
    {identity ? <div className="flex min-w-0 items-center gap-3">
      <ChannelAvatar name={identity.name} avatarUrl={identity.avatarUrl} size="sm" />
      <div className="min-w-0"><p className="text-xs text-muted-foreground">{t("postingAs")}</p><p className="truncate text-sm font-medium">{identity.name}</p></div>
    </div> : <p role="status" className="text-sm text-muted-foreground">{t("selectChannel")}</p>}
    <ContentLanguageNotice />
    {!session?.user?.emailVerifiedAt ? <InfoBox variant="warning" title={verify("unverifiedTitle")}>
      <p>{verify("unverifiedDesc")}</p><Button href="/verify-email" variant="outline" className="mt-3">{t("verifyEmail")}</Button>
    </InfoBox> : null}
  </div>;
}
