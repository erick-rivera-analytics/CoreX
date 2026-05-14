-- Postharvest productivity blueprint for datalakehouse.
-- Project standard validated:
--   - analytical CoreX modules consume gld.mv_*_cur
--   - final explorers should not read helper vw_* directly
--   - postharvest productivity should be materialized in layers
--
-- Validated sources:
--   - slv.prod_fact_hours_cur
--   - slv.prod_dim_activity_profile_scd2
--   - slv.prod_fact_balanza_1_cur
--   - slv.prod_fact_balanza_1a_cur
--   - slv.prod_fact_balanza_1c_cur
--   - slv.prod_fact_balanza_2_cur
--   - slv.prod_fact_balanza_2a_cur
--   - slv.prod_fact_balanza_3_cur
--
-- Notes:
--   - KPI grain is driven by post_date, not cycle_key
--   - B2 must be corrected by peel_type, not only by origin
--   - productivity rules are mirrored from db_postharvest into datalakehouse
--   - this file implements:
--       1. gld.mv_prod_postharvest_capacity_hours_cur
--       2. gld.mv_prod_postharvest_step_flow_cur
--       helper table gld.prod_dim_postharvest_productivity_rule_cur
--   - allocation-heavy layers remain intentionally pending:
--       3. gld.mv_prod_postharvest_hours_box_detail_cur
--       4. gld.mv_prod_postharvest_hours_box_cur

create table if not exists gld.prod_dim_postharvest_productivity_rule_cur (
  rule_id text primary key,
  rule_scope_area text not null,
  rule_code text not null,
  activity_id text not null,
  activity_name text not null,
  baseline_actual_hours_q1 double precision null,
  path_rule text not null,
  variety_filter text not null,
  destination_filter text not null,
  methodology_code text not null,
  applies_to text not null,
  stage_side text not null,
  anchor_final text not null,
  allowed_steps text null,
  path_split_basis text null,
  step_split_basis text null,
  is_misassigned boolean not null,
  is_inactive boolean not null,
  is_active boolean not null,
  confidence_level text null,
  source_kind text null,
  notes text null,
  group_name text null,
  natural_key text not null,
  source_valid_from timestamp without time zone null,
  source_valid_to timestamp without time zone null,
  source_loaded_at timestamp without time zone null,
  source_run_id text null,
  source_actor_id text null,
  source_change_reason text null,
  synced_at timestamp without time zone not null default now()
);

create unique index if not exists prod_dim_postharvest_productivity_rule_cur_natural_key_idx
  on gld.prod_dim_postharvest_productivity_rule_cur (lower(regexp_replace(trim(natural_key), '\s+', ' ', 'g')));

create index if not exists prod_dim_postharvest_productivity_rule_cur_scope_idx
  on gld.prod_dim_postharvest_productivity_rule_cur (rule_scope_area, activity_id);

create index if not exists prod_dim_postharvest_productivity_rule_cur_method_idx
  on gld.prod_dim_postharvest_productivity_rule_cur (methodology_code, path_rule, anchor_final);

drop materialized view if exists gld.mv_prod_postharvest_rule_side_hours_cur;
drop materialized view if exists gld.mv_prod_postharvest_rule_hours_cur;
drop materialized view if exists gld.mv_prod_postharvest_period_universe_cur;
drop materialized view if exists gld.mv_prod_postharvest_lot_final_output_cur;
drop materialized view if exists gld.mv_prod_postharvest_day_universe_cur;
drop materialized view if exists gld.mv_prod_postharvest_step_flow_cur;
drop materialized view if exists gld.mv_prod_postharvest_capacity_hours_cur;

create materialized view gld.mv_prod_postharvest_capacity_hours_cur as
with target_areas as (
  select unnest(array['CLS', 'EMP', 'SB'])::text as area_id
),
activity_dim_current as (
  select distinct on (activity_id)
    activity_id,
    nullif(trim(activity_name), '') as activity_name,
    nullif(trim(activity_type), '') as activity_type,
    nullif(trim(cost_area), '') as cost_area,
    nullif(trim(sub_cost_center), '') as sub_cost_center,
    nullif(trim(unit_of_measure), '') as unit_of_measure,
    valid_from,
    valid_to
  from slv.prod_dim_activity_profile_scd2
  where is_current = true
  order by activity_id, valid_from desc nulls last
)
select
  extract(year from h.work_date)::int as work_year,
  h.work_date,
  h.event_id,
  h.hours_event_id,
  h.person_id,
  h.area_id,
  h.block_id,
  h.cycle_key,
  h.activity_id,
  d.activity_name,
  d.activity_type,
  d.cost_area,
  d.sub_cost_center,
  d.unit_of_measure,
  coalesce(h.actual_hours, 0)::double precision as actual_hours,
  coalesce(h.effective_hours, 0)::double precision as effective_hours,
  coalesce(h.units_produced, 0)::double precision as units_produced,
  h.start_time,
  h.end_time,
  h.is_valid,
  (h.cycle_key is not null) as has_cycle_key,
  (d.activity_id is null) as is_missing_activity_dim,
  case
    when coalesce(d.unit_of_measure, '') = 'H NORMALES' then true
    when abs(coalesce(h.units_produced, 0) - coalesce(h.actual_hours, 0)) <= 0.01 then true
    else false
  end as is_hours_like_output,
  case
    when d.activity_id is null then false
    when coalesce(d.unit_of_measure, '') = '' then false
    when coalesce(d.unit_of_measure, '') = 'H NORMALES' then false
    when abs(coalesce(h.units_produced, 0) - coalesce(h.actual_hours, 0)) <= 0.01 then false
    else true
  end as is_productivity_candidate
from slv.prod_fact_hours_cur h
join target_areas ta
  on ta.area_id = h.area_id
left join activity_dim_current d
  on d.activity_id = h.activity_id
where coalesce(h.is_valid, true) = true
  and h.work_date is not null
  and extract(year from h.work_date)::int >= 2024;

create index if not exists idx_mv_prod_postharvest_capacity_hours_cur_work_date
  on gld.mv_prod_postharvest_capacity_hours_cur (work_date);

create index if not exists idx_mv_prod_postharvest_capacity_hours_cur_area_activity
  on gld.mv_prod_postharvest_capacity_hours_cur (area_id, activity_id);

create index if not exists idx_mv_prod_postharvest_capacity_hours_cur_cycle
  on gld.mv_prod_postharvest_capacity_hours_cur (cycle_key);

