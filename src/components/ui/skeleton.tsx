import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-deep/10", className)}
      {...props}
    />
  )
}

function PostCardSkeleton({ variant = "post" }: { variant?: "post" | "article" | "journal" }) {
  if (variant === "article") return (
    <Card variant="editorial" className="article-row">
      <Skeleton className="article-row-media w-full rounded-none" />
      <div className="article-row-copy space-y-4">
        <Skeleton className="h-8 w-5/6" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </Card>
  );
  return (
    // Editorial rows, like PostCard / BlogCard / AlbumCard, so loading and
    // loaded states share one silhouette.
    <Card variant="editorial" className={cn("w-full space-y-3 py-7", variant === "journal" && "journal-post")}>
      <div className="post-card-header flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="w-4 h-4" />
      </div>
      <div className="post-card-copy space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      <div className="post-card-media"><Skeleton className="h-40 w-full rounded-lg" /></div>
    </Card>
  )
}

function FeedLoadingSkeleton({ count = 3, variant = "post" }: { count?: number; variant?: "post" | "article" }) {
  return (
    <div className={cn(variant === "article" ? "article-feed-container" : "reading-container page-space", "flex flex-col")}>
      {Array.from({ length: count }, (_, i) => (
        <PostCardSkeleton key={i} variant={variant} />
      ))}
    </div>
  )
}

export { Skeleton, PostCardSkeleton, FeedLoadingSkeleton }
