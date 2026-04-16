> LEGACY / reference only.

# Fenograma

## 1. Proposito del modulo

`Fenograma` es la vista operativa mas completa del proyecto. Su funcion es permitir lectura semanal de ciclos de cultivo pivoteados por semana ISO y bajar desde esa vista a detalle de bloque, ciclo, cama y valvula.

El modulo resuelve tres necesidades:

- ver rapidamente que ciclos estan activos, planificados o historicos
- comparar tallos por semana en una tabla ancha de lectura operativa
- abrir detalle estructural y biologico sin salir del modulo

## 2. Archivos involucrados

### Rutas

- `src/app/(dashboard)/dashboard/fenograma/page.tsx`
- `src/app/api/fenograma/pivot/route.ts`
- `src/app/api/fenograma/block/[parentBlock]/route.ts`
- `src/app/api/fenograma/cycle/[cycleKey]/beds/route.ts`
- `src/app/api/fenograma/cycle/[cycleKey]/valves/route.ts`
- `src/app/api/fenograma/cycle/[cycleKey]/valves/[valveId]/route.ts`

### Dominio

- `src/lib/fenograma.ts`
- `src/lib/db.ts`

### Presentacion

- `src/components/dashboard/fenograma-explorer.tsx`
- `src/components/dashboard/fenograma-pivot-table.tsx`
- `src/components/dashboard/fenograma-weekly-bars-panel.tsx`
- `src/components/dashboard/fenograma-weekly-bars-chart.tsx`

## 3. Fuentes de datos reales

## 3.1. Vista principal de fenograma

Fuente:

- `gld.mv_prod_fenograma_cur`

Columnas utilizadas directamente o derivadas:

- `cycle_key`
- `parent_block`
- `variety`
- `sp_type`
- `sp_date`
- `harvest_start_date`
- `harvest_end_date`
- `iso_week_id`
- `stems_count`

Notas:

- `Area` no viene como columna dedicada en la UI actual
- se deriva desde el tramo previo a `parent_block` dentro de `cycle_key`
- la tabla pivoteada no usa `candidate_cycles_json` ni `match_status` por ahora

## 3.2. Perfil del ciclo

Fuente:

- `slv.camp_dim_cycle_profile_scd2`

Uso:

- resolver los perfiles disponibles por `parent_block`
- obtener datos estructurales del ciclo
- exponer atributos tecnicos del bloque

## 3.3. Perfil de camas

Fuente:

- `slv.camp_dim_bed_profile_scd2`

Uso:

- resolver camas disponibles para un `cycle_key`
- exponer atributos tecnicos cama por cama

## 3.4. Kardex de plantas por ciclo

Fuente:

- `gld.mv_camp_kardex_cycle_plants_cur`

Uso:

- plantas registradas
- plantas vigentes
- bajas acumuladas
- resiembras
- mortandad actual
- mortandad acumulada

## 3.5. Kardex de plantas por cama

Fuente:

- `gld.mv_camp_kardex_bed_plants_cur`

Uso:

- mismas metricas del punto anterior, pero a nivel `bed_id`

## 3.6. Perfil y kardex de valvulas

Fuentes:

- `slv.camp_dim_valve_profile_scd2`
- `gld.mv_camp_kardex_valve_plants_cur`

Uso:

- ficha de valvula dentro del ciclo
- plantas programadas
- inicio de ciclo
- plantas vigentes
- bajas acumuladas
- resiembras
- mortandad actual y acumulada
- camas relacionadas con esa valvula

## 4. Modelo conceptual del modulo

## 4.1. Entidad visible en la tabla

Cada fila pivoteada representa una combinacion de:

- bloque
- area
- variedad
- SP
- fecha SP
- fecha inicio de cosecha
- fecha fin de cosecha

Sobre esa fila se distribuyen los tallos por semana.

## 4.2. Entidad visible en el modal

Al hacer click en una fila, la clave de apertura es `parent_block`.

Con esa clave se consultan los perfiles de ciclo disponibles. Cada uno puede abrir luego el detalle de camas usando `cycle_key`.

## 5. Logica de estados

El modulo maneja tres estados de ciclo:

- `Activos`
- `Planificados`
- `Historia`

## 5.1. Planificados

Regla:

```sql
sp_date >= current_date
```

Interpretacion:

- el ciclo aun no entra en ventana de ejecucion historica
- se considera parte del plan hacia adelante

## 5.2. Activos

Regla:

```sql
sp_date < current_date
and coalesce(harvest_end_date, harvest_start_date, sp_date) >= current_date
```

Interpretacion:

- el ciclo ya arranco
- sigue vigente por fecha de fin o por fecha de cosecha conocida

## 5.3. Historia

Regla:

```sql
coalesce(harvest_end_date, harvest_start_date, sp_date) < current_date
```

Interpretacion:

