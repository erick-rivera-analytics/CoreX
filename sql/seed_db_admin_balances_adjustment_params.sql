-- ============================================================================
-- db_admin - Postharvest / Balances / Adjustment params (alpha + beta)
-- Apply against: db_admin.public
--
-- Idempotent seed. Parámetros del modelo de ajuste para Balanzas:
--   ajuste_bruto = alpha + beta * razon_ajuste
--   ajuste_final = LEAST(GREATEST(ajuste_bruto, 0.98), 1.02)
--
-- Donde razon_ajuste = peso_tallo_venta_semanal / peso_tallo_estimado_ponderado.
--
-- Valores iniciales: alpha = 0.8, beta = 0.19. Se almacenan como 2 metric_codes
-- separados con el mismo scope global (subdomain_code = "balances").
-- Si en el futuro se quiere parametrizar por finca/origen, basta con extender el
-- scope_jsonb.filters sin migrar schema.
-- ============================================================================

BEGIN;

-- ── Metric: adjustment_alpha ─────────────────────────────────────────────────
INSERT INTO public.adm_ref_metric_id_core_scd2 (
  record_id, metric_code, valid_from, is_current, is_valid, run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), 'adjustment_alpha', now(), true, true,
  'seed_balances_adjustment_params_v1', 'system', 'manual_insert'
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_metric_id_core_scd2
  WHERE metric_code = 'adjustment_alpha' AND is_current = true AND is_valid = true
);

INSERT INTO public.adm_dim_metric_profile_scd2 (
  record_id, metric_code, metric_name, metric_description, data_type_code,
  direction_code, unit_code, notes_text, valid_from, is_current, is_valid,
  run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), 'adjustment_alpha', 'Parámetro alpha (ajuste)',
  'Parámetro α de la fórmula de ajuste: ajuste_bruto = α + β·razon_ajuste. Globalmente compartido en el subdominio balances.',
  'decimal', 'neutral', NULL,
  'Seed inicial para Postcosecha / Balanzas / KPI Ajuste.',
  now(), true, true,
  'seed_balances_adjustment_params_v1', 'system', 'manual_insert'
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_dim_metric_profile_scd2
  WHERE metric_code = 'adjustment_alpha' AND is_current = true AND is_valid = true
);

-- ── Metric: adjustment_beta ──────────────────────────────────────────────────
INSERT INTO public.adm_ref_metric_id_core_scd2 (
  record_id, metric_code, valid_from, is_current, is_valid, run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), 'adjustment_beta', now(), true, true,
  'seed_balances_adjustment_params_v1', 'system', 'manual_insert'
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_metric_id_core_scd2
  WHERE metric_code = 'adjustment_beta' AND is_current = true AND is_valid = true
);

INSERT INTO public.adm_dim_metric_profile_scd2 (
  record_id, metric_code, metric_name, metric_description, data_type_code,
  direction_code, unit_code, notes_text, valid_from, is_current, is_valid,
  run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), 'adjustment_beta', 'Parámetro beta (ajuste)',
  'Parámetro β de la fórmula de ajuste: ajuste_bruto = α + β·razon_ajuste. Globalmente compartido en el subdominio balances.',
  'decimal', 'neutral', NULL,
  'Seed inicial para Postcosecha / Balanzas / KPI Ajuste.',
  now(), true, true,
  'seed_balances_adjustment_params_v1', 'system', 'manual_insert'
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_dim_metric_profile_scd2
  WHERE metric_code = 'adjustment_beta' AND is_current = true AND is_valid = true
);

-- ── Targets: 2 escalares globales ────────────────────────────────────────────
WITH target_values AS (
  SELECT *
  FROM (VALUES
    -- (metric_code, target_value, display_order)
    ('adjustment_alpha', 0.80::numeric, 1),
    ('adjustment_beta',  0.19::numeric, 2)
  ) AS v(metric_code, target_value, display_order)
),
expanded_targets AS (
  SELECT
    format('%s_balances_global', metric_code) AS target_code,
    format(
      'Parámetro %s - Balanzas (global)',
      CASE metric_code WHEN 'adjustment_alpha' THEN 'α (alpha)' ELSE 'β (beta)' END
    ) AS target_name,
    format(
      'Valor global del parámetro %s usado en la fórmula de ajuste para Balanzas.',
      metric_code
    ) AS target_description,
    metric_code, target_value, display_order,
    jsonb_build_object(
      'grain_code', 'adjustment_param_by_subdomain',
      'levels', jsonb_build_array(
        jsonb_build_object('level_index', 1, 'level_key', 'subdomain_code', 'level_label', 'Subdominio', 'value_code', 'balances', 'value_label', 'Balanzas')
      ),
      'filters', jsonb_build_object(
        'subdomain_code', 'balances',
        'metric_context', metric_code
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
    'seed_balances_adjustment_params_v1', 'system', 'manual_insert'
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
  'PARAM', e.metric_code, 'eq', e.target_value, NULL,
  NULL, NULL, now(), true, true,
  'adjustment_param_by_subdomain', e.target_scope_jsonb, e.display_order,
  jsonb_build_object(
    'source', 'manual_seed_initial_values',
    'metric_label', CASE e.metric_code WHEN 'adjustment_alpha' THEN 'α (alpha)' ELSE 'β (beta)' END,
    'subdomain_label', 'Balanzas',
    'formula', 'ajuste_bruto = alpha + beta * razon_ajuste',
    'output_range', '[0.98, 1.02]'
  ),
  'seed_balances_adjustment_params_v1', 'system', 'manual_insert'
FROM expanded_targets e
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_dim_goal_target_profile_scd2 t
  WHERE t.target_code = e.target_code AND t.is_current = true AND t.is_valid = true
);

COMMIT;
