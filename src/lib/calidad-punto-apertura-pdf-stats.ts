import type { PuntoAperturaDashboardData, PuntoAperturaRecord } from "@/lib/calidad-punto-apertura";

export function tex(value: unknown): string {
  return String(value ?? "")
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/#/g, "\\#")
    .replace(/\$/g, "\\$")
    .replace(/%/g, "\\%")
    .replace(/&/g, "\\&")
    .replace(/_/g, "\\_")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/~/g, "\\textasciitilde{}");
}

export function pct(value: number) {
  return `${value.toFixed(2)}\\%`;
}

export function buildDominantSummary(records: PuntoAperturaRecord[]) {
  const order = ["Boton", "1 a 3", "4 a 9", "10 a 20", "Mas de 20"] as const;
  const counts = new Map<string, number>();

  for (const record of records) {
    counts.set(record.dominanteClase, (counts.get(record.dominanteClase) ?? 0) + 1);
  }

  return order.map((label) => ({
    label,
    count: counts.get(label) ?? 0,
    pct: records.length ? ((counts.get(label) ?? 0) / records.length) * 100 : 0,
  }));
}

function average(values: number[]) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStdDev(values: number[]) {
  if (values.length < 2) return 0;
  const mean = average(values);
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function quantile(values: number[], q: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function dominantSortOrder(label: string) {
  return ["Boton", "1 a 3", "4 a 9", "10 a 20", "Mas de 20"].indexOf(label);
}

export function buildClassShareSummary(records: PuntoAperturaRecord[]) {
  const grouped = new Map<
    string,
    {
      shares: number[];
      tallos: number[];
    }
  >();

  for (const record of records) {
    const bucket = grouped.get(record.dominanteClase) ?? { shares: [], tallos: [] };
    bucket.shares.push(record.dominantePct);
    if (record.tallosMalla !== null) bucket.tallos.push(record.tallosMalla);
    grouped.set(record.dominanteClase, bucket);
  }

  return Array.from(grouped.entries())
    .map(([label, bucket]) => ({
      label,
      records: bucket.shares.length,
      meanPct: average(bucket.shares),
      sdPct: sampleStdDev(bucket.shares),
      medianPct: quantile(bucket.shares, 0.5),
      p25Pct: quantile(bucket.shares, 0.25),
      p75Pct: quantile(bucket.shares, 0.75),
      meanTallos: average(bucket.tallos),
    }))
    .sort((a, b) => dominantSortOrder(a.label) - dominantSortOrder(b.label));
}

export function buildMonthlySummary(records: PuntoAperturaRecord[]) {
  const grouped = new Map<string, number[]>();

  for (const record of records) {
    const monthKey = record.fecha.slice(0, 7);
    const bucket = grouped.get(monthKey) ?? [];
    bucket.push(record.dominantePct);
    grouped.set(monthKey, bucket);
  }

  return Array.from(grouped.entries())
    .map(([month, shares]) => ({
      month,
      meanPct: average(shares),
      sdPct: sampleStdDev(shares),
      records: shares.length,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function buildExecutiveSummary(
  data: PuntoAperturaDashboardData,
  classSummary: ReturnType<typeof buildClassShareSummary>,
) {
  const topClass = classSummary[0]?.label ?? data.summary.dominantClass;
  const topClassSummary =
    classSummary.find((item) => item.label === data.summary.dominantClass) ?? classSummary[0];
  const mostMixed = [...classSummary].sort((a, b) => b.sdPct - a.sdPct)[0];
  const ties = data.records.filter((record) => {
    const values = Object.values(record.apertura);
    const max = Math.max(...values);
    return values.filter((value) => value === max).length > 1;
  }).length;

  return [
    "Filtro aplicado: para cada ciclo se considera el tramo desde la primera fecha con senal real de apertura y se conservan los registros posteriores del mismo ciclo.",
    `Base analizada: ${data.summary.totalRecords} registros visibles, ${data.summary.totalCycles} ciclos y clase dominante general ${topClass}.`,
    topClassSummary
      ? `La clase dominante general ${topClassSummary.label} concentra una participacion media de ${topClassSummary.meanPct.toFixed(2)}% con desviacion estandar de ${topClassSummary.sdPct.toFixed(2)}%.`
      : `La clase dominante general del periodo fue ${data.summary.dominantClass}.`,
    mostMixed
      ? `La clase con mayor mezcla relativa es ${mostMixed.label}, con mediana de ${mostMixed.medianPct.toFixed(2)}% y rango intercuartilico entre ${mostMixed.p25Pct.toFixed(2)}% y ${mostMixed.p75Pct.toFixed(2)}%.`
      : "No se detectaron suficientes registros para medir dispersion por clase dominante.",
    `Empates entre clases dominantes: ${ties} registros (${data.summary.totalRecords > 0 ? ((ties / data.summary.totalRecords) * 100).toFixed(2) : "0.00"}% del total visible).`,
  ];
}

export function buildMethodologyCritique(
  data: PuntoAperturaDashboardData,
  classSummary: ReturnType<typeof buildClassShareSummary>,
) {
  const avgDominantShare = average(data.records.map((record) => record.dominantePct));
  const oneToThree = classSummary.find((item) => item.label === "1 a 3");
  const tenToTwenty = classSummary.find((item) => item.label === "10 a 20");

  return [
    "El enfoque de participacion dominante es adecuado porque compara mallas con distinto numero de tallos en una misma escala porcentual.",
    `A nivel global, el dominante representa en promedio ${avgDominantShare.toFixed(2)}% de cada malla visible.`,
    tenToTwenty && oneToThree
      ? `La diferencia entre clases es tangible: cuando domina 10 a 20 la media alcanza ${tenToTwenty.meanPct.toFixed(2)}%, mientras que en 1 a 3 baja a ${oneToThree.meanPct.toFixed(2)}%.`
      : "La dispersion por clase dominante debe seguirse con bandas especificas por categoria, no con una sola meta general.",
    "Para seguimiento gerencial conviene mantener media, mediana y rango intercuartilico, porque la acumulacion de registros en 100% sesga la lectura de distribuciones.",
    "Siguiente paso sugerido: fijar bandas objetivo por clase dominante y luego medir desalineacion por arriba y por abajo del rango esperado.",
  ];
}
