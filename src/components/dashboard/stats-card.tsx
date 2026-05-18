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
  iconGradient?: [string, string];
  accentColor?: string;
}

export function StatsCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  className,
  iconClassName,
  iconGradient,
  accentColor,
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
    ? "text-emerald-600"
    : isNegative
      ? "text-red-500"
      : "text-muted-foreground";

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-4 overflow-hidden rounded-2xl bg-card p-5 border border-border/70 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 cursor-default",
        className
      )}
    >
      {/* Accent glow */}
      {accentColor && (
        <div
          className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full blur-2xl opacity-[0.11] transition-opacity duration-300 group-hover:opacity-[0.18]"
          style={{ backgroundColor: accentColor }}
        />
      )}

      {/* Label + icon row */}
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/70">
          {label}
        </p>
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-xl shadow-sm",
            !iconGradient && (iconClassName ?? "bg-primary/10 text-primary")
          )}
          style={
            iconGradient
              ? {
                  background: `linear-gradient(135deg, ${iconGradient[0]}, ${iconGradient[1]})`,
                  boxShadow: `0 4px 14px ${iconGradient[1]}40`,
                }
              : undefined
          }
        >
          <Icon className={cn("size-[17px]", iconGradient ? "text-white" : "")} />
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
