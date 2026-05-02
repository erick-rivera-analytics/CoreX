-- ============================================================================
-- db_admin - Postharvest / Balances / Hours per bed targets
-- Apply against: db_admin.public
--
-- Idempotent seed. It preserves existing targets and inserts only missing active
-- target_code records. No destructive operations.
-- ============================================================================

BEGIN;

-- Domain: Postcosecha.
INSERT INTO public.adm_dim_catalog_domain_profile_cur (
  domain_code,
  domain_name,
  domain_description,
  display_order,
  is_valid,
  run_id,
  actor_id,
  change_reason
)
VALUES (
  'postharvest',
  'Postcosecha',
  'Maestros y metas del dominio de postcosecha.',
  7,
  true,
  'seed_postharvest_hours_per_bed_targets_v1',
  'system',
  'manual_insert'
)
ON CONFLICT (domain_code) DO UPDATE SET
  domain_name = EXCLUDED.domain_name,
  domain_description = EXCLUDED.domain_description,
  is_valid = true,
  loaded_at = now(),
  run_id = EXCLUDED.run_id,
  actor_id = EXCLUDED.actor_id,
  change_reason = EXCLUDED.change_reason;

-- Unit: hours per bed.
INSERT INTO public.adm_ref_unit_of_measure_id_core_scd2 (
  record_id,
  unit_code,
  valid_from,
  is_current,
  is_valid,
  run_id,
  actor_id,
  change_reason
)
SELECT
  gen_random_uuid(),
  'HR_PER_BED',
  now(),
  true,
  true,
  'seed_postharvest_hours_per_bed_targets_v1',
  'system',
  'manual_insert'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_ref_unit_of_measure_id_core_scd2
  WHERE unit_code = 'HR_PER_BED'
    AND is_current = true
    AND is_valid = true
);

INSERT INTO public.adm_dim_unit_of_measure_profile_scd2 (
  record_id,
  unit_code,
  unit_name,
  unit_symbol,
  unit_category_code,
  notes_text,
  valid_from,
  is_current,
  is_valid,
  run_id,
  actor_id,
  change_reason
)
SELECT
  gen_random_uuid(),
  'HR_PER_BED',
  'Horas por cama',
  'h/cama',
  'time',
  'Unidad operativa para metas de Horas / Cama.',
  now(),
  true,
  true,
  'seed_postharvest_hours_per_bed_targets_v1',
  'system',
  'manual_insert'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_dim_unit_of_measure_profile_scd2
  WHERE unit_code = 'HR_PER_BED'
    AND is_current = true
    AND is_valid = true
);

-- Metric: Horas / Cama.
INSERT INTO public.adm_ref_metric_id_core_scd2 (
  record_id,
  metric_code,
  valid_from,
  is_current,
  is_valid,
  run_id,
  actor_id,
  change_reason
)
SELECT
  gen_random_uuid(),
  'hours_per_bed',
  now(),
  true,
  true,
  'seed_postharvest_hours_per_bed_targets_v1',
  'system',
  'manual_insert'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_ref_metric_id_core_scd2
  WHERE metric_code = 'hours_per_bed'
    AND is_current = true
    AND is_valid = true
);

INSERT INTO public.adm_dim_metric_profile_scd2 (
  record_id,
  metric_code,
  metric_name,
  metric_description,
  data_type_code,
  direction_code,
  unit_code,
  notes_text,
  valid_from,
  is_current,
  is_valid,
  run_id,
  actor_id,
  change_reason
)
SELECT
  gen_random_uuid(),
  'hours_per_bed',
  'Horas / Cama',
  'Meta operativa de horas por cama por subdominio, variedad, tipo SP y semana ISO.',
  'decimal',
  'neutral',
  'HR_PER_BED',
  'Seed inicial para Postcosecha / Balanzas.',
  now(),
  true,
  true,
  'seed_postharvest_hours_per_bed_targets_v1',
  'system',
  'manual_insert'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_dim_metric_profile_scd2
  WHERE metric_code = 'hours_per_bed'
    AND is_current = true
    AND is_valid = true
);

