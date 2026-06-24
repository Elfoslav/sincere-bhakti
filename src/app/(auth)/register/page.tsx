"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    router.push("/login?registered=true");
  }

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-xl p-8 border border-sand">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🪷</div>
          <h1 className="text-2xl font-bold text-deep">
            Join the Saṅga
          </h1>
          <p className="text-deep/60 text-sm mt-1">
            Begin your devotional journey
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-deep mb-1">
              Name
            </label>
            <p className="text-xs text-deep/50 mb-1.5">
              Your initiated name if you have one
            </p>
            <input
              name="name"
              type="text"
              required
              className="w-full px-4 py-2 rounded-md border border-sand bg-warm/50 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-deep mb-1">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              className="w-full px-4 py-2 rounded-md border border-sand bg-warm/50 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-deep mb-1">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full px-4 py-2 rounded-md border border-sand bg-warm/50 focus:outline-none focus:ring-2 focus:ring-gold focus:border-transparent"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-saffron hover:bg-saffron-dark text-white font-semibold py-2.5 rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <p className="text-center text-sm text-deep/60 mt-4">
          Already have an account?{" "}
          <Link href="/login" className="text-gold hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
