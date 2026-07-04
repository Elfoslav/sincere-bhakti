import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6">😕</div>
        <h1 className="text-6xl font-bold text-deep mb-2">404</h1>
        <p className="text-deep/60 mb-8">
          This page could not be found.
        </p>
        <Link
          href="/"
          className="inline-block px-8 py-3 bg-gold text-white rounded-lg font-medium hover:bg-gold-dark transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
