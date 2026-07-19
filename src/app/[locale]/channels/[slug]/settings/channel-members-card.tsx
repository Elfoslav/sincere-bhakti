"use client";

import { useTranslations } from "next-intl";
import { Shield } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import type { ChannelMember } from "@/types/channel";
import type { ChannelMemberRole } from "@/lib/channel-roles";
import MemberAccessForm from "./member-access-form";
import ChannelMembersList from "./channel-members-list";

export default function ChannelMembersCard({
  members,
  email,
  role,
  error,
  submitting,
  onEmailChange,
  onRoleChange,
  onAddSubmit,
  onEditMember,
}: {
  members: ChannelMember[];
  email: string;
  role: ChannelMemberRole;
  error: string;
  submitting: boolean;
  onEmailChange: (value: string) => void;
  onRoleChange: (value: ChannelMemberRole) => void;
  onAddSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onEditMember: (member: ChannelMember) => void;
}) {
  const t = useTranslations("ChannelSettingsPage");

  return (
    <Card variant="default" padding="lg">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
          <Shield className="size-5" />
        </div>
        <div className="min-w-0">
          <Heading as="h2" className="text-lg">{t("membersTitle")}</Heading>
          <p className="text-sm text-deep/50">{t("membersSubtitle")}</p>
        </div>
      </div>

      <MemberAccessForm
        mode="add"
        email={email}
        role={role}
        error={error}
        submitting={submitting}
        onEmailChange={onEmailChange}
        onRoleChange={onRoleChange}
        onSubmit={onAddSubmit}
        submitLabel={t("addMember")}
        submittingLabel={t("adding")}
      />

      <ChannelMembersList members={members} onEditMember={onEditMember} />
    </Card>
  );
}
