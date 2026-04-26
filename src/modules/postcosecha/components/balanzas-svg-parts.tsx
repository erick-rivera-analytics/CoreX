/**
 * Subcomponentes SVG del diagrama Balanzas (eventos, gateways, edges, notas).
 *
 * Vive aparte de `balanzas-process-svg-viewer.tsx` para mantener ambos
 * archivos por debajo del límite estructural canon (350 líneas).
 */

import {
  B,
  diamondPath,
  FLOW_STROKE_W,
  polyPath,
  STROKE_W,
  SUB,
  X,
  Y,
} from "@/modules/postcosecha/components/balanzas-svg-layout";

const C = {
  gwFill:      "var(--bal-gw-fill)",
  gwStroke:    "var(--bal-gw-stroke)",
  startFill:   "var(--bal-start-fill)",
  startStroke: "var(--bal-start-stroke)",
  endFill:     "var(--bal-end-fill)",
  endStroke:   "var(--bal-end-stroke)",
  flow:        "var(--bal-flow)",
  noteFill:    "var(--bal-note-fill)",
  noteStroke:  "var(--bal-note-stroke)",
  noteText:    "var(--bal-note-text)",
  clockFill:   "var(--bal-clock-fill)",
  clockStroke: "var(--bal-clock-stroke)",
  routeText:   "var(--bal-route-text)",
  destText:    "var(--bal-dest-text)",
};

export function Gateway({ cx, cy }: { cx: number; cy: number }) {
  return <path d={diamondPath(cx, cy, 15)} fill={C.gwFill} stroke={C.gwStroke} strokeWidth={STROKE_W} />;
}

export function ClockEvent({ cx, cy, label }: { cx: number; cy: number; label: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={B.evt.r} fill={C.clockFill} stroke={C.clockStroke} strokeWidth={STROKE_W} />
      <circle cx={cx} cy={cy} r={B.evt.r * 0.55} fill="none" stroke={C.clockStroke} strokeWidth={1} />
      <line x1={cx} y1={cy} x2={cx} y2={cy - B.evt.r * 0.4} stroke={C.clockStroke} strokeWidth={1.3} />
      <line x1={cx} y1={cy} x2={cx + B.evt.r * 0.32} y2={cy} stroke={C.clockStroke} strokeWidth={1.3} />
      <text x={cx} y={cy - B.evt.r - 7} textAnchor="middle" fontFamily="var(--font-app), Inter, sans-serif" fontSize={10.5} fontWeight={600} fill={C.routeText}>
        {label}
      </text>
    </g>
  );
}

export function NoteBox({ cx, cy, w, h, lines }: { cx: number; cy: number; w: number; h: number; lines: string[] }) {
  return (
    <g>
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={4} fill={C.noteFill} stroke={C.noteStroke} strokeWidth={1} strokeDasharray="3 2" />
      <text x={cx} y={cy - (lines.length - 1) * 5} textAnchor="middle" fontFamily="var(--font-app), Inter, sans-serif" fontSize={9.5} fill={C.noteText}>
        {lines.map((line, i) => (
          <tspan key={line} x={cx} dy={i === 0 ? 0 : 11}>{line}</tspan>
        ))}
      </text>
    </g>
  );
}

export function StaticShapes() {
  return (
    <g>
      <circle cx={X.start} cy={Y.raiz} r={B.evt.r} fill={C.startFill} stroke={C.startStroke} strokeWidth={STROKE_W} />
      <circle cx={X.end} cy={Y.raiz} r={B.evt.r} fill={C.endFill} stroke={C.endStroke} strokeWidth={STROKE_W * 1.5} />
      <Gateway cx={X.gwRaiz} cy={Y.raiz} />
      <Gateway cx={X.gwRutas} cy={(Y.preGV + Y.preDirecto) / 2} />
      <Gateway cx={X.gwRutas} cy={(Y.aperturaGV + Y.aperturaDir) / 2} />
      {[Y.preGV, Y.preDirecto, Y.aperturaGV, Y.aperturaDir].map((rowY) => (
        <g key={`gw-row-${rowY}`}>
          <Gateway cx={X.gwDest} cy={rowY} />
          <Gateway cx={X.gwCierre} cy={rowY} />
        </g>
      ))}
      <Gateway cx={X.gwGlobal} cy={Y.raiz} />
      <ClockEvent cx={X.max10} cy={Y.preGV} label="MAX 10 DÍAS" />
      <ClockEvent cx={X.hidrata} cy={Y.preGV} label="HIDRATACIÓN" />
      <ClockEvent cx={X.hidrata} cy={Y.preDirecto} label="HIDRATACIÓN" />
      <ClockEvent cx={X.b1ab} cy={Y.aperturaGV} label="MAX 10 DÍAS" />
      <ClockEvent cx={X.hidrata} cy={Y.aperturaGV} label="HIDRATACIÓN" />
      <ClockEvent cx={X.hidrata} cy={Y.aperturaDir} label="HIDRATACIÓN" />
    </g>
  );
}

