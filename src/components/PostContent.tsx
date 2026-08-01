import { tokenizeUrls } from "@/lib/autolink";
import { isSafeHttpUrl } from "@/lib/validation";

/**
 * Renders post content as React nodes with autolinked URLs. Never uses
 * dangerouslySetInnerHTML — URLs are matched by tokenizeUrls (http(s) only)
 * and re-validated before rendering, so `javascript:`/`data:` cannot appear.
 */
export default function PostContent({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const tokens = tokenizeUrls(text);

  return (
    <p className={className}>
      {tokens.map((token, i) =>
        token.type === "text" ? (
          token.value
        ) : isSafeHttpUrl(token.url) ? (
          <a
            key={i}
            href={token.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-gold hover:underline break-words"
          >
            {token.url}
          </a>
        ) : (
          token.url
        ),
      )}
    </p>
  );
}