create materialized view gld.mv_prod_postharvest_step_flow_cur as
with activity_dim_current as (
  select distinct on (activity_id)
    activity_id,
    nullif(trim(activity_name), '') as activity_name,
    nullif(trim(activity_type), '') as activity_type,
    nullif(trim(cost_area), '') as cost_area,
    nullif(trim(sub_cost_center), '') as sub_cost_center,
    nullif(trim(unit_of_measure), '') as unit_of_measure,
    valid_from,
    valid_to
  from slv.prod_dim_activity_profile_scd2
  where is_current = true
  order by activity_id, valid_from desc nulls last
),
b1 as (
  select
    case
      when upper(trim(coalesce(destination, ''))) like '%GV%' then 'GV'
      when upper(trim(coalesce(destination, ''))) = 'PRECLASIFICACION' then 'PRECLASIFICACION'
      when upper(trim(coalesce(destination, ''))) = 'APERTURA' then 'APERTURA'
      else 'UNKNOWN'
    end as path_post,
    'B1'::text as step_code,
    work_date::date as post_date,
    work_date::date as lot_date,
    case
      when upper(trim(coalesce(variety, ''))) in ('XL', 'XLE', 'GYPXLE', 'XLENCE') then 'XLE'
      when upper(trim(coalesce(variety, ''))) in ('CLO', 'GYPCLO', 'CLOUD') then 'CLO'
      when upper(trim(coalesce(variety, ''))) in ('ZIN', 'ZZ', 'GYPZZ', 'ZINZI') then 'ZIN'
      when nullif(upper(trim(coalesce(variety, ''))), '') is null then 'UNKNOWN'
      else upper(trim(variety))
    end as variety_canon,
    case
      when nullif(upper(trim(coalesce(grade, ''))), '') is null then 'UNKNOWN'
      when upper(trim(grade)) like 'BQT%' or upper(trim(grade)) like 'PET%' then upper(trim(grade))
      when substring(upper(trim(grade)) from '([0-9]+)') is not null then substring(upper(trim(grade)) from '([0-9]+)')
      else upper(trim(grade))
    end as grade_code,
    null::text as final_destination,
    nullif(upper(trim(coalesce(destination, ''))), 'UNKNOWN') as destination_raw,
    null::text as origin_raw,
    null::text as sku,
    null::text as product_type,
    coalesce(stems_count, 0)::double precision as stems_count,
    null::double precision as bunches_count,
    case
      when coalesce(camp_weight, 0) > 0 then coalesce(camp_weight, 0)::double precision
      else coalesce(net_weight, 0)::double precision
    end as weight_kg,
    cycle_key,
    nullif(trim(block_id), '') as block_id,
    null::text as parent_block,
    null::text as person_id,
    null::text as activity_id,
    null::text as activity_name,
    'prod_fact_balanza_1_cur'::text as source_table,
    'destination_b1'::text as path_assignment_mode
  from slv.prod_fact_balanza_1_cur
  where coalesce(is_valid, true) = true
),
b1c as (
  select
    case
      when upper(trim(coalesce(destination, ''))) like '%GV%' then 'GV'
      when upper(trim(coalesce(destination, ''))) = 'PRECLASIFICACION' then 'PRECLASIFICACION'
      when upper(trim(coalesce(destination, ''))) = 'APERTURA' then 'APERTURA'
      else 'UNKNOWN'
    end as path_post,
    'B1C'::text as step_code,
    work_date::date as post_date,
    coalesce(origin_date::date, work_date::date) as lot_date,
    case
      when upper(trim(coalesce(variety, ''))) in ('XL', 'XLE', 'GYPXLE', 'XLENCE') then 'XLE'
      when upper(trim(coalesce(variety, ''))) in ('CLO', 'GYPCLO', 'CLOUD') then 'CLO'
      when upper(trim(coalesce(variety, ''))) in ('ZIN', 'ZZ', 'GYPZZ', 'ZINZI') then 'ZIN'
      when nullif(upper(trim(coalesce(variety, ''))), '') is null then 'UNKNOWN'
      else upper(trim(variety))
    end as variety_canon,
    case
      when nullif(upper(trim(coalesce(grade, ''))), '') is null then 'UNKNOWN'
      when upper(trim(grade)) like 'BQT%' or upper(trim(grade)) like 'PET%' then upper(trim(grade))
      when substring(upper(trim(grade)) from '([0-9]+)') is not null then substring(upper(trim(grade)) from '([0-9]+)')
      else upper(trim(grade))
    end as grade_code,
    null::text as final_destination,
    nullif(upper(trim(coalesce(destination, ''))), 'UNKNOWN') as destination_raw,
    nullif(upper(trim(coalesce(process, ''))), 'UNKNOWN') as origin_raw,
    null::text as sku,
    nullif(upper(trim(coalesce(process, ''))), '') as product_type,
    coalesce(stems_count, 0)::double precision as stems_count,
    null::double precision as bunches_count,
    coalesce(net_weight, 0)::double precision as weight_kg,
    null::text as cycle_key,
    null::text as block_id,
    null::text as parent_block,
    null::text as person_id,
    nullif(trim(activity_id), '') as activity_id,
    null::text as activity_name,
    'prod_fact_balanza_1c_cur'::text as source_table,
    'destination_b1c'::text as path_assignment_mode
  from slv.prod_fact_balanza_1c_cur
  where coalesce(is_valid, true) = true
),
b1a as (
  select
    'PRECLASIFICACION'::text as path_post,
    'B1A'::text as step_code,
    work_date::date as post_date,
    work_date::date as lot_date,
    'XLE'::text as variety_canon,
    case
      when upper(trim(coalesce(product_type, ''))) = 'BQT' then 'BQT'
      when upper(trim(coalesce(product_type, ''))) like '%PETIT%'
        or upper(trim(coalesce(grade, ''))) like '%PET%' then 'PET'
      when coalesce(nullif(upper(trim(coalesce(grade, ''))), ''), 'UNKNOWN') in ('0', '00', '000') then 'BQT'
      when nullif(upper(trim(coalesce(grade, ''))), '') is null then 'UNKNOWN'
      when upper(trim(grade)) like 'BQT%' or upper(trim(grade)) like 'PET%' then upper(trim(grade))
      when substring(upper(trim(grade)) from '([0-9]+)') is not null then substring(upper(trim(grade)) from '([0-9]+)')
      else upper(trim(grade))
    end as grade_code,
    null::text as final_destination,
    nullif(upper(trim(coalesce(destination, ''))), 'UNKNOWN') as destination_raw,
    nullif(upper(trim(coalesce(origin, ''))), 'UNKNOWN') as origin_raw,
    null::text as sku,
    nullif(upper(trim(coalesce(product_type, ''))), '') as product_type,
    coalesce(stems_count, 0)::double precision as stems_count,
    null::double precision as bunches_count,
    coalesce(scale_weight, 0)::double precision as weight_kg,
    null::text as cycle_key,
    null::text as block_id,
    null::text as parent_block,
    null::text as person_id,
    null::text as activity_id,
    null::text as activity_name,
    'prod_fact_balanza_1a_cur'::text as source_table,
    'preclas_bridge_b1a'::text as path_assignment_mode
  from slv.prod_fact_balanza_1a_cur
  where coalesce(is_valid, true) = true
),
b2 as (
  select
    case
      when upper(trim(coalesce(peel_type, ''))) = 'PELADO' then 'PRECLASIFICACION'
      when upper(trim(coalesce(origin, ''))) = 'APERTURA' then 'APERTURA'
      when upper(trim(coalesce(origin, ''))) = 'GVPELADO' then 'GV'
      when upper(trim(coalesce(origin, ''))) like '%GV%' then 'GV'
      else 'UNKNOWN'
    end as path_post,
    'B2'::text as step_code,
    delivered_date::date as post_date,
    origin_date::date as lot_date,
    case
      when upper(trim(coalesce(variety, ''))) in ('XL', 'XLE', 'GYPXLE', 'XLENCE') then 'XLE'
      when upper(trim(coalesce(variety, ''))) in ('CLO', 'GYPCLO', 'CLOUD') then 'CLO'
      when upper(trim(coalesce(variety, ''))) in ('ZIN', 'ZZ', 'GYPZZ', 'ZINZI') then 'ZIN'
      when nullif(upper(trim(coalesce(variety, ''))), '') is null then 'UNKNOWN'
      else upper(trim(variety))
    end as variety_canon,
    case
      when nullif(upper(trim(coalesce(grade, ''))), '') is null then 'UNKNOWN'
      when upper(trim(grade)) like 'BQT%' or upper(trim(grade)) like 'PET%' then upper(trim(grade))
      when substring(upper(trim(grade)) from '([0-9]+)') is not null then substring(upper(trim(grade)) from '([0-9]+)')
      else upper(trim(grade))
    end as grade_code,
    case
      when upper(trim(coalesce(destination, ''))) in ('CLASIFICACION', 'PESADO', 'GUIRNALDA') then 'BLANCO'
      when upper(trim(coalesce(destination, ''))) = 'ARCOIRIS' then 'ARCOIRIS'
      when upper(trim(coalesce(destination, ''))) = 'TINTURADO' then 'TINTURADO'
      else null
    end as final_destination,
    nullif(upper(trim(coalesce(destination, ''))), 'UNKNOWN') as destination_raw,
    nullif(upper(trim(coalesce(origin, ''))), 'UNKNOWN') as origin_raw,
    null::text as sku,
    nullif(upper(trim(coalesce(product, ''))), '') as product_type,
    coalesce(stems_count, 0)::double precision as stems_count,
    null::double precision as bunches_count,
    coalesce(net_weight, 0)::double precision as weight_kg,
    null::text as cycle_key,
    null::text as block_id,
    null::text as parent_block,
    null::text as person_id,
    null::text as activity_id,
    null::text as activity_name,
    'prod_fact_balanza_2_cur'::text as source_table,
    'peel_type_b2_fix'::text as path_assignment_mode
  from slv.prod_fact_balanza_2_cur
  where coalesce(is_valid, true) = true
),
b2a as (
  select
    case
      when upper(trim(coalesce(f.origin, ''))) like '%GV%' then 'GV'
      when upper(trim(coalesce(f.origin, ''))) in ('BLANCO', 'TINTURADO', 'ARCOIRIS') then 'APERTURA'
      when upper(trim(coalesce(f.origin, ''))) = 'APERTURA' then 'APERTURA'
      else 'UNKNOWN'
    end as path_post,
    'B2A'::text as step_code,
    f.work_date::date as post_date,
    f.origin_date::date as lot_date,
    case
      when upper(trim(coalesce(f.variety, ''))) in ('XL', 'XLE', 'GYPXLE', 'XLENCE') then 'XLE'
      when upper(trim(coalesce(f.variety, ''))) in ('CLO', 'GYPCLO', 'CLOUD') then 'CLO'
      when upper(trim(coalesce(f.variety, ''))) in ('ZIN', 'ZZ', 'GYPZZ', 'ZINZI') then 'ZIN'
      when nullif(upper(trim(coalesce(f.variety, ''))), '') is null then 'UNKNOWN'
      else upper(trim(f.variety))
    end as variety_canon,
    case
      when nullif(upper(trim(coalesce(f.grade, ''))), '') is null then 'UNKNOWN'
      when upper(trim(f.grade)) like 'BQT%' or upper(trim(f.grade)) like 'PET%' then upper(trim(f.grade))
      when substring(upper(trim(f.grade)) from '([0-9]+)') is not null then substring(upper(trim(f.grade)) from '([0-9]+)')
      else upper(trim(f.grade))
    end as grade_code,
    case
      when upper(trim(coalesce(a.activity_id, f.activity_id, ''))) ~ 'GUFDGU|GUIRN' then 'BLANCO'
      when upper(trim(coalesce(a.activity_id, f.activity_id, ''))) ~ 'CXLTARH|CXLTAR' then 'ARCOIRIS'
      when upper(trim(coalesce(a.activity_id, f.activity_id, ''))) ~ 'CXLTA1|CXLTA|05CTS' then 'TINTURADO'
      when upper(trim(coalesce(a.activity_id, f.activity_id, ''))) ~ '^CB|CBX|CBM' then 'BLANCO'
      when upper(trim(coalesce(a.activity_name, ''))) like '%GUIRNALD%'
        or upper(trim(coalesce(a.activity_name, ''))) like '%BLANCO%'
        or upper(trim(coalesce(a.activity_name, ''))) like '%CLASIFIC%' then 'BLANCO'
      when upper(trim(coalesce(a.activity_name, ''))) like '%ARCO%' then 'ARCOIRIS'
      when upper(trim(coalesce(a.activity_name, ''))) like '%TINTUR%' then 'TINTURADO'
      else null
    end as final_destination,
    nullif(upper(trim(coalesce(a.activity_name, ''))), 'UNKNOWN') as destination_raw,
    nullif(upper(trim(coalesce(f.origin, ''))), 'UNKNOWN') as origin_raw,
    null::text as sku,
    null::text as product_type,
    coalesce(f.stems_count, 0)::double precision
      * case when coalesce(f.bunches_count, 0) > 0 then coalesce(f.bunches_count, 0)::double precision else 1.0 end as stems_count,
    coalesce(f.bunches_count, 0)::double precision as bunches_count,
    coalesce(f.net_weight, 0)::double precision as weight_kg,
    null::text as cycle_key,
    null::text as block_id,
    null::text as parent_block,
    nullif(trim(f.person_id), '') as person_id,
    nullif(trim(f.activity_id), '') as activity_id,
    a.activity_name,
    'prod_fact_balanza_2a_cur'::text as source_table,
    'origin_b2a'::text as path_assignment_mode
  from slv.prod_fact_balanza_2a_cur f
  left join activity_dim_current a
    on a.activity_id = f.activity_id
  where coalesce(f.is_valid, true) = true
),
b3 as (
  select
    'PRECLASIFICACION'::text as path_post,
    'B3'::text as step_code,
    work_date::date as post_date,
    lot::date as lot_date,
    case
      when upper(trim(coalesce(sku, ''))) ~ 'CLOUD|GYPCLO|\\-\\s*CLO$' then 'CLO'
      when upper(trim(coalesce(sku, ''))) ~ 'XLENCE|GYPXLE|\\-\\s*XL$' then 'XLE'
      when upper(trim(coalesce(sku, ''))) ~ 'ZINZI|GYPZZ|\\-\\s*ZZ$' then 'ZIN'
      else 'UNKNOWN'
    end as variety_canon,
    case
      when nullif(upper(trim(coalesce(grade, ''))), '') is null then 'UNKNOWN'
      when upper(trim(grade)) like 'BQT%' or upper(trim(grade)) like 'PET%' then upper(trim(grade))
      when substring(upper(trim(grade)) from '([0-9]+)') is not null then substring(upper(trim(grade)) from '([0-9]+)')
      else upper(trim(grade))
    end as grade_code,
    case
      when upper(trim(coalesce(sku, ''))) like '%TINT%' then 'TINTURADO'
      when upper(trim(coalesce(sku, ''))) like '%ARCO%'
        or upper(trim(coalesce(sku, ''))) like '%RAINBOW%' then 'ARCOIRIS'
      else 'BLANCO'
    end as final_destination,
    case
      when upper(trim(coalesce(sku, ''))) like '%TINT%' then 'TINTURADO'
      when upper(trim(coalesce(sku, ''))) like '%ARCO%'
        or upper(trim(coalesce(sku, ''))) like '%RAINBOW%' then 'ARCOIRIS'
      else 'BLANCO'
    end as destination_raw,
    'PRECLASIFICACION'::text as origin_raw,
    nullif(trim(sku), '') as sku,
    null::text as product_type,
    coalesce(stems_count, 0)::double precision
      * case when coalesce(bunches_count_procona, 0) > 0 then coalesce(bunches_count_procona, 0)::double precision else 1.0 end as stems_count,
    coalesce(bunches_count_procona, 0)::double precision as bunches_count,
    coalesce(net_weight, 0)::double precision as weight_kg,
    null::text as cycle_key,
    null::text as block_id,
    null::text as parent_block,
    null::text as person_id,
    null::text as activity_id,
    null::text as activity_name,
    'prod_fact_balanza_3_cur'::text as source_table,
    'sku_b3'::text as path_assignment_mode
  from slv.prod_fact_balanza_3_cur
  where coalesce(is_valid, true) = true
),
unioned as (
  select * from b1
  union all
  select * from b1c
  union all
  select * from b1a
  union all
  select * from b2
  union all
  select * from b2a
  union all
  select * from b3
),
normalized as (
  select
    post_date,
    lot_date,
    path_post,
    step_code,
    variety_canon,
    case
      when grade_code in ('0', '00', '000') then 'BQT'
      else grade_code
    end as grade_code,
    case
      when substring(
        case when grade_code in ('0', '00', '000') then 'BQT' else grade_code end
        from '([0-9]+)'
      ) is not null
      then substring(
        case when grade_code in ('0', '00', '000') then 'BQT' else grade_code end
        from '([0-9]+)'
      )::int
      else null
    end as grade_int,
    final_destination,
    destination_raw,
    origin_raw,
    sku,
    product_type,
    stems_count,
    bunches_count,
    weight_kg,
    case
      when variety_canon = 'CLO' and path_post = 'APERTURA' then true
      when variety_canon = 'CLO' then false
      when variety_canon in ('XLE', 'ZIN')
        and path_post in ('APERTURA', 'GV', 'PRECLASIFICACION') then true
      when variety_canon in ('XLE', 'ZIN') then false
      else null
    end as is_allowed_path,
    case
      when final_destination is null then null
      when variety_canon = 'CLO'
        and path_post = 'APERTURA'
        and final_destination = 'BLANCO' then true
      when variety_canon = 'CLO' then false
      when variety_canon in ('XLE', 'ZIN')
        and path_post in ('APERTURA', 'GV', 'PRECLASIFICACION')
        and final_destination in ('BLANCO', 'ARCOIRIS', 'TINTURADO') then true
      when variety_canon in ('XLE', 'ZIN') then false
      else null
    end as is_allowed_destination,
    case when variety_canon = 'ZIN' then true else false end as is_projected_only_variety,
    cycle_key,
    block_id,
    parent_block,
    person_id,
    activity_id,
    activity_name,
    source_table,
    path_assignment_mode
  from unioned
)
select
  post_date,
  lot_date,
  path_post,
  step_code,
  variety_canon,
  grade_code,
  grade_int,
  final_destination,
  destination_raw,
  origin_raw,
  sku,
  product_type,
  stems_count,
  bunches_count,
  weight_kg,
  is_allowed_path,
  is_allowed_destination,
  is_projected_only_variety,
  cycle_key,
  block_id,
  parent_block,
  person_id,
  activity_id,
  activity_name,
  source_table,
  path_assignment_mode
