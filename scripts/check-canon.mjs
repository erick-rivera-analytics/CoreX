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

const sourceFiles = walk("src").filter((file) => /\.(ts|tsx|md|mjs)$/.test(file));
const docsFiles = walk("docs").filter((file) => /\.md$/.test(file));
const tsFiles = walk("src").filter((file) => /\.(ts|tsx)$/.test(file));

const officialDocs = new Set([
  "docs/README.md",
  "docs/reuse-index.md",
  "docs/extender-modulos.md",
  "docs/module-contracts.md",
  "docs/ui-canon.md",
  "docs/chatbot.md",
  "docs/definition-of-done.md",
  "docs/despliegue.md",
  "docs/testing.md",
  "docs/security-ops.md",
  "docs/quality-baseline.md",
  "docs/gestion-postcosecha-clasificacion-en-blanco.md",
  "docs/gestion-calidad-punto-apertura.md",
  "docs/gestion-postcosecha-balanzas-process-engine.md",
  // Docs reclasificados a vigentes en Audit final preprod 2026-04-25:
  "docs/apis.md",
  "docs/datos.md",
  "docs/modulos.md",
  "docs/arquitectura.md",
  // Audits oficiales (vigentes; cada AUD-N entrega su entregable .md):
  "docs/audits/README.md",
  "docs/audits/AUD-1-ux-ui-canon.md",
  "docs/audits/AUD-2-arquitectura-modular.md",
  "docs/audits/AUD-3-security-api-rbac.md",
  "docs/audits/AUD-4-datos-sql-payloads.md",
  "docs/audits/AUD-5-performance-cache-optimization.md",
  "docs/audits/AUD-6-testing-qa-smoke.md",
  "docs/audits/AUD-7-despliegue-runtime-docker.md",
  "docs/audits/AUD-8-documentacion-dod-gobernanza.md",
  "docs/audits/AUD-9-auditoria-funcional-modulos.md",
  "docs/audits/AUD-10-pre-release-go-live.md",
  "docs/audits/AUD-11-cierre-tecnico-final.md",
  "docs/audits/AUD-12-react-doctor-knip-cleanup.md",
  "docs/audits/AUD-13-react-doctor-round-2.md",
  "docs/audits/AUD-14-react-doctor-round-3.md",
  "docs/audits/AUD-15-react-doctor-round-4.md",
]);

const legacyDocPrefix = "> LEGACY / reference only.";
const mojibakePattern = /(?:\u00C3.|\u00C2.|\u00E2..|\uFFFD)/;

for (const file of [...sourceFiles, "README.md", "CLAUDE.md", "AGENTS.md", ...docsFiles]) {
  if (fs.existsSync(path.join(root, file)) && mojibakePattern.test(read(file))) {
    fail(`Mojibake detectado en ${file}`);
  }
}

for (const file of docsFiles) {
  const content = read(file).trimStart();
  if (officialDocs.has(file)) {
    if (content.startsWith(legacyDocPrefix)) {
      fail(`Doc oficial marcado como legacy por error: ${file}`);
    }
    continue;
  }

  if (!content.startsWith(legacyDocPrefix)) {
    fail(`Doc historico sin marca legacy: ${file}`);
  }
}

const allowedDashboardFiles = new Set(["module-placeholder.tsx"]);

if (fs.existsSync(path.join(root, "src/components/ui"))) {
  fail("Directorio fantasma src/components/ui no debe existir");
}

if (fs.existsSync(path.join(root, "src/modules/shared"))) {
  fail("src/modules/shared es ambiguo; usar src/modules/core/server-page");
}

for (const file of walk("src/components/dashboard").filter((file) => file.endsWith(".tsx"))) {
  const name = path.basename(file);
  if (!allowedDashboardFiles.has(name)) {
    fail(`Archivo en legacy dashboard fuera del set permitido: ${file}`);
  }
}

const qualityBaseline = read("docs/quality-baseline.md");
for (const file of walk("src/components/dashboard").filter((file) => file.endsWith(".tsx"))) {
  const content = read(file);
  if (content.includes("TEMPORARY_SHIM") && !qualityBaseline.includes(path.basename(file))) {
    fail(`TEMPORARY_SHIM no listado en quality-baseline: ${file}`);
  }
}

// fenograma.ts re-exports SOLO tipos desde fenograma-types (Audit #1 Phase 0):
// fenograma-core sigue siendo `import "server-only"` y los tipos viven en
// fenograma-types para que client components puedan importarlos sin arrastrar
// el server-only chain.
const facadeContracts = new Map([
  ["src/lib/fenograma.ts", 'export type * from "@/lib/fenograma-types";'],
  ["src/lib/postcosecha-balanzas.ts", 'export * from "@/lib/postcosecha-balanzas-core";'],
]);

for (const [file, exportLine] of facadeContracts) {
  const content = read(file).trim();
  const lineCount = content.split(/\r?\n/).length;

  if (!content.includes("TEMPORARY_FACADE")) {
    fail(`Facade temporal sin marca TEMPORARY_FACADE: ${file}`);
  }

  if (!content.includes(exportLine)) {
    fail(`Facade temporal con contrato roto: ${file}`);
  }

  if (lineCount > 6) {
    fail(`Facade temporal crecio mas de lo permitido: ${file}`);
  }
}

const metricPillAllowed = new Set([
  "src/modules/fenograma/components/block-profile-modal.tsx",
  "src/modules/fenograma/components/block-profile-primitives.tsx",
]);

