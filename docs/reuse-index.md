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
| Filtros + KPIs + estados inline | `FilterPanel` + `KpiGrid` |
| Bloque de charts | `ChartSection` + `ChartSurface` |
| Bloque de detalle/tablas | `DetailSection` + `ScrollFadeTable` |
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
| Seleccion unica | `SingleSelectField` |
| Fecha | `DateField` |
| Semana | `WeekField` |
| Toggle compacto | `ToggleChipGroup` |

## Tablas y sorting

| Necesidad | Reutilizar |
| --- | --- |
| Overflow horizontal canonico | `ScrollFadeTable` |
| Tabla simple | `StandardTable`, `StandardTh`, `StandardTd` |
| Header sortable | `SortableHeader` |
| Fila clicable accesible | `ClickableTableRow` |

## Charts

| Necesidad | Reutilizar |
| --- | --- |
| Tooltip Recharts | `RechartsTooltipAdapter` |
| Cuerpo visual de tooltip | `ChartTooltip` |
| Ejes/grilla/cursor | `axisConfig`, `axisTickStyle`, `axisTickStyleCompact`, `gridConfig`, `tooltipCursorStyle` |

## Overlays y navegacion

| Necesidad | Reutilizar |
| --- | --- |
| Dialog | `DialogShell` |
| Sheet | `SheetShell` |
| Hub de navegacion | `NavCard`, `SectionHeader` |

## Datos, auth y fetch

| Necesidad | Reutilizar |
| --- | --- |
| Catalogo de modulos | `src/config/module-catalog.ts` |
| Acceso server-side a paginas | `requirePageAccess`, `loadProtectedPageData` |
| Acceso a API | `requireAuth` |
| Fetch cliente | `@/lib/fetch-json` |
| Formatters | `@/shared/lib/format` |

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
