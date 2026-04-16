import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function walk(dir, acc = []) {
  if (!fs.existsSync(path.join(root, dir))) return acc;
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = path.join(dir, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) walk(rel, acc);
    else acc.push(rel);
  }
  return acc;
}

function fail(message) {
  failures.push(message);
}

const mojibakePattern = /Ã|Â|â|�/;
for (const file of [
  ...walk("src").filter((file) => /\.(ts|tsx|md|mjs)$/.test(file)),
  "README.md",
  "CLAUDE.md",
  "AGENTS.md",
  ...walk("docs").filter((file) => /\.md$/.test(file)),
]) {
  if (fs.existsSync(path.join(root, file)) && mojibakePattern.test(read(file))) {
    fail(`Mojibake detectado en ${file}`);
  }
}

const allowedDashboardFiles = new Set([
  "balanzas-explorer.tsx",
  "balanzas-grouped-table.tsx",
  "balanzas-process-viewer.tsx",
  "campo-explorer.tsx",
  "campo-map.tsx",
  "campo-cycle-selector.tsx",
  "campo-sjp-inset.tsx",
  "campo-sub-map-modal.tsx",
  "chatbot-modal.tsx",
  "comparison-explorer.tsx",
  "comparison-radar-chart.tsx",
  "comparison-radar-panel.tsx",
  "fenograma-block-modal.tsx",
  "fenograma-explorer.tsx",
  "fenograma-pivot-table.tsx",
  "fenograma-weekly-bars-chart.tsx",
  "harvest-curve-chart.tsx",
  "harvest-curve-panel.tsx",
  "module-placeholder.tsx",
  "mortality-curve-chart.tsx",
  "mortality-curve-panel.tsx",
  "mortality-explorer.tsx",
  "mortality-table.tsx",
  "person-hours-overlay.tsx",
  "person-info-overlay.tsx",
  "person-medical-panel.tsx",
  "postcosecha-clasificacion-en-blanco-recipe-overlay.tsx",
  "postcosecha-clasificacion-en-blanco-explorer.tsx",
  "postcosecha-skus-explorer.tsx",
  "process-viewer-overlay.tsx",
  "productividad-explorer.tsx",
  "programaciones-explorer.tsx",
]);

for (const file of walk("src/components/dashboard").filter((file) => file.endsWith(".tsx"))) {
  const name = path.basename(file);
  if (!allowedDashboardFiles.has(name)) {
    fail(`Nuevo archivo en legacy dashboard sin excepcion: ${file}`);
  }
}

const metricPillAllowed = new Set(["src/components/dashboard/fenograma-block-modal.tsx"]);
for (const file of walk("src").filter((file) => /\.(ts|tsx)$/.test(file))) {
  const content = read(file);
  if (/(MetricPill|SummaryPill)/.test(content) && !metricPillAllowed.has(file)) {
    fail(`MetricPill/SummaryPill fuera de excepcion: ${file}`);
  }
  if (/function format(Number|Date|Percent|DateTime)\s*\(/.test(content) && file.includes("src/components/dashboard")) {
    fail(`Formatter local simple en UI: ${file}`);
  }
}

const colorExceptions = new Set([
  "src/components/dashboard/campo-map.tsx",
  "src/components/dashboard/campo-sjp-inset.tsx",
  "src/components/dashboard/campo-sub-map-modal.tsx",
  "src/components/dashboard/fenograma-block-modal.tsx",
  "src/components/dashboard/programaciones-explorer.tsx",
  "src/config/programaciones-palettes.ts",
]);
for (const file of walk("src").filter((file) => /\.(ts|tsx)$/.test(file))) {
  const content = read(file);
  if (/(rgb\(|#[0-9a-fA-F]{3,8})/.test(content) && file.includes("dashboard") && !colorExceptions.has(file)) {
    fail(`Color hardcoded en dashboard fuera de excepcion: ${file}`);
  }
}

const accessControl = read("src/lib/access-control.ts");
const prefixes = Array.from(accessControl.matchAll(/pathnamePrefix:\s*"([^"]+)"/g)).map((match) => match[1]);
function routePathFromFile(file) {
  return `/${file
    .replace(/^src\/app\//, "")
    .replace(/\/route\.ts$/, "")
    .replace(/\([^)]*\)\//g, "")
    .replace(/\[[^\]]+\]/g, "x")}`;
}
function matchesPrefix(route, prefix) {
  return route === prefix || route.startsWith(`${prefix}/`);
}
for (const file of walk("src/app/api").filter((file) => file.endsWith("/route.ts"))) {
  const content = read(file);
  if (!content.includes("requireAuth(")) continue;
  const route = routePathFromFile(file);
  if (!prefixes.some((prefix) => matchesPrefix(route, prefix))) {
    fail(`API con requireAuth sin regla explicita: ${file} (${route})`);
  }
}

for (const file of walk("src/app/(dashboard)/dashboard").filter((file) => file.endsWith("/page.tsx"))) {
  if (file === "src/app/(dashboard)/dashboard/page.tsx") continue;
  const content = read(file);
  const isProtected = content.includes("requirePageAccess(") || content.includes("loadProtectedPageData(");
  const isPlaceholder = content.includes("ModulePlaceholder");
  if (!isProtected && !isPlaceholder) {
    fail(`Dashboard page sin acceso server-side ni placeholder: ${file}`);
  }
}

if (failures.length > 0) {
  console.error("Canon check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.info("Canon check passed.");
