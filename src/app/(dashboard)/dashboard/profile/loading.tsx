import { Skeleton } from "@/components/ui/skeleton";

export default function ProfilLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:py-10">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-36 rounded" />
        <Skeleton className="h-4 w-64 rounded" />
      </div>

      {/* Carte abonnement */}
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 rounded-xl" />
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-5 w-28 rounded" />
              <Skeleton className="h-3 w-56 rounded" />
            </div>
          </div>
          <Skeleton className="h-8 w-32 rounded-lg" />
        </div>
      </div>

      {/* Informations personnelles */}
      <div className="rounded-xl border border-border/70 bg-card p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <Skeleton className="size-10 rounded-xl" />
          <Skeleton className="h-5 w-52 rounded" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-11 w-40 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
