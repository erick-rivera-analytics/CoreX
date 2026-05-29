create table if not exists public.field_fumigation_week_block_plan_cur (
  plan_id text primary key,
  iso_week_id text not null,
  cycle_key text not null,
  block_id text not null,
  parent_block text null,
  area_id text null,
  variety_code text not null,
  phenological_week integer not null,
  fumigation_kind text not null check (fumigation_kind in ('REGULAR', 'DRON', 'LANZAS')),
  default_kind text not null default 'REGULAR' check (default_kind in ('REGULAR', 'DRON', 'LANZAS')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  confirmed_at timestamptz null,
  confirmed_by text null,
  actor_id text null
);

alter table public.field_fumigation_week_block_plan_cur
  add column if not exists confirmed_at timestamptz null;

alter table public.field_fumigation_week_block_plan_cur
  add column if not exists confirmed_by text null;

create unique index if not exists field_fumigation_week_block_plan_cur_uq
  on public.field_fumigation_week_block_plan_cur (iso_week_id, cycle_key);

create table if not exists public.field_fumigation_week_block_plan_log (
  event_id text primary key,
  plan_id text null,
  iso_week_id text not null,
  cycle_key text not null,
  block_id text not null,
  parent_block text null,
  area_id text null,
  variety_code text not null,
  phenological_week integer not null,
  previous_kind text null check (previous_kind in ('REGULAR', 'DRON', 'LANZAS')),
  next_kind text not null check (next_kind in ('REGULAR', 'DRON', 'LANZAS')),
  default_kind text not null check (default_kind in ('REGULAR', 'DRON', 'LANZAS')),
  action_type text not null default 'UPSERT',
  actor_id text null,
  occurred_at timestamptz not null default now()
);

create index if not exists field_fumigation_week_block_plan_log_idx
  on public.field_fumigation_week_block_plan_log (iso_week_id, cycle_key, occurred_at desc);
