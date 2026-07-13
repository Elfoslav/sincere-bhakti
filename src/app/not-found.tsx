import Link from "next/link";
import { getRandomJoke } from "@/lib/not-found-jokes";

export default function NotFound() {
  const joke = getRandomJoke();

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-4">🤷</div>
        <h1 className="text-6xl font-bold text-deep mb-2">404</h1>
        <p className="text-lg text-deep/60 mb-2">{joke.headline}</p>
        <p className="text-sm text-deep/50 mb-8">{joke.punchline}</p>
        <Link
          href="/"
          className="inline-block px-8 py-3 bg-gold text-white rounded-lg font-medium hover:bg-gold-dark transition-colors"
        >
          ← Back to safe ground
        </Link>
      </div>
    </div>
  );
}
