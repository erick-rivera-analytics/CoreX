> LEGACY / reference only.

# APIs internas

## 1. Convenciones generales

Todas las APIs activas del proyecto viven en `src/app/api/` y hoy son rutas `GET`.

Convenciones actuales:

- respuestas JSON
- errores devueltos con campo `message`
- endpoints de Fenograma marcados como dinamicos
- `Cache-Control: no-store` en la ruta de pivot
- nombres de query params pensados para consumo simple desde cliente

## 2. Health check de base

Ruta:

- `GET /api/health/db`

Archivo:

- `src/app/api/health/db/route.ts`

## 2.1. Proposito

Permite validar si la app tiene configuracion de base y si esa configuracion realmente logra conectarse a PostgreSQL.

## 2.2. Respuesta esperada

Campos principales:

- `configured`
- `source`
- `host`
- `port`
- `database`
- `ssl`
- `connected`
- `message`
- `checkedAt`

## 2.3. Codigos de estado

- `200`: sin configuracion o conexion valida
- `503`: hay configuracion pero la conexion fallo

## 2.4. Ejemplo PowerShell

```powershell
Invoke-RestMethod "http://localhost:3000/api/health/db"
```

## 3. Pivot de Fenograma

Ruta:

- `GET /api/fenograma/pivot`

Archivo:

- `src/app/api/fenograma/pivot/route.ts`

## 3.1. Proposito

Devuelve el dataset filtrado y pivoteado que consume `FenogramaExplorer`.

## 3.2. Query params soportados

- `includeActive=true|false`
- `includePlanned=true|false`
- `includeHistory=true|false`
- `area=all|valor`
- `variety=all|valor`
- `spType=all|valor`

## 3.3. Respuesta

Campos de alto nivel:

- `generatedAt`
- `today`
- `filters`
- `options`
- `weeks`
- `rows`
- `weeklyTotals`
- `summary`

### `filters`

Contiene los filtros efectivos ya normalizados.

### `options`

Contiene listas para poblar selects:

- `areas`
- `varieties`
- `spTypes`

### `weeks`

Arreglo de semanas ISO visibles, ordenado de menor a mayor.

### `rows`

Cada fila contiene:

- `id`
- `block`
- `area`
- `variety`
- `spType`
- `spDate`
- `harvestStartDate`
- `harvestEndDate`
- `lifecycleStatus`
- `totalStems`
- `weekValues`

### `weeklyTotals`

Arreglo para la grafica de barras:

- `week`
- `stems`

### `summary`

Resumen del dataset filtrado:

- `rowCount`
- `weekCount`
- `totalRecords`
- `totalStems`
- `firstWeek`
- `lastWeek`
- `activeRows`
- `plannedRows`
- `historyRows`

## 3.4. Ejemplo PowerShell

```powershell
Invoke-RestMethod "http://localhost:3000/api/fenograma/pivot?includeActive=true&includePlanned=true&includeHistory=false&area=all&variety=all&spType=all"
```

## 3.5. Error

Si falla devuelve:

```json
{
  "message": "No se pudo cargar el fenograma."
}
```

O un mensaje mas especifico si viene de una excepcion conocida.

## 4. Detalle de bloque

Ruta:

- `GET /api/fenograma/block/[parentBlock]`

Archivo:

- `src/app/api/fenograma/block/[parentBlock]/route.ts`

## 4.1. Proposito

Resolver la ficha de bloque usando `parent_block` como clave de consulta.

## 4.2. Respuesta

Campos principales:

- `parentBlock`
- `generatedAt`
- `summary`
- `cycles`

### `summary`

- `totalCycles`
- `currentCycles`
- `validCycles`
- `varieties`
- `spTypes`

### `cycles`

Cada ciclo contiene:

- `recordId`
- `cycleKey`
- `validFrom`
- `validTo`
- `isCurrent`
- `isValid`
- `bedCount`
- `valveCount`
- `pambilesCount`
- `bedArea`
- `variety`
- `spType`
- `lightType`
- `parentBlock`
- `blockId`
- `changeReason`
- `programmedPlants`
- `cycleStartPlants`
- `deadPlants`
- `reseededPlants`
- `currentPlants`
- `mortalityPeriodPct`
- `mortalityCumulativePct`

## 4.3. Ejemplo PowerShell

```powershell
Invoke-RestMethod "http://localhost:3000/api/fenograma/block/317"
```

## 5. Detalle de camas por ciclo

Ruta:

