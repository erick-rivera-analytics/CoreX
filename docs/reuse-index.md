# Reuse Index

Regla operativa: antes de crear algo nuevo, buscar primero aqui. Si existe algo parecido en `src/shared/*` o en el modulo actual, no se crea otro componente/helper. Si nada aplica, la excepcion debe quedar escrita en el PR o en la documentacion del modulo.

## Si no existe, donde crear?

- `src/shared/*` si el patron es transversal y reusable real
- `src/modules/<modulo>/*` si la pieza es de dominio y no conviene contaminar shared

Regla:

- primero module-local
- subir a shared solo cuando ya sea claramente reusable

## Layout y shell

| Necesidad | Reutilizar |
| --- | --- |
| Header de explorer | `SectionPageShell` |
| Header de pagina no-explorer (admin, mi-cuenta, formulario largo) | `PageHeader` (`@/shared/navigation/page-header`) — **NO reemplaza `SectionPageShell`** |
| Migas de pan | `Breadcrumb` (`@/shared/navigation/breadcrumb`) |
| Toggle Tabla / Tarjetas / Mapa | `ViewSwitcher` (`@/shared/navigation/view-switcher`) |
| Filtros + KPIs + estados inline | `FilterPanel` + `KpiGrid` |
| Bloque de charts | `ChartSection` + `ChartSurface` |
| Bloque de detalle/tablas | `DetailSection` + `ScrollFadeTable` |
| Toolbar (acciones encima de tabla/seccion) | `Toolbar` (`@/shared/ui/toolbar`) — slots `start/center/end` |
| Detalle in-page sin overlay | `EntityDetailPanel` (`@/shared/overlays/entity-detail-panel`) |
| Shell global | `AppShell` |

## Datos y feedback

| Necesidad | Reutilizar |
| --- | --- |
| KPI compartido | `MetricTile` |
| Estado vacio | `EmptyState` |
| Error/loader server-side | `DashboardRouteError` + `loadProtectedPageData` desde `src/modules/core/server-page.tsx` |

## Filtros

| Necesidad | Reutilizar |
| --- | --- |
| Seleccion multiple | `MultiSelectField` |
| Seleccion unica | `SingleSelectField` (props `omitEmpty` para selectores obligatorios; `hideLabel` para sr-only) |
| Fecha | `DateField` |
| Semana | `WeekField` |
| Toggle compacto | `ToggleChipGroup` |
| Busqueda libre con debounce | `SearchInput` (`@/shared/forms/search-input`) |

## Forms

| Necesidad | Reutilizar |
| --- | --- |
| Input de texto / numero / email con label + helper + error | `TextInputField` (`@/shared/forms/text-input-field`) |
| Textarea con label + helper + error | `TextareaField` (`@/shared/forms/textarea-field`) |
| Agrupador de campos con titulo + descripcion | `FormSection` (`@/shared/forms/form-section`) |
| Toggle on/off | `ToggleSwitch` (`@/shared/forms/toggle-switch`) |

## Tablas y sorting

| Necesidad | Reutilizar |
| --- | --- |
| Overflow horizontal canonico | `ScrollFadeTable` |
| Tabla simple | `StandardTable`, `StandardTh`, `StandardTd` |
| Header sortable | `SortableHeader` |
| Fila clicable accesible | `ClickableTableRow` |
| Texto/badge clicable dentro de celda | `InteractiveCell` (`@/shared/tables/interactive-cell`) — variantes `link` / `badge` / `underline-text`; modo `decorative` para coexistir con `ClickableTableRow` |
| Tabla jerarquica desplegable (anio → ciclo → actividad → persona) | `ExpandableTreeTable` (`@/shared/tables/expandable-tree-table`) — soporta lazy load via `loadChildren` y filas navegables que usan `InteractiveCell` |
| Paginacion | `Pagination` (`@/shared/ui/pagination`) — pura presentacion, callbacks `onPageChange` / `onPageSizeChange` |
| Acciones por fila (3-puntos) | `ActionMenu` (`@/shared/ui/action-menu`) |
| Boton de exportar (CSV/XLSX/PDF) | `ExportButton` (`@/shared/ui/export-button`) |

## Charts

| Necesidad | Reutilizar |
| --- | --- |
| Tooltip Recharts | `RechartsTooltipAdapter` |
| Cuerpo visual de tooltip | `ChartTooltip` |
| Ejes/grilla/cursor | `axisConfig`, `axisTickStyle`, `axisTickStyleCompact`, `gridConfig`, `tooltipCursorStyle` |

