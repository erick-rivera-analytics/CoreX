import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CalendarDays,
  ClipboardList,
  DatabaseZap,
  Factory,
  Home,
  Lock,
  Settings,
  Sprout,
  TrendingUp,
  UserCircle2,
  Users,
} from "lucide-react";

import { ACTIVE_MODULES } from "@/config/module-catalog";

export type NavItem = {
  label: string;
  href?: string;
  resourceKey?: string;
  icon?: LucideIcon;
  items?: NavItem[];
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

const GROUP_ICON_BY_LABEL: Record<string, LucideIcon> = {
  Indicadores: TrendingUp,
  Campo: Sprout,
  Postcosecha: Factory,
  "Talento Humano": Users,
  Calidad: BadgeCheck,
  Planificacion: CalendarDays,
  Registros: ClipboardList,
  Personal: UserCircle2,
  "Administrar Maestros": DatabaseZap,
  Solver: Settings,
  Seguridad: Lock,
};

function getOrCreateBranch(items: NavItem[], label: string) {
  const existing = items.find((item) => item.label === label && item.items);
  if (existing) {
    return existing;
  }

  const branch: NavItem = {
    label,
    icon: GROUP_ICON_BY_LABEL[label],
    items: [],
  };
  items.push(branch);
  return branch;
}

function buildGroupItems(groupTitle: "Dashboard" | "Gestion" | "Administracion") {
  const rootItems: NavItem[] = [];

  for (const catalogEntry of ACTIVE_MODULES.filter((entry) => entry.navigationGroup === groupTitle)) {
    let currentItems = rootItems;

    for (const segment of catalogEntry.trail) {
      const branch = getOrCreateBranch(currentItems, segment);
      currentItems = branch.items ?? [];
    }

    currentItems.push({
      label: catalogEntry.label,
      href: catalogEntry.href,
      resourceKey: catalogEntry.href,
      icon: catalogEntry.icon,
    });
  }

  return rootItems;
}

export const sidebarGroups: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Inicio", href: "/dashboard", icon: Home },
    ],
  },
  ...(["Dashboard", "Gestion", "Administracion"] as const)
    .map((title) => ({
      title,
      items: buildGroupItems(title),
    }))
    .filter((group) => group.items.length > 0),
];

export function getNavItemKey(item: NavItem, parentKey = ""): string {
  return parentKey ? `${parentKey}/${item.label}` : item.label;
}

export function isPathActive(pathname: string, href: string): boolean {
  return pathname === href;
}

export function itemContainsActive(item: NavItem, pathname: string): boolean {
  if (item.href && isPathActive(pathname, item.href)) return true;
  return item.items?.some((child) => itemContainsActive(child, pathname)) ?? false;
}

export function getInitialOpenSections(groups: NavGroup[], pathname: string): Set<string> {
  const open = new Set<string>();

  function walkItems(items: NavItem[], parentKey: string) {
    for (const item of items) {
      const key = getNavItemKey(item, parentKey);
      if (item.items && itemContainsActive(item, pathname)) {
        open.add(key);
        walkItems(item.items, key);
      }
    }
  }

  for (const group of groups) {
    walkItems(group.items, group.title);
  }

  return open;
}

export function filterSidebarGroupsByAccess(
  groups: NavGroup[],
  allowedResources: string[],
  isSuperadmin: boolean,
): NavGroup[] {
  function filterItems(items: NavItem[]): NavItem[] {
    return items
      .map((item) => {
        if (item.items?.length) {
          const filteredChildren = filterItems(item.items);
          if (!filteredChildren.length) return null;
          return { ...item, items: filteredChildren };
        }

        if (!item.href) {
          return item;
        }

        if (item.href === "/dashboard") {
          return item;
        }

        const resourceKey = item.resourceKey ?? item.href;
        if (isSuperadmin || allowedResources.includes(resourceKey)) {
          return item;
        }

        return null;
      })
      .filter((item): item is NavItem => item !== null);
  }

  return groups
    .map((group) => ({ ...group, items: filterItems(group.items) }))
    .filter((group) => group.items.length > 0);
}
