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

## Dialog vs Sheet

- usar `DialogShell` para overlays informativos o de 1–2 secciones, sin footer de acciones
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
