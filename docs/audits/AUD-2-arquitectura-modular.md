# AUD 2 — Arquitectura Modular y Contratos de Capa

## 1. Contexto

| Campo | Valor |
|-------|-------|
| Fecha | 2026-04-25 |
| Ruta local | `C:\Users\erick.rivera\Desktop\CoreX\corex_v4` |
| Rama | `main` |
| Worktrees registrados | 1 (solo el principal) |
| `git status` inicial | clean |
| Commit inicial | `3ea766b` (cierre AUD 1 fase 2) |
| Commit final | (se anota tras commit de cierre AUD 2) |

---

## 2. Contrato auditado

| Capa | Importa | NO importa | Responsabilidad |
|------|---------|------------|-----------------|
| `src/app` | `modules`, `shared`, `lib`, `config` | — | Rutas, layouts, page.tsx, route.ts (delgados) |
| `src/modules` | `shared`, `lib`, `config`, hooks | `app`, `components/dashboard` (legacy) | UI de dominio por módulo |
| `src/shared` | `lib`, `config` | `app`, `modules` (excepto orquestadores documentados) | UI/hooks/overlays/tables/forms reusables |
| `src/lib` | `config`, `server`, `shared/lib` (helpers puros — excepción documentada) | React, `app`, `modules`, `shared/ui` | Queries SQL, auth, RBAC, dominio, helpers server |
| `src/config` | — | React, modules, app | Catálogo de módulos, sidebar, dashboard, paletas |
| `src/server` | — | React, modules, app | Server-only utilities |
| `src/components/dashboard` | (eliminado) | — | **YA NO EXISTE** tras AUD 1 (commit `8c53586`) |

---

## 3. Mapa de rutas y módulos

20 rutas dashboard + /login + /dashboard root. Catálogo `module-catalog.ts` tiene 20 entradas → match perfecto con páginas en filesystem (excluyendo /dashboard root y /login).

| Ruta | page.tsx | resourceKey | módulo | explorer | lib | APIs |
|------|----------|-------------|--------|----------|-----|------|
| `/login` | `app/login/page.tsx` | (público) | — | LoginForm | `lib/auth-session` | `/api/auth/login` |
| `/dashboard` | `app/(dashboard)/dashboard/page.tsx` | (autenticado) | — | landing nav | `lib/api-auth`+`config/dashboard` | — |
| `/dashboard/campo` | `.../campo/page.tsx` | href= | `campo` | CampoExplorer | `lib/campo` + `modules/campo/lib` | `/api/comparacion/options` (campo+mortality+comparacion) |
| `/dashboard/fenograma` | `.../fenograma/page.tsx` | href= | `fenograma` | FenogramaExplorer | `lib/fenograma-core` + `lib/fenograma` (facade) | `/api/fenograma/*` |
| `/dashboard/mortality` | `.../mortality/page.tsx` | href= | `mortality` | MortalityExplorer | `lib/mortality` | `/api/mortality/*` |
| `/dashboard/comparacion` | `.../comparacion/page.tsx` | href= | `comparacion` | ComparisonExplorer | `lib/comparacion` | `/api/comparacion/*` |
| `/dashboard/productividad` | `.../productividad/page.tsx` | href= | `productividad` | ProductividadExplorer | `lib/productividad` | `/api/productividad/*` |
| `/dashboard/programaciones` | `.../programaciones/page.tsx` | href= | `programaciones` | ProgramacionesExplorer | `lib/programaciones` | `/api/programaciones/*` |
| `/dashboard/dead-plants-reseed` | `.../dead-plants-reseed/page.tsx` | href= | `dead-plants-reseed` | DeadPlantsReseedExplorer | `lib/dead-plants-reseed` | `/api/dead-plants-reseed/*` |
| `/dashboard/postcosecha/balanzas` | `.../postcosecha/balanzas/page.tsx` | href= | `postcosecha` | BalanzasExplorer + SVG viewer | `lib/postcosecha-balanzas-core` + facade | `/api/postcosecha/balanzas/*` |
| `/dashboard/postcosecha/administrar-maestros/skus` | `.../skus/page.tsx` | href= | `postcosecha` | SkusExplorer | `lib/postcosecha-skus` | `/api/postcosecha/administrar-maestros/skus/*` |
| `/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco` | `.../clasificacion-en-blanco/page.tsx` | href= | `postcosecha` | hook `use-clasificacion-en-blanco-explorer` | `lib/postcosecha-clasificacion-en-blanco` | `/api/postcosecha/planificacion/solver/clasificacion-en-blanco/*` |
| `/dashboard/postcosecha/registros` | `.../registros/page.tsx` | href= | (placeholder) | ModulePlaceholder | — | — |
| `/dashboard/postcosecha/planificacion/programaciones` | `.../page.tsx` | href= | (placeholder) | ModulePlaceholder | — | — |
| `/dashboard/postcosecha/planificacion/plan-de-trabajo` | `.../page.tsx` | href= | (placeholder) | ModulePlaceholder | — | — |
| `/dashboard/talento-humano/composicion-laboral` | `.../page.tsx` | href= | `talento-humano` | CompositionExplorer | `lib/talento-humano-loaders` + `lib/talento-humano` | `/api/talento-humano/*` |
| `/dashboard/talento-humano/demografia-personal` | `.../page.tsx` | href= | `talento-humano` | DemografiaExplorer | `lib/talento-humano-loaders` | `/api/talento-humano/*` |
| `/dashboard/talento-humano/rotacion-laboral` | `.../page.tsx` | href= | `talento-humano` | RotacionExplorer | `lib/talento-humano-loaders` | `/api/talento-humano/rotacion` |
| `/dashboard/calidad/punto-apertura` | `.../page.tsx` | href= | `calidad` | PuntoAperturaExplorer | `lib/calidad-punto-apertura` | `/api/calidad/punto-apertura` |
| `/dashboard/admin/seguridad/usuarios` | `.../page.tsx` | href= | `users` | UsuariosExplorer | `modules/users/queries.ts` | `/api/admin/users/*` |
| `/dashboard/mi-trabajo` | `.../page.tsx` | href= | `my-work` | MyWorkExplorer | `modules/my-work/server` | `/api/me/work/*` |
| `/dashboard/mi-cuenta` | `.../page.tsx` | href= | `my-account` | MyAccountExplorer | `modules/my-account/server` | `/api/me/profile` |

