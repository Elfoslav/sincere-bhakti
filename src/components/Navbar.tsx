"use client";

import { useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import { useSession, signOut } from "next-auth/react";
import { useTranslations } from "next-intl";
import { CircleUserRound, Hash, Images, LogIn, LogOut, Newspaper, BookOpen } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useHydrated } from "@/lib/hooks/useHydrated";
import { isAuthenticated } from "@/lib/session";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import IdentitySwitcher from "@/components/IdentitySwitcher";

function Hamburger({ open }: { open: boolean }) {
	return (
		<div className="flex flex-col gap-1.5 cursor-pointer">
			<span
				className={`block h-0.5 w-6 rounded bg-foreground transition-all duration-300 ${
					open ? "translate-y-2 rotate-45" : ""
				}`}
			/>
			<span
				className={`block h-0.5 rounded bg-foreground transition-all duration-300 ${
					open ? "w-0 opacity-0" : "w-4"
				}`}
			/>
			<span
				className={`block h-0.5 w-6 rounded bg-foreground transition-all duration-300 ${
					open ? "-translate-y-2 -rotate-45" : ""
				}`}
			/>
		</div>
	);
}

export default function Navbar() {
	const { status } = useSession();
	const pathname = usePathname();
	const hydrated = useHydrated();
	const [open, setOpen] = useState(false);
	const t = useTranslations("Navbar");

	function close() {
		setOpen(false);
	}

	return (
		<nav className="relative z-20 border-b border-border bg-background text-foreground">
			<div className="site-header-container">
				<div className="relative flex h-[var(--navbar-height)] items-center justify-between">
					<div className="flex items-center gap-8 lg:gap-12">
						<Link href="/" aria-label={t("logoAlt")} className="flex items-center gap-2" onClick={close}>
							<BrandLogo />
						</Link>

						<div className="hidden lg:flex items-center gap-8">
							<Link href="/posts" aria-current={pathname.startsWith("/posts") ? "page" : undefined} className="site-nav-link">
								{t("posts")}
							</Link>
							<Link href="/blog" aria-current={pathname.startsWith("/blog") ? "page" : undefined} className="site-nav-link">
								{t("blog")}
							</Link>
							<Link href="/gallery" aria-current={pathname.startsWith("/gallery") ? "page" : undefined} className="site-nav-link">
								{t("gallery")}
							</Link>
							<Link href="/channels" aria-current={pathname.startsWith("/channels") ? "page" : undefined} className="site-nav-link">
								{t("channels")}
							</Link>
							{isAuthenticated(status) && (
								<Link
									href="/profile"
									aria-current={pathname.startsWith("/profile") ? "page" : undefined}
									className="site-nav-link"
								>
									{t("profile")}
								</Link>
							)}
						</div>
					</div>

					{isAuthenticated(status) && (
						<div className="pointer-events-none absolute left-32 right-16 bottom-0 top-0 z-10 flex items-center justify-center lg:hidden">
							<IdentitySwitcher mobileNav />
						</div>
					)}

					<div className="flex items-center gap-1">
						<Button
							type="button"
							variant="icon"
							size="icon-lg"
							className="lg:hidden"
							onClick={() => setOpen(!open)}
							disabled={!hydrated}
							aria-label={t("toggleMenu")}
							aria-expanded={open}
							aria-controls="mobile-navigation"
							icon={<Hamburger open={open} />}
						/>

						<div className="hidden lg:flex items-center gap-6">
							<LanguageSwitcher />
							{isAuthenticated(status) ? (
								<>
									<IdentitySwitcher />
									<Button onClick={() => signOut()} variant="default">
										{t("logout")}
									</Button>
								</>
							) : (
								<Button href="/login" variant="ghost" size="default" className="site-login-link">
									{t("getIn")}
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>

			<div
				id="mobile-navigation"
				inert={!open}
				className={`lg:hidden transition-all duration-300 ease-in-out ${
					open ? "max-h-[calc(100svh-var(--navbar-height))] overflow-y-auto opacity-100" : "max-h-0 overflow-hidden opacity-0"
				}`}
			>
				<div className="flex flex-col gap-1 px-4 pb-4 pt-1 border-t border-border">
					<div className="px-4 py-2">
						<LanguageSwitcher fullWidth />
					</div>
					<MobileLink href="/posts" onClick={close} icon={<Newspaper className="size-4" />}>
						{t("posts")}
					</MobileLink>
					<MobileLink href="/blog" onClick={close} icon={<BookOpen className="size-4" />}>
						{t("blog")}
					</MobileLink>
					<MobileLink href="/gallery" onClick={close} icon={<Images className="size-4" />}>
						{t("gallery")}
					</MobileLink>
					<MobileLink href="/channels" onClick={close} icon={<Hash className="size-4" />}>
						{t("channels")}
					</MobileLink>
					{isAuthenticated(status) && (
						<MobileLink href="/profile" onClick={close} icon={<CircleUserRound className="size-4" />}>
							{t("profile")}
						</MobileLink>
					)}
					<div className="flex items-center gap-2 pt-2">
						{isAuthenticated(status) ? (
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
	const pathname = usePathname();
	return (
		<Link
			href={href}
			aria-current={pathname.startsWith(href) ? "page" : undefined}
			onClick={onClick}
			className="flex min-h-11 items-center gap-2 rounded-md px-4 py-2 text-foreground transition-colors hover:bg-secondary hover:text-primary aria-[current=page]:bg-secondary aria-[current=page]:text-primary"
		>
			<span aria-hidden="true" className="text-primary">
				{icon}
			</span>
			{children}
		</Link>
	);
}
