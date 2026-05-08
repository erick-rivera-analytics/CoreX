-- ============================================================================
-- db_admin - Correct CLO boxes_per_bed paths to opening-only
-- Apply against: db_admin.public
--
-- Business correction:
--   CLO does not have preclassification or GV paths. The current
--   preclassification values are the real Apertura/opening values.
--
-- This migration is intentionally destructive for the wrong CLO paths, but it
-- first preserves full copies in backup tables. It is idempotent: if the
-- source preclassification rows were already deleted, it rebuilds CLO/opening
-- from the backup table.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.adm_backup_boxes_per_bed_clo_opening_only_profile AS
SELECT
  now()::timestamptz AS backed_up_at,
  'clo_opening_only_v1'::text AS backup_run_id,
  p.*
FROM public.adm_dim_goal_target_profile_scd2 p
WHERE false;

CREATE TABLE IF NOT EXISTS public.adm_backup_boxes_per_bed_clo_opening_only_core AS
SELECT
  now()::timestamptz AS backed_up_at,
  'clo_opening_only_v1'::text AS backup_run_id,
  c.*
FROM public.adm_ref_goal_target_id_core_scd2 c
WHERE false;

CREATE TABLE IF NOT EXISTS public.adm_backup_boxes_per_bed_clo_opening_only_domain AS
SELECT
  now()::timestamptz AS backed_up_at,
  'clo_opening_only_v1'::text AS backup_run_id,
  d.*
FROM public.adm_asgn_goal_target_domain_scd2 d
WHERE false;

CREATE TABLE IF NOT EXISTS public.adm_backup_boxes_per_bed_clo_opening_only_type AS
SELECT
  now()::timestamptz AS backed_up_at,
  'clo_opening_only_v1'::text AS backup_run_id,
  t.*
FROM public.adm_asgn_goal_target_type_scd2 t
WHERE false;

DROP TABLE IF EXISTS pg_temp.clo_wrong_target_codes;
CREATE TEMP TABLE clo_wrong_target_codes AS
SELECT DISTINCT target_code
FROM public.adm_dim_goal_target_profile_scd2
WHERE domain_code = 'postharvest'
  AND metric_code = 'boxes_per_bed'
  AND target_scope_jsonb #>> '{filters,subdomain_code}' = 'balances'
  AND target_scope_jsonb #>> '{filters,variety_code}' = 'CLO'
  AND target_scope_jsonb #>> '{filters,origin_code}' IN ('preclassification', 'opening', 'gv');

INSERT INTO public.adm_backup_boxes_per_bed_clo_opening_only_profile
SELECT now(), 'clo_opening_only_v1', p.*
FROM public.adm_dim_goal_target_profile_scd2 p
JOIN clo_wrong_target_codes w ON w.target_code = p.target_code
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_backup_boxes_per_bed_clo_opening_only_profile b
  WHERE b.backup_run_id = 'clo_opening_only_v1'
    AND b.record_id = p.record_id
);

INSERT INTO public.adm_backup_boxes_per_bed_clo_opening_only_core
SELECT now(), 'clo_opening_only_v1', c.*
FROM public.adm_ref_goal_target_id_core_scd2 c
JOIN clo_wrong_target_codes w ON w.target_code = c.target_code
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_backup_boxes_per_bed_clo_opening_only_core b
  WHERE b.backup_run_id = 'clo_opening_only_v1'
    AND b.record_id = c.record_id
);

INSERT INTO public.adm_backup_boxes_per_bed_clo_opening_only_domain
SELECT now(), 'clo_opening_only_v1', d.*
FROM public.adm_asgn_goal_target_domain_scd2 d
JOIN clo_wrong_target_codes w ON w.target_code = d.target_code
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_backup_boxes_per_bed_clo_opening_only_domain b
  WHERE b.backup_run_id = 'clo_opening_only_v1'
    AND b.record_id = d.record_id
);

INSERT INTO public.adm_backup_boxes_per_bed_clo_opening_only_type
SELECT now(), 'clo_opening_only_v1', t.*
FROM public.adm_asgn_goal_target_type_scd2 t
JOIN clo_wrong_target_codes w ON w.target_code = t.target_code
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_backup_boxes_per_bed_clo_opening_only_type b
  WHERE b.backup_run_id = 'clo_opening_only_v1'
    AND b.record_id = t.record_id
);