export function RouteLabels() {
  return (
    <g fontFamily="var(--font-app), Inter, sans-serif" fontSize={11} fontWeight={600} fill={C.routeText} textAnchor="middle">
      <text x={X.gwRaiz - 50} y={Y.raiz - 75}><tspan x={X.gwRaiz - 50} dy="0">PRECLASIFICACIÓN</tspan><tspan x={X.gwRaiz - 50} dy="12">(SIN PELAR PATAS)</tspan><tspan x={X.gwRaiz - 50} dy="12">(CON HOJA)</tspan></text>
      <text x={X.gwRaiz - 50} y={Y.raiz + 60}><tspan x={X.gwRaiz - 50} dy="0">APERTURA</tspan><tspan x={X.gwRaiz - 50} dy="12">(PELADO PATAS)</tspan><tspan x={X.gwRaiz - 50} dy="12">(SIN HOJA)</tspan></text>
      <text x={X.gwRutas + 35} y={Y.preGV + 60}><tspan x={X.gwRutas + 35} dy="0">GV SIN PELAR</tspan><tspan x={X.gwRutas + 35} dy="12">(PATAS)</tspan></text>
      <text x={X.gwRutas + 35} y={Y.preDirecto - 30}><tspan x={X.gwRutas + 35} dy="0">DIRECTO</tspan><tspan x={X.gwRutas + 35} dy="12">(SIN PELAR PATAS)</tspan></text>
      <text x={X.gwRutas + 35} y={Y.aperturaGV + 60}><tspan x={X.gwRutas + 35} dy="0">GV PELADO</tspan><tspan x={X.gwRutas + 35} dy="12">(PELADO LAS PATAS)</tspan></text>
      <text x={X.gwRutas + 35} y={Y.aperturaDir - 30}><tspan x={X.gwRutas + 35} dy="0">APERTURAS</tspan><tspan x={X.gwRutas + 35} dy="12">(PELADO LAS PATAS)</tspan></text>
    </g>
  );
}

export function DestLabels() {
  const arc = SUB.arc - 10;
  const blc = SUB.blc - 10;
  const tnt = SUB.tnt - 10;
  return (
    <g fontFamily="var(--font-app), Inter, sans-serif" fontSize={9.5} fontWeight={700} fill={C.destText} textAnchor="middle">
      {[Y.preGV, Y.preDirecto].map((rowY) => (
        <g key={`destlbl-pre-${rowY}`}>
          <text x={X.clasif - 95} y={rowY + arc}>ARCOÍRIS</text>
          <text x={X.clasif - 95} y={rowY + blc}>BLANCO</text>
          <text x={X.clasif - 95} y={rowY + tnt}>TINTURADO</text>
        </g>
      ))}
      {[Y.aperturaGV, Y.aperturaDir].map((rowY) => (
        <g key={`destlbl-ap-${rowY}`}>
          <text x={X.clasifA - 115} y={rowY + arc}>ARCOÍRIS</text>
          <text x={X.clasifA - 115} y={rowY + blc}>BLANCO</text>
          <text x={X.clasifA - 115} y={rowY + tnt}>TINTURADO</text>
        </g>
      ))}
    </g>
  );
}

export function Notes() {
  return (
    <g>
      <NoteBox cx={X.pelado - 60} cy={Y.preGV + 95} w={150} h={40} lines={["Se utiliza esta bifurcación", "cuando se quiere guardar flor"]} />
      <NoteBox cx={X.b1ab} cy={Y.preGV + 95} w={140} h={40} lines={["AQUÍ SE ASIGNA", "GRADO AL TALLO"]} />
      <NoteBox cx={X.pelado} cy={Y.aperturaGV + 95} w={140} h={36} lines={["EN B1C SE", "ASIGNA EL GRADO"]} />
      <NoteBox cx={X.general + 65} cy={Y.preGV - 90} w={170} h={44} lines={["TODO LO QUE SEA B3 YA NO", "APLICA GRADO NI TALLO"]} />
      <NoteBox cx={X.general - 95} cy={Y.aperturaGV + 95} w={170} h={44} lines={["TODO LO QUE SEA B2A YA NO", "APLICA GRADO NI TALLO"]} />
    </g>
  );
}

