"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose, dialogActionButtonClassName } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localeFlags } from "@/i18n/routing";
import { MAX_RENAME_COUNT } from "@/lib/validation";
import type { ChannelSettingsTranslation } from "@/types/channel";

export default function EditTranslationDialog({
  translation,
  availableLocales,
  renameCount,
  onSave,
  onClose,
}: {
  translation: ChannelSettingsTranslation | null;
  availableLocales: string[];
  renameCount: number;
  onSave: (data: { language: string; name: string }, existingId?: string) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("ChannelSettingsPage");
  const common = useTranslations("Common");
  const isEditing = !!translation;

  const [language, setLanguage] = useState(translation?.language ?? availableLocales[0] ?? "");
  const [name, setName] = useState(translation?.name ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !language) return;

    setSubmitting(true);
    setError("");

    try {
      const ok = await onSave({ language, name: name.trim() }, translation?.id);
      if (ok) onClose();
    } catch {
      setError(t("translationsSaveError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader
          text={isEditing ? t("editTranslation") : t("addTranslation")}
          subheading={isEditing ? common("renameCountInfo") : undefined}
          subheadingRight={isEditing ? common("renameCount", { count: renameCount, max: MAX_RENAME_COUNT }) : undefined}
          subheadingClassName="text-deep/50"
          subheadingRightClassName="text-deep/50"
        />

        <form id="translation-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="translation-language" className="text-sm font-medium text-deep">{t("languageLabel")}</label>
            {isEditing ? (
              <div className="flex h-10 items-center gap-2 rounded-lg border border-input bg-muted px-3 text-sm text-deep/60">
                <span>{localeFlags[translation!.language] ?? ""}</span>
                <span>{translation!.language.toUpperCase()}</span>
              </div>
            ) : (
              <select
                id="translation-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-deep outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {availableLocales.map((loc) => (
                  <option key={loc} value={loc}>
                    {localeFlags[loc] ?? ""} {loc.toUpperCase()}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="translation-name" className="text-sm font-medium text-deep">{t("nameLabel")}</label>
            <Input
              id="translation-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("translationNamePlaceholder")}
              errorMessage={error || undefined}
              maxLength={50}
              autoFocus
            />
          </div>
        </form>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className={dialogActionButtonClassName}>{t("cancel")}</Button>} />
          <Button
            type="submit"
            form="translation-form"
            className={dialogActionButtonClassName}
            disabled={submitting || !name.trim() || !language}
          >
            {submitting ? t("saving") : isEditing ? t("saveChanges") : t("addTranslation")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}