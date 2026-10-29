"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import HomeHero from "@/components/HomeHero";
import { DESIGN_PALETTES, type DesignPalette } from "@/lib/design-palettes";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import ArticleFeedLayout from "@/components/ArticleFeedLayout";
import FeedEmptyState from "@/components/FeedEmptyState";
import { matchesSearch } from "@/lib/feed-search";
import BlogCard from "@/components/BlogCard";
import type { BlogPost } from "@/types/blog";

export default function PalettePreview({ initialPalette, presentation = false }: { initialPalette: DesignPalette; presentation?: boolean }) {
  const [palette, setPalette] = useState(initialPalette);
  const [category, setCategory] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const t = useTranslations("DesignPreview");
  const locale = useLocale();
  const colors = DESIGN_PALETTES[palette];
  useEffect(() => {
    const root = document.documentElement;
    const overrides = { ...colors, muted: colors.secondary, accent: colors.secondary, popover: colors.card };
    const previous = Object.keys(overrides).map((key) => [key, root.style.getPropertyValue(`--${key}`)]);
    Object.entries(overrides).forEach(([key, value]) => root.style.setProperty(`--${key}`, value));
    return () => previous.forEach(([key, value]) => value ? root.style.setProperty(`--${key}`, value) : root.style.removeProperty(`--${key}`));
  }, [colors]);
  const categories = ["practice", "scripture", "daily", "places", "community", "reflections"].map((key) => ({ id: key, name: t(`category${key}`), slug: key, language: locale }));
  const articles: BlogPost[] = [3, 2, 1].map((number, index) => ({
    id: `preview-${number}`, shortId: `preview${number}`, slug: null, title: t(`article${number}`), excerpt: t(`excerpt${number}`),
    content: t(`excerpt${number}`), contentHtml: `<p>${t(`excerpt${number}`)}</p>`, coverUrl: number === 3 ? "/images/article-tulsi.jpg" : number === 2 ? "/images/article-community.jpg" : "/images/vrindavan-dawn.jpg",
    isPublic: true, language: locale, publishedAt: null, createdAt: "2026-10-20T09:00:00Z", updatedAt: "2026-10-20T09:00:00Z",
    channel: { id: "preview", name: "Sincere Bhakti", slug: "sincere-bhakti", avatarUrl: null, ownerId: "preview" }, categories: [categories[index === 0 ? 0 : index === 1 ? 4 : 3]],
  }));
  const filtered = articles.filter((article) => matchesSearch(search, article.title, article.excerpt) && (!category || article.categories.some((item) => item.name === category)));
  const content = <ArticleFeedLayout search={search} onSearchChange={setSearch} headingLevel={presentation ? "h1" : "h2"} categories={categories} category={category} onCategorySelect={setCategory}>
    {filtered.length ? <div className="pointer-events-none" inert>{filtered.map((article, index) => <BlogCard key={article.id} post={article} variant="list" featured={index === 0 && !search && !category} />)}</div> : <FeedEmptyState search={search || category} />}
  </ArticleFeedLayout>;
  if (presentation) return content;
  return (
    <div>
      <section className="site-container py-6" aria-label={t("title")}>
        <h1 className="font-heading text-2xl">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
        <fieldset className="mt-4 flex flex-wrap gap-3">
          <legend className="sr-only">{t("title")}</legend>
          {(Object.keys(DESIGN_PALETTES) as DesignPalette[]).map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 has-checked:border-primary has-checked:bg-secondary">
              <input type="radio" name="palette" value={key} checked={palette === key} onChange={() => { setPalette(key); const url = new URL(window.location.href); url.searchParams.set("palette", key); history.replaceState(history.state, "", url); }} />
              <span className="size-4 rounded-full" style={{ backgroundColor: DESIGN_PALETTES[key].primary }} />
              <span className="text-sm">{t(key)}</span>
            </label>
          ))}
        </fieldset>
        <p className="mt-3 text-xs text-muted-foreground">{t("background")}: {colors.background} · {t("accent")}: {colors.primary}</p>
      </section>
      <TabsRoot defaultValue="articles">
        <div className="site-container"><TabsList><TabsTab value="articles">{t("articles")}</TabsTab><TabsTab value="home">{t("homepage")}</TabsTab></TabsList></div>
        <TabsPanel value="home"><HomeHero headingLevel="h2" /></TabsPanel>
        <TabsPanel value="articles">
      {content}
        </TabsPanel>
      </TabsRoot>
    </div>
  );
}
