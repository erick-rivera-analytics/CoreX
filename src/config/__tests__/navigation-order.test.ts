import { describe, expect, it } from "vitest";

import { buildDashboardHomeSections } from "@/config/dashboard";
import { sidebarGroups, type NavItem } from "@/config/sidebar-data";

function expectAlphabetical(items: Array<{ label: string }>) {
  const labels = items.map((item) => item.label);
  const expected = [...labels].sort((left, right) => left.localeCompare(right, "es", { sensitivity: "base" }));
  expect(labels).toEqual(expected);
}

function walkNavItems(items: NavItem[]) {
  expectAlphabetical(items);

  for (const item of items) {
    if (item.items?.length) {
      walkNavItems(item.items);
    }
  }
}

describe("navigation ordering", () => {
  it("keeps sidebar items sorted alphabetically at every level", () => {
    for (const group of sidebarGroups) {
      if (group.title === "Principal") continue;
      walkNavItems(group.items);
    }
  });

  it("keeps dashboard home sections sorted alphabetically by title", () => {
    const sections = buildDashboardHomeSections([], true);

    for (const section of sections) {
      expectAlphabetical(section.views.map((view) => ({ label: view.title })));
    }
  });
});