from normalized
where post_date is not null
  and path_post <> 'UNKNOWN'
  and stems_count > 0
  and weight_kg > 0;

create index if not exists idx_mv_prod_postharvest_step_flow_cur_post_date
  on gld.mv_prod_postharvest_step_flow_cur (post_date);

create index if not exists idx_mv_prod_postharvest_step_flow_cur_lot_date
  on gld.mv_prod_postharvest_step_flow_cur (lot_date);

create index if not exists idx_mv_prod_postharvest_step_flow_cur_path_destination
  on gld.mv_prod_postharvest_step_flow_cur (path_post, final_destination);

create index if not exists idx_mv_prod_postharvest_step_flow_cur_variety
  on gld.mv_prod_postharvest_step_flow_cur (variety_canon);

create index if not exists idx_mv_prod_postharvest_step_flow_cur_step
  on gld.mv_prod_postharvest_step_flow_cur (step_code);

drop materialized view if exists gld.mv_prod_postharvest_day_universe_cur;

create materialized view gld.mv_prod_postharvest_day_universe_cur as
with base as (
  select
    post_date as work_date,
    sum(case when step_code = 'B1' then stems_count else 0 end)::double precision as b1_stems,
    sum(case when step_code = 'B1A' then stems_count else 0 end)::double precision as b1a_stems,
    sum(case when step_code = 'B1C' then stems_count else 0 end)::double precision as b1c_stems,
    sum(case when step_code = 'B2' then stems_count else 0 end)::double precision as b2_stems,
    sum(case when step_code = 'B2A' then weight_kg else 0 end)::double precision as b2a_weight_kg,
    sum(case when step_code = 'B3' then weight_kg else 0 end)::double precision as b3_weight_kg,
    sum(case when step_code = 'B2A' then coalesce(bunches_count, 0) else 0 end)::double precision as b2a_bunches,
    sum(case when step_code = 'B3' then coalesce(bunches_count, 0) else 0 end)::double precision as b3_bunches
  from gld.mv_prod_postharvest_step_flow_cur
  group by post_date
)
select
  work_date,
  b1_stems,
  b1a_stems,
  b1c_stems,
  b2_stems,
  b2a_weight_kg,
  b3_weight_kg,
  b2a_bunches,
  b3_bunches,
  (b1c_stems + b1a_stems)::double precision as cls_upstream_stems,
  b2_stems::double precision as cls_downstream_stems,
  b1_stems::double precision as sb_upstream_stems,
  b2_stems::double precision as sb_downstream_stems,
  (b2a_weight_kg + b3_weight_kg)::double precision as emp_final_weight_kg,
  (b2a_bunches + b3_bunches)::double precision as emp_final_bunches
