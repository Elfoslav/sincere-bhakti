"use client";

import { useState } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";

function Hamburger({ open }: { open: boolean }) {
	return (
		<div className="flex flex-col gap-1.5 cursor-pointer">
			<span
				className={`block h-0.5 w-6 rounded bg-white transition-all duration-300 ${
					open ? "translate-y-2 rotate-45" : ""
				}`}
			/>
			<span
				className={`block h-0.5 rounded bg-white transition-all duration-300 ${
					open ? "w-0 opacity-0" : "w-4"
				}`}
			/>
			<span
				className={`block h-0.5 w-6 rounded bg-white transition-all duration-300 ${
					open ? "-translate-y-2 -rotate-45" : ""
				}`}
			/>
		</div>
	);
}

export default function Navbar() {
	const { data: session } = useSession();
	const [open, setOpen] = useState(false);
	const t = useTranslations("Navbar");

	function close() {
		setOpen(false);
	}

	return (
		<nav className="bg-deep text-white shadow-lg">
			<div className="max-w-6xl mx-auto px-4">
				<div className="flex items-center justify-between h-16">
					<div className="flex items-center gap-6">
						<Link href="/" className="flex items-center gap-2" onClick={close}>
							<Image
								src="/images/sincere-bhakti-logo-light.png"
								alt={t("logoAlt")}
								title={t("logoAlt")}
								width={77}
								height={52}
								className="shrink-0"
								style={{ width: 77, height: 52 }}
							/>
						</Link>

						<div className="hidden md:flex items-center gap-4">
							<Link href="/posts" className="hover:text-gold-light transition-colors">
								{t("posts")}
							</Link>
							{session && (
								<Link
									href={`/profile/${session.user.id}`}
									className="hover:text-gold-light transition-colors"
								>
									{t("profile")}
								</Link>
							)}
						</div>
					</div>

					<div className="flex items-center gap-1">
						<div className="md:hidden">
							<LanguageSwitcher />
						</div>
						<button
							className="md:hidden p-2"
							onClick={() => setOpen(!open)}
							aria-label={t("toggleMenu")}
						>
							<Hamburger open={open} />
						</button>

						<div className="hidden md:flex items-center gap-4">
							<LanguageSwitcher />
							{session ? (
								<Button onClick={() => signOut()} variant="default">
									{t("logout")}
								</Button>
							) : (
								<Button href="/login" variant="default" size="default">
									{t("getIn")}
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>

			<div
				className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
					open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
				}`}
			>
				<div className="flex flex-col gap-1 px-4 pb-4 pt-1 border-t border-white/10">
					<MobileLink href="/posts" onClick={close}>
						{t("posts")}
					</MobileLink>
					{session && (
						<MobileLink href={`/profile/${session.user.id}`} onClick={close}>
							{t("profile")}
						</MobileLink>
					)}
					<div className="flex items-center gap-2 pt-2">
						{session ? (
							<Button
								onClick={() => {
									signOut();
									close();
								}}
								variant="default"
								className="flex-1 text-center px-4"
							>
								{t("logout")}
							</Button>
						) : (
							<Button href="/login" variant="default" size="sm" className="flex-1 text-center px-4">
								{t("getIn")}
							</Button>
						)}
					</div>
				</div>
			</div>
		</nav>
	);
}

function MobileLink({
	href,
	onClick,
	children,
}: {
	href: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			onClick={onClick}
			className="text-white/80 hover:text-white hover:bg-white/5 px-4 py-2 rounded-md transition-colors"
		>
			{children}
		</Link>
	);
}
