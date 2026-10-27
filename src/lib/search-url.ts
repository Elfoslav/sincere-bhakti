/** Carry a feed query through category navigation without dropping existing URL parts. */
export function withSearchQuery(path: string, query: string): string {
  const url = new URL(path, "https://internal.invalid");
  const trimmed = query.trim();
  if (trimmed) url.searchParams.set("q", trimmed);
  else url.searchParams.delete("q");
  return `${url.pathname}${url.search}${url.hash}`;
}
