"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
          <div className="text-center px-4">
            <div className="text-6xl mb-4">🪷</div>
            <h1 className="text-4xl font-bold text-[#1a1a2e] mb-2">
              Something went wrong
            </h1>
            <p className="text-lg text-[#1a1a2e]/60 mb-6 max-w-md mx-auto">
              An unexpected error occurred. Please try again or come back later.
            </p>
            <button
              onClick={reset}
              className="inline-block px-6 py-3 bg-[#d4a843] text-white rounded-lg font-medium hover:bg-[#e8c36a] transition-colors"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