from base;

create index if not exists idx_mv_prod_postharvest_day_universe_cur_work_date
  on gld.mv_prod_postharvest_day_universe_cur (work_date);

drop materialized view if exists gld.mv_prod_postharvest_lot_final_output_cur;

create materialized view gld.mv_prod_postharvest_lot_final_output_cur as
with final_steps as (
  select
    lot_date,
    post_date,
    path_post,
    variety_canon,
    final_destination,
    sum(weight_kg)::double precision as weight_kg,
    sum(coalesce(bunches_count, 0))::double precision as bunches_count,
    sum(stems_count)::double precision as stems_count
  from gld.mv_prod_postharvest_step_flow_cur
  where (step_code = 'B2A' and path_post in ('APERTURA', 'GV'))
     or (step_code = 'B3' and path_post = 'PRECLASIFICACION')
  group by lot_date, post_date, path_post, variety_canon, final_destination
),
totals as (
  select
    lot_date,
    path_post,
    variety_canon,
    final_destination,
    sum(weight_kg)::double precision as lot_weight_total_kg,
    sum(bunches_count)::double precision as lot_bunches_total,
    sum(stems_count)::double precision as lot_stems_total
  from final_steps
  group by lot_date, path_post, variety_canon, final_destination
)
select
  f.lot_date,
  f.post_date,
  f.path_post,
  f.variety_canon,
  f.final_destination,
  f.weight_kg,
  f.bunches_count,
  f.stems_count,
  t.lot_weight_total_kg,
  t.lot_bunches_total,
  t.lot_stems_total,
  case
    when coalesce(t.lot_weight_total_kg, 0) > 0 then f.weight_kg / t.lot_weight_total_kg
    else 0
  end as share_kg_to_post_date