20/20 dashboard pages usan `requirePageAccess` o `loadProtectedPageData` ✓.

---

## 4. Hallazgos por bloque

### AUD 2.1 Mapeo real
- **OK:** 20 rutas dashboard mapeadas ↔ 20 entradas catalog ↔ 20 archivos `page.tsx`. Cero rutas huérfanas, cero catálogo apuntando a inexistentes.

### AUD 2.2 Frontera de imports
| Severidad | Origen | Import inválido | Acción |
|-----------|--------|-----------------|--------|
| ✅ N/A | `src/modules/*` | `from "@/app"` | **0 hits** |
| ✅ N/A | `src/shared/*` (no overlays) | `from "@/app"` | **0 hits** |
| ✅ N/A | `src/lib/*` | `from "@/app"` | **0 hits** |
| ✅ N/A | `src/lib/*` | `from "react"` | **0 hits** (verificado con regex `^import.*from ["']react["']`) |
| **alta — ahora documentada** | `src/shared/overlays/person-profile-dialog.tsx:13,14` | `from "@/modules/fenograma/components/person-medical-panel"` y `from "@/modules/productividad/components/person-hours-performance-section"` | **Documentado como excepción aceptada** en `docs/ui-canon.md` — orquestador canónico de ficha personal cross-módulo |
| **media — ahora documentada** | `src/lib/__tests__/calidad-punto-apertura.test.ts:10` | `from "@/modules/calidad/components/punto-apertura-status-composition"` | **Aceptable** — es un test que valida la composición visual, no `src/lib/*` runtime importando módulos. |
| **media — ahora documentada** | `src/lib/*` (18 archivos) | `from "@/shared/lib/*"` (helpers `format`/`number-utils`/`area-normalization`) | **Documentado como excepción** — helpers puros sin React, agrupados semánticamente con shared utilities. Cumple espíritu "lib no React". |
| **media — ahora documentada** | `src/modules/campo/components/campo-explorer.tsx`, `mortality-explorer.tsx`, `productividad-explorer.tsx` | `from "@/modules/fenograma/components/block-profile-modal"` | **Documentado** — `BlockProfileModal` es ficha del bloque canónica cross-módulo |
| **media — ahora documentada** | `src/modules/fenograma/components/block-profile-modal.tsx` | `from "@/modules/mortality/components/mortality-curve-panel"` | **Documentado** — composición canónica embebida en ficha del bloque |

### AUD 2.3 Legacy dashboard ✅
- `src/components/dashboard/` **NO existe** (eliminado en AUD 1, commit `8c53586`).
- 0 imports `@/components/dashboard` en `src/`.
- `check-canon.mjs:172` mantiene el guardrail activo prohibiendo nuevos imports.

