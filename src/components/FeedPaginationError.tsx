"use client";

import FeedEmptyState from "@/components/FeedEmptyState";

export default function FeedPaginationError({ error, retry }: { error?: boolean; retry?: () => void }) {
  return error ? <FeedEmptyState compact error onRetry={retry} /> : null;
}
