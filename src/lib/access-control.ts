import {
  ACTIVE_MODULES,
  ALL_MANAGED_MODULES,
  type ModuleAccessSection,
} from "@/config/module-catalog";

export type RoleCode = "superadmin" | "viewer" | "custom";

export type PermissionOverride = {
  resourceKey: string;
  canView: boolean;
};

export type AccessResource = {
  resourceKey: string;
  label: string;
  section: ModuleAccessSection;
};

export type ApiAccessPolicy = "resource-bound" | "superadmin-only" | "internal-dev-only";

export type ApiAccessRule = {
  pathnamePrefix: string;
  policy: ApiAccessPolicy;
  requiredResources?: string[];
};

function buildAccessLabel(eyebrow: string, title: string) {
  const parts = eyebrow.split(" / ").slice(1);
  const prefix = parts.join(" / ");
  if (!prefix) {
    return title;
  }

  const lastPart = parts[parts.length - 1];
  return lastPart?.toLowerCase() === title.toLowerCase() ? prefix : `${prefix} / ${title}`;
}

/**
 * Permisos "panel": recursos virtuales (no son rutas) que permiten bloquear
 * sub-secciones dentro de una pagina. Se gestionan en la misma UI de
 * Admin > Usuarios y se evaluan igual que cualquier otro resourceKey.
 *
 * Convencion: `panel:<dominio>.<subseccion>`.
 */
export const PANEL_ACCESS_RESOURCES: AccessResource[] = [
  { resourceKey: "panel:person-sheet.info",        label: "Ficha del personal / InformaciÃ³n",  section: "Paneles" },
  { resourceKey: "panel:person-sheet.performance", label: "Ficha del personal / Rendimiento",  section: "Paneles" },
  { resourceKey: "panel:person-sheet.medical",     label: "Ficha del personal / Ficha mÃ©dica", section: "Paneles" },
  { resourceKey: "panel:tthh.followups.view",      label: "Seguimientos / Ver",                section: "Paneles" },
  { resourceKey: "panel:tthh.followups.write",     label: "Seguimientos / Registrar",          section: "Paneles" },
  { resourceKey: "panel:tthh.followups.sensitive", label: "Seguimientos / Ver datos sensibles", section: "Paneles" },
  { resourceKey: "panel:tthh.followups.admin",     label: "Seguimientos / Corregir",            section: "Paneles" },
  { resourceKey: "panel:tthh.collaborators.basic",       label: "Colaboradores / InformaciÃ³n bÃ¡sica", section: "Paneles" },
  { resourceKey: "panel:tthh.collaborators.performance", label: "Colaboradores / Rendimiento",        section: "Paneles" },
  { resourceKey: "panel:tthh.collaborators.medical",     label: "Colaboradores / Ficha mÃ©dica",       section: "Paneles" },
  { resourceKey: "panel:tthh.collaborators.absenteeism", label: "Colaboradores / Ausentismo",         section: "Paneles" },
  { resourceKey: "panel:tthh.collaborators.exits",       label: "Colaboradores / Salidas",            section: "Paneles" },
  { resourceKey: "panel:tthh.collaborators.followups",   label: "Colaboradores / Seguimientos",       section: "Paneles" },
  { resourceKey: "panel:tthh.collaborators.filter-area", label: "Colaboradores / Filtrar Ã¡rea",       section: "Paneles" },
  { resourceKey: "panel:tthh.collaborators.filter-state", label: "Colaboradores / Filtrar estado",    section: "Paneles" },
];

const MODULE_ACCESS_RESOURCES: AccessResource[] = ALL_MANAGED_MODULES.map((module) => ({
  resourceKey: module.href,
  label: buildAccessLabel(module.eyebrow, module.title),
  section: module.accessSection,
}));

const ACTIVE_MODULE_ACCESS_RESOURCES: AccessResource[] = ACTIVE_MODULES.map((module) => ({
  resourceKey: module.href,
  label: buildAccessLabel(module.eyebrow, module.title),
  section: module.accessSection,
}));

const ALL_ACCESS_RESOURCES: AccessResource[] = [
  ...MODULE_ACCESS_RESOURCES,
  ...PANEL_ACCESS_RESOURCES,
];

export const ACCESS_RESOURCES: AccessResource[] = [
  ...ACTIVE_MODULE_ACCESS_RESOURCES,
  ...PANEL_ACCESS_RESOURCES,
];

export const ACCESS_RESOURCES_BY_SECTION = ACCESS_RESOURCES.reduce<Record<string, AccessResource[]>>((groups, resource) => {
  const items = groups[resource.section] ?? [];
  items.push(resource);
  groups[resource.section] = items;
  return groups;
}, {});