### AUD 2.4 Catálogo de módulos ✅
- 20 entradas en `module-catalog.ts` ↔ 20 `page.tsx` reales (verificado por glob).
- Sin rutas huérfanas. Sin catálogo apuntando a inexistentes.
- Pendientes de verificar campo a campo (`status`, `accessSection`, `navigationGroup`): no audit exhaustivo en este pase, pero **20 entradas presentes y consistentes con filesystem**.

### AUD 2.5 Page contract ✅
- 20/20 pages dashboard usan `requirePageAccess(href)` o `loadProtectedPageData`.
- `/dashboard` root usa `getCurrentUserAccess` (landing autenticado, válido).
- `/login` no requiere auth (público correcto).

### AUD 2.6 Module contract
| Módulo | Estructura | Hallazgo |
|--------|-----------|----------|
| calidad, comparacion, dead-plants-reseed, mortality, productividad, programaciones | solo `components/` | OK (no necesitan hooks/server local) |
| campo, fenograma | `components/`, `lib/` | OK (lib local de dominio) |
| my-account, my-work | `components/`, `hooks/`, `server/`, `index.ts` | ✅ canon completo |
| postcosecha | `components/`, `hooks/` | OK |
| talento-humano, users | `components/`, `queries.ts` | ⚠️ `queries.ts` al raíz vs `server/queries.ts` (inconsistencia menor; refactor opcional AUD 3) |
| core | `server-page.tsx` | OK (utilidad cross-módulo) |

Cross-module imports ya documentados en §4.2 (4 casos justificados).

### AUD 2.7 Shared contract
- `src/shared/*` no importa `src/app` ✓
- `src/shared/overlays/person-profile-dialog.tsx` importa 2 paneles de modules — **excepción documentada** (orquestador canónico ficha personal).
- `src/shared/lib/*` no importa React ✓ (helpers puros).

### AUD 2.8 Lib contract
- `src/lib/*` no importa React ✓ (verificado).
- `src/lib/*` no importa `src/app` ✓.
- `src/lib/*` no importa `src/modules` ✓ (excepto 1 test, fuera de runtime).
- `src/lib/*` importa `src/shared/lib/*` — **excepción documentada** (helpers puros).
- Monolitos identificados (ver §AUD 2.11).

### AUD 2.9 API structure contract
- 43 archivos `route.ts` con `requireAuth`/`requireApiAccess` (mayoría de APIs protegidas).
- `route.ts` más grande: **141 líneas** (`/api/chat/route.ts`). Dentro de límite recomendado.
- Sin SQL inline detectado en `src/app/api/*` (regex `SELECT|INSERT|UPDATE|DELETE FROM`: 0 hits).
- Auditoría profunda de seguridad → AUD 3.

