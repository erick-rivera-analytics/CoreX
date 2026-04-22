# Gestion Postcosecha - Clasificacion en blanco

Modulo: `/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco`

## Que resuelve

Este modulo permite capturar pedidos por SKU y disponibilidad por grado para ejecutar el solver multimodo de Clasificacion en blanco. La corrida se resuelve por origen operativo:

- `GV`
- `APERTURA`
- `PRECLASIFICACION`

El front respeta el canon del proyecto:

- shell y KPIs dentro de `SectionPageShell` / `FilterPanel`
- UI visible en `src/modules/postcosecha/*`
- overlays con `DialogShell` y `SheetShell`
- sin crecimiento nuevo en `src/components/dashboard/*`

## Flujo funcional actual

1. El boot server carga:
   - maestro SKU desde `public.postharvest_dim_sku_profile_scd2`
   - templates de pedidos y disponibilidad
   - slots de pedido y slots de lote
   - defaults del bridge Python
2. La captura operativa se hace con overlays:
   - `Pedidos por SKU`: bunches por fecha + restriccion por slot (`STRICT` o `SOFT`)
   - `Disponibilidad por grado`: mallas por fecha + fecha real y origen del lote
   - `Pesos seed por grado`: editor global de pesos usados para disponibilidad gestionable
   - `Detalle SKU`: vista lateral con edicion puntual del maestro
3. El precheck valida tallos pedidos minimos vs disponibilidad neta segun el modo activo.
4. El solver ejecuta tres corridas secuenciales:
   - `GV`
   - `APERTURA`
   - `PRECLASIFICACION`
5. La UI permite revisar resultados por modo, abrir receta por SKU y exportar una vista imprimible para guardar como PDF.

## Persistencia local

El explorer persiste en `localStorage`:

- pedidos
- disponibilidad
- settings
- `orderSlots`
- `lotSlots`
- modo activo
- ultimo `resultBundle`
- flag `isResultStale`

La rehidratacion solo ocurre en cliente y nunca durante SSR.

## APIs involucradas

- `GET /api/postcosecha/planificacion/solver/clasificacion-en-blanco`
  - retorna `BootData`
- `POST /api/postcosecha/planificacion/solver/clasificacion-en-blanco`
  - recibe pedidos, disponibilidad, settings y slots
  - retorna `{ data: ModeResult[] }`
- `POST /api/postcosecha/planificacion/solver/clasificacion-en-blanco/receta`
  - construye receta para un SKU ya resuelto
- `PATCH /api/postcosecha/administrar-maestros/skus/[skuId]`
  - permite editar el SKU desde el overlay lateral del solver

Todas estas rutas siguen `requireAuth()` y retornan respuestas `private, no-store`.

## Python bridge y engine

El solver usa:

- `scripts/solver_clasificacion_en_blanco_bridge.py`
- `scripts/postharvest_solver_engine.py`

Discovery de Python:

1. `POSTHARVEST_SOLVER_PYTHON`
2. `.venv` o `venv` local del repo
3. `../solver_poscosecha/venv/Scripts/python.exe`
4. `python` / `python3`

## Archivos clave del modulo

- `src/lib/postcosecha-clasificacion-en-blanco.ts`
- `src/lib/postcosecha-clasificacion-en-blanco-client.ts`
- `src/lib/postcosecha-clasificacion-en-blanco-types.ts`
- `src/modules/postcosecha/hooks/use-clasificacion-en-blanco-explorer.ts`
- `src/modules/postcosecha/hooks/use-solver-draft-storage.ts`
- `src/modules/postcosecha/components/clasificacion-en-blanco-explorer.tsx`

## Notas operativas

- La exportacion PDF actual usa una vista imprimible del navegador para no introducir dependencias PDF que rompan build.
- El precheck cliente y server deben mantenerse alineados. Si cambia la regla de cobertura o slots, se actualizan ambos lados en la misma tarea.
- Las ediciones de SKU desde el solver actualizan el maestro local del explorer y marcan resultados como obsoletos.
