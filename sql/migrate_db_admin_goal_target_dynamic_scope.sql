-- ============================================================================
-- db_admin - Dynamic K-level scope for goals/targets
-- Apply against: db_admin.public
--
-- Evolutionary, idempotent migration. It preserves existing records and keeps
-- legacy bridge tables for compatibility.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Add canonical dynamic-scope columns.
-- --------------------------------------------------------------------------

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ADD COLUMN IF NOT EXISTS domain_code text;

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ADD COLUMN IF NOT EXISTS target_kind_code text NOT NULL DEFAULT 'TARGET';

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ADD COLUMN IF NOT EXISTS target_scope_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ADD COLUMN IF NOT EXISTS target_scope_hash text;

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ADD COLUMN IF NOT EXISTS target_grain_code text;

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0;

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ADD COLUMN IF NOT EXISTS attributes_jsonb jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Keep existing nullable columns safe if the migration is applied over a
-- partially-migrated database.
UPDATE public.adm_dim_goal_target_profile_scd2
SET
  target_kind_code = COALESCE(NULLIF(btrim(target_kind_code), ''), 'TARGET'),
  target_scope_jsonb = COALESCE(target_scope_jsonb, '{}'::jsonb),
  display_order = COALESCE(display_order, 0),
  attributes_jsonb = COALESCE(attributes_jsonb, '{}'::jsonb);

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ALTER COLUMN target_kind_code SET DEFAULT 'TARGET',
  ALTER COLUMN target_kind_code SET NOT NULL,
  ALTER COLUMN target_scope_jsonb SET DEFAULT '{}'::jsonb,
  ALTER COLUMN target_scope_jsonb SET NOT NULL,
  ALTER COLUMN display_order SET DEFAULT 0,
  ALTER COLUMN display_order SET NOT NULL,
  ALTER COLUMN attributes_jsonb SET DEFAULT '{}'::jsonb,
  ALTER COLUMN attributes_jsonb SET NOT NULL;

-- --------------------------------------------------------------------------
-- 2. Helper hash function and write trigger.
-- --------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.adm_goal_target_scope_hash(p_scope jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT md5(COALESCE(p_scope, '{}'::jsonb)::text)
$$;

CREATE OR REPLACE FUNCTION public.adm_set_goal_target_scope_hash()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.target_kind_code := COALESCE(NULLIF(btrim(NEW.target_kind_code), ''), 'TARGET');
  NEW.target_scope_jsonb := COALESCE(NEW.target_scope_jsonb, '{}'::jsonb);
  NEW.attributes_jsonb := COALESCE(NEW.attributes_jsonb, '{}'::jsonb);
  NEW.target_scope_hash := public.adm_goal_target_scope_hash(NEW.target_scope_jsonb);

  IF NEW.target_grain_code IS NULL AND NEW.target_scope_jsonb ? 'grain_code' THEN
    NEW.target_grain_code := NULLIF(NEW.target_scope_jsonb ->> 'grain_code', '');
  END IF;

  RETURN NEW;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_adm_goal_target_scope_hash'
      AND tgrelid = 'public.adm_dim_goal_target_profile_scd2'::regclass
  ) THEN
    CREATE TRIGGER trg_adm_goal_target_scope_hash
      BEFORE INSERT OR UPDATE OF target_kind_code, target_scope_jsonb, attributes_jsonb, target_grain_code
      ON public.adm_dim_goal_target_profile_scd2
      FOR EACH ROW
      EXECUTE FUNCTION public.adm_set_goal_target_scope_hash();
  END IF;
END
$$;

-- --------------------------------------------------------------------------
-- 3. Conservative backfill from legacy bridge tables.
-- --------------------------------------------------------------------------

WITH domain_source AS (
  SELECT DISTINCT ON (target_code)
    target_code,
    domain_code
  FROM public.adm_asgn_goal_target_domain_scd2
  WHERE is_current = true
    AND is_valid = true
  ORDER BY target_code, valid_from DESC, loaded_at DESC, domain_code
)
UPDATE public.adm_dim_goal_target_profile_scd2 t
SET domain_code = d.domain_code
FROM domain_source d
WHERE t.target_code = d.target_code
  AND t.domain_code IS NULL;

WITH type_source AS (
  SELECT DISTINCT ON (target_code)
    target_code,
    upper(regexp_replace(type_item_code, '[^a-zA-Z0-9]+', '_', 'g')) AS target_kind_code
  FROM public.adm_asgn_goal_target_type_scd2
  WHERE is_current = true
    AND is_valid = true
  ORDER BY target_code, valid_from DESC, loaded_at DESC, type_item_code
)
UPDATE public.adm_dim_goal_target_profile_scd2 t
SET target_kind_code = COALESCE(NULLIF(type_source.target_kind_code, ''), 'TARGET')
FROM type_source
WHERE t.target_code = type_source.target_code
  AND (t.target_kind_code IS NULL OR t.target_kind_code = 'TARGET');

