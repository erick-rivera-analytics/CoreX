import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getApiAccessRule } from "@/lib/access-control";

const root = process.cwd();

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function routePathFromFile(file: string) {
  const relative = path.relative(path.join(root, "src", "app", "api"), file);
  const parts = relative.split(path.sep).filter((part) => part !== "route.ts");
  return `/api/${parts.map((part) => (part.startsWith("[") ? "test" : part)).join("/")}`;
}

describe("API RBAC coverage", () => {
  it("maps every requireAuth route to an explicit access rule", () => {
    const routeFiles = walk(path.join(root, "src", "app", "api"))
      .filter((file) => file.endsWith(`${path.sep}route.ts`));

    const protectedRoutes = routeFiles
      .filter((file) => fs.readFileSync(file, "utf8").includes("requireAuth("))
      .map(routePathFromFile);

    for (const route of protectedRoutes) {
      expect(getApiAccessRule(route), route).not.toBeNull();
    }
  });
});
