"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
	const router = useRouter();
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const form = new FormData(e.currentTarget);
		const email = form.get("email") as string;
		const password = form.get("password") as string;

		const result = await signIn("credentials", {
			email,
			password,
			redirect: false,
		});

		if (result?.error) {
			setError("Invalid email or password");
			setLoading(false);
		} else {
			router.push("/posts");
			router.refresh();
		}
	}

	return (
		<div className="w-full max-w-md">
			<div className="bg-white rounded-lg shadow-xl p-8 border border-sand">
				<div className="text-center mb-6">
					<div className="text-4xl mb-2">🪷</div>
					<h1 className="text-2xl font-bold text-deep">Welcome Back</h1>
					<p className="text-deep/60 text-sm mt-1">Continue your bhakti journey</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<label className="block text-sm font-medium text-deep mb-1">Email</label>
						<Input
							name="email"
							type="email"
							required
							placeholder="your@email.com"
						/>
					</div>
					<div>
						<label className="block text-sm font-medium text-deep mb-1">Password</label>
						<Input
							name="password"
							type="password"
							required
							placeholder="••••••••"
						/>
					</div>

					{error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>}

					<Button type="submit" variant="default" className="w-full" disabled={loading}>
						{loading ? "Signing in..." : "Sign In"}
					</Button>
				</form>

				<p className="text-center text-sm text-deep/60 mt-4">
					Don&apos;t have an account?{" "}
					<Link href="/register" className="text-gold hover:underline font-medium">
						Register
					</Link>
				</p>
			</div>
		</div>
	);
}
