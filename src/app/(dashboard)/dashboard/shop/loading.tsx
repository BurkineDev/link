import { Skeleton } from "@/components/ui/skeleton";

export default function ShopLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-40 rounded" />
        <Skeleton className="h-4 w-60 rounded" />
      </div>

      {/* Shop preview card */}
      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
        <Skeleton className="h-24 w-full rounded-none" />
        <div className="flex items-end gap-4 px-5 pb-4 -mt-8">
          <Skeleton className="size-16 rounded-2xl ring-4 ring-card shrink-0" />
          <div className="flex flex-col gap-1.5 pb-1">
            <Skeleton className="h-5 w-36 rounded" />
            <Skeleton className="h-3.5 w-28 rounded" />
          </div>
        </div>
      </div>

      {/* Share section */}
      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-3 w-56 rounded mt-1.5" />
        </div>
        <div className="flex flex-col gap-4 p-5">
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1 rounded-xl" />
            <Skeleton className="h-10 w-24 rounded-xl" />
          </div>
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 flex-1 rounded-xl" />
            ))}
          </div>
        </div>
      </div>

      {/* Settings form */}
      <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border">
          <Skeleton className="h-4 w-36 rounded" />
        </div>
        <div className="flex flex-col gap-4 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          ))}
          <Skeleton className="h-10 w-28 rounded-xl mt-1" />
        </div>
      </div>
    </div>
  );
}