function rowEdges(rowY: number, opts: { isApertura: boolean }) {
  const clasifX = opts.isApertura ? X.clasifA : X.clasif;
  const clasifW = opts.isApertura ? B.taskWide.w : 130;
  const peladoHalf = opts.isApertura ? B.task.w / 2 : 57;
  const startEdge: [number, number] = [X.pelado + peladoHalf, rowY];
  const targetEdge: [number, number] = opts.isApertura ? [X.b1ab - B.evt.r, rowY] : [X.b1ab - B.task.w / 2, rowY];
  return (
    <g>
      <path d={polyPath([startEdge, targetEdge])} />
      <path d={polyPath([opts.isApertura ? [X.b1ab + B.evt.r, rowY] : [X.b1ab + B.task.w / 2, rowY], [X.hidrata - B.evt.r, rowY]])} />
      <path d={polyPath([[X.hidrata + B.evt.r, rowY], [X.b2 - B.task.w / 2, rowY]])} />
      <path d={polyPath([[X.b2 + B.task.w / 2, rowY], [X.gwDest - B.gw.w / 2, rowY]])} />
      <path d={polyPath([[X.gwDest, rowY - B.gw.h / 2], [X.gwDest, rowY + SUB.arc], [clasifX - clasifW / 2, rowY + SUB.arc]])} />
      <path d={polyPath([[X.gwDest + B.gw.w / 2, rowY + SUB.blc], [clasifX - clasifW / 2, rowY + SUB.blc]])} />
      <path d={polyPath([[X.gwDest, rowY + B.gw.h / 2], [X.gwDest, rowY + SUB.tnt], [clasifX - clasifW / 2, rowY + SUB.tnt]])} />
      {[SUB.arc, SUB.blc, SUB.tnt].map((dy) => (
        <path key={`cl-end-${dy}`} d={polyPath([[clasifX + clasifW / 2, rowY + dy], [X.b3b2a - 40, rowY + dy]])} />
      ))}
      <path d={polyPath([[X.b3b2a + 40, rowY + SUB.arc], [X.gwCierre, rowY + SUB.arc], [X.gwCierre, rowY - B.gw.h / 2]])} />
      <path d={polyPath([[X.b3b2a + 40, rowY + SUB.blc], [X.gwCierre - B.gw.w / 2, rowY]])} />
      <path d={polyPath([[X.b3b2a + 40, rowY + SUB.tnt], [X.gwCierre, rowY + SUB.tnt], [X.gwCierre, rowY + B.gw.h / 2]])} />
      <path d={polyPath([[X.gwCierre + B.gw.w / 2, rowY], [X.general - B.taskGen.w / 2, rowY]])} />
    </g>
  );
}

export function Edges() {
  const preB1Y = (Y.preGV + Y.preDirecto) / 2;
  const apB1Y = (Y.aperturaGV + Y.aperturaDir) / 2;
  return (
    <g stroke={C.flow} strokeWidth={FLOW_STROKE_W} fill="none" markerEnd="url(#bal-arrow)">
      <path d={polyPath([[X.start + B.evt.r, Y.raiz], [X.gwRaiz - B.gw.w / 2, Y.raiz]])} />
      <path d={polyPath([[X.gwRaiz, Y.raiz - B.gw.h / 2], [X.gwRaiz, preB1Y], [X.b1 - B.task.w / 2, preB1Y]])} />
      <path d={polyPath([[X.gwRaiz, Y.raiz + B.gw.h / 2], [X.gwRaiz, apB1Y], [X.b1 - B.task.w / 2, apB1Y]])} />
      <path d={polyPath([[X.b1 + B.task.w / 2, preB1Y], [X.gwRutas - B.gw.w / 2, preB1Y]])} />
      <path d={polyPath([[X.b1 + B.task.w / 2, apB1Y], [X.gwRutas - B.gw.w / 2, apB1Y]])} />
      <path d={polyPath([[X.gwRutas, preB1Y - B.gw.h / 2], [X.gwRutas, Y.preGV], [X.max10 - B.evt.r, Y.preGV]])} />
      <path d={polyPath([[X.gwRutas, preB1Y + B.gw.h / 2], [X.gwRutas, Y.preDirecto], [X.pelado - 57, Y.preDirecto]])} />
      <path d={polyPath([[X.max10 + B.evt.r, Y.preGV], [X.pelado - 57, Y.preGV]])} />
      <path d={polyPath([[X.gwRutas, apB1Y - B.gw.h / 2], [X.gwRutas, Y.aperturaGV], [X.pelado - B.task.w / 2, Y.aperturaGV]])} />
      <path d={polyPath([[X.gwRutas, apB1Y + B.gw.h / 2], [X.gwRutas, Y.aperturaDir], [X.pelado - B.task.w / 2, Y.aperturaDir]])} />
      {rowEdges(Y.preGV, { isApertura: false })}
      {rowEdges(Y.preDirecto, { isApertura: false })}
      {rowEdges(Y.aperturaGV, { isApertura: true })}
      {rowEdges(Y.aperturaDir, { isApertura: true })}
      <path d={polyPath([[X.general + B.taskGen.w / 2, Y.preGV], [X.gwGlobal, Y.preGV], [X.gwGlobal, Y.raiz - B.gw.h / 2]])} />
      <path d={polyPath([[X.general + B.taskGen.w / 2, Y.preDirecto], [X.gwGlobal, Y.preDirecto], [X.gwGlobal - B.gw.w / 2, Y.raiz]])} />
      <path d={polyPath([[X.general + B.taskGen.w / 2, Y.aperturaGV], [X.gwGlobal, Y.aperturaGV], [X.gwGlobal - B.gw.w / 2, Y.raiz]])} />
      <path d={polyPath([[X.general + B.taskGen.w / 2, Y.aperturaDir], [X.gwGlobal, Y.aperturaDir], [X.gwGlobal, Y.raiz + B.gw.h / 2]])} />
      <path d={polyPath([[X.gwGlobal + B.gw.w / 2, Y.raiz], [X.end - B.evt.r, Y.raiz]])} />
    </g>
  );
}
