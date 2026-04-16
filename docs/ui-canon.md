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

## Reglas

- Root de vista: `space-y-4`.
- Filtros arriba de KPIs y dentro de `FilterPanel`.
- KPIs solo con `MetricTile`.
- Charts dentro de `ChartSection > ChartSurface`.
- Recharts usa `RechartsTooltipAdapter` y axis config compartida.
- Tablas con `ScrollFadeTable`; sorting con `SortableHeader`.
- Estados vacios con `EmptyState`.
- Overlays con `DialogShell` o `SheetShell`.
- Numeros y fechas con `@/shared/lib/format`.
- Sombras y colores nuevos por tokens CSS.

## Excepciones validas

- Campo/Leaflet puede usar colores directos porque `L.PathOptions` requiere valores concretos.
- Programaciones usa paletas categoricas en `src/config/programaciones-palettes.ts`.
- Comparison puede no usar `KpiGrid`; su layout de batalla es el resumen.
- `fenograma-block-modal.tsx` conserva `MetricPill` local por comportamiento clickeable de dominio.
- `person-detail-sheet.tsx` puede usar `space-y-6` dentro del overlay.