-- Normalize target codes if an older run produced blank-padded week suffixes
-- such as "w 1" instead of "w01".
UPDATE public.adm_ref_goal_target_id_core_scd2
SET
  target_code = regexp_replace(target_code, '_w\s+([1-9])$', '_w0\1'),
  loaded_at = now(),
  run_id = 'seed_postharvest_hours_per_bed_targets_v1',
  actor_id = 'system',
  change_reason = 'source_correction'
WHERE target_code ~ '^hours_per_bed_balances_[a-z0-9]+_[a-z0-9]+_w\s+[1-9]$';

UPDATE public.adm_dim_goal_target_profile_scd2
SET
  target_code = regexp_replace(target_code, '_w\s+([1-9])$', '_w0\1'),
  loaded_at = now(),
  run_id = 'seed_postharvest_hours_per_bed_targets_v1',
  actor_id = 'system',
  change_reason = 'source_correction'
WHERE target_code ~ '^hours_per_bed_balances_[a-z0-9]+_[a-z0-9]+_w\s+[1-9]$';

WITH target_values AS (
  SELECT *
  FROM (VALUES
    -- CLO
    ('CLO', 'S',  1,  4, 11.5158594::numeric),
    ('CLO', 'P1', 1,  4, 10.4823598::numeric),
    ('CLO', 'P2', 1,  4,  9.16893966::numeric),
    ('CLO', 'P3', 1,  4,  7.79359871::numeric),
    ('CLO', 'S',  5,  8, 11.2908566::numeric),
    ('CLO', 'P1', 5,  8, 10.27755::numeric),
    ('CLO', 'P2', 5,  8,  8.98979216::numeric),
    ('CLO', 'P3', 5,  8,  7.64132333::numeric),
    ('CLO', 'S',  9, 17, 10.9870068::numeric),
    ('CLO', 'P1', 9, 17, 10.0009694::numeric),
    ('CLO', 'P2', 9, 17,  8.74786663::numeric),
    ('CLO', 'P3', 9, 17,  7.43568664::numeric),
    ('CLO', 'S', 18, 22, 11.1222619::numeric),
    ('CLO', 'P1',18, 22, 10.124086::numeric),
    ('CLO', 'P2',18, 22,  8.8555569::numeric),
    ('CLO', 'P3',18, 22,  7.52722337::numeric),
    ('CLO', 'S', 23, 26, 11.3751309::numeric),
    ('CLO', 'P1',23, 26, 10.3542611::numeric),
    ('CLO', 'P2',23, 26,  9.05689148::numeric),
    ('CLO', 'P3',23, 26,  7.69835776::numeric),
    ('CLO', 'S', 27, 30, 11.835745::numeric),
    ('CLO', 'P1',27, 30, 10.773537::numeric),
    ('CLO', 'P2',27, 30,  9.42363294::numeric),
    ('CLO', 'P3',27, 30,  8.010088::numeric),
    ('CLO', 'S', 31, 35, 11.9518174::numeric),
    ('CLO', 'P1',31, 35, 10.8791924::numeric),
    ('CLO', 'P2',31, 35,  9.51604986::numeric),
    ('CLO', 'P3',31, 35,  8.08864238::numeric),
    ('CLO', 'S', 36, 39, 12.2103093::numeric),
    ('CLO', 'P1',36, 39, 11.1144857::numeric),
    ('CLO', 'P2',36, 39,  9.72186138::numeric),
    ('CLO', 'P3',36, 39,  8.26358218::numeric),
    ('CLO', 'S', 40, 43, 12.00715::numeric),
    ('CLO', 'P1',40, 43, 10.9295591::numeric),
    ('CLO', 'P2',40, 43,  9.56010578::numeric),
    ('CLO', 'P3',40, 43,  8.12608991::numeric),
    ('CLO', 'S', 44, 47, 12.1232223::numeric),
    ('CLO', 'P1',44, 47, 11.0352145::numeric),
    ('CLO', 'P2',44, 47,  9.65252269::numeric),
    ('CLO', 'P3',44, 47,  8.20464429::numeric),
    ('CLO', 'S', 48, 52, 11.879422::numeric),
    ('CLO', 'P1',48, 52, 10.8132941::numeric),
    ('CLO', 'P2',48, 52,  9.45840857::numeric),
    ('CLO', 'P3',48, 52,  8.03964728::numeric),

    -- XLE
    ('XLE', 'S',  1,  4, 15.3740236::numeric),
    ('XLE', 'P1', 1,  4, 15.073714::numeric),
    ('XLE', 'P2', 1,  4, 13.9345399::numeric),
    ('XLE', 'P3', 1,  4, 13.3344393::numeric),
    ('XLE', 'P4', 1,  4, 12.49023::numeric),
    ('XLE', 'P5', 1,  4, 10.7052411::numeric),
    ('XLE', 'S',  5,  8, 15.2050772::numeric),
    ('XLE', 'P1', 5,  8, 14.9080678::numeric),
    ('XLE', 'P2', 5,  8, 13.7814122::numeric),
    ('XLE', 'P3', 5,  8, 13.1879061::numeric),
    ('XLE', 'P4', 5,  8, 12.3529739::numeric),
    ('XLE', 'P5', 5,  8, 10.5876004::numeric),
    ('XLE', 'S',  9, 13, 15.0361309::numeric),
    ('XLE', 'P1', 9, 13, 14.7424216::numeric),
    ('XLE', 'P2', 9, 13, 13.6282845::numeric),
    ('XLE', 'P3', 9, 13, 13.0413729::numeric),
    ('XLE', 'P4', 9, 13, 12.2157177::numeric),
    ('XLE', 'P5', 9, 13, 10.4699596::numeric),
    ('XLE', 'S', 14, 26, 14.6451123::numeric),
    ('XLE', 'P1',14, 26, 14.359041::numeric),
    ('XLE', 'P2',14, 26, 13.2738773::numeric),
    ('XLE', 'P3',14, 26, 12.7022286::numeric),
    ('XLE', 'P4',14, 26, 11.8980448::numeric),
    ('XLE', 'P5',14, 26, 10.1976856::numeric),
    ('XLE', 'S', 27, 30, 14.8029242::numeric),
    ('XLE', 'P1',27, 30, 14.5137702::numeric),
    ('XLE', 'P2',27, 30, 13.4169131::numeric),
    ('XLE', 'P3',27, 30, 12.8391044::numeric),
    ('XLE', 'P4',27, 30, 12.026255::numeric),
    ('XLE', 'P5',27, 30, 10.3075731::numeric),
    ('XLE', 'S', 31, 35, 14.9886196::numeric),
    ('XLE', 'P1',31, 35, 14.6958383::numeric),
    ('XLE', 'P2',31, 35, 13.5852217::numeric),
    ('XLE', 'P3',31, 35, 13.0001647::numeric),
    ('XLE', 'P4',31, 35, 12.1771184::numeric),
    ('XLE', 'P5',31, 35, 10.4368766::numeric),
    ('XLE', 'S', 36, 43, 15.6401158::numeric),
    ('XLE', 'P1',36, 43, 15.3346085::numeric),
    ('XLE', 'P2',36, 43, 14.1757177::numeric),
    ('XLE', 'P3',36, 43, 13.5652306::numeric),
    ('XLE', 'P4',36, 43, 12.7064097::numeric),
    ('XLE', 'P5',36, 43, 10.8905264::numeric),
    ('XLE', 'S', 44, 47, 15.4909743::numeric),
    ('XLE', 'P1',44, 47, 15.1883803::numeric),
    ('XLE', 'P2',44, 47, 14.0405405::numeric),
    ('XLE', 'P3',44, 47, 13.4358748::numeric),
    ('XLE', 'P4',44, 47, 12.5852436::numeric),
    ('XLE', 'P5',44, 47, 10.7866762::numeric),
    ('XLE', 'S', 48, 52, 15.3740236::numeric),
    ('XLE', 'P1',48, 52, 15.073714::numeric),
    ('XLE', 'P2',48, 52, 13.9345399::numeric),
    ('XLE', 'P3',48, 52, 13.3344393::numeric),
    ('XLE', 'P4',48, 52, 12.49023::numeric),
    ('XLE', 'P5',48, 52, 10.7052411::numeric)
  ) AS v(variety_code, sp_type_code, week_from, week_to, target_value)
),
expanded_targets AS (
  SELECT
    format(
      'hours_per_bed_balances_%s_%s_w%02s',
      lower(variety_code),
      lower(sp_type_code),
      lpad(week_number::text, 2, '0')
    ) AS target_code,
    format(
      'Horas / Cama - Balanzas - %s - %s - Semana %s',
      variety_code,
      sp_type_code,
      lpad(week_number::text, 2, '0')
    ) AS target_name,
    'Meta semanal de Horas / Cama para Postcosecha / Balanzas.' AS target_description,
    variety_code,
    sp_type_code,
    week_number,
    target_value,
    jsonb_build_object(
      'grain_code', 'hours_per_bed_by_subdomain_variety_sp_type_iso_week',
      'levels', jsonb_build_array(
        jsonb_build_object(
          'level_index', 1,
          'level_key', 'subdomain_code',
          'level_label', 'Subdominio',
          'value_code', 'balances',
          'value_label', 'Balanzas'
        ),
        jsonb_build_object(
          'level_index', 2,
          'level_key', 'variety_code',
          'level_label', 'Variedad',
          'value_code', variety_code,
          'value_label', variety_code
        ),
        jsonb_build_object(
          'level_index', 3,
          'level_key', 'sp_type_code',
          'level_label', 'Tipo SP',
          'value_code', sp_type_code,
          'value_label', sp_type_code
        ),
        jsonb_build_object(
          'level_index', 4,
          'level_key', 'iso_week',
          'level_label', 'Semana ISO',
          'value_code', week_number::text,
          'value_label', format('Semana %s', lpad(week_number::text, 2, '0'))
        )
      ),
      'filters', jsonb_build_object(
        'subdomain_code', 'balances',
        'variety_code', variety_code,
        'sp_type_code', sp_type_code,
        'iso_week', week_number::text,
        'iso_week_id', week_number::text
      )
    ) AS target_scope_jsonb
  FROM target_values
  CROSS JOIN LATERAL generate_series(week_from, week_to) AS weeks(week_number)
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
    e.target_code,
    now(),
    true,
    true,
    'seed_postharvest_hours_per_bed_targets_v1',
    'system',
    'manual_insert'
  FROM expanded_targets e
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.adm_ref_goal_target_id_core_scd2 c
    WHERE c.target_code = e.target_code
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
  e.target_code,
  e.target_name,
  e.target_description,
  'postharvest',
  'TARGET',
  'hours_per_bed',
  'eq',
  e.target_value,
  NULL,
  NULL,
  NULL,
  now(),
  true,
  true,
  'hours_per_bed_by_subdomain_variety_sp_type_iso_week',
  e.target_scope_jsonb,
  (e.week_number * 1000)
    + CASE e.variety_code WHEN 'CLO' THEN 100 ELSE 200 END
    + CASE e.sp_type_code
        WHEN 'S' THEN 1
        WHEN 'P1' THEN 2
        WHEN 'P2' THEN 3
        WHEN 'P3' THEN 4
        WHEN 'P4' THEN 5
        WHEN 'P5' THEN 6
        ELSE 99
      END,
  jsonb_build_object(
    'source', 'manual_seed_from_user_table',
    'subdomain_label', 'Balanzas'
  ),
  'seed_postharvest_hours_per_bed_targets_v1',
  'system',
  'manual_insert'
FROM expanded_targets e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.adm_dim_goal_target_profile_scd2 t
  WHERE t.target_code = e.target_code
    AND t.is_current = true
    AND t.is_valid = true
);

COMMIT;