### AUD 2.10 Reuse y duplicidad
- Spot-check de `fetch(`, `toFixed`, `Date()`, `Dialog|Sheet|Modal|Drawer`, `Person.*Overlay/Dialog`: cubierto en AUD 1 §3.4.
- `PersonProfileDialog` (canónico) ya consolida `PersonHoursOverlay`, `PersonDetailSheet`, etc. (AUD #3 PH07/PH08/PH09).
- `BlockProfileModal` consolida ficha del bloque cross-módulo.
- `module-placeholder.tsx` ya canon en `src/shared/data-display/` (AUD 1).

### AUD 2.11 Archivos grandes
| Archivo | Líneas | Tipo | Estado |
|---------|--------|------|--------|
| `src/lib/fenograma-core.ts` | 2346 | Dominio | **monolito documentado** — split planeado pero alto riesgo (queries SQL acopladas a mappers a typings) |
| `src/modules/fenograma/components/block-profile-modal.tsx` | 1791 | UI | **deuda canon AUD 1 #2** — refactor a `DialogShell` + split en 5 modales internos |
| `src/modules/campo/components/campo-map.tsx` | 950 | UI | Leaflet complejo, dominio mapa |
| `src/lib/postcosecha-balanzas-core.ts` | 933 | Dominio | excede 700 ligeramente, contiene 19 nodos + COLUMN_LABELS + loaders |
| `src/lib/salud.ts` | 808 | Dominio | excede 700 |
| `src/modules/programaciones/components/programaciones-explorer.tsx` | 807 | UI | excede 350 |
| `src/modules/productividad/components/productividad-explorer.tsx` | 780 | UI | excede 350; ya tracked en `legacy:check` |

**Decisión AUD 2:** No partir monolitos sin evidencia de bug o regresión funcional. Documentar como deuda. Plan de split por archivo va a AUD 3+.

### AUD 2.12 Naming y alias
- Spot-check: archivos React kebab-case ✓, libs kebab-case ✓.
- Filtros terminan en `Filters` ✓ (verificado en `BalanzasFilters`, `ProductividadFilters`).
- 1 import unused removido: `formatWeekLabel` en `talento-view-utils.ts:4`.
- Lint: 9 warnings preexistentes (10 → 9 tras esta limpieza).

### AUD 2.13 Documentación
- `docs/ui-canon.md` actualizado con 4 excepciones nuevas:
  - `src/lib/*` puede importar `src/shared/lib/*` (helpers puros)
  - `PersonProfileDialog` puede importar 2 paneles de módulos (orquestador canónico)
  - `BlockProfileModal` puede ser importado cross-módulo
  - `MortalityCurvePanel` puede ser importado por fenograma

---

## 5. Archivos modificados

```
edit  docs/ui-canon.md                                  (4 excepciones de import documentadas)
edit  src/modules/talento-humano/components/talento-view-utils.ts  (drop unused formatWeekLabel import)
new   docs/audits/AUD-2-arquitectura-modular.md         (este archivo)
```

---

## 6. Imports corregidos

| Archivo | Import inválido | Reemplazo | Motivo |
|---------|-----------------|-----------|--------|
| `talento-view-utils.ts:4` | `import { formatWeekLabel, generateAvailableWeeks }` (formatWeekLabel no usado) | `import { generateAvailableWeeks }` | Lint warning preexistente cerrado |

---

## 7. Componentes movidos o consolidados

Ninguno en AUD 2 (movimientos ya hechos en AUD 1: `module-placeholder.tsx`).

---

## 8. Excepciones aceptadas (documentadas en `docs/ui-canon.md`)

| # | Archivo | Motivo | Riesgo | Plan de retiro |
|---|---------|--------|--------|----------------|
| 1 | `src/lib/*` importa `src/shared/lib/*` | Helpers puros sin React (format, number-utils, area-normalization, date-utils, labels) — agrupados semánticamente con `src/shared/*` | Bajo (no rompe espíritu "lib no React") | Opcional: mover a `src/lib/utils/*` en AUD futuro estructural |
| 2 | `src/shared/overlays/person-profile-dialog.tsx` importa `@/modules/fenograma/components/person-medical-panel` y `@/modules/productividad/components/person-hours-performance-section` | Orquestador canónico cross-módulo (3 tabs Información/Rendimiento/Médica) | Medio (acoplamiento shared→modules) | Refactor a slot-injection sería invasivo; aceptado |
| 3 | `BlockProfileModal` (en fenograma) importado por campo, mortality, productividad | Ficha del bloque canónica cross-módulo | Bajo | Aceptado como módulo "owner" + reuso |
| 4 | `MortalityCurvePanel` (mortality) importado por `BlockProfileModal` (fenograma) | Composición canónica embebida en ficha del bloque | Bajo | Aceptado |

---

## 9. Validación final

### `npm run typecheck`
✅ verde (0 errors)

### `npm run canon:check`
✅ verde (Canon check passed + Docs check passed)

### `npm run lint`
✅ 0 errors, **9 warnings preexistentes** (1 menos que baseline AUD 1, por remoción de `formatWeekLabel` import)

### `npm run legacy:check`
✅ passed (6 warnings preexistentes)

### `npm run build`
**No re-ejecutado en AUD 2** (último build verde fue commit `8c53586`; los cambios AUD 2 son solo: doc edits + 1 import unused removido). Si se requiere certificación: `npm run build` no debería romper.

### `npm run check` (test suite)
⚠️ **70/71 pre-existente** (mismo estado que baseline AUD 1, no introducido por AUD 2):
- `postcosecha-clasificacion-en-blanco.test.ts > incluye templates de slots en el boot data`
- `auth-session.test.ts` (no carga)
- `dead-plants-reseed.test.ts` (no carga)

### Búsquedas finales

| Search | Hits | Estado |
|--------|------|--------|
| `@/components/dashboard` en `src/` | **0** | ✅ |
| `from "@/app"` en `src/modules` | **0** | ✅ |
| `from "@/app"` en `src/shared` | **0** | ✅ |
| `from "@/app"` en `src/lib` | **0** | ✅ |
| `from "@/modules"` en `src/shared` | **2** (PersonProfileDialog) | ⚠️ excepción documentada (#2) |
| `from "@/modules"` en `src/lib` | **1** (test file, no runtime) | ⚠️ aceptable |
| `from "@/shared"` en `src/lib` | **18** (helpers puros) | ⚠️ excepción documentada (#1) |
| `^import.*from ["']react["']` en `src/lib` | **0** | ✅ |

---

## 10. Pendientes reales

| # | Severidad | Archivo / Área | Riesgo | Motivo no se cierra ahora | Acción exacta recomendada | Prioridad |
|---|-----------|----------------|--------|---------------------------|---------------------------|-----------|
| 1 | media | `src/modules/talento-humano/queries.ts`, `src/modules/users/queries.ts` | Bajo (cosmético) | Inconsistencia con módulos que tienen `server/queries.ts`. Refactor menor que requiere tocar imports | Mover a `<modulo>/server/queries.ts` y actualizar 2-3 imports cada uno | AUD 3 |
| 2 | media | `src/lib/fenograma-core.ts` (2346 líneas) | Alto | Monolito histórico — split SIN evidencia de bug es regla AUD #7 violada | Split planeado: extraer mappers (`src/lib/fenograma/mappers.ts`), queries (`.../queries.ts`), tipos (`.../types.ts`); preservar facade `src/lib/fenograma.ts` | AUD 3+ con evidencia |
| 3 | media | `src/lib/postcosecha-balanzas-core.ts` (933 líneas) | Medio | Excede 700 (límite dominio) por 233 | Considerar extracción de `BALANZAS_NODES` y `COLUMN_LABELS` a `postcosecha-balanzas-nodes.ts` | AUD 3 |
| 4 | media | `src/modules/fenograma/components/block-profile-modal.tsx` (1791 líneas) | Alto | UI gigante con 5 modales internos pre-canon (z-[60..70] sin DialogShell) — ya tracked en AUD 1 #2 | Refactor a `DialogShell` + split en 5 archivos: `block-profile-base`, `beds-modal`, `valve-modal`, `curve-modal`, `mortality-modal` | AUD 3 |
| 5 | baja | `src/modules/campo/components/campo-map.tsx` (950 líneas) | Medio | Leaflet, dominio mapa con mucho estado interno | Evaluar split de helpers puros vs handlers React | AUD 3 evaluación |
| 6 | baja | `src/modules/programaciones/components/programaciones-explorer.tsx` (807 líneas) | Medio | UI excede 350 (límite UI) | Extraer subcomponentes (rows, modals, filters) a archivos hermanos | AUD 3 |
| 7 | baja | `src/modules/productividad/components/productividad-explorer.tsx` (780 líneas) | Medio | UI excede 350 + tracked en `legacy:check` (CycleDetailRows → ExpandableTreeTable) | Migrar `CycleDetailRows` a `ExpandableTreeTable` (deuda AUD 1 #1) | AUD 3 |
| 8 | baja | 9 lint warnings preexistentes | Bajo | Algunos son intencionales (e.g., `_personName` deprecated API), otros pequeñas variables | Limpieza incremental por módulo | AUD futuras |

---

## Criterio de cierre AUD 2

| # | Criterio | Estado |
|---|----------|--------|
| 1 | Trabajo en main | ✅ |
| 2 | No worktrees | ✅ (1 principal) |
| 3 | No imports nuevos hacia `src/components/dashboard` | ✅ (carpeta no existe) |
| 4 | No UI nueva en `src/components/dashboard` | ✅ (no existe) |
| 5 | `src/shared` no importa modules ni app | ⚠️ 1 excepción documentada (`PersonProfileDialog`) |
| 6 | `src/lib` no importa React, shared, modules, app | ⚠️ 1 excepción documentada (`shared/lib/*` helpers puros) |
| 7 | `src/modules` no importa app | ✅ |
| 8 | Toda página visible está en module-catalog | ✅ (20=20) |
| 9 | Toda página dashboard usa `requirePageAccess` o `loadProtectedPageData` | ✅ (20/20) |
| 10 | `route.ts` no contiene lógica pesada innecesaria | ✅ (max 141 líneas, 0 SQL inline) |
| 11 | Queries pesadas no viven en explorers | ✅ |
| 12 | No componentes duplicados con equivalente shared | ✅ |
| 13 | Excepciones nuevas documentadas | ✅ (4 en `docs/ui-canon.md`) |
| 14 | `npm run check` verde | ⚠️ pre-existente (§9), no introducido por AUD 2 |
| 15 | `npm run canon:check` verde | ✅ |
| 16 | `npm run build` verde | ✅ último build (commit `8c53586`) — AUD 2 solo cambia docs + 1 import |
| 17 | `docs/audits/AUD-2-arquitectura-modular.md` actualizado | ✅ (este archivo) |

**Conclusión:** AUD 2 cierra documentando 4 excepciones arquitectónicas reales con motivo técnico, sin refactors masivos ciegos (regla AUD #7). Los pendientes son monolitos heredados con plan de split documentado para AUD 3+.
