"use client";

import { ChevronLeft } from "lucide-react";

import type { ProcessLane } from "@/modules/postcosecha/lib/balanzas-process-stages";
import { Button } from "@/shared/ui/button";
import { cn } from "@/lib/utils";

export function BalanzasProcessStageNav({
  stages: lanes,
  activeStageId: activeLaneId,
  collapsed,
  onStageClick: onLaneClick,
  onToggleCollapse,
}: {
  stages: ProcessLane[];
  activeStageId: string | null;
  collapsed: boolean;
  onStageClick: (stage: ProcessLane) => void;
  onToggleCollapse: () => void;
}) {
  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border/60 bg-card/88 transition-all duration-200",
        collapsed ? "w-12" : "w-44",
      )}
    >
      <div className="flex h-10 items-center border-b border-border/60 px-3">
        {!collapsed ? (
          <p className="flex-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Rutas
          </p>
        ) : null}
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto size-7 rounded-full"
          onClick={onToggleCollapse}
        >
          <ChevronLeft
            className={cn("size-3.5 transition-transform duration-200", collapsed && "rotate-180")}
          />
        </Button>
      </div>
      <nav className="show-scrollbar flex flex-col gap-0.5 overflow-y-auto p-1.5">
        {lanes.map((lane) => (
          <button
            key={lane.id}
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm transition-colors",
              activeLaneId === lane.id
                ? "bg-primary/8 font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
            onClick={() => onLaneClick(lane)}
            title={collapsed ? lane.label : undefined}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: lane.color }} />
            {!collapsed ? <span className="truncate text-xs">{lane.label}</span> : null}
          </button>
        ))}
      </nav>
    </aside>
  );
}