## Overlays y navegacion

| Necesidad | Reutilizar |
| --- | --- |
| Modal informativo / 1–2 secciones | `DialogShell` |
| Drawer navegable / multi-seccion / con tabs | `SheetShell` |
| Confirmacion binaria (eliminar, descartar) | `ConfirmDialog` (`@/shared/overlays/confirm-dialog`) — soporta `tone: "neutral" \| "danger"` |
| Formulario en drawer con footer pegajoso | `FormDrawer` (`@/shared/overlays/form-drawer`) |
| Detalle read-only en drawer | `DetailDrawer` (`@/shared/overlays/detail-drawer`) |
| Detalle in-page sin overlay (right-rail) | `EntityDetailPanel` (`@/shared/overlays/entity-detail-panel`) |
| **Ficha del personal (UNICA)** | `PersonProfileDialog` (`@/shared/overlays/person-profile-dialog`) — DialogShell + 3 tabs (Informacion / Rendimiento / Ficha medica). Decide endpoint segun `sourceContext.module` |
| Hub de navegacion | `NavCard`, `SectionHeader` |
| Overlays del solver de postcosecha | `src/modules/postcosecha/components/solver-*-overlay.tsx` |

## Datos, auth y fetch

| Necesidad | Reutilizar |
| --- | --- |
| Catalogo de modulos | `src/config/module-catalog.ts` |
| Acceso server-side a paginas | `requirePageAccess`, `loadProtectedPageData` |
| Acceso a API | `requireAuth` |
| Permisos UI (cliente) | `usePermission(resourceKey)` (`@/shared/hooks/use-permission`) |
| Guarda UI por recurso/accion | `<PermissionGuard resource action="view\|write\|delete\|export">` (`@/shared/auth/permission-guard`) |
| Fetch cliente | `@/lib/fetch-json` |
| Formatters numericos / fechas / horas / porcentaje | `@/shared/lib/format` (incluye `formatRatio`, `formatCount`) |
| Diccionarios canonicos de etiquetas (cycle/lifecycle/task/presence status) | `@/shared/lib/labels` (`CYCLE_STATUS_LABELS`, `LIFECYCLE_LABELS`, `TASK_STATUS_LABELS`, `PRESENCE_LABELS`, `getLabel`) |
| Persistencia local del solver | `src/modules/postcosecha/hooks/use-solver-draft-storage.ts` |
| Dashboard Calidad / Punto de apertura | `src/lib/calidad-punto-apertura.ts` + `src/modules/calidad/components/punto-apertura-*.tsx` |
| Utilidades de fecha (ISO, startOfMonth, endOfMonth, addDays) | `@/shared/lib/date-utils` |
| Pool DB personal workspace | `@/lib/personal-workspace-db` (`queryPersonalWorkspace`, `withPersonalWorkspaceTransaction`) |
| Schemas Zod perfil / tareas / eventos / recordatorios | `@/lib/personal-workspace-schemas` |
| Mappers Mi cuenta | `@/modules/my-account/server/mappers` |
| Mappers Mi trabajo | `@/modules/my-work/server/mappers` |
| Paleta categorica campo (Leaflet) | `@/modules/campo/lib/sub-map-palette` |
| Paleta categorica programaciones | `@/config/programaciones-palettes` |

## Seguridad y operacion

| Necesidad | Reutilizar |
| --- | --- |
| Regla API protegida | `src/lib/access-control.ts` |
| Rate limit | `src/server/security/rate-limit.ts` |
| Logging estructurado | `src/lib/logger.ts` |
| Error API con `requestId` | `src/lib/api-error.ts` |

## Cuando SI crear algo nuevo

| Caso valido | Condicion |
| --- | --- |
| Dominio irreducible | El comportamiento pertenece solo a un modulo y no contamina shared |
| Reusable real | La misma pieza aparece o aparecera en al menos 2 modulos |
| Limitacion tecnica documentada | El componente actual no soporta un caso necesario y la extension seria peor que una pieza nueva |

## Que NO inventar

- headers de explorer
- filtros custom si ya existe uno en `src/shared/filters`
- formatters locales simples
- fetchers alternos a `@/lib/fetch-json`
- KPIs alternos a `MetricTile`
- wrappers nuevos en `src/components/dashboard`
- tooltips Recharts fuera de `RechartsTooltipAdapter`
- tablas con sorting propio si `SortableHeader` cubre el caso
