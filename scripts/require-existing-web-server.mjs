const url = process.argv[2];

if (!url) {
  console.error("Usage: node scripts/require-existing-web-server.mjs <url>");
  process.exit(1);
}

try {
  const response = await fetch(url, { method: "HEAD" });
  if (response.ok || response.status < 500) {
    process.exit(0);
  }
  console.error(`Existing web server at ${url} returned HTTP ${response.status}.`);
  process.exit(1);
} catch {
  console.error(`No existing web server is reachable at ${url}. Start Next.js there first, or run the non-:server test command.`);
  process.exit(1);
}
