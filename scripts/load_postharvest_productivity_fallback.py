from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd


DEFAULT_ROOT = Path(r"C:\Users\paul.loja\PYPROYECTOS\Poscosecha\analisis_horas\poscosecha_capacity")


def load_area_frame(root: Path, area_id: str) -> pd.DataFrame:
    path = root / f"horas_caja_{area_id.lower()}_agregado.parquet"
    frame = pd.read_parquet(path).copy()
    frame["area_id"] = area_id

    if "horas_upstream" not in frame.columns:
        frame["horas_upstream"] = 0.0
    if "horas_downstream" not in frame.columns:
        frame["horas_downstream"] = frame["horas_asignadas"]
    if "hours_per_box_upstream" not in frame.columns:
        frame["hours_per_box_upstream"] = 0.0
    if "hours_per_box_downstream" not in frame.columns:
        frame["hours_per_box_downstream"] = frame["hours_per_box"]

    frame["effective_hours_specific"] = 0.0
    frame["effective_hours_specific_period"] = 0.0
    frame["effective_hours_fallback_macro"] = 0.0
    frame["effective_hours_fallback_day"] = 0.0

    frame["fecha_post"] = pd.to_datetime(frame["fecha_post"]).dt.strftime("%Y-%m-%d")
    return frame[
        [
            "fecha_post",
            "camino_post",
            "destino_lote",
            "area_id",
            "peso_kg_total",
            "cajas10",
            "horas_asignadas",
            "horas_upstream",
            "horas_downstream",
            "effective_hours_specific",
            "effective_hours_specific_period",
            "effective_hours_fallback_macro",
            "effective_hours_fallback_day",
            "hours_per_box",
            "hours_per_box_upstream",
            "hours_per_box_downstream",
        ]
    ]


def normalize_multi(value: str) -> list[str]:
    cleaned = (value or "").strip()
    if not cleaned or cleaned == "all":
        return []
    return [part.strip() for part in cleaned.split("|") if part.strip()]


def main() -> int:
    filters = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
    root = Path(sys.argv[2]) if len(sys.argv) > 2 and sys.argv[2] else DEFAULT_ROOT

    frames = [load_area_frame(root, area) for area in ("CLS", "SB", "EMP")]
    df = pd.concat(frames, ignore_index=True)

    year = (filters.get("year") or "all").strip()
    month = (filters.get("month") or "all").strip()
    date_from = (filters.get("dateFrom") or "").strip()
    date_to = (filters.get("dateTo") or "").strip()
    areas = normalize_multi(filters.get("area") or "all")
    paths = normalize_multi(filters.get("pathPost") or "all")
    destinations = normalize_multi(filters.get("finalDestination") or "all")

    if date_from:
        df = df[df["fecha_post"] >= date_from]
    if date_to:
        df = df[df["fecha_post"] <= date_to]
    if year != "all":
        df = df[df["fecha_post"].str.slice(0, 4) == year]
    if month != "all":
        df = df[df["fecha_post"].str.slice(5, 7) == month.zfill(2)]
    if areas:
        df = df[df["area_id"].isin(areas)]
    if paths:
        df = df[df["camino_post"].isin(paths)]
    if destinations:
        df = df[df["destino_lote"].isin(destinations)]

    df = df.sort_values(
        by=["fecha_post", "camino_post", "destino_lote", "area_id"],
        ascending=[False, True, True, True],
    )

    payload = {
        "rows": df.to_dict(orient="records"),
        "options": {
            "years": sorted(df["fecha_post"].str.slice(0, 4).dropna().unique().tolist(), reverse=True),
            "months": sorted(df["fecha_post"].str.slice(5, 7).dropna().unique().tolist(), reverse=True),
            "areas": sorted(df["area_id"].dropna().unique().tolist()),
            "paths": sorted(df["camino_post"].dropna().unique().tolist()),
            "finalDestinations": sorted(df["destino_lote"].dropna().unique().tolist()),
        },
        "source": "parquet-fallback",
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
