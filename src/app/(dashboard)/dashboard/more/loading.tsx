import { Skeleton } from "@/components/ui/skeleton";

export default function PlusLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-20 rounded" />
        <Skeleton className="h-4 w-52 rounded" />
      </div>

      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
          >
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-32 rounded" />
              <Skeleton className="h-3 w-48 rounded" />
            </div>
            <Skeleton className="size-4 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
