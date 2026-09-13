import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: { frame: "size-[22px] text-[10px]", hash: "size-3" },
  sm: { frame: "size-10 text-lg", hash: "size-5" },
  md: { frame: "size-12 text-xl", hash: "size-6" },
  lg: { frame: "size-20 text-3xl", hash: "size-10" },
} as const;

export type ChannelAvatarSize = keyof typeof SIZES;

/**
 * Channel avatar with graceful fallbacks: the R2-hosted photo when present,
 * otherwise a gradient initial badge (or a Hash tile for list rows).
 * Centralizes the avatar markup (and the intentional `<img>` rationale) that
 * was copy-pasted across cards, lists, and headers.
 */
export default function ChannelAvatar({
  name,
  avatarUrl,
  size = "sm",
  fallback = "initial",
  className,
  ariaHidden,
}: {
  name?: string | null;
  avatarUrl?: string | null;
  size?: ChannelAvatarSize;
  fallback?: "initial" | "hash";
  className?: string;
  ariaHidden?: boolean;
}) {
  const sizes = SIZES[size];
  if (avatarUrl) {
    // Using <img> for R2-hosted avatars: small fixed-size thumbnails with
    // explicit dimensions don't benefit from next/image optimization, and
    // avoiding the image loader simplifies R2 CORS configuration.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" className={cn("rounded-full object-cover shrink-0", sizes.frame, className)} />;
  }
  if (fallback === "hash") {
    return (
      <div className={cn("rounded-full bg-gold/20 flex items-center justify-center shrink-0", sizes.frame, className)}>
        <Hash className={cn(sizes.hash, "text-gold")} />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "rounded-full bg-gradient-to-br from-gold-light to-saffron-dark flex items-center justify-center text-white font-bold shrink-0",
        sizes.frame,
        className,
      )}
      aria-hidden={ariaHidden}
    >
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}
