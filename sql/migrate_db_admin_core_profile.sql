-- ============================================================================
-- MIGRACIÓN db_admin: renombrar dims a _profile_ y crear tablas _core_
-- ============================================================================
-- Ejecutar contra db_admin.
-- Idempotente: verifica existencia antes de renombrar/crear.
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Renombrar tablas dim existentes → _profile_
-- ============================================================================

-- 1.1 adm_dim_catalog_domain_cur → adm_dim_catalog_domain_profile_cur
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_catalog_domain_cur')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_catalog_domain_profile_cur')
  THEN
    ALTER TABLE public.adm_dim_catalog_domain_cur RENAME TO adm_dim_catalog_domain_profile_cur;
    RAISE NOTICE 'Renamed adm_dim_catalog_domain_cur → adm_dim_catalog_domain_profile_cur';
  END IF;
END $$;

-- 1.2 adm_dim_catalog_group_scd2 → adm_dim_catalog_group_profile_scd2
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_catalog_group_scd2')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_catalog_group_profile_scd2')
  THEN
    ALTER TABLE public.adm_dim_catalog_group_scd2 RENAME TO adm_dim_catalog_group_profile_scd2;
    RAISE NOTICE 'Renamed adm_dim_catalog_group_scd2 → adm_dim_catalog_group_profile_scd2';
  END IF;
END $$;

-- 1.3 adm_dim_catalog_item_scd2 → adm_dim_catalog_item_profile_scd2
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_catalog_item_scd2')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_catalog_item_profile_scd2')
  THEN
    ALTER TABLE public.adm_dim_catalog_item_scd2 RENAME TO adm_dim_catalog_item_profile_scd2;
    RAISE NOTICE 'Renamed adm_dim_catalog_item_scd2 → adm_dim_catalog_item_profile_scd2';
  END IF;
END $$;

-- 1.4 adm_dim_unit_of_measure_scd2 → adm_dim_unit_of_measure_profile_scd2
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_unit_of_measure_scd2')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_unit_of_measure_profile_scd2')
  THEN
    ALTER TABLE public.adm_dim_unit_of_measure_scd2 RENAME TO adm_dim_unit_of_measure_profile_scd2;
    RAISE NOTICE 'Renamed adm_dim_unit_of_measure_scd2 → adm_dim_unit_of_measure_profile_scd2';
  END IF;
END $$;

-- 1.5 adm_dim_metric_scd2 → adm_dim_metric_profile_scd2
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_metric_scd2')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_metric_profile_scd2')
  THEN
    ALTER TABLE public.adm_dim_metric_scd2 RENAME TO adm_dim_metric_profile_scd2;
    RAISE NOTICE 'Renamed adm_dim_metric_scd2 → adm_dim_metric_profile_scd2';
  END IF;
END $$;

-- 1.6 adm_dim_goal_target_scd2 → adm_dim_goal_target_profile_scd2
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_goal_target_scd2')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm_dim_goal_target_profile_scd2')
  THEN
    ALTER TABLE public.adm_dim_goal_target_scd2 RENAME TO adm_dim_goal_target_profile_scd2;
    RAISE NOTICE 'Renamed adm_dim_goal_target_scd2 → adm_dim_goal_target_profile_scd2';
  END IF;
END $$;

-- ============================================================================
-- PASO 2: Crear tablas core nuevas
-- ============================================================================

