-- ============================================================================
-- db_admin — Drop legacy tree columns from adm_dim_goal_target_profile_scd2
--
-- Removes: parent_target_code, level_index, level_label
-- These belonged to the old hierarchical tree model.
-- The current model uses target_scope_jsonb (JSONB K-level scope) + target_grain_code.
--
-- Idempotent. Run against: db_admin.public
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Drop views that SELECT those columns (required before ALTER TABLE DROP).
-- --------------------------------------------------------------------------

DROP VIEW IF EXISTS public.vw_adm_goal_target_active;
DROP VIEW IF EXISTS public.vw_adm_goal_target_history;

-- --------------------------------------------------------------------------
-- 2. Drop constraint and index that depend on the removed columns.
-- --------------------------------------------------------------------------

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  DROP CONSTRAINT IF EXISTS chk_adm_goal_target_profile_level;

DROP INDEX IF EXISTS public.ix_adm_goal_target_profile_parent;

-- --------------------------------------------------------------------------
-- 3. Drop the legacy columns.
-- --------------------------------------------------------------------------

ALTER TABLE public.adm_dim_goal_target_profile_scd2
  DROP COLUMN IF EXISTS parent_target_code,
  DROP COLUMN IF EXISTS level_index,
  DROP COLUMN IF EXISTS level_label;

-- --------------------------------------------------------------------------
-- 4. Recreate vw_adm_goal_target_active without the dropped columns.
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
 AND op.item_code    = t.operator_code
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
WHERE t.is_current = true
  AND t.is_valid = true;

-- --------------------------------------------------------------------------
-- 5. Recreate vw_adm_goal_target_history without the dropped columns.
-- --------------------------------------------------------------------------

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
ORDER BY t.target_code, t.valid_from DESC, t.loaded_at DESC;

COMMIT;
