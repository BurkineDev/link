import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react";

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
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
    ? "text-[var(--success)]"
    : isNegative
      ? "text-destructive"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "relative flex flex-col gap-4 rounded-2xl bg-card p-5 border border-border shadow-sm transition-shadow duration-200 hover:shadow-md cursor-default",
        className,
      )}
    >
      {/* Label + icon row */}
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl",
            iconClassName ?? "bg-primary text-primary-foreground",
          )}
        >
          <Icon className="size-[17px]" />
        </span>
      </div>

      {/* Value + trend */}
      <div className="flex flex-col gap-1.5">
        <p className="text-2xl font-black tracking-tight tabular-nums leading-none">
          {value}
        </p>
        {hasTrend && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-semibold",
              trendColorClass
            )}
          >
            <TrendIcon className="size-3" />
            <span>
              {isPositive ? "+" : ""}
              {trend}%{trendLabel ? ` ${trendLabel}` : " ce mois"}
            </span>
          </div>
        )}
        {!hasTrend && trendLabel && (
          <p className="text-xs text-muted-foreground leading-snug">{trendLabel}</p>
        )}
      </div>
    </div>
  );
}
