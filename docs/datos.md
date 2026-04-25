> Referencia vigente. Schema y convenciones del DW + reglas de mapeo a UI.

# Datos — Schema de Base de Datos

Todo lo que necesitas saber para escribir queries correctas en CoreX: vistas disponibles, naming canon, reglas de negocio implícitas y patrones SQL reutilizables.

---

## Capas del Data Warehouse

El DW de CoreX usa tres schemas de PostgreSQL:

| Schema | Nombre | Propósito |
|--------|--------|-----------|
| `slv.*` | Silver | Dimensiones SCD2, perfiles autoritativos del campo |
| `gld.*` | Gold | Vistas materializadas (`mv_*`) listas para consumo |
| `mdl.*` | Model | Referencias operacionales y subsets de actividad |
| `public` | Application | Tablas de la app (usuarios, sesiones) — no leer directo desde módulos |

**Regla:** los módulos de CoreX solo leen de `gld.*`, `slv.*` y `mdl.*`. Nunca escriben en el DW.

---

## Naming Convention

### Vistas materializadas (`gld.*`)

```
gld.mv_<dominio>_<entidad>_<granularidad>_<estado>
```

| Fragmento | Valores | Ejemplo |
|-----------|---------|---------|
| `dominio` | `prod`, `camp` | `prod` = producción, `camp` = campo |
| `entidad` | `fenograma`, `kardex`, `hours`, `productivity` | — |
| `granularidad` | `cycle`, `bed`, `valve`, `day` | — |
| `estado` | `cur` (current/vigente), `day` (diario) | — |

Ejemplos: `gld.mv_camp_kardex_cycle_plants_cur`, `gld.mv_prod_fenograma_day_cur`

### Dimensiones SCD2 (`slv.*`)

```
slv.<dominio>_<kind>_<entidad>_<temporal>
```

| Fragmento | Valores |
|-----------|---------|
| `dominio` | `camp` (campo), `tthh` (talento humano), `common` |
| `kind` | `dim` (dimensión), `asgn` (asignación) |
| `temporal` | `scd2` (con historial), `scd0` (estable) |

Ejemplos: `slv.camp_dim_cycle_profile_scd2`, `slv.tthh_dim_person_profile_scd2`

### Campos estándar

| Campo | Tipo | Significado |
|-------|------|-------------|
| `*_key` | text | Clave de negocio natural (ej: `cycle_key`) |
| `*_id` | text/int | Identificador interno (ej: `bed_id`, `valve_id`) |
| `*_date` | DATE | Fecha sin hora (ej: `sp_date`, `harvest_end_date`) |
| `*_at` | TIMESTAMPTZ | Timestamp con zona horaria |
| `is_*` | boolean | Flag booleano (ej: `is_current`, `is_valid`) |
| `valid_from` | TIMESTAMPTZ | Inicio de vigencia del registro SCD2 |
| `valid_to` | TIMESTAMPTZ | Fin de vigencia (NULL = registro actual) |
| `pct_*` | numeric | Porcentaje como decimal (ej: `pct_mortality = 0.035` = 3.5%) |
| `*_count` | integer/numeric | Conteo (ej: `dead_plants_count`, `stems_count`) |
| `*_kg` | numeric | Peso en kilogramos |

---

## Vistas Gold (`gld.*`) — Referencia completa

### Campo — Plantas y Kardex

#### `gld.mv_camp_kardex_cycle_plants_cur`
Vista actual de plantas por **ciclo** desde el kardex de campo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `cycle_key` | text | ID de negocio del ciclo |
| `valid_from` | timestamptz | Inicio del registro |
| `initial_plants` | numeric | Plantas programadas (del schedule) |
| `initial_plants_cycle` | numeric | Plantas al inicio del ciclo (kardex) |
| `final_plants_count` | numeric | Plantas vigentes actuales |
| `dead_plants_count` | numeric | Acumulado de bajas (tendencia diaria) |
| `reseed_plants_count` | numeric | Plantas resembradas acumuladas |
| `pct_mortality` | numeric | Mortalidad % como decimal (0–1) |
| `pct_availability_vs_scheduled_plants` | numeric | Disponibles / programadas |
| `pct_availability_vs_initial_plants` | numeric | Disponibles / iniciales |

