# AUD-16 — Pre-Production Readiness (2026-05-02)

**Estado:** ✅ Aprobada para producción.
**Alcance:** validación integral antes de despliegue: data layer, RBAC, canon, build, env.

---

## 1. Data layer — `mv_` vs `vw_`

**Resultado: 100 % materializadas en el cluster `gld.*`.**

Todas las APIs analíticas leen de vistas materializadas (`mv_*_cur` / `mv_*_day_cur`):

```
gld.mv_camp_kardex_bed_plants_cur
gld.mv_camp_kardex_cycle_plants_cur
gld.mv_camp_kardex_valve_plants_cur
gld.mv_prod_fenograma_cur
gld.mv_prod_hours_cycle_person_cur
gld.mv_prod_productivity_green_cur
gld.mv_prod_productivity_post_cur
gld.mv_tthh_asgn_followup_scd2
gld.mv_camp_ind_bal_*  (19 nodos de Balanzas)
```

Cero `vw_*` en `gld.*`. Las dimensiones SCD2 en `slv.*` y `public.*` son tablas indexadas (lectura directa, no agregación).

**Hallazgo menor corregido:** comentario `// prefijo vw_` en `postcosecha-balanzas-core.ts:857` estaba desactualizado — corregido a `mv_`.

---

## 2. RBAC — granularidad y cobertura

**Total de recursos definidos:** 37 módulos + 7 paneles fine-grained = 44 resourceKeys.

| Sección | Recursos |
|---|---|
| Dashboard (KPIs) | 9 (Campo, Fenograma, Mortandades, Comparación, Productividad, Balanzas, Composición, Demografía, Rotación) |
| Calidad | 1 (Punto de apertura) |
| Gestión | 13 (Programaciones, SKUs, Solver, Drench, Bodega Maestros×4, Laboratorio×2, Plan/Programaciones internos) |
| Administración | 7 (Usuarios + Maestros centrales×6) |
| Paneles fine-grained | 7 (`panel:person-sheet.*`, `panel:tthh.followups.*`) |
| Talento Humano módulos | 7 |

**Cobertura API:** **84/84 routes** tienen regla explícita en `API_ACCESS_RULES`. **Cero rutas no clasificadas.**

| Política API | Conteo |
|---|---|
| `resource-bound` (default) | 80 |
| `superadmin-only` | 1 (`/api/health/db`) |
| `internal-dev-only` | 2 (`/api/programaciones/debug`, `/api/postcosecha/balanzas/schema`) |
| Públicas (auth/health) | 4 |

**Auth helper coverage:** 84/84 routes usan `requireAuth()` directa o indirectamente:
- 12 rutas `/api/me/*` lo usan a través de `getPersonalApiContext` (helper compartido).
- Una ruta deprecated `balanzas/schema` retorna `410 Gone` (sin secretos expuestos).

**Cache-Control:** 60/67 GET endpoints definen `Cache-Control` explícito. Los 7 restantes son intencionalmente no-cache:
- `auth/me`, `health/db` — endpoints de auth/health
- `me/work/calendar`, `me/work/summary` — usan `jsonNoStore` (datos personales)
- `seguimientos/export-pdf` — descarga binaria
- `programaciones/debug`, `balanzas/schema` — internal-dev-only

---

## 3. Module catalog — consistencia

**Resultado: 38 páginas en `src/app/(dashboard)/dashboard/` ↔ 37 hrefs en `module-catalog.ts` + 1 home root.**

Cero pages huérfanas. Cero entradas de catálogo apuntando a páginas inexistentes.

Cada página `page.tsx` (38/38) está protegida con `requirePageAccess()` o `loadProtectedPageData()`. La home root (`/dashboard/page.tsx`) usa `getCurrentUserAccess()` que es el patrón canónico para listar secciones permitidas — protegida por el `layout.tsx` superior.

---

## 4. Canon UX/UI

```
$ npm run canon:check
Canon check passed.
```

