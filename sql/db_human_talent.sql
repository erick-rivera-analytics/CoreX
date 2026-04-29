-- ============================================================================
-- db_human_talent.public — Esquema del módulo Seguimientos Trabajo Social
-- ============================================================================
-- Idempotente: ejecutable múltiples veces sin destruir datos.
-- Solo crea/actualiza estructuras y asegura semillas básicas de catálogos.
--
-- `agr_followup_frequency` se seedea con los valores reales T1..T5 observados en
-- `gld.mv_tthh_asgn_followup_scd2.follow_up_type`.
--
-- Aplicar con: node scripts/apply-human-talent-sql.mjs
-- ============================================================================

create extension if not exists pgcrypto;

-- ============================================================================
-- 1. CATÁLOGOS GOBERNADOS (SCD2)
-- ============================================================================

-- 1.1 Grupos de catálogo
create table if not exists public.common_dim_catalog_group_scd2 (
  record_id uuid primary key default gen_random_uuid(),
  catalog_code text not null,
  catalog_name text not null,
  catalog_description text,
  module_code text not null default 'tthh_followups',
  is_system_catalog boolean not null default false,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  is_current boolean not null default true,
  is_valid boolean not null default true,
  loaded_at timestamptz not null default now(),
  run_id text not null,
  actor_id text,
  change_reason text not null,
  constraint uq_common_catalog_group_code_from
    unique (catalog_code, valid_from),
  constraint chk_common_catalog_group_validity_window
    check (valid_to is null or valid_to >= valid_from)
);

create unique index if not exists uq_common_catalog_group_active
  on public.common_dim_catalog_group_scd2 (catalog_code)
  where is_current = true and is_valid = true;

create index if not exists ix_common_catalog_group_module
  on public.common_dim_catalog_group_scd2 (module_code);

comment on table public.common_dim_catalog_group_scd2 is
  'Grupos de catálogo gobernados con SCD2. Cada catalog_code (ej. work_difficulty) tiene a lo sumo una versión activa simultánea.';

-- 1.2 Items de catálogo
create table if not exists public.common_dim_catalog_item_scd2 (
  record_id uuid primary key default gen_random_uuid(),
  catalog_code text not null,
  item_code text not null,
  item_label_es text not null,
  item_label_en text,
  item_description text,
  display_order integer not null default 0,
  attributes_jsonb jsonb not null default '{}'::jsonb,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  is_current boolean not null default true,
  is_valid boolean not null default true,
  loaded_at timestamptz not null default now(),
  run_id text not null,
  actor_id text,
  change_reason text not null,
  constraint uq_common_catalog_item_code_from
    unique (catalog_code, item_code, valid_from),
  constraint chk_common_catalog_item_validity_window
    check (valid_to is null or valid_to >= valid_from)
);

create unique index if not exists uq_common_catalog_item_active
  on public.common_dim_catalog_item_scd2 (catalog_code, item_code)
  where is_current = true and is_valid = true;

create index if not exists ix_common_catalog_item_catalog
  on public.common_dim_catalog_item_scd2 (catalog_code)
  where is_current = true and is_valid = true;

comment on table public.common_dim_catalog_item_scd2 is
  'Ítems pertenecientes a un catalog_code. Único activo por (catalog_code, item_code) cuando is_current y is_valid.';

-- 1.3 Asignación de catálogo a columna/tabla (auditable)
create table if not exists public.common_asgn_catalog_usage_cur (
  catalog_usage_id uuid primary key default gen_random_uuid(),
  catalog_code text not null,
  table_schema text not null,
  table_name text not null,
  column_name text not null,
  usage_role text not null,
  is_required boolean not null default false,
  is_valid boolean not null default true,
  loaded_at timestamptz not null default now(),
  run_id text not null,
  actor_id text,
  change_reason text not null,
  constraint uq_common_catalog_usage
    unique (catalog_code, table_schema, table_name, column_name, usage_role)
);

create index if not exists ix_common_catalog_usage_target
  on public.common_asgn_catalog_usage_cur (table_schema, table_name, column_name);

comment on table public.common_asgn_catalog_usage_cur is
  'Registro de qué columnas (de qué tablas) usan qué catálogo. Permite auditar cobertura/inconsistencias.';

-- ============================================================================
-- 2. FACT — RESPUESTAS DE SEGUIMIENTO
-- ============================================================================

