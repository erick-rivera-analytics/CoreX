"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  type NavItem,
  getNavItemKey,
  isPathActive,
  itemContainsActive,
} from "@/config/sidebar-data";
import { cn } from "@/lib/utils";

function NavLeaf({
  item,
  pathname,
  depth,
  collapsed,
}: {
  item: NavItem;
  pathname: string;
  depth: number;
  collapsed: boolean;
}) {
  const Icon = item.icon;
  const active = item.href ? isPathActive(pathname, item.href) : false;
  const indent = depth > 0 ? depth * 12 : 0;

  if (!item.href) {
    return (
      <div
        title={collapsed ? item.label : undefined}
        aria-disabled="true"
        style={!collapsed && depth > 0 ? { paddingLeft: `${indent}px` } : undefined}
        className={cn(
          "flex min-h-10 w-full items-center gap-2 rounded-[14px] px-3 text-xs text-muted-foreground/50",
          collapsed && "justify-center px-2",
        )}
      >
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        {!collapsed ? <span className="min-w-0 flex-1 break-words leading-4">{item.label}</span> : null}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      style={!collapsed && depth > 0 ? { paddingLeft: `${indent}px` } : undefined}
      className={cn(
        "flex min-h-10 w-full items-center gap-2 rounded-[14px] px-3 py-2 text-[13px] transition-colors",
        collapsed && "justify-center px-2",
        active
          ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
          : "text-foreground/84 hover:bg-muted/70 hover:text-foreground",
      )}
    >
      {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
      {!collapsed ? <span className="min-w-0 flex-1 break-words leading-4">{item.label}</span> : null}
    </Link>
  );
}

function NavCollapsible({
  item,
  pathname,
  depth,
  collapsed,
  openSections,
  onToggle,
  parentKey,
}: {
  item: NavItem;
  pathname: string;
  depth: number;
  collapsed: boolean;
  openSections: Set<string>;
  onToggle: (key: string) => void;
  parentKey: string;
}) {
  const Icon = item.icon;
  const nodeKey = getNavItemKey(item, parentKey);
  const isOpen = openSections.has(nodeKey);
  const hasActiveChild = itemContainsActive(item, pathname);
  const indent = depth > 0 ? depth * 12 : 0;

  return (
    <div className="overflow-visible">
      <button
        type="button"
        onClick={() => !collapsed && onToggle(nodeKey)}
        title={collapsed ? item.label : undefined}
        style={!collapsed && depth > 0 ? { paddingLeft: `${indent}px` } : undefined}
        className={cn(
          "flex min-h-10 w-full items-center gap-2 rounded-[14px] px-3 py-2 text-[13px] transition-colors hover:bg-muted/60 hover:text-foreground",
          collapsed && "justify-center px-2",
          hasActiveChild && !collapsed ? "text-foreground" : depth === 0 ? "text-foreground/84" : "text-muted-foreground",
        )}
      >
        {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden="true" /> : null}
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 break-words text-left leading-4">{item.label}</span>
            <ChevronRight
              className={cn(
                "size-3 shrink-0 text-muted-foreground/50 transition-transform duration-150",
                isOpen && "rotate-90",
              )}
              aria-hidden="true"
            />
          </>
        ) : null}
      </button>

      {isOpen && !collapsed ? (
        <div className={cn("mt-0.5 space-y-0.5 overflow-visible pb-1", depth === 0 ? "ml-3 border-l border-border/50 pl-2" : "ml-2 border-l border-border/50 pl-1.5")}>
          {item.items!.map((child) => (
            <NavItemRenderer
              key={child.label}
              item={child}
              pathname={pathname}
              depth={depth + 1}
              collapsed={collapsed}
              openSections={openSections}
              onToggle={onToggle}
              parentKey={nodeKey}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function NavItemRenderer({
  item,
  pathname,
  depth,
  collapsed,
  openSections,
  onToggle,
  parentKey,
}: {
  item: NavItem;
  pathname: string;
  depth: number;
  collapsed: boolean;
  openSections: Set<string>;
  onToggle: (key: string) => void;
  parentKey: string;
}) {
  if (item.items?.length) {
    return (
      <NavCollapsible
        item={item}
        pathname={pathname}
        depth={depth}
        collapsed={collapsed}
        openSections={openSections}
        onToggle={onToggle}
        parentKey={parentKey}
      />
    );
  }

  return <NavLeaf item={item} pathname={pathname} depth={depth} collapsed={collapsed} />;
}
