"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { NextIntlClientProvider } from "next-intl";
import ErrorState from "@/components/ErrorState";
import messages from "../../messages/en.json";
import "./globals.css";

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
      <body className="min-h-screen flex flex-col">
        {/* This boundary replaces the root layout, including its providers. */}
        <NextIntlClientProvider locale="en" messages={{ ErrorPages: messages.ErrorPages }}>
          <ErrorState error={error} reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