**Uso:** `DISTINCT ON (cycle_key) ORDER BY cycle_key, valid_from DESC` para obtener el registro más reciente por ciclo.

#### `gld.mv_camp_kardex_bed_plants_cur`
Misma estructura pero granularidad por **cama** (`bed_id`).

#### `gld.mv_camp_kardex_valve_plants_cur`
Misma estructura pero granularidad por **válvula** (`valve_id`).

#### `gld.mv_camp_kardex_cycle_plants_day_cur`
Plantas por ciclo con granularidad **diaria** — usado para curvas de mortandad.

| Columna extra | Descripción |
|---------------|-------------|
| `event_day` | Día del ciclo (entero, desde día 1) |
| `calendar_date` | Fecha del registro |
| `daily_dead_plants` | Bajas del día |

#### `gld.mv_camp_kardex_bed_plants_day_cur`
Diario por cama. Estructura similar.

#### `gld.mv_camp_kardex_valve_plants_day_cur`
Diario por válvula. Estructura similar.

---

### Producción — Fenograma y Peso

#### `gld.mv_prod_fenograma_cur`
Tallos cosechados por ciclo (resumen semanal).

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `cycle_key` | text | ID del ciclo |
| `stems_count` | numeric | Tallos cosechados |
| `week` | int | Semana ISO |
| `year` | int | Año |

**Uso:** `SUM(stems_count) GROUP BY cycle_key` para total de tallos por ciclo.

#### `gld.mv_prod_fenograma_day_cur`
Tallos diarios. Misma estructura + `calendar_date`.

#### `gld.mv_prod_productivity_green_cur`
Peso verde (cajas) por ciclo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `cycle_key` | text | ID del ciclo |
| `green_weight_kg` | numeric | Peso verde en kg |

**Cajas:** `green_weight_kg / 10`

#### `gld.mv_prod_productivity_post_cur`
Peso post-cosecha por ciclo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `cycle_key` | text | ID del ciclo |
| `post_weight_kg` | numeric | Peso post-cosecha en kg |

#### `gld.mv_prod_hours_cycle_person_cur`
Horas laborales por ciclo y persona.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `cycle_key` | text | ID del ciclo |
| `cost_area` | text | `CAMPO` o `COSECHA` |
| `sub_cost_center` | text | Subcentro de costo |
| `activity_type` | text | Tipo de actividad |
| `activity_name` | text | Nombre de actividad |
| `effective_hours` | numeric | Horas efectivas trabajadas |
| `units_produced` | numeric | Unidades producidas |

---

### Postcosecha — Balanzas

Las vistas de balanzas siguen el patrón:
```
gld.mv_camp_ind_bal_apertura_<origen>_vs_<destino>_<metrica>_xl_np_cur
```

| Nodo | Vista peso | Vista tallos |
|------|-----------|-------------|
| BAL1 → BAL1C | `..._b1_vs_b1c_peso_xl_np_cur` | `..._b1_vs_b1c_tallos_xl_np_cur` |
| BAL1C → BAL2 | `..._b1c_vs_b2_peso_xl_np_cur` | `..._b1c_vs_b2_tallos_xl_np_cur` |
| BAL2 → BAL2A | `..._b2_vs_b2a_peso_xl_np_cur` | (solo peso) |

Destinos BAL2A: `ARCOIRIS`, `TINTURADO`, `BLANCO`

---

## Dimensiones Silver (`slv.*`) — Referencia completa

### Campo

#### `slv.camp_dim_cycle_profile_scd2`
Perfil histórico de ciclos (SCD2). Una fila por versión del ciclo.