-- 2.1 Core — Catalog Groups
CREATE TABLE IF NOT EXISTS public.adm_ref_catalog_group_id_core_scd2 (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  is_valid boolean NOT NULL DEFAULT true,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  run_id text NOT NULL,
  actor_id text,
  change_reason text NOT NULL,
  CONSTRAINT uq_adm_catalog_group_core_code_from UNIQUE (catalog_code, valid_from),
  CONSTRAINT chk_adm_catalog_group_core_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_catalog_group_core_active
  ON public.adm_ref_catalog_group_id_core_scd2 (catalog_code)
  WHERE is_current = true AND is_valid = true;

-- 2.2 Core — Catalog Items
CREATE TABLE IF NOT EXISTS public.adm_ref_catalog_item_id_core_scd2 (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_code text NOT NULL,
  item_code text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  is_valid boolean NOT NULL DEFAULT true,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  run_id text NOT NULL,
  actor_id text,
  change_reason text NOT NULL,
  CONSTRAINT uq_adm_catalog_item_core_code_from UNIQUE (catalog_code, item_code, valid_from),
  CONSTRAINT chk_adm_catalog_item_core_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_catalog_item_core_active
  ON public.adm_ref_catalog_item_id_core_scd2 (catalog_code, item_code)
  WHERE is_current = true AND is_valid = true;

-- 2.3 Core — Units of Measure
CREATE TABLE IF NOT EXISTS public.adm_ref_unit_of_measure_id_core_scd2 (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_code text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  is_valid boolean NOT NULL DEFAULT true,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  run_id text NOT NULL,
  actor_id text,
  change_reason text NOT NULL,
  CONSTRAINT uq_adm_unit_core_code_from UNIQUE (unit_code, valid_from),
  CONSTRAINT chk_adm_unit_core_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_unit_core_active
  ON public.adm_ref_unit_of_measure_id_core_scd2 (unit_code)
  WHERE is_current = true AND is_valid = true;

-- 2.4 Core — Metrics
CREATE TABLE IF NOT EXISTS public.adm_ref_metric_id_core_scd2 (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_code text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  is_valid boolean NOT NULL DEFAULT true,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  run_id text NOT NULL,
  actor_id text,
  change_reason text NOT NULL,
  CONSTRAINT uq_adm_metric_core_code_from UNIQUE (metric_code, valid_from),
  CONSTRAINT chk_adm_metric_core_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_metric_core_active
  ON public.adm_ref_metric_id_core_scd2 (metric_code)
  WHERE is_current = true AND is_valid = true;

-- 2.5 Core — Goal Targets (ya existía adm_ref_goal_target_id_core_scd2, skip si existe)
CREATE TABLE IF NOT EXISTS public.adm_ref_goal_target_id_core_scd2 (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_code text NOT NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  is_current boolean NOT NULL DEFAULT true,
  is_valid boolean NOT NULL DEFAULT true,
  loaded_at timestamptz NOT NULL DEFAULT now(),
  run_id text NOT NULL,
  actor_id text,
  change_reason text NOT NULL,
  CONSTRAINT uq_adm_goal_target_core_code_from UNIQUE (target_code, valid_from),
  CONSTRAINT chk_adm_goal_target_core_validity CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_goal_target_core_active
  ON public.adm_ref_goal_target_id_core_scd2 (target_code)
  WHERE is_current = true AND is_valid = true;

-- ============================================================================
-- PASO 3: Poblar tablas core desde datos existentes en profile
-- ============================================================================

-- 3.1 Core catalog groups desde profile
INSERT INTO public.adm_ref_catalog_group_id_core_scd2
  (record_id, catalog_code, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
SELECT gen_random_uuid(), p.catalog_code, p.valid_from, p.valid_to, p.is_current, p.is_valid, p.loaded_at, 'migration_core_profile_v1', p.actor_id, 'migration_backfill'
FROM public.adm_dim_catalog_group_profile_scd2 p
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_catalog_group_id_core_scd2 c
  WHERE c.catalog_code = p.catalog_code AND c.valid_from = p.valid_from
);

-- 3.2 Core catalog items desde profile
INSERT INTO public.adm_ref_catalog_item_id_core_scd2
  (record_id, catalog_code, item_code, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
SELECT gen_random_uuid(), p.catalog_code, p.item_code, p.valid_from, p.valid_to, p.is_current, p.is_valid, p.loaded_at, 'migration_core_profile_v1', p.actor_id, 'migration_backfill'
FROM public.adm_dim_catalog_item_profile_scd2 p
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_catalog_item_id_core_scd2 c
  WHERE c.catalog_code = p.catalog_code AND c.item_code = p.item_code AND c.valid_from = p.valid_from
);

-- 3.3 Core units desde profile
INSERT INTO public.adm_ref_unit_of_measure_id_core_scd2
  (record_id, unit_code, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
SELECT gen_random_uuid(), p.unit_code, p.valid_from, p.valid_to, p.is_current, p.is_valid, p.loaded_at, 'migration_core_profile_v1', p.actor_id, 'migration_backfill'
FROM public.adm_dim_unit_of_measure_profile_scd2 p
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_unit_of_measure_id_core_scd2 c
  WHERE c.unit_code = p.unit_code AND c.valid_from = p.valid_from
);

-- 3.4 Core metrics desde profile
INSERT INTO public.adm_ref_metric_id_core_scd2
  (record_id, metric_code, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
SELECT gen_random_uuid(), p.metric_code, p.valid_from, p.valid_to, p.is_current, p.is_valid, p.loaded_at, 'migration_core_profile_v1', p.actor_id, 'migration_backfill'
FROM public.adm_dim_metric_profile_scd2 p
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_metric_id_core_scd2 c
  WHERE c.metric_code = p.metric_code AND c.valid_from = p.valid_from
);

-- 3.5 Core goal targets desde profile
INSERT INTO public.adm_ref_goal_target_id_core_scd2
  (record_id, target_code, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
SELECT gen_random_uuid(), p.target_code, p.valid_from, p.valid_to, p.is_current, p.is_valid, p.loaded_at, 'migration_core_profile_v1', p.actor_id, 'migration_backfill'
FROM public.adm_dim_goal_target_profile_scd2 p
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_goal_target_id_core_scd2 c
  WHERE c.target_code = p.target_code AND c.valid_from = p.valid_from
);

-- ============================================================================
-- PASO 4: Recrear vistas que apuntaban a nombres viejos
-- ============================================================================

DROP VIEW IF EXISTS public.vw_adm_goal_target_active;

CREATE VIEW public.vw_adm_goal_target_active AS
SELECT t.target_code, t.target_name, t.target_description,
       t.metric_code, m.metric_name, m.unit_code, u.unit_symbol,
       t.operator_code, op.item_label_es AS operator_label,
       t.value_min, t.value_max, t.value_text, t.notes_text,
       t.valid_from, t.valid_to, t.actor_id, t.change_reason,
       t.target_grain_code, t.target_scope_jsonb
FROM public.adm_dim_goal_target_profile_scd2 t
LEFT JOIN public.adm_dim_metric_profile_scd2 m
  ON m.metric_code = t.metric_code AND m.is_current AND m.is_valid
LEFT JOIN public.adm_dim_unit_of_measure_profile_scd2 u
  ON u.unit_code = m.unit_code AND u.is_current AND u.is_valid
LEFT JOIN public.adm_dim_catalog_item_profile_scd2 op
  ON op.catalog_code = 'comparison_operators' AND op.item_code = t.operator_code
  AND op.is_current AND op.is_valid
WHERE t.is_current = true AND t.is_valid = true;

COMMIT;
