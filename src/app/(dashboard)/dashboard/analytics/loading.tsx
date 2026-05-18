import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-40 rounded" />
        <Skeleton className="h-4 w-56 rounded" />
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <Skeleton className="h-3 w-24 rounded" />
              <Skeleton className="size-9 rounded-xl" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-7 w-28 rounded" />
              <Skeleton className="h-3 w-36 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <div className="p-5">
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-border">
              <Skeleton className="h-4 w-36 rounded" />
            </div>
            <div className="flex flex-col gap-3 p-5">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-3.5 w-32 rounded" />
                  <Skeleton className="h-3.5 w-16 rounded" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