from final_steps f
join totals t
  on t.lot_date = f.lot_date
 and t.path_post = f.path_post
 and t.variety_canon = f.variety_canon
 and t.final_destination = f.final_destination;

create index if not exists idx_mv_prod_postharvest_lot_final_output_cur_lot_date
  on gld.mv_prod_postharvest_lot_final_output_cur (lot_date);

create index if not exists idx_mv_prod_postharvest_lot_final_output_cur_post_date
  on gld.mv_prod_postharvest_lot_final_output_cur (post_date);

create index if not exists idx_mv_prod_postharvest_lot_final_output_cur_path_destination
  on gld.mv_prod_postharvest_lot_final_output_cur (path_post, final_destination);

drop materialized view if exists gld.mv_prod_postharvest_period_universe_cur;

create materialized view gld.mv_prod_postharvest_period_universe_cur as
with final_output as (
  select
    path_post,
    final_destination,
    sum(weight_kg)::double precision as final_weight_kg,
    sum(bunches_count)::double precision as final_bunches
  from gld.mv_prod_postharvest_lot_final_output_cur
  group by path_post, final_destination
),
b2_output as (
  select
    path_post,
    final_destination,
    sum(stems_count)::double precision as b2_stems
  from gld.mv_prod_postharvest_step_flow_cur
  where step_code = 'B2'
  group by path_post, final_destination
),
universe as (
  select
    coalesce(f.path_post, b.path_post) as path_post,
    coalesce(f.final_destination, b.final_destination) as final_destination,
    coalesce(f.final_weight_kg, 0)::double precision as final_weight_kg,
    coalesce(f.final_bunches, 0)::double precision as final_bunches,
    coalesce(b.b2_stems, 0)::double precision as b2_stems
  from final_output f
  full join b2_output b
    on b.path_post = f.path_post
   and b.final_destination = f.final_destination
),
totals as (
  select
    sum(final_weight_kg)::double precision as total_final_weight_kg,
    sum(final_bunches)::double precision as total_final_bunches,
    sum(b2_stems)::double precision as total_b2_stems
  from universe
)
select
  u.path_post,
  u.final_destination,
  u.final_weight_kg,
  u.final_bunches,
  u.b2_stems,
  case when coalesce(t.total_final_weight_kg, 0) > 0 then u.final_weight_kg / t.total_final_weight_kg else 0 end as share_final_weight,
  case when coalesce(t.total_final_bunches, 0) > 0 then u.final_bunches / t.total_final_bunches else 0 end as share_final_bunches,
  case when coalesce(t.total_b2_stems, 0) > 0 then u.b2_stems / t.total_b2_stems else 0 end as share_b2_stems
