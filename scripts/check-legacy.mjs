#!/usr/bin/env node
/**
 * legacy:check — falla cuando encuentra patrones legacy prohibidos en código
 * que ya fue migrado a componentes canónicos.
 *
 * Reglas:
 *   - severidad ERROR: bloquea producción
 *   - severidad WARN:  reporta pero no bloquea (pendiente de migrar)
 *
 * Uso:
 *   node scripts/check-legacy.mjs
 *
 * Cada regla retorna `{ file, line, snippet, expected }`.
 *
 * Cuando se introduzca una nueva migración canónica, agregar regla aquí
 * para evitar regresiones.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd());
const SRC_MODULES = "src/modules";
const SRC_SHARED = "src/shared";

let totalErrors = 0;
let totalWarnings = 0;
const results = [];

function walk(dirRel) {
  const dir = path.join(root, dirRel);
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      // Excluir carpetas archivadas
      if (entry.name === "deprecated" || entry.name === "__legacy__") continue;
      files.push(...walk(rel));
    } else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
      files.push(rel);
    }
  }
  return files;
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function reportLine(severity, rule, file, lineNumber, snippet, expected) {
  results.push({ severity, rule, file, lineNumber, snippet: snippet.trim().slice(0, 140), expected });
  if (severity === "ERROR") totalErrors += 1;
  else totalWarnings += 1;
}

function scan(rel, rules) {
  const content = read(rel);
  const lines = content.split(/\r?\n/);
  for (const rule of rules) {
    if (rule.skipFile && rule.skipFile.test(rel)) continue;
    if (rule.scopes && !rule.scopes.some((scope) => rel.startsWith(scope))) continue;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (rule.pattern.test(line)) {
        reportLine(rule.severity, rule.name, rel, i + 1, line, rule.expected);
      }
    }
  }
}

const rules = [
  // ── Bloque C — ficha persona única ───────────────────────────────────────
  {
    name: "person-detail-sheet-import",
    severity: "ERROR",
    pattern: /from ["']@?\/?modules\/talento-humano\/components\/person-detail-sheet["']/,
    scopes: [SRC_MODULES, SRC_SHARED, "src/app"],
    expected: "Importar PersonProfileDialog desde @/shared/overlays/person-profile-dialog",
  },
  {
    name: "person-hours-overlay-import",
    severity: "ERROR",
    pattern: /from ["']@?\/?modules\/productividad\/components\/person-hours-overlay["']/,
    scopes: [SRC_MODULES, SRC_SHARED, "src/app"],
    expected: "Importar PersonProfileDialog desde @/shared/overlays/person-profile-dialog",
  },
  {
    name: "person-detail-sheet-component",
    severity: "ERROR",
    pattern: /\bPersonDetailSheet\b/,
    skipFile: /shared\/overlays\/person-profile-dialog\.tsx|shared\/overlays\/person-profile-talento-info\.tsx/,
    scopes: [SRC_MODULES, SRC_SHARED, "src/app"],
    expected: "Reemplazar por PersonProfileDialog (sourceContext.module = 'talento')",
  },
  {
    name: "person-hours-overlay-component",
    severity: "ERROR",
    pattern: /\bPersonHoursOverlay\b/,
    skipFile: /shared\/overlays\/person-profile-dialog\.tsx/,
    scopes: [SRC_MODULES, SRC_SHARED, "src/app"],
    expected: "Reemplazar por PersonProfileDialog (sourceContext.module = 'productividad' | 'fenograma')",
  },

  // ── Bloque A — triggers en celdas de tabla ──────────────────────────────
  {
    name: "span-onclick",
    severity: "ERROR",
    pattern: /<span\b[^>]*\bonClick=/,
    scopes: [SRC_MODULES],
    expected: "Usar InteractiveCell (variant link/badge/underline-text) o un <button>",
  },
  {
    name: "div-onclick",
    severity: "ERROR",
    pattern: /<div\b[^>]*\bonClick=/,
    scopes: [SRC_MODULES],
    skipFile: /balanzas-process-viewer\.tsx|process-viewer-overlay\.tsx|campo-/,
    expected: "Usar InteractiveCell, <button>, o ClickableTableRow para filas completas",
  },
  {
    name: "td-onclick",
    severity: "ERROR",
    pattern: /<td\b[^>]*\bonClick=/,
    scopes: [SRC_MODULES],
    expected: "Usar InteractiveCell dentro de la celda",
  },

  // ── Bloque D — balanzas: tabla plana / gráfico ──────────────────────────
  {
    name: "balanzas-detail-flat-table",
    severity: "ERROR",
    pattern: /<table\b/,
    scopes: ["src/modules/postcosecha/components/balanzas-node-detail-sheet.tsx"],
    expected: "Usar BalanzasExpandableTable en lugar de tabla plana",
  },
  {
    name: "balanzas-detail-chart",
    severity: "ERROR",
    pattern: /\b(ResponsiveContainer|LineChart|BarChart|AreaChart|PieChart|RadarChart|ComposedChart)\b/,
    scopes: ["src/modules/postcosecha/components/balanzas-node-detail-sheet.tsx"],
    expected: "El detalle de balanzas no debe contener charts (PDF Audit #3 Bloque D)",
  },

  // ── createPortal directo en módulos ─────────────────────────────────────
  {
    name: "createPortal-modules",
    severity: "ERROR",
    pattern: /\bcreatePortal\b/,
    scopes: [SRC_MODULES],
    expected: "Usar DialogShell / SheetShell / componentes canónicos en lugar de createPortal directo",
  },

  // ── <select> nativo en archivos donde se migró a SingleSelectField ──────
  {
    name: "native-select-migrated",
    severity: "ERROR",
    pattern: /<select\b/,
    scopes: [
      "src/modules/my-work/components/task-form-dialog.tsx",
      "src/modules/my-work/components/event-form-dialog.tsx",
      "src/modules/fenograma/components/block-profile-modal.tsx",
      "src/modules/postcosecha/components/solver-form.tsx",
      "src/modules/postcosecha/components/solver-weight-editor-overlay.tsx",
    ],
    expected: "Usar SingleSelectField de @/shared/filters/single-select-field",
  },

  // ── z-index legacy con valores arbitrarios — WARN (excepción Leaflet) ──
  {
    name: "legacy-zindex-700-1100",
    severity: "WARN",
    pattern: /z-\[(700|800|900|1100)\]/,
    scopes: [SRC_MODULES],
    skipFile: /campo\//,
    expected: "Usar var(--z-modal-primary|--z-modal-secondary|--z-dropdown|--z-map-overlay)",
  },
  {
    name: "legacy-zindex-50",
    severity: "WARN",
    pattern: /\bz-\[50\]/,
    scopes: [SRC_MODULES],
    expected: "Migrar a var(--z-modal-primary) o var(--z-modal-secondary)",
  },

  // ── Bloque B — tablas jerárquicas: deuda técnica estructural ───────────
  // La inconsistencia VISUAL del PDF (PH05–PH06: fila persona divergente
  // entre productividad y horas-cama) está resuelta: ambas usan el mismo
  // InteractiveCell variant="link" + abren la misma PersonProfileDialog.
  // La migración del componente base (CycleDetailRows / HoursCamaOverlay
  // → ExpandableTreeTable) es deuda técnica que NO afecta el affordance
  // visible al usuario. Por eso WARN (registrar pendiente), no ERROR.
  {
    name: "cycle-detail-rows-structural-debt",
    severity: "WARN",
    pattern: /\bCycleDetailRows\b/,
    scopes: [SRC_MODULES],
    expected: "Migrar a ExpandableTreeTable (deuda estructural — visual ya unificado vía InteractiveCell)",
  },
  {
    name: "hours-cama-overlay-structural-debt",
    severity: "WARN",
    pattern: /\bHoursCamaOverlay\b/,
    scopes: [SRC_MODULES],
    expected: "Migrar a ExpandableTreeTable (deuda estructural — visual ya unificado vía InteractiveCell)",
  },

  // ── Bloque E — Audit final 2026-04-25: Frankenstein guards ──────────────
  // Estos componentes fueron consolidados en `PersonProfileInfoCanon`.
  // Reintroducirlos rompe la unificación visual de la ficha del personal.
  {
    name: "person-hours-info-section-legacy",
    severity: "ERROR",
    pattern: /\bPersonHoursInfoSection\b/,
    skipFile: /person-profile-info-canon\.tsx/,
    scopes: [SRC_MODULES, SRC_SHARED, "src/app"],
    expected: "Reemplazar por PersonProfileInfoCanon (sourceContext-agnostic)",
  },
  {
    name: "person-profile-talento-info-legacy",
    severity: "ERROR",
    pattern: /\bPersonProfileTalentoInfoSection\b/,
    skipFile: /person-profile-info-canon\.tsx|person-profile-talento-info\.tsx/,
    scopes: [SRC_MODULES, SRC_SHARED, "src/app"],
    expected: "Reemplazar por PersonProfileInfoCanon (sourceContext-agnostic)",
  },
  // El tab Rendimiento debe mostrar datos en cualquier sourceContext.
  // El literal "Sin contexto de ciclo" estaba bloqueando talento/composicion-laboral.
  {
    name: "sin-contexto-ciclo-legacy",
    severity: "ERROR",
    pattern: /Sin contexto de ciclo/,
    scopes: [SRC_MODULES, SRC_SHARED],
    expected: "El tab Rendimiento debe mostrar datos en cualquier sourceContext (incluído talento)",
  },
  // BPMN preclasif debe apuntar a tasks `_Pre_GV` (no `_Pre_Directo`).
  // Decisión confirmada en Audit final 2026-04-25.
  {
    name: "balanzas-preclasif-pre-directo",
    severity: "ERROR",
    pattern: /Task_[A-Za-z0-9]+_Pre_Directo/,
    scopes: ["src/lib/postcosecha-balanzas-core.ts"],
    expected: "preclasif-* debe apuntar a Task_*_Pre_GV (Audit final 2026-04-25)",
  },
];

const allFiles = [...walk(SRC_MODULES), ...walk(SRC_SHARED), ...walk("src/app")];

for (const file of allFiles) {
  scan(file, rules);
}

// Reportar
if (results.length === 0) {
  console.log("legacy:check passed (0 issues)");
  process.exit(0);
}

const errors = results.filter((r) => r.severity === "ERROR");
const warnings = results.filter((r) => r.severity === "WARN");

if (warnings.length > 0) {
  console.log(`\n⚠ legacy:check warnings (${warnings.length}):\n`);
  for (const w of warnings) {
    console.log(`  [${w.rule}] ${w.file}:${w.lineNumber}`);
    console.log(`     ${w.snippet}`);
    console.log(`     → ${w.expected}\n`);
  }
}

if (errors.length > 0) {
  console.log(`\n✗ legacy:check errors (${errors.length}):\n`);
  for (const e of errors) {
    console.log(`  [${e.rule}] ${e.file}:${e.lineNumber}`);
    console.log(`     ${e.snippet}`);
    console.log(`     → ${e.expected}\n`);
  }
  console.log(`legacy:check FAILED (${errors.length} error${errors.length === 1 ? "" : "s"}, ${warnings.length} warning${warnings.length === 1 ? "" : "s"})\n`);
  process.exit(1);
}

console.log(`legacy:check passed (${warnings.length} warning${warnings.length === 1 ? "" : "s"})\n`);
process.exit(0);
