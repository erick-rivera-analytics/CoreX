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
  label: string;
  eyebrow: string;
  summary: string;
  href: string;
  icon: LucideIcon;
  navigationGroup: ModuleNavigationGroup;
  trail: string[];
  mobileVisible: boolean;
  quickAccess: boolean;
  keywords: string[];
};

type HomeSectionId = "analytics" | "management" | "administration";

type HomeSection = {
  id: HomeSectionId;
  title: string;
  description: string;
  navigationGroup: ModuleNavigationGroup;
  views: DashboardView[];
};

export type DomainEntry = {
  domain: string;
  description: string;
  links: Array<{
    label: string;
    href: string;
    count: number;
  }>;
};

const HOME_SECTION_META: Record<HomeSectionId, Omit<HomeSection, "views">> = {
  analytics: {
    id: "analytics",
    title: "Analítica",
    description: "Indicadores, KPI y vistas de seguimiento.",
    navigationGroup: "Dashboard",
  },
  management: {
    id: "management",
    title: "Gestión",
    description: "Planificación, registros y operación diaria.",
    navigationGroup: "Gestion",
  },
  administration: {
    id: "administration",
    title: "Administración",
    description: "Maestros, catálogos, métricas, metas y seguridad.",
    navigationGroup: "Administracion",
  },
};

const NAVIGATION_GROUP_LABEL: Partial<Record<ModuleNavigationGroup, string>> = {
  Dashboard: "Analítica",
  Gestion: "Gestión",
  Administracion: "Maestros",
};

const DOMAIN_ORDER: Record<string, number> = {
  Campo: 10,
  Postcosecha: 20,
  Bodega: 30,
  Laboratorio: 40,
  "Talento Humano": 50,
  Calidad: 60,
};

export const starterName = STARTER_NAME;
export const starterSubtitle = STARTER_SUBTITLE;

export const dashboardViews: DashboardView[] = ACTIVE_MODULES.map((catalogEntry) => ({
  slug: catalogEntry.key,
  title: catalogEntry.title,
  label: catalogEntry.label,
  eyebrow: catalogEntry.eyebrow,
  summary: catalogEntry.summary,
  href: catalogEntry.href,
  icon: catalogEntry.icon,
  navigationGroup: catalogEntry.navigationGroup,
  trail: catalogEntry.trail,
  mobileVisible: catalogEntry.mobileVisible !== false,
  quickAccess: catalogEntry.quickAccess === true,
  keywords: catalogEntry.keywords ?? [],
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

export function buildQuickAccessViews(allowedResources: string[], isSuperadmin: boolean) {
  return filterDashboardViewsByAccess(
    dashboardViews.filter((view) => view.quickAccess),
    allowedResources,
    isSuperadmin,
  ).slice(0, 8);
}

export function buildDomainEntries(allowedResources: string[], isSuperadmin: boolean): DomainEntry[] {
  const visibleViews = filterDashboardViewsByAccess(dashboardViews, allowedResources, isSuperadmin);
  const byDomain = new Map<string, Map<string, DashboardView[]>>();

  for (const view of visibleViews) {
    const domain = resolveDomainFromTrail(view);
    const areaLabel = NAVIGATION_GROUP_LABEL[view.navigationGroup];
    if (!domain || !areaLabel) continue;

    const areaMap = byDomain.get(domain) ?? new Map<string, DashboardView[]>();
    const areaViews = areaMap.get(areaLabel) ?? [];
    areaViews.push(view);
    areaMap.set(areaLabel, areaViews);
    byDomain.set(domain, areaMap);
  }

  return Array.from(byDomain.entries())
    .map(([domain, areaMap]) => ({
      domain,
      description: buildDomainDescription(domain),
      links: Array.from(areaMap.entries())
        .map(([label, views]) => ({
          label,
          href: views[0]?.href ?? "/dashboard",
          count: views.length,
        }))
        .sort((left, right) => {
          const leftOrder = left.label === "Analítica" ? 10 : left.label === "Gestión" ? 20 : 30;
          const rightOrder = right.label === "Analítica" ? 10 : right.label === "Gestión" ? 20 : 30;
          return leftOrder - rightOrder;
        }),
    }))
    .sort((left, right) => {
      const leftOrder = DOMAIN_ORDER[left.domain] ?? 1000;
      const rightOrder = DOMAIN_ORDER[right.domain] ?? 1000;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.domain.localeCompare(right.domain, "es", { sensitivity: "base" });
    });
}

export function buildSearchableText(view: DashboardView) {
  return [
    view.slug,
    view.title,
    view.label,
    view.eyebrow,
    view.summary,
    ...view.trail,
    ...view.keywords,
  ]
    .join(" ")
    .toLocaleLowerCase("es");
}

export function isPathActive(pathname: string, href: string) {
  return pathname === href;
}

export function getPageContext(pathname: string) {
  if (pathname === "/dashboard") {
    return { eyebrow: starterName, title: "Inicio" };
  }

  if (pathname === "/dashboard/campo/planificacion/fumigacion") {
    return {
      eyebrow: "Gestion / Campo / Planificacion",
      title: "Programacion Fumigacion",
    };
  }

  if (pathname === "/dashboard/campo/administrar-maestros/programacion-fumigacion") {
    return {
      eyebrow: "Administracion / Maestros por dominio / Campo",
      title: "Programacion Fumigacion",
    };
  }

  const pageModule = findModuleByPath(pathname);
  if (!pageModule) {
    return { eyebrow: starterName, title: "Panel" };
  }

  return { eyebrow: pageModule.eyebrow, title: pageModule.title };
}

function resolveDomainFromTrail(view: DashboardView) {
  if (view.navigationGroup === "Administracion" && view.trail[0] === "Maestros por dominio") {
    return view.trail[1] ?? null;
  }

  if (view.navigationGroup === "Administracion") {
    return null;
  }

  return view.trail[0] ?? null;
}

function buildDomainDescription(domain: string) {
  switch (domain) {
    case "Campo":
      return "Producción agrícola, planificación y maestros operativos.";
    case "Postcosecha":
      return "Flujo de postcosecha, solver, balanzas y SKU's.";
    case "Bodega":
      return "Planificación y maestros de insumos, productos y unidades.";
    case "Laboratorio":
      return "Maestros de recetas y tipos de elaboración.";
    case "Talento Humano":
      return "Indicadores, registros y catálogos de Talento Humano.";
    case "Calidad":
      return "Vistas de control y seguimiento de calidad.";
    default:
      return "Módulos disponibles para este dominio.";
  }
}