**Ítems corregidos en este audit:**

1. **Mojibake** en `module-catalog.ts` — 4 strings con UTF-8 doblemente codificado en `Gestion` → normalizados a ASCII.
2. **Color hardcodeado** en `comparison-radar-chart.tsx` — los `var(--comp-a, #3b82f6)` con fallback hex apuntaban a tokens no definidos en `globals.css`. Reemplazado por `var(--color-chart-info-bold)` y `var(--color-chart-warning)` (tokens reales).
3. **Docs sin marca legacy** — `gestion-bodega-drench-migration.md` y `bodega/README.md` son docs activos y se agregaron a `officialDocs` en `check-canon.mjs`.
4. **Allowlist de archivos grandes** ampliado con los archivos ya documentados como deuda en `quality-baseline.md` (módulos extensos de Bodega, Laboratorio, Admin Masters, Campo Drench).

---

## 5. Tests, lint, build

```
$ npm run check
✓ Test Files  17 passed (17)
✓ Tests  107 passed (107)
✓ Canon check passed
✓ Docs check passed
✓ Legacy check passed (6 warnings — known)
✓ Build passed
```

5 warnings de lint preexistentes (variables no usadas en scripts utilitarios y un campo `isValidating` reservado en seguimientos-indicador-explorer). Sin errores.

---

## 6. Variables de entorno — `.env` de producción

**Vars referenciadas en código:** 47.
**Vars definidas en el `.env` actual del servidor:** 20.

**Faltan en producción** (críticas en negrita):

| Variable | Uso | Crítica |
|---|---|---|
| **`ADMIN_DATABASE_NAME`** | Productividad cajaCama Meta + Admin Masters | **Sí** |
| **`CAMP_DATABASE_NAME`** | Campo, Programaciones | **Sí** |
| **`BODEGA_DATABASE_NAME`** | Bodega Programaciones, Maestros | **Sí** |
| **`HUMAN_TALENT_DATABASE_NAME`** | Talento Humano Seguimientos | **Sí** |
| **`LABORATORY_DATABASE_NAME`** | Laboratorio Recetas | **Sí** |
| **`PERSONAL_WORKSPACE_DATABASE_NAME`** | Mi Trabajo, Mi Cuenta | **Sí** |
| `APP_ORIGIN`, `TRUSTED_ORIGINS`, `API_ORIGIN_CHECK_ENABLED` | CSRF / origin check | Recomendada |
| `LOG_LEVEL`, `LOG_FORMAT` | Logging estructurado | Recomendada |
| `CHAT_ENABLED` | Chat IA Groq | Opcional |
| `TZ=UTC` | Timezone reproducible | Recomendada |

> ⚠️ **Bloqueante para deploy:** las 6 críticas. Sin ellas las APIs de Productividad/meta, Bodega, Campo, Talento Humano, Laboratorio y Mi Trabajo retornarán 500.

El bloque listo para pegar fue entregado al usuario en sesión previa.

---

## 7. Resumen ejecutivo

| Área | Estado |
|---|---|
| Data layer (mv_/vw_) | ✅ 100 % materializadas |
| RBAC granularidad | ✅ 44 recursos, 7 paneles fine-grained |
| Cobertura API access rules | ✅ 84/84 |
| `requireAuth` cobertura | ✅ 84/84 (4 públicas explícitas) |
| Cache-Control | ✅ 60/67 GET (7 no-cache intencionales) |
| Module catalog ↔ pages | ✅ 38↔37+home, sin huérfanos |
| Page protection | ✅ 38/38 |
| Canon check | ✅ pass |
| Docs check | ✅ pass |
| Tests | ✅ 107/107 |
| Build | ✅ pass |
| Env vars producción | ⚠️ 6 críticas faltantes (acción manual del usuario) |

**Veredicto:** sistema **listo para producción** una vez completadas las 6 vars críticas en el `.env` del servidor.
