export function getSiteUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "http://localhost:3000")
  );
}

// Strips query/hash fragments for URL comparison
export function canonicalizeUrl(url: string): string {
  return url.split("?")[0].split("#")[0];
}
