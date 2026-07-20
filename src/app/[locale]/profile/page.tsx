import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getNoIndexMetadata } from "@/lib/seo";
import MyProfilePageClient from "./profile-page-client";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ProfilePage" });
  return getNoIndexMetadata(t("title"));
}

export default function MyProfilePage() {
  return <MyProfilePageClient />;
}
