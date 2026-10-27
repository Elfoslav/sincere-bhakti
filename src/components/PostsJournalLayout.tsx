"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { PostChannel } from "@/types/post";
import ChannelAvatar from "@/components/ChannelAvatar";
import PageHeader from "@/components/PageHeader";
import SignInPrompt from "@/components/SignInPrompt";
import LotusIcon from "@/components/ui/lotus-icon";

/** Journal composition around the existing feed, filters and publishing controls. */
export default function PostsJournalLayout({ children, filters, channels, authenticated, action }: {
  children: ReactNode;
  action?: ReactNode;
  filters: ReactNode;
  channels: PostChannel[];
  authenticated: boolean;
}) {
  const t = useTranslations("PostsPage");
  const nav = useTranslations("Navbar");
  return (
    <div className="journal-container">
      <PageHeader variant="editorial" title={t("title")} description={t("subtitle")} action={action} />
      {filters}
      <div className="journal-workspace">
        <div className="journal-feed">{children}</div>
        <aside className="journal-sidebar" aria-label={t("journalLabel")}>
          <div className="journal-intro">
            <LotusIcon className="mb-6 size-9 text-primary" />
            <h2 className="font-heading">{t("communityTitle")}</h2>
            <p className="journal-intro-description">{t("communityDescription")}</p>
            {!authenticated ? <SignInPrompt label={t("signIn")}>{t("signInToPost")}</SignInPrompt> : null}
          </div>
          <nav className="journal-channels" aria-label={nav("channels")}>
            <h2 className="journal-eyebrow">{nav("channels")}</h2>
            {channels.map((channel) => <Link key={channel.id} href={`/channels/${channel.slug}`} className="journal-channel">
              <ChannelAvatar name={channel.name} avatarUrl={channel.avatarUrl} size="sm" />
              <span>{channel.name}</span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>)}
            <Link href="/channels" className="journal-all-channels">{t("browseChannels")}<ArrowUpRight className="size-4" aria-hidden /></Link>
          </nav>
        </aside>
      </div>
    </div>
  );
}
