import { Skeleton } from "@/components/ui/skeleton";

function StatsCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24 rounded" />
        <Skeleton className="size-9 rounded-xl" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-32 rounded" />
        <Skeleton className="h-3 w-40 rounded" />
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Header skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-36 rounded" />
        <Skeleton className="h-8 w-56 rounded" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Orders table skeleton */}
        <div className="lg:col-span-2 rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-36 rounded" />
              <Skeleton className="h-3 w-28 rounded" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg" />
          </div>
          <div className="divide-y divide-border/60">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3.5">
                <Skeleton className="h-4 w-20 rounded" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-32 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions skeleton */}
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
          <div className="flex flex-col gap-1.5 px-5 py-4 border-b border-border">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-40 rounded" />
          </div>
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