export const ACCESS_RESOURCE_KEYS = new Set(ALL_ACCESS_RESOURCES.map((resource) => resource.resourceKey));

export const ADMIN_RESOURCE_KEYS = new Set<string>(
  ALL_ACCESS_RESOURCES
    .filter((resource) => resource.section === "Administracion")
    .map((resource) => resource.resourceKey),
);

export const ROLE_OPTIONS: Array<{ value: RoleCode; label: string; description: string }> = [
  { value: "superadmin", label: "Superadmin", description: "Acceso total a modulos activos e internos de gestion." },
  { value: "viewer", label: "Viewer", description: "Todas las pantallas activas no administrativas." },
  { value: "custom", label: "Custom", description: "Accesos definidos manualmente por recurso." },
];

const TALENTO_RESOURCE_KEYS = ALL_MANAGED_MODULES
  .filter((module) => module.key.startsWith("talento-"))
  .map((module) => module.href);

const TALENTO_ACTIVOS_RESOURCE_KEYS = TALENTO_RESOURCE_KEYS.filter(
  (resourceKey) => resourceKey !== "/dashboard/talento-humano/rotacion-laboral",
);

const TALENTO_PERSONA_RESOURCE_KEYS = [...TALENTO_RESOURCE_KEYS];

const CHAT_RESOURCE_KEYS = ACTIVE_MODULES
  .filter((module) => module.navigationGroup !== "Administracion")
  .map((module) => module.href);

