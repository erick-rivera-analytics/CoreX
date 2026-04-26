# AUD 12 — React Doctor + Knip Cleanup

## 1. Contexto

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-26 |
| Ruta local | `C:\Users\erick.rivera\Desktop\CoreX\corex_v4` |
| Rama | `main` |
| Worktrees | 1 (principal) |
| `git status --short` inicial | clean |
| Commit inicial | `c50c8c2` (cierre AUD 11) |
| Commit final | (anota tras commit AUD 12) |
| Origen | Reporte react-doctor en `C:\Users\erick.rivera\AppData\Local\Temp\react-doctor-bfde35a8-c85f-462e-b334-00b09adf3403` (23 archivos hallazgos, 1 ERROR + ~280 warnings) |

**Naturaleza:** Auditoría no invasiva post-AUD-11 que cierra deuda menor accionable detectada por `react-doctor` y `knip`. Complementa `CIERRE OK PARA PRODUCCIÓN` de AUD 11 sin alterar comportamiento.

---

## 2. Resumen ejecutivo

| Fix aplicado | Severidad | Categoría |
|--------------|-----------|-----------|
| Derived state useEffect → store-prev-during-render pattern | **ERROR** | State & Effects |
| 2 `autoFocus` removidos | warning | Accessibility |
| 1 `useMemo` trivial removido | warning | Performance |
| Default `[]` movido a constante module-level | warning | Performance |
| `.map().filter(Boolean)` → `.flatMap()` | warning | Performance |
| 5 textos `text-[9px]` → `text-[11px]` | warning | Accessibility |
| Gradient text en login → solid color | warning | Architecture |
| 5 scripts dead code eliminados | warning | Dead Code |
| Duplicate export `BAR_COLORS\|TALENTO_COLORS` consolidado a `BAR_COLORS` | warning | Dead Code |
| 2 archivos huérfanos my-account eliminados | warning | Dead Code |

**Total: 1 ERROR cerrado + 9 categorías de warnings cerradas.**

---

## 3. Tier 1 — Cambios aplicados

### 3.1 ERROR derived-state-effect (cerrado)

**Archivo:** `src/shared/forms/search-input.tsx`

**Antes:**
```tsx
const [internal, setInternal] = useState(value);
useEffect(() => { setInternal(value); }, [value]);  // anti-pattern
```

**Después:**
```tsx
const [internal, setInternal] = useState(value);
const [prevValue, setPrevValue] = useState(value);
if (prevValue !== value) {
  setPrevValue(value);
  setInternal(value);  // sincroniza durante render, no en effect
}
```

