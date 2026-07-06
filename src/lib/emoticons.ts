const PAIRS: [string, string][] = [
  [":-)", "\uD83D\uDE0A"],
  [":)", "\uD83D\uDE0A"],
  [":-D", "\uD83D\uDE04"],
  [":D", "\uD83D\uDE04"],
  [":-P", "\uD83D\uDE1B"],
  [":P", "\uD83D\uDE1B"],
  [";-)", "\uD83D\uDE09"],
  [";)", "\uD83D\uDE09"],
  [":-(", "\uD83D\uDE14"],
  [":(", "\uD83D\uDE14"],
  [":'(", "\uD83D\uDE22"],
  [":-O", "\uD83D\uDE2E"],
  [":O", "\uD83D\uDE2E"],
  [":-!", "\uD83E\uDD2C"],
  ["B-)", "\uD83D\uDE0E"],
  ["B)", "\uD83D\uDE0E"],
  [":-/", "\uD83D\uDE15"],
  [":-@", "\uD83D\uDE21"],
  ["(y)", "\uD83D\uDC4D"],
  ["(n)", "\uD83D\uDC4E"],
  ["<3", "\u2764\uFE0F"],
];

const EMOTICON_MAP: [RegExp, string][] = PAIRS.map(
  ([emoticon, emoji]) => [new RegExp(escapeRegex(emoticon), "g"), emoji],
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function replaceEmoticons(text: string | null | undefined): string {
  if (!text) return "";
  let result = text;
  for (const [pattern, emoji] of EMOTICON_MAP) {
    result = result.replace(pattern, emoji);
  }
  return result;
}
