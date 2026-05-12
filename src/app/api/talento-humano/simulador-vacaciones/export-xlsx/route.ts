import { type NextRequest } from "next/server";

import { requireAuth } from "@/lib/api-auth";
import { handleApiError } from "@/lib/api-error";
import {
  getVacationSimulatorData,
  normalizeVacationFilters,
  type VacationSimulatorRow,
} from "@/lib/talento-humano-vacaciones";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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

function cellString(value: unknown, rowIndex: number, columnIndex: number): string {
  const ref = `${colName(columnIndex)}${rowIndex}`;
  return `<c r="${ref}" t="inlineStr"><is><t>${xml(value)}</t></is></c>`;
}

function cellNumber(value: number, rowIndex: number, columnIndex: number): string {
  const ref = `${colName(columnIndex)}${rowIndex}`;
  return `<c r="${ref}"><v>${Number.isFinite(value) ? value : 0}</v></c>`;
}

function formatSlash(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

const HEADERS = [
  "Colaborador",
  "Cédula",
  "Código",
  "Área",
  "Área general",
  "Cargo",
  "Clasificación",
  "Trabajadora asociada",
  "Tipo contrato",
  "Fecha ingreso",
  "Antigüedad (días)",
  "Antigüedad",
  "Días acumulados",
  "Días tomados",
  "Días disponibles",
];

function buildWorksheet(rows: VacationSimulatorRow[], corteDate: string): string {
  const headerCells = HEADERS.map((value, index) => cellString(value, 1, index)).join("");
  const headerRow = `<row r="1">${headerCells}</row>`;

  const subtitleCells = cellString(`Corte: ${formatSlash(corteDate)}`, 2, 0);
  const subtitleRow = `<row r="2">${subtitleCells}</row>`;

  const dataRows = rows.map((row, dataIndex) => {
    const excelRow = dataIndex + 4;
    const cells: string[] = [];
    cells.push(cellString(row.personName, excelRow, 0));
    cells.push(cellString(row.nationalId ?? "—", excelRow, 1));
    cells.push(cellString(row.personId, excelRow, 2));
    cells.push(cellString(row.areaName ?? row.areaId ?? "—", excelRow, 3));
    cells.push(cellString(row.areaGeneral ?? "—", excelRow, 4));
    cells.push(cellString(row.jobTitle ?? "—", excelRow, 5));
    cells.push(cellString(row.jobClassificationCode ?? "—", excelRow, 6));
    cells.push(cellString(row.associatedWorkerName ?? "—", excelRow, 7));
    cells.push(cellString(row.contractType ?? "—", excelRow, 8));
    cells.push(cellString(formatSlash(row.entryDate), excelRow, 9));
    cells.push(cellNumber(row.tenureDays, excelRow, 10));
    cells.push(cellString(row.tenureLabel ?? "—", excelRow, 11));
    cells.push(cellNumber(row.diasAcumulados, excelRow, 12));
    cells.push(cellNumber(row.diasTomados, excelRow, 13));
    cells.push(cellNumber(row.diasDisponibles, excelRow, 14));
    return `<row r="${excelRow}">${cells.join("")}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <cols>
    <col min="1" max="1" width="32" customWidth="1"/>
    <col min="2" max="2" width="14" customWidth="1"/>
    <col min="3" max="3" width="12" customWidth="1"/>
    <col min="4" max="4" width="28" customWidth="1"/>
    <col min="5" max="5" width="20" customWidth="1"/>
    <col min="6" max="6" width="22" customWidth="1"/>
    <col min="7" max="7" width="16" customWidth="1"/>
    <col min="8" max="8" width="24" customWidth="1"/>
    <col min="9" max="9" width="16" customWidth="1"/>
    <col min="10" max="10" width="14" customWidth="1"/>
    <col min="11" max="11" width="16" customWidth="1"/>
    <col min="12" max="12" width="22" customWidth="1"/>
    <col min="13" max="13" width="16" customWidth="1"/>
    <col min="14" max="14" width="14" customWidth="1"/>
    <col min="15" max="15" width="16" customWidth="1"/>
  </cols>
  <sheetData>${headerRow}${subtitleRow}${dataRows}</sheetData>
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
    <sheet name="Vacaciones" sheetId="1" r:id="rId1"/>
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
    const filters = normalizeVacationFilters({
      corteDate: sp.get("corteDate") ?? undefined,
      area: sp.get("area") ?? undefined,
      jobClassification: sp.get("jobClassification") ?? undefined,
      associatedWorker: sp.get("associatedWorker") ?? undefined,
      q: sp.get("q") ?? undefined,
    });

    const data = await getVacationSimulatorData(filters);

    const xlsx = createZip([
      ...XLSX_STATIC_FILES,
      { path: "xl/worksheets/sheet1.xml", content: buildWorksheet(data.rows, data.corteDate) },
    ]);

    const stampDate = data.corteDate.replace(/-/g, "");
    return new Response(new Uint8Array(xlsx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="simulador_vacaciones_${stampDate}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error, "No se pudo exportar el simulador de vacaciones.");
  }
}