from universe u
cross join totals t;

create index if not exists idx_mv_prod_postharvest_period_universe_cur_path_destination
  on gld.mv_prod_postharvest_period_universe_cur (path_post, final_destination);

drop materialized view if exists gld.mv_prod_postharvest_rule_hours_cur;

create materialized view gld.mv_prod_postharvest_rule_hours_cur as
select
  h.work_date,
  r.rule_scope_area,
  r.rule_id,
  r.rule_code,
  r.activity_id,
  r.activity_name,
  r.baseline_actual_hours_q1,
  r.path_rule,
  r.variety_filter,
  r.destination_filter,
  r.methodology_code,
  r.applies_to,
  r.stage_side,
  r.anchor_final,
  r.allowed_steps,
  r.path_split_basis,
  r.step_split_basis,
  r.is_misassigned,
  r.is_inactive,
  r.is_active,
  r.confidence_level,
  r.source_kind,
  r.notes,
  r.group_name,
  h.cost_area,
  h.sub_cost_center,
  h.activity_type,
  sum(h.actual_hours)::double precision as actual_hours,
  sum(h.effective_hours)::double precision as effective_hours,
  sum(h.units_produced)::double precision as units_produced,
  count(*)::int as hours_event_count,
  count(distinct h.person_id)::int as distinct_people
from gld.mv_prod_postharvest_capacity_hours_cur h
join gld.prod_dim_postharvest_productivity_rule_cur r
  on r.rule_scope_area = h.area_id
 and r.activity_id = h.activity_id
where r.is_active = true
  and r.is_inactive = false
group by
  h.work_date,
  r.rule_scope_area,
  r.rule_id,
  r.rule_code,
  r.activity_id,
  r.activity_name,
  r.baseline_actual_hours_q1,
  r.path_rule,
  r.variety_filter,
  r.destination_filter,
  r.methodology_code,
  r.applies_to,
  r.stage_side,
  r.anchor_final,
  r.allowed_steps,
  r.path_split_basis,
  r.step_split_basis,
  r.is_misassigned,
  r.is_inactive,
  r.is_active,
  r.confidence_level,
  r.source_kind,
  r.notes,
  r.group_name,
  h.cost_area,
  h.sub_cost_center,
  h.activity_type;

create index if not exists idx_mv_prod_postharvest_rule_hours_cur_work_date
  on gld.mv_prod_postharvest_rule_hours_cur (work_date);

create index if not exists idx_mv_prod_postharvest_rule_hours_cur_scope_activity
  on gld.mv_prod_postharvest_rule_hours_cur (rule_scope_area, activity_id);

create index if not exists idx_mv_prod_postharvest_rule_hours_cur_rule
  on gld.mv_prod_postharvest_rule_hours_cur (rule_id);

drop materialized view if exists gld.mv_prod_postharvest_rule_side_hours_cur;

