-- =========================================================================
-- db_commercial.sql - Esquema canon para reclamos y maestros comerciales
-- Aplicar contra: db_commercial
-- =========================================================================

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------------
-- Limpieza de estructuras que no pertenecen a db_commercial
-- -------------------------------------------------------------------------

drop table if exists public.sls_dim_variety_profile_scd2;
drop table if exists public.sls_ref_variety_id_core_scd2;
drop table if exists public.qlt_dim_farm_profile_scd2;
drop table if exists public.qlt_ref_farm_id_core_scd2;

-- -------------------------------------------------------------------------
-- Maestros de Ventas / Comercial
-- -------------------------------------------------------------------------

create table if not exists public.sls_ref_account_executive_id_core_scd2 (
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

create table if not exists public.sls_dim_account_executive_profile_scd2 (
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

create unique index if not exists sls_ref_account_executive_id_core_scd2_current_idx
  on public.sls_ref_account_executive_id_core_scd2 (entity_id)
  where is_current;

create unique index if not exists sls_dim_account_executive_profile_scd2_current_idx
  on public.sls_dim_account_executive_profile_scd2 (entity_id)
  where is_current;

create unique index if not exists sls_dim_account_executive_profile_scd2_current_code_unique_idx
  on public.sls_dim_account_executive_profile_scd2 (lower(regexp_replace(trim(entity_code), '\s+', ' ', 'g')))
  where is_current = true
    and is_valid = true;

create table if not exists public.sls_ref_customer_id_core_scd2 (
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

create table if not exists public.sls_dim_customer_profile_scd2 (
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

create unique index if not exists sls_ref_customer_id_core_scd2_current_idx
  on public.sls_ref_customer_id_core_scd2 (entity_id)
  where is_current;

create unique index if not exists sls_dim_customer_profile_scd2_current_idx
  on public.sls_dim_customer_profile_scd2 (entity_id)
  where is_current;

create unique index if not exists sls_dim_customer_profile_scd2_current_code_unique_idx
  on public.sls_dim_customer_profile_scd2 (lower(regexp_replace(trim(entity_code), '\s+', ' ', 'g')))
  where is_current = true
    and is_valid = true;

create table if not exists public.sls_ref_commercializer_id_core_scd2 (
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

create table if not exists public.sls_dim_commercializer_profile_scd2 (
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

create unique index if not exists sls_ref_commercializer_id_core_scd2_current_idx
  on public.sls_ref_commercializer_id_core_scd2 (entity_id)
  where is_current;

create unique index if not exists sls_dim_commercializer_profile_scd2_current_idx
  on public.sls_dim_commercializer_profile_scd2 (entity_id)
  where is_current;

create unique index if not exists sls_dim_commercializer_profile_scd2_current_code_unique_idx
  on public.sls_dim_commercializer_profile_scd2 (lower(regexp_replace(trim(entity_code), '\s+', ' ', 'g')))
  where is_current = true
    and is_valid = true;

-- -------------------------------------------------------------------------
-- Arbol de problemas de reclamo
-- -------------------------------------------------------------------------

create table if not exists public.sls_ref_claim_problem_id_core_scd2 (
  record_id text primary key,
  problem_id text not null,
  valid_from timestamp without time zone not null,
  valid_to timestamp without time zone null,
  is_current boolean not null,
  is_valid boolean not null,
  loaded_at timestamp without time zone not null,
  run_id text not null,
  actor_id text not null,
  change_reason text not null
);

create table if not exists public.sls_dim_claim_problem_profile_scd2 (
  record_id text primary key,
  problem_id text not null,
  valid_from timestamp without time zone not null,
  valid_to timestamp without time zone null,
  is_current boolean not null,
  problem_code text not null,
  problem_name text not null,
  problem_level text not null,
  problem_scope text not null,
  parent_problem_id text null,
  sort_order integer not null default 0,
  problem_description text null,
  is_active boolean not null,
  is_valid boolean not null,
  loaded_at timestamp without time zone not null,
  run_id text not null,
  actor_id text not null,
  change_reason text not null
);

create table if not exists public.sls_bridge_claim_problem_parent_cur (
  problem_id text not null,
  parent_problem_id text not null,
  created_at timestamp without time zone not null,
  created_by text not null
);

create unique index if not exists sls_ref_claim_problem_id_core_scd2_current_idx
  on public.sls_ref_claim_problem_id_core_scd2 (problem_id)
  where is_current;

create unique index if not exists sls_dim_claim_problem_profile_scd2_current_idx
  on public.sls_dim_claim_problem_profile_scd2 (problem_id)
  where is_current;

create unique index if not exists sls_dim_claim_problem_profile_scd2_current_code_unique_idx
  on public.sls_dim_claim_problem_profile_scd2 (lower(regexp_replace(trim(problem_code), '\s+', ' ', 'g')))
  where is_current = true
    and is_valid = true;

create unique index if not exists sls_bridge_claim_problem_parent_cur_unique_idx
  on public.sls_bridge_claim_problem_parent_cur (problem_id, parent_problem_id);

-- -------------------------------------------------------------------------
-- Reclamos comerciales - transaccional
-- -------------------------------------------------------------------------

create table if not exists public.sls_claim_case_cur (
  claim_id text primary key,
  claim_code text not null,
  claim_scope text not null,
  credit_note_applicability text not null,
  status_key text not null,
  customer_id text null,
  commercializer_id text null,
  account_executive_id text null,
  farm_id text null,
  variety_id text null,
  process_destination_id text null,
  problem_family_id text null,
  problem_id text null,
  reference_order_number text null,
  reference_invoice_number text null,
  event_date date null,
  subject text not null,
  description text null,
  is_active boolean not null default true,
  created_at timestamp without time zone not null,
  updated_at timestamp without time zone not null,
  created_by text not null,
  updated_by text not null,
  constraint sls_claim_case_cur_scope_chk check (claim_scope in ('quality', 'commercial')),
  constraint sls_claim_case_cur_credit_chk check (credit_note_applicability in ('credit-note', 'not-applicable')),
  constraint sls_claim_case_cur_status_chk check (status_key in ('registered', 'pending-approval', 'rejected', 'pending-application', 'applied'))
);

create unique index if not exists sls_claim_case_cur_code_unique_idx
  on public.sls_claim_case_cur (lower(claim_code));

create index if not exists sls_claim_case_cur_status_idx
  on public.sls_claim_case_cur (status_key, created_at desc);

create index if not exists sls_claim_case_cur_scope_idx
  on public.sls_claim_case_cur (claim_scope, created_at desc);

create table if not exists public.sls_claim_workflow_event_cur (
  event_id text primary key,
  claim_id text not null,
  status_key text not null,
  event_type text not null,
  event_note text null,
  created_at timestamp without time zone not null,
  actor_id text not null
);

create index if not exists sls_claim_workflow_event_cur_claim_idx
  on public.sls_claim_workflow_event_cur (claim_id, created_at desc);

create table if not exists public.sls_claim_attachment_cur (
  attachment_id text primary key,
  claim_id text not null,
  original_file_name text not null,
  stored_file_name text not null,
  mime_type text not null,
  stored_mime_type text not null,
  storage_relative_path text not null,
  file_size_bytes integer not null,
  created_at timestamp without time zone not null,
  created_by text not null
);

create index if not exists sls_claim_attachment_cur_claim_idx
  on public.sls_claim_attachment_cur (claim_id, created_at desc);