create table if not exists public.tthh_fact_employee_followup_response_cur (
  -- Identidad y versionado
  event_id uuid primary key default gen_random_uuid(),
  correction_group_id uuid not null,
  supersedes_event_id uuid references public.tthh_fact_employee_followup_response_cur(event_id),
  response_version integer not null default 1,
  is_latest_valid_version boolean not null default true,

  -- Vínculos de negocio (referencias lógicas a DW; sin FK porque vive en otra base)
  unique_follow_up_code text not null,
  follow_up_code text not null,
  person_id text not null,

  -- Tipo / ruta
  followup_route_code text not null,
  followup_route_source text not null,
  scheduled_follow_up_type text,
  job_classification_code_snapshot text,
  form_source_code text not null default 'corex_internal',

  -- Tiempo
  event_at timestamptz not null,
  event_date date not null,
  follow_up_date date not null,
  event_time_precision text not null default 'date',
  event_at_imputed boolean not null default true,

  -- AGR — frecuencia
  agr_followup_frequency_code text,

  -- AGR — dificultades laborales (opciones en tabla puente)
  work_difficulty_observation text,

  -- AGR — relaciones laborales / trato
  coworker_treatment_rating_code text,
  supervisor_treatment_rating_code text,
  area_manager_treatment_rating_code text,
  conflict_person_id text,
  conflict_situation_detail text,

  -- AGR — satisfacción y oportunidades (multiselección en tabla puente; aquí solo observaciones)
  -- NOTA: NO crear `work_like_most_code` ni `improvement_opportunity_code` (multiselección)
  work_like_most_observation text,
  improvement_opportunity_observation text,
  agr_satisfaction_observation text,

  -- AGR — permanencia (razones cortas en tabla puente)
  retention_intention_code text,
  retention_reason_observation text,

  -- AGR — Talento Humano
  hr_support_need_code text,
  hr_support_need_other_detail text,
  family_pregnancy_relation_code text,
  family_pregnancy_observation text,

  -- AGR — inconvenientes
  has_inconvenience_code text,
  inconvenience_date date,
  inconvenience_activity_code text,
  inconvenience_activity_other_detail text,
  inconvenience_type_code text,
  inconvenience_type_other_detail text,

  -- ADM — frecuencia / etapa
  adm_followup_frequency_code text,

  -- ADM — adaptación inicial
  induction_sufficient_code text,
  transport_problem_code text,
  team_welcome_code text,
  adaptation_negative_observation text,
  adaptation_suggestion text,

  -- ADM — satisfacción periodo de prueba
  role_clarity_satisfaction_code text,
  work_environment_satisfaction_code text,
  equipment_satisfaction_code text,
  probation_satisfaction_suggestion text,

  -- ADM — bimensual / final
  recent_work_satisfaction_code text,
  work_aspect_to_improve_code text,
  work_aspect_to_improve_other_detail text,
  dissatisfaction_detail text,
  final_retention_intention_code text,
  final_stay_suggestion text,

  -- Auditoría / linaje
  source_system text not null default 'corex',
  source_table text,
  source_record_id text,
  source_payload_hash text,
  is_valid boolean not null default true,
  invalid_reason_code text,
  loaded_at timestamptz not null default now(),
  run_id text not null,
  actor_id text,
  change_reason text not null,

  -- Constraints lógicos
  constraint chk_response_version_positive
    check (response_version >= 1),
  constraint chk_followup_route_code
    check (followup_route_code in ('AGR', 'ADM')),
  constraint chk_followup_route_source
    check (followup_route_source in ('scheduled_followup', 'job_classification_fallback', 'manual_admin_override')),
  constraint chk_response_supersede_increments_version
    check (supersedes_event_id is null or response_version > 1),
  constraint chk_response_is_valid_requires_reason
    check (is_valid = true or invalid_reason_code is not null),
  constraint chk_inconvenience_yes_completeness
    check (
      has_inconvenience_code is distinct from 'yes'
      or (
        inconvenience_date is not null
        and inconvenience_activity_code is not null
        and inconvenience_type_code is not null
      )
    ),
  constraint chk_conflict_person_requires_detail
    check (conflict_person_id is null or conflict_situation_detail is not null),
  constraint chk_hr_support_other_requires_detail
    check (hr_support_need_code is distinct from 'other' or hr_support_need_other_detail is not null),
  constraint chk_inconvenience_activity_other_requires_detail
    check (inconvenience_activity_code is distinct from 'other' or inconvenience_activity_other_detail is not null),
  constraint chk_inconvenience_type_other_requires_detail
    check (inconvenience_type_code is distinct from 'other' or inconvenience_type_other_detail is not null),
  constraint chk_work_aspect_other_requires_detail
    check (work_aspect_to_improve_code is distinct from 'other' or work_aspect_to_improve_other_detail is not null)
  -- NOTA event_date: omitimos check físico (event_date = event_at::date)
  --                  por riesgo de drift de timezone. Validar en API.
);

-- Índices
create unique index if not exists uq_tthh_fact_followup_active
  on public.tthh_fact_employee_followup_response_cur (unique_follow_up_code, person_id)
  where is_latest_valid_version = true and is_valid = true;

create index if not exists ix_tthh_fact_followup_unique_code
  on public.tthh_fact_employee_followup_response_cur (unique_follow_up_code);

create index if not exists ix_tthh_fact_followup_code
  on public.tthh_fact_employee_followup_response_cur (follow_up_code);

create index if not exists ix_tthh_fact_followup_person
  on public.tthh_fact_employee_followup_response_cur (person_id);

create index if not exists ix_tthh_fact_followup_route
  on public.tthh_fact_employee_followup_response_cur (followup_route_code);

create index if not exists ix_tthh_fact_followup_scheduled_type
  on public.tthh_fact_employee_followup_response_cur (scheduled_follow_up_type);

create index if not exists ix_tthh_fact_followup_date
  on public.tthh_fact_employee_followup_response_cur (follow_up_date);

create index if not exists ix_tthh_fact_followup_event_date
  on public.tthh_fact_employee_followup_response_cur (event_date);

create index if not exists ix_tthh_fact_followup_correction_group
  on public.tthh_fact_employee_followup_response_cur (correction_group_id);

create index if not exists ix_tthh_fact_followup_run
  on public.tthh_fact_employee_followup_response_cur (run_id);

create index if not exists ix_tthh_fact_followup_conflict_person
  on public.tthh_fact_employee_followup_response_cur (conflict_person_id);

create index if not exists ix_tthh_fact_followup_inconvenience_date
  on public.tthh_fact_employee_followup_response_cur (inconvenience_date);

create index if not exists ix_tthh_fact_followup_loaded_at_desc
  on public.tthh_fact_employee_followup_response_cur (loaded_at desc);

comment on table public.tthh_fact_employee_followup_response_cur is
  'Respuestas de seguimiento de Trabajo Social. Versionado por correction_group_id + response_version. is_latest_valid_version marca la versión vigente.';

-- ============================================================================
-- 3. TABLA PUENTE — MULTISELECCIÓN
-- ============================================================================

create table if not exists public.tthh_asgn_employee_followup_catalog_selection_cur (
  selection_id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.tthh_fact_employee_followup_response_cur(event_id),
  selection_group_code text not null,
  catalog_code text not null,
  item_code text not null,
  other_detail text,
  display_order integer,
  is_valid boolean not null default true,
  loaded_at timestamptz not null default now(),
  run_id text not null,
  actor_id text,
  change_reason text not null
);