create materialized view gld.mv_prod_postharvest_rule_side_hours_cur as
with activity_rule_counts as (
  select
    rule_scope_area,
    activity_id,
    count(*)::int as rule_count
  from gld.prod_dim_postharvest_productivity_rule_cur
  where is_active = true
    and is_inactive = false
  group by rule_scope_area, activity_id
),
cls_support_activity_set as (
  select distinct activity_id
  from gld.prod_dim_postharvest_productivity_rule_cur
  where rule_scope_area = 'CLS'
    and methodology_code = 'KG_CAPACIDAD'
    and is_active = true
    and is_inactive = false
),
cls_productive_activity_set as (
  select distinct activity_id
  from gld.prod_dim_postharvest_productivity_rule_cur
  where rule_scope_area = 'CLS'
    and is_active = true
    and is_inactive = false
    and is_misassigned = false
    and methodology_code <> 'KG_CAPACIDAD'
),
cls_support_empirical_m as (
  with day_hours as (
    select
      h.work_date,
      sum(case when h.activity_id in (select activity_id from cls_productive_activity_set) then h.effective_hours else 0 end)::double precision as productive_hours,
      sum(case when h.activity_id in (select activity_id from cls_support_activity_set) then h.effective_hours else 0 end)::double precision as support_hours
    from gld.mv_prod_postharvest_capacity_hours_cur h
    where h.area_id = 'CLS'
    group by h.work_date
  ),
  ratios as (
    select productive_hours / support_hours as ratio
    from day_hours
    where productive_hours > 0
      and support_hours > 0
  )
  select coalesce(percentile_cont(0.5) within group (order by ratio), 1.0)::double precision as support_m
  from ratios
),
cls_segment_people as (
  with segment_rows as (
    select distinct
      h.work_date,
      h.person_id,
      case
        when r.stage_side in ('UPSTREAM_ONLY', 'MIXED')
          and r.applies_to in ('UPSTREAM', 'BOTH')
          and r.path_rule = 'PRECLAS'
          then 'UPSTREAM_PRECLAS'
        when r.stage_side in ('UPSTREAM_ONLY', 'MIXED')
          and r.applies_to in ('UPSTREAM', 'BOTH')
          and r.path_rule in ('APERTURA', 'GV', 'APERTURA_GV_SPLIT', 'ALL_PATHS_SPLIT')
          then 'UPSTREAM_AGV'
        when r.stage_side in ('DOWNSTREAM_ONLY', 'MIXED')
          and r.applies_to in ('DOWNSTREAM', 'BOTH')
          then 'DOWNSTREAM'
        else null
      end as segment_name
    from gld.mv_prod_postharvest_capacity_hours_cur h
    join gld.prod_dim_postharvest_productivity_rule_cur r
      on r.rule_scope_area = 'CLS'
     and r.activity_id = h.activity_id
    where h.area_id = 'CLS'
      and r.is_active = true
      and r.is_inactive = false
      and r.is_misassigned = false
      and r.methodology_code <> 'KG_CAPACIDAD'
      and h.person_id is not null
  )
  select
    work_date,
    count(distinct person_id) filter (where segment_name = 'UPSTREAM_AGV')::int as upstream_agv_people,
    count(distinct person_id) filter (where segment_name = 'UPSTREAM_PRECLAS')::int as upstream_preclas_people,
    count(distinct person_id) filter (where segment_name = 'DOWNSTREAM')::int as downstream_people
  from segment_rows
  where segment_name is not null
  group by work_date
),
cls_support_shares as (
  select
    d.work_date,
    case when d.b1c_stems > 0 then 1.0 else 0.0 end as est_up_agv,
    case when d.b1a_stems > 0 then 1.0 else 0.0 end as est_up_preclas,
    coalesce(p.downstream_people, 0)::double precision / greatest(m.support_m, 0.000001) as est_down_pool,
    (
      case when d.b1c_stems > 0 then 1.0 else 0.0 end
      + case when d.b1a_stems > 0 then 1.0 else 0.0 end
      + coalesce(p.downstream_people, 0)::double precision / greatest(m.support_m, 0.000001)
    ) as est_total,
    case
      when (
        case when d.b1c_stems > 0 then 1.0 else 0.0 end
        + case when d.b1a_stems > 0 then 1.0 else 0.0 end
        + coalesce(p.downstream_people, 0)::double precision / greatest(m.support_m, 0.000001)
      ) > 0
      then (
        case when d.b1c_stems > 0 then 1.0 else 0.0 end
        + case when d.b1a_stems > 0 then 1.0 else 0.0 end
      ) / (
        case when d.b1c_stems > 0 then 1.0 else 0.0 end
        + case when d.b1a_stems > 0 then 1.0 else 0.0 end
        + coalesce(p.downstream_people, 0)::double precision / greatest(m.support_m, 0.000001)
      )
      else 0
    end as share_up_support,
    case
      when (
        case when d.b1c_stems > 0 then 1.0 else 0.0 end
        + case when d.b1a_stems > 0 then 1.0 else 0.0 end
        + coalesce(p.downstream_people, 0)::double precision / greatest(m.support_m, 0.000001)
      ) > 0
      then (
        coalesce(p.downstream_people, 0)::double precision / greatest(m.support_m, 0.000001)
      ) / (
        case when d.b1c_stems > 0 then 1.0 else 0.0 end
        + case when d.b1a_stems > 0 then 1.0 else 0.0 end
        + coalesce(p.downstream_people, 0)::double precision / greatest(m.support_m, 0.000001)
      )
      else 0
    end as share_down_support
  from gld.mv_prod_postharvest_day_universe_cur d
  cross join cls_support_empirical_m m
  left join cls_segment_people p
    on p.work_date = d.work_date
),
cls_m_tallos_productivity as (
  with up_acts as (
    select distinct activity_id
    from gld.prod_dim_postharvest_productivity_rule_cur
    where rule_scope_area = 'CLS'
      and stage_side = 'UPSTREAM_ONLY'
      and is_active = true
      and is_inactive = false
  ),
  down_acts as (
    select distinct activity_id
    from gld.prod_dim_postharvest_productivity_rule_cur
    where rule_scope_area = 'CLS'
      and stage_side = 'DOWNSTREAM_ONLY'
      and is_active = true
      and is_inactive = false
  ),
  hours_totals as (
    select
      sum(case when activity_id in (select activity_id from up_acts) then effective_hours else 0 end)::double precision as up_hours,
      sum(case when activity_id in (select activity_id from down_acts) then effective_hours else 0 end)::double precision as down_hours
    from gld.mv_prod_postharvest_rule_hours_cur
    where rule_scope_area = 'CLS'
  ),
  step_totals as (
    select
      sum(case when step_code = 'B1' and path_post = 'PRECLASIFICACION' then stems_count else 0 end)::double precision as up_stems,
      sum(case when step_code = 'B2' then stems_count else 0 end)::double precision as down_stems
    from gld.mv_prod_postharvest_step_flow_cur
  )
  select
    case
      when coalesce(h.up_hours, 0) > 0
       and coalesce(h.down_hours, 0) > 0
       and coalesce(s.up_stems, 0) > 0
       and coalesce(s.down_stems, 0) > 0
      then
        (s.down_stems / h.down_hours)
        / ((s.up_stems / h.up_hours) + (s.down_stems / h.down_hours))
      else 0.5
    end as share_up_m_tallos
  from hours_totals h
  cross join step_totals s
),
base_rule_side as (
  select
    r.work_date,
    r.rule_scope_area,
    r.rule_id,
    r.rule_code,
    r.activity_id,
    r.activity_name,
    r.baseline_actual_hours_q1,
    r.path_rule,
    r.variety_filter,
    r.destination_filter,
    r.methodology_code,
    r.applies_to,
    r.stage_side,
    r.anchor_final,
    r.allowed_steps,
    r.path_split_basis,
    r.step_split_basis,
    r.is_misassigned,
    r.is_inactive,
    r.is_active,
    r.confidence_level,
    r.source_kind,
    r.notes,
    r.group_name,
    r.cost_area,
    r.sub_cost_center,
    r.activity_type,
    r.actual_hours,
    r.effective_hours,
    r.units_produced,
    r.hours_event_count,
    r.distinct_people,
    arc.rule_count,
    case
      when r.rule_scope_area = 'EMP' then 'EMP_ALL_DOWNSTREAM'
      when r.rule_scope_area = 'CLS' and r.methodology_code = 'KG_CAPACIDAD' then 'CLS_SUPPORT_STATIONS'
      when r.rule_scope_area = 'CLS'
        and r.stage_side = 'MIXED'
        and r.methodology_code = 'TALLOS_CAPACIDAD'
        and coalesce(arc.rule_count, 0) > 1 then 'CLS_M_TALLOS_PRODUCTIVITY'
      when r.stage_side = 'UPSTREAM_ONLY' then 'UPSTREAM_ONLY'
      when r.stage_side = 'DOWNSTREAM_ONLY' then 'DOWNSTREAM_ONLY'
      when r.stage_side = 'MIXED' then 'DAY_UNIVERSE_SPLIT'
      else 'UNCLASSIFIED'
    end as split_strategy,
    case
      when r.rule_scope_area = 'EMP' then 0::double precision
      when r.rule_scope_area = 'CLS' and r.methodology_code = 'KG_CAPACIDAD'
        then coalesce(cs.share_up_support, 0)::double precision
      when r.rule_scope_area = 'CLS'
        and r.stage_side = 'MIXED'
        and r.methodology_code = 'TALLOS_CAPACIDAD'
        and coalesce(arc.rule_count, 0) > 1
        then coalesce(mt.share_up_m_tallos, 0.5)::double precision
      when r.stage_side = 'UPSTREAM_ONLY' then 1::double precision
      when r.stage_side = 'DOWNSTREAM_ONLY' then 0::double precision
      when r.rule_scope_area = 'CLS'
        then coalesce(d.cls_upstream_stems / nullif(d.cls_upstream_stems + d.cls_downstream_stems, 0), 0)::double precision
      when r.rule_scope_area = 'SB'
        then coalesce(d.sb_upstream_stems / nullif(d.sb_upstream_stems + d.sb_downstream_stems, 0), 0)::double precision
      else 0::double precision
    end as upstream_share_raw,
    case
      when r.rule_scope_area = 'EMP' then 1::double precision
      when r.rule_scope_area = 'CLS' and r.methodology_code = 'KG_CAPACIDAD'
        then coalesce(cs.share_down_support, 0)::double precision
      when r.rule_scope_area = 'CLS'
        and r.stage_side = 'MIXED'
        and r.methodology_code = 'TALLOS_CAPACIDAD'
        and coalesce(arc.rule_count, 0) > 1
        then (1 - coalesce(mt.share_up_m_tallos, 0.5))::double precision
      when r.stage_side = 'UPSTREAM_ONLY' then 0::double precision
      when r.stage_side = 'DOWNSTREAM_ONLY' then 1::double precision
      when r.rule_scope_area = 'CLS'
        then coalesce(d.cls_downstream_stems / nullif(d.cls_upstream_stems + d.cls_downstream_stems, 0), 0)::double precision
      when r.rule_scope_area = 'SB'
        then coalesce(d.sb_downstream_stems / nullif(d.sb_upstream_stems + d.sb_downstream_stems, 0), 0)::double precision
      else 1::double precision
    end as downstream_share_raw
  from gld.mv_prod_postharvest_rule_hours_cur r
  left join activity_rule_counts arc
    on arc.rule_scope_area = r.rule_scope_area
   and arc.activity_id = r.activity_id
  left join gld.mv_prod_postharvest_day_universe_cur d
    on d.work_date = r.work_date
  left join cls_support_shares cs
    on cs.work_date = r.work_date
  cross join cls_m_tallos_productivity mt
)
select
  b.*,
  case
    when b.applies_to = 'UPSTREAM' then 1::double precision
    when b.applies_to = 'DOWNSTREAM' then 0::double precision
    when coalesce(b.upstream_share_raw, 0) + coalesce(b.downstream_share_raw, 0) > 0
      then coalesce(b.upstream_share_raw, 0)
        / (coalesce(b.upstream_share_raw, 0) + coalesce(b.downstream_share_raw, 0))
    when b.rule_scope_area = 'EMP' then 0::double precision
    when b.stage_side = 'UPSTREAM_ONLY' then 1::double precision
    when b.stage_side = 'DOWNSTREAM_ONLY' then 0::double precision
    else 0.5::double precision
  end as upstream_share,
  case
    when b.applies_to = 'UPSTREAM' then 0::double precision
    when b.applies_to = 'DOWNSTREAM' then 1::double precision
    when coalesce(b.upstream_share_raw, 0) + coalesce(b.downstream_share_raw, 0) > 0
      then coalesce(b.downstream_share_raw, 0)
        / (coalesce(b.upstream_share_raw, 0) + coalesce(b.downstream_share_raw, 0))
    when b.rule_scope_area = 'EMP' then 1::double precision
    when b.stage_side = 'UPSTREAM_ONLY' then 0::double precision
    when b.stage_side = 'DOWNSTREAM_ONLY' then 1::double precision
    else 0.5::double precision
  end as downstream_share,
  b.effective_hours * (
    case
      when b.applies_to = 'UPSTREAM' then 1::double precision
      when b.applies_to = 'DOWNSTREAM' then 0::double precision
      when coalesce(b.upstream_share_raw, 0) + coalesce(b.downstream_share_raw, 0) > 0
        then coalesce(b.upstream_share_raw, 0)
          / (coalesce(b.upstream_share_raw, 0) + coalesce(b.downstream_share_raw, 0))
      when b.rule_scope_area = 'EMP' then 0::double precision
      when b.stage_side = 'UPSTREAM_ONLY' then 1::double precision
      when b.stage_side = 'DOWNSTREAM_ONLY' then 0::double precision
      else 0.5::double precision
    end
  ) as hours_upstream,
  b.effective_hours * (
    case
      when b.applies_to = 'UPSTREAM' then 0::double precision
      when b.applies_to = 'DOWNSTREAM' then 1::double precision
      when coalesce(b.upstream_share_raw, 0) + coalesce(b.downstream_share_raw, 0) > 0
        then coalesce(b.downstream_share_raw, 0)
          / (coalesce(b.upstream_share_raw, 0) + coalesce(b.downstream_share_raw, 0))
      when b.rule_scope_area = 'EMP' then 1::double precision
      when b.stage_side = 'UPSTREAM_ONLY' then 0::double precision
      when b.stage_side = 'DOWNSTREAM_ONLY' then 1::double precision
      else 0.5::double precision
    end
  ) as hours_downstream
