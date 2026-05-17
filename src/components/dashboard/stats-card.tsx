import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number; // percentage, positive = up, negative = down, 0/undefined = neutral
  trendLabel?: string;
  className?: string;
  iconClassName?: string;
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  className,
  iconClassName,
}: StatsCardProps) {
  const hasTrend = trend !== undefined;
  const isPositive = hasTrend && trend > 0;
  const isNegative = hasTrend && trend < 0;

  const TrendIcon = isPositive
    ? TrendingUpIcon
    : isNegative
      ? TrendingDownIcon
      : MinusIcon;

  const trendColorClass = isPositive
    ? "text-green-600 dark:text-green-400"
    : isNegative
      ? "text-red-600 dark:text-red-400"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-card p-5 ring-1 ring-foreground/10",
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            iconClassName ?? "bg-primary/10 text-primary",
          )}
        >
          <Icon className="size-5" />
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {hasTrend && (
          <div className={cn("flex items-center gap-1 text-xs", trendColorClass)}>
            <TrendIcon className="size-3.5" />
            <span>
              {isPositive ? "+" : ""}
              {trend}%{trendLabel ? ` ${trendLabel}` : " ce mois"}
            </span>
          </div>
        )}
        {!hasTrend && trendLabel && (
          <p className="text-xs text-muted-foreground">{trendLabel}</p>
        )}
      </div>
    </div>
  );
}
