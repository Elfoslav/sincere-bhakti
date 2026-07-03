"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

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

	function close() {
		setOpen(false);
	}

	return (
		<nav className="bg-deep text-white shadow-lg">
			<div className="max-w-6xl mx-auto px-4">
				<div className="flex items-center justify-between h-16">
					<Link href="/" className="flex items-center gap-2" onClick={close}>
						<Image
							src="/images/sincere-bhakti-logo-light.png"
							alt="Sincere Bhakti"
							title="Sincere Bhakti"
							width={77}
							height={32}
							className="shrink-0"
							unoptimized
						/>

					</Link>

					<button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">
						<Hamburger open={open} />
					</button>

					<div className="hidden md:flex items-center gap-4">
						<Link href="/posts" className="hover:text-gold-light transition-colors">
							Posts
						</Link>
						{session ? (
							<>
								<Link
									href={`/profile/${session.user.id}`}
									className="hover:text-gold-light transition-colors"
								>
									Profile
								</Link>
								<Button onClick={() => signOut()} variant="default" size="sm">
									Logout
								</Button>
							</>
						) : (
							<>
								<Link href="/login" className="hover:text-gold-light transition-colors">
									Login
								</Link>
								<Button href="/register" variant="gold" size="default">
									Register
								</Button>
							</>
						)}
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
						Posts
					</MobileLink>
					{session ? (
						<>
							<MobileLink href={`/profile/${session.user.id}`} onClick={close}>
								Profile
							</MobileLink>
							<Button
								onClick={() => {
									signOut();
									close();
								}}
								variant="default"
								size="sm"
								className="mt-1 w-full text-left"
							>
								Logout
							</Button>
						</>
					) : (
						<>
							<MobileLink href="/login" onClick={close}>
								Login
							</MobileLink>
							<Button href="/register" variant="gold" size="sm" className="mt-1 w-full text-center">
								Register
							</Button>
						</>
					)}
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
