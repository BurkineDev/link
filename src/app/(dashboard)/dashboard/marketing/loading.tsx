import { Skeleton } from "@/components/ui/skeleton";

export default function MarketingLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-32 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>

      {/* Onglets */}
      <div className="flex gap-2">
        {[88, 76, 96].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-full" style={{ width: w }} />
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-36 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