- `GET /api/fenograma/cycle/[cycleKey]/beds`

Archivo:

- `src/app/api/fenograma/cycle/[cycleKey]/beds/route.ts`

## 5.1. Proposito

Resolver el detalle de `beds profile` y metricas de plantas para un `cycle_key` especifico.

## 5.2. Respuesta

Campos principales:

- `cycleKey`
- `generatedAt`
- `summary`
- `beds`

### `summary`

- `totalBeds`
- `currentBeds`
- `validBeds`
- `totalProgrammedPlants`
- `totalCycleStartPlants`
- `totalCurrentPlants`
- `totalBedArea`

### `beds`

Cada cama contiene:

- `recordId`
- `bedId`
- `cycleKey`
- `valveId`
- `validFrom`
- `validTo`
- `isCurrent`
- `isValid`
- `length`
- `width`
- `bedArea`
- `pambilesCount`
- `variety`
- `spType`
- `changeReason`
- `programmedPlants`
- `cycleStartPlants`
- `deadPlants`
- `reseededPlants`
- `currentPlants`
- `mortalityPeriodPct`
- `mortalityCumulativePct`

## 5.3. Ejemplo PowerShell

```powershell
Invoke-RestMethod "http://localhost:3000/api/fenograma/cycle/AREA-0001/beds"
```

Reemplaza `AREA-0001` por un `cycle_key` real del entorno.

## 6. Detalle de valvula por ciclo

Ruta:

- `GET /api/fenograma/cycle/[cycleKey]/valves`

Archivo:

- `src/app/api/fenograma/cycle/[cycleKey]/valves/route.ts`

## 6.1. Proposito

Resolver el listado visible de valvulas para un `cycle_key` especifico.

## 6.2. Respuesta

Campos principales:

- `cycleKey`
- `generatedAt`
- `summary`
- `valves`

### `summary`

- `totalValves`
- `currentValves`
- `validValves`
- `totalProgrammedPlants`
- `totalCycleStartPlants`
- `totalCurrentPlants`

## 6.3. Ejemplo PowerShell

```powershell
Invoke-RestMethod "http://localhost:3000/api/fenograma/cycle/MH1-329-GYPXLE-P2-29122025/valves"
```

## 7. Detalle de valvula por ciclo

Ruta:

- `GET /api/fenograma/cycle/[cycleKey]/valves/[valveId]`

Archivo:

- `src/app/api/fenograma/cycle/[cycleKey]/valves/[valveId]/route.ts`

## 7.1. Proposito

Resolver la ficha de una valvula dentro de un ciclo y devolver tambien las camas asociadas a esa valvula.

## 7.2. Respuesta

Campos principales:

- `cycleKey`
- `valveId`
- `generatedAt`
- `valve`
- `summary`
- `beds`

### `valve`

- `recordId`
- `valveId`
- `valveName`
- `cycleKey`
- `blockId`
- `parentBlock`
- `status`
- `bedCount`
- `validFrom`
- `validTo`
- `isCurrent`
- `isValid`
- `changeReason`
- `programmedPlants`
- `cycleStartPlants`
- `deadPlants`
- `reseededPlants`
- `currentPlants`
- `mortalityPeriodPct`
- `mortalityCumulativePct`

### `summary`

- `totalBeds`
- `currentBeds`
- `validBeds`
- `totalProgrammedPlants`
- `totalCycleStartPlants`
- `totalCurrentPlants`

## 7.3. Ejemplo PowerShell

```powershell
Invoke-RestMethod "http://localhost:3000/api/fenograma/cycle/MH1-305-GYPXLE-P2-11032026/valves/305-305A"
```

## 8. Patron de errores del proyecto

El patron actual es deliberadamente simple.

### Respuesta de error

```json
{
  "message": "Texto descriptivo del error"
}
```

### Implicaciones

- el cliente no depende de un esquema complejo de errores
- la UI puede mostrar mensajes directos
- si mas adelante se quiere trazabilidad, se puede evolucionar a `code`, `details` y `requestId`

## 9. Recomendaciones al agregar una API nueva

1. poner la logica pesada en `src/lib/`, no en la ruta
2. normalizar query params antes de usarlos
3. devolver nombres pensados para UI, no columnas crudas si se puede evitar
4. mantener el contrato consistente con `message` para errores
5. documentar la nueva ruta en este archivo y en el README
> LEGACY / reference only. Ver `docs/security-ops.md` y el codigo como fuente vigente.