UPDATE public.adm_dim_goal_target_profile_scd2
SET
  target_grain_code = COALESCE(target_grain_code, NULLIF(target_scope_jsonb ->> 'grain_code', '')),
  target_scope_hash = public.adm_goal_target_scope_hash(target_scope_jsonb)
WHERE target_scope_hash IS NULL
   OR target_scope_hash IS DISTINCT FROM public.adm_goal_target_scope_hash(target_scope_jsonb)
   OR (target_grain_code IS NULL AND target_scope_jsonb ? 'grain_code');

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ALTER COLUMN target_scope_hash SET DEFAULT public.adm_goal_target_scope_hash('{}'::jsonb);

UPDATE public.adm_dim_goal_target_profile_scd2
SET target_scope_hash = public.adm_goal_target_scope_hash(target_scope_jsonb)
WHERE target_scope_hash IS NULL;

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  ALTER COLUMN target_scope_hash SET NOT NULL;

-- --------------------------------------------------------------------------
-- 4. Soft JSONB checks. Empty scope remains valid for legacy records.
-- --------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_adm_goal_target_scope_is_object'
      AND conrelid = 'public.adm_dim_goal_target_profile_scd2'::regclass
  ) THEN
    ALTER TABLE public.adm_dim_goal_target_profile_scd2
      ADD CONSTRAINT chk_adm_goal_target_scope_is_object
      CHECK (jsonb_typeof(target_scope_jsonb) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_adm_goal_target_attributes_is_object'
      AND conrelid = 'public.adm_dim_goal_target_profile_scd2'::regclass
  ) THEN
    ALTER TABLE public.adm_dim_goal_target_profile_scd2
      ADD CONSTRAINT chk_adm_goal_target_attributes_is_object
      CHECK (jsonb_typeof(attributes_jsonb) = 'object');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_adm_goal_target_scope_contract'
      AND conrelid = 'public.adm_dim_goal_target_profile_scd2'::regclass
  ) THEN
    ALTER TABLE public.adm_dim_goal_target_profile_scd2
      ADD CONSTRAINT chk_adm_goal_target_scope_contract
      CHECK (
        target_scope_jsonb = '{}'::jsonb
        OR (
          jsonb_typeof(target_scope_jsonb -> 'grain_code') = 'string'
          AND jsonb_typeof(target_scope_jsonb -> 'levels') = 'array'
          AND jsonb_typeof(target_scope_jsonb -> 'filters') = 'object'
        )
      );
  END IF;
END
$$;

-- --------------------------------------------------------------------------
-- 5. Indexes for JSONB scope and active lookups.
-- --------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_scope_gin
  ON public.adm_dim_goal_target_profile_scd2
  USING gin (target_scope_jsonb);

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_scope_filters_gin
  ON public.adm_dim_goal_target_profile_scd2
  USING gin ((target_scope_jsonb -> 'filters'));

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_domain_metric_active
  ON public.adm_dim_goal_target_profile_scd2
  (domain_code, metric_code, is_current, is_valid);

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_code_active
  ON public.adm_dim_goal_target_profile_scd2
  (target_code, is_current, is_valid);

CREATE INDEX IF NOT EXISTS ix_adm_goal_target_scope_hash
  ON public.adm_dim_goal_target_profile_scd2
  (target_scope_hash);

DO $$
DECLARE
  v_duplicate_count integer;
BEGIN
  SELECT count(*) INTO v_duplicate_count
  FROM (
    SELECT domain_code, metric_code, target_kind_code, target_scope_hash, count(*) AS row_count
    FROM public.adm_dim_goal_target_profile_scd2
    WHERE is_current = true
      AND is_valid = true
      AND domain_code IS NOT NULL
      AND metric_code IS NOT NULL
      AND target_scope_hash IS NOT NULL
    GROUP BY domain_code, metric_code, target_kind_code, target_scope_hash
    HAVING count(*) > 1
  ) duplicates;

  IF v_duplicate_count = 0 THEN
    EXECUTE '
      CREATE UNIQUE INDEX IF NOT EXISTS uq_adm_goal_target_active_scope
      ON public.adm_dim_goal_target_profile_scd2
      (domain_code, metric_code, target_kind_code, target_scope_hash)
      WHERE is_current = true
        AND is_valid = true
        AND domain_code IS NOT NULL
        AND metric_code IS NOT NULL
        AND target_scope_hash IS NOT NULL';
  ELSE
    RAISE NOTICE 'Skipped uq_adm_goal_target_active_scope: % duplicate active groups found', v_duplicate_count;
  END IF;
END
$$;

-- --------------------------------------------------------------------------
-- 6. Backward-compatible views. Existing columns stay in the same order.
-- --------------------------------------------------------------------------

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
  ON op.catalog_code = 'comparison_operators'
 AND op.item_code = t.operator_code
 AND op.is_current AND op.is_valid
