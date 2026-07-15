"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Heading } from "@/components/ui/heading";
import { Pencil, Hash, FileText, Plus, Settings } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { NAME_MAX_LENGTH, MAX_RENAME_COUNT } from "@/lib/validation";
import type { UserProfile } from "@/types/user";

export default function ProfileContent({ authorId }: { authorId: string }) {
  const { data: session } = useSession();
  const locale = useLocale();
  const t = useTranslations("ProfilePage");
  const common = useTranslations("Common");
  const [profile, setProfile] = useState<UserProfile | null>(null);
	const [profileLoading, setProfileLoading] = useState(true);
	const [open, setOpen] = useState(false);
	const [newName, setNewName] = useState("");
	const [saving, setSaving] = useState(false);
	const [nameError, setNameError] = useState("");
	const [channelDialogOpen, setChannelDialogOpen] = useState(false);
	const [channelName, setChannelName] = useState("");
	const [channelSaving, setChannelSaving] = useState(false);
	const [channelError, setChannelError] = useState("");

	const isOwnProfile = session?.user?.id === authorId;

	useEffect(() => {
		if (!authorId) return;
		let mounted = true;
		fetch(`/api/users/${authorId}`)
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (mounted && data) {
					setProfile(data);
					setNewName(data.name);
				}
			})
			.finally(() => {
				if (mounted) setProfileLoading(false);
			});
		return () => {
			mounted = false;
		};
	}, [authorId]);

	async function handleSave() {
		if (!newName.trim() || !profile) return;
		setSaving(true);
		setNameError("");
		try {
			const res = await fetch(`/api/users/${profile.id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: newName.trim() }),
			});
			if (res.ok) {
				const updated = await res.json();
				setProfile((prev) =>
					prev
						? {
								...prev,
								name: updated.name,
								renameCount: updated.renameCount,
								channels: prev.channels.map((ch) =>
									ch.isPersonal ? { ...ch, name: updated.name } : ch,
								),
							}
						: prev,
				);
				setOpen(false);
			} else {
				const data = await res.json().catch(() => ({}));
				if (data.error === "name_taken") {
					setNameError(t("nameTaken"));
				} else if (data.error === "rename_limit_reached") {
					setNameError(t("saveError"));
				} else if (data.error === "validation_error:name:too_big") {
					setNameError(t("nameTooLong", { max: NAME_MAX_LENGTH }));
				} else {
					setNameError(t("saveError"));
				}
			}
		} catch {
			setNameError(t("saveError"));
		} finally {
			setSaving(false);
		}
	}

	async function handleCreateChannel() {
		if (!channelName.trim() || !profile) return;
		setChannelSaving(true);
		setChannelError("");
		try {
			const res = await fetch("/api/channels", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: channelName.trim() }),
			});
			if (res.ok) {
				const channel = await res.json();
				setProfile((prev) => (prev ? { ...prev, channels: [...prev.channels, channel] } : prev));
				setChannelDialogOpen(false);
				setChannelName("");
			} else {
				const data = await res.json().catch(() => ({}));
				if (data.error === "name_taken") {
					setChannelError(t("nameTaken"));
				} else if (data.error === "validation_error:name:too_big") {
					setChannelError(t("nameTooLong", { max: NAME_MAX_LENGTH }));
				} else {
					setChannelError(t("saveError"));
				}
			}
		} catch {
			setChannelError(t("saveError"));
		} finally {
			setChannelSaving(false);
		}
	}

	if (profileLoading) {
		return (
			<div className="w-full max-w-3xl mx-auto px-4 py-8 flex flex-col flex-1">
				<div className="flex-1 space-y-4">
					<Card variant="default" padding="lg" className="w-full text-center space-y-4">
						<Skeleton className="w-20 h-20 rounded-full mx-auto" />
						<Skeleton className="h-6 w-40 mx-auto" />
						<Skeleton className="h-4 w-24 mx-auto" />
					</Card>
					<Skeleton className="h-12 w-full" />
					<Skeleton className="h-12 w-full" />
				</div>
			</div>
		);
	}

	if (!profile) {
		return (
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center max-w-md">
					<div className="text-6xl mb-4">🔍🕊️</div>
					<h1 className="text-2xl font-bold text-deep mb-2">{t("noProfileTitle")}</h1>
					<p className="text-deep/60 mb-6">{t("noProfile")}</p>
					<Link
						href="/posts"
						className="inline-block px-6 py-2.5 bg-gold hover:bg-gold-light active:bg-gold/80 text-white rounded-lg transition-colors font-medium"
					>
						{t("backToPosts")}
					</Link>
				</div>
			</div>
		);
	}

	const date = new Date(profile.createdAt).toLocaleDateString(locale === "en" ? "en-US" : locale, {
		year: "numeric",
		month: "long",
		day: "numeric",
	});

	return (
		<div className="w-full max-w-3xl mx-auto px-4 py-8 flex flex-col flex-1">
			<Card variant="default" padding="lg" className="relative mb-8 text-center">
				{isOwnProfile && (
					<Button
						href="/profile/settings"
						variant="ghost"
						size="icon-sm"
						className="absolute right-3 top-3 sm:right-4 sm:top-4 text-deep/40 hover:text-gold-light"
						title={t("settings")}
						aria-label={t("settings")}
					>
						<Settings className="w-[18px] h-[18px]" />
					</Button>
				)}
				<div className="w-20 h-20 rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4">
					{profile.name[0]?.toUpperCase() || "?"}
				</div>
				<div className="flex items-center justify-center gap-2">
					<h1 className="text-2xl font-bold text-deep">{profile.name}</h1>
					{isOwnProfile && (
						<>
							<Dialog open={open} onOpenChange={setOpen}>
							<DialogTrigger
								className="text-gold hover:text-gold-light transition-colors cursor-pointer"
								title={t("editName")}
								aria-label={t("editName")}
							>
								<Pencil className="w-[18px] h-[18px]" />
							</DialogTrigger>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>{t("editNameTitle")}</DialogTitle>
								</DialogHeader>
								<form
									onSubmit={(e) => {
										e.preventDefault();
										handleSave();
									}}
									className="space-y-4 pt-2"
								>
									<Input
										name="name"
										value={newName}
										onChange={(e) => {
											setNewName(e.target.value);
											setNameError("");
										}}
										placeholder={t("namePlaceholder")}
										autoComplete="name"
										autoFocus
										errorMessage={nameError || undefined}
										maxLength={NAME_MAX_LENGTH}
									/>
									<div className="flex items-center justify-between text-xs text-deep/50">
										<span>{common("renameCountInfo")}</span>
										<span>{common("renameCount", { count: profile.renameCount, max: MAX_RENAME_COUNT })}</span>
									</div>
									<div className="flex justify-end gap-2">
										<Button type="button" variant="outline" className="min-w-24" onClick={() => setOpen(false)}>
											{t("cancel")}
										</Button>
										<Button type="submit" className="min-w-24" disabled={saving || !newName.trim() || profile.renameCount >= MAX_RENAME_COUNT}>
											{saving ? t("saving") : t("save")}
										</Button>
									</div>
								</form>
							</DialogContent>
						</Dialog>
						</>
					)}
				</div>
				<p className="text-deep/50 text-sm mt-1">{t("joined", { date })}</p>
			</Card>

			<section>
				<div className="flex items-center justify-between mb-4">
					<Heading as="h2">{t("channels")}</Heading>
					{isOwnProfile && (
						<Dialog open={channelDialogOpen} onOpenChange={(open) => { setChannelDialogOpen(open); if (open) { setChannelName(""); setChannelError(""); } }}>
							<DialogTrigger render={<Button variant="outline" />}>
								<Plus className="w-4 h-4 mr-1" />
								{t("createChannel")}
							</DialogTrigger>
							<DialogContent className="sm:max-w-md">
								<DialogHeader>
									<DialogTitle>{t("createChannelTitle")}</DialogTitle>
								</DialogHeader>
								<form
									onSubmit={(e) => {
										e.preventDefault();
										handleCreateChannel();
									}}
									className="space-y-4 pt-2"
								>
									<Input
										name="channelName"
										value={channelName}
										onChange={(e) => {
											setChannelName(e.target.value);
											setChannelError("");
										}}
										placeholder={t("channelNamePlaceholder")}
										autoFocus
										errorMessage={channelError || undefined}
										maxLength={NAME_MAX_LENGTH}
									/>
									<div className="flex justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											className="min-w-24"
											onClick={() => {
												setChannelDialogOpen(false);
												setChannelName("");
												setChannelError("");
											}}
										>
											{t("cancel")}
										</Button>
										<Button type="submit" className="min-w-24" disabled={channelSaving || !channelName.trim()}>
											{channelSaving ? t("creating") : t("save")}
										</Button>
									</div>
								</form>
							</DialogContent>
						</Dialog>
					)}
				</div>
				{profile.channels.length === 0 ? (
					<Card variant="ghost-muted" className="text-center py-8">
						{t("noChannels")}
					</Card>
				) : (
					<div className="space-y-3">
						{profile.channels.map((ch) => (
							<Link key={ch.id} href={`/channels/${ch.slug}`} className="block">
								<Card variant="hover">
									<div className="flex items-center gap-3">
										{ch.avatarUrl ? (
											<img
												src={ch.avatarUrl}
												alt=""
												className="w-10 h-10 rounded-full object-cover"
											/>
										) : (
											<div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
												<Hash className="w-5 h-5 text-gold" />
											</div>
										)}
										<div className="flex-1 min-w-0">
											<p className="font-medium text-deep truncate">{ch.name}</p>
											<p className="text-xs text-deep/50 flex items-center gap-1 mt-0.5">
												<FileText className="w-3 h-3" />
												{t("postCount", { count: ch.postCount })}
											</p>
										</div>
										<span className="text-sm text-gold hover:text-gold-light shrink-0">
											{t("viewChannel")} →
										</span>
									</div>
								</Card>
							</Link>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
