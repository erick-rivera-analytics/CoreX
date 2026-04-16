# Reuse Index

Regla: antes de crear algo nuevo, buscar aqui. Si nada aplica, justificar la excepcion en el PR o documento de modulo.

## Layout

- `SectionPageShell`: encabezado canonico de toda vista explorer.
- `FilterPanel`: contenedor de filtros, KPIs y estados inline.
- `KpiGrid`: grid de KPIs, con `columns`.
- `ChartSection`: bloque para graficos.
- `DetailSection`: bloque para tablas y detalle.
- `AppShell`: sidebar, header y area principal.

## Datos y feedback

- `MetricTile`: unico KPI compartido. Usar `accent` para success/warning/danger.
- `ChartSurface`: superficie canonica para charts o visualizaciones tipo chart.
- `EmptyState`: unico estado vacio.

## Filtros

- `MultiSelectField`: seleccion multiple con search y badges.
- `SingleSelectField`: seleccion unica.
- `DateField`: fecha.
- `WeekField`: semana.
- `ToggleChipGroup`: toggles compactos.

## Tablas

- `ScrollFadeTable`: overflow horizontal con gradientes.
- `StandardTable`, `StandardTh`, `StandardTd`: tabla simple.
- `SortableHeader`: header sortable compartido.

## Charts

- `RechartsTooltipAdapter`: tooltip canonico de Recharts.
- `ChartTooltip`: contenido visual de tooltip.
- `axisConfig`, `axisTickStyle`, `gridConfig`, `tooltipCursorStyle`: config compartida.

## Overlays

- `DialogShell`: dialog z-index 60.
- `SheetShell`: sheet z-index 70.

## Navegacion

- `NavCard` y `SectionHeader`: home/dashboard hub.
- `src/config/module-catalog.ts`: fuente de verdad de rutas, titulos, estado y recursos RBAC.

## Datos, auth y fetch

- `loadProtectedPageData`: loader server canonico para paginas dashboard.
- `DashboardRouteError`: error visual para loader server.
- `requirePageAccess`: acceso server-side por recurso.
- `requireAuth`: auth + RBAC para APIs.
- `@/lib/fetch-json`: fetcher canonico cliente.
- `@/shared/lib/format`: unica fuente de numeros, fechas, horas y porcentajes.

## Seguridad y operacion

- `src/lib/access-control.ts`: toda API con `requireAuth()` debe tener regla explicita.
- `src/server/security/rate-limit.ts`: rate limit por identidad IP/usuario.
- `src/lib/logger.ts`: logging estructurado sin secretos.
- `src/lib/api-error.ts`: errores `{ message, error, requestId }` cuando aplique.