create unique index if not exists uq_tthh_asgn_followup_selection_active
  on public.tthh_asgn_employee_followup_catalog_selection_cur
     (event_id, selection_group_code, catalog_code, item_code)
  where is_valid = true;

create index if not exists ix_tthh_asgn_followup_selection_event
  on public.tthh_asgn_employee_followup_catalog_selection_cur (event_id);

create index if not exists ix_tthh_asgn_followup_selection_group
  on public.tthh_asgn_employee_followup_catalog_selection_cur (selection_group_code);

create index if not exists ix_tthh_asgn_followup_selection_catalog_item
  on public.tthh_asgn_employee_followup_catalog_selection_cur (catalog_code, item_code);

comment on table public.tthh_asgn_employee_followup_catalog_selection_cur is
  'Tabla puente para preguntas multiselección: work_difficulty, work_like_most, improvement_opportunity, short_retention_reason. Reglas none-exclusivo y other-requiere-detail se validan en API.';

-- ============================================================================
-- 4. VISTAS LOCALES (solo joins dentro de db_human_talent.public)
-- ============================================================================

drop view if exists public.vw_tthh_employee_followup_catalog_mismatch_cur;
drop view if exists public.vw_tthh_employee_followup_response_with_labels_cur;
drop view if exists public.vw_tthh_employee_followup_response_history_cur;
drop view if exists public.vw_tthh_employee_followup_response_latest_cur;

-- 4.1 Última versión vigente
create view public.vw_tthh_employee_followup_response_latest_cur as
select
  f.event_id,
  f.correction_group_id,
  f.response_version,
  f.is_valid,
  f.unique_follow_up_code,
  f.follow_up_code,
  f.person_id,
  f.followup_route_code,
  f.followup_route_source,
  f.scheduled_follow_up_type,
  f.event_at,
  f.event_date,
  f.follow_up_date,
  f.agr_followup_frequency_code,
  f.adm_followup_frequency_code,
  f.has_inconvenience_code,
  f.inconvenience_date,
  f.inconvenience_activity_code,
  f.inconvenience_type_code,
  f.retention_intention_code,
  f.final_retention_intention_code,
  f.invalid_reason_code,
  f.loaded_at,
  f.actor_id,
  f.run_id,
  f.change_reason
from public.tthh_fact_employee_followup_response_cur f
where f.is_latest_valid_version = true;

comment on view public.vw_tthh_employee_followup_response_latest_cur is
  'Ultima version por correction_group, marcada con is_latest_valid_version. Incluye is_valid para distinguir versiones vigentes de historicas.';

-- 4.2 Historial completo
create view public.vw_tthh_employee_followup_response_history_cur as
select
  f.correction_group_id,
  f.response_version,
  f.event_id,
  f.supersedes_event_id,
  f.is_latest_valid_version,
  f.is_valid,
  f.invalid_reason_code,
  f.unique_follow_up_code,
  f.follow_up_code,
  f.person_id,
  f.followup_route_code,
  f.followup_route_source,
  f.event_at,
  f.event_date,
  f.follow_up_date,
  f.change_reason,
  f.actor_id,
  f.run_id,
  f.loaded_at
from public.tthh_fact_employee_followup_response_cur f
order by f.correction_group_id, f.response_version;

comment on view public.vw_tthh_employee_followup_response_history_cur is
  'Historial completo de versiones. Util para auditoria y para reconstruir cadenas de correccion.';

-- 4.3 Latest + labels de catálogos (selección única)
create view public.vw_tthh_employee_followup_response_with_labels_cur as
select
  f.event_id,
  f.unique_follow_up_code,
  f.person_id,
  f.followup_route_code,
  f.event_date,
  f.follow_up_date,
  f.is_valid,
  f.agr_followup_frequency_code,
  freq_agr.item_label_es as agr_followup_frequency_label,
  f.adm_followup_frequency_code,
  freq_adm.item_label_es as adm_followup_frequency_label,
  f.has_inconvenience_code,
  inc_yn.item_label_es as has_inconvenience_label,
  f.retention_intention_code,
  ret.item_label_es as retention_intention_label,
  f.final_retention_intention_code,
  ret_fin.item_label_es as final_retention_intention_label,
  f.invalid_reason_code,
  inv.item_label_es as invalid_reason_label
from public.vw_tthh_employee_followup_response_latest_cur f
left join public.common_dim_catalog_item_scd2 freq_agr
  on freq_agr.catalog_code = 'agr_followup_frequency'
 and freq_agr.item_code = f.agr_followup_frequency_code
 and freq_agr.is_current = true and freq_agr.is_valid = true
left join public.common_dim_catalog_item_scd2 freq_adm
  on freq_adm.catalog_code = 'adm_followup_frequency'
 and freq_adm.item_code = f.adm_followup_frequency_code
 and freq_adm.is_current = true and freq_adm.is_valid = true
left join public.common_dim_catalog_item_scd2 inc_yn
  on inc_yn.catalog_code = 'yes_no'
 and inc_yn.item_code = f.has_inconvenience_code
 and inc_yn.is_current = true and inc_yn.is_valid = true
left join public.common_dim_catalog_item_scd2 ret
  on ret.catalog_code = 'retention_intention'
 and ret.item_code = f.retention_intention_code
 and ret.is_current = true and ret.is_valid = true
left join public.common_dim_catalog_item_scd2 ret_fin
  on ret_fin.catalog_code = 'retention_intention'
 and ret_fin.item_code = f.final_retention_intention_code
 and ret_fin.is_current = true and ret_fin.is_valid = true
left join public.common_dim_catalog_item_scd2 inv
  on inv.catalog_code = 'employee_followup_invalid_reason'
 and inv.item_code = f.invalid_reason_code
 and inv.is_current = true and inv.is_valid = true;

