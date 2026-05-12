-- =========================================================================
-- db_general.sql - Esquema canon para maestros transversales
-- Aplicar contra: db_general
-- =========================================================================

create extension if not exists pgcrypto;

create table if not exists public.gnl_ref_variety_id_core_scd2 (
  record_id text primary key,
  entity_id text not null,
  valid_from timestamp without time zone not null,
  valid_to timestamp without time zone null,
  is_current boolean not null,
  is_valid boolean not null,
  loaded_at timestamp without time zone not null,
  run_id text not null,
  actor_id text not null,
  change_reason text not null
);

create table if not exists public.gnl_dim_variety_profile_scd2 (
  record_id text primary key,
  entity_id text not null,
  valid_from timestamp without time zone not null,
  valid_to timestamp without time zone null,
  is_current boolean not null,
  entity_code text not null,
  entity_name text not null,
  entity_description text null,
  external_ref_code text null,
  contact_email text null,
  is_active boolean not null,
  is_valid boolean not null,
  loaded_at timestamp without time zone not null,
  run_id text not null,
  actor_id text not null,
  change_reason text not null
);

create unique index if not exists gnl_ref_variety_id_core_scd2_current_idx
  on public.gnl_ref_variety_id_core_scd2 (entity_id)
  where is_current;

create unique index if not exists gnl_dim_variety_profile_scd2_current_idx
  on public.gnl_dim_variety_profile_scd2 (entity_id)
  where is_current;

create unique index if not exists gnl_dim_variety_profile_scd2_current_code_unique_idx
  on public.gnl_dim_variety_profile_scd2 (lower(regexp_replace(trim(entity_code), '\s+', ' ', 'g')))
  where is_current = true
    and is_valid = true;

create table if not exists public.gnl_ref_farm_id_core_scd2 (
  record_id text primary key,
  entity_id text not null,
  valid_from timestamp without time zone not null,
  valid_to timestamp without time zone null,
  is_current boolean not null,
  is_valid boolean not null,
  loaded_at timestamp without time zone not null,
  run_id text not null,
  actor_id text not null,
  change_reason text not null
);

create table if not exists public.gnl_dim_farm_profile_scd2 (
  record_id text primary key,
  entity_id text not null,
  valid_from timestamp without time zone not null,
  valid_to timestamp without time zone null,
  is_current boolean not null,
  entity_code text not null,
  entity_name text not null,
  entity_description text null,
  external_ref_code text null,
  contact_email text null,
  is_active boolean not null,
  is_valid boolean not null,
  loaded_at timestamp without time zone not null,
  run_id text not null,
  actor_id text not null,
  change_reason text not null
);

create unique index if not exists gnl_ref_farm_id_core_scd2_current_idx
  on public.gnl_ref_farm_id_core_scd2 (entity_id)
  where is_current;

create unique index if not exists gnl_dim_farm_profile_scd2_current_idx
  on public.gnl_dim_farm_profile_scd2 (entity_id)
  where is_current;

create unique index if not exists gnl_dim_farm_profile_scd2_current_code_unique_idx
  on public.gnl_dim_farm_profile_scd2 (lower(regexp_replace(trim(entity_code), '\s+', ' ', 'g')))
  where is_current = true
    and is_valid = true;

-- =========================================================================
-- Semillas iniciales de General
-- =========================================================================

insert into public.gnl_ref_variety_id_core_scd2 (
  record_id, entity_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
)
select *
from (
  values
    ('seed_ref_variety_xle', 'seed_variety_xle', timestamp '2026-05-11 00:00:00', null::timestamp, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de variedades en General'),
    ('seed_ref_variety_clo', 'seed_variety_clo', timestamp '2026-05-11 00:00:00', null::timestamp, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de variedades en General'),
    ('seed_ref_variety_zin', 'seed_variety_zin', timestamp '2026-05-11 00:00:00', null::timestamp, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de variedades en General')
) as seed_rows(record_id, entity_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
where not exists (
  select 1
  from public.gnl_ref_variety_id_core_scd2 existing
  where existing.record_id = seed_rows.record_id
);

insert into public.gnl_dim_variety_profile_scd2 (
  record_id, entity_id, valid_from, valid_to, is_current, entity_code, entity_name, entity_description, external_ref_code, contact_email, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
)
select *
from (
  values
    ('seed_dim_variety_xle', 'seed_variety_xle', timestamp '2026-05-11 00:00:00', null::timestamp, true, 'XLE', 'Xlence', 'Semilla inicial de variedades para reclamos', null, null, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de variedades en General'),
    ('seed_dim_variety_clo', 'seed_variety_clo', timestamp '2026-05-11 00:00:00', null::timestamp, true, 'CLO', 'Cloud', 'Semilla inicial de variedades para reclamos', null, null, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de variedades en General'),
    ('seed_dim_variety_zin', 'seed_variety_zin', timestamp '2026-05-11 00:00:00', null::timestamp, true, 'ZIN', 'Zinzi', 'Semilla inicial de variedades para reclamos', null, null, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de variedades en General')
) as seed_rows(record_id, entity_id, valid_from, valid_to, is_current, entity_code, entity_name, entity_description, external_ref_code, contact_email, is_active, is_valid, loaded_at, run_id, actor_id, change_reason)
where not exists (
  select 1
  from public.gnl_dim_variety_profile_scd2 existing
  where existing.record_id = seed_rows.record_id
);

insert into public.gnl_ref_farm_id_core_scd2 (
  record_id, entity_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
)
select *
from (
  values
    ('seed_ref_farm_mh_malima', 'seed_farm_mh_malima', timestamp '2026-05-11 00:00:00', null::timestamp, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de fincas en General'),
    ('seed_ref_farm_uio1_quito', 'seed_farm_uio1_quito', timestamp '2026-05-11 00:00:00', null::timestamp, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de fincas en General')
) as seed_rows(record_id, entity_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason)
where not exists (
  select 1
  from public.gnl_ref_farm_id_core_scd2 existing
  where existing.record_id = seed_rows.record_id
);

insert into public.gnl_dim_farm_profile_scd2 (
  record_id, entity_id, valid_from, valid_to, is_current, entity_code, entity_name, entity_description, external_ref_code, contact_email, is_active, is_valid, loaded_at, run_id, actor_id, change_reason
)
select *
from (
  values
    ('seed_dim_farm_mh_malima', 'seed_farm_mh_malima', timestamp '2026-05-11 00:00:00', null::timestamp, true, 'MHM', 'MH Malima', 'Semilla inicial de fincas para reclamos', null, null, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de fincas en General'),
    ('seed_dim_farm_uio1_quito', 'seed_farm_uio1_quito', timestamp '2026-05-11 00:00:00', null::timestamp, true, 'UIO1', 'UIO1 Quito', 'Semilla inicial de fincas para reclamos', null, null, true, true, now(), 'seed_general_masters_20260511', 'corex_seed', 'Semilla inicial de fincas en General')
) as seed_rows(record_id, entity_id, valid_from, valid_to, is_current, entity_code, entity_name, entity_description, external_ref_code, contact_email, is_active, is_valid, loaded_at, run_id, actor_id, change_reason)
where not exists (
  select 1
  from public.gnl_dim_farm_profile_scd2 existing
  where existing.record_id = seed_rows.record_id
);
