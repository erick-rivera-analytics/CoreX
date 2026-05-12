-- ============================================================================
-- db_admin - Postharvest / Balances / Hydration KPI targets
-- Apply against: db_admin.public
--
-- Idempotent seed. Inserta metas de hidratación por grado para el subdominio
-- balances. Sigue el patrón canon SCD2 de `seed_db_admin_postharvest_hours_per_bed_targets.sql`
-- (INSERT WHERE NOT EXISTS, sin destructive ops, sin tocar valid_from previos).
--
-- Meta hidratación = ratio SUM(peso_b1c) / SUM(peso_b2) esperado por grado.
-- Scope filters: { subdomain_code: "balances", origin_code: <opening|gv|preclassification>, grade_code }
-- Valores referenciales (commit inicial); el usuario los puede ajustar desde
-- Admin · Maestros · Metas y objetivos sin requerir re-seed.
-- ============================================================================

BEGIN;

-- ── Metric: hydration_target ─────────────────────────────────────────────────
INSERT INTO public.adm_ref_metric_id_core_scd2 (
  record_id, metric_code, valid_from, is_current, is_valid, run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), 'hydration_target', now(), true, true,
  'seed_balances_hydration_targets_v1', 'system', 'manual_insert'
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_metric_id_core_scd2
  WHERE metric_code = 'hydration_target' AND is_current = true AND is_valid = true
);

INSERT INTO public.adm_dim_metric_profile_scd2 (
  record_id, metric_code, metric_name, metric_description, data_type_code,
  direction_code, unit_code, notes_text, valid_from, is_current, is_valid,
  run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), 'hydration_target', 'Meta de hidratación',
  'Meta KPI de hidratación: razón SUM(peso_b1c)/SUM(peso_b2) esperada por grado en el subdominio balances.',
  'decimal', 'higher_better', NULL,
  'Seed inicial para Postcosecha / Balanzas / KPI Hidratación.',
  now(), true, true,
  'seed_balances_hydration_targets_v1', 'system', 'manual_insert'
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_dim_metric_profile_scd2
  WHERE metric_code = 'hydration_target' AND is_current = true AND is_valid = true
);

-- ── Targets: hydration por grado (origen = APERTURA inicial) ─────────────────
WITH target_values AS (
  SELECT *
  FROM (VALUES
    -- (origin_code, origin_label, grade_code, target_ratio)
    ('opening', 'Apertura', 'BQT', 1.68::numeric),
    ('opening', 'Apertura', '15',  1.37::numeric),
    ('opening', 'Apertura', '20',  0.75::numeric),
    ('opening', 'Apertura', '25',  0.65::numeric),
    ('opening', 'Apertura', '30',  0.60::numeric),
    ('opening', 'Apertura', '35',  0.56::numeric),
    ('opening', 'Apertura', '40',  0.53::numeric),
    ('opening', 'Apertura', '45',  0.51::numeric),
    ('opening', 'Apertura', '50',  0.49::numeric),
    ('opening', 'Apertura', '55',  0.47::numeric),
    ('opening', 'Apertura', '60',  0.45::numeric),
    ('opening', 'Apertura', '65',  0.44::numeric),
    ('opening', 'Apertura', '70',  0.42::numeric),
    ('opening', 'Apertura', '75',  0.41::numeric)
  ) AS v(origin_code, origin_label, grade_code, target_value)
),
expanded_targets AS (
  SELECT
    format('hydration_target_balances_%s_%s', lower(origin_code), lower(grade_code)) AS target_code,
    format('Meta hidratación - Balanzas - %s - Grado %s', origin_label, grade_code) AS target_name,
    'Meta de hidratación (SUM(b1c)/SUM(b2)) por grado para Postcosecha / Balanzas.' AS target_description,
    origin_code, origin_label, grade_code, target_value,
    jsonb_build_object(
      'grain_code', 'hydration_target_by_subdomain_origin_grade',
      'levels', jsonb_build_array(
        jsonb_build_object('level_index', 1, 'level_key', 'subdomain_code', 'level_label', 'Subdominio', 'value_code', 'balances', 'value_label', 'Balanzas'),
        jsonb_build_object('level_index', 2, 'level_key', 'origin_code', 'level_label', 'Origen', 'value_code', origin_code, 'value_label', origin_label),
        jsonb_build_object('level_index', 3, 'level_key', 'grade_code', 'level_label', 'Grado', 'value_code', grade_code, 'value_label', grade_code)
      ),
      'filters', jsonb_build_object(
        'subdomain_code', 'balances',
        'origin_code', origin_code,
        'grade_code', grade_code,
        'metric_context', 'hydration_target'
      )
    ) AS target_scope_jsonb
  FROM target_values
),
core_insert AS (
  INSERT INTO public.adm_ref_goal_target_id_core_scd2 (
    record_id, target_code, valid_from, is_current, is_valid, run_id, actor_id, change_reason
  )
  SELECT
    gen_random_uuid(), e.target_code, now(), true, true,
    'seed_balances_hydration_targets_v1', 'system', 'manual_insert'
  FROM expanded_targets e
  WHERE NOT EXISTS (
    SELECT 1 FROM public.adm_ref_goal_target_id_core_scd2 c
    WHERE c.target_code = e.target_code AND c.is_current = true AND c.is_valid = true
  )
  RETURNING target_code
)
INSERT INTO public.adm_dim_goal_target_profile_scd2 (
  record_id, target_code, target_name, target_description, domain_code,
  target_kind_code, metric_code, operator_code, value_min, value_max,
  value_text, notes_text, valid_from, is_current, is_valid,
  target_grain_code, target_scope_jsonb, display_order, attributes_jsonb,
  run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), e.target_code, e.target_name, e.target_description, 'postharvest',
  'TARGET', 'hydration_target', 'gte', e.target_value, NULL,
  NULL, NULL, now(), true, true,
  'hydration_target_by_subdomain_origin_grade', e.target_scope_jsonb,
  -- display_order: grados numéricos primero (15..75), BQT al final
  CASE WHEN e.grade_code ~ '^[0-9]+$' THEN e.grade_code::int ELSE 999 END,
  jsonb_build_object(
    'source', 'manual_seed_initial_referential_values',
    'metric_label', 'Meta de hidratación',
    'origin_label', e.origin_label,
    'subdomain_label', 'Balanzas',
    'comparison_direction', 'higher_better'
  ),
  'seed_balances_hydration_targets_v1', 'system', 'manual_insert'
FROM expanded_targets e
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_dim_goal_target_profile_scd2 t
  WHERE t.target_code = e.target_code AND t.is_current = true AND t.is_valid = true
);

COMMIT;
