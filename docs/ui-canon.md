# UI Canon

Contrato visual y estructural para no romper consistencia de CoreX al crecer.

## Explorer canonico

```tsx
<div className="space-y-4">
  <SectionPageShell eyebrow="..." title="..." subtitle="...">
    <FilterPanel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {/* filtros shared */}
      </div>
      <KpiGrid>
        <MetricTile label="..." value="..." />
      </KpiGrid>
    </FilterPanel>
  </SectionPageShell>

  {isEmpty ? <EmptyState /> : (
    <>
      <ChartSection>
        <ChartSurface title="...">{/* chart */}</ChartSurface>
      </ChartSection>
      <DetailSection>{/* Card > ScrollFadeTable */}</DetailSection>
    </>
  )}
</div>
```

## Invariantes no negociables

- root de explorer/page visible: `space-y-4`
- explorer canonico: `SectionPageShell > FilterPanel > KpiGrid`
- charts: `ChartSection > ChartSurface`
- tablas: `ScrollFadeTable`; sorting con `SortableHeader`
- filas clicables de tabla: `ClickableTableRow`
- Recharts: `RechartsTooltipAdapter` + `axisConfig` o `axisTickStyleCompact`
- filtros visibles: solo `src/shared/filters/*`
- numeros y fechas: solo `@/shared/lib/format`
- fetch cliente: solo `@/lib/fetch-json`
- overlays nuevos: `DialogShell` o `SheetShell`
- sombras y colores nuevos: tokens CSS o excepcion documentada

## Que reutilizar antes de crear

- header de pantalla: `SectionPageShell`
- filtros y KPIs: `FilterPanel`, `KpiGrid`, `MetricTile`
- chart panel: `ChartSection`, `ChartSurface`
- tabla con scroll: `ScrollFadeTable`
- fila clicable accesible: `ClickableTableRow`
- estados vacios: `EmptyState`
- tooltips Recharts: `RechartsTooltipAdapter`
- ejes, grid y cursor: `axisConfig`, `axisTickStyle`, `axisTickStyleCompact`, `gridConfig`, `tooltipCursorStyle`

## Que NO inventar

- headers de explorer manuales
- filtros custom si ya existe uno equivalente en shared
- `MetricPill` o `SummaryPill` nuevos
- wrappers alternos de tabla con sorting propio
- filas clicables ad hoc con `tr onClick` sin keyboard handler
- charts sin `ChartSurface`
- tooltips Recharts bespoke
- formatters locales simples

## Si una pieza no existe

Hacer esta pregunta:

### Ya aparece o va a aparecer en 2 modulos?

- si: crearla en `src/shared/*`
- no: crearla en `src/modules/<modulo>/*`

### Meterla en shared obliga a props demasiado de dominio?

- si: mantenerla module-local
- no: elevarla a shared

## Excepciones validas

- Campo/Leaflet puede usar colores directos porque `L.PathOptions` requiere valores concretos
- Programaciones usa paletas categoricas en `src/config/programaciones-palettes.ts`
- `.balanzas-process` puede usar colores directos porque el process viewer/BPMN requiere valores concretos por estado
- `.calidad-punto-apertura` puede usar colores directos porque Recharts SVG (`<circle>`, `<ReferenceLine>`) renderiza fuera del árbol CSS; centralizados en `CALIDAD_CHART_COLORS` en `src/lib/calidad-punto-apertura.ts`
- Indicadores Balanzas puede usar `ChartSection` sin `ChartSurface` dentro del workspace BPMN cuando la pieza es un layout de 3 paneles (navegacion + canvas + inspector), no una card de chart
- Comparison puede no usar `KpiGrid`; su layout de batalla es el resumen
- `MetricPill` de Fenograma es una excepcion de dominio valida y vive en el split del modal
- `person-detail-sheet.tsx` puede usar `space-y-6` dentro del overlay
- `CompositionTable` puede mantener `py-2` en body cells porque es heatmap compacto; fuera de ese caso la regla es `py-2.5 px-3`

## Canon de tablas

- fila clicable: usar `ClickableTableRow`
- hover de fila clicable: `hover:bg-primary/6`
- primera celda clicable: `group-hover:underline underline-offset-4`
- padding body canonico: `py-2.5 px-3`
- columnas numericas: `text-right tabular-nums`
- sorting: `SortableHeader` cuando aplique
- heatmaps: pueden conservar densidad compacta documentada

## Componentes nuevos (Audit #3)

3 primitives canonicos + 1 specifico de balanzas, agregados como respuesta al PDF Auditoria_03.