- el ciclo ya quedo atras del corte temporal actual

## 5.4. Estado por defecto

Por defecto el modulo carga:

- `Activos = true`
- `Planificados = true`
- `Historia = false`

Esto reduce ruido operativo y evita cargar historia completa desde el inicio.

Si ese estado default sigue intacto y no hay filtros dimensionales activos, las semanas visibles arrancan desde la semana ISO actual hasta la ultima disponible.
Si ese estado default sigue intacto y no hay filtros dimensionales activos, la vista se limita a un maximo de `24` semanas visibles desde la semana ISO actual.

Si no existen semanas futuras o actuales en ese corte, el modulo usa las ultimas semanas disponibles para evitar devolver una tabla excesivamente ancha.

## 6. Filtros disponibles

Filtros actuales:

- estado: `Activos`, `Planificados`, `Historia`
- `Area`
- `Variedad`
- `SP`

Comportamiento:

- los selectores usan `all` como valor neutro
- los filtros se serializan a query string
- los filtros se normalizan en servidor antes de consultar SQL

Pendientes naturales:

- filtro por `Bloque`
- selector explicito de rango de semanas
- cache corta cuando el volumen crezca

## 7. Construccion de la tabla pivoteada

La tabla pivoteada se arma en `src/lib/fenograma.ts` con este proceso:

1. se consulta la vista base filtrada
2. se agrupan tallos por combinacion de fila y `iso_week_id`
3. se ordena por `harvest_start_date`, `sp_date`, `area`, `block`, `variety`, `sp_type`, `iso_week_id`
4. se colecta el conjunto total de semanas visibles
5. se crea una fila normalizada por combinacion de negocio
6. cada semana se guarda en `weekValues[isoWeek]`
7. se suma `totalStems` por fila
8. se arma un acumulado semanal global para la grafica de barras

Resultado final:

- `weeks`: columnas dinamicas
- `rows`: filas pivoteadas
- `weeklyTotals`: datos del grafico
- `summary`: resumen del set filtrado

## 8. Tabla pivoteada en UI

Archivo:

- `src/components/dashboard/fenograma-pivot-table.tsx`

Comportamiento visual:

- encabezado sticky
- columnas fijas sticky
- semanas en scroll horizontal
- click por fila para abrir modal

Columnas fijas actuales:

- `Bloque`
- `Area`
- `Variedad`
- `SP`
- `Fecha SP`
- `Fecha Ini Cos`
- `Fecha Fin Cos`

Columnas dinamicas:

- una columna por cada `iso_week_id`

Ajustes importantes ya aplicados:

- las columnas sticky tienen fondo opaco y sombra de corte para no solaparse visualmente con las semanas al hacer scroll
- la tabla tiene una fila fija al final con el total semanal visible

## 9. Grafico de acumulado semanal

Archivos:

- `src/components/dashboard/fenograma-weekly-bars-panel.tsx`
- `src/components/dashboard/fenograma-weekly-bars-chart.tsx`

Comportamiento:

- eje `X`: semanas ISO visibles
- eje `Y`: tallos acumulados del set filtrado
- cambia automaticamente con los filtros activos

## 10. Modal de bloque

Archivo:

- `src/components/dashboard/fenograma-explorer.tsx`

Flujo:

1. el usuario hace click en una fila
2. el cliente guarda la fila seleccionada
3. se hace fetch a `/api/fenograma/block/[parentBlock]`
4. se abre el modal con resumen del bloque y ciclos

Si el click viene desde la tabla de `Fenograma`, el modal puede filtrarse al `cycle_key` exacto de la fila.
Si el click viene desde el mapa de bloques, el modal muestra el historial completo del bloque.

El modal muestra:

- fechas principales de la fila
- tallos totales de la fila
- cantidad de ciclos
- ciclos vigentes
- ciclos validos
- variedades detectadas
- ficha detallada de cada `cycle profile`

## 11. Detalle de ciclo

Cada card de ciclo presenta:

- `cycle_key`
- estado actual o vigente
- estado valido o invalido
- bloque tecnico
- variedad
- tipo SP
- luz
- camas
- pambiles
- superficie
- plantas programadas
- inicio de ciclo
- plantas vigentes
- bajas acumuladas
- resiembras
- mortandad actual
- mortandad acumulada
- vigencia desde / hasta

## 12. Detalle de camas

El bloque `Camas` dentro de cada card es clickeable.

Flujo:

1. el usuario pulsa `Camas`
2. el cliente hace fetch a `/api/fenograma/cycle/[cycleKey]/beds`
3. se incrusta bajo ese perfil el detalle de `beds profile`

Cada cama muestra:

- `bed_id`
- `valve_id`
- largo
- ancho
- superficie
- plantas programadas
- inicio de ciclo
- plantas vigentes
- bajas acumuladas
- resiembras
- mortandad actual
- mortandad acumulada
- pambiles
- vigencia
- tipo SP
- variedad