**Pattern oficial React 19:** ["storing-information-from-previous-renders"](https://react.dev/reference/react/useState#storing-information-from-previous-renders).

### 3.2 autoFocus removido (a11y)

| Archivo | Cambio |
|---------|--------|
| `src/shared/forms/search-input.tsx` | Removida prop `autoFocus` del type + atributo (0 consumidores la usaban) |
| `src/modules/talento-humano/components/person-list-modal.tsx:49` | Removido `autoFocus` del `<Input>` del search modal |

### 3.3 useMemo trivial removido

**Archivo:** `src/shared/tables/expandable-tree-table.tsx:190`

```tsx
// ANTES
const visibleColumns = useMemo(() => columns, [columns]);

// DESPUÉS
const visibleColumns = columns;  // overhead de useMemo > beneficio
```

Removido también import `useMemo` del archivo (ya no se usa).

### 3.4 Default array module-level

**Archivo:** `src/modules/programaciones/components/programaciones-explorer.tsx:206`

```tsx
// ANTES — nuevo array cada render
function ProgramacionesExplorer({ initialData = [] }: Props) { ... }

// DESPUÉS — referencia estable
const EMPTY_RECORDS: ProgramacionRecord[] = [];
function ProgramacionesExplorer({ initialData = EMPTY_RECORDS }: Props) { ... }
```

### 3.5 .map().filter() → .flatMap()

**Archivo:** `src/modules/programaciones/components/programaciones-explorer.tsx:248`

```tsx
// ANTES
allRecords.map((r) => r.areaId).filter(Boolean) as string[]

// DESPUÉS — single pass, sin cast inseguro
allRecords.flatMap((r) => (r.areaId ? [r.areaId] : []))
```

### 3.6 Tiny text 9px → 11px

**Archivo:** `src/modules/programaciones/components/programaciones-explorer.tsx`

2 ocurrencias de `text-[9px]` actualizadas a `text-[11px]` (línea 360 + 469). Mejora legibilidad WCAG sin romper layout Gantt-like denso.

### 3.7 Gradient text en login

**Archivo:** `src/app/login/page.tsx:74`

```tsx
// ANTES
className="text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/75 bg-clip-text text-transparent"

// DESPUÉS
className="text-4xl font-bold tracking-tight text-foreground"
```

Solid color del token. Mejora legibilidad y consistencia con el design system.

### 3.8 Scripts dead code eliminados

Validados por agent Explore con grep en todo el repo (incluido Dockerfile, package.json, docs):

| Archivo | Status verificación |
|---------|---------------------|
| `test-query.mjs` | 0 referencias |
| `scripts/convert-rasters.mjs` | 0 referencias |
| `scripts/convert-shapefile.mjs` | 0 referencias |
| `scripts/load-medical-exams.mjs` | 0 referencias |
| `scripts/manage-users.js` | 0 referencias |

Todos eliminados con `git rm`. **NOTA:** `scripts/validate-runtime-env.mjs` se mantiene — referenciado en `Dockerfile:56,68` (CMD).

### 3.9 Duplicate export consolidado

**Archivo:** `src/modules/talento-humano/components/talento-view-utils.ts`

```tsx
// ANTES
export const BAR_COLORS = [...];
export const TALENTO_COLORS = BAR_COLORS;  // alias detectado por knip como duplicado

// DESPUÉS
export const BAR_COLORS = [...];  // único nombre canónico
```

Actualizados consumidores:
- `src/modules/talento-humano/components/shared.tsx` (re-export)
- `src/modules/talento-humano/components/talento-charts.tsx` (2 usos)

### 3.10 Huérfanos my-account eliminados (Tier 2)

Verificados con grep como huérfanos completos (0 referencias en todo `src/`):

| Archivo | Líneas | Status |
|---------|--------|--------|
| `src/modules/my-account/components/profile-summary-card.tsx` | (file) | eliminado |
| `src/modules/my-account/hooks/use-my-profile.ts` | (file) | eliminado |

Carpeta `src/modules/my-account/hooks/` eliminada (quedó vacía después del rm).

---

## 4. Tier 3 — Documentado como deuda NO bloqueante (NO aplicado)

Estos hallazgos requieren refactors mayores o son falsos positivos. No se aplicaron en este audit y siguen en `quality-baseline.md` como deuda controlada.

| Hallazgo | Razón |
|----------|-------|
| 5 componentes gigantes (>400 líneas): ProgramacionesExplorer 603, BlockProfileModal, SkusExplorer, CampoExplorer, ComparisonExplorer | Deuda existente AUD 1/2/9 |
| 6 z-index `z-420` en Leaflet (campo) | **Excepción documentada** en `ui-canon.md` AUD 2 |
| 4 click sin keyboard handler en `dialog-shell.tsx`, `sheet-shell.tsx`, `my-work-calendar.tsx` | Backdrops de overlays son intencionalmente click-to-close |
| 4 static element interactions en mismos archivos | Mismo motivo |
| 7 components con muchos useState (refactor a useReducer) | Refactor de estado, no aporta valor inmediato |
| 1 cascading setState en multi-select-field | Refactor de filter UI con riesgo de regresión |
| 5 useEffect simulando event handler (skus, fenograma, comparacion ×2, mortality) | Review puntual case-by-case, refactor menor |
| 3 useState desde prop (theme-provider, profile-preferences-form, notification-preferences-form) | Pattern controlled-uncontrolled válido para forms con submit explícito |
| 6 imports recharts no lazy | Algunos charts ya son lazy (Campo, Mortality); resto consume recharts ya cargado por otro chart |
| 80 unused exports + 126 unused types (knip) | Mostly API pública de barrel files (`index.ts`), tipos exportados como contrato |
| 12 barrel `index.ts` no importados directamente | Documentados en `reuse-index.md` como API pública canon |
| 17 componentes shared "no usados" | Documentados en `reuse-index.md` como reusables canon — borrarlos rompería el contrato |
| 2 inline styles exhaustivos en programaciones | Refactor a CSS class del módulo programaciones, no urgente |
| 9 array index as key (resto, no tocados) | Listas estáticas (sidebar nav, breadcrumb, balanzas svg sub-rows constantes) |

---

## 5. Archivos modificados

```
edit    src/shared/forms/search-input.tsx                                       (3 fixes: derived-state, autoFocus prop, autoFocus attr)
edit    src/modules/talento-humano/components/person-list-modal.tsx             (1 fix: autoFocus)
edit    src/shared/tables/expandable-tree-table.tsx                             (1 fix: useMemo trivial)
edit    src/modules/programaciones/components/programaciones-explorer.tsx       (3 fixes: default [], flatMap, 2× text-[9px])
edit    src/app/login/page.tsx                                                  (1 fix: gradient text)
edit    src/modules/talento-humano/components/talento-view-utils.ts             (1 fix: removed TALENTO_COLORS alias)
edit    src/modules/talento-humano/components/shared.tsx                        (sync: removed TALENTO_COLORS export)
edit    src/modules/talento-humano/components/talento-charts.tsx                (sync: TALENTO_COLORS → BAR_COLORS, removed dup import)
delete  test-query.mjs
delete  scripts/convert-rasters.mjs
delete  scripts/convert-shapefile.mjs
delete  scripts/load-medical-exams.mjs
delete  scripts/manage-users.js
delete  src/modules/my-account/components/profile-summary-card.tsx
delete  src/modules/my-account/hooks/use-my-profile.ts
delete  src/modules/my-account/hooks/                                           (carpeta vacía)
new     docs/audits/AUD-12-react-doctor-knip-cleanup.md                         (este archivo)
edit    scripts/check-canon.mjs                                                 (AUD-12 a officialDocs)
edit    docs/audits/README.md                                                   (fila AUD 12)
```

---

## 6. Validación final

### `npm run typecheck`
✅ verde (0 errors)

### `npm run lint`
⚠️ **9 warnings preexistentes** (mismo número que baseline; no se introdujeron warnings nuevos)

### `npm run test`
✅ **16 archivos / 79/79 tests passing**

### `npm run canon:check`
✅ Canon + Docs verde

### `npm run legacy:check`
✅ passed (6 warnings preexistentes)

### `npm run build`
✅ verde

---

## 7. Riesgos residuales

**0 riesgos introducidos por AUD 12.** Todos los cambios son mecánicos sin alteración de lógica de negocio.

Riesgos heredados de AUD 1–11 siguen vigentes y documentados:
- Deuda monolitos (fenograma-core 2346, block-profile-modal 1791, balanzas-core 933)
- Refactor productividad CycleDetailRows
- Smoke visual run-time pendiente
- Docker compose local pendiente

Ver consolidación en [`AUD-10-pre-release-go-live.md`](./AUD-10-pre-release-go-live.md) §11.

---

## 8. Criterio de cierre AUD 12

- [x] main confirmado
- [x] cero worktrees
- [x] 1 ERROR cerrado (derived-state-effect)
- [x] 2 autoFocus removidos
- [x] useMemo trivial removido
- [x] default `[]` module-level
- [x] flatMap aplicado
- [x] tiny-text actualizado a 11px
- [x] gradient text reemplazado
- [x] 5 scripts dead eliminados
- [x] duplicate export consolidado
- [x] 2 huérfanos my-account eliminados
- [x] npm run typecheck verde
- [x] npm run test verde (79/79)
- [x] npm run canon:check verde
- [x] npm run lint sin nuevos errors
- [x] npm run build verde
- [x] doc AUD-12 actualizado

**AUD 12 cerrado. Repo más limpio sin alteración de comportamiento. Mantiene `CIERRE OK PARA PRODUCCIÓN` de AUD 11.**
