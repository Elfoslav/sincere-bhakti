"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Heading } from "@/components/ui/heading";
import {
  CHANNEL_MEMBER_ACTION_ADD,
  CHANNEL_MEMBER_ACTION_EDIT,
  CHANNEL_ROLE_EDITOR,
  type ChannelMemberAction,
  type ChannelMemberRole,
} from "@/lib/channel-roles";
import type { ChannelMember, ChannelSettings } from "@/types/channel";
import ChannelMembersCard from "./channel-members-card";
import EditMemberDialog from "./edit-member-dialog";
import { channelMemberErrorMessage } from "./member-settings-utils";

export default function ChannelSettingsClient({
  initialSettings,
}: {
  initialSettings: ChannelSettings;
}) {
  const t = useTranslations("ChannelSettingsPage");
  const channelsT = useTranslations("ChannelsPage");
  const [members, setMembers] = useState<ChannelMember[]>(initialSettings.members);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ChannelMemberRole>(CHANNEL_ROLE_EDITOR);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [editingMember, setEditingMember] = useState<ChannelMember | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<ChannelMemberRole>(CHANNEL_ROLE_EDITOR);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState("");

  async function submitMember({
    action,
    memberEmail,
    memberRole,
    setFieldError,
  }: {
    action: ChannelMemberAction;
    memberEmail: string;
    memberRole: ChannelMemberRole;
    setFieldError: (message: string) => void;
  }) {
    const trimmedEmail = memberEmail.trim();
    if (!trimmedEmail) return false;

    const response = await fetch(`/api/channels/${initialSettings.channel.slug}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, email: trimmedEmail, role: memberRole }),
    });
    const data = await response.json();

    if (!response.ok) {
      const message = channelMemberErrorMessage(data.error, t);
      setFieldError(message);
      toast.error(message);
      return false;
    }

    setMembers((current) => {
      const withoutExisting = current.filter((member) => member.id !== data.member.id);
      return [...withoutExisting, data.member].sort((a, b) => a.email.localeCompare(b.email));
    });
    toast.success(action === CHANNEL_MEMBER_ACTION_ADD ? t("memberAdded") : t("memberUpdated"));
    return true;
  }

  async function handleAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError("");
    try {
      const saved = await submitMember({
        action: CHANNEL_MEMBER_ACTION_ADD,
        memberEmail: email,
        memberRole: role,
        setFieldError: setError,
      });
      if (saved) setEmail("");
    } catch {
      setError(t("saveError"));
      toast.error(t("saveError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEditSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingMember) return;

    setEditSubmitting(true);
    setEditError("");
    try {
      const saved = await submitMember({
        action: CHANNEL_MEMBER_ACTION_EDIT,
        memberEmail: editEmail,
        memberRole: editRole,
        setFieldError: setEditError,
      });
      if (saved) closeEditMember();
    } catch {
      setEditError(t("saveError"));
      toast.error(t("saveError"));
    } finally {
      setEditSubmitting(false);
    }
  }

  function openEditMember(member: ChannelMember) {
    setEditingMember(member);
    setEditEmail(member.email);
    setEditRole(member.role);
    setEditError("");
  }

  function closeEditMember() {
    setEditingMember(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      <Breadcrumb
        items={[
          { label: channelsT("title"), href: "/channels" },
          { label: initialSettings.channel.name, href: `/channels/${initialSettings.channel.slug}` },
          { label: t("title") },
        ]}
        className="mb-4"
      />
      <div className="mb-6">
        <Heading as="h1">{t("title")}</Heading>
        <p className="mt-1 text-sm text-deep/50">{initialSettings.channel.name}</p>
      </div>

      <ChannelMembersCard
        members={members}
        email={email}
        role={role}
        error={error}
        submitting={submitting}
        onEmailChange={(value) => {
          setEmail(value);
          setError("");
        }}
        onRoleChange={setRole}
        onAddSubmit={handleAddSubmit}
        onEditMember={openEditMember}
      />

      <EditMemberDialog
        member={editingMember}
        email={editEmail}
        role={editRole}
        error={editError}
        submitting={editSubmitting}
        onEmailChange={(value) => {
          setEditEmail(value);
          setEditError("");
        }}
        onRoleChange={(value) => {
          setEditRole(value);
          setEditError("");
        }}
        onSubmit={handleEditSubmit}
        onClose={closeEditMember}
      />
    </div>
  );
}