La presentacion de camas ahora usa tabla para escalar mejor cuando el volumen es alto.

## 13. Detalle de valvulas

Dentro de cada ciclo, el bloque `Valvulas` es clickeable y abre el listado de valvulas del ciclo.
Dentro de cada cama, el campo `Valvula` tambien es clickeable si existe `valve_id`.

Flujo:

1. el usuario pulsa `Valvulas`
2. el cliente hace fetch a `/api/fenograma/cycle/[cycleKey]/valves`
3. el usuario abre una valvula especifica
4. el cliente hace fetch a `/api/fenograma/cycle/[cycleKey]/valves/[valveId]`
5. se abre un panel anidado con la ficha de valvula
6. el panel tambien lista las camas que pertenecen a esa valvula en tabla

El detalle de valvula muestra:

- valvula
- bloque
- camas
- estado
- plantas programadas
- inicio de ciclo
- plantas vigentes
- bajas acumuladas
- resiembras
- mortandad actual
- mortandad acumulada
- vigencia

## 14. Estandarizacion de nombres

La UI no expone nombres crudos de la base de datos cuando eso afecta la lectura de negocio.

| Base | Presentacion |
|---|---|
| `cycle profile` | `Ficha del bloque` |
| `beds profile` | `Detalle de camas` |
| `mortality` | `Mortandad actual` |
| `cumulative_mortality` | `Mortandad acumulada` |
| `initial_plants` | `Plantas programadas` |
| `initial_plants_cycle` | `Inicio de ciclo` |
| `dead_plants_count` | `Bajas acumuladas` |
| `reseed_plants_count` | `Resiembras` |
| `final_plants_count` | `Plantas vigentes` |
| `valid_from` | `Desde` |
| `valid_to` | `Hasta` |
## 15. APIs del modulo

## 14.1. Pivot

Ruta:

- `GET /api/fenograma/pivot`

Query params:

- `includeActive=true|false`
- `includePlanned=true|false`
- `includeHistory=true|false`
- `area=all|valor`
- `variety=all|valor`
- `spType=all|valor`

Devuelve:

- filtros efectivos
- opciones de selectores
- semanas visibles
- filas pivoteadas
- acumulado semanal
- resumen del dataset filtrado

## 14.2. Cycle profile por bloque

Ruta:

- `GET /api/fenograma/block/[parentBlock]`

Devuelve:

- bloque consultado
- resumen de perfiles
- lista de perfiles de ciclo
- metricas de plantas a nivel ciclo

## 14.3. Beds profile por ciclo

Ruta:

- `GET /api/fenograma/cycle/[cycleKey]/beds`

Devuelve:

- `cycleKey`
- resumen general de camas
- lista de camas con metricas de presentacion

## 15.4. Valve profile por ciclo

Ruta:

- `GET /api/fenograma/cycle/[cycleKey]/valves/[valveId]`

Devuelve:

- `cycleKey`
- `valveId`
- ficha de valvula
- resumen general de camas asociadas a la valvula
- lista de camas asociadas a esa valvula

## 16. Rendimiento

`Fenograma` puede sentirse pesado por la combinacion de cuatro factores:

1. la vista SQL puede traer muchos registros
2. el pivot agrega costo en servidor
3. la tabla tiene muchas columnas sticky y muchas semanas
4. el render de una tabla ancha exige mas al navegador

### Mitigaciones ya aplicadas

- historia apagada por defecto
- ventana inicial limitada a `24` semanas visibles
- cache corta en memoria para pivot y drilldowns
- detalle de bloque bajo demanda
- detalle de camas bajo demanda
- tabla con estructura estable y sin repintados innecesarios mayores

### Mejoras recomendadas

1. ultimas `16` o `24` semanas por default
2. cache corta en `/api/fenograma/pivot`
3. exportacion a Excel
4. virtualizacion de filas si el volumen crece mas
5. preagregado o vista materializada si la fuente se vuelve muy pesada

## 17. Riesgos y supuestos actuales

- `Area` hoy se deriva del `cycle_key`
- el modulo asume que `cumulative_mortality` llega como fraccion y se convierte a porcentaje
- no hay selector de rango de semanas todavia
- no hay exportacion

## 18. Checklist para tocar este modulo

Antes de cambiar `Fenograma`, revisar:

1. si el cambio afecta SQL o solo presentacion
2. si el filtro nuevo debe vivir en UI, API y dominio
3. si el detalle debe abrir por `parent_block` o por `cycle_key`
4. si el nombre visible debe estandarizarse y no exponer el nombre crudo de BD
5. si el cambio aumenta volumen y requiere pensar en rendimiento
> LEGACY / reference only. La fuente vigente es el codigo del modulo Fenograma y los docs oficiales.
