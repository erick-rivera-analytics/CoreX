create extension if not exists pgcrypto;

create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.usr_dim_profile_pref_scd0 (
  auth_user_id text primary key,
  display_name text not null,
  avatar_url text,
  bio_text text,
  locale_code text not null default 'es-EC',
  timezone_name text not null default 'America/Guayaquil',
  theme_code text not null default 'system',
  default_route text not null default '/dashboard/mi-trabajo',
  default_calendar_view_code text not null default 'month',
  default_task_view_code text not null default 'today',
  week_start_iso integer not null default 1 check (week_start_iso between 1 and 7),
  notification_prefs_jsonb jsonb not null default jsonb_build_object(
    'in_app_task_assigned', true,
    'in_app_task_due', true,
    'in_app_reminder', true,
    'email_task_assigned', false,
    'email_task_due', false,
    'email_reminder', false
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wrk_dim_space_core_scd0 (
  space_id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  space_name text not null,
  space_slug text not null,
  color_token text not null default 'slate',
  sort_order integer not null default 0,
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (auth_user_id, space_slug)
);

create unique index if not exists uq_wrk_space_default_active
  on public.wrk_dim_space_core_scd0 (auth_user_id)
  where is_default = true and archived_at is null;

create table if not exists public.wrk_fact_task_core_cur (
  task_id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  space_id uuid not null references public.wrk_dim_space_core_scd0(space_id),
  title_text text not null,
  description_text text,
  status_code text not null default 'todo' check (status_code in ('todo', 'in_progress', 'blocked', 'done')),
  priority_code text not null default 'normal' check (priority_code in ('low', 'normal', 'high', 'urgent')),
  start_at timestamptz,
  due_at timestamptz,
  completed_at timestamptz,
  is_starred boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ix_wrk_task_user_status on public.wrk_fact_task_core_cur(auth_user_id, status_code);
create index if not exists ix_wrk_task_user_due on public.wrk_fact_task_core_cur(auth_user_id, due_at);

create table if not exists public.wrk_fact_event_core_cur (
  event_id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  space_id uuid not null references public.wrk_dim_space_core_scd0(space_id),
  linked_task_id uuid references public.wrk_fact_task_core_cur(task_id),
  title_text text not null,
  description_text text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  is_busy boolean not null default true,
  location_text text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at >= start_at)
);

create index if not exists ix_wrk_event_user_start on public.wrk_fact_event_core_cur(auth_user_id, start_at);

create table if not exists public.wrk_fact_reminder_core_cur (
  reminder_id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  linked_task_id uuid references public.wrk_fact_task_core_cur(task_id),
  linked_event_id uuid references public.wrk_fact_event_core_cur(event_id),
  remind_at timestamptz not null,
  channel_code text not null default 'in_app' check (channel_code in ('in_app', 'email')),
  status_code text not null default 'pending' check (status_code in ('pending', 'sent', 'read', 'canceled')),
  note_text text,
  sent_at timestamptz,
  read_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(linked_task_id, linked_event_id) = 1)
);

create index if not exists ix_wrk_reminder_user_at on public.wrk_fact_reminder_core_cur(auth_user_id, remind_at);

create table if not exists public.wrk_fact_activity_log_cur (
  activity_id uuid primary key default gen_random_uuid(),
  auth_user_id text not null,
  entity_type text not null,
  entity_id text not null,
  action_code text not null,
  payload_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace view public.wrk_v_calendar_item_cur as
select
  'event'::text as item_kind,
  event.event_id::text as item_id,
  event.auth_user_id,
  event.space_id,
  space.space_name,
  space.color_token,
  event.title_text,
  event.description_text,
  null::text as status_code,
  null::text as priority_code,
  event.start_at,
  event.end_at,
  event.all_day,
  event.is_busy,
  event.location_text,
  event.linked_task_id,
  event.start_at as source_at
from public.wrk_fact_event_core_cur event
join public.wrk_dim_space_core_scd0 space on space.space_id = event.space_id
where event.archived_at is null
  and space.archived_at is null

union all

select
  'task'::text as item_kind,
  task.task_id::text as item_id,
  task.auth_user_id,
  task.space_id,
  space.space_name,
  space.color_token,
  task.title_text,
  task.description_text,
  task.status_code,
  task.priority_code,
  coalesce(task.start_at, task.due_at) as start_at,
  task.due_at as end_at,
  false as all_day,
  false as is_busy,
  null::text as location_text,
  task.task_id as linked_task_id,
  coalesce(task.start_at, task.due_at) as source_at
from public.wrk_fact_task_core_cur task
join public.wrk_dim_space_core_scd0 space on space.space_id = task.space_id
where task.archived_at is null
  and space.archived_at is null
  and coalesce(task.start_at, task.due_at) is not null;

drop trigger if exists trg_usr_profile_pref_set_updated_at on public.usr_dim_profile_pref_scd0;
create trigger trg_usr_profile_pref_set_updated_at
before update on public.usr_dim_profile_pref_scd0
for each row
execute function public.fn_set_updated_at();

drop trigger if exists trg_wrk_space_set_updated_at on public.wrk_dim_space_core_scd0;
create trigger trg_wrk_space_set_updated_at
before update on public.wrk_dim_space_core_scd0
for each row
execute function public.fn_set_updated_at();

drop trigger if exists trg_wrk_task_set_updated_at on public.wrk_fact_task_core_cur;
create trigger trg_wrk_task_set_updated_at
before update on public.wrk_fact_task_core_cur
for each row
execute function public.fn_set_updated_at();

drop trigger if exists trg_wrk_event_set_updated_at on public.wrk_fact_event_core_cur;
create trigger trg_wrk_event_set_updated_at
before update on public.wrk_fact_event_core_cur
for each row
execute function public.fn_set_updated_at();

drop trigger if exists trg_wrk_reminder_set_updated_at on public.wrk_fact_reminder_core_cur;
create trigger trg_wrk_reminder_set_updated_at
before update on public.wrk_fact_reminder_core_cur
for each row
execute function public.fn_set_updated_at();
