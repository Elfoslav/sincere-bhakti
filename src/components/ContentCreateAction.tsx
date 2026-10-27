"use client";

import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { ContentKind } from "@/types/content-composer";

export default function ContentCreateAction({ kind, authenticated, onClick }: {
  kind: ContentKind;
  authenticated: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("ContentComposer");
  const pathname = usePathname();
  const search = useSearchParams();
  const returnTo = `${pathname ?? "/"}${search?.size ? `?${search.toString()}` : ""}`;
  return <Button className="content-create-action" icon={<Plus />} onClick={authenticated ? onClick : undefined}
    href={authenticated ? undefined : `/login?callbackUrl=${encodeURIComponent(returnTo)}`}>
    {t(authenticated ? `new${kind}` : "signInToCreate")}
  </Button>;
}
