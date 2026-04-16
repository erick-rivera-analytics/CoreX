"use client";

import { cn } from "@/lib/utils";
import { formatPercent } from "@/shared/lib/format";
import { Badge } from "@/shared/ui/badge";

export function MetricPill({
  label,
  value,
  onClick,
  hint,
}: {
  label: string;
  value: string;
  onClick?: () => void;
  hint?: string;
}) {
  const sharedClassName = cn(
    "block h-full w-full rounded-lg border border-border/50 bg-card px-3.5 py-3 text-left shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
    onClick && "cursor-pointer transition-all hover:border-slate-700/30 hover:shadow-md active:scale-[0.987]",
  );

  const content = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
        {label}
      </p>
      <p className="mt-1 break-words text-[15px] font-semibold leading-tight tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted-foreground/55">{hint}</p> : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={sharedClassName}
      >
        {content}
      </button>
    );
  }

  return <div className={sharedClassName}>{content}</div>;
}

export function DetailBadges({
  items,
}: {
  items: string[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item} variant="outline" className="rounded-full px-3 py-1">
          {item}
        </Badge>
      ))}
    </div>
  );
}

export function InfoField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/18 px-4 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
        {label}
      </p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

export function HoursPerformanceDonut({
  percentage,
}: {
  percentage: number | null;
}) {
  const hasPercentage = percentage !== null;
  const normalizedPercentage = Math.max(0, Math.min(percentage ?? 0, 100));
  const chartStyle = {
    background: `conic-gradient(rgb(13 148 136) 0 ${normalizedPercentage}%, rgb(226 232 240) ${normalizedPercentage}% 100%)`,
  } as const;

  return (
    <div className="rounded-2xl border border-border/60 bg-card px-4 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-4">
        <div
          className="relative h-28 w-28 shrink-0 rounded-full shadow-inner"
          style={chartStyle}
          aria-hidden="true"
        >
          <div className="absolute inset-[16px] flex items-center justify-center rounded-full border border-border/50 bg-card text-center text-xs font-semibold text-foreground tabular-nums">
            {hasPercentage ? formatPercent(percentage) : "Sin dato"}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/65">
            % Horas rendimiento
          </p>
          <p className="text-2xl font-semibold tabular-nums">
            {formatPercent(percentage)}
          </p>
          <p className="max-w-[18rem] text-xs text-muted-foreground">
            Horas presenciales con medida distinta de H. Normales sobre el total de horas presenciales.
          </p>
        </div>
      </div>
    </div>
  );
}
