"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@/components/ui/switch";

export default function ContentVisibilityControl({ isPublic, onChange }: { isPublic: boolean; onChange: (value: boolean) => void }) {
  const t = useTranslations("PostsPage");
  return <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
    <Switch checked={isPublic} onCheckedChange={onChange} aria-label={t("public")} />
    <span>{isPublic ? t("public") : t("private")}</span>
  </label>;
}
