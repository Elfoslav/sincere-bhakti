"use client";

import { useState } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { CircleUserRound, Hash, LogIn, LogOut, Newspaper } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import IdentitySwitcher from "@/components/IdentitySwitcher";

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
	const { status } = useSession();
	const [open, setOpen] = useState(false);
	const t = useTranslations("Navbar");

	function close() {
		setOpen(false);
	}

	return (
		<nav className="bg-deep text-white shadow-lg">
			<div className="max-w-6xl mx-auto px-4">
				<div className="relative flex h-16 items-center justify-between">
					<div className="flex items-center gap-6">
						<Link href="/" className="flex items-center gap-2" onClick={close}>
							<Image
								src="/images/sincere-bhakti-logo-light.png"
								alt={t("logoAlt")}
								title={t("logoAlt")}
								width={77}
								height={52}
								priority
								className="shrink-0"
								style={{ width: 77, height: 52 }}
							/>
						</Link>

						<div className="hidden md:flex items-center gap-4">
							<Link href="/posts" className="hover:text-gold-light transition-colors">
								{t("posts")}
							</Link>
							<Link href="/channels" className="hover:text-gold-light transition-colors">
								{t("channels")}
							</Link>
							{status === "authenticated" && (
								<Link
									href="/profile"
									className="hover:text-gold-light transition-colors"
								>
									{t("profile")}
								</Link>
							)}
						</div>
					</div>

					{status === "authenticated" && (
						<div className="pointer-events-none absolute inset-x-20 bottom-0 top-0 z-10 flex items-center justify-center md:hidden">
							<IdentitySwitcher mobileNav />
						</div>
					)}

					<div className="flex items-center gap-1">
						<Button
							type="button"
							variant="icon-light"
							size="icon-lg"
							className="md:hidden"
							onClick={() => setOpen(!open)}
							aria-label={t("toggleMenu")}
							aria-expanded={open}
							icon={<Hamburger open={open} />}
						/>

						<div className="hidden md:flex items-center gap-4">
							<LanguageSwitcher />
							{status === "authenticated" ? (
								<>
									<IdentitySwitcher />
									<Button onClick={() => signOut()} variant="default">
										{t("logout")}
									</Button>
								</>
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
				className={`md:hidden transition-all duration-300 ease-in-out ${
					open ? "max-h-[calc(100svh-4rem)] overflow-y-auto opacity-100" : "max-h-0 overflow-hidden opacity-0"
				}`}
			>
				<div className="flex flex-col gap-1 px-4 pb-4 pt-1 border-t border-white/10">
					<div className="px-4 py-2">
						<LanguageSwitcher fullWidth />
					</div>
					<MobileLink href="/posts" onClick={close} icon={<Newspaper className="size-4" />}>
						{t("posts")}
					</MobileLink>
					<MobileLink href="/channels" onClick={close} icon={<Hash className="size-4" />}>
						{t("channels")}
					</MobileLink>
					{status === "authenticated" && (
						<MobileLink href="/profile" onClick={close} icon={<CircleUserRound className="size-4" />}>
							{t("profile")}
						</MobileLink>
					)}
					<div className="flex items-center gap-2 pt-2">
						{status === "authenticated" ? (
							<Button
								onClick={() => {
									signOut();
									close();
								}}
								variant="default"
								className="flex-1 text-center px-4"
								icon={<LogOut className="size-4" />}
							>
								{t("logout")}
							</Button>
						) : (
							<Button
								href="/login"
								variant="default"
								size="sm"
								className="flex-1 text-center px-4"
								icon={<LogIn className="size-4" />}
							>
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
	icon,
	children,
}: {
	href: string;
	onClick: () => void;
	icon: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			onClick={onClick}
			className="flex items-center gap-2 rounded-md px-4 py-2 text-white/80 transition-colors hover:bg-white/5 hover:text-white"
		>
			<span aria-hidden="true" className="text-gold-light/85">
				{icon}
			</span>
			{children}
		</Link>
	);
}
