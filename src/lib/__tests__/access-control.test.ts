import { describe, expect, it } from "vitest";

import { ACTIVE_MODULES, ALL_MANAGED_MODULES } from "@/config/module-catalog";
import {
  ACCESS_RESOURCES,
  getApiAccessRule,
  getBaseAllowedResources,
  matchesApiPrefix,
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
    expect(getApiAccessRule("/api/unknown")).toBeNull();
  });

  it("derives viewer resources from active non-admin modules", () => {
    const viewerResources = getBaseAllowedResources("viewer");
    const activeNonAdmin = ACTIVE_MODULES
      .filter((module) => module.navigationGroup !== "Administracion")
      .map((module) => module.href);

    expect(viewerResources.sort()).toEqual(activeNonAdmin.sort());
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
});
