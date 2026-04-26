"use client";

import { useCallback, useState } from "react";
import { usePathname } from "next/navigation";

import { sidebarGroups, getInitialOpenSections, filterSidebarGroupsByAccess } from "@/config/sidebar-data";
import { SidebarBrand } from "@/shared/layout/sidebar/sidebar-brand";
import { NavGroupSection } from "@/shared/layout/sidebar/nav-group";
import { SidebarFooter } from "@/shared/layout/sidebar/sidebar-footer";
import { useCurrentUserAccess } from "@/hooks/use-current-user-access";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
};

export function AppSidebar({ collapsed, onCollapsedChange }: AppSidebarProps) {
  const pathname = usePathname();
  const { data: access } = useCurrentUserAccess();
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => getInitialOpenSections(sidebarGroups, pathname),
  );
  const resolvedGroups = access
    ? filterSidebarGroupsByAccess(sidebarGroups, access.allowedResources, access.isSuperadmin)
    : null;

  const toggleSection = useCallback((nodeKey: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }, []);

  return (
    <div className={cn("flex h-full min-h-0 flex-col overflow-hidden", collapsed ? "px-2 py-5" : "px-3 py-5") }>
      <div className="shrink-0">
        <SidebarBrand collapsed={collapsed} onCollapsedChange={onCollapsedChange} />
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 pt-3">
        {resolvedGroups === null ? (
          <div className={cn("space-y-4 py-2", collapsed ? "px-0" : "px-1") }>
            {[
              { id: "skel-1", count: 5 },
              { id: "skel-2", count: 3 },
              { id: "skel-3", count: 4 },
              { id: "skel-4", count: 2 },
            ].map((row) => (
              <div key={row.id} className="space-y-1.5">
                {!collapsed ? <div className="mb-2 h-2.5 w-16 animate-pulse rounded bg-muted/70" /> : null}
                {Array.from({ length: row.count }).map((_, j) => (
                  <div key={`${row.id}-row-${j}`} className={cn("animate-pulse rounded-xl bg-muted/50", collapsed ? "mx-auto h-9 w-9" : "h-9 w-full")} />
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2 pb-6">
            {resolvedGroups.map((group, idx) => (
              <NavGroupSection
                key={group.title}
                group={group}
                pathname={pathname}
                collapsed={collapsed}
                openSections={openSections}
                onToggle={toggleSection}
                showSeparator={idx > 0}
              />
            ))}
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-border/40 pt-3">
        <SidebarFooter collapsed={collapsed} />
      </div>
    </div>
  );
}
