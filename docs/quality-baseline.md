# Quality Baseline

Fecha base: 2026-04-16.

## Estado

CoreX ya opera como aplicacion interna real: autenticacion por BD, RBAC por recurso, catalogo central de modulos, canon UX/UI compartido, Docker standalone y checks automaticos.

## Checks obligatorios

```bash
npm run check
npm run canon:check
npm run build
```

`npm run check` no debe depender de una base de datos real. Las pruebas que necesiten staging o credenciales viven fuera del check obligatorio.

## Warning conocido

El build puede emitir un warning de Turbopack/NFT relacionado con rutas dinamicas del solver de postcosecha. Mientras no falle el build, queda documentado como deuda vigilada.

## Deuda legacy aceptada

- `src/components/dashboard/` queda congelado. No crear archivos nuevos alli.
- La zona legacy debe reducirse a:
  - `module-placeholder.tsx`
- `src/modules/*` ya no debe importar directamente desde `@/components/dashboard/*`; el canon check falla si reaparece esa frontera rota.
- Los unicos imports cruzados entre modulos aceptados temporalmente son los que reutilizan overlays/paneles de Fenograma y Mortality mientras se completa la extraccion a piezas shared o de dominio.
- `src/lib/fenograma.ts` y `src/lib/postcosecha-balanzas.ts` ahora son fachadas temporales. La logica nueva debe ir a `*-core.ts` o a subarchivos de dominio, nunca volver a crecer dentro de la fachada.
- `block-profile-modal.tsx`, `src/lib/fenograma-core.ts` y `src/lib/postcosecha-balanzas-core.ts` siguen siendo monolitos con plan de split.
- `src/modules/fenograma/components/block-profile-primitives.tsx` es una excepcion valida del canon porque mantiene el `MetricPill` clickeable extraido desde el modal de dominio.
- Colores directos de Leaflet y paletas categoricas de Programaciones son excepciones documentadas.

## Metas de retiro por lotes

- Lote 1: eliminar todos los `TEMPORARY_SHIM` sin imports reales
- Lote 2: mover o borrar cualquier pieza visible que siga en `src/components/dashboard/`
- Lote 3: mantener `src/components/dashboard/` solo con `module-placeholder.tsx`

## Archivos grandes vigilados

- `src/modules/fenograma/components/block-profile-modal.tsx` -> dueno esperado: Fenograma, split por paneles
- `src/lib/fenograma-core.ts` -> dueno esperado: capa lib Fenograma, split por loaders/mappers
- `src/lib/postcosecha-balanzas-core.ts` -> dueno esperado: Postcosecha, split por graph/table/options
- `src/modules/postcosecha/components/solver-results.tsx` -> dueno esperado: Postcosecha solver, seguir separando resultados/tablas si vuelve a crecer
- `src/modules/talento-humano/components/talento-charts.tsx` -> dueno esperado: Talento, seguir dividiendo charts si aparece nueva complejidad

## Meta de calidad

- Gobernanza docs + checks: 9.0+
- Seguridad operacional + tests: 9.2-9.4
- Modularizacion y split de monolitos: 9.5-9.7
- 9.8-10 requiere HTTPS formal, Redis/observabilidad externa, staging estable, visual regression y rollback automatico
