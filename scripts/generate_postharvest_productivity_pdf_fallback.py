import json
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def fmt(value, digits=2):
    try:
        number = float(value)
    except Exception:
        return "-"
    return f"{number:,.{digits}f}"


def pct(value, digits=2):
    try:
        number = float(value)
    except Exception:
        return "-"
    return f"{number:.{digits}f}%"


def build_table(data, widths=None, font_size=8):
    table = Table(data, colWidths=widths, repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#305496")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), font_size),
                ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F5F7FA")]),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#D0D7DE")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    return table


def main():
    if len(sys.argv) < 3:
        raise SystemExit("Usage: generate_postharvest_productivity_pdf_fallback.py <input.json> <output.pdf>")

    payload = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    output = Path(sys.argv[2])

    styles = getSampleStyleSheet()
    title = ParagraphStyle("title", parent=styles["Heading1"], fontSize=22, leading=26, textColor=colors.HexColor("#1F3864"))
    subtitle = ParagraphStyle("subtitle", parent=styles["BodyText"], fontSize=10, leading=13, textColor=colors.HexColor("#4B5563"))
    h2 = ParagraphStyle("h2", parent=styles["Heading2"], fontSize=13, leading=16, textColor=colors.HexColor("#2E75B6"))
    body = ParagraphStyle("body", parent=styles["BodyText"], fontSize=9.5, leading=12)
    small = ParagraphStyle("small", parent=styles["BodyText"], fontSize=8.2, leading=10, textColor=colors.HexColor("#555555"))

    doc = SimpleDocTemplate(
        str(output),
        pagesize=landscape(A4),
        leftMargin=1.4 * cm,
        rightMargin=1.4 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )
    story = []

    story.append(Paragraph("Reporte gerencial de productividad de postcosecha", title))
    story.append(
        Paragraph(
            f"Filtros activos: fecha desde {payload['filters'].get('dateFrom') or '2025-04-29'} hasta {payload['filters'].get('dateTo') or 'hoy'} · area {payload['filters'].get('area') or 'all'} · camino {payload['filters'].get('pathPost') or 'all'} · destino {payload['filters'].get('finalDestination') or 'all'} · variedad {payload['filters'].get('variety') or 'all'}",
            subtitle,
        )
    )
    story.append(Spacer(1, 0.35 * cm))

    story.append(Paragraph("Resumen ejecutivo", h2))
    summary_table = build_table(
        [
            ["Metrica", "Valor"],
            ["Horas totales postcosecha (effective)", f"{fmt(payload['summary']['totalHours'], 2)} h"],
            ["Cajas 10kg procesadas", fmt(payload["summary"]["totalBoxes10"], 2)],
            ["Kg procesados", fmt(payload["summary"]["totalWeightKg"], 2)],
            ["KPI macro postcosecha total", f"{fmt(payload['summary']['weightedHoursPerBox'], 4)} h/caja"],
        ],
        widths=[13 * cm, 5.2 * cm],
        font_size=9,
    )
    story.append(summary_table)
    story.append(Spacer(1, 0.35 * cm))

    if payload.get("executiveSummary"):
        for item in payload["executiveSummary"]:
            story.append(Paragraph(f"• {item}", body))
        story.append(Spacer(1, 0.25 * cm))

    story.append(Paragraph("Comparacion por area", h2))
    area_rows = [["Area", "Horas", "% Part.", "H/Caja"]]
    for row in payload["areaSummary"]:
        area_rows.append(
            [
                row["label"],
                f"{fmt(row['hours'], 2)} h",
                pct(row["sharePct"], 2),
                fmt(row["hpb"], 4),
            ]
        )
    story.append(build_table(area_rows, widths=[3.5 * cm, 5 * cm, 4 * cm, 4 * cm], font_size=8.5))
    story.append(Spacer(1, 0.35 * cm))

    story.append(Paragraph("Tendencia semanal reciente", h2))
    for chart_path in payload.get("chartPaths", []):
        image_path = Path(chart_path)
        if image_path.exists():
            story.append(Image(str(image_path), width=24 * cm, height=13.2 * cm))
            story.append(Spacer(1, 0.25 * cm))

    weekly_rows = [["Semana", "Horas total", "Cajas 10kg", "H/Caja CLS", "H/Caja SB", "H/Caja EMP", "H/Caja total"]]
    for row in payload["weeklyPoints"]:
        weekly_rows.append(
            [
                row["weekLabel"],
                fmt(row["totalHours"], 2),
                fmt(row["boxes10"], 2),
                fmt(row["hpbCls"], 4),
                fmt(row["hpbSb"], 4),
                fmt(row["hpbEmp"], 4),
                fmt(row["hpbTotal"], 4),
            ]
        )
    story.append(build_table(weekly_rows, widths=[3 * cm, 4.2 * cm, 3.8 * cm, 3 * cm, 3 * cm, 3 * cm, 3 * cm], font_size=7.8))
    story.append(PageBreak())

    story.append(Paragraph("Consolidado por camino y destino", h2))
    path_rows = [["Camino", "Destino", "Horas total", "Cajas 10kg", "% CLS", "% SB", "% EMP", "H/Caja total"]]
    for row in payload["pathDestinationSummary"]:
        path_rows.append(
            [
                row["pathPost"],
                row["finalDestination"],
                fmt(row["totalHours"], 2),
                fmt(row["boxes10"], 2),
                pct(row["shareCls"], 2),
                pct(row["shareSb"], 2),
                pct(row["shareEmp"], 2),
                fmt(row["hpbTotal"], 4),
            ]
        )
    story.append(
        build_table(
            path_rows,
            widths=[3.5 * cm, 3.5 * cm, 4.1 * cm, 3.8 * cm, 2.5 * cm, 2.5 * cm, 2.5 * cm, 3 * cm],
            font_size=7.8,
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "Fallback operativo para desarrollo local. En servidor debe priorizarse la salida canonica de pdf-canon con el mismo contenido analitico.",
            small,
        )
    )

    doc.build(story)


if __name__ == "__main__":
    main()
