import type { LucideIcon } from "lucide-react";

import {
  ACTIVE_MODULES,
  STARTER_NAME,
  STARTER_SUBTITLE,
  filterModulesByAccess,
  findModuleByPath,
  type ModuleNavigationGroup,
} from "@/config/module-catalog";

export type DashboardView = {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  href: string;
  icon: LucideIcon;
  navigationGroup: ModuleNavigationGroup;
  mobileVisible: boolean;
};

type HomeSectionId = "dashboard" | "gestion" | "administracion";

type HomeSection = {
  id: HomeSectionId;
  title: string;
  description: string;
  navigationGroup: ModuleNavigationGroup;
  views: DashboardView[];
};

const HOME_SECTION_META: Record<HomeSectionId, Omit<HomeSection, "views">> = {
  dashboard: {
    id: "dashboard",
    title: "Dashboard",
    description: "Indicadores y exploradores operativos visibles en la navegacion lateral.",
    navigationGroup: "Dashboard",
  },
  gestion: {
    id: "gestion",
    title: "Gestión",
    description: "Herramientas operativas y maestras disponibles para la operación.",
    navigationGroup: "Gestion",
  },
  administracion: {
    id: "administracion",
    title: "Administración",
    description: "Superficie administrativa disponible para gobierno del sistema.",
    navigationGroup: "Administracion",
  },
};

export const starterName = STARTER_NAME;
export const starterSubtitle = STARTER_SUBTITLE;

export const dashboardViews: DashboardView[] = ACTIVE_MODULES.map((catalogEntry) => ({
  slug: catalogEntry.key,
  title: catalogEntry.title,
  eyebrow: catalogEntry.eyebrow,
  summary: catalogEntry.summary,
  href: catalogEntry.href,
  icon: catalogEntry.icon,
  navigationGroup: catalogEntry.navigationGroup,
  mobileVisible: catalogEntry.mobileVisible !== false,
}));

export const mobileNavigation = dashboardViews
  .filter((view) => view.mobileVisible)
  .map((view) => ({
    label: view.title,
    href: view.href,
    icon: view.icon,
  }));

export function filterDashboardViewsByAccess(
  views: DashboardView[],
  allowedResources: string[],
  isSuperadmin: boolean,
) {
  return filterModulesByAccess(views, allowedResources, isSuperadmin);
}

export function filterMobileNavigationByAccess(
  items: typeof mobileNavigation,
  allowedResources: string[],
  isSuperadmin: boolean,
) {
  return items.filter((item) => isSuperadmin || allowedResources.includes(item.href));
}

export function buildDashboardHomeSections(
  allowedResources: string[],
  isSuperadmin: boolean,
): HomeSection[] {
  return Object.values(HOME_SECTION_META)
    .map((section) => ({
      ...section,
      views: filterDashboardViewsByAccess(
        dashboardViews.filter((view) => view.navigationGroup === section.navigationGroup),
        allowedResources,
        isSuperadmin,
      ),
    }))
    .filter((section) => section.views.length > 0);
}

export function isPathActive(pathname: string, href: string) {
  return pathname === href;
}

export function getPageContext(pathname: string) {
  if (pathname === "/dashboard") {
    return { eyebrow: starterName, title: "Inicio" };
  }

  const pageModule = findModuleByPath(pathname);
  if (!pageModule) {
    return { eyebrow: starterName, title: "Panel" };
  }

  return { eyebrow: pageModule.eyebrow, title: pageModule.title };
}
