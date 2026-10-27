"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DialogActions } from "@/components/ui/dialog";

export default function ContentFormActions({ busy, disabled, onCancel, mode, isPublic, scheduled = false, primaryLabel, secondary, formId }: {
  formId?: string;
  busy: boolean;
  disabled: boolean;
  onCancel?: () => void;
  mode: "create" | "edit";
  isPublic: boolean;
  scheduled?: boolean;
  primaryLabel?: string;
  secondary?: ReactNode;
}) {
  const t = useTranslations("ContentComposer");
  const common = useTranslations("Common");
  return <DialogActions className="content-form-actions">
    {onCancel ? <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>{common("cancel")}</Button> : null}
    <div className="content-submit-actions">{secondary}<Button type="submit" form={formId} disabled={disabled}>
      {busy ? t("workingShort") : primaryLabel ?? t(mode === "edit" ? "saveChanges" : !isPublic ? "savePrivately" : scheduled ? "schedule" : "publish")}
    </Button></div>
  </DialogActions>;
}