| Columna | Tipo | Descripción |
|---------|------|-------------|
| `cycle_key` | text | ID de negocio del ciclo |
| `record_id` | int | PK de la fila SCD2 |
| `block_id` | text | ID del bloque |
| `parent_block` | text | Bloque padre (para agrupación) |
| `area_id` | text | Área |
| `variety` | text | Variedad |
| `sp_type` | text | Tipo SP (P2, P3…) |
| `sp_date` | date | Fecha de siembra/poda |
| `harvest_start_date` | date | Inicio de cosecha |
| `harvest_end_date` | date | Fin de cosecha |
| `bed_area` | numeric | Área en m² |
| `bed_count` | int | Número de camas |
| `pambiles_count` | int | Número de pambiles |
| `sum_initial_plants` | numeric | Plantas programadas agregadas del ciclo |
| `light_type` | text | Tipo de luz |
| `greenhouse` | boolean | Invernadero |
| `soil_type` | text | Tipo de suelo |
| `is_current` | boolean | `true` = registro vigente |
| `valid_from` | timestamptz | Inicio de vigencia |
| `valid_to` | timestamptz | Fin de vigencia (NULL = actual) |
| `attributes_jsonb` | jsonb | Atributos extra (incluye `status`) |

**Patrón de lectura para el registro más reciente:**
```sql
SELECT DISTINCT ON (cycle_key) *
FROM slv.camp_dim_cycle_profile_scd2
ORDER BY cycle_key, valid_from DESC NULLS LAST
```

#### `slv.camp_dim_block_profile_scd2`
Perfil de bloques. Campos clave: `block_id`, `parent_block`, `area_id`, `is_current`.

#### `slv.camp_dim_bed_profile_scd2`
Perfil de camas. Campos clave: `bed_id`, `cycle_key`, `valve_id`, `pambiles_count`, `bed_area`.

#### `slv.camp_dim_valve_profile_scd2`
Perfil de válvulas. Campos clave: `valve_id`, `cycle_key`, `block_id`.

### Talento Humano

#### `slv.tthh_dim_person_profile_scd2`
Perfil de personas (empleados). Campos: `person_id`, `gender`, `marital_status`, `city`, `job_title`, `employer_name`, `job_classification`.

#### `slv.tthh_asgn_person_area_event_scd2`
Asignación persona-área con eventos. Campos clave: `person_id`, `area_id`, `event_type` (`CA` = asignación, `IS` = ingreso/salida), `valid_from`, `valid_to`.

#### `slv.camp_dim_area_profile_scd2`
Perfil de áreas. Campos: `area_id`, `area_name`, `area_general`.

### Común

#### `slv.common_dim_calendar_date_scd0`
Calendario estable (SCD0). Campos: `calendar_date`, `iso_week`, `iso_year`, `day_of_week`. Se usa para filtros por semana ISO.

---

## Model Layer (`mdl.*`)

#### `mdl.prod_ref_vegetativo_subset_scd2`
Actividades de campo por ciclo. Campos: `cycle_key`, `activity_code`, `event_date`, `activity_type`.

Códigos de actividad relevantes:

| Código | Significado |
|--------|-------------|
| `SPMC` | Eventos del período |
| `ILUMINACION` | Inicio/Fin de iluminación |
| `FMGYP` | Fumigación |
| `03VAFIFMG` | Fumigación FM |
| `FM13` | Aplicación GA3 |

---

## Reglas de Negocio en SQL

Estas reglas son **implícitas en las queries** de `src/lib/`. Documentarlas aquí garantiza consistencia al agregar módulos.

### Regla 1 — Fallback de plantas programadas

Si el kardex no tiene datos de plantas para un ciclo, usar `sum_initial_plants` del perfil del ciclo:

```sql
-- plants_current y initial_plants_cycle con fallback al perfil
COALESCE(NULLIF(k.final_plants_count, 0),       cp.sum_initial_plants, 0) AS plants_current,
COALESCE(NULLIF(k.initial_plants_cycle, 0),     cp.sum_initial_plants, 0) AS initial_plants_cycle,
-- reseed y dead NO se imputan (solo desde kardex)
COALESCE(k.reseed_plants_count, 0)              AS reseed_plants_count,
COALESCE(k.dead_plants_count, 0)                AS dead_plants_count,
```

El fallback con lateral join (patrón más robusto, garantiza último registro):
```sql
LEFT JOIN LATERAL (
  SELECT COALESCE(cp2.sum_initial_plants, 0) AS cycle_initial_plants
  FROM slv.camp_dim_cycle_profile_scd2 cp2
  WHERE cp2.cycle_key = cp.cycle_key
  ORDER BY cp2.valid_from DESC NULLS LAST
  LIMIT 1
) cycle_fallback ON TRUE
```