DROP TABLE IF EXISTS pg_temp.clo_pure_source;
CREATE TEMP TABLE clo_pure_source AS
WITH current_pre AS (
  SELECT
    p.target_scope_jsonb #>> '{filters,sp_type_code}' AS sp_type_code,
    p.target_scope_jsonb #>> '{filters,iso_week}' AS iso_week,
    p.value_min,
    p.value_max,
    p.value_text,
    p.operator_code,
    p.notes_text
  FROM public.adm_dim_goal_target_profile_scd2 p
  WHERE p.domain_code = 'postharvest'
    AND p.metric_code = 'boxes_per_bed'
    AND p.is_current = true
    AND p.is_valid = true
    AND p.target_scope_jsonb #>> '{filters,subdomain_code}' = 'balances'
    AND p.target_scope_jsonb #>> '{filters,variety_code}' = 'CLO'
    AND p.target_scope_jsonb #>> '{filters,origin_code}' = 'preclassification'
),
backup_pre AS (
  SELECT
    b.target_scope_jsonb #>> '{filters,sp_type_code}' AS sp_type_code,
    b.target_scope_jsonb #>> '{filters,iso_week}' AS iso_week,
    b.value_min,
    b.value_max,
    b.value_text,
    b.operator_code,
    b.notes_text
  FROM public.adm_backup_boxes_per_bed_clo_opening_only_profile b
  WHERE b.backup_run_id = 'clo_opening_only_v1'
    AND b.domain_code = 'postharvest'
    AND b.metric_code = 'boxes_per_bed'
    AND b.is_current = true
    AND b.is_valid = true
    AND b.target_scope_jsonb #>> '{filters,subdomain_code}' = 'balances'
    AND b.target_scope_jsonb #>> '{filters,variety_code}' = 'CLO'
    AND b.target_scope_jsonb #>> '{filters,origin_code}' = 'preclassification'
)
SELECT DISTINCT ON (sp_type_code, iso_week)
  sp_type_code,
  iso_week,
  value_min,
  value_max,
  value_text,
  operator_code,
  notes_text
FROM (
  SELECT *, 1 AS src_priority FROM current_pre
  UNION ALL
  SELECT *, 2 AS src_priority FROM backup_pre
) s
WHERE sp_type_code IS NOT NULL
  AND iso_week IS NOT NULL
ORDER BY sp_type_code, iso_week, src_priority;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM pg_temp.clo_pure_source;
  IF v_count <> 208 THEN
    RAISE EXCEPTION 'Expected 208 CLO pure source rows, found %', v_count;
  END IF;
END
$$;

DELETE FROM public.adm_asgn_goal_target_domain_scd2 d
USING clo_wrong_target_codes w
WHERE d.target_code = w.target_code;

DELETE FROM public.adm_asgn_goal_target_type_scd2 t
USING clo_wrong_target_codes w
WHERE t.target_code = w.target_code;

DELETE FROM public.adm_dim_goal_target_profile_scd2 p
USING clo_wrong_target_codes w
WHERE p.target_code = w.target_code;

DELETE FROM public.adm_ref_goal_target_id_core_scd2 c
USING clo_wrong_target_codes w
WHERE c.target_code = w.target_code;

DROP TABLE IF EXISTS pg_temp.clo_prepared;
CREATE TEMP TABLE clo_prepared AS
SELECT
    format(
      'boxes_per_bed_opening_balances_clo_%s_w%s',
      lower(sp_type_code),
      lpad(iso_week, 2, '0')
    ) AS target_code,
    format(
      'Cajas / Cama - Apertura - Balanzas - CLO - %s - Semana %s',
      sp_type_code,
      lpad(iso_week, 2, '0')
    ) AS target_name,
    'Meta semanal de Cajas / Cama para Postcosecha / Apertura / Balanzas.' AS target_description,
    sp_type_code,
    iso_week,
    value_min,
    value_max,
    value_text,
    operator_code,
    notes_text,
    jsonb_build_object(
      'grain_code', 'boxes_per_bed_by_origin_subdomain_variety_sp_type_iso_week',
      'levels', jsonb_build_array(
        jsonb_build_object(
          'level_index', 1,
          'level_key', 'origin_code',
          'level_label', 'Origen',
          'value_code', 'opening',
          'value_label', 'Apertura'
        ),
        jsonb_build_object(
          'level_index', 2,
          'level_key', 'subdomain_code',
          'level_label', 'Subdominio',
          'value_code', 'balances',
          'value_label', 'Balanzas'
        ),
        jsonb_build_object(
          'level_index', 3,
          'level_key', 'variety_code',
          'level_label', 'Variedad',
          'value_code', 'CLO',
          'value_label', 'CLO'
        ),
        jsonb_build_object(
          'level_index', 4,
          'level_key', 'sp_type_code',
          'level_label', 'Tipo SP',
          'value_code', sp_type_code,
          'value_label', sp_type_code
        ),
        jsonb_build_object(
          'level_index', 5,
          'level_key', 'iso_week',
          'level_label', 'Semana ISO',
          'value_code', iso_week,
          'value_label', format('Semana %s', lpad(iso_week, 2, '0'))
        )
      ),
      'filters', jsonb_build_object(
        'origin_code', 'opening',
        'subdomain_code', 'balances',
        'variety_code', 'CLO',
        'sp_type_code', sp_type_code,
        'iso_week', iso_week,
        'iso_week_id', iso_week,
        'metric_context', 'boxes_per_bed'
      )
    ) AS target_scope_jsonb
FROM clo_pure_source;

