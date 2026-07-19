"use client";

import { useTranslations } from "next-intl";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHANNEL_MEMBER_ROLES,
  type ChannelMemberRole,
} from "@/lib/channel-roles";
import { channelMemberRoleLabel } from "./member-settings-utils";

export default function MemberAccessForm({
  mode,
  id,
  email,
  role,
  error,
  submitting,
  disabledEmail = false,
  showSubmitButton = true,
  onEmailChange,
  onRoleChange,
  onSubmit,
  submitLabel,
  submittingLabel,
}: {
  mode: "add" | "edit";
  id?: string;
  email: string;
  role: ChannelMemberRole;
  error: string;
  submitting: boolean;
  disabledEmail?: boolean;
  showSubmitButton?: boolean;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: ChannelMemberRole) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  submittingLabel: string;
}) {
  const t = useTranslations("ChannelSettingsPage");
  const fields = (
    <>
      <Input
        type="email"
        value={email}
        onChange={(event) => onEmailChange(event.target.value)}
        placeholder={t("emailPlaceholder")}
        errorMessage={error || undefined}
        maxLength={255}
        disabled={disabledEmail}
        autoFocus={mode === "add"}
      />
      <select
        value={role}
        onChange={(event) => onRoleChange(event.target.value as ChannelMemberRole)}
        className="h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-deep outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        autoFocus={mode === "edit"}
      >
        {CHANNEL_MEMBER_ROLES.map((memberRole) => (
          <option key={memberRole} value={memberRole}>
            {channelMemberRoleLabel(memberRole, t)}
          </option>
        ))}
      </select>
    </>
  );

  return (
    <form
      id={id}
      onSubmit={onSubmit}
      className={showSubmitButton ? "grid gap-3 sm:grid-cols-[1fr_9rem_auto]" : "grid gap-3 sm:grid-cols-[1fr_9rem]"}
    >
      {fields}
      {showSubmitButton && (
        <Button
          type="submit"
          disabled={submitting || !email.trim()}
          icon={mode === "add" ? <UserPlus className="size-4" /> : undefined}
        >
          {submitting ? submittingLabel : submitLabel}
        </Button>
      )}
    </form>
  );
}