### Triggers en celdas — `InteractiveCell`

`@/shared/tables/interactive-cell` — politica unica para "texto/badge clicable dentro de una celda".

| Variante | Uso |
| --- | --- |
| `link` (default) | Texto link-like dentro de celda (e.g., `cycleKey`, valveId). Hover: `text-primary underline` |
| `badge` | Chip con border (e.g., personId clicable). Soporta `isSelected` y `aria-pressed` |
| `underline-text` | Texto siempre con `group-hover:underline` (uso dentro de `<ClickableTableRow>` cuando el row maneja el click) |

Modo especial:
- `decorative={true}`: renderiza `<span>` (no boton/anchor). Usar cuando vive dentro de `<ClickableTableRow>` y el click lo maneja la fila — el affordance visual queda en la celda, la interaccion en la fila.
- `stopPropagation={true}`: previene burbuja del click hacia `<ClickableTableRow>` cuando el InteractiveCell SI dispara su propia accion (e.g., dentro de fila clicable cuando la celda abre OTRA cosa).

Reglas a11y:
- Renderiza `<button>` o `<a>` reales (Enter/Space funcionan automaticamente)
- Focus visible con ring
- `aria-pressed` para variant="badge" cuando `isSelected`
- Tooltip solo si texto truncado o accion no obvia

NO usar para:
- fila completa clicable → `ClickableTableRow`
- boton primario fuera de tabla → `Button`
- chip de estado/categoria no interactivo → `<span class="badge">` o `Badge` directo

### Tablas jerarquicas — `ExpandableTreeTable`

`@/shared/tables/expandable-tree-table` — tabla canonica para datos arbol/desplegables.

Soporta:
- Niveles arbitrarios (anio → ciclo → area → subcentro → actividad → persona → detalle)
- Indentacion progresiva por nivel
- Chevron canonico a la izquierda
- Subtotales en filas de grupo (via `column.render`)
- Lazy loading via `loadChildren(node) => Promise<TreeNode[]>`
- Filas hoja navegables (abren ficha) usan `InteractiveCell` automaticamente
- Badges no-interactivos via `node.badge`

Cuando NO usar: tablas planas (sin jerarquia) → `<ScrollFadeTable>` + `<StandardTable>` directamente.

### Ficha del personal — `PersonProfileDialog`

`@/shared/overlays/person-profile-dialog` — UNA SOLA ficha del personal, reemplaza:
- `PersonHoursOverlay` interno de `block-profile-modal.tsx` (fenograma) — ELIMINADO
- `PersonHoursOverlay` de `productividad/components/person-hours-overlay.tsx` — ELIMINADO archivo
- `PersonDetailSheet` de `talento-humano/components/person-detail-sheet.tsx` — ELIMINADO archivo

Estructura:
- DialogShell central `max-w-7xl`
- 3 tabs OBLIGATORIAS: **Informacion**, **Rendimiento**, **Ficha medica**
- Permisos `panel:person-sheet.{info,performance,medical}` aplicados

Decisión de endpoint segun `sourceContext.module`:
- `fenograma | productividad`: `/api/fenograma/cycle/[cycleKey]/hours/person/[personId]` (con `cycleKey` y `camas30`)
- `talento | campo | mortality`: `/api/talento-humano/persona/[personId]` (sin contexto de ciclo). Tab Rendimiento muestra empty state.

Regla del PDF cumplida: tab Rendimiento NO muestra filtros de ciclo (el ciclo viene del contexto). Si requiere filtro temporal interno, se usa semana/rango.

Migrar consumidores:
```tsx
<PersonProfileDialog
  open={Boolean(selectedPersonId)}
  personId={selectedPersonId ?? ""}
  sourceContext={{ module: "productividad", cycleKey, camas30 }}
  onClose={() => setSelectedPersonId(null)}
/>
```

### Tabla de Balanzas detail — `BalanzasExpandableTable`

`@/modules/postcosecha/components/balanzas-expandable-table` (no en shared, especifico al dominio).

Wraps `ExpandableTreeTable` con jerarquia:
- Nivel 0: **Semana** (derivada de `work_date` o `lot_date`)
- Nivel 1 (opcional): agrupacion seleccionada por usuario (destination / grade / gradeGroup)
- Nivel 2 (o 1 si no hay agrupacion): detalle transaccional

Subtotales: SUM de cada columna numerica de `BalanzasNodeDetail`. Conteo de filas via `node.badge`.

Reemplaza la tabla plana del `balanzas-node-detail-sheet.tsx`. Sin grafico (cumple PDF Bloque D).

