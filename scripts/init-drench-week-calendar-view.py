from __future__ import annotations

import os
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env.local"


def load_env_file(path: Path) -> None:
    if not path.exists():
        return

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_env_file(ENV_PATH)

VIEW_SQL = """
create schema if not exists slv;

drop view if exists slv.camp_v_drench_week_calendar_cur;

create view slv.camp_v_drench_week_calendar_cur as
with iso_weeks as (
  select
    iso_week_id,
    min(calendar_date) as week_start_date,
    max(calendar_date) as week_end_date,
    max(calendar_date) filter (where iso_day_of_week = 4) as anchor_date
  from slv.common_dim_calendar_date_scd0
  group by iso_week_id
),
current_cycles as (
  select
    cp.cycle_key,
    cp.block_id,
    cp.parent_block,
    cp.area_id,
    cp.variety,
    cp.sp_type,
    cp.sp_date,
    cp.harvest_end_date,
    cp.greenhouse,
    cp.bed_area,
    case
      when upper(coalesce(cp.sp_type, '')) like 'S%' then 'S'
      when upper(coalesce(cp.sp_type, '')) like 'P%' then 'P'
      else null
    end as cycle_type_code
  from slv.camp_dim_cycle_profile_scd2 cp
  where cp.is_current = true
    and coalesce(cp.is_valid, true) = true
    and cp.sp_date is not null
),
projected as (
  select
    cc.cycle_key,
    cc.block_id,
    cc.parent_block,
    cc.area_id,
    cc.variety,
    cc.sp_type,
    cc.sp_date,
    cc.harvest_end_date,
    cc.greenhouse,
    cc.bed_area,
    cc.cycle_type_code,
    iw.iso_week_id,
    iw.week_start_date,
    iw.week_end_date,
    iw.anchor_date,
    (iw.anchor_date - 7) as publication_date,
    (iw.anchor_date - cc.sp_date) as days_since_sp,
    floor(((iw.anchor_date - cc.sp_date)::numeric) / 7) + 1 as phenological_week
  from current_cycles cc
  join iso_weeks iw
    on iw.anchor_date >= cc.sp_date
   and iw.anchor_date <= coalesce(cc.harvest_end_date, greatest(current_date, cc.sp_date) + 180)
  where cc.cycle_type_code is not null
)
select
  p.cycle_key,
  p.block_id,
  p.parent_block,
  p.area_id,
  p.variety,
  p.sp_type,
  p.sp_date,
  p.harvest_end_date,
  p.greenhouse,
  (p.bed_area / 30.0)::numeric(18,6) as bed_count,
  p.cycle_type_code,
  case
    when p.cycle_type_code = 'S' then 'Siembra'
    when p.cycle_type_code = 'P' then 'Poda'
    else p.cycle_type_code
  end as cycle_type_label,
  concat_ws(' ', p.cycle_type_code, p.variety) as drench_group_key,
  concat_ws(
    ' / ',
    p.variety,
    case
      when p.cycle_type_code = 'S' then 'Siembra'
      when p.cycle_type_code = 'P' then 'Poda'
      else p.cycle_type_code
    end
  ) as drench_group_label,
  p.iso_week_id,
  pubcal.iso_week_id as publication_iso_week_id,
  p.week_start_date,
  p.week_end_date,
  p.anchor_date,
  p.publication_date,
  p.days_since_sp,
  p.phenological_week::integer as phenological_week,
  (p.sp_date + (((p.phenological_week::integer - 1) * 7)))::date as phenological_start_date,
  (p.sp_date + (((p.phenological_week::integer) * 7) - 1))::date as phenological_end_date
from projected p
left join slv.common_dim_calendar_date_scd0 pubcal
  on pubcal.calendar_date = p.publication_date
where p.phenological_week >= 1
order by p.iso_week_id, p.cycle_type_code, p.variety, p.block_id, p.cycle_key;
"""


def main() -> None:
    conn = psycopg.connect(
        host=os.environ.get("DATABASE_HOST", "10.0.2.70"),
        port=int(os.environ.get("DATABASE_PORT", "5432")),
        dbname=os.environ.get("DATABASE_NAME", "datalakehouse"),
        user=os.environ.get("DATABASE_USER", "db_admin"),
        password=os.environ.get("DATABASE_PASSWORD", ""),
        sslmode="require" if os.environ.get("DATABASE_SSL") == "true" else "disable",
    )

    try:
      with conn, conn.cursor() as cur:
          # Pending note:
          # Future phase must anchor this projection to the vegetative base that already
          # carries the operational calendar. For now, the weekly projection is resolved
          # only from ISO calendar + sp_date using the Thursday of the target week.
          cur.execute(VIEW_SQL)
    finally:
      conn.close()


if __name__ == "__main__":
    main()
