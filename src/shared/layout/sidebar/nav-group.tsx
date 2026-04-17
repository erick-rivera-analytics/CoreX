"use client";

import type { NavGroup } from "@/config/sidebar-data";
import { NavItemRenderer } from "@/shared/layout/sidebar/nav-item";
import { cn } from "@/lib/utils";

type NavGroupProps = {
  group: NavGroup;
  pathname: string;
  collapsed: boolean;
  openSections: Set<string>;
  onToggle: (key: string) => void;
  showSeparator?: boolean;
};

export function NavGroupSection({
  group,
  pathname,
  collapsed,
  openSections,
  onToggle,
  showSeparator = false,
}: NavGroupProps) {
  return (
    <div className={cn(showSeparator && "mt-3 border-t border-border/40 pt-3") }>
      {!collapsed ? (
        <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/60">
          {group.title}
        </p>
      ) : null}
      <div className="space-y-0.5">
        {group.items.map((item) => (
          <NavItemRenderer
            key={item.label}
            item={item}
            pathname={pathname}
            depth={0}
            collapsed={collapsed}
            openSections={openSections}
            onToggle={onToggle}
            parentKey={group.title}
          />
        ))}
      </div>
    </div>
  );
}
