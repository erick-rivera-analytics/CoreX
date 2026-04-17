"use client";

import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Logo } from "@/shared/layout/logo";
import { starterName, starterSubtitle } from "@/config/dashboard";
import { cn } from "@/lib/utils";

type SidebarBrandProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export function SidebarBrand({ collapsed, onCollapsedChange }: SidebarBrandProps) {
  return (
    <div className={cn("mb-5 flex items-center border-b border-border/50 pb-4", collapsed ? "justify-center" : "justify-between gap-2") }>
      <Link
        href="/dashboard"
        className={cn("flex min-w-0 items-center gap-3 overflow-hidden", collapsed && "justify-center")}
        title={starterName}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[16px] bg-primary text-primary-foreground shadow-sm">
          <Logo size={16} />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium leading-tight">{starterName}</p>
            <p className="truncate text-[11px] text-muted-foreground">{starterSubtitle}</p>
          </div>
        ) : null}
      </Link>

      <button
        type="button"
        onClick={() => onCollapsedChange(!collapsed)}
        className="flex size-8 shrink-0 items-center justify-center rounded-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
        title={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
      >
        {collapsed ? <PanelLeftOpen className="size-4" aria-hidden="true" /> : <PanelLeftClose className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
