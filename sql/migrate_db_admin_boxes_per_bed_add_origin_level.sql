-- ============================================================================
-- db_admin - Add origin_code level to Postharvest / Balances / Boxes per bed
-- Apply against: db_admin.public
--
-- Existing 520 targets are the preclassification baseline.
-- This migration:
--   1. Converts existing targets to origin_code = preclassification.
--   2. Adds opening and gv targets with value_min = preclassification * 0.84.
--   3. Preserves dynamic JSONB scope/hash behavior and remains idempotent.
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Normalize current baseline targets as preclassification.
-- --------------------------------------------------------------------------

UPDATE public.adm_ref_goal_target_id_core_scd2
SET
  target_code = replace(target_code, 'boxes_per_bed_balances_', 'boxes_per_bed_preclassification_balances_'),
  loaded_at = now(),
  run_id = 'add_origin_level_boxes_per_bed_v1',
  actor_id = 'system',
  change_reason = 'source_correction'
WHERE target_code LIKE 'boxes_per_bed_balances_%';

UPDATE public.adm_dim_goal_target_profile_scd2 t
SET
  target_code = replace(t.target_code, 'boxes_per_bed_balances_', 'boxes_per_bed_preclassification_balances_'),
  target_name = format(
    'Cajas / Cama - Preclasificacion - Balanzas - %s - %s - Semana %s',
    t.target_scope_jsonb #>> '{filters,variety_code}',
    t.target_scope_jsonb #>> '{filters,sp_type_code}',
    lpad(COALESCE(t.target_scope_jsonb #>> '{filters,iso_week}', t.target_scope_jsonb #>> '{filters,iso_week_id}'), 2, '0')
  ),
  target_description = 'Meta semanal de Cajas / Cama para Postcosecha / Preclasificacion / Balanzas.',
  target_grain_code = 'boxes_per_bed_by_origin_subdomain_variety_sp_type_iso_week',
  target_scope_jsonb = jsonb_build_object(
    'grain_code', 'boxes_per_bed_by_origin_subdomain_variety_sp_type_iso_week',
    'levels', jsonb_build_array(
      jsonb_build_object(
        'level_index', 1,
        'level_key', 'origin_code',
        'level_label', 'Origen',
        'value_code', 'preclassification',
        'value_label', 'Preclasificacion'
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
        'value_code', t.target_scope_jsonb #>> '{filters,variety_code}',
        'value_label', t.target_scope_jsonb #>> '{filters,variety_code}'
      ),
      jsonb_build_object(
        'level_index', 4,
        'level_key', 'sp_type_code',
        'level_label', 'Tipo SP',
        'value_code', t.target_scope_jsonb #>> '{filters,sp_type_code}',
        'value_label', t.target_scope_jsonb #>> '{filters,sp_type_code}'
      ),
      jsonb_build_object(
        'level_index', 5,
        'level_key', 'iso_week',
        'level_label', 'Semana ISO',
        'value_code', COALESCE(t.target_scope_jsonb #>> '{filters,iso_week}', t.target_scope_jsonb #>> '{filters,iso_week_id}'),
        'value_label', format('Semana %s', lpad(COALESCE(t.target_scope_jsonb #>> '{filters,iso_week}', t.target_scope_jsonb #>> '{filters,iso_week_id}'), 2, '0'))
      )
    ),
    'filters', jsonb_build_object(
      'origin_code', 'preclassification',
      'subdomain_code', 'balances',
      'variety_code', t.target_scope_jsonb #>> '{filters,variety_code}',
      'sp_type_code', t.target_scope_jsonb #>> '{filters,sp_type_code}',
      'iso_week', COALESCE(t.target_scope_jsonb #>> '{filters,iso_week}', t.target_scope_jsonb #>> '{filters,iso_week_id}'),
      'iso_week_id', COALESCE(t.target_scope_jsonb #>> '{filters,iso_week}', t.target_scope_jsonb #>> '{filters,iso_week_id}'),
      'metric_context', 'boxes_per_bed'
    )
  ),
  attributes_jsonb = jsonb_set(
    jsonb_set(COALESCE(t.attributes_jsonb, '{}'::jsonb), '{origin_label}', to_jsonb('Preclasificacion'::text), true),
    '{metric_label}',
    to_jsonb('Cajas / Cama'::text),
    true
  ),
  loaded_at = now(),
  run_id = 'add_origin_level_boxes_per_bed_v1',
  actor_id = 'system',
  change_reason = 'source_correction'
WHERE t.domain_code = 'postharvest'
  AND t.metric_code = 'boxes_per_bed'
  AND t.is_current = true
  AND t.is_valid = true
  AND (
    t.target_code LIKE 'boxes_per_bed_balances_%'
    OR COALESCE(t.target_scope_jsonb #>> '{filters,origin_code}', '') = ''
  );

-- --------------------------------------------------------------------------
-- 2. Add derived targets for opening and gv.
-- --------------------------------------------------------------------------

WITH source_targets AS (
  SELECT
    t.*,
    t.target_scope_jsonb #>> '{filters,variety_code}' AS variety_code,
    t.target_scope_jsonb #>> '{filters,sp_type_code}' AS sp_type_code,
    t.target_scope_jsonb #>> '{filters,iso_week}' AS iso_week
  FROM public.adm_dim_goal_target_profile_scd2 t
  WHERE t.domain_code = 'postharvest'
    AND t.metric_code = 'boxes_per_bed'
    AND t.is_current = true
    AND t.is_valid = true
    AND t.target_scope_jsonb #>> '{filters,origin_code}' = 'preclassification'
),
origins AS (
  SELECT *
  FROM (VALUES
    ('opening'::text, 'Apertura'::text, 2),
    ('gv'::text, 'GV'::text, 3)
  ) AS v(origin_code, origin_label, origin_order)
),
derived_targets AS (
  SELECT
    format(
      'boxes_per_bed_%s_balances_%s_%s_w%s',
      o.origin_code,
      lower(s.variety_code),
      lower(s.sp_type_code),
      lpad(s.iso_week, 2, '0')
    ) AS target_code,
    format(
      'Cajas / Cama - %s - Balanzas - %s - %s - Semana %s',
      o.origin_label,
      s.variety_code,
      s.sp_type_code,
      lpad(s.iso_week, 2, '0')
    ) AS target_name,
    format('Meta semanal de Cajas / Cama para Postcosecha / %s / Balanzas.', o.origin_label) AS target_description,
    o.origin_code,
    o.origin_label,
    o.origin_order,
    s.variety_code,
    s.sp_type_code,
    s.iso_week,
    round((s.value_min * 0.84)::numeric, 8) AS value_min,
    s.value_max,
    s.value_text,
    s.operator_code,
    jsonb_build_object(
      'grain_code', 'boxes_per_bed_by_origin_subdomain_variety_sp_type_iso_week',
      'levels', jsonb_build_array(
        jsonb_build_object(
          'level_index', 1,
          'level_key', 'origin_code',
          'level_label', 'Origen',
          'value_code', o.origin_code,
          'value_label', o.origin_label
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
          'value_code', s.variety_code,
          'value_label', s.variety_code
        ),
        jsonb_build_object(
          'level_index', 4,
          'level_key', 'sp_type_code',
          'level_label', 'Tipo SP',
          'value_code', s.sp_type_code,
          'value_label', s.sp_type_code
        ),
        jsonb_build_object(
          'level_index', 5,
          'level_key', 'iso_week',
          'level_label', 'Semana ISO',
          'value_code', s.iso_week,
          'value_label', format('Semana %s', lpad(s.iso_week, 2, '0'))
        )
      ),
      'filters', jsonb_build_object(
        'origin_code', o.origin_code,
        'subdomain_code', 'balances',
        'variety_code', s.variety_code,
        'sp_type_code', s.sp_type_code,
        'iso_week', s.iso_week,
        'iso_week_id', s.iso_week,
        'metric_context', 'boxes_per_bed'
      )
    ) AS target_scope_jsonb
  FROM source_targets s
  CROSS JOIN origins o
),
core_insert AS (
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
    d.target_code,
    now(),
    true,
    true,
    'add_origin_level_boxes_per_bed_v1',
    'system',
    'manual_insert'
  FROM derived_targets d
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.adm_ref_goal_target_id_core_scd2 c
    WHERE c.target_code = d.target_code
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
  d.target_code,
  d.target_name,
  d.target_description,
  'postharvest',
  'TARGET',
  'boxes_per_bed',
  d.operator_code,
  d.value_min,
  d.value_max,
  d.value_text,
  NULL,
  now(),
  true,
  true,
  'boxes_per_bed_by_origin_subdomain_variety_sp_type_iso_week',
  d.target_scope_jsonb,
  (d.origin_order * 100000)
    + ((d.iso_week)::integer * 1000)
    + CASE d.variety_code WHEN 'CLO' THEN 100 ELSE 200 END
    + CASE d.sp_type_code
        WHEN 'S' THEN 1
        WHEN 'P1' THEN 2
        WHEN 'P2' THEN 3
        WHEN 'P3' THEN 4
        WHEN 'P4' THEN 5
        WHEN 'P5' THEN 6
        ELSE 99
      END,
  jsonb_build_object(
    'source', 'derived_from_preclassification',
    'factor', 0.84,
    'origin_label', d.origin_label,
    'subdomain_label', 'Balanzas',
    'metric_label', 'Cajas / Cama'
  ),
  'add_origin_level_boxes_per_bed_v1',
  'system',
  'manual_insert'
FROM derived_targets d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_dim_goal_target_profile_scd2 t
  WHERE t.target_code = d.target_code
    AND t.is_current = true
    AND t.is_valid = true
);

COMMIT;
