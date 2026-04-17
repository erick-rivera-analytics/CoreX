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
  const parts = eyebrow.split(" / ").slice(2);
  const prefix = parts.join(" / ");
  if (!prefix) {
    return title;
  }

  return prefix.toLowerCase() === title.toLowerCase() ? prefix : `${prefix} / ${title}`;
}

const ALL_ACCESS_RESOURCES: AccessResource[] = ALL_MANAGED_MODULES.map((module) => ({
  resourceKey: module.href,
  label: buildAccessLabel(module.eyebrow, module.title),
  section: module.accessSection,
}));

export const ACCESS_RESOURCES: AccessResource[] = ACTIVE_MODULES.map((module) => ({
  resourceKey: module.href,
  label: buildAccessLabel(module.eyebrow, module.title),
  section: module.accessSection,
}));

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

const FENOGRAMA_MEDICAL_RESOURCE_KEYS = [
  "/dashboard/fenograma",
  "/dashboard/mortality",
  "/dashboard/productividad",
];

const CHAT_RESOURCE_KEYS = ACTIVE_MODULES
  .filter((module) => module.navigationGroup !== "Administracion")
  .map((module) => module.href);

const API_ACCESS_RULES_UNSORTED: ApiAccessRule[] = [
  {
    pathnamePrefix: "/api/programaciones/debug",
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
    pathnamePrefix: "/api/fenograma",
    policy: "resource-bound",
    requiredResources: ["/dashboard/fenograma"],
  },
  {
    pathnamePrefix: "/api/medical/person",
    policy: "resource-bound",
    requiredResources: FENOGRAMA_MEDICAL_RESOURCE_KEYS,
  },
  {
    pathnamePrefix: "/api/mortality",
    policy: "resource-bound",
    requiredResources: ["/dashboard/mortality"],
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
