import json
import sys
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle


def main() -> int:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: generate_drench_program_pdf.py <input.json> <output.pdf>")

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    payload = json.loads(input_path.read_text(encoding="utf-8"))

    output_path.parent.mkdir(parents=True, exist_ok=True)

    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=landscape(A4),
        leftMargin=12 * mm,
        rightMargin=12 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm,
    )

    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(payload["title"], styles["Title"]))
    if payload.get("subtitle"):
        story.append(Paragraph(payload["subtitle"], styles["Normal"]))
    story.append(Spacer(1, 6 * mm))

    sections = payload.get("sections") or [{
        "title": None,
        "columns": payload["columns"],
        "rows": payload["rows"],
    }]

    for index, section in enumerate(sections):
        if section.get("title"):
            story.append(Paragraph(section["title"], styles["Heading2"]))
            story.append(Spacer(1, 2 * mm))

        header = [column["label"] for column in section["columns"]]
        rows = [header]
        for row in section["rows"]:
            rows.append([str(row.get(column["key"], "")) for column in section["columns"]])

        widths = [column.get("width", 40) * mm for column in section["columns"]]
        table = Table(rows, colWidths=widths, repeatRows=1)
        table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E5E7EB")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 5),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            )
        )
        story.append(table)
        if index < len(sections) - 1:
            story.append(Spacer(1, 6 * mm))
    doc.build(story)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
