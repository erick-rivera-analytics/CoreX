> Referencia vigente. Fuente de verdad: `src/config/module-catalog.ts`.

# Módulos — Catálogo de referencia

Referencia por módulo activo: propósito, datos, KPIs, archivos clave y endpoints. La fuente de verdad de metadatos (nombre, ícono, href, RBAC) es `src/config/module-catalog.ts`.

---

## Índice

| Módulo | Ruta | Sección |
|--------|------|---------|
| [Campo](#campo) | `/dashboard/campo` | Dashboard |
| [Fenograma](#fenograma) | `/dashboard/fenograma` | Dashboard |
| [Mortandades](#mortandades) | `/dashboard/mortality` | Dashboard |
| [Comparación](#comparacion) | `/dashboard/comparacion` | Dashboard |
| [Productividad](#productividad) | `/dashboard/productividad` | Dashboard |
| [Balanzas](#balanzas) | `/dashboard/postcosecha/balanzas` | Dashboard |
| [Composición Laboral](#composicion-laboral) | `/dashboard/talento-humano/composicion-laboral` | Dashboard |
| [Demografía Personal](#demografia-personal) | `/dashboard/talento-humano/demografia-personal` | Dashboard |
| [Rotación Laboral](#rotacion-laboral) | `/dashboard/talento-humano/rotacion-laboral` | Dashboard |
| [Seguimientos Trabajo Social](#seguimientos-trabajo-social) | `/dashboard/talento-humano/seguimientos` | Gestión |
| [Programaciones](#programaciones) | `/dashboard/programaciones` | Gestión |
| [Administrar SKUs](#administrar-skus) | `/dashboard/postcosecha/administrar-maestros/skus` | Gestión |
| [Clasificación en Blanco](#clasificacion-en-blanco) | `/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco` | Gestión |
| [Usuarios](#usuarios) | `/dashboard/admin/seguridad/usuarios` | Administración |
| [Mi trabajo](#mi-trabajo) | `/dashboard/mi-trabajo` | Personal |
| [Mi cuenta](#mi-cuenta) | `/dashboard/mi-cuenta` | Personal |

---

## Campo

**Propósito:** Mapa interactivo de los bloques de campo con intensidad de producción e indicadores por bloque.

**Ruta:** `/dashboard/campo`

**Archivos clave:**
- `src/modules/campo/components/campo-explorer.tsx`
- `src/modules/campo/components/campo-map.tsx` (Leaflet map)
- `src/lib/campo.ts`
- `src/app/(dashboard)/dashboard/campo/page.tsx`

**Fuentes de datos:**
- `data/campo-geo.json` — geometría de bloques (GeoJSON)
- `data/campo-blocks-map.json` — features con áreas
- `slv.camp_dim_cycle_profile_scd2` — ciclo vigente por bloque
- `slv.camp_dim_block_profile_scd2` — mapping bloque → área
- `gld.mv_prod_fenograma_cur` — tallos para intensidad de color

**KPIs / Vista:**
- Mapa coroplético: bloques coloreados por intensidad de tallos (normalizado 0–1)
- Popup por bloque: área, variedad, tipo SP, ciclo activo

**Notas técnicas:**
- Leaflet requiere colores CSS directos (no tokens) — excepción documentada en `ui-canon.md`
- Los `eventHandlers` del Popup deben ser memoizados con `useMemo` para evitar stack overflow

**API endpoints:** Ninguno (datos cargados server-side en `page.tsx`)

---

## Fenograma

**Propósito:** Pivot semanal de producción por ciclo. Muestra tallos cosechados por semana, perfil completo del ciclo, plantas, válvulas, camas y horas.

**Ruta:** `/dashboard/fenograma`

**Archivos clave:**
- `src/modules/fenograma/components/fenograma-explorer.tsx`
- `src/modules/fenograma/components/fenograma-block-modal.tsx` (modal grande — pendiente de partir)
- `src/lib/fenograma-core.ts` (monolito — 90 KB, ver `quality-baseline.md`)
- `src/app/api/fenograma/`

**Fuentes de datos:**
| Vista | Uso |
|-------|-----|
| `gld.mv_prod_fenograma_cur` | Tallos semanales por ciclo |
| `gld.mv_prod_fenograma_day_cur` | Tallos diarios (curva de cosecha) |
| `gld.mv_camp_kardex_cycle_plants_cur` | Plantas por ciclo |
| `gld.mv_camp_kardex_bed_plants_cur` | Plantas por cama |
| `gld.mv_camp_kardex_valve_plants_cur` | Plantas por válvula |
| `gld.mv_prod_hours_cycle_person_cur` | Horas laborales por ciclo/persona |
| `slv.camp_dim_cycle_profile_scd2` | Perfil del ciclo (SCD2) |
| `slv.camp_dim_bed_profile_scd2` | Perfil de camas |
| `slv.camp_dim_valve_profile_scd2` | Perfil de válvulas |

**KPIs principales:**
- Tallos por semana (pivot grid)
- Plantas programadas / vigentes / muertas / resembradas
- Disponibilidad vs programadas y vs iniciales
- Mortalidad %
- Horas por persona

**Filtros:** includeActive, includePlanned, includeHistory, area, variety, spType, startWeek, endWeek

**API endpoints:**
- `GET /api/fenograma/pivot` — dashboard pivot
- `GET /api/fenograma/block/[parentBlock]` — perfil de bloque con ciclos
- `GET /api/fenograma/cycle/[cycleKey]/beds` — camas del ciclo
- `GET /api/fenograma/cycle/[cycleKey]/curve` — curva de cosecha
- `GET /api/fenograma/cycle/[cycleKey]/hours` — horas del ciclo
- `GET /api/fenograma/cycle/[cycleKey]/hours/person/[personId]` — detalle persona
- `GET /api/fenograma/cycle/[cycleKey]/valves` — válvulas del ciclo
- `GET /api/fenograma/cycle/[cycleKey]/valves/[valveId]` — detalle válvula

---

## Mortandades

**Propósito:** Análisis de mortalidad de plantas. Curvas diarias acumuladas y diferenciales por ciclo, válvula y cama.

**Ruta:** `/dashboard/mortality`

**Archivos clave:**
- `src/modules/mortality/components/mortality-explorer.tsx`
- `src/modules/mortality/components/mortality-curve-chart.tsx`
- `src/lib/mortality.ts`
- `src/app/api/mortality/`

**Fuentes de datos:**
| Vista | Uso |
|-------|-----|
| `gld.mv_camp_kardex_cycle_plants_cur` | Resumen de plantas y mortandad por ciclo |
| `gld.mv_camp_kardex_cycle_plants_day_cur` | Mortandad diaria por ciclo |
| `gld.mv_camp_kardex_valve_plants_day_cur` | Mortandad diaria por válvula |
| `gld.mv_camp_kardex_bed_plants_day_cur` | Mortandad diaria por cama |
| `gld.mv_camp_kardex_bed_plants_cur` | Plantas programadas por cama |

**KPIs principales:**
- Mort% ciclo: `dead_plants_count / (initial_plants_cycle + reseed_plants_count)`
- Curva diaria acumulada (`cumulativeMortalityPct`)
- Curva diferencial diaria (`dailyMortalityPct`)
- Distribución de muertes por entidad (cama, válvula)

**Filtros:** area, spType, variety, parentBlock, block

**API endpoints:**
- `GET /api/mortality` — dashboard principal
- `GET /api/mortality/curve` — curva agregada
- `GET /api/mortality/cycle/[cycleKey]/curve` — curva por ciclo
- `GET /api/mortality/cycle/[cycleKey]/beds/[bedId]/curve` — curva por cama
- `GET /api/mortality/cycle/[cycleKey]/valves/[valveId]/curve` — curva por válvula

**Nota técnica:** El chart `mortality-curve-chart.tsx` usa `<Area>` + `<Line>` con el mismo `name`. El payload del tooltip se deduplica por `name` para evitar React key duplicado.

---

## Comparacion

**Propósito:** Comparación lado a lado de dos ciclos. Radar chart de métricas normalizadas con preferencias de dirección (mayor/menor es mejor).

**Ruta:** `/dashboard/comparacion`

**Archivos clave:**
- `src/modules/comparacion/components/comparacion-explorer.tsx`
- `src/lib/comparacion.ts`
- `src/app/api/comparacion/`

**Fuentes de datos:**
| Vista | Uso |
|-------|-----|
| `gld.mv_prod_fenograma_cur` | Opciones de ciclos (búsqueda) |
| `gld.mv_camp_kardex_cycle_plants_cur` | Métricas de plantas para comparación |
| `slv.camp_dim_cycle_profile_scd2` | Perfil dimensional |

**Métricas comparadas:**
| Métrica | Preferencia |
|---------|-------------|
| Tallos | Mayor = mejor |
| Disp. vs programadas | Mayor = mejor |
| Disp. vs iniciales | Mayor = mejor |
| Mortandad % | Menor = mejor |
| Plantas muertas | Menor = mejor |
| Plantas resembradas | Neutral |

**Filtros de búsqueda:** q (texto), area, block, variety, limit (1–40)

**API endpoints:**
- `GET /api/comparacion/options` — búsqueda de ciclos
- `GET /api/comparacion/pair?left=&right=` — datos del par

**Nota:** No usa `KpiGrid` — el layout de batalla es el contenido principal (excepción documentada en `ui-canon.md`).

---

## Productividad

**Propósito:** KPIs de productividad ponderados por ciclo y año de cosecha. Incluye desglose por tipo de costo (CAMPO / COSECHA).

**Ruta:** `/dashboard/productividad`

**Archivos clave:**
- `src/modules/productividad/components/productividad-explorer.tsx`
- `src/lib/productividad.ts`
- `src/app/api/productividad/`

**Fuentes de datos:**
| Constante en código | Vista | Uso |
|---------------------|-------|-----|
| `PROD_HOURS_SOURCE` | `gld.mv_prod_hours_cycle_person_cur` | Horas efectivas, unidades producidas |
| `KARDEX_CYCLE_SOURCE` | `gld.mv_camp_kardex_cycle_plants_cur` | Plantas, mortandad |
| `FENOGRAMA_SOURCE` | `gld.mv_prod_fenograma_cur` | Tallos cosechados |
| `PRODUCTIVITY_POST_SRC` | `gld.mv_prod_productivity_post_cur` | Peso post-cosecha |
| `PRODUCTIVITY_GREEN_SRC` | `gld.mv_prod_productivity_green_cur` | Peso verde (→ cajas) |
| `CYCLE_PROFILE_SOURCE` | `slv.camp_dim_cycle_profile_scd2` | Perfil del ciclo + fallback de plantas |

**KPIs principales (todos ponderados por ciclo):**

| KPI | Fórmula |
|-----|---------|
| Mort % | `Σ(dead_plants) / Σ(initial_plants + reseed_plants) × 100` |
| Tallos/Planta | `Σ(stems) / Σ(plants_current)` solo ciclos con `plants_current > 0` |
| Peso Tallo (g) | `Σ(green_kg) × 1000 / Σ(stems)` |
| Cajas/Cama | `Σ(cajas) / Σ(camas 30m²)` |
| Hora/Caja | `Σ(horas) / Σ(cajas)` |
| Hora/Cama | `Hora/Caja × Caja/Cama` |

**Filtros:** year, month, spType, variety, area, status (activo/cerrado), costArea (CAMPO/COSECHA/all)

**API endpoints:**
- `GET /api/productividad` — dashboard completo
- `GET /api/productividad/[cycleKey]/detail` — detalle de horas por ciclo

---

## Balanzas

**Propósito:** Indicadores de balance de peso y tallos entre estaciones de la línea de postcosecha.

**Ruta:** `/dashboard/postcosecha/balanzas`

**Archivos clave:**
- `src/modules/postcosecha/components/balanzas-explorer.tsx`
- `src/lib/postcosecha-balanzas-core.ts` (monolito — 45 KB, ver `quality-baseline.md`)
- `src/app/api/postcosecha/balanzas/`

**Fuentes de datos:**
Vistas `gld.mv_camp_ind_bal_apertura_*` para cada nodo de balanza (BAL1→BAL1C, BAL1C→BAL2, BAL2→BAL2A). Ver `datos.md` sección "Postcosecha — Balanzas" para el naming completo.

**Filtros:** metric, year, month, dayName, destination, weekMode, weekValue, dateFrom, dateTo

**API endpoints:**
- `GET /api/postcosecha/balanzas`

---

## Composicion Laboral

**Propósito:** Snapshot de composición del personal activo por área, género, cargo y clasificación laboral.

**Ruta:** `/dashboard/talento-humano/composicion-laboral`

**Archivos clave:**
- `src/modules/talento-humano/components/composicion-laboral-explorer.tsx`
- `src/lib/talento-humano.ts`
- `src/app/api/talento-humano/activos/`

**Fuentes de datos:**
| Vista | Uso |
|-------|-----|
| `slv.tthh_asgn_person_area_event_scd2` | Asignaciones activas (event_type = CA) |
| `slv.tthh_dim_person_profile_scd2` | Perfil demográfico |
| `slv.camp_dim_area_profile_scd2` | Nombre y grupo de área |
| `slv.common_dim_calendar_date_scd0` | Resolución de fecha de snapshot |

**Filtros:** snapshotDate, areaGeneral, area, gender, maritalStatus, city, jobTitle, employerName, jobClassification, associatedWorker

**API endpoints:**
- `GET /api/talento-humano/activos`
- `GET /api/talento-humano/persona/[personId]`

---

## Demografia Personal

**Propósito:** Distribución demográfica del personal (edad, género, estado civil, ciudad, antigüedad).

**Ruta:** `/dashboard/talento-humano/demografia-personal`

**Archivos clave:**
- `src/modules/talento-humano/components/demografia-explorer.tsx`
- `src/lib/talento-humano.ts`
- `src/app/api/talento-humano/activos/`

**Fuentes de datos:** Mismas que Composición Laboral.

**API endpoints:**
- `GET /api/talento-humano/activos`
- `GET /api/talento-humano/persona/[personId]`

---

## Rotacion Laboral

**Propósito:** Análisis de ingresos, salidas y tasa de rotación laboral por semana.

**Ruta:** `/dashboard/talento-humano/rotacion-laboral`

**Archivos clave:**
- `src/modules/talento-humano/components/rotacion-explorer.tsx`
- `src/lib/talento-humano.ts`
- `src/app/api/talento-humano/rotacion/`

**Fuentes de datos:**
| Vista | Uso |
|-------|-----|
| `slv.tthh_asgn_person_area_event_scd2` | Eventos IS (ingresos/salidas) |
| `slv.common_dim_calendar_date_scd0` | Semanas ISO |

**Filtros:** weekFrom, weekTo, area, areaGeneral, gender, jobTitle, jobClassification

**API endpoints:**
- `GET /api/talento-humano/rotacion`

---

## Programaciones

**Propósito:** Vista de programación de actividades de campo (SPMC, iluminación, fumigación, GA3) en un rango de fechas.

**Ruta:** `/dashboard/programaciones`

**Archivos clave:**
- `src/modules/programaciones/components/programaciones-explorer.tsx`
- `src/lib/programaciones.ts`
- `src/app/api/programaciones/`

**Fuentes de datos:**
| Vista | Uso |
|-------|-----|
| `mdl.prod_ref_vegetativo_subset_scd2` | Actividades del ciclo con fechas |
| `slv.camp_dim_cycle_profile_scd2` | Perfil del ciclo (variedad, fechas) |
| `slv.camp_dim_block_profile_scd2` | Área del bloque |

**Fases de ciclo:** Planificado, Vegetativo, Cosecha, Historia

**Filtros:** dateFrom, dateTo (requeridos)

**API endpoints:**
- `GET /api/programaciones?dateFrom=&dateTo=`
- `GET /api/programaciones/cycle-range/[cycleKey]`
- `GET /api/programaciones/debug` (internal-dev-only)

---

## Administrar SKUs

**Propósito:** CRUD de maestros de SKUs para postcosecha.

**Ruta:** `/dashboard/postcosecha/administrar-maestros/skus`

**Archivos clave:**
- `src/modules/postcosecha/components/skus-explorer.tsx`
- `src/lib/postcosecha-skus.ts`
- `src/app/api/postcosecha/administrar-maestros/skus/`

**API endpoints:**
- `GET /api/postcosecha/administrar-maestros/skus`
- `POST /api/postcosecha/administrar-maestros/skus` (rate-limited: 20/min)
- `PATCH /api/postcosecha/administrar-maestros/skus/[skuId]`

---

## Clasificacion en Blanco

**Propósito:** Solver de clasificación (Python) para distribución de tallos en postcosecha. Incluye configuración de recetas y ejecución del solver.

**Ruta:** `/dashboard/postcosecha/planificacion/solver/clasificacion-en-blanco`

**Archivos clave:**
- `src/modules/postcosecha/components/clasificacion-explorer.tsx`
- `src/lib/postcosecha-clasificacion.ts`
- `src/app/api/postcosecha/planificacion/solver/clasificacion-en-blanco/`

**Nota:** El solver usa Python (`POSTHARVEST_SOLVER_PYTHON`, `POSTHARVEST_SOLVER_ROOT`). Las rutas de API son `runtime: nodejs` explícito.

**API endpoints:**
- `GET /api/postcosecha/planificacion/solver/clasificacion-en-blanco` — boot data
- `POST /api/postcosecha/planificacion/solver/clasificacion-en-blanco` — ejecutar solver
- `POST /api/postcosecha/planificacion/solver/clasificacion-en-blanco/receta` — guardar receta

---

## Usuarios

**Propósito:** Administración de usuarios del sistema (crear, editar, activar/desactivar, asignar roles y permisos).

**Ruta:** `/dashboard/admin/seguridad/usuarios`

**Archivos clave:**
- `src/modules/users/components/users-explorer.tsx`
- `src/lib/users.ts`
- `src/app/api/admin/users/`

**Roles disponibles:** `superadmin`, `viewer`, `custom`

**API endpoints:**
- `GET /api/admin/users`
- `POST /api/admin/users` (rate-limited: 10/min)
- `GET /api/admin/users/[userId]`
- `PATCH /api/admin/users/[userId]`
- `DELETE /api/admin/users/[userId]`

---

## Mi trabajo

**Propósito:** Espacio operativo personal por usuario: tareas, calendario, agenda y recordatorios sobre espacios propios (ej. Personal, Proyecto X).

**Ruta:** `/dashboard/mi-trabajo`

**Archivos clave:**
- `src/modules/my-work/components/my-work-explorer.tsx`
- `src/modules/my-work/components/spaces-panel.tsx` — gestor de espacios (dentro de `DialogShell`, abierto desde botón "Espacios" del header)
- `src/modules/my-work/components/{task,event,space,reminder}-form-dialog.tsx`
- `src/modules/my-work/hooks/use-my-work-actions.ts`
- `src/lib/my-work-repository.ts`
- `src/app/api/me/work/*`

**Fuentes de datos (BD `db_personal_workspace`):**
- `public.wrk_dim_space_core_scd0` — espacios del usuario
- `public.wrk_fact_task_core_scd0` — tareas (con `due_at`, `priority_code`, `status_code`, `is_starred`)
- `public.wrk_fact_event_core_scd0` — eventos (con `linked_task_id` opcional)
- `public.wrk_fact_reminder_core_scd0` — recordatorios (ligados a tarea o evento)
- `public.wrk_fact_activity_log_cur` — bitácora de acciones del workspace

**Segmentos UI:** `today`, `list`, `calendar`, `agenda`.

**API endpoints:**
- `GET/PATCH /api/me/work` (bootstrap)
- `GET/POST /api/me/work/spaces`, `PATCH/DELETE /api/me/work/spaces/[spaceId]` (soporta `?hard=true` para eliminación permanente de espacios no-default)
- `GET/POST /api/me/work/tasks`, `PATCH/DELETE /api/me/work/tasks/[taskId]`
- `GET/POST /api/me/work/events`, `PATCH/DELETE /api/me/work/events/[eventId]`
- `GET/POST /api/me/work/reminders`, `PATCH /api/me/work/reminders/[reminderId]`

**Notas:**
- Gestión de espacios vive en un `DialogShell` lanzado desde el header — no panel inline.
- Solo los espacios no-default pueden eliminarse (hard delete) con confirmación.

---

## Mi cuenta

**Propósito:** Panel compacto de identidad + estado personal. Reemplaza el formulario técnico anterior.

**Ruta:** `/dashboard/mi-cuenta`

**Archivos clave:**
- `src/modules/my-account/components/my-account-explorer.tsx` — layout 2 columnas `xl:grid-cols-[0.9fr_1.1fr]`
- `src/modules/my-account/components/identity-card.tsx`
- `src/modules/my-account/components/operational-summary-card.tsx`
- `src/modules/my-account/components/recent-access-card.tsx` (empty state honesto)
- `src/modules/my-account/components/notification-status-card.tsx`
- `src/modules/my-account/components/profile-preferences-form.tsx` — solo `displayName` + `contactEmail`
- `src/modules/my-account/components/notification-preferences-form.tsx` — 3 toggles in-app activos, 3 email disabled con badge "Próximamente"
- `src/lib/my-account-repository.ts`
- `src/app/api/me/profile/route.ts`

**Fuentes de datos (BD `db_personal_workspace`):**
- `public.usr_dim_profile_pref_scd0` — perfil del usuario (SCD0, una fila por `auth_user_id`)
  - Activas en UI: `display_name`, `contact_email` (nuevo), `notification_prefs_jsonb`
  - Deprecadas (persisten por compat GET/PATCH, no editables): `avatar_url`, `bio_text`, `locale_code`, `timezone_name`, `theme_code`, `default_route`, `default_calendar_view_code`, `default_task_view_code`, `week_start_iso`
- Resumen operativo → `getMyWorkSummary()` (reusa `wrk_*`)
- Accesos recientes → **empty state** (sin fuente; pendiente tabla `auth_session_audit_*`)

**API endpoints:**
- `GET /api/me/profile` — shape completo (compat)
- `PATCH /api/me/profile` — `profilePatchSchema.partial()` acepta los 12 campos; la UI solo envía 3 campos editables + pass-through

**Migración DB:** `alter table public.usr_dim_profile_pref_scd0 add column if not exists contact_email text;` (idempotente).

---

## Seguimientos Trabajo Social

**Clave catálogo:** `talento-seguimientos`
**Ruta:** `/dashboard/talento-humano/seguimientos`
**Sección:** Gestión / Talento Humano / Registros

Permite a Trabajo Social consultar los seguimientos programados (AGR o ADM) y registrar las respuestas estructuradas directamente desde la interfaz.

**Datos:**
- Seguimientos programados: `gld.vw_tthh_asg_followup_scd2` (base principal DW).
- Perfil persona (punto en el tiempo): `slv.tthh_dim_person_profile_scd2` + `slv.tthh_asgn_person_area_event_scd2` (base principal).
- Respuestas registradas: `db_human_talent.public.tthh_fact_employee_followup_response_cur` (cluster secundario).
- Selecciones multiselect: `db_human_talent.public.tthh_asgn_employee_followup_catalog_selection_cur`.
- Catálogos: `db_human_talent.public.common_dim_catalog_item_scd2`.

La composición DW + db_human_talent se realiza **en la API** (no por SQL JOIN) ya que son clusters separados.

**Rutas de seguimiento:**
- `AGR` — Para colaboradores con `job_classification_code = 'AGRICOLA'` o `follow_up_type` agrícola.
- `ADM` — Para colaboradores con `job_classification_code = 'ADMINISTRATIVO'`.

**KPIs disponibles:** Programados, Pendientes, Registrados, Anulados.

**Versionado de respuestas:** Cada respuesta tiene `correction_group_id` (identifica la cadena de correcciones), `response_version` (incrementa por corrección), `supersedes_event_id` (apunta a la versión anterior) e `is_latest_valid_version` (true solo en la última versión activa).

**RBAC:**
- `panel:tthh.followups.view` — Ver seguimientos.
- `panel:tthh.followups.write` — Registrar respuestas (POST).
- `panel:tthh.followups.sensitive` — Ver campos sensibles (familia, embarazo, conflictos, RRHH).
- `panel:tthh.followups.admin` — Corregir y anular (PATCH).

**Archivos clave:**
- `src/app/(dashboard)/dashboard/talento-humano/seguimientos/page.tsx`
- `src/modules/talento-humano/seguimientos/components/seguimientos-page.tsx`
- `src/modules/talento-humano/seguimientos/components/followup-workspace.tsx`
- `src/lib/talento-humano-seguimientos-schedule.ts`
- `src/lib/talento-humano-seguimientos-responses.ts`
- `src/lib/human-talent-db.ts`
- `sql/db_human_talent.sql`

**API endpoints:** `GET /api/talento-humano/seguimientos/boot`, `GET /api/talento-humano/seguimientos/followup-search`, `POST /api/talento-humano/seguimientos/responses` (+ más — ver `docs/apis.md`).

**Prerequisito de BD:** antes de registrar respuestas, aplicar `sql/db_human_talent.sql` contra `db_human_talent` (ver `docs/despliegue.md`). Si la BD no está lista, el módulo carga con selectores vacíos (degradación graceful) pero el POST falla. El catálogo `agr_followup_frequency` requiere seed manual post-descubrimiento (ver `docs/datos.md`).

---

## Módulos ocultos (no activos en nav)

| Módulo | Ruta | Estado |
|--------|------|--------|
| Postcosecha Registros | `/dashboard/postcosecha/registros` | `hidden` |
| Postcosecha Programaciones | `/dashboard/postcosecha/planificacion/programaciones` | `hidden` |
| Postcosecha Plan de Trabajo | `/dashboard/postcosecha/planificacion/plan-de-trabajo` | `hidden` |

Accesibles con permisos explícitos pero no visibles en navegación.