### Regla 2 — Mortandad %

```
Mort% = dead_plants_count / (initial_plants_cycle + reseed_plants_count) × 100
```

Solo ciclos donde el denominador > 0. Nunca usar `final_plants_count` para calcular muertas.

### Regla 3 — Tallos / Planta

```
Tallos/Planta = total_stems / plants_current
```

Solo incluir ciclos donde `plants_current > 0`. Ciclos con 0 plantas excluyen el denominador (no aportan 0).

### Regla 4 — Camas estándar (30 m²)

```
Camas (30m²) = bed_area / 30
```

`bed_area` viene de `slv.camp_dim_cycle_profile_scd2.bed_area` en m².

### Regla 5 — Cajas desde peso verde

```
Cajas = green_weight_kg / 10
```

### Regla 6 — Peso Tallo

```
Peso Tallo (g) = (green_weight_kg × 1000) / total_stems
```

### Regla 7 — Ciclo vigente en SCD2

```sql
WHERE is_current = true
-- o equivalente:
WHERE valid_to IS NULL OR valid_to > NOW()
```

Para el registro más reciente sin importar `is_current`:
```sql
DISTINCT ON (cycle_key) ... ORDER BY cycle_key, valid_from DESC NULLS LAST
```

---

## Patrones SQL Reutilizables

### CTE estándar `cycle_profile`

```sql
cycle_profile AS (
  SELECT DISTINCT ON (cycle_key)
    cycle_key,
    COALESCE(parent_block, block_id)  AS block,
    area_id                           AS area,
    NULLIF(TRIM(variety), '')         AS variety,
    NULLIF(TRIM(sp_type), '')         AS sp_type,
    sp_date,
    harvest_start_date,
    harvest_end_date,
    COALESCE(bed_area, 0)             AS bed_area,
    COALESCE(sum_initial_plants, 0)   AS initial_plants_profile
  FROM slv.camp_dim_cycle_profile_scd2
  ORDER BY cycle_key, valid_from DESC NULLS LAST
),
```

### CTE estándar `kardex`

```sql
kardex AS (
  SELECT DISTINCT ON (cycle_key)
    cycle_key,
    COALESCE(final_plants_count, 0)   AS plants_current,
    COALESCE(initial_plants_cycle, 0) AS initial_plants_cycle,
    COALESCE(reseed_plants_count, 0)  AS reseed_plants_count,
    COALESCE(dead_plants_count, 0)    AS dead_plants_count,
    pct_mortality
  FROM gld.mv_camp_kardex_cycle_plants_cur
  ORDER BY cycle_key, valid_from DESC NULLS LAST
),
```

### Lateral join para fallback de plantas (patrón ficha del bloque)

```sql
LEFT JOIN LATERAL (
  SELECT
    initial_plants                               AS programmed_plants,
    initial_plants_cycle                         AS cycle_start_plants,
    dead_plants_count                            AS plants_dead,
    reseed_plants_count                          AS plants_reseeded,
    final_plants_count                           AS plants_current,
    pct_availability_vs_scheduled_plants         AS availability_vs_scheduled_pct,
    pct_availability_vs_initial_plants           AS availability_vs_initial_pct,
    pct_mortality                                AS mortality_pct
  FROM gld.mv_camp_kardex_cycle_plants_cur
  WHERE cycle_key = cp.cycle_key
  ORDER BY valid_from DESC NULLS LAST
  LIMIT 1
) plants ON TRUE

LEFT JOIN LATERAL (
  SELECT COALESCE(cp2.sum_initial_plants, 0) AS cycle_initial_plants
  FROM slv.camp_dim_cycle_profile_scd2 cp2
  WHERE cp2.cycle_key = cp.cycle_key
  ORDER BY cp2.valid_from DESC NULLS LAST
  LIMIT 1
) cycle_fallback ON TRUE
```

En el SELECT:
```sql
COALESCE(NULLIF(plants.programmed_plants, 0), NULLIF(cycle_fallback.cycle_initial_plants, 0)) AS programmed_plants,
COALESCE(NULLIF(plants.plants_current, 0),    NULLIF(cycle_fallback.cycle_initial_plants, 0)) AS plants_current,
```

