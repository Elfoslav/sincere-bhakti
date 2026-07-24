"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Globe, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { locales, localeFlags } from "@/i18n/routing";
import { MAX_RENAME_COUNT } from "@/lib/validation";
import type { ChannelSettingsTranslation } from "@/types/channel";
import EditTranslationDialog from "./edit-translation-dialog";

export default function ChannelTranslationsCard({
  translations: initialTranslations,
  channelSlug,
  renameCount: initialRenameCount,
  isPersonal,
}: {
  translations: ChannelSettingsTranslation[];
  channelSlug: string;
  renameCount: number;
  isPersonal: boolean;
}) {
  const t = useTranslations("ChannelSettingsPage");
  const common = useTranslations("Common");
  const [translations, setTranslations] = useState<ChannelSettingsTranslation[]>(initialTranslations);
  const [renameCount, setRenameCount] = useState(initialRenameCount);
  const [editing, setEditing] = useState<ChannelSettingsTranslation | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingTranslation, setDeletingTranslation] = useState<ChannelSettingsTranslation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const usedLanguages = new Set(translations.map((tr) => tr.language));
  const availableLocales = locales.filter((loc) => !usedLanguages.has(loc));
  const renameLocked = renameCount >= MAX_RENAME_COUNT;

  // The `channelSlug` prop is the page-locale slug at load time; renaming that
  // translation moves its slug to history, so reusing the prop would 404 the
  // next request. The live `translations` state always holds a current slug that
  // still resolves the channel, so derive the lookup slug from it.
  const lookupSlug = translations[0]?.slug ?? channelSlug;

  async function handleSave(data: { language: string; name: string }, existingId?: string) {
    const response = await fetch(`/api/channels/${lookupSlug}/translations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: data.language, name: data.name }),
    });
    const result = await response.json();

    if (!response.ok) {
      if (result.error === "name_taken") {
        toast.error(t("translationsNameTaken"));
        return false;
      }
      if (result.error === "rename_limit_reached") {
        toast.error(common("renameLimitReached"));
        return false;
      }
      if (result.error === "cannot_rename_personal_channel") {
        toast.error(t("translationsSaveError"));
        return false;
      }
      toast.error(t("translationsSaveError"));
      return false;
    }

    setTranslations((current) => {
      if (existingId) {
        return current.map((tr) => (tr.id === existingId ? { id: result.id, language: result.language, name: result.name, slug: result.slug } : tr));
      }
      return [...current, { id: result.id, language: result.language, name: result.name, slug: result.slug }];
    });
    setRenameCount(result.renameCount);
    toast.success(existingId ? t("translationUpdated") : t("translationAdded"));
    return true;
  }

  function handleDeleteClick(translation: ChannelSettingsTranslation) {
    if (translations.length <= 1) {
      toast.error(t("cannotRemoveLastTranslation"));
      return;
    }
    setDeletingTranslation(translation);
  }

  async function handleDeleteConfirm() {
    if (!deletingTranslation) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/channels/${lookupSlug}/translations?language=${deletingTranslation.language}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error === "cannot_remove_last_translation" ? t("cannotRemoveLastTranslation") : t("translationsDeleteError"));
        return;
      }

      setTranslations((current) => current.filter((tr) => tr.id !== deletingTranslation.id));
      toast.success(t("translationDeleted") ?? "Translation removed");
    } finally {
      setIsDeleting(false);
      setDeletingTranslation(null);
    }
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
            {!isPersonal && (
              <p className="mt-1 text-xs text-deep/40">
                {common("renameCountInfo")} {common("renameCount", { count: renameCount, max: MAX_RENAME_COUNT })}
              </p>
            )}
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
                  disabled={renameLocked}
                  onClick={() => setEditing(tr)}
                >
                  <Pencil className="size-4" />
                </Button>
                  {translations.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("deleteTranslation")}
                      onClick={() => handleDeleteClick(tr)}
                    >
                      <Trash2 className="size-4 text-red" />
                    </Button>
                  )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deletingTranslation}
        onOpenChange={(open) => { if (!open) setDeletingTranslation(null); }}
        title={t("deleteTranslation")}
        description={deletingTranslation ? t("confirmDeleteTranslation", { language: deletingTranslation.language }) : ""}
        confirmLabel={t("deleteTranslation")}
        cancelLabel={common("cancel")}
        onConfirm={handleDeleteConfirm}
        variant="destructive"
        loading={isDeleting}
      />

      {(showAdd || editing) && (
        <EditTranslationDialog
          translation={editing}
          availableLocales={showAdd ? availableLocales : []}
          renameCount={renameCount}
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