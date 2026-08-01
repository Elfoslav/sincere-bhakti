"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { InfoBox } from "@/components/ui/info-box";
import { Button } from "@/components/ui/button";
import { locales, localeFlags } from "@/i18n/routing";

const STORAGE_PREFIX = "channel-visibility-notice:";

function readDismissed(channelId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + channelId) === "1";
  } catch {
    return false;
  }
}

/**
 * Tells a channel manager that the channel is only listed in some locales and
 * that adding a translation makes it appear in the others. Personal channels
 * are auto-created with a single translation (the locale the user registered
 * in), so without this hint a user has no way to discover that their channel
 * is missing from e.g. the Czech and Slovak listings. Dismissal persists per
 * channel.
 */
export default function ChannelVisibilityNotice({
  channelId,
  channelSlug,
  availableLanguages,
  show,
}: {
  channelId: string;
  channelSlug: string;
  availableLanguages: string[];
  show: boolean;
}) {
  // The parent renders this with a `key={channelId}`, so the lazy initializer
  // runs fresh per channel and the dismissal never leaks between channels.
  const [dismissed, setDismissed] = useState(() => readDismissed(channelId));
  const t = useTranslations("ChannelPage");

  const missingLocales = locales.filter((lang) => !availableLanguages.includes(lang));

  if (!show || dismissed || missingLocales.length === 0) return null;

  const missingFlags = missingLocales.map((lang) => localeFlags[lang] ?? lang).join(" ");

  return (
    <InfoBox
      variant="info"
      title={t("visibilityNoticeTitle")}
      className="mb-6"
      closeLabel={t("visibilityNoticeDismiss")}
      onClose={() => {
        try {
          localStorage.setItem(STORAGE_PREFIX + channelId, "1");
        } catch {
          // storage unavailable — just hide for this render
        }
        setDismissed(true);
      }}
      action={
        <Button href={`/channels/${channelSlug}/settings`} variant="outline" size="sm">
          {t("visibilityNoticeAction")}
        </Button>
      }
    >
      <p>{t("visibilityNoticeBody", { languages: missingFlags })}</p>
    </InfoBox>
  );
}
