"use client";

import ErrorState from "@/components/ErrorState";

export default function AlbumDetailError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorState {...props} />;
}