LEFT JOIN LATERAL (
  SELECT domain_code
  FROM public.adm_asgn_goal_target_domain_scd2 d0
  WHERE d0.target_code = t.target_code
    AND d0.is_current = true
    AND d0.is_valid = true
  ORDER BY d0.valid_from DESC, d0.loaded_at DESC, d0.domain_code
  LIMIT 1
) d ON true
LEFT JOIN LATERAL (
  SELECT upper(regexp_replace(type_item_code, '[^a-zA-Z0-9]+', '_', 'g')) AS target_kind_code
  FROM public.adm_asgn_goal_target_type_scd2 ty0
  WHERE ty0.target_code = t.target_code
    AND ty0.is_current = true
    AND ty0.is_valid = true
  ORDER BY ty0.valid_from DESC, ty0.loaded_at DESC, ty0.type_item_code
  LIMIT 1
) ty ON true
WHERE t.is_current = true
  AND t.is_valid = true;

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
  COALESCE(t.domain_code, d.domain_code)                                      AS domain_code,
  COALESCE(t.target_kind_code, ty.target_kind_code, 'TARGET')                 AS target_kind_code,
  COALESCE(t.target_grain_code, NULLIF(t.target_scope_jsonb ->> 'grain_code', '')) AS target_grain_code,
  t.target_scope_jsonb,
  t.target_scope_hash,
  t.attributes_jsonb,
  t.display_order
FROM public.adm_dim_goal_target_profile_scd2 t
LEFT JOIN LATERAL (
  SELECT domain_code
  FROM public.adm_asgn_goal_target_domain_scd2 d0
  WHERE d0.target_code = t.target_code
    AND d0.is_current = true
    AND d0.is_valid = true
  ORDER BY d0.valid_from DESC, d0.loaded_at DESC, d0.domain_code
  LIMIT 1
) d ON true
LEFT JOIN LATERAL (
  SELECT upper(regexp_replace(type_item_code, '[^a-zA-Z0-9]+', '_', 'g')) AS target_kind_code
  FROM public.adm_asgn_goal_target_type_scd2 ty0
  WHERE ty0.target_code = t.target_code
    AND ty0.is_current = true
    AND ty0.is_valid = true
  ORDER BY ty0.valid_from DESC, ty0.loaded_at DESC, ty0.type_item_code
  LIMIT 1
) ty ON true
ORDER BY t.target_code, t.valid_from DESC, t.loaded_at DESC;

CREATE OR REPLACE VIEW public.vw_adm_goal_target_scope_levels_active AS
SELECT
  t.target_code,
  t.target_name,
  t.domain_code,
  t.metric_code,
  t.target_kind_code,
  COALESCE(t.target_grain_code, NULLIF(t.target_scope_jsonb ->> 'grain_code', '')) AS target_grain_code,
  NULLIF(level_item ->> 'level_index', '')::integer AS level_index,
  level_item ->> 'level_key' AS level_key,
  level_item ->> 'level_label' AS level_label,
  level_item ->> 'value_code' AS value_code,
  level_item ->> 'value_label' AS value_label,
  t.value_min,
  t.value_max,
  t.value_text,
  t.operator_code,
  t.valid_from,
  t.valid_to,
  t.is_current,
  t.is_valid
FROM public.adm_dim_goal_target_profile_scd2 t
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(t.target_scope_jsonb -> 'levels') = 'array'
      THEN t.target_scope_jsonb -> 'levels'
    ELSE '[]'::jsonb
  END
) AS levels(level_item)
WHERE t.is_current = true
  AND t.is_valid = true;

CREATE OR REPLACE VIEW public.vw_adm_goal_target_active_flat AS
SELECT
  t.target_code,
  t.target_name,
  t.domain_code,
  t.metric_code,
  t.target_kind_code,
  COALESCE(t.target_grain_code, NULLIF(t.target_scope_jsonb ->> 'grain_code', '')) AS target_grain_code,
  t.operator_code,
  t.value_min,
  t.value_max,
  t.value_text,
  t.target_scope_jsonb #>> '{filters,variety_code}' AS variety_code,
  t.target_scope_jsonb #>> '{filters,sp_type_code}' AS sp_type_code,
  t.target_scope_jsonb #>> '{filters,peeling_code}' AS peeling_code,
  t.target_scope_jsonb #>> '{filters,iso_week_id}' AS iso_week_id,
  t.target_scope_jsonb #>> '{filters,area_code}' AS area_code,
  t.target_scope_jsonb #>> '{filters,activity_code}' AS activity_code,
  t.target_scope_jsonb #>> '{filters,block_code}' AS block_code,
  t.target_scope_jsonb #>> '{filters,bed_code}' AS bed_code,
  t.target_scope_jsonb #>> '{filters,cycle_key}' AS cycle_key,
  t.target_scope_jsonb,
  t.valid_from,
  t.valid_to
FROM public.adm_dim_goal_target_profile_scd2 t
WHERE t.is_current = true
  AND t.is_valid = true;

COMMIT;
