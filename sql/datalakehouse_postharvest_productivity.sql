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
--   - this file implements:
--       1. gld.mv_prod_postharvest_capacity_hours_cur
--       2. gld.mv_prod_postharvest_step_flow_cur
--   - allocation-heavy layers remain intentionally pending:
--       3. gld.mv_prod_postharvest_hours_box_detail_cur
--       4. gld.mv_prod_postharvest_hours_box_cur

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

drop materialized view if exists gld.mv_prod_postharvest_step_flow_cur;

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