const API_ACCESS_RULES_UNSORTED: ApiAccessRule[] = [
  {
    pathnamePrefix: "/api/programaciones/debug",
    policy: "internal-dev-only",
  },
  {
    pathnamePrefix: "/api/postcosecha/balanzas/schema",
    policy: "internal-dev-only",
  },
  {
    pathnamePrefix: "/api/health/db",
    policy: "superadmin-only",
  },
  {
    pathnamePrefix: "/api/admin/users",
    policy: "resource-bound",
    requiredResources: ["/dashboard/admin/seguridad/usuarios"],
  },
  {
    pathnamePrefix: "/api/chat",
    policy: "resource-bound",
    requiredResources: CHAT_RESOURCE_KEYS,
  },
  {
    pathnamePrefix: "/api/comparacion",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comparacion"],
  },
  {
    pathnamePrefix: "/api/calidad/punto-apertura",
    policy: "resource-bound",
    requiredResources: ["/dashboard/calidad/punto-apertura"],
  },
  {
    pathnamePrefix: "/api/calidad/reclamos",
    policy: "resource-bound",
    requiredResources: ["/dashboard/calidad/reclamos"],
  },
  {
    pathnamePrefix: "/api/comercial/reclamos",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comercial/reclamos"],
  },
  {
    pathnamePrefix: "/api/me/profile",
    policy: "resource-bound",
    requiredResources: ["/dashboard/mi-cuenta"],
  },
  {
    pathnamePrefix: "/api/me/work",
    policy: "resource-bound",
    requiredResources: ["/dashboard/mi-trabajo"],
  },
  {
    pathnamePrefix: "/api/fenograma",
    policy: "resource-bound",
    requiredResources: ["/dashboard/fenograma"],
  },
  {
    pathnamePrefix: "/api/medical/person",
    policy: "resource-bound",
    requiredResources: ["panel:person-sheet.medical", "panel:tthh.collaborators.medical"],
  },
  {
    pathnamePrefix: "/api/mortality",
    policy: "resource-bound",
    requiredResources: ["/dashboard/mortality"],
  },
  {
    pathnamePrefix: "/api/campo/administrar-maestros/programacion-drench",
    policy: "resource-bound",
    requiredResources: ["/dashboard/campo/administrar-maestros/programacion-drench"],
  },
  {
    pathnamePrefix: "/api/laboratorio/administrar-maestros/receta-productos",
    policy: "resource-bound",
    requiredResources: ["/dashboard/laboratorio/administrar-maestros/receta-productos"],
  },
  {
    pathnamePrefix: "/api/laboratorio/administrar-maestros/tipos-elaboracion",
    policy: "resource-bound",
    requiredResources: ["/dashboard/laboratorio/administrar-maestros/tipos-elaboracion"],
  },
  {
    pathnamePrefix: "/api/ventas/administrar-maestros/clientes",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comercial/administrar-maestros/clientes"],
  },
  {
    pathnamePrefix: "/api/ventas/administrar-maestros/comercializadoras",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comercial/administrar-maestros/comercializadoras"],
  },
  {
    pathnamePrefix: "/api/ventas/administrar-maestros/ejecutivos-cuenta",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comercial/administrar-maestros/ejecutivos-cuenta"],
  },
  {
    pathnamePrefix: "/api/comercial/administrar-maestros/clientes",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comercial/administrar-maestros/clientes"],
  },
  {
    pathnamePrefix: "/api/comercial/administrar-maestros/comercializadoras",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comercial/administrar-maestros/comercializadoras"],
  },
  {
    pathnamePrefix: "/api/comercial/administrar-maestros/ejecutivos-cuenta",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comercial/administrar-maestros/ejecutivos-cuenta"],
  },
  {
    pathnamePrefix: "/api/general/administrar-maestros/variedades",
    policy: "resource-bound",
    requiredResources: ["/dashboard/general/administrar-maestros/variedades"],
  },
  {
    pathnamePrefix: "/api/postcosecha/administrar-maestros/destinos",
    policy: "resource-bound",
    requiredResources: ["/dashboard/postcosecha/administrar-maestros/destinos"],
  },
  {
    pathnamePrefix: "/api/general/administrar-maestros/fincas",
    policy: "resource-bound",
    requiredResources: ["/dashboard/general/administrar-maestros/fincas"],
  },
  {
    pathnamePrefix: "/api/comercial/administrar-maestros/problemas-reclamo",
    policy: "resource-bound",
    requiredResources: ["/dashboard/comercial/administrar-maestros/problemas-reclamo"],
  },
  {
    pathnamePrefix: "/api/bodega/planificacion/programaciones",
    policy: "resource-bound",
    requiredResources: ["/dashboard/bodega/planificacion/programaciones"],
  },
  {
    pathnamePrefix: "/api/bodega/administrar-maestros/actividades-fuente",
    policy: "resource-bound",
    requiredResources: ["/dashboard/bodega/administrar-maestros/productos"],
  },
  {
    pathnamePrefix: "/api/bodega/administrar-maestros/categorias",
    policy: "resource-bound",
    requiredResources: ["/dashboard/bodega/administrar-maestros/categorias"],
  },
  {
    pathnamePrefix: "/api/bodega/administrar-maestros/presentaciones-conversiones",
    policy: "resource-bound",
    requiredResources: ["/dashboard/bodega/administrar-maestros/presentaciones-conversiones"],
  },
  {
    pathnamePrefix: "/api/bodega/administrar-maestros/productos",
    policy: "resource-bound",
    requiredResources: ["/dashboard/bodega/administrar-maestros/productos"],
  },
  {
    pathnamePrefix: "/api/bodega/administrar-maestros/unidades",
    policy: "resource-bound",
    requiredResources: ["/dashboard/bodega/administrar-maestros/unidades"],
  },
  {
    pathnamePrefix: "/api/postcosecha/administrar-maestros/skus",
    policy: "resource-bound",
    requiredResources: ["/dashboard/postcosecha/administrar-maestros/skus"],
  },
  {
    pathnamePrefix: "/api/postcosecha/balanzas",
    policy: "resource-bound",
    requiredResources: ["/dashboard/postcosecha/balanzas"],
  },
  {
    // Cubre todos los sub-paths del solver: /run, /pdf, etc.
    pathnamePrefix: "/api/postcosecha/planificacion/solver/clasificacion-en-blanco",
    policy: "resource-bound",
    requiredResources: ["/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco"],
  },
  {
    pathnamePrefix: "/api/productividad",
    policy: "resource-bound",
    requiredResources: ["/dashboard/productividad"],
  },
  {
    pathnamePrefix: "/api/programaciones",
    policy: "resource-bound",
    requiredResources: ["/dashboard/programaciones"],
  },
  {
    pathnamePrefix: "/api/admin/administracion-maestros/dominios",
    policy: "resource-bound",
    requiredResources: ["/dashboard/admin/administracion-maestros/dominios"],
  },
  {
    pathnamePrefix: "/api/admin/administracion-maestros/catalogos",
    policy: "resource-bound",
    requiredResources: ["/dashboard/admin/administracion-maestros/catalogos"],
  },
  {
    pathnamePrefix: "/api/admin/administracion-maestros/unidades",
    policy: "resource-bound",
    requiredResources: ["/dashboard/admin/administracion-maestros/unidades"],
  },
  {
    pathnamePrefix: "/api/admin/administracion-maestros/metricas",
    policy: "resource-bound",
    requiredResources: ["/dashboard/admin/administracion-maestros/metricas"],
  },
  {
    pathnamePrefix: "/api/admin/administracion-maestros/metas-objetivos",
    policy: "resource-bound",
    requiredResources: ["/dashboard/admin/administracion-maestros/metas-objetivos"],
  },
  {
    pathnamePrefix: "/api/admin/administracion-maestros",
    policy: "resource-bound",
    requiredResources: [
      "/dashboard/admin/administracion-maestros/metricas",
      "/dashboard/admin/administracion-maestros/metas-objetivos",
    ],
  },
  {
    pathnamePrefix: "/api/talento-humano/seguimientos",
    policy: "resource-bound",
    requiredResources: ["/dashboard/talento-humano/seguimientos"],
  },
  {
    pathnamePrefix: "/api/talento-humano/colaboradores",
    policy: "resource-bound",
    requiredResources: ["/dashboard/talento-humano/colaboradores"],
  },
  {
    pathnamePrefix: "/api/talento-humano/catalogos",
    policy: "resource-bound",
    requiredResources: [
      "/dashboard/talento-humano/administrar-maestros/catalogos",
      "/dashboard/talento-humano/administrar-maestros/dominios",
    ],
  },
  {
    pathnamePrefix: "/api/talento-humano/activos",
    policy: "resource-bound",
    requiredResources: TALENTO_ACTIVOS_RESOURCE_KEYS,
  },
  {
    pathnamePrefix: "/api/talento-humano/persona",
    policy: "resource-bound",
    requiredResources: TALENTO_PERSONA_RESOURCE_KEYS,
  },
  {
    pathnamePrefix: "/api/talento-humano/rotacion",
    policy: "resource-bound",
    requiredResources: ["/dashboard/talento-humano/rotacion-laboral"],
  },
  {
    pathnamePrefix: "/api/talento-humano/desvinculacion",
    policy: "resource-bound",
    requiredResources: ["/dashboard/talento-humano/desvinculacion-personal"],
  },
  {
    pathnamePrefix: "/api/talento-humano/seguimientos-indicador",
    policy: "resource-bound",
    requiredResources: ["/dashboard/talento-humano/indicador-seguimientos"],
  },
];

