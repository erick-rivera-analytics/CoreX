from __future__ import annotations

import argparse
import uuid
from datetime import datetime
from pathlib import Path

import psycopg


ROOT = Path(r"C:\Users\paul.loja\AppData\Local\Temp\CoreX_bodega_validate")
ENV_PATH = ROOT / ".env.local"

PRODUCT_REF_TABLE = "public.sr_ref_product_id_core_scd2"
PRODUCT_DIM_TABLE = "public.sr_dim_product_profile_scd2"
PRODUCT_USAGE_TABLE = "public.sr_bridge_product_usage_scd2"

ACTOR_ID = "codex_assign_fumigation_family"
CHANGE_REASON = "ASSIGN_FUMIGATION_ACTIVITY_FAMILY"

FUMIGATION_ACTIVITY_IDS = [
    "FMGYP",
    "FMGYPA1",
    "FMGYPA2",
    "FMGYPM1",
    "FMGYPM2",
    "FMGYPAC2",
    "FMGYPEF",
    "03VAFIFMG",
    "03VAFIFMGL",
]


def load_env() -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
        raw = raw.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        values[key] = value
    return values


def make_record_id() -> str:
    return str(uuid.uuid4())


def make_run_id() -> str:
    return f"bodega_product_update_{datetime.now().strftime('%Y%m%d%H%M%S')}"


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    return " ".join(str(value).strip().upper().split())


def fetch_product(conn: psycopg.Connection, product_code: str):
    with conn.cursor() as cur:
        cur.execute(
            f"""
            select
              p.product_id,
              p.product_code,
              p.product_name,
              p.product_description,
              p.base_unit_id,
              p.category_id,
              p.active_component_mode,
              p.active_component_name,
              coalesce(p.is_active, true) as is_active
            from {PRODUCT_DIM_TABLE} p
            where p.is_current = true
              and p.is_valid = true
              and upper(trim(p.product_code)) = %s
            """,
            (normalize_text(product_code),),
        )
        row = cur.fetchone()
        if row is None:
            return None

        cur.execute(
            f"""
            select upper(trim(activity_id)) as activity_id
            from {PRODUCT_USAGE_TABLE}
            where is_current = true
              and is_valid = true
              and product_id = %s
            order by coalesce(branch_order, 0), upper(trim(activity_id))
            """,
            (row[0],),
        )
        activity_rows = [activity_id for (activity_id,) in cur.fetchall()]

    return {
        "product_id": row[0],
        "product_code": row[1],
        "product_name": row[2],
        "product_description": row[3],
        "base_unit_id": row[4],
        "category_id": row[5],
        "active_component_mode": row[6],
        "active_component_name": row[7],
        "is_active": bool(row[8]),
        "activity_ids": activity_rows,
    }


def update_product_assignments(conn: psycopg.Connection, product: dict[str, object], final_activities: list[str]) -> None:
    now = datetime.now()
    run_id = make_run_id()

    with conn.cursor() as cur:
        cur.execute(
            f"update {PRODUCT_REF_TABLE} set is_current = false, valid_to = %s where product_id = %s and is_current = true",
            (now, product["product_id"]),
        )
        cur.execute(
            f"update {PRODUCT_DIM_TABLE} set is_current = false, valid_to = %s where product_id = %s and is_current = true",
            (now, product["product_id"]),
        )
        cur.execute(
            f"update {PRODUCT_USAGE_TABLE} set is_current = false, valid_to = %s where product_id = %s and is_current = true",
            (now, product["product_id"]),
        )

        cur.execute(
            f"""
            insert into {PRODUCT_REF_TABLE} (
              record_id, product_id, valid_from, valid_to, is_current, is_valid, loaded_at, run_id, actor_id, change_reason
            ) values (%s, %s, %s, null, true, true, %s, %s, %s, %s)
            """,
            (make_record_id(), product["product_id"], now, now, run_id, ACTOR_ID, CHANGE_REASON),
        )

        cur.execute(
            f"""
            insert into {PRODUCT_DIM_TABLE} (
              record_id, product_id, valid_from, valid_to, is_current, product_code, product_name,
              product_description, base_unit_id, category_id, active_component_mode, active_component_name, is_active,
              is_valid, loaded_at, run_id, actor_id, change_reason
            ) values (%s, %s, %s, null, true, %s, %s, %s, %s, %s, %s, %s, %s, true, %s, %s, %s, %s)
            """,
            (
                make_record_id(),
                product["product_id"],
                now,
                product["product_code"],
                product["product_name"],
                product["product_description"],
                product["base_unit_id"],
                product["category_id"],
                product["active_component_mode"],
                product["active_component_name"],
                product["is_active"],
                now,
                run_id,
                ACTOR_ID,
                CHANGE_REASON,
            ),
        )

        for index, activity_id in enumerate(final_activities, start=1):
            cur.execute(
                f"""
                insert into {PRODUCT_USAGE_TABLE} (
                  record_id, product_id, valid_from, valid_to, is_current, branch_order, activity_id,
                  is_valid, loaded_at, run_id, actor_id, change_reason
                ) values (%s, %s, %s, null, true, %s, %s, true, %s, %s, %s, %s)
                """,
                (
                    make_record_id(),
                    product["product_id"],
                    now,
                    index,
                    activity_id,
                    now,
                    run_id,
                    ACTOR_ID,
                    CHANGE_REASON,
                ),
            )


def main() -> None:
    parser = argparse.ArgumentParser(description="Assign the full fumigation activity family to a Bodega product.")
    parser.add_argument("--product-code", required=True, help="Exact product code in Bodega, e.g. PI158")
    args = parser.parse_args()

    env = load_env()
    conn = psycopg.connect(
        host=env["DATABASE_HOST"],
        port=int(env["DATABASE_PORT"]),
        dbname=env.get("BODEGA_DATABASE_NAME", "db_storageroom"),
        user=env["DATABASE_USER"],
        password=env["DATABASE_PASSWORD"],
    )
    conn.autocommit = True

    try:
        product = fetch_product(conn, args.product_code)
        if product is None:
            raise SystemExit(f"Product code not found: {args.product_code}")

        current_activities = [normalize_text(item) for item in product["activity_ids"]]
        final_activities = sorted(set(current_activities + FUMIGATION_ACTIVITY_IDS))

        if final_activities == current_activities:
            print(f"{product['product_code']} already covered")
            return

        update_product_assignments(conn, product, final_activities)
        print(f"{product['product_code']} updated with {len(final_activities)} activities")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
