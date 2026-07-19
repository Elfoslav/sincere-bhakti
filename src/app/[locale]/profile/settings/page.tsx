import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getNoIndexMetadata } from "@/lib/seo";
import SettingsPageClient from "./settings-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "SettingsPage" });
  return getNoIndexMetadata(t("title"));
}

export default function SettingsPage() {
  return <SettingsPageClient />;
}