WITH core_insert AS (
  INSERT INTO public.adm_ref_goal_target_id_core_scd2 (
    record_id,
    target_code,
    valid_from,
    is_current,
    is_valid,
    run_id,
    actor_id,
    change_reason
  )
  SELECT
    gen_random_uuid(),
    p.target_code,
    now(),
    true,
    true,
    'clo_opening_only_v1',
    'system',
    'source_correction'
  FROM clo_prepared p
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.adm_ref_goal_target_id_core_scd2 c
    WHERE c.target_code = p.target_code
      AND c.is_current = true
      AND c.is_valid = true
  )
  RETURNING target_code
)
INSERT INTO public.adm_dim_goal_target_profile_scd2 (
  record_id,
  target_code,
  target_name,
  target_description,
  domain_code,
  target_kind_code,
  metric_code,
  operator_code,
  value_min,
  value_max,
  value_text,
  notes_text,
  valid_from,
  is_current,
  is_valid,
  target_grain_code,
  target_scope_jsonb,
  display_order,
  attributes_jsonb,
  run_id,
  actor_id,
  change_reason
)
SELECT
  gen_random_uuid(),
  p.target_code,
  p.target_name,
  p.target_description,
  'postharvest',
  'TARGET',
  'boxes_per_bed',
  p.operator_code,
  p.value_min,
  p.value_max,
  p.value_text,
  p.notes_text,
  now(),
  true,
  true,
  'boxes_per_bed_by_origin_subdomain_variety_sp_type_iso_week',
  p.target_scope_jsonb,
  200000
    + ((p.iso_week)::integer * 1000)
    + 100
    + CASE p.sp_type_code
        WHEN 'S' THEN 1
        WHEN 'P1' THEN 2
        WHEN 'P2' THEN 3
        WHEN 'P3' THEN 4
        ELSE 99
      END,
  jsonb_build_object(
    'source', 'corrected_from_clo_preclassification',
    'factor', 1,
    'origin_label', 'Apertura',
    'subdomain_label', 'Balanzas',
    'metric_label', 'Cajas / Cama'
  ),
  'clo_opening_only_v1',
  'system',
  'source_correction'
FROM clo_prepared p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_dim_goal_target_profile_scd2 t
  WHERE t.target_code = p.target_code
    AND t.is_current = true
    AND t.is_valid = true
);

INSERT INTO public.adm_asgn_goal_target_domain_scd2 (
  target_code,
  domain_code,
  valid_from,
  is_current,
  is_valid,
  run_id,
  actor_id,
  change_reason
)
SELECT
  p.target_code,
  'postharvest',
  now(),
  true,
  true,
  'clo_opening_only_v1',
  'system',
  'source_correction'
FROM clo_prepared p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_asgn_goal_target_domain_scd2 d
  WHERE d.target_code = p.target_code
    AND d.domain_code = 'postharvest'
    AND d.is_current = true
    AND d.is_valid = true
);

INSERT INTO public.adm_asgn_goal_target_type_scd2 (
  target_code,
  type_item_code,
  valid_from,
  is_current,
  is_valid,
  run_id,
  actor_id,
  change_reason
)
SELECT
  p.target_code,
  'TARGET',
  now(),
  true,
  true,
  'clo_opening_only_v1',
  'system',
  'source_correction'
FROM clo_prepared p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_asgn_goal_target_type_scd2 t
  WHERE t.target_code = p.target_code
    AND t.type_item_code = 'TARGET'
    AND t.is_current = true
    AND t.is_valid = true
);

DO $$
DECLARE
  v_bad_count integer;
  v_opening_count integer;
BEGIN
  SELECT count(*) INTO v_bad_count
  FROM public.adm_dim_goal_target_profile_scd2
  WHERE is_current = true
    AND is_valid = true
    AND domain_code = 'postharvest'
    AND metric_code = 'boxes_per_bed'
    AND target_scope_jsonb #>> '{filters,subdomain_code}' = 'balances'
    AND target_scope_jsonb #>> '{filters,variety_code}' = 'CLO'
    AND target_scope_jsonb #>> '{filters,origin_code}' IN ('preclassification', 'gv');

  IF v_bad_count <> 0 THEN
    RAISE EXCEPTION 'CLO wrong active paths still exist: %', v_bad_count;
  END IF;

  SELECT count(*) INTO v_opening_count
  FROM public.adm_dim_goal_target_profile_scd2
  WHERE is_current = true
    AND is_valid = true
    AND domain_code = 'postharvest'
    AND metric_code = 'boxes_per_bed'
    AND target_scope_jsonb #>> '{filters,subdomain_code}' = 'balances'
    AND target_scope_jsonb #>> '{filters,variety_code}' = 'CLO'
    AND target_scope_jsonb #>> '{filters,origin_code}' = 'opening';

  IF v_opening_count <> 208 THEN
    RAISE EXCEPTION 'Expected 208 active CLO/opening rows, found %', v_opening_count;
  END IF;
END
$$;

COMMIT;