for (const file of tsFiles) {
  const content = read(file);

  if (/(MetricPill|SummaryPill)/.test(content) && !metricPillAllowed.has(file)) {
    fail(`MetricPill/SummaryPill fuera de excepcion: ${file}`);
  }

  if (
    /function (?:format(Number|Date|Percent|DateTime|DisplayDate)|fmt|fmtPct)\s*\(/.test(content)
    && (file.includes("src/components/dashboard") || file.includes("src/modules"))
  ) {
    fail(`Formatter local simple en UI: ${file}`);
  }

  if (/from\s+["']@\/shared\/lib\/fetch-json["']/.test(content)) {
    fail(`fetchJson debe importarse desde @/lib/fetch-json: ${file}`);
  }
}

for (const file of walk("src/shared").filter((candidate) => /\.(ts|tsx)$/.test(candidate))) {
  if (read(file).includes("@/components/")) {
    fail(`src/shared no puede importar desde src/components: ${file}`);
  }
}

const rootSpacingExceptions = new Set([
  "src/modules/fenograma/components/block-profile-modal.tsx",
  "src/modules/talento-humano/components/person-detail-sheet.tsx",
  "src/modules/users/components/users-page.tsx",
]);

for (const file of walk("src/modules").filter((file) => /\.(ts|tsx)$/.test(file))) {
  if (rootSpacingExceptions.has(file)) continue;
  if (/<div className="space-y-6">/.test(read(file))) {
    fail(`Root explorer/page con space-y-6 fuera de excepcion: ${file}`);
  }
}

for (const file of walk("src/modules").filter((file) => /\.(ts|tsx)$/.test(file))) {
  const content = read(file);
  if (content.includes(`from "@/components/dashboard/`)) {
    fail(`Import desde legacy dashboard fuera de allowlist temporal: ${file}`);
  }
}

const colorExceptions = new Set([
  "src/modules/campo/components/campo-map.tsx",
  "src/modules/campo/components/campo-sjp-inset.tsx",
  "src/modules/campo/components/campo-sub-map-modal.tsx",
  "src/modules/fenograma/components/block-profile-modal.tsx",
  "src/modules/postcosecha/components/solver-export-pdf-button.tsx",
  "src/modules/programaciones/components/programaciones-explorer.tsx",
  "src/config/programaciones-palettes.ts",
]);

for (const file of tsFiles) {
  const content = read(file);
  if (/(rgb\(|#[0-9a-fA-F]{3,8})/.test(content) && file.includes("/components/") && !colorExceptions.has(file)) {
    fail(`Color hardcoded en componentes fuera de excepcion: ${file}`);
  }
}

const hugeFileAllowlist = new Set([
  "src/modules/campo/components/campo-map.tsx",
  "src/modules/campo/components/campo-sub-map-modal.tsx",
  "src/modules/productividad/components/person-hours-overlay.tsx",
  "src/modules/fenograma/components/person-medical-panel.tsx",
  "src/lib/salud.ts",
  "src/lib/fenograma-core.ts",
  "src/lib/postcosecha-balanzas-core.ts",
  "src/lib/postcosecha-clasificacion-en-blanco.ts",
  "src/lib/talento-humano.ts",
  "src/modules/campo/components/campo-explorer.tsx",
  "src/modules/comparacion/components/comparison-explorer.tsx",
  "src/modules/fenograma/components/block-profile-modal.tsx",
  "src/modules/fenograma/components/fenograma-pivot-table.tsx",
  "src/modules/fenograma/components/harvest-curve-panel.tsx",
  "src/modules/postcosecha/components/balanzas-explorer.tsx",
  "src/modules/postcosecha/components/skus-explorer.tsx",
  "src/modules/postcosecha/hooks/use-clasificacion-en-blanco-explorer.ts",
  "src/modules/productividad/components/productividad-explorer.tsx",
  "src/modules/programaciones/components/programaciones-explorer.tsx",
  "src/modules/users/components/users-page.tsx",
]);

for (const file of tsFiles) {
  const lineCount = read(file).split(/\r?\n/).length;
  const maxLines = file.includes("src/lib/") ? 700 : 350;
  if (lineCount > maxLines && !hugeFileAllowlist.has(file)) {
    fail(`Archivo excede limite estructural (${lineCount} > ${maxLines}): ${file}`);
  }
}

const allowedCrossModuleImports = new Set([
  "src/modules/campo/components/campo-explorer.tsx->fenograma",
  "src/modules/mortality/components/mortality-explorer.tsx->fenograma",
  "src/modules/productividad/components/productividad-explorer.tsx->fenograma",
  "src/modules/productividad/components/person-hours-overlay.tsx->fenograma",
  "src/modules/fenograma/components/block-profile-modal.tsx->mortality",
]);

for (const file of walk("src/modules").filter((candidate) => /\.(ts|tsx)$/.test(candidate))) {
  const content = read(file);
  const currentModuleMatch = file.match(/^src\/modules\/([^/]+)\//);
  const currentModule = currentModuleMatch?.[1];

  if (!currentModule) continue;

  for (const match of content.matchAll(/from\s+["']@\/modules\/([^/]+)\//g)) {
    const importedModule = match[1];
    if (importedModule === currentModule) continue;

    const key = `${file}->${importedModule}`;
    if (!allowedCrossModuleImports.has(key)) {
      fail(`Import cruzado entre modulos fuera de excepcion: ${file} -> ${importedModule}`);
    }
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
