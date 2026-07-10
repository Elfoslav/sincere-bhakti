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

function PostCardSkeleton() {
  return (
    <Card className="space-y-3">
      <div className="flex items-start gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="w-4 h-4" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </Card>
  )
}

export { Skeleton, PostCardSkeleton }
