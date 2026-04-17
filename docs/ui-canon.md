# UI Canon

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

## Contrato obligatorio

- Root de explorer/page visible: `space-y-4`
- Explorer canonico: `SectionPageShell > FilterPanel > KpiGrid`
- Charts: `ChartSection > ChartSurface`
- Tablas: `ScrollFadeTable`; sorting con `SortableHeader`
- Recharts: `RechartsTooltipAdapter` + `axisConfig`
- Filtros visibles: solo `src/shared/filters/*`
- Numeros y fechas: solo `@/shared/lib/format`
- Fetch cliente: solo `@/lib/fetch-json`
- Overlays nuevos: `DialogShell` o `SheetShell`
- Sombras y colores nuevos: tokens CSS o excepcion documentada

## Excepciones validas

- Campo/Leaflet puede usar colores directos porque `L.PathOptions` requiere valores concretos
- Programaciones usa paletas categoricas en `src/config/programaciones-palettes.ts`
- `.balanzas-process` puede usar colores directos porque el process viewer/BPMN requiere valores concretos por estado
- Comparison puede no usar `KpiGrid`; su layout de batalla es el resumen
- `MetricPill` de Fenograma es una excepcion de dominio valida y vive en el split del modal
- `person-detail-sheet.tsx` puede usar `space-y-6` dentro del overlay
