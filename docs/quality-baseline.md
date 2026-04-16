# Quality Baseline

Fecha base: 2026-04-16.

## Estado

CoreX ya opera como aplicacion interna real: autenticacion por BD, RBAC por recurso, catalogo central de modulos, canon UX/UI compartido, Docker standalone y checks automaticos iniciales.

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

- `src/components/dashboard/` queda como zona transicional. No crear archivos nuevos alli.
- Algunos `src/modules/*` aun importan explorers legacy como UI interna.
- `fenograma-block-modal.tsx`, `postcosecha-balanzas.ts` y `src/lib/fenograma.ts` siguen siendo monolitos con plan de split.
- Colores directos de Leaflet y paletas categoricas de Programaciones son excepciones documentadas.

## Meta de calidad

- Fases docs + checks: 8.8-9.0.
- Seguridad operacional + tests: 9.2-9.4.
- Modularizacion y split de monolitos: 9.5-9.7.
- 9.8-10 requiere HTTPS formal, Redis/observabilidad externa, staging estable, visual regression y rollback automatico.
