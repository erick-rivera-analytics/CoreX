import { describe, expect, it } from "vitest";

import { ACTIVE_MODULES, ALL_MANAGED_MODULES } from "@/config/module-catalog";
import {
  ACCESS_RESOURCES,
  getApiAccessRule,
  getBaseAllowedResources,
  matchesApiPrefix,
  parsePermissionOverridesInput,
  resolveAllowedResources,
  sanitizePermissionOverrides,
} from "@/lib/access-control";

describe("access control", () => {
  it("matches API prefixes with path boundaries", () => {
    expect(matchesApiPrefix("/api/health/db", "/api/health/db")).toBe(true);
    expect(matchesApiPrefix("/api/health/db/stats", "/api/health/db")).toBe(true);
    expect(matchesApiPrefix("/api/health/dbx", "/api/health/db")).toBe(false);
  });

  it("keeps sensitive and debug API policies explicit", () => {
    expect(getApiAccessRule("/api/health/db")?.policy).toBe("superadmin-only");
    expect(getApiAccessRule("/api/programaciones/debug")?.policy).toBe("internal-dev-only");
    expect(getApiAccessRule("/api/calidad/punto-apertura")?.requiredResources).toEqual([
      "/dashboard/calidad/punto-apertura",
    ]);
    expect(getApiAccessRule("/api/dead-plants-reseed/capture")?.requiredResources).toEqual([
      "/dashboard/dead-plants-reseed",
    ]);
    expect(getApiAccessRule("/api/me/profile")?.requiredResources).toEqual([
      "/dashboard/mi-cuenta",
    ]);
    expect(getApiAccessRule("/api/me/work/tasks")?.requiredResources).toEqual([
      "/dashboard/mi-trabajo",
    ]);
    expect(getApiAccessRule("/api/unknown")).toBeNull();
  });

  it("derives viewer resources from active non-admin modules", () => {
    const viewerResources = getBaseAllowedResources("viewer");
    const activeNonAdmin = ACTIVE_MODULES
      .filter((module) => module.navigationGroup !== "Administracion")
      .map((module) => module.href);

    expect(viewerResources.filter((resource) => resource.startsWith("/dashboard")).sort()).toEqual(activeNonAdmin.sort());
    expect(viewerResources).toEqual(expect.arrayContaining([
      "panel:person-sheet.info",
      "panel:person-sheet.performance",
      "panel:person-sheet.medical",
    ]));
    expect(viewerResources).not.toContain("/dashboard/admin/seguridad/usuarios");
  });

  it("keeps active catalog resources visible in RBAC", () => {
    const visibleResources = new Set(ACCESS_RESOURCES.map((resource) => resource.resourceKey));

    for (const catalogModule of ACTIVE_MODULES) {
      expect(visibleResources.has(catalogModule.href)).toBe(true);
    }

    for (const catalogModule of ALL_MANAGED_MODULES.filter((entry) => entry.status === "hidden")) {
      expect(visibleResources.has(catalogModule.href)).toBe(false);
    }
  });

  it("applies sanitized overrides on top of base permissions", () => {
    const activeViewerResource = ACTIVE_MODULES.find((module) => module.navigationGroup !== "Administracion")!.href;
    const hiddenAdminResource = "/dashboard/admin/seguridad/usuarios";

    const overrides = sanitizePermissionOverrides([
      { resourceKey: activeViewerResource, canView: false },
      { resourceKey: hiddenAdminResource, canView: true },
      { resourceKey: hiddenAdminResource, canView: true },
    ]);

    const resolved = resolveAllowedResources("viewer", overrides);

    expect(resolved).not.toContain(activeViewerResource);
    expect(resolved).toContain(hiddenAdminResource);
  });

  it("rejects malformed permission override payloads", () => {
    expect(parsePermissionOverridesInput([{ resourceKey: "/dashboard/unknown", canView: true }])).toBeNull();
    expect(parsePermissionOverridesInput([{ resourceKey: ACTIVE_MODULES[0]!.href, canView: "yes" }])).toBeNull();
    expect(parsePermissionOverridesInput("invalid")).toBeNull();
  });
});
