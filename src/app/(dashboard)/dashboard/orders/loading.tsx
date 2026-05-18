import { Skeleton } from "@/components/ui/skeleton";

export default function OrdersLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-36 rounded" />
          <Skeleton className="h-4 w-52 rounded" />
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-lg" />
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
        {/* Table header */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-border">
          {[80, 120, 80, 70, 80, 60].map((w, i) => (
            <Skeleton key={i} className={`h-3 w-${w} rounded`} style={{ width: w }} />
          ))}
        </div>
        {/* Rows */}
        <div className="divide-y divide-border/60">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton className="h-4 rounded" style={{ width: 80 }} />
              <div className="flex flex-col gap-1.5 flex-1">
                <Skeleton className="h-3.5 rounded" style={{ width: 130 }} />
                <Skeleton className="h-3 rounded" style={{ width: 100 }} />
              </div>
              <Skeleton className="h-4 rounded" style={{ width: 80 }} />
              <Skeleton className="h-3 rounded" style={{ width: 70 }} />
              <Skeleton className="h-5 rounded-full" style={{ width: 72 }} />
              <Skeleton className="h-3 rounded hidden sm:block" style={{ width: 60 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