### Patrón `DISTINCT ON` con lateral (ciclo más reciente)

```sql
SELECT DISTINCT ON (cp.cycle_key)
  cp.cycle_key,
  cp.block_id,
  ...
FROM slv.camp_dim_cycle_profile_scd2 cp
LEFT JOIN LATERAL (
  SELECT ... FROM gld.mv_camp_kardex_cycle_plants_cur k
  WHERE k.cycle_key = cp.cycle_key
  ORDER BY k.valid_from DESC NULLS LAST
  LIMIT 1
) kardex ON TRUE
ORDER BY cp.cycle_key, cp.valid_from DESC NULLS LAST
```

---

## TTLs de cache por vista

| Tipo de datos | TTL |
|---------------|-----|
| Dashboard principal (KPIs) | 30 s |
| Detalle de bloque/ciclo | 60 s |
| Opciones de filtro | 5 min |
| Perfiles de persona | 5 min |
| Programaciones | 5 min |
| Balanzas | 5–30 min según métrica |

El cache es en memoria del proceso Node.js (`src/server/cache.ts → cachedAsync`). Se invalida al reiniciar.

---

## Convenciones de mapeo a UI

### Porcentajes — escala `percent` (0–100) vs `ratio` (0–1)

Distintos endpoints devuelven porcentajes en distinta escala. Para evitar bugs por factor 100, **todo callsite de `formatPercent` debe pasar `input` explícito** o conocer el default.

| Origen | Escala devuelta | Cómo formatear |
|---|---|---|
| `mortality_pct`, `availabilityVsScheduledPct`, `availabilityVsInitialPct` (mortality / fenograma / productividad) | `0..100` | `formatPercent(value)` o `formatPercent(value, { input: "percent" })` |
| `dominantePct`, `homogeneousPct`, `visibleMeanPct`, `lowerLimitPct` (calidad punto-apertura) | `0..100` (backend multiplica × 100 en `calidad-punto-apertura.ts`) | `formatPercent(value)` |
| `rendimientoPct` (productividad / fenograma / talento) | `0..100` | `formatPercent(value)` |
| Comparación (`comparacion.ts`) | `0..1` (normalizado por `toPercentRatio` heurístico) | Helper local `formatPercent(value)` que envuelve `formatPercentShared` con `input: "ratio"` |
| Solver Python (cumplimiento, sobrepeso, etc.) | `0..1` | `formatPercent(value, { input: "ratio" })` |
| Cálculos cliente (`count / total`) | `0..1` | `formatPercent(value, { input: "ratio" })` |

**Default:** `formatPercent(v)` sin opciones asume `input: "percent"` (escala 0–100). Si la fuente es ratio decimal, **siempre pasar `input: "ratio"`**.

Ver tests: `src/shared/lib/__tests__/format.test.ts` (12 casos cubren ambos contratos + edge cases).

### Semanas ISO — formato canónico

| Contexto | Formato | Ejemplo |
|---|---|---|
| Backend (`iso_week_id` en SQL) | `YYYYWW` numérico string | `"202614"` |
| Filtros UI (selectores) | `YYYYWW` (mismo que backend) | El usuario ve `"202614"` en el selector |
| Etiquetas en gráficos / tooltips | `Sem WW (YYYY)` o solo `WW` si el año es contextual | `Sem 14 (2026)` |
| Componente canónico cliente | `WeekField` / `MultiSelectField` con lista de `availableWeeks` del endpoint | — |

**Regla:** mientras el formato visual al usuario sea consistente dentro de un explorer, está OK. NO mezclar `YYYYWW` con `YYYY-Wxx` ni con número de semana suelto en el mismo módulo. El formato `"202614"` es el más común y aceptable.

`WeekField` (`src/shared/filters/week-field.tsx`) está disponible para casos de selección puntual de una semana. Para rangos / multi-selección, los explorers actuales usan `SingleSelectField` / `MultiSelectField` con la lista de `availableWeeks` del endpoint — patrón válido y documentado aquí.
