import { Skeleton } from "@/components/ui/skeleton";

export default function ChannelSettingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-8">
      <Skeleton className="mb-6 h-4 w-32" />
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-36" />
      </div>
      <div className="rounded-lg border border-sand bg-white p-6">
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem_auto]">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full sm:w-36" />
        </div>
        <div className="mt-6 space-y-2">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}
