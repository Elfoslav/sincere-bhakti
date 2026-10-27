/** Only relative, same-origin app paths are accepted after authentication. */
export function getSafeReturnPath(value: string | null): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/posts";
  try {
    const base = "https://return-path.invalid";
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/posts";
  } catch {
    return "/posts";
  }
}
