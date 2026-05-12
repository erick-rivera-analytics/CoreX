-- =========================================================================
-- db_postharvest.sql - Esquema canon para maestros operativos de Postcosecha
-- Aplicar contra: db_postharvest
-- =========================================================================

create extension if not exists pgcrypto;

create table if not exists public.postharvest_ref_destination_id_core_scd2 (
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

create table if not exists public.postharvest_dim_destination_profile_scd2 (
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

create unique index if not exists postharvest_ref_destination_id_core_scd2_current_idx
  on public.postharvest_ref_destination_id_core_scd2 (entity_id)
  where is_current;

create unique index if not exists postharvest_dim_destination_profile_scd2_current_idx
  on public.postharvest_dim_destination_profile_scd2 (entity_id)
  where is_current;

create unique index if not exists postharvest_dim_destination_profile_scd2_current_code_unique_idx
  on public.postharvest_dim_destination_profile_scd2 (lower(regexp_replace(trim(entity_code), '\s+', ' ', 'g')))
  where is_current = true
    and is_valid = true;

create index if not exists postharvest_dim_destination_profile_scd2_name_idx
  on public.postharvest_dim_destination_profile_scd2 (lower(regexp_replace(trim(entity_name), '\s+', ' ', 'g')));

delete from public.postharvest_dim_destination_profile_scd2
where entity_id = 'seed_postharvest_destination_na'
   or record_id = 'seed_dim_postharvest_destination_na'
   or (is_current = true and upper(trim(entity_code)) = 'NA');

delete from public.postharvest_ref_destination_id_core_scd2
where entity_id = 'seed_postharvest_destination_na'
   or record_id = 'seed_ref_postharvest_destination_na';
