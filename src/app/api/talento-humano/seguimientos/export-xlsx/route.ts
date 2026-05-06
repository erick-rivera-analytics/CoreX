import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import { loadScheduledFollowups } from "@/lib/talento-humano-seguimientos-schedule";
import { followupFiltersSchema } from "@/lib/talento-humano-seguimientos-schemas";
import type { EmployeeFollowupFilters } from "@/modules/talento-humano/seguimientos/server/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FollowupExportSortKey = "areaId" | "personName" | "followUpDate" | "derivedRoute" | "status";
type FollowupExportSortRule = { key: FollowupExportSortKey; direction: "asc" | "desc" };

const SORT_KEYS = new Set<FollowupExportSortKey>(["areaId", "personName", "followUpDate", "derivedRoute", "status"]);
const collator = new Intl.Collator("es-EC", { numeric: true, sensitivity: "base" });

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  registered: "Realizado",
};

const ROUTE_LABEL: Record<string, string> = {
  AGR: "AGR",
  ADM: "ADM",
};

function titleCaseName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("es-EC")
    .replace(/\p{L}+/gu, (word) => word.charAt(0).toLocaleUpperCase("es-EC") + word.slice(1));
}

function formatFollowupDate(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : dateStr;
}

function parseSortRules(searchParams: URLSearchParams): FollowupExportSortRule[] {
  return searchParams
    .getAll("sort")
    .flatMap((raw) => raw.split(","))
    .map((raw) => raw.trim())
    .filter(Boolean)
    .flatMap((raw) => {
      const [key, rawDirection] = raw.split(":").map((part) => part.trim());
      const direction = rawDirection === "desc" ? "desc" : "asc";
      return SORT_KEYS.has(key as FollowupExportSortKey)
        ? [{ key: key as FollowupExportSortKey, direction }]
        : [];
    });
}

function sortRows(
  rows: Awaited<ReturnType<typeof loadScheduledFollowups>>,
  sortRules: FollowupExportSortRule[],
): Awaited<ReturnType<typeof loadScheduledFollowups>> {
  if (sortRules.length === 0) return rows;
  return [...rows].sort((left, right) => {
    for (const rule of sortRules) {
      const direction = rule.direction === "asc" ? 1 : -1;
      const leftValue = rule.key === "personName" ? titleCaseName(left.personName) : String(left[rule.key] ?? "");
      const rightValue = rule.key === "personName" ? titleCaseName(right.personName) : String(right[rule.key] ?? "");
      const result = collator.compare(leftValue, rightValue);
      if (result !== 0) return result * direction;
    }
    return collator.compare(left.personName, right.personName);
  });
}

function xml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function colName(index: number): string {
  let current = index + 1;
  let name = "";
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function sheetCell(value: unknown, rowIndex: number, columnIndex: number): string {
  const ref = `${colName(columnIndex)}${rowIndex}`;
  return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

function buildWorksheet(rows: Awaited<ReturnType<typeof loadScheduledFollowups>>): string {
  const headers = ["Nombre", "Cod. Area", "Fecha", "Clasif.", "Estado"];
  const data = rows.map((row) => [
    titleCaseName(row.personName),
    row.areaId ?? "-",
    formatFollowupDate(row.followUpDate),
    ROUTE_LABEL[row.derivedRoute] ?? row.derivedRoute,
    STATUS_LABEL[row.status] ?? row.status,
  ]);

  const sheetRows = [headers, ...data].map((row, rowIndex) => {
    const excelRow = rowIndex + 1;
    return `<row r="${excelRow}">${row.map((value, columnIndex) => sheetCell(value, excelRow, columnIndex)).join("")}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="34" customWidth="1"/>
    <col min="2" max="2" width="16" customWidth="1"/>
    <col min="3" max="3" width="14" customWidth="1"/>
    <col min="4" max="4" width="12" customWidth="1"/>
    <col min="5" max="5" width="14" customWidth="1"/>
  </cols>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

const XLSX_STATIC_FILES: Array<{ path: string; content: string }> = [
  {
    path: "[Content_Types].xml",
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`,
  },
  {
    path: "_rels/.rels",
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
  },
  {
    path: "xl/workbook.xml",
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Agenda" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
  },
  {
    path: "xl/_rels/workbook.xml.rels",
    content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`,
  },
];

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(files: Array<{ path: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.path, "utf8");
    const content = Buffer.from(file.content, "utf8");
    const crc = crc32(content);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + content.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

export async function GET(request: NextRequest) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  try {
    const sp = request.nextUrl.searchParams;
    const asOfDate = sp.get("asOfDate")?.trim() || new Date().toISOString().slice(0, 10);

    const parsed = followupFiltersSchema.safeParse({
      asOfDate,
      personSearch: sp.get("q")?.trim() || undefined,
      associatedWorker: sp.get("associatedWorker")?.trim() || undefined,
      area: sp.get("area")?.trim() || undefined,
      route: sp.get("route")?.trim() || undefined,
      status: sp.get("status")?.trim() || undefined,
      year: sp.get("year")?.trim() || undefined,
      month: sp.get("month")?.trim() || undefined,
      dateFrom: sp.get("dateFrom")?.trim() || undefined,
      dateTo: sp.get("dateTo")?.trim() || undefined,
    });

    if (!parsed.success) {
      return Response.json({ message: "Filtros invalidos." }, { status: 400 });
    }

    const rows = sortRows(
      await loadScheduledFollowups(parsed.data as EmployeeFollowupFilters),
      parseSortRules(sp),
    );

    const xlsx = createZip([
      ...XLSX_STATIC_FILES,
      { path: "xl/worksheets/sheet1.xml", content: buildWorksheet(rows) },
    ]);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;

    return new Response(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="agenda_seguimientos_${stamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo exportar la agenda XLSX.");
  }
}
