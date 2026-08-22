import { Skeleton } from "@/components/ui/skeleton";

/**
 * Page Builder : éditeur à gauche, aperçu à droite. La silhouette reprend
 * cette répartition pour que rien ne saute au moment où le contenu arrive.
 */
export default function MaPageLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-40 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
        <Skeleton className="h-10 w-32 rounded-xl" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm"
            >
              <div className="flex flex-col gap-1">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="size-4 rounded" />
              </div>
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-3 w-44 rounded" />
              </div>
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="size-8 rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>

        <div className="hidden lg:block">
          <Skeleton className="mb-2 h-3 w-16 rounded" />
          <Skeleton className="h-[520px] w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
