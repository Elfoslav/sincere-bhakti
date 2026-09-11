"use client";

import { useTranslations } from "next-intl";
import { TabsRoot, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import ClassicVariant from "@/components/blog-detail-variants/ClassicVariant";
import MagazineVariant from "@/components/blog-detail-variants/MagazineVariant";
import EditorialVariant from "@/components/blog-detail-variants/EditorialVariant";
import ImmersiveVariant from "@/components/blog-detail-variants/ImmersiveVariant";
import SplitVariant from "@/components/blog-detail-variants/SplitVariant";
import { mockMainPost, mockLatestPosts, mockContentHtml } from "@/components/blog-detail-variants/mock-posts";

const VARIANT_IDS = ["classic", "magazine", "editorial", "immersive", "split"] as const;

const VARIANT_COMPONENTS = {
  classic: ClassicVariant,
  magazine: MagazineVariant,
  editorial: EditorialVariant,
  immersive: ImmersiveVariant,
  split: SplitVariant,
} as const;

/**
 * Preview gallery for the blog-detail design directions. Each tab renders
 * one presentational variant against the same mock article so directions
 * can be compared side by side before one ships to the real detail page.
 */
export default function DesignVariantsClient() {
  const t = useTranslations("BlogPage");
  const labels: Record<(typeof VARIANT_IDS)[number], string> = {
    classic: t("variantClassic"),
    magazine: t("variantMagazine"),
    editorial: t("variantEditorial"),
    immersive: t("variantImmersive"),
    split: t("variantSplit"),
  };

  return (
    <div className="w-full">
      <div className="w-full max-w-3xl mx-auto px-4 pt-8 text-center">
        <h1 className="text-3xl font-bold text-deep">{t("designVariantsTitle")}</h1>
        <p className="mt-1 text-deep/60">{t("designVariantsSubtitle")}</p>
      </div>
      <TabsRoot defaultValue="classic" className="mt-6">
        <div className="sticky top-0 z-10 border-b border-deep/10 bg-white/95 backdrop-blur">
          <TabsList className="mx-auto w-full max-w-3xl justify-start overflow-x-auto px-4">
            {VARIANT_IDS.map((id) => (
              <TabsTab key={id} value={id}>
                {labels[id]}
              </TabsTab>
            ))}
          </TabsList>
        </div>
        {VARIANT_IDS.map((id) => {
          const Variant = VARIANT_COMPONENTS[id];
          return (
            <TabsPanel key={id} value={id} className="mt-0">
              <Variant post={mockMainPost} contentHtml={mockContentHtml} latestPosts={mockLatestPosts} />
            </TabsPanel>
          );
        })}
      </TabsRoot>
    </div>
  );
}
