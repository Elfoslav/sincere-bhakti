"use client";

import { useTranslations } from "next-intl";
import { Users } from "lucide-react";
import type { ChannelMember } from "@/types/channel";
import { channelMemberRoleLabel } from "./member-settings-utils";

export default function ChannelMembersList({
  members,
  onEditMember,
}: {
  members: ChannelMember[];
  onEditMember: (member: ChannelMember) => void;
}) {
  const t = useTranslations("ChannelSettingsPage");

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-deep">
        <Users className="size-4 text-gold" />
        {t("currentMembers")}
      </div>
      {members.length === 0 ? (
        <p className="rounded-lg bg-deep/5 px-3 py-2 text-sm text-deep/50">{t("noMembers")}</p>
      ) : (
        <div className="divide-y divide-sand overflow-hidden rounded-lg border border-sand">
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() => onEditMember(member)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-deep/5 focus-visible:bg-deep/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-deep">{member.name}</p>
                <p className="truncate text-xs text-deep/50">{member.email}</p>
              </div>
              <span className="shrink-0 rounded-full bg-deep/5 px-2.5 py-1 text-xs font-medium text-deep/60">
                {channelMemberRoleLabel(member.role, t)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
