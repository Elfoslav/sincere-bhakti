"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogHeader,
  dialogActionButtonClassName,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ChannelMember } from "@/types/channel";
import type { ChannelMemberRole } from "@/lib/channel-roles";
import MemberAccessForm from "./member-access-form";

const EDIT_MEMBER_FORM_ID = "edit-channel-member-form";

export default function EditMemberDialog({
  member,
  email,
  role,
  error,
  submitting,
  onEmailChange,
  onRoleChange,
  onSubmit,
  onClose,
}: {
  member: ChannelMember | null;
  email: string;
  role: ChannelMemberRole;
  error: string;
  submitting: boolean;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: ChannelMemberRole) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const t = useTranslations("ChannelSettingsPage");

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="gap-3 sm:max-w-2xl">
        <DialogHeader
          className="gap-1"
          text={t("editMemberTitle")}
          subheading={member?.name}
          subheadingClassName="text-deep/50"
        />
        {member && (
          <>
            <MemberAccessForm
              id={EDIT_MEMBER_FORM_ID}
              mode="edit"
              email={email}
              role={role}
              error={error}
              submitting={submitting}
              disabledEmail
              showSubmitButton={false}
              onEmailChange={onEmailChange}
              onRoleChange={onRoleChange}
              onSubmit={onSubmit}
              submitLabel={t("saveChanges")}
              submittingLabel={t("saving")}
            />
            <DialogActions>
              <Button
                type="button"
                variant="outline"
                className={dialogActionButtonClassName}
                onClick={onClose}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                form={EDIT_MEMBER_FORM_ID}
                className={dialogActionButtonClassName}
                disabled={submitting || !email.trim()}
              >
                {submitting ? t("saving") : t("saveChanges")}
              </Button>
            </DialogActions>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
