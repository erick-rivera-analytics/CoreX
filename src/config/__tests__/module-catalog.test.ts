import { describe, expect, it } from "vitest";

import { MODULE_CATALOG } from "@/config/module-catalog";

describe("module catalog governance", () => {
  it("keeps unique keys and hrefs", () => {
    const keys = MODULE_CATALOG.map((module) => module.key);
    const hrefs = MODULE_CATALOG.map((module) => module.href);

    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("keeps visible modules with required metadata", () => {
    const visibleModules = MODULE_CATALOG.filter((catalogEntry) => catalogEntry.status === "active");

    expect(visibleModules.length).toBeGreaterThan(0);

    for (const catalogEntry of visibleModules) {
      expect(catalogEntry.label.trim().length).toBeGreaterThan(0);
      expect(catalogEntry.title.trim().length).toBeGreaterThan(0);
      expect(catalogEntry.eyebrow.trim().length).toBeGreaterThan(0);
      expect(catalogEntry.summary.trim().length).toBeGreaterThan(0);
      expect(catalogEntry.href.startsWith("/dashboard")).toBe(true);
    }
  });
});