from base_rule_side b;

create index if not exists idx_mv_prod_postharvest_rule_side_hours_cur_work_date
  on gld.mv_prod_postharvest_rule_side_hours_cur (work_date);

create index if not exists idx_mv_prod_postharvest_rule_side_hours_cur_scope_activity
  on gld.mv_prod_postharvest_rule_side_hours_cur (rule_scope_area, activity_id);

create index if not exists idx_mv_prod_postharvest_rule_side_hours_cur_rule
  on gld.mv_prod_postharvest_rule_side_hours_cur (rule_id);

-- Pending materialized layer 3:
-- gld.mv_prod_postharvest_hours_box_detail_cur
--
-- Target grain:
--   post_date, path_post, final_destination, lot_date, variety_canon,
--   area_id, cost_area, sub_cost_center, activity_id
--
-- Expected outputs:
--   effective_hours_assigned
--   weight_kg
--   boxes10
--   hours_per_box
--   match_kind
--   stage_side
--   allocation_method
--
-- This layer should host the heavy numeric allocation logic.

-- Pending materialized layer 4:
-- gld.mv_prod_postharvest_hours_box_cur
--
-- This is the final CoreX explorer contract.
-- It should aggregate the detail layer by post_date and operational slices.
--
-- Recommended refresh order:
--   1. gld.mv_prod_postharvest_capacity_hours_cur
--   2. gld.mv_prod_postharvest_step_flow_cur
--   3. gld.mv_prod_postharvest_hours_box_detail_cur
--   4. gld.mv_prod_postharvest_hours_box_cur