comment on view public.vw_tthh_employee_followup_response_with_labels_cur is
  'Latest + labels de catálogos para columnas de selección única. Multiselects (work_difficulty, work_like_most, improvement_opportunity, short_retention_reason) viven en la tabla puente.';

-- 4.4 Detección de inconsistencias (códigos usados que no existen como items activos)
create view public.vw_tthh_employee_followup_catalog_mismatch_cur as
with fact_codes as (
  select event_id, 'agr_followup_frequency' as catalog_code, agr_followup_frequency_code as item_code
  from public.tthh_fact_employee_followup_response_cur where agr_followup_frequency_code is not null
  union all
  select event_id, 'adm_followup_frequency', adm_followup_frequency_code
  from public.tthh_fact_employee_followup_response_cur where adm_followup_frequency_code is not null
  union all
  select event_id, 'treatment_rating', coworker_treatment_rating_code
  from public.tthh_fact_employee_followup_response_cur where coworker_treatment_rating_code is not null
  union all
  select event_id, 'treatment_rating', supervisor_treatment_rating_code
  from public.tthh_fact_employee_followup_response_cur where supervisor_treatment_rating_code is not null
  union all
  select event_id, 'treatment_rating', area_manager_treatment_rating_code
  from public.tthh_fact_employee_followup_response_cur where area_manager_treatment_rating_code is not null
  union all
  select event_id, 'retention_intention', retention_intention_code
  from public.tthh_fact_employee_followup_response_cur where retention_intention_code is not null
  union all
  select event_id, 'retention_intention', final_retention_intention_code
  from public.tthh_fact_employee_followup_response_cur where final_retention_intention_code is not null
  union all
  select event_id, 'hr_support_need', hr_support_need_code
  from public.tthh_fact_employee_followup_response_cur where hr_support_need_code is not null
  union all
  select event_id, 'family_pregnancy_relation', family_pregnancy_relation_code
  from public.tthh_fact_employee_followup_response_cur where family_pregnancy_relation_code is not null
  union all
  select event_id, 'yes_no', has_inconvenience_code
  from public.tthh_fact_employee_followup_response_cur where has_inconvenience_code is not null
  union all
  select event_id, 'inconvenience_activity', inconvenience_activity_code
  from public.tthh_fact_employee_followup_response_cur where inconvenience_activity_code is not null
  union all
  select event_id, 'inconvenience_type', inconvenience_type_code
  from public.tthh_fact_employee_followup_response_cur where inconvenience_type_code is not null
  union all
  select event_id, 'adaptation_response', induction_sufficient_code
  from public.tthh_fact_employee_followup_response_cur where induction_sufficient_code is not null
  union all
  select event_id, 'adaptation_response', transport_problem_code
  from public.tthh_fact_employee_followup_response_cur where transport_problem_code is not null
  union all
  select event_id, 'adaptation_response', team_welcome_code
  from public.tthh_fact_employee_followup_response_cur where team_welcome_code is not null
  union all
  select event_id, 'satisfaction_level', role_clarity_satisfaction_code
  from public.tthh_fact_employee_followup_response_cur where role_clarity_satisfaction_code is not null
  union all
  select event_id, 'satisfaction_level', work_environment_satisfaction_code
  from public.tthh_fact_employee_followup_response_cur where work_environment_satisfaction_code is not null
  union all
  select event_id, 'satisfaction_level', equipment_satisfaction_code
  from public.tthh_fact_employee_followup_response_cur where equipment_satisfaction_code is not null
  union all
  select event_id, 'satisfaction_level', recent_work_satisfaction_code
  from public.tthh_fact_employee_followup_response_cur where recent_work_satisfaction_code is not null
  union all
  select event_id, 'work_aspect_to_improve', work_aspect_to_improve_code
  from public.tthh_fact_employee_followup_response_cur where work_aspect_to_improve_code is not null
  union all
  select event_id, 'employee_followup_invalid_reason', invalid_reason_code
  from public.tthh_fact_employee_followup_response_cur where invalid_reason_code is not null
),
sel_codes as (
  select event_id, catalog_code, item_code
  from public.tthh_asgn_employee_followup_catalog_selection_cur
  where is_valid = true
),
all_codes as (
  select 'fact'::text as origin, event_id, catalog_code, item_code from fact_codes
  union all
  select 'selection', event_id, catalog_code, item_code from sel_codes
)
select
  c.origin,
  c.event_id,
  c.catalog_code,
  c.item_code
from all_codes c
left join public.common_dim_catalog_item_scd2 i
  on i.catalog_code = c.catalog_code
 and i.item_code = c.item_code
 and i.is_current = true and i.is_valid = true
where i.record_id is null;

comment on view public.vw_tthh_employee_followup_catalog_mismatch_cur is
  'Códigos referenciados en fact o tabla puente que no existen como items vigentes en common_dim_catalog_item_scd2.';

-- ============================================================================
-- 5. SEEDS DE GRUPOS DE CATÁLOGO
-- ============================================================================

insert into public.common_dim_catalog_group_scd2 (catalog_code, catalog_name, catalog_description, is_system_catalog, run_id, change_reason)
select v.catalog_code, v.catalog_name, v.descr, v.system_flag, 'seed_tthh_followups_catalogs_v1', 'initial_load'
from (values
  ('employee_followup_change_reason', 'Razones de cambio',                'Por qué se generó/actualizó/anuló una respuesta de seguimiento.',           true),
  ('employee_followup_invalid_reason','Razones de invalidación',          'Motivo cuando is_valid = false en una respuesta.',                          true),
  ('followup_route',                  'Ruta del formulario',              'AGR / ADM.',                                                                true),
  ('followup_route_source',           'Origen de la ruta',                'De dónde se derivó la ruta (programación / clasificación / override).',    true),
  ('agr_followup_frequency',          'Frecuencia AGR',                   'Frecuencia/etapa AGR. Items pendientes hasta validar follow_up_type real.', false),
  ('adm_followup_frequency',          'Frecuencia ADM',                   'Etapas ADM: 1er día, 15 días, fin de prueba, bimensual.',                  false),
  ('work_difficulty',                 'Dificultades laborales',           'Multiselección. Incluye lack_of_training (corrección).',                    false),
  ('treatment_rating',                'Trato',                            'Excelente / Bueno / Regular / Malo.',                                       false),
  ('work_like_most',                  'Lo que más le gusta',              'Multiselección.',                                                           false),
  ('improvement_opportunity',         'Oportunidades de mejora',          'Multiselección.',                                                           false),
  ('retention_intention',             'Intención de permanencia',         'Tiempo deseado para seguir trabajando. Label canónico: "Más de 1 año".',   false),
  ('short_retention_reason',          'Razón de permanencia corta',       'Multiselección. Solo aplica si permanencia < 1 año.',                       false),
  ('hr_support_need',                 'Necesidad de apoyo de RRHH',       'Tipo de ayuda solicitada al área de Talento Humano.',                       false),
  ('family_pregnancy_relation',       'Relación con embarazo familiar',   'Pareja / Colaboradora / Ninguna.',                                          false),
  ('yes_no',                          'Sí/No',                            'Catálogo binario común.',                                                   true),
  ('inconvenience_activity',          'Actividad del inconveniente',      'Actividad operativa donde ocurrió el inconveniente.',                       false),
  ('inconvenience_type',              'Tipo de inconveniente',            'Causa o naturaleza del inconveniente.',                                     false),
  ('adaptation_response',             'Respuesta de adaptación',          'Sí / Parcialmente / No.',                                                   false),
  ('satisfaction_level',              'Nivel de satisfacción',            'Satisfecha / Normal / Insatisfecha.',                                       false),
  ('work_aspect_to_improve',          'Aspecto laboral a mejorar',        'Selección única para seguimiento ADM bimensual / final.',                   false)
) as v(catalog_code, catalog_name, descr, system_flag)
where not exists (
  select 1 from public.common_dim_catalog_group_scd2 g
  where g.catalog_code = v.catalog_code
    and g.is_current = true and g.is_valid = true
);

-- ============================================================================
-- 6. SEEDS DE ÍTEMS
-- ============================================================================

insert into public.common_dim_catalog_item_scd2 (catalog_code, item_code, item_label_es, display_order, run_id, change_reason)
select v.catalog_code, v.item_code, v.label, v.ord, 'seed_tthh_followups_catalogs_v1', 'initial_load'
from (values
  -- 6.1 employee_followup_change_reason
  ('employee_followup_change_reason', 'initial_load',       'Carga inicial',              10),
  ('employee_followup_change_reason', 'manual_insert',      'Registro manual',            20),
  ('employee_followup_change_reason', 'manual_update',      'Corrección manual',          30),
  ('employee_followup_change_reason', 'source_correction',  'Corrección de fuente',       40),
  ('employee_followup_change_reason', 'form_resubmission',  'Reenvío de formulario',      70),
  ('employee_followup_change_reason', 'merge_resolution',   'Resolución de duplicado',    80),
  ('employee_followup_change_reason', 'backfill',           'Carga histórica',            90),

  -- 6.2 employee_followup_invalid_reason
  ('employee_followup_invalid_reason', 'duplicate_record',     'Registro duplicado',           10),
  ('employee_followup_invalid_reason', 'wrong_person',         'Persona incorrecta',           20),
  ('employee_followup_invalid_reason', 'wrong_followup_code',  'Código de seguimiento incorrecto', 30),
  ('employee_followup_invalid_reason', 'data_entry_error',     'Error de digitación',          40),
  ('employee_followup_invalid_reason', 'test_record',          'Registro de prueba',           60),
  ('employee_followup_invalid_reason', 'superseded_by_update', 'Versión reemplazada por modificación', 65),
  ('employee_followup_invalid_reason', 'other',                'Otro',                         70),

  -- 6.3 followup_route
  ('followup_route', 'AGR', 'Agrícola',         10),
  ('followup_route', 'ADM', 'Administrativo',   20),

  -- 6.4 followup_route_source
  ('followup_route_source', 'scheduled_followup',           'Derivado de seguimiento programado',  10),
  ('followup_route_source', 'job_classification_fallback',  'Derivado de clasificación laboral',   20),
  ('followup_route_source', 'manual_admin_override',        'Ajuste manual autorizado',            30),

  -- 6.5 followup_frequency
  ('agr_followup_frequency', 'T1',             'T1',                           10),
  ('agr_followup_frequency', 'T2',             'T2',                           20),
  ('agr_followup_frequency', 'T3',             'T3',                           30),
  ('agr_followup_frequency', 'T4',             'T4',                           40),
  ('agr_followup_frequency', 'T5',             'T5',                           50),
  ('adm_followup_frequency', 'first_day',      '1er día de labores',           10),
  ('adm_followup_frequency', 'fifteen_days',   '15 días de labores',           20),
  ('adm_followup_frequency', 'probation_end',  'Final de periodo de prueba',   30),
  ('adm_followup_frequency', 'bimonthly',      'Bimensual',                    40),

  -- 6.6 work_difficulty (multiselect — incluye lack_of_training NUEVA)
  ('work_difficulty', 'none',                  'Ninguna',                                                  10),
  ('work_difficulty', 'missing_tools',         'No cuenta con las herramientas necesarias',                20),
  ('work_difficulty', 'missing_implements',    'No le entregan los implementos necesarios',                30),
  ('work_difficulty', 'missing_instructions',  'No recibe las instrucciones para realizar las actividades',40),
  ('work_difficulty', 'health_problems',       'Problemas de salud',                                       50),
  ('work_difficulty', 'family_situations',     'Situaciones familiares',                                   60),
  ('work_difficulty', 'lack_of_training',      'Falta de entrenamiento',                                   70),
  ('work_difficulty', 'other',                 'Otros',                                                    80),

  -- 6.7 treatment_rating
  ('treatment_rating', 'excellent', 'Excelente', 10),
  ('treatment_rating', 'good',      'Bueno',     20),
  ('treatment_rating', 'regular',   'Regular',   30),
  ('treatment_rating', 'bad',       'Malo',      40),

  -- 6.8 work_like_most (multiselect)
  ('work_like_most', 'adequate_tools_and_implements', 'Cuenta con herramientas e implementos adecuadas', 10),
  ('work_like_most', 'good_treatment',                'Existe un buen trato',                            20),
  ('work_like_most', 'companionship',                 'Compañerismo',                                    30),
  ('work_like_most', 'recognition_good_work',         'Reconocimiento de un buen trabajo',               40),
  ('work_like_most', 'remuneration',                  'Remuneración',                                    50),
  ('work_like_most', 'cafeteria',                     'Comedor',                                         60),
  ('work_like_most', 'transport',                     'Transporte',                                      70),
  ('work_like_most', 'medical_office',                'Consultorio Médico',                              80),
  ('work_like_most', 'permit_management',             'Gestión de permisos',                             90),
  ('work_like_most', 'human_talent_attention',        'Atención de Talento Humano',                     100),
  ('work_like_most', 'social_work_support',           'Apoyo de Trabajo Social',                        110),
  ('work_like_most', 'other',                         'Otros',                                          120),

  -- 6.9 improvement_opportunity (multiselect)
  ('improvement_opportunity', 'review_tools_and_implements',     'Revisión de herramientas e implementos',  10),
  ('improvement_opportunity', 'improve_staff_treatment',         'Mejorar el trato al personal',            20),
  ('improvement_opportunity', 'strengthen_peer_relationships',   'Fortalecer relaciones entre compañeros',  30),
  ('improvement_opportunity', 'recognize_good_work',             'Reconocer un buen trabajo',               40),
  ('improvement_opportunity', 'recognize_fair_remuneration',     'Reconocer una justa remuneración',        50),
  ('improvement_opportunity', 'cafeteria',                       'Comedor',                                 60),
  ('improvement_opportunity', 'transport',                       'Transporte',                              70),
  ('improvement_opportunity', 'medical_office',                  'Consultorio médico',                      80),
  ('improvement_opportunity', 'permit_management',               'Gestión de permisos',                     90),
  ('improvement_opportunity', 'human_talent_attention',          'Atención de Talento Humano',             100),
  ('improvement_opportunity', 'social_work_support',             'Apoyo de Trabajo Social',                110),
  ('improvement_opportunity', 'other',                           'Otros',                                  120),

  -- 6.10 retention_intention (label canónico singular)
  ('retention_intention', 'less_than_3_months',           'Menos de 3 meses',           10),
  ('retention_intention', 'between_3_and_6_months',       'Entre 3 y 6 meses',          20),
  ('retention_intention', 'between_6_months_and_1_year',  'Entre 6 meses a 1 año',      30),
  ('retention_intention', 'more_than_1_year',             'Más de 1 año',               40),

  -- 6.11 short_retention_reason (multiselect)
  ('short_retention_reason', 'working_conditions',                  'Condiciones de trabajo',                              10),
  ('short_retention_reason', 'better_opportunities_elsewhere',      'Mejores oportunidades en otras empresas o sectores',  20),
  ('short_retention_reason', 'conflict_with_peers_or_bosses',       'Conflicto con compañeros o jefes',                    30),
  ('short_retention_reason', 'conflict_with_partner_or_family',     'Conflicto con pareja o familiares',                   40),
  ('short_retention_reason', 'family_care',                         'Cuidado de familiares',                               50),
  ('short_retention_reason', 'transport_difficulties',              'Dificultades en el traslado',                         60),
  ('short_retention_reason', 'residence_change',                    'Cambio de residencia',                                70),
  ('short_retention_reason', 'health',                              'Salud',                                               80),
  ('short_retention_reason', 'studies',                             'Estudios',                                            90),
  ('short_retention_reason', 'other',                               'Otros',                                              100),

  -- 6.12 hr_support_need
  ('hr_support_need', 'study_support',                  'Ayuda para continuar con sus estudios',     10),
  ('hr_support_need', 'license_procedure_support',      'Ayuda para el trámite de licencias',        20),
  ('hr_support_need', 'transport_request',              'Solicitud de uso de transporte',            30),
  ('hr_support_need', 'commissary_credit_procedure',    'Trámite de crédito en comisariatos',        40),
  ('hr_support_need', 'pharmacy_credit_procedure',      'Trámite de crédito en farmacias',           50),
  ('hr_support_need', 'breakfast_credit',               'Crédito de desayuno',                       60),
  ('hr_support_need', 'permits_or_vacation_management', 'Gestión de permisos o vacaciones',          70),
  ('hr_support_need', 'not_applicable',                 'NA',                                        80),
  ('hr_support_need', 'other',                          'Otros',                                     90),

  -- 6.13 family_pregnancy_relation
  ('family_pregnancy_relation', 'partner',  'Pareja',      10),
  ('family_pregnancy_relation', 'employee', 'Colaboradora',20),
  ('family_pregnancy_relation', 'none',     'Ninguna',     30),

  -- 6.14 yes_no
  ('yes_no', 'yes', 'Sí', 10),
  ('yes_no', 'no',  'No', 20),

  -- 6.15 inconvenience_activity
  ('inconvenience_activity', 'disbudding',           'Desbrote',               10),
  ('inconvenience_activity', 'harvest',              'Cosecha',                20),
  ('inconvenience_activity', 'pruning',              'Poda',                   30),
  ('inconvenience_activity', 'thinning',             'Raleo',                  40),
  ('inconvenience_activity', 'combing',              'Peinado',                50),
  ('inconvenience_activity', 'scarification',        'Escarificado',           60),
  ('inconvenience_activity', 'reseeding',            'Resiembra',              70),
  ('inconvenience_activity', 'green_classification', 'Clasificación en verde', 80),
  ('inconvenience_activity', 'white_classification', 'Clasificado en Blanco',  90),
  ('inconvenience_activity', 'weighing',             'Pesado',                100),
  ('inconvenience_activity', 'dyeing',               'Tinturado',             110),
  ('inconvenience_activity', 'bunching',             'Embonchado',            120),
  ('inconvenience_activity', 'flower_runner',        'Sacador de Flor',       130),
  ('inconvenience_activity', 'other',                'Otro',                  140),

  -- 6.16 inconvenience_type
  ('inconvenience_type', 'delayed_activity',        'Actividad atrasada',                  10),
  ('inconvenience_type', 'hard_block',              'Bloque duro',                         20),
  ('inconvenience_type', 'new_block',               'Bloque nuevo',                        30),
  ('inconvenience_type', 'botrytis',                'Botritis',                            40),
  ('inconvenience_type', 'process_change',          'Cambio en el proceso',                50),
  ('inconvenience_type', 'activity_complexity',     'Complejidad de la actividad',         60),
  ('inconvenience_type', 'mechanical_damage',       'Daño mecánico',                       70),
  ('inconvenience_type', 'excessive_mosquitoes',    'Excesos de mosquitos en el área',     80),
  ('inconvenience_type', 'uncut_flower_arrives',    'Flor llega sin cortar',               90),
  ('inconvenience_type', 'dry_flower',              'Flor seca',                          100),
  ('inconvenience_type', 'rain',                    'Lluvia',                             110),
  ('inconvenience_type', 'too_much_waste',          'Mucha Basura',                       120),
  ('inconvenience_type', 'too_many_weeds',          'Muchos montes',                      130),
  ('inconvenience_type', 'no_flower_to_classify',   'No hay flor para clasificar',        140),
  ('inconvenience_type', 'no_flower_to_harvest',    'No hay flor para cosechar',          150),
  ('inconvenience_type', 'oidium',                  'Oidium',                             160),
  ('inconvenience_type', 'weak_plant',              'Planta está débil',                  170),
  ('inconvenience_type', 'dead_plants',             'Plantas muertas',                    180),
  ('inconvenience_type', 'borrowed',                'Prestado',                           190),
  ('inconvenience_type', 'performance',             'Rendimiento',                        200),
  ('inconvenience_type', 'very_tall_stems',         'Tallos muy altos',                   210),
  ('inconvenience_type', 'transfer',                'Traslado',                           220),
  ('inconvenience_type', 'other',                   'Otros',                              230),

  -- 6.17 adaptation_response
  ('adaptation_response', 'yes',       'Sí',          10),
  ('adaptation_response', 'partially', 'Parcialmente', 20),
  ('adaptation_response', 'no',        'No',          30),

  -- 6.18 satisfaction_level
  ('satisfaction_level', 'satisfied',    'Satisfecha',   10),
  ('satisfaction_level', 'normal',       'Normal',       20),
  ('satisfaction_level', 'dissatisfied', 'Insatisfecha', 30),

  -- 6.19 work_aspect_to_improve (single)
  ('work_aspect_to_improve', 'team_communication',                'Comunicación con el equipo',                              10),
  ('work_aspect_to_improve', 'area_manager_communication',        'Comunicación con el jefe de área',                        20),
  ('work_aspect_to_improve', 'training_and_growth_opportunities', 'Oportunidades de capacitación y crecimiento profesional', 30),
  ('work_aspect_to_improve', 'tools_and_resources',               'Herramientas y recursos',                                 40),
  ('work_aspect_to_improve', 'support_and_feedback',              'Apoyo y retroalimentación',                               50),
  ('work_aspect_to_improve', 'cafeteria',                         'Comedor',                                                 60),
  ('work_aspect_to_improve', 'transport',                         'Transporte',                                              70),
  ('work_aspect_to_improve', 'medical_office',                    'Consultorio médico',                                      80),
  ('work_aspect_to_improve', 'permit_management',                 'Gestión de permisos',                                     90),
  ('work_aspect_to_improve', 'human_talent_attention',            'Atención de Talento Humano',                             100),
  ('work_aspect_to_improve', 'social_work_support',               'Apoyo de Trabajo Social',                                110),
  ('work_aspect_to_improve', 'none',                              'Ninguna',                                                120),
  ('work_aspect_to_improve', 'other',                             'Otros',                                                  130)
) as v(catalog_code, item_code, label, ord)
where not exists (
  select 1 from public.common_dim_catalog_item_scd2 i
  where i.catalog_code = v.catalog_code
    and i.item_code = v.item_code
    and i.is_current = true and i.is_valid = true
);