### Tokens z-index canonicos (Audit #3 Fase 6B)

Definidos en `globals.css`:
- `--z-sticky` (10): headers sticky de tablas
- `--z-modal-primary` (60): DialogShell (overlay principal)
- `--z-modal-secondary` (70): SheetShell, modales anidados
- `--z-dropdown` (80): ActionMenu, MultiSelectField popovers
- `--z-toast` (90): toast system futuro
- `--z-map-overlay` (100): controles Leaflet, popups de mapa

Uso recomendado: `style={{ zIndex: "var(--z-dropdown)" }}` o `className="z-[var(--z-dropdown)]"`.

NO inventar `z-[700]`, `z-[1100]` o similares. Si necesitas un nivel nuevo, agregalo aqui primero.

Excepciones documentadas:
- `block-profile-modal.tsx` mantiene `z-[50]` legacy en sus 6 sub-modales hasta migracion completa a DialogShell (Audit #5).
- `campo-map.tsx` mantiene `z-[700/800/900]` en controles Leaflet (excepcion Leaflet, ver `docs/reuse-index.md`).

## Componentes nuevos (Audit #1)

15 primitives canonicos agregados como infra para los Audits #2+. APIs estables, no romper.

### Overlays — `src/shared/overlays/*`

| Componente | Cuando SI | Cuando NO |
| --- | --- | --- |
| `DialogShell` | base modal: overlay informativo / 1–2 secciones / sin footer de acciones | edicion larga (usar `FormDrawer`); tabs (usar `SheetShell`) |
| `SheetShell` | base drawer: navegable / tabs / footer/CTAs persistentes | confirmaciones binarias (usar `ConfirmDialog`); detalle read-only (usar `DetailDrawer`) |
| `ConfirmDialog` | confirmacion binaria (eliminar, descartar, aplicar). Acepta `tone: "neutral" \| "danger"`, `isPending` | formularios — usar `FormDrawer` |
| `FormDrawer` | formulario mediano/largo dentro de drawer. Footer pegajoso submit/cancel + `isSubmitting` | confirmaciones; detalle read-only |
| `DetailDrawer` | ficha read-only de entidad. `headerActions` y `footer` slots | edicion (usar `FormDrawer`) |
| `EntityDetailPanel` | detalle in-page (right-rail, no overlay). Usa `var(--shadow-panel)` | si oscurecer pantalla aporta foco — usar `DetailDrawer` |

Regla corta: footer con acciones persistentes => `SheetShell` o `FormDrawer`. Detalle read-only => `DetailDrawer`. Confirmacion binaria => `ConfirmDialog`. Modal informativo simple => `DialogShell`.

### Forms — `src/shared/forms/*`

| Componente | Cuando SI |
| --- | --- |
| `TextInputField` | input de texto/numero/email con label, helper, error |
| `TextareaField` | textarea con label, helper, error |
| `SearchInput` | input de busqueda con icono leading + boton clear + debounce opcional |
| `FormSection` | agrupador `space-y-4` con titulo + descripcion para grupos dentro de un form |

`SearchInput` vs `SingleSelectField` vs `MultiSelectField`: `SearchInput` es texto libre con debounce. Los Select* son dropdowns con opciones. Si el usuario debe elegir de una lista cerrada => Select*. Si ingresa cualquier cadena => `SearchInput`.

### Navigation — `src/shared/navigation/*`

| Componente | Cuando SI | Notas |
| --- | --- | --- |
| `Breadcrumb` | migas de pan; ultimo item se renderiza como texto | usa `next/link`, `aria-current="page"` |
| `PageHeader` | encabezado para paginas no-explorer (admin, mi-cuenta, mi-trabajo, formularios largos) | **NO reemplaza `SectionPageShell`** — los explorers siguen con shell completo |
| `ViewSwitcher` | toggle group entre vistas (Tabla / Tarjetas / Mapa) | generico sobre el tipo de valor |

### UI / Acciones — `src/shared/ui/*`

| Componente | Cuando SI |
| --- | --- |
| `ActionMenu` | dropdown 3-puntos con items `{label, onSelect, icon?, tone?, disabled?, divider?}`; cierra en outside click + ESC |
| `Pagination` | paginacion canonica con prev/next + page-size opcional. Renderiza "Mostrando X–Y de Z" o "Sin registros" |
| `Toolbar` | row con slots `start/center/end` para acciones encima de tablas/secciones (no para filtros principales — esos van en `FilterPanel`) |
| `ExportButton` | un solo formato => boton directo; varios formatos (CSV/XLSX/PDF) => dropdown. La logica de generacion la pone el caller via `onExport(format)` |

### RBAC — `src/shared/hooks/use-permission.ts` + `src/shared/auth/permission-guard.tsx`

```tsx
const { canView, canWrite, canDelete, canExport, isSuperadmin, isLoading } = usePermission(resourceKey);

<PermissionGuard resource="/dashboard/dead-plants-reseed" action="write" fallback={<EmptyState />}>
  <CapturePanel />
</PermissionGuard>
```

- `usePermission` y `PermissionGuard` son **solo UI**. Cualquier accion que muta datos debe estar protegida tambien en el endpoint via `requireAuth` + `access-control`.
- Acciones soportadas: `view` (real, contra `allowedResources`), `write` / `delete` / `export` (placeholder hasta migracion BD en Audit #3 — actualmente devuelven canView o false).
- Mientras `isLoading`, `PermissionGuard` no renderiza nada (evita parpadeos).

## Tokens nuevos (Audit #1)

Definidos en `src/app/globals.css` dentro del bloque `@theme inline`. Adopcion masiva => Audit #5.

### Tipografia

| Token | Tamaño | Uso recomendado |
| --- | --- | --- |
| `text-eyebrow` | 11px uppercase | Etiquetas pequeñas encima de un titulo |
| `text-meta` | 12px muted | Texto auxiliar / metadata |
| `text-body` | 14px | Texto base de UI (reemplaza `text-sm`) |
| `text-emphasis` | 16px font-medium | Lectura legible / texto destacado mid-tier |
| `text-section` | 18px font-semibold | Titulos de seccion dentro de una pagina |
| `text-page-title` | 24px font-semibold | Titulo principal de pagina |
| `text-display` | 30px font-semibold | KPI hero / numero destacado |

### Radii

| Token | Valor | Uso |
| --- | --- | --- |
| `rounded-tag` | 6px | chips, tags compactos |
| `rounded-pill-lg` | 8px | botones / pills medianos |
| `rounded-tile` | 12px | tiles, mini-cards |

Tokens existentes que ya estaban: `rounded-sm` (12px), `rounded-md` (14px), `rounded-lg` (16px = `--radius-control`), `rounded-xl` (24px = `--radius-surface`), `rounded-chip` (999px), `rounded-overlay` (28px).

### Sombras

| Token | Uso |
| --- | --- |
| `var(--shadow-card)` | sombra ligera de card |
| `var(--shadow-panel)` | sombra de panel destacado (lateral, inset, popover ligero) |
| `var(--shadow-dropdown)` | dropdowns, action menus |
| `var(--shadow-overlay)` | dialogos, drawers, modales |
| `var(--shadow-tooltip)` | tooltips |

Regla: nunca `box-shadow:` ni `shadow-[0_…_rgba(…)]` inline. Usar `shadow-[var(--shadow-X)]` o `shadow-X` (Tailwind).

## Formatters nuevos (Audit #1)

En `@/shared/lib/format`:

- `formatRatio(numerator, denominator, digits = 2)` — reemplaza `Math.round((x/y) * 100) / 100`. Maneja null/0/undefined.
- `formatCount(value, singular, plural)` — concatena entero con sustantivo: `formatCount(1, "bloque", "bloques")` => `"1 bloque"`.

Toda concatenacion manual de numeros con sufijo o etiquetas singular/plural debe pasar por estos.

## Diccionario de etiquetas (Audit #1)

En `@/shared/lib/labels`:

- `CYCLE_STATUS_LABELS` (active/closed/planned/...)
- `LIFECYCLE_LABELS` (active/planned/history)
- `TASK_STATUS_LABELS` (todo/in_progress/blocked/completed/cancelled/archived)
- `PRESENCE_LABELS` (active/inactive/pending/done)
- `getLabel(dict, key, fallback?)` — passthrough seguro

Adopcion masiva en Audit #6. En PRs nuevos, preferir el diccionario antes de declarar mappings inline.

## Dialog vs Sheet

- usar `DialogShell` para overlays informativos o de 1-2 secciones, sin footer de acciones
- usar `SheetShell` para overlays navegables, multi-seccion, con tabs o footer/CTAs
- regla corta: si el overlay necesita footer con acciones persistentes, va en `SheetShell`

## Checklist rapido para nueva pantalla

- esta registrada en `module-catalog`
- usa `SectionPageShell`
- usa `FilterPanel`
- usa filtros shared
- usa `MetricTile`
- usa `ChartSurface`
- usa `ScrollFadeTable`
- usa formatters shared
- no introduce colores ni sombras fuera de token o excepcion
