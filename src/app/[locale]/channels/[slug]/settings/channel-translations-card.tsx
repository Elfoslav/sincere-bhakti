"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { locales, localeFlags } from "@/i18n/routing";
import type { ChannelSettingsTranslation } from "@/types/channel";
import EditTranslationDialog from "./edit-translation-dialog";

export default function ChannelTranslationsCard({
  translations: initialTranslations,
  channelSlug,
}: {
  translations: ChannelSettingsTranslation[];
  channelSlug: string;
}) {
  const t = useTranslations("ChannelSettingsPage");
  const [translations, setTranslations] = useState<ChannelSettingsTranslation[]>(initialTranslations);
  const [editing, setEditing] = useState<ChannelSettingsTranslation | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const usedLanguages = new Set(translations.map((tr) => tr.language));
  const availableLocales = locales.filter((loc) => !usedLanguages.has(loc));

  async function handleSave(data: { language: string; name: string }, existingId?: string) {
    const response = await fetch(`/api/channels/${channelSlug}/translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: data.language, name: data.name }),
    });
    const result = await response.json();

    if (!response.ok) {
      const message = result.error === "name_taken" ? t("translationsSaveError") : t("translationsSaveError");
      toast.error(message);
      return false;
    }

    setTranslations((current) => {
      if (existingId) {
        return current.map((tr) => (tr.id === existingId ? result : tr));
      }
      return [...current, result];
    });
    toast.success(existingId ? t("translationUpdated") : t("translationAdded"));
    return true;
  }

  async function handleDelete(translation: ChannelSettingsTranslation) {
    if (translations.length <= 1) {
      toast.error(t("cannotRemoveLastTranslation"));
      return;
    }
    if (!confirm(t("confirmDeleteTranslation", { language: translation.language }))) return;

    const response = await fetch(`/api/channels/${channelSlug}/translations?language=${translation.language}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const result = await response.json();
      toast.error(result.error === "cannot_remove_last_translation" ? t("cannotRemoveLastTranslation") : t("translationsDeleteError"));
      return;
    }

    setTranslations((current) => current.filter((tr) => tr.id !== translation.id));
    toast.success(t("translationDeleted") ?? "Translation removed");
  }

  return (
    <>
      <Card variant="default" padding="lg">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
            <Globe className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <Heading as="h2" className="text-lg">{t("translationsTitle")}</Heading>
            <p className="text-sm text-deep/50">{t("translationsSubtitle")}</p>
          </div>
          {availableLocales.length > 0 && (
            <Button variant="outline" size="sm" icon={<Plus className="size-4" />} onClick={() => setShowAdd(true)}>
              {t("addTranslation")}
            </Button>
          )}
        </div>

        {translations.length === 0 && (
          <p className="py-4 text-sm text-deep/50">{t("noTranslations")}</p>
        )}

        {translations.length > 0 && (
          <div className="divide-y divide-sand">
            {translations.map((tr) => (
              <div key={tr.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="text-lg">{localeFlags[tr.language] ?? tr.language}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-deep">{tr.name}</p>
                  <p className="text-xs text-deep/40">/{tr.slug}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("editTranslation")}
                  onClick={() => setEditing(tr)}
                >
                  <Pencil className="size-4" />
                </Button>
                {translations.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("deleteTranslation")}
                    onClick={() => handleDelete(tr)}
                  >
                    <Trash2 className="size-4 text-red" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {(showAdd || editing) && (
        <EditTranslationDialog
          translation={editing}
          availableLocales={showAdd ? availableLocales : []}
          onSave={handleSave}
          onClose={() => {
            setShowAdd(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}