-- =========================================================================
-- db_admin.sql - Esquema canon para Administracion Maestros
-- Aplicar contra: db_admin (cluster admin, separado del DW operacional)
--
-- Patron architecture.md:
--   ref_*_core_scd2    identidad minima + ciclo de vida
--   dim_*_profile_scd2 atributos descriptivos de negocio
--   asgn_*_scd2        relaciones/asignaciones multiselect
--   dim_*_profile_cur  dimension simple sin historial
--
-- Convenciones SCD2 (canon CoreX v4):
--   record_id        uuid PK fisico (gen_random_uuid)
--   <entity>_code    clave de negocio (unica activa via UNIQUE INDEX parcial)
--   is_current       true = ultima version (SCD2)
--   is_valid         true = no anulada (soft delete)
--   valid_from/_to   fechas DE NEGOCIO (definidas por usuario en goals)
--   loaded_at        timestamp tecnico de insercion
--   run_id, actor_id, change_reason   trazabilidad
--
-- Idempotente: ejecutable multiples veces sin perder datos.
-- =========================================================================

-- =========================================================================
-- DOMINIOS (dimension simple cur, sin historial SCD2)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_dim_catalog_domain_profile_cur (
  domain_code         text PRIMARY KEY,
  domain_name         text NOT NULL,
  domain_description  text,
  display_order       int NOT NULL DEFAULT 0,
  is_valid            boolean NOT NULL DEFAULT true,
  loaded_at           timestamptz NOT NULL DEFAULT now(),
  run_id              text NOT NULL,
  actor_id            text,
  change_reason       text NOT NULL DEFAULT 'manual_update'
);

CREATE INDEX IF NOT EXISTS ix_adm_catalog_domain_valid
  ON public.adm_dim_catalog_domain_profile_cur (display_order, domain_code)
  WHERE is_valid = true;

-- =========================================================================
-- GRUPOS DE CATALOGO — core (identidad)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_ref_catalog_group_id_core_scd2 (
  record_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code   text NOT NULL,
  valid_from     timestamptz NOT NULL DEFAULT now(),
  valid_to       timestamptz,
  is_current     boolean NOT NULL DEFAULT true,
  is_valid       boolean NOT NULL DEFAULT true,
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  run_id         text NOT NULL,
  actor_id       text,
  change_reason  text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_ref_catalog_group_active
  ON public.adm_ref_catalog_group_id_core_scd2 (catalog_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_ref_catalog_group_history
  ON public.adm_ref_catalog_group_id_core_scd2 (catalog_code, valid_from DESC);

-- =========================================================================
-- GRUPOS DE CATALOGO — profile (atributos)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_dim_catalog_group_profile_scd2 (
  record_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code         text NOT NULL,
  catalog_name         text NOT NULL,
  catalog_description  text,
  domain_code          text NOT NULL REFERENCES public.adm_dim_catalog_domain_profile_cur(domain_code),
  is_system_catalog    boolean NOT NULL DEFAULT false,
  valid_from           timestamptz NOT NULL DEFAULT now(),
  valid_to             timestamptz,
  is_current           boolean NOT NULL DEFAULT true,
  is_valid             boolean NOT NULL DEFAULT true,
  loaded_at            timestamptz NOT NULL DEFAULT now(),
  run_id               text NOT NULL,
  actor_id             text,
  change_reason        text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_catalog_group_profile_active
  ON public.adm_dim_catalog_group_profile_scd2 (catalog_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_catalog_group_profile_domain
  ON public.adm_dim_catalog_group_profile_scd2 (domain_code)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS ix_adm_catalog_group_profile_history
  ON public.adm_dim_catalog_group_profile_scd2 (catalog_code, valid_from DESC);

-- =========================================================================
-- ITEMS DE CATALOGO — core (identidad)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_ref_catalog_item_id_core_scd2 (
  record_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code   text NOT NULL,
  item_code      text NOT NULL,
  valid_from     timestamptz NOT NULL DEFAULT now(),
  valid_to       timestamptz,
  is_current     boolean NOT NULL DEFAULT true,
  is_valid       boolean NOT NULL DEFAULT true,
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  run_id         text NOT NULL,
  actor_id       text,
  change_reason  text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_ref_catalog_item_active
  ON public.adm_ref_catalog_item_id_core_scd2 (catalog_code, item_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_ref_catalog_item_history
  ON public.adm_ref_catalog_item_id_core_scd2 (catalog_code, item_code, valid_from DESC);

-- =========================================================================
-- ITEMS DE CATALOGO — profile (atributos)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_dim_catalog_item_profile_scd2 (
  record_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code       text NOT NULL,
  item_code          text NOT NULL,
  item_label_es      text NOT NULL,
  item_label_en      text,
  item_description   text,
  display_order      int NOT NULL DEFAULT 0,
  attributes_jsonb   jsonb,
  valid_from         timestamptz NOT NULL DEFAULT now(),
  valid_to           timestamptz,
  is_current         boolean NOT NULL DEFAULT true,
  is_valid           boolean NOT NULL DEFAULT true,
  loaded_at          timestamptz NOT NULL DEFAULT now(),
  run_id             text NOT NULL,
  actor_id           text,
  change_reason      text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_catalog_item_profile_active
  ON public.adm_dim_catalog_item_profile_scd2 (catalog_code, item_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_catalog_item_profile_catalog
  ON public.adm_dim_catalog_item_profile_scd2 (catalog_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_catalog_item_profile_history
  ON public.adm_dim_catalog_item_profile_scd2 (catalog_code, item_code, valid_from DESC);

-- =========================================================================
-- UNIDADES DE MEDIDA — core (identidad)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_ref_unit_of_measure_id_core_scd2 (
  record_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code      text NOT NULL,
  valid_from     timestamptz NOT NULL DEFAULT now(),
  valid_to       timestamptz,
  is_current     boolean NOT NULL DEFAULT true,
  is_valid       boolean NOT NULL DEFAULT true,
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  run_id         text NOT NULL,
  actor_id       text,
  change_reason  text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_ref_unit_active
  ON public.adm_ref_unit_of_measure_id_core_scd2 (unit_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_ref_unit_history
  ON public.adm_ref_unit_of_measure_id_core_scd2 (unit_code, valid_from DESC);

-- =========================================================================
-- UNIDADES DE MEDIDA — profile (atributos)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_dim_unit_of_measure_profile_scd2 (
  record_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code           text NOT NULL,
  unit_name           text NOT NULL,
  unit_symbol         text,
  unit_category_code  text,
  notes_text          text,
  valid_from          timestamptz NOT NULL DEFAULT now(),
  valid_to            timestamptz,
  is_current          boolean NOT NULL DEFAULT true,
  is_valid            boolean NOT NULL DEFAULT true,
  loaded_at           timestamptz NOT NULL DEFAULT now(),
  run_id              text NOT NULL,
  actor_id            text,
  change_reason       text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_unit_profile_active
  ON public.adm_dim_unit_of_measure_profile_scd2 (unit_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_unit_profile_category
  ON public.adm_dim_unit_of_measure_profile_scd2 (unit_category_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_unit_profile_history
  ON public.adm_dim_unit_of_measure_profile_scd2 (unit_code, valid_from DESC);

-- =========================================================================
-- METRICAS — core (identidad)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_ref_metric_id_core_scd2 (
  record_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code    text NOT NULL,
  valid_from     timestamptz NOT NULL DEFAULT now(),
  valid_to       timestamptz,
  is_current     boolean NOT NULL DEFAULT true,
  is_valid       boolean NOT NULL DEFAULT true,
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  run_id         text NOT NULL,
  actor_id       text,
  change_reason  text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_ref_metric_active
  ON public.adm_ref_metric_id_core_scd2 (metric_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_ref_metric_history
  ON public.adm_ref_metric_id_core_scd2 (metric_code, valid_from DESC);

-- =========================================================================
-- METRICAS — profile (atributos)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_dim_metric_profile_scd2 (
  record_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code          text NOT NULL,
  metric_name          text NOT NULL,
  metric_description   text,
  data_type_code       text NOT NULL,
  direction_code       text NOT NULL,
  unit_code            text,
  notes_text           text,
  valid_from           timestamptz NOT NULL DEFAULT now(),
  valid_to             timestamptz,
  is_current           boolean NOT NULL DEFAULT true,
  is_valid             boolean NOT NULL DEFAULT true,
  loaded_at            timestamptz NOT NULL DEFAULT now(),
  run_id               text NOT NULL,
  actor_id             text,
  change_reason        text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_metric_profile_active
  ON public.adm_dim_metric_profile_scd2 (metric_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_metric_profile_data_type
  ON public.adm_dim_metric_profile_scd2 (data_type_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_metric_profile_history
  ON public.adm_dim_metric_profile_scd2 (metric_code, valid_from DESC);

-- =========================================================================
-- METAS Y OBJETIVOS — core (identidad)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_ref_goal_target_id_core_scd2 (
  record_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_code    text NOT NULL,
  valid_from     timestamptz NOT NULL,
  valid_to       timestamptz,
  is_current     boolean NOT NULL DEFAULT true,
  is_valid       boolean NOT NULL DEFAULT true,
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  run_id         text NOT NULL,
  actor_id       text,
  change_reason  text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_ref_goal_target_active
  ON public.adm_ref_goal_target_id_core_scd2 (target_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_ref_goal_target_history
  ON public.adm_ref_goal_target_id_core_scd2 (target_code, valid_from DESC);

-- =========================================================================
-- METAS Y OBJETIVOS — profile (atributos, arbol N-niveles)
-- valid_from / valid_to: fechas DE NEGOCIO (usuario define inicio,
-- valid_to = nuevo_valid_from - 1 dia al crear nueva version)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_dim_goal_target_profile_scd2 (
  record_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_code          text NOT NULL,
  target_name          text NOT NULL,
  target_description   text,
  metric_code          text,
  operator_code        text,
  value_min            numeric,
  value_max            numeric,
  value_text           text,
  notes_text           text,
  valid_from           timestamptz NOT NULL,
  valid_to             timestamptz,
  is_current           boolean NOT NULL DEFAULT true,
  is_valid             boolean NOT NULL DEFAULT true,
  loaded_at            timestamptz NOT NULL DEFAULT now(),
  run_id               text NOT NULL,
  actor_id             text,
  change_reason        text NOT NULL DEFAULT 'manual_update',
  -- Scope JSONB (K-level dynamic scope)
  domain_code          text,
  target_kind_code     text NOT NULL DEFAULT 'TARGET',
  target_scope_jsonb   jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_scope_hash    text,
  target_grain_code    text,
  display_order        integer NOT NULL DEFAULT 0,
  attributes_jsonb     jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT chk_adm_goal_target_profile_value_range CHECK (
    value_min IS NULL OR value_max IS NULL OR value_min <= value_max
  ),
  CONSTRAINT chk_adm_goal_target_scope_is_object CHECK (
    jsonb_typeof(target_scope_jsonb) = 'object'
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_goal_target_profile_active
  ON public.adm_dim_goal_target_profile_scd2 (target_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_profile_metric
  ON public.adm_dim_goal_target_profile_scd2 (metric_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_profile_history
  ON public.adm_dim_goal_target_profile_scd2 (target_code, valid_from DESC);

-- =========================================================================
-- DOMINIOS asignados a META (multiselect, bridge)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_asgn_goal_target_domain_scd2 (
  record_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_code    text NOT NULL,
  domain_code    text NOT NULL REFERENCES public.adm_dim_catalog_domain_profile_cur(domain_code),
  valid_from     timestamptz NOT NULL,
  valid_to       timestamptz,
  is_current     boolean NOT NULL DEFAULT true,
  is_valid       boolean NOT NULL DEFAULT true,
  loaded_at      timestamptz NOT NULL DEFAULT now(),
  run_id         text NOT NULL,
  actor_id       text,
  change_reason  text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_goal_target_domain_active
  ON public.adm_asgn_goal_target_domain_scd2 (target_code, domain_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_domain_target
  ON public.adm_asgn_goal_target_domain_scd2 (target_code)
  WHERE is_current = true AND is_valid = true;

-- =========================================================================
-- TIPOS asignados a META (multiselect catalog item, bridge)
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.adm_asgn_goal_target_type_scd2 (
  record_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_code      text NOT NULL,
  type_item_code   text NOT NULL,
  valid_from       timestamptz NOT NULL,
  valid_to         timestamptz,
  is_current       boolean NOT NULL DEFAULT true,
  is_valid         boolean NOT NULL DEFAULT true,
  loaded_at        timestamptz NOT NULL DEFAULT now(),
  run_id           text NOT NULL,
  actor_id         text,
  change_reason    text NOT NULL DEFAULT 'manual_update'
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_goal_target_type_active
  ON public.adm_asgn_goal_target_type_scd2 (target_code, type_item_code)
  WHERE is_current = true AND is_valid = true;

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_type_target
  ON public.adm_asgn_goal_target_type_scd2 (target_code)
  WHERE is_current = true AND is_valid = true;

-- =========================================================================
-- VISTAS (helpers de consulta)
-- =========================================================================

CREATE OR REPLACE VIEW public.vw_adm_goal_target_active AS
SELECT
  t.target_code,
  t.target_name,
  t.target_description,
  t.metric_code,
  m.metric_name,
  m.unit_code,
  u.unit_symbol,
  t.operator_code,
  op.item_label_es AS operator_label,
  t.value_min,
  t.value_max,
  t.value_text,
  t.notes_text,
  t.valid_from,
  t.valid_to,
  t.actor_id,
  t.loaded_at,
  t.change_reason,
  COALESCE(t.domain_code, d.domain_code)                                      AS domain_code,
  COALESCE(t.target_kind_code, ty.target_kind_code, 'TARGET')                 AS target_kind_code,
  COALESCE(t.target_grain_code, NULLIF(t.target_scope_jsonb ->> 'grain_code', '')) AS target_grain_code,
  t.target_scope_jsonb,
  t.target_scope_hash,
  t.attributes_jsonb,
  t.display_order
FROM public.adm_dim_goal_target_profile_scd2 t
LEFT JOIN public.adm_dim_metric_profile_scd2 m
  ON m.metric_code = t.metric_code AND m.is_current AND m.is_valid
LEFT JOIN public.adm_dim_unit_of_measure_profile_scd2 u
  ON u.unit_code = m.unit_code AND u.is_current AND u.is_valid
LEFT JOIN public.adm_dim_catalog_item_profile_scd2 op
  ON op.catalog_code = 'comparison_operators' AND op.item_code = t.operator_code
  AND op.is_current AND op.is_valid
LEFT JOIN LATERAL (
  SELECT domain_code
  FROM public.adm_asgn_goal_target_domain_scd2 d0
  WHERE d0.target_code = t.target_code
    AND d0.is_current = true AND d0.is_valid = true
  ORDER BY d0.valid_from DESC, d0.loaded_at DESC, d0.domain_code
  LIMIT 1
) d ON true
LEFT JOIN LATERAL (
  SELECT upper(regexp_replace(type_item_code, '[^a-zA-Z0-9]+', '_', 'g')) AS target_kind_code
  FROM public.adm_asgn_goal_target_type_scd2 ty0
  WHERE ty0.target_code = t.target_code
    AND ty0.is_current = true AND ty0.is_valid = true
  ORDER BY ty0.valid_from DESC, ty0.loaded_at DESC, ty0.type_item_code
  LIMIT 1
) ty ON true
WHERE t.is_current AND t.is_valid;

CREATE OR REPLACE VIEW public.vw_adm_goal_target_history AS
SELECT
  t.target_code,
  t.record_id,
  t.target_name,
  t.metric_code,
  t.operator_code,
  t.value_min,
  t.value_max,
  t.value_text,
  t.valid_from,
  t.valid_to,
  t.is_current,
  t.is_valid,
  t.loaded_at,
  t.actor_id,
  t.change_reason,
  COALESCE(t.target_grain_code, NULLIF(t.target_scope_jsonb ->> 'grain_code', '')) AS target_grain_code,
  t.target_scope_jsonb,
  t.target_scope_hash
FROM public.adm_dim_goal_target_profile_scd2 t
ORDER BY t.target_code, t.valid_from DESC, t.loaded_at DESC;

-- =========================================================================
-- SEEDS iniciales (idempotente)
-- =========================================================================

INSERT INTO public.adm_dim_catalog_domain_profile_cur
  (domain_code, domain_name, domain_description, display_order, run_id, actor_id, change_reason)
VALUES
  ('admin_masters', 'Administracion Maestros', 'Catalogos del sistema admin', 1, 'seed_db_admin_v2', 'system', 'initial_load'),
  ('produccion',    'Produccion',              'Maestros relacionados a produccion', 2, 'seed_db_admin_v2', 'system', 'initial_load'),
  ('calidad',       'Calidad',                 'Maestros relacionados a calidad', 3, 'seed_db_admin_v2', 'system', 'initial_load'),
  ('rrhh',          'Talento Humano',          'Maestros relacionados a personal', 4, 'seed_db_admin_v2', 'system', 'initial_load'),
  ('financiero',    'Financiero',              'Maestros relacionados a finanzas', 5, 'seed_db_admin_v2', 'system', 'initial_load'),
  ('comercial',     'Comercial',               'Maestros relacionados a ventas y mercados', 6, 'seed_db_admin_v2', 'system', 'initial_load')
ON CONFLICT (domain_code) DO NOTHING;

-- Seed: catalog groups (core + profile)
DO $$
DECLARE
  v_catalog_code text;
  v_catalog_name text;
  v_catalog_description text;
  v_domain_code text;
  v_is_system boolean;
  v_run_id text := 'seed_db_admin_v2';
  v_now timestamptz := now();
BEGIN
  FOR v_catalog_code, v_catalog_name, v_catalog_description, v_domain_code, v_is_system IN
    VALUES
      ('metric_data_types',     'Tipos de dato de metricas',  'Tipos primitivos para metricas (integer, decimal, ...)', 'admin_masters', true),
      ('metric_directions',     'Direcciones de metrica',     'Sentido esperado del cambio',                            'admin_masters', true),
      ('comparison_operators',  'Operadores de comparacion',  'Operadores para metas (>, <, =, between)',               'admin_masters', true),
      ('goal_types',            'Tipos de meta',              'Clasificacion semantica de objetivos',                   'admin_masters', false),
      ('unit_categories',       'Categorias de unidad',       'Familia de unidad de medida',                            'admin_masters', true)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.adm_ref_catalog_group_id_core_scd2
      WHERE catalog_code = v_catalog_code AND is_current AND is_valid
    ) THEN
      INSERT INTO public.adm_ref_catalog_group_id_core_scd2
        (catalog_code, valid_from, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
      VALUES (v_catalog_code, v_now, true, true, v_now, v_run_id, 'system', 'initial_load');

      INSERT INTO public.adm_dim_catalog_group_profile_scd2
        (catalog_code, catalog_name, catalog_description, domain_code, is_system_catalog,
         valid_from, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
      VALUES (v_catalog_code, v_catalog_name, v_catalog_description, v_domain_code, v_is_system,
              v_now, true, true, v_now, v_run_id, 'system', 'initial_load');
    END IF;
  END LOOP;
END $$;

-- Seed: catalog items (core + profile) — metric_data_types
DO $$
DECLARE
  v_catalog_code text;
  v_item_code text;
  v_label_es text;
  v_label_en text;
  v_order int;
  v_run_id text := 'seed_db_admin_v2';
  v_now timestamptz := now();
BEGIN
  FOR v_catalog_code, v_item_code, v_label_es, v_label_en, v_order IN
    VALUES
      ('metric_data_types', 'integer',    'Entero',     'Integer',    1),
      ('metric_data_types', 'decimal',    'Decimal',    'Decimal',    2),
      ('metric_data_types', 'percentage', 'Porcentaje', 'Percentage', 3),
      ('metric_data_types', 'boolean',    'Booleano',   'Boolean',    4),
      ('metric_data_types', 'text',       'Texto',      'Text',       5),
      ('metric_data_types', 'date',       'Fecha',      'Date',       6),
      ('metric_data_types', 'duration',   'Duracion',   'Duration',   7),
      ('metric_directions', 'increase', 'Aumentar', 'Increase', 1),
      ('metric_directions', 'decrease', 'Disminuir','Decrease', 2),
      ('metric_directions', 'neutral',  'Neutral',  'Neutral',  3),
      ('metric_directions', 'observe',  'Observar', 'Observe',  4),
      ('metric_directions', 'range',    'Rango',    'Range',    5),
      ('comparison_operators', 'gt',      'Mayor que (>)',      'Greater than',     1),
      ('comparison_operators', 'gte',     'Mayor o igual (>=)', 'Greater or equal', 2),
      ('comparison_operators', 'lt',      'Menor que (<)',      'Less than',        3),
      ('comparison_operators', 'lte',     'Menor o igual (<=)', 'Less or equal',    4),
      ('comparison_operators', 'eq',      'Igual a (=)',        'Equal',            5),
      ('comparison_operators', 'neq',     'Distinto de (!=)',   'Not equal',        6),
      ('comparison_operators', 'between', 'Entre (rango)',      'Between',          7),
      ('comparison_operators', 'in_list', 'En lista',           'In list',          8),
      ('unit_categories', 'mass',       'Masa',       'Mass',       1),
      ('unit_categories', 'volume',     'Volumen',    'Volume',     2),
      ('unit_categories', 'time',       'Tiempo',     'Time',       3),
      ('unit_categories', 'percentage', 'Porcentaje', 'Percentage', 4),
      ('unit_categories', 'count',      'Cuenta',     'Count',      5),
      ('unit_categories', 'distance',   'Distancia',  'Distance',   6),
      ('unit_categories', 'monetary',   'Monetario',  'Monetary',   7)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.adm_ref_catalog_item_id_core_scd2
      WHERE catalog_code = v_catalog_code AND item_code = v_item_code AND is_current AND is_valid
    ) THEN
      INSERT INTO public.adm_ref_catalog_item_id_core_scd2
        (catalog_code, item_code, valid_from, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
      VALUES (v_catalog_code, v_item_code, v_now, true, true, v_now, v_run_id, 'system', 'initial_load');

      INSERT INTO public.adm_dim_catalog_item_profile_scd2
        (catalog_code, item_code, item_label_es, item_label_en, display_order,
         valid_from, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
      VALUES (v_catalog_code, v_item_code, v_label_es, v_label_en, v_order,
              v_now, true, true, v_now, v_run_id, 'system', 'initial_load');
    END IF;
  END LOOP;
END $$;

-- Seed: units (core + profile)
DO $$
DECLARE
  v_unit_code text;
  v_unit_name text;
  v_unit_symbol text;
  v_unit_category text;
  v_run_id text := 'seed_db_admin_v2';
  v_now timestamptz := now();
BEGIN
  FOR v_unit_code, v_unit_name, v_unit_symbol, v_unit_category IN
    VALUES
      ('UNIT',  'Unidades',    'u',     'count'),
      ('PCT',   'Porcentaje',  '%',     'percentage'),
      ('KG',    'Kilogramos',  'kg',    'mass'),
      ('GR',    'Gramos',      'g',     'mass'),
      ('HR',    'Horas',       'h',     'time'),
      ('DAY',   'Dias',        'd',     'time'),
      ('USD',   'Dolares',     'USD',   'monetary'),
      ('STEMS', 'Tallos',      'tallos','count'),
      ('BCH',   'Bonches',     'bch',   'count'),
      ('MIN',   'Minutos',     'min',   'time')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.adm_ref_unit_of_measure_id_core_scd2
      WHERE unit_code = v_unit_code AND is_current AND is_valid
    ) THEN
      INSERT INTO public.adm_ref_unit_of_measure_id_core_scd2
        (unit_code, valid_from, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
      VALUES (v_unit_code, v_now, true, true, v_now, v_run_id, 'system', 'initial_load');

      INSERT INTO public.adm_dim_unit_of_measure_profile_scd2
        (unit_code, unit_name, unit_symbol, unit_category_code,
         valid_from, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
      VALUES (v_unit_code, v_unit_name, v_unit_symbol, v_unit_category,
              v_now, true, true, v_now, v_run_id, 'system', 'initial_load');
    END IF;
  END LOOP;
END $$;

COMMENT ON TABLE public.adm_dim_goal_target_profile_scd2 IS 'Metas y objetivos jerarquicos N-niveles, SCD2 con valid_from/valid_to definidos por usuario';
COMMENT ON COLUMN public.adm_dim_goal_target_profile_scd2.valid_from IS 'Fecha de inicio definida por el usuario (no fecha de carga)';
COMMENT ON COLUMN public.adm_dim_goal_target_profile_scd2.valid_to IS 'Auto-calculado: nuevo_valid_from - 1 dia al crear nueva version';