update public.common_dim_catalog_item_scd2
set is_valid = false,
    is_current = false,
    valid_to = coalesce(valid_to, now()),
    loaded_at = now(),
    run_id = 'seed_tthh_followups_catalogs_v2',
    change_reason = 'manual_update'
where catalog_code = 'employee_followup_change_reason'
  and item_code in ('soft_delete', 'reactivation')
  and (is_valid = true or is_current = true);

update public.common_dim_catalog_item_scd2
set is_valid = false,
    is_current = false,
    valid_to = coalesce(valid_to, now()),
    loaded_at = now(),
    run_id = 'seed_tthh_followups_catalogs_v2',
    change_reason = 'manual_update'
where catalog_code = 'employee_followup_invalid_reason'
  and item_code = 'cancelled_followup'
  and (is_valid = true or is_current = true);

-- ============================================================================
-- 7. CATALOG USAGE — registrar dónde se consume cada catálogo
-- ============================================================================

insert into public.common_asgn_catalog_usage_cur (catalog_code, table_schema, table_name, column_name, usage_role, is_required, run_id, change_reason)
select v.catalog_code, v.tschema, v.tname, v.cname, v.role, v.required, 'seed_tthh_followups_catalogs_v1', 'initial_load'
from (values
  -- Fact — selección única
  ('followup_route',                   'public','tthh_fact_employee_followup_response_cur','followup_route_code',                'fact_code', true),
  ('followup_route_source',            'public','tthh_fact_employee_followup_response_cur','followup_route_source',              'fact_code', true),
  ('agr_followup_frequency',           'public','tthh_fact_employee_followup_response_cur','agr_followup_frequency_code',        'fact_code', false),
  ('adm_followup_frequency',           'public','tthh_fact_employee_followup_response_cur','adm_followup_frequency_code',        'fact_code', false),
  ('treatment_rating',                 'public','tthh_fact_employee_followup_response_cur','coworker_treatment_rating_code',     'fact_code', false),
  ('treatment_rating',                 'public','tthh_fact_employee_followup_response_cur','supervisor_treatment_rating_code',   'fact_code', false),
  ('treatment_rating',                 'public','tthh_fact_employee_followup_response_cur','area_manager_treatment_rating_code', 'fact_code', false),
  ('retention_intention',              'public','tthh_fact_employee_followup_response_cur','retention_intention_code',           'fact_code', false),
  ('retention_intention',              'public','tthh_fact_employee_followup_response_cur','final_retention_intention_code',     'fact_code', false),
  ('hr_support_need',                  'public','tthh_fact_employee_followup_response_cur','hr_support_need_code',               'fact_code', false),
  ('family_pregnancy_relation',        'public','tthh_fact_employee_followup_response_cur','family_pregnancy_relation_code',     'fact_code', false),
  ('yes_no',                           'public','tthh_fact_employee_followup_response_cur','has_inconvenience_code',             'fact_code', false),
  ('inconvenience_activity',           'public','tthh_fact_employee_followup_response_cur','inconvenience_activity_code',        'fact_code', false),
  ('inconvenience_type',               'public','tthh_fact_employee_followup_response_cur','inconvenience_type_code',            'fact_code', false),
  ('adaptation_response',              'public','tthh_fact_employee_followup_response_cur','induction_sufficient_code',          'fact_code', false),
  ('adaptation_response',              'public','tthh_fact_employee_followup_response_cur','transport_problem_code',             'fact_code', false),
  ('adaptation_response',              'public','tthh_fact_employee_followup_response_cur','team_welcome_code',                  'fact_code', false),
  ('satisfaction_level',               'public','tthh_fact_employee_followup_response_cur','role_clarity_satisfaction_code',     'fact_code', false),
  ('satisfaction_level',               'public','tthh_fact_employee_followup_response_cur','work_environment_satisfaction_code', 'fact_code', false),
  ('satisfaction_level',               'public','tthh_fact_employee_followup_response_cur','equipment_satisfaction_code',        'fact_code', false),
  ('satisfaction_level',               'public','tthh_fact_employee_followup_response_cur','recent_work_satisfaction_code',      'fact_code', false),
  ('work_aspect_to_improve',           'public','tthh_fact_employee_followup_response_cur','work_aspect_to_improve_code',        'fact_code', false),
  ('employee_followup_invalid_reason', 'public','tthh_fact_employee_followup_response_cur','invalid_reason_code',                'fact_code', false),
  ('employee_followup_change_reason',  'public','tthh_fact_employee_followup_response_cur','change_reason',                      'fact_code', true),

  -- Tabla puente — multiselección (selection_group_code = catalog_code)
  ('work_difficulty',          'public','tthh_asgn_employee_followup_catalog_selection_cur','catalog_code', 'selection_group', true),
  ('work_like_most',           'public','tthh_asgn_employee_followup_catalog_selection_cur','catalog_code', 'selection_group', true),
  ('improvement_opportunity',  'public','tthh_asgn_employee_followup_catalog_selection_cur','catalog_code', 'selection_group', true),
  ('short_retention_reason',   'public','tthh_asgn_employee_followup_catalog_selection_cur','catalog_code', 'selection_group', true)
) as v(catalog_code, tschema, tname, cname, role, required)
where not exists (
  select 1 from public.common_asgn_catalog_usage_cur u
  where u.catalog_code = v.catalog_code
    and u.table_schema = v.tschema
    and u.table_name = v.tname
    and u.column_name = v.cname
    and u.usage_role = v.role
);

