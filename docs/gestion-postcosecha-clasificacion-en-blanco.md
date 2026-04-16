> LEGACY / reference only.

# Clasificacion En Blanco En CoreX

## Objetivo

Migrar el solver de `C:\Users\paul.loja\PYPROYECTOS\solver_poscosecha` a CoreX sin perder:

- la logica matematica real del modelo
- el maestro oficial de SKU ya cargado en PostgreSQL
- el formato visual y de navegacion del dashboard

## Ubicacion funcional

La vista vive en:

- `Gestion > Poscosecha > Planificacion > Solver > Clasificacion en blanco`

Ruta:

- `src/app/(dashboard)/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco/page.tsx`

## Arquitectura implementada

La solucion se separa en cuatro capas:

1. Pantalla CoreX

- `src/components/dashboard/postcosecha-clasificacion-en-blanco-explorer.tsx`

La UI permite:

- capturar pedidos por SKU y por fecha
- capturar disponibilidad por grado y por fecha
- editar `desperdicio`
- ejecutar el solver
- ver resumen macro
- ver prioridad por fecha
- ver resumen por pedido
- ver matriz final en mallas
- ver disponibilidad final por grado

2. Helpers cliente

- `src/lib/postcosecha-clasificacion-en-blanco-client.ts`

Esta capa mantiene solo logica segura para cliente:

- derivacion de disponibilidad
- validacion previa
- etiquetas de fechas

3. Dominio server

- `src/lib/postcosecha-clasificacion-en-blanco.ts`

Responsabilidades:

- cargar el maestro SKU activo desde PostgreSQL
- cargar seeds por defecto del solver
- construir la base inicial de la pantalla
- ejecutar el puente Python

4. API

- `src/app/api/postcosecha/planificacion/solver/clasificacion-en-blanco/route.ts`

Endpoints:

- `GET` devuelve base inicial
- `POST` ejecuta la corrida

## Fuente oficial de SKU

La pantalla toma el maestro activo desde:

- `public.postharvest_dim_sku_profile_scd2`

por medio de:

- `src/lib/postcosecha-skus.ts`

Con esto el solver deja de depender del `sku_master.csv` como fuente oficial de negocio.

## Motor de optimizacion

Para no perder el comportamiento del modelo original se usa un puente local a Python:

- `scripts/solver_clasificacion_en_blanco_bridge.py`

Ese puente consume:

- `solver_poscosecha/solver_logic.py`
- `solver_poscosecha/Copia de Solver Tallos.xlsm`

El interprete esperado por defecto es:

- `C:\Users\paul.loja\PYPROYECTOS\solver_poscosecha\venv\Scripts\python.exe`

Tambien se puede sobreescribir con:

- `POSTHARVEST_SOLVER_ROOT`
- `POSTHARVEST_SOLVER_PYTHON`

## Seeds iniciales

La pantalla nace con:

- SKU desde PostgreSQL
- grados y `peso_tallo_seed` desde el workbook del solver
- `desperdicio` desde el workbook del solver

Si el workbook o el motor no se pueden cargar, la vista usa un fallback local de seeds para no dejar la pantalla vacia.

## Validacion previa

Antes de correr el solver se valida:

- que existan pedidos mayores a cero
- que exista disponibilidad mayor a cero
- que `tallos pedidos minimos >= tallos disponibles netos`

La misma regla se respeta en cliente y en servidor.

## Validacion realizada

Validado en local:

- `GET /dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco` responde `200`
- `GET /api/postcosecha/planificacion/solver/clasificacion-en-blanco` responde `200` con sesion
- `POST /api/postcosecha/planificacion/solver/clasificacion-en-blanco` responde `200` con corrida valida

Caso de humo usado:

- `SKU 100`
- `fecha_1 = 120`
- `grado 15`
- `fecha_1 = 1`

Resultado:

- `solver_status = Optimal`
- `orderRows = 1`
- `matrix.rows = 1`

## Notas operativas

- La UI sigue completamente en espanol.
- Los nombres tecnicos de PostgreSQL permanecen en ingles.
- El solver actual no persiste corridas; por ahora es una vista de captura y resolucion.
- El siguiente paso natural es guardar escenarios o historico de corridas si el negocio lo pide.
> LEGACY / reference only. La fuente vigente es el codigo del modulo y los docs oficiales.
