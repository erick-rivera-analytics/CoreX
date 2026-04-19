> LEGACY / reference only.

# Gestion Poscosecha: Maestro de SKU y nueva navegacion

## Resumen

Este cambio introduce la primera base funcional del nuevo arbol de `Gestion > Poscosecha` dentro de CoreX.

Objetivos cubiertos:

- mantener el visualizador en espanol
- estandarizar nombres tecnicos de base de datos en ingles
- crear el primer modulo real de `Administrar SKU's`
- dejar lista la navegacion de `Registros`, `Administrar Maestros` y `Planificacion`
- preparar el terreno para migrar el solver de `Clasificacion en blanco` desde Streamlit

## Navegacion agregada

Se agregaron estas rutas nuevas al sidebar y al contexto del dashboard:

- `Gestion > Poscosecha > Registros`
- `Gestion > Poscosecha > Administrar Maestros > Administrar SKU's`
- `Gestion > Poscosecha > Planificacion > Programaciones`
- `Gestion > Poscosecha > Planificacion > Plan de trabajo`
- `Gestion > Poscosecha > Planificacion > Solver > Clasificacion en blanco`

Estado actual:

- `Administrar SKU's`: funcional
- `Registros`: placeholder navegable
- `Programaciones`: placeholder navegable
- `Plan de trabajo`: placeholder navegable
- `Clasificacion en blanco`: placeholder navegable

## Fuente funcional del maestro SKU

El maestro original del solver vivia en:

- `C:\Users\paul.loja\PYPROYECTOS\solver_poscosecha\data\sku_master.csv`

Ese CSV deja de ser la fuente operativa para CoreX. Ahora la persistencia vive en PostgreSQL y el CSV queda solo como opcion de semilla manual.

En la configuracion actual del dashboard el maestro SKU apunta a:

- `db_postharvest`

Y la semilla automatica queda desactivada por defecto para permitir crear el catalogo desde cero en la web.

Si se necesita recuperar la carga semilla desde CSV, se puede habilitar con:

- `POSTHARVEST_AUTO_SEED=true`

Si ese flag no esta activo, una base nueva crea solo el esquema y arranca sin SKU para permitir la carga inicial desde la web.

Reglas funcionales heredadas del solver:

- `sku` obligatorio
- `ideal_bunch_weight > 0`
- `stems_max >= stems_min`
- si faltan rangos de peso, se sugiere `ideal * 0.97` y `ideal * 1.03`
- `target_max_grades >= 1`
- no se permiten SKU activos duplicados por nombre

## Base de datos

Base objetivo:

- `db_postharvest`
- esquema: `public`

Tablas creadas:

- `public.postharvest_ref_sku_id_core_scd2`
- `public.postharvest_dim_sku_profile_scd2`

Razon del modelo:

- se replica el patron SCD2 que ya existe en otros dominios del proyecto
- el identificador tecnico del SKU queda separado del perfil de negocio
- cada cambio deja historial con vigencia, actor, run y motivo

Columnas de control SCD2 aplicadas:

- `record_id`
- `sku_id`
- `valid_from`
- `valid_to`
- `is_current`
- `is_valid`
- `loaded_at`
- `run_id`
- `actor_id`
- `change_reason`

Columnas de negocio del perfil:

- `sku_name`
- `ideal_bunch_weight`
- `stems_min`
- `stems_max`
- `target_weight_min`
- `target_weight_max`
- `target_max_grades`

## Ajustes operativos posteriores

Se aplicaron estos ajustes sobre la primera entrega del modulo:

- el fallback de conexion del maestro SKU cambia de `datalakehouse_bkp_07042026` a `db_postharvest`
- `POSTHARVEST_DATABASE_NAME` queda documentado en el entorno de ejemplo
- la semilla automatica queda desactivada por defecto con `POSTHARVEST_AUTO_SEED=false`
- una base nueva crea tablas e indices, pero no carga SKU hasta que el usuario los registre en la web o habilite la semilla
- la vista de `Administrar SKU's` usa formateo de fecha estable entre servidor y cliente para evitar errores de hidratacion en Next.js

Validacion realizada para este ajuste:

- `datalakehouse_bkp_07042026` conserva `18` filas vigentes en `public.postharvest_dim_sku_profile_scd2`
- `db_postharvest` queda con `0` filas vigentes en `public.postharvest_dim_sku_profile_scd2`
- `db_postharvest` si crea `public.postharvest_ref_sku_id_core_scd2`
- `db_postharvest` si crea `public.postharvest_dim_sku_profile_scd2`

## Componentes y rutas nuevas

Frontend:

- `src/components/dashboard/postcosecha-skus-explorer.tsx`
- `src/components/dashboard/module-placeholder.tsx`

Backend / dominio:

- `src/lib/postcosecha-db.ts`
- `src/lib/postcosecha-sku-types.ts`
- `src/lib/postcosecha-skus.ts`
- `src/app/api/postcosecha/administrar-maestros/skus/route.ts`
- `src/app/api/postcosecha/administrar-maestros/skus/[skuId]/route.ts`

Paginas:

- `src/app/(dashboard)/dashboard/postcosecha/administrar-maestros/skus/page.tsx`
- `src/app/(dashboard)/dashboard/postcosecha/registros/page.tsx`
- `src/app/(dashboard)/dashboard/postcosecha/planificacion/programaciones/page.tsx`
- `src/app/(dashboard)/dashboard/postcosecha/planificacion/plan-de-trabajo/page.tsx`
- `src/app/(dashboard)/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco/page.tsx`

Configuracion:

- `src/config/dashboard.ts`
- `src/app/(dashboard)/dashboard/page.tsx`
- `package.json`

## API nueva

Rutas:

- `GET /api/postcosecha/administrar-maestros/skus`
- `POST /api/postcosecha/administrar-maestros/skus`
- `PATCH /api/postcosecha/administrar-maestros/skus/[skuId]`

Comportamiento:

- `GET` devuelve el catalogo vigente
- `POST` crea un SKU nuevo y abre una nueva version actual
- `PATCH` cierra la version vigente del SKU y crea una nueva fila actualizada

## Validacion local

Validado en `next dev --webpack`:

- `GET /login` responde `200`
- `GET /dashboard/postcosecha/administrar-maestros/skus` responde `200`
- la vista de `Administrar SKU's` deja de mostrar el maestro legacy despues de reiniciar el servidor local con el nuevo `.env`
- placeholders nuevos de `Poscosecha` responden `200`

Nota importante:

- se fijo `npm run dev` a `next dev --webpack`
- motivo: el entorno actual sigue teniendo incompatibilidades previas con Turbopack y el stack de charts existente

## Siguiente paso natural

Con esta base ya se puede avanzar a la migracion del solver:

- usar el maestro SKU de PostgreSQL como fuente oficial
- crear la vista funcional de `Clasificacion en blanco`
- reemplazar lectura directa de CSV por consultas al dominio SCD2
> LEGACY / reference only. La fuente vigente es el codigo del modulo y los docs oficiales.
