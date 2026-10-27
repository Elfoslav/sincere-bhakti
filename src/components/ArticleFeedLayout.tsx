"use client";

import type { CategoryRef } from "@/types/category";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import FeedFilterBar from "@/components/FeedFilterBar";
import SignInPrompt from "@/components/SignInPrompt";
import CategoryFilterBanner, { ChannelFilterBanner } from "@/components/CategoryFilterBanner";

export default function ArticleFeedLayout({ search, onSearchChange, loading, category, channelName, authenticated = false, headingLevel = "h1", tools, action, children, categories, onCategorySelect }: {
  search: string;
  onSearchChange: (value: string) => void;
  loading?: boolean;
  category?: string;
  channelName?: string;
  authenticated?: boolean;
  headingLevel?: "h1" | "h2";
  tools?: ReactNode;
  action?: ReactNode;
  categories?: CategoryRef[];
  onCategorySelect?: (name?: string) => void;
  children: ReactNode;
}) {
  const t = useTranslations("BlogPage");
  return (
    <div className="article-feed-container">
      <PageHeader as={headingLevel} title={t("title")} description={t("subtitle")} variant="editorial" action={action} />
      {category && <CategoryFilterBanner name={category} href="/blog" />}
      {channelName && <ChannelFilterBanner name={channelName} href="/blog" />}
      <FeedFilterBar search={search} onSearchChange={onSearchChange} searchPlaceholder={t("searchPlaceholder")} basePath="/blog" activeCategory={category} loading={loading} variant="editorial" categories={categories} onCategorySelect={onCategorySelect}
        aside={!authenticated ? <SignInPrompt label={t("signIn")} lead={t("newHere")}>{t("joinSanga")}</SignInPrompt> : undefined} />
      {tools && <div className="article-publish-tools">{tools}</div>}
      {children}
    </div>
  );
}
