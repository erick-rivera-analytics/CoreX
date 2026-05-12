-- ============================================================================
-- db_admin - Postharvest / Balances / Waste KPI targets
-- Apply against: db_admin.public
--
-- Idempotent seed. Inserta metas de desperdicio por destino para el subdominio
-- balances. Sigue el patrón canon SCD2.
--
-- Meta desperdicio = ratio | SUM(peso_b2a) / SUM(peso_b2) | máximo aceptable por
-- destino. Almacenada POSITIVA en value_min; el loader TS aplica el signo
-- negativo para alinear con la convención "menos es mejor" del cómputo real.
--
-- Direction = lower_better (en magnitud absoluta).
-- ============================================================================

BEGIN;

-- ── Metric: waste_target ─────────────────────────────────────────────────────
INSERT INTO public.adm_ref_metric_id_core_scd2 (
  record_id, metric_code, valid_from, is_current, is_valid, run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), 'waste_target', now(), true, true,
  'seed_balances_waste_targets_v1', 'system', 'manual_insert'
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_ref_metric_id_core_scd2
  WHERE metric_code = 'waste_target' AND is_current = true AND is_valid = true
);

INSERT INTO public.adm_dim_metric_profile_scd2 (
  record_id, metric_code, metric_name, metric_description, data_type_code,
  direction_code, unit_code, notes_text, valid_from, is_current, is_valid,
  run_id, actor_id, change_reason
)
SELECT
  gen_random_uuid(), 'waste_target', 'Meta de desperdicio',
  'Meta KPI de desperdicio: |SUM(peso_b2a)/SUM(peso_b2)| máximo aceptable por destino. Almacenada positiva; el loader aplica signo negativo internamente.',
  'decimal', 'lower_better', NULL,
  'Seed inicial para Postcosecha / Balanzas / KPI Desperdicio.',
  now(), true, true,
  'seed_balances_waste_targets_v1', 'system', 'manual_insert'
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_dim_metric_profile_scd2
  WHERE metric_code = 'waste_target' AND is_current = true AND is_valid = true
);

-- ── Targets: waste por destino (origen = APERTURA inicial) ───────────────────
WITH target_values AS (
  SELECT *
  FROM (VALUES
    -- (origin_code, origin_label, destination_code, destination_label, target_ratio_positive)
    ('opening', 'Apertura', 'BLANCO',    'Blanco',    0.27::numeric),
    ('opening', 'Apertura', 'TINTURADO', 'Tinturado', 0.25::numeric),
    ('opening', 'Apertura', 'ARCOIRIS',  'Arcoíris',  0.29::numeric)
  ) AS v(origin_code, origin_label, destination_code, destination_label, target_value)
),
expanded_targets AS (
  SELECT
    format('waste_target_balances_%s_%s', lower(origin_code), lower(destination_code)) AS target_code,
    format('Meta desperdicio - Balanzas - %s - %s', origin_label, destination_label) AS target_name,
    'Meta de desperdicio (|SUM(b2a)/SUM(b2)|) por destino para Postcosecha / Balanzas.' AS target_description,
    origin_code, origin_label, destination_code, destination_label, target_value,
    jsonb_build_object(
      'grain_code', 'waste_target_by_subdomain_origin_destination',
      'levels', jsonb_build_array(
        jsonb_build_object('level_index', 1, 'level_key', 'subdomain_code', 'level_label', 'Subdominio', 'value_code', 'balances', 'value_label', 'Balanzas'),
        jsonb_build_object('level_index', 2, 'level_key', 'origin_code', 'level_label', 'Origen', 'value_code', origin_code, 'value_label', origin_label),
        jsonb_build_object('level_index', 3, 'level_key', 'destination_code', 'level_label', 'Destino', 'value_code', destination_code, 'value_label', destination_label)
      ),
      'filters', jsonb_build_object(
        'subdomain_code', 'balances',
        'origin_code', origin_code,
        'destination_code', destination_code,
        'metric_context', 'waste_target'
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
    'seed_balances_waste_targets_v1', 'system', 'manual_insert'
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
  'TARGET', 'waste_target', 'lte', e.target_value, NULL,
  NULL, 'value_min se almacena positivo (|ratio|); el loader aplica signo.', now(), true, true,
  'waste_target_by_subdomain_origin_destination', e.target_scope_jsonb,
  CASE e.destination_code
    WHEN 'BLANCO' THEN 1
    WHEN 'TINTURADO' THEN 2
    WHEN 'ARCOIRIS' THEN 3
    ELSE 99
  END,
  jsonb_build_object(
    'source', 'manual_seed_initial_referential_values',
    'metric_label', 'Meta de desperdicio',
    'origin_label', e.origin_label,
    'subdomain_label', 'Balanzas',
    'comparison_direction', 'lower_better',
    'sign_convention', 'stored_positive_inverted_in_loader'
  ),
  'seed_balances_waste_targets_v1', 'system', 'manual_insert'
FROM expanded_targets e
WHERE NOT EXISTS (
  SELECT 1 FROM public.adm_dim_goal_target_profile_scd2 t
  WHERE t.target_code = e.target_code AND t.is_current = true AND t.is_valid = true
);

COMMIT;
