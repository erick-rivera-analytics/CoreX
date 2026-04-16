"use client";

import { cn } from "@/lib/utils";

export type ChartTooltipRow = {
  label: string;
  value: string;
};

export type ChartTooltipProps = {
  title?: string;
  rows: ChartTooltipRow[];
  className?: string;
};

export function ChartTooltip({ title, rows, className }: ChartTooltipProps) {
  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-[16px] border border-border bg-card px-3.5 py-3 shadow-[var(--shadow-tooltip)]",
        className,
      )}
    >
      {title ? (
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {title}
        </p>
      ) : null}
      <div className="space-y-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4 text-xs leading-relaxed">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium text-foreground tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Recharts-compatible `content` renderer.
 * Use as: `<Tooltip content={<RechartsTooltipAdapter mapPayload={...} />} />`
 */
export type RechartsTooltipAdapterProps = {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; payload?: Record<string, unknown> }>;
  label?: string | number;
  title?: (label: string | number, payload: RechartsTooltipAdapterProps["payload"]) => string;
  mapPayload: (
    payload: NonNullable<RechartsTooltipAdapterProps["payload"]>,
    label: string | number | undefined,
  ) => ChartTooltipRow[];
};

export function RechartsTooltipAdapter({
  active,
  payload,
  label,
  title,
  mapPayload,
}: RechartsTooltipAdapterProps) {
  if (!active || !payload?.length) return null;

  return (
    <ChartTooltip
      title={title && label !== undefined ? title(label, payload) : undefined}
      rows={mapPayload(payload, label)}
    />
  );
}