export const API_ACCESS_RULES = [...API_ACCESS_RULES_UNSORTED].sort(
  (left, right) => right.pathnamePrefix.length - left.pathnamePrefix.length,
);

export function isRoleCode(value: unknown): value is RoleCode {
  return value === "superadmin" || value === "viewer" || value === "custom";
}

export function normalizeRoleCode(value: string | null | undefined): RoleCode {
  return isRoleCode(value)
    ? value
    : "custom";
}

export function getBaseAllowedResources(roleCode: RoleCode): string[] {
  if (roleCode === "superadmin") {
    return ALL_ACCESS_RESOURCES.map((resource) => resource.resourceKey);
  }

  if (roleCode === "viewer") {
    return ACCESS_RESOURCES
      .filter((resource) => !ADMIN_RESOURCE_KEYS.has(resource.resourceKey))
      .map((resource) => resource.resourceKey);
  }

  return [];
}

export function resolveAllowedResources(
  roleCode: RoleCode,
  overrides: PermissionOverride[] = [],
): string[] {
  if (roleCode === "superadmin") {
    return getBaseAllowedResources(roleCode);
  }

  const allowed = new Set(getBaseAllowedResources(roleCode));

  for (const override of overrides) {
    if (!ACCESS_RESOURCE_KEYS.has(override.resourceKey)) continue;

    if (override.canView) {
      allowed.add(override.resourceKey);
    } else {
      allowed.delete(override.resourceKey);
    }
  }

  return ALL_ACCESS_RESOURCES
    .map((resource) => resource.resourceKey)
    .filter((resourceKey) => allowed.has(resourceKey));
}

export function canAccessResource(resourceKey: string, allowedResources: string[], isSuperadmin = false) {
  if (isSuperadmin) return true;
  return allowedResources.includes(resourceKey);
}

export function sanitizePermissionOverrides(overrides: PermissionOverride[] = []) {
  const byKey = new Map<string, boolean>();

  for (const override of overrides) {
    if (!ACCESS_RESOURCE_KEYS.has(override.resourceKey)) continue;
    byKey.set(override.resourceKey, Boolean(override.canView));
  }

  return Array.from(byKey.entries()).map(([resourceKey, canView]) => ({ resourceKey, canView }));
}

export function parsePermissionOverridesInput(value: unknown): PermissionOverride[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const parsed: PermissionOverride[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const resourceKey = "resourceKey" in entry ? entry.resourceKey : undefined;
    const canView = "canView" in entry ? entry.canView : undefined;

    if (typeof resourceKey !== "string" || !ACCESS_RESOURCE_KEYS.has(resourceKey) || typeof canView !== "boolean") {
      return null;
    }

    parsed.push({ resourceKey, canView });
  }

  return sanitizePermissionOverrides(parsed);
}

export function getApiAccessRule(pathname: string): ApiAccessRule | null {
  return API_ACCESS_RULES.find((rule) => matchesApiPrefix(pathname, rule.pathnamePrefix)) ?? null;
}

export function matchesApiPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

