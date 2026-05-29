import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  DatabaseZap,
  Factory,
  Home,
  Lock,
  Settings,
  Beaker,
  Sprout,
  Target,
  TrendingUp,
  UserCircle2,
  Users,
  UserSearch,
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

const ALWAYS_VISIBLE_NAV_HREFS = new Set([
  "/dashboard/campo/administrar-maestros/programacion-fumigacion",
]);

const GROUP_ICON_BY_LABEL: Record<string, LucideIcon> = {
  Indicadores: TrendingUp,
  "Indicadores & KPI": TrendingUp,
  Explorador: UserSearch,
  Bodega: DatabaseZap,
  Campo: Sprout,
  Comercial: BriefcaseBusiness,
  Laboratorio: Beaker,
  Postcosecha: Factory,
  "Talento Humano": Users,
  Calidad: BadgeCheck,
  Planificacion: CalendarDays,
  "Planificación": CalendarDays,
  Registros: ClipboardList,
  Personal: UserCircle2,
  "Maestros globales": Settings,
  "Maestros por dominio": DatabaseZap,
  Métricas: Target,
  Solver: Settings,
  Seguridad: Lock,
};

const ORDER_BY_LABEL: Record<string, number> = {
  Inicio: 0,
  Campo: 10,
  Comercial: 12,
  Postcosecha: 20,
  Calidad: 30,
  Bodega: 35,
  Laboratorio: 40,
  "Talento Humano": 50,
  "Indicadores & KPI": 10,
  Explorador: 15,
  Planificación: 10,
  Registros: 20,
  Solver: 30,
  "Maestros globales": 10,
  "Maestros por dominio": 20,
  Seguridad: 30,
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
      resourceKey: catalogEntry.navigationResourceKey ?? catalogEntry.href,
      icon: catalogEntry.icon,
    });
  }

  return sortNavItems(rootItems);
}

function sortNavItems(items: NavItem[]): NavItem[] {
  return [...items]
    .map((item) => item.items ? { ...item, items: sortNavItems(item.items) } : item)
    .sort((left, right) => {
      const leftOrder = ORDER_BY_LABEL[left.label] ?? 1000;
      const rightOrder = ORDER_BY_LABEL[right.label] ?? 1000;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.label.localeCompare(right.label, "es", { sensitivity: "base" });
    });
}

export const sidebarGroups: NavGroup[] = [
  {
    title: "CoreX",
    items: [
      { label: "Inicio", href: "/dashboard", icon: Home },
    ],
  },
  // Las KEYS internas (Gestion/Administracion) viajan sin tilde para mantener
  // match con `module-catalog.navigationGroup`. Los TÍTULOS visibles se traducen
  // a su forma con tilde acá.
  ...([
    { key: "Dashboard", title: "Analítica" },
    { key: "Gestion", title: "Gestión" },
    { key: "Administracion", title: "Administración" },
  ] as const)
    .map(({ key, title }) => ({
      title,
      items: buildGroupItems(key),
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

        if (ALWAYS_VISIBLE_NAV_HREFS.has(item.href)) {
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