-- ============================================================================
-- 8. AJUSTES CANONICOS PDF TRABAJO SOCIAL
-- ============================================================================

-- Alinear labels/opciones de permanencia con el formulario Google original.
update public.common_dim_catalog_item_scd2
set item_label_es = 'Ambiente de trabajo',
    loaded_at = now(),
    change_reason = 'source_correction'
where catalog_code = 'short_retention_reason'
  and item_code = 'working_conditions'
  and is_current = true
  and is_valid = true
  and item_label_es is distinct from 'Ambiente de trabajo';

insert into public.common_dim_catalog_item_scd2
  (catalog_code, item_code, item_label_es, display_order, run_id, change_reason)
select v.catalog_code, v.item_code, v.label, v.ord, 'seed_tthh_followups_pdf_alignment_v2', 'source_correction'
from (values
  ('short_retention_reason', 'low_remuneration', 'Baja remuneración', 95),
  ('short_retention_reason', 'long_workday',      'Larga jornada laboral', 96)
) as v(catalog_code, item_code, label, ord)
where not exists (
  select 1
  from public.common_dim_catalog_item_scd2 i
  where i.catalog_code = v.catalog_code
    and i.item_code = v.item_code
    and i.is_current = true
    and i.is_valid = true
);

-- ============================================================================
-- FIN
-- ============================================================================
