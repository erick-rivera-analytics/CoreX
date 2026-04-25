"use client";

import { useMemo } from "react";
import { Check, X } from "lucide-react";
import useSWR from "swr";

import { fetchJson } from "@/lib/fetch-json";
import { Button } from "@/shared/ui/button";
import { CYCLE_STATUS_LABELS, getLabel } from "@/shared/lib/labels";
import { cn } from "@/lib/utils";

export type CycleOption = {
  cycleKey: string;
  isCurrent: boolean;
  isValid: boolean;
  variety: string | null;
  spType: string | null;
  spDate: string | null;
  harvestStartDate: string | null;
};

type BlockCyclesResponse = {
  cycles?: Array<Partial<CycleOption>>;
};

type Props = {
  bloquePad: string;
  contextLabel?: string;
  onSelect: (cycleKey: string) => void;
  onClose: () => void;
};

function getStatusLabel(cycle: CycleOption): { label: string; cls: string } {
  if (cycle.isCurrent && cycle.isValid) {
    return { label: getLabel(CYCLE_STATUS_LABELS, "active"), cls: "bg-chart-success text-chart-success-bold" };
  }
  if (!cycle.isCurrent && cycle.isValid) {
    return { label: getLabel(CYCLE_STATUS_LABELS, "closed"), cls: "bg-chart-neutral text-muted-foreground" };
  }
  return { label: getLabel(CYCLE_STATUS_LABELS, "planned"), cls: "bg-chart-info text-chart-info-bold" };
}

function cycleLabel(key: string) {
  return key;
}

const cyclesFetcher = (url: string) =>
  fetchJson<BlockCyclesResponse>(url, "No se pudo cargar ciclos");

function normalizeCycles(data?: BlockCyclesResponse): CycleOption[] {
  const cycles = (data?.cycles ?? []).map((cycle) => ({
    cycleKey: String(cycle.cycleKey ?? ""),
    isCurrent: Boolean(cycle.isCurrent),
    isValid: Boolean(cycle.isValid),
    variety: cycle.variety ?? null,
    spType: cycle.spType ?? null,
    spDate: cycle.spDate ?? null,
    harvestStartDate: cycle.harvestStartDate ?? null,
  }));

  cycles.sort((left, right) => {
    if (left.isCurrent !== right.isCurrent) return left.isCurrent ? -1 : 1;
    if (left.isValid !== right.isValid) return left.isValid ? -1 : 1;
    return left.cycleKey.localeCompare(right.cycleKey, "es-EC");
  });

  return cycles;
}

export function CampoCycleSelectorModal({
  bloquePad,
  contextLabel,
  onSelect,
  onClose,
}: Props) {
  const { data, error, isLoading } = useSWR(
    `/api/fenograma/block/${encodeURIComponent(bloquePad)}`,
    cyclesFetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30_000,
    },
  );
  const cycles = useMemo(() => normalizeCycles(data), [data]);

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cycle-sel-title"
    >
      <div
        className="absolute inset-0 animate-in fade-in bg-black/40 backdrop-blur-sm duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-border/70 bg-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200 dark:bg-card sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/30 px-4 py-3">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {contextLabel ?? `Bloque ${bloquePad}`}
            </p>
            <h2 id="cycle-sel-title" className="text-sm font-semibold text-foreground">
              Selecciona un ciclo
            </h2>
          </div>
          <Button variant="ghost" size="icon" className="size-7 rounded-full" onClick={onClose} aria-label="Cerrar">
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        <div className="max-h-[min(55dvh,620px)] overflow-y-auto divide-y divide-border/40">
          {isLoading ? (
            <div className="flex flex-col divide-y divide-border/30">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="ml-auto h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : null}

          {!isLoading && error ? (
            <p className="px-4 py-6 text-center text-sm text-destructive">{error.message}</p>
          ) : null}

          {!isLoading && !error && cycles.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted-foreground">
              Sin ciclos para este bloque.
            </p>
          ) : null}

          {!isLoading && !error && cycles.map((cycle, index) => {
            const status = getStatusLabel(cycle);
            const isFirst = index === 0 && cycle.isCurrent && cycle.isValid;

            return (
              <button
                key={cycle.cycleKey}
                onClick={() => onSelect(cycle.cycleKey)}
                className={cn(
                  "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  isFirst && "bg-chart-success/30 dark:bg-chart-success/20",
                )}
              >
                <span
                  className={cn(
                    "mt-px size-2 shrink-0 rounded-full",
                    cycle.isCurrent && cycle.isValid
                      ? "bg-chart-success-bold"
                      : !cycle.isCurrent && cycle.isValid
                        ? "bg-muted-foreground/40"
                        : "bg-chart-info-bold",
                  )}
                />

                <span
                  className={cn(
                    "flex-1 truncate font-mono text-[12.5px] leading-snug",
                    cycle.isCurrent && cycle.isValid
                      ? "text-slate-900 dark:text-white"
                      : !cycle.isCurrent && cycle.isValid
                        ? "text-slate-700 dark:text-white"
                        : "text-slate-400 dark:text-white",
                  )}
                >
                  {cycleLabel(cycle.cycleKey)}
                </span>

                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    status.cls,
                  )}
                >
                  {status.label}
                </span>

                <Check
                  className={cn(
                    "size-3.5 shrink-0 text-slate-500 transition-opacity",
                    cycle.isCurrent && cycle.isValid ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                  )}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>

        <div className="border-t border-border/60 bg-muted/20 px-4 py-2.5">
          <p className="text-[11px] text-muted-foreground">
            {cycles.length} ciclo{cycles.length !== 1 ? "s" : ""} · Bloque {bloquePad}
          </p>
        </div>
      </div>
    </div>
  );
}
