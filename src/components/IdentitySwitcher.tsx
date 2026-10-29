"use client";

import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useIdentity } from "@/components/IdentityProvider";
import ChannelAvatar from "@/components/ChannelAvatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getIdentitySubtitleKey } from "@/lib/identity-label";

interface IdentitySwitcherProps {
  mobileNav?: boolean;
}

export default function IdentitySwitcher({ mobileNav = false }: IdentitySwitcherProps) {
  const t = useTranslations("Identity");
  const { identities, activeIdentity, switchIdentity, loading } = useIdentity();
  const [open, setOpen] = useState(false);

  async function handleSelect(channelId: string) {
    if (loading) return;
    if (channelId === activeIdentity?.id) {
      setOpen(false);
      return;
    }
    try {
      await switchIdentity(channelId);
      setOpen(false);
    } catch {
      // The provider restores the previous identity. Keep the menu available
      // so a failed request never implies that another identity was selected.
    }
  }

  return (
    <div className="identity-switcher" data-mobile={mobileNav}>
      {!activeIdentity || identities.length === 0 ? (
        <div className="identity-trigger" aria-hidden="true">
          <Skeleton className={mobileNav ? "size-[22px] shrink-0 rounded-full" : "size-8 shrink-0 rounded-full"} />
          <div className="min-w-0 flex-1 space-y-1.5">
            {!mobileNav && <Skeleton className="h-2.5 w-20" />}
            <Skeleton className="h-3 w-full" />
          </div>
          <ChevronDown className="identity-chevron" />
        </div>
      ) : (
        <Menu.Root open={open} onOpenChange={setOpen} modal={false}>
          <Menu.Trigger className="identity-trigger" aria-label={`${t("switchLabel")}: ${activeIdentity.name}`} aria-busy={loading}>
            <ChannelAvatar name={activeIdentity.name} avatarUrl={activeIdentity.avatarUrl} size={mobileNav ? "xs" : "sm"} className={mobileNav ? undefined : "size-8 text-sm"} ariaHidden />
            <span className="identity-copy">
              {!mobileNav && <span className="identity-label">{t("activeLabel")}</span>}
              <span className={`identity-name ${mobileNav ? "font-sans" : "font-heading"}`}>{activeIdentity.name}</span>
            </span>
            <ChevronDown className="identity-chevron" aria-hidden="true" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={mobileNav ? 30 : 24} align="end" collisionPadding={12} className="z-50">
              <Menu.Popup className="identity-menu outline-none" aria-label={t("switchLabel")}>
                <div className="identity-menu-heading font-heading">{t("switchLabel")}</div>
                <Menu.RadioGroup value={activeIdentity.id} onValueChange={handleSelect} disabled={loading} className="identity-options" aria-busy={loading}>
                  {identities.map(identity => (
                    <Menu.RadioItem key={identity.id} value={identity.id} label={identity.name} className="identity-option">
                      <ChannelAvatar name={identity.name} avatarUrl={identity.avatarUrl} size="sm" className="size-8 text-sm" ariaHidden />
                      <span className="min-w-0 flex-1">
                        <span className="identity-option-name">{identity.name}</span>
                        <span className="block text-xs text-muted-foreground">{t(getIdentitySubtitleKey(identity))}</span>
                      </span>
                      <Menu.RadioItemIndicator className="shrink-0 text-primary"><Check className="size-4" aria-hidden="true" /></Menu.RadioItemIndicator>
                    </Menu.RadioItem>
                  ))}
                </Menu.RadioGroup>
                <div className="identity-menu-footer">
                  <Menu.LinkItem render={<Link href="/profile" />} closeOnClick className="identity-manage">
                    {t("manage")}<ArrowUpRight className="size-4" aria-hidden="true" />
                  </Menu.LinkItem>
                </div>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      )}
    </div>
  );
}
