#!/usr/bin/env node
/**
 * Genera `public/processes/postcosecha-es.bpmn` con layout limpio según la
 * imagen ideal del usuario (cierre Balanzas 2026-04-25):
 *
 * - 4 lanes apiladas: PRECLASIFICACION/GV, PRECLASIFICACION/DIRECTO,
 *   APERTURA/GV PELADO, APERTURA/APERTURA.
 * - Cada flujo de izquierda a derecha:
 *   B1 → ruta-gw → [MAX 10] → PELADO TALLO/B1C → B1AB (preclasif) → HIDRATACION
 *   → B2 → gw destinos → 3 sub-rows (ARCOIRIS / BLANCO / TINTURADO) →
 *   CLASIFICADO o PELADO TALLOS Y CLASIFICADO → B3 o B2A → cierre lane → GENERAL
 *   → cierre global → END.
 * - Sub-rows verticales para destinos: top (Arcoíris), mid (Blanco), bot (Tinturado).
 * - Notas explicativas via textAnnotation + association.
 *
 * Mantiene TODOS los IDs existentes (no rompe el mapping en `postcosecha-balanzas-core.ts`).
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public/processes/postcosecha-es.bpmn");

// ─── Layout constants ──────────────────────────────────────────────────────
const POOL_X = 40;
const POOL_Y = 40;
const POOL_W = 2200;
const POOL_H = 1560;
const LANE_X = 170;
const LANE_W = 2030;
const LANE_H = 380;

const LANES = [
  { id: "Lane_PreGV",         name: "PRECLASIFICACION / GV",       top: 40 },
  { id: "Lane_PreDirecto",    name: "PRECLASIFICACION / DIRECTO",  top: 420 },
  { id: "Lane_AperturaGV",    name: "APERTURA / GV PELADO",        top: 800 },
  { id: "Lane_AperturaDirecto", name: "APERTURA / APERTURA",       top: 1180 },
];

const TASK_W = 110;
const TASK_W_LONG = 140; // for "PELADO TALLOS Y CLASIFICADO"
const TASK_H = 60;
const EVT_W = 36;
const EVT_H = 36;
const GW_W = 50;
const GW_H = 50;

// X coordinates (centers)
const X = {
  start:      110,
  raiz:       200,
  b1:         320,
  rutas:      460,
  max10:      580,
  pelado:     700, // PELADO TALLO (preclasif) | B1C (apertura) — same column
  b1ab:       870,
  hidrata:    1020,
  b2:         1140,
  gwDest:     1280,
  clasif:     1420, // CLASIFICADO o PELADO TALLOS Y CLASIFICADO
  b3b2a:      1610,
  gwCierre:   1760, // cierre por lane (preGV+preDirecto al superior, aperturaGV+aperturaDirecto al inferior)
  general:    1880,
  gwGlobal:   2050, // cierre global final
  end:        2140,
};

// Sub-row Y offsets within a lane (top-relative)
const SUB_OFFSET = {
  arcoiris: 90,
  blanco:   200,
  tinturado: 310,
  main:     200, // flujo principal va por mid (= Blanco)
};

function laneY(laneIdx, sub = "main") {
  return LANES[laneIdx].top + SUB_OFFSET[sub];
}

function task(id, name, cx, cy, wide = false) {
  const w = wide ? TASK_W_LONG : TASK_W;
  const x = cx - w / 2;
  const y = cy - TASK_H / 2;
  return `      <bpmndi:BPMNShape id="Shape_${id}" bpmnElement="${id}"><dc:Bounds x="${x}" y="${y}" width="${w}" height="${TASK_H}" /></bpmndi:BPMNShape>`;
}

function evt(id, cx, cy) {
  const x = cx - EVT_W / 2;
  const y = cy - EVT_H / 2;
  return `      <bpmndi:BPMNShape id="Shape_${id}" bpmnElement="${id}"><dc:Bounds x="${x}" y="${y}" width="${EVT_W}" height="${EVT_H}" /></bpmndi:BPMNShape>`;
}

function gw(id, cx, cy, marker = true) {
  const x = cx - GW_W / 2;
  const y = cy - GW_H / 2;
  const m = marker ? ` isMarkerVisible="true"` : "";
  return `      <bpmndi:BPMNShape id="Shape_${id}" bpmnElement="${id}"${m}><dc:Bounds x="${x}" y="${y}" width="${GW_W}" height="${GW_H}" /></bpmndi:BPMNShape>`;
}

function flow(flowId, points) {
  const wp = points.map(([x, y]) => `        <di:waypoint x="${x}" y="${y}" />`).join("\n");
  return `      <bpmndi:BPMNEdge id="Edge_${flowId}" bpmnElement="${flowId}">\n${wp}\n      </bpmndi:BPMNEdge>`;
}

function annotation(id, cx, cy, w, h) {
  const x = cx - w / 2;
  const y = cy - h / 2;
  return `      <bpmndi:BPMNShape id="Shape_${id}" bpmnElement="${id}"><dc:Bounds x="${x}" y="${y}" width="${w}" height="${h}" /></bpmndi:BPMNShape>`;
}

// ─── Generate process elements ─────────────────────────────────────────────

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  id="Definitions_PostcosechaBalanzas"
  targetNamespace="http://corex.local/postcosecha/balanzas"
>
  <bpmn:collaboration id="Collab_Postcosecha">
    <bpmn:participant id="Participant_Postcosecha" name="Postcosecha / Balanzas" processRef="Process_PostcosechaBalanzas"/>
  </bpmn:collaboration>

  <bpmn:process id="Process_PostcosechaBalanzas" name="Postcosecha Balanzas" isExecutable="false">
    <bpmn:laneSet id="LaneSet_1">
      <bpmn:lane id="Lane_PreGV" name="PRECLASIFICACION / GV">
        <bpmn:flowNodeRef>StartEvent_Postcosecha</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Raiz</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B1_Preclasificacion</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Pre_Rutas</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Event_Max10_Pre_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_PeladoTallo_Pre_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B1AB_Pre_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Event_Hidratacion_Pre_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2_Pre_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Pre_GV_Destinos</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Clasificado_Pre_GV_Arcoiris</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Clasificado_Pre_GV_Tinturado</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Clasificado_Pre_GV_Blanco</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B3_Pre_GV_Arcoiris</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B3_Pre_GV_Tinturado</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B3_Pre_GV_Blanco</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_General_Pre_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Cierre_Superior</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_PreDirecto" name="PRECLASIFICACION / DIRECTO">
        <bpmn:flowNodeRef>Task_PeladoTallo_Pre_Directo</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B1AB_Pre_Directo</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Event_Hidratacion_Pre_Directo</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2_Pre_Directo</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Pre_Directo_Destinos</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Clasificado_Pre_Directo_Arcoiris</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Clasificado_Pre_Directo_Tinturado</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_Clasificado_Pre_Directo_Blanco</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B3_Pre_Directo_Arcoiris</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B3_Pre_Directo_Tinturado</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B3_Pre_Directo_Blanco</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_General_Pre_Directo</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Cierre_Final</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>EndEvent_Postcosecha</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_AperturaGV" name="APERTURA / GV PELADO">
        <bpmn:flowNodeRef>Task_B1_Apertura</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Apertura_Rutas</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B1C_Apertura_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Event_Max10_Apertura_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Event_Hidratacion_Apertura_GV</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2_Apertura_Max10</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Apertura_GV_Destinos</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_PeladoClasificado_Apertura_Max10_Arcoiris</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_PeladoClasificado_Apertura_Max10_Tinturado</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_PeladoClasificado_Apertura_Max10_Blanco</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2A_Apertura_Max10_Arcoiris</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2A_Apertura_Max10_Tinturado</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2A_Apertura_Max10_Blanco</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_General_Apertura_Max10</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Cierre_Inferior</bpmn:flowNodeRef>
      </bpmn:lane>
      <bpmn:lane id="Lane_AperturaDirecto" name="APERTURA / APERTURA">
        <bpmn:flowNodeRef>Task_B1C_Apertura_Directo</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Event_Hidratacion_Apertura_Directo</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2_Apertura_Directo</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Gateway_Apertura_Directo_Destinos</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_PeladoClasificado_Apertura_Directo_Arcoiris</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_PeladoClasificado_Apertura_Directo_Tinturado</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_PeladoClasificado_Apertura_Directo_Blanco</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2A_Apertura_Directo_Arcoiris</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2A_Apertura_Directo_Tinturado</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_B2A_Apertura_Directo_Blanco</bpmn:flowNodeRef>
        <bpmn:flowNodeRef>Task_General_Apertura_Directo</bpmn:flowNodeRef>
      </bpmn:lane>
    </bpmn:laneSet>

    <bpmn:startEvent id="StartEvent_Postcosecha" />
    <bpmn:exclusiveGateway id="Gateway_Raiz" />

    <bpmn:task id="Task_B1_Preclasificacion" name="B1" />
    <bpmn:exclusiveGateway id="Gateway_Pre_Rutas" />
    <bpmn:intermediateCatchEvent id="Event_Max10_Pre_GV" name="MAX 10 DIAS">
      <bpmn:timerEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:task id="Task_PeladoTallo_Pre_GV" name="PELADO TALLO" />
    <bpmn:task id="Task_B1AB_Pre_GV" name="B1AB" />
    <bpmn:intermediateCatchEvent id="Event_Hidratacion_Pre_GV" name="HIDRATACION">
      <bpmn:timerEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:task id="Task_B2_Pre_GV" name="B2" />
    <bpmn:exclusiveGateway id="Gateway_Pre_GV_Destinos" />
    <bpmn:task id="Task_Clasificado_Pre_GV_Arcoiris" name="CLASIFICADO" />
    <bpmn:task id="Task_Clasificado_Pre_GV_Tinturado" name="CLASIFICADO" />
    <bpmn:task id="Task_Clasificado_Pre_GV_Blanco" name="CLASIFICADO" />
    <bpmn:task id="Task_B3_Pre_GV_Arcoiris" name="B3" />
    <bpmn:task id="Task_B3_Pre_GV_Tinturado" name="B3" />
    <bpmn:task id="Task_B3_Pre_GV_Blanco" name="B3" />
    <bpmn:task id="Task_General_Pre_GV" name="GENERAL" />

    <bpmn:task id="Task_PeladoTallo_Pre_Directo" name="PELADO TALLO" />
    <bpmn:task id="Task_B1AB_Pre_Directo" name="B1AB" />
    <bpmn:intermediateCatchEvent id="Event_Hidratacion_Pre_Directo" name="HIDRATACION">
      <bpmn:timerEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:task id="Task_B2_Pre_Directo" name="B2" />
    <bpmn:exclusiveGateway id="Gateway_Pre_Directo_Destinos" />
    <bpmn:task id="Task_Clasificado_Pre_Directo_Arcoiris" name="CLASIFICADO" />
    <bpmn:task id="Task_Clasificado_Pre_Directo_Tinturado" name="CLASIFICADO" />
    <bpmn:task id="Task_Clasificado_Pre_Directo_Blanco" name="CLASIFICADO" />
    <bpmn:task id="Task_B3_Pre_Directo_Arcoiris" name="B3" />
    <bpmn:task id="Task_B3_Pre_Directo_Tinturado" name="B3" />
    <bpmn:task id="Task_B3_Pre_Directo_Blanco" name="B3" />
    <bpmn:task id="Task_General_Pre_Directo" name="GENERAL" />

    <bpmn:task id="Task_B1_Apertura" name="B1" />
    <bpmn:exclusiveGateway id="Gateway_Apertura_Rutas" />
    <bpmn:task id="Task_B1C_Apertura_GV" name="B1C" />
    <bpmn:intermediateCatchEvent id="Event_Max10_Apertura_GV" name="MAX 10 DIAS">
      <bpmn:timerEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:intermediateCatchEvent id="Event_Hidratacion_Apertura_GV" name="HIDRATACION">
      <bpmn:timerEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:task id="Task_B2_Apertura_Max10" name="B2" />
    <bpmn:exclusiveGateway id="Gateway_Apertura_GV_Destinos" />
    <bpmn:task id="Task_PeladoClasificado_Apertura_Max10_Arcoiris" name="PELADO TALLOS Y CLASIFICADO" />
    <bpmn:task id="Task_PeladoClasificado_Apertura_Max10_Tinturado" name="PELADO TALLOS Y CLASIFICADO" />
    <bpmn:task id="Task_PeladoClasificado_Apertura_Max10_Blanco" name="PELADO TALLOS Y CLASIFICADO" />
    <bpmn:task id="Task_B2A_Apertura_Max10_Arcoiris" name="B2A" />
    <bpmn:task id="Task_B2A_Apertura_Max10_Tinturado" name="B2A" />
    <bpmn:task id="Task_B2A_Apertura_Max10_Blanco" name="B2A" />
    <bpmn:task id="Task_General_Apertura_Max10" name="GENERAL" />

    <bpmn:task id="Task_B1C_Apertura_Directo" name="B1C" />
    <bpmn:intermediateCatchEvent id="Event_Hidratacion_Apertura_Directo" name="HIDRATACION">
      <bpmn:timerEventDefinition />
    </bpmn:intermediateCatchEvent>
    <bpmn:task id="Task_B2_Apertura_Directo" name="B2" />
    <bpmn:exclusiveGateway id="Gateway_Apertura_Directo_Destinos" />
    <bpmn:task id="Task_PeladoClasificado_Apertura_Directo_Arcoiris" name="PELADO TALLOS Y CLASIFICADO" />
    <bpmn:task id="Task_PeladoClasificado_Apertura_Directo_Tinturado" name="PELADO TALLOS Y CLASIFICADO" />
    <bpmn:task id="Task_PeladoClasificado_Apertura_Directo_Blanco" name="PELADO TALLOS Y CLASIFICADO" />
    <bpmn:task id="Task_B2A_Apertura_Directo_Arcoiris" name="B2A" />
    <bpmn:task id="Task_B2A_Apertura_Directo_Tinturado" name="B2A" />
    <bpmn:task id="Task_B2A_Apertura_Directo_Blanco" name="B2A" />
    <bpmn:task id="Task_General_Apertura_Directo" name="GENERAL" />

    <bpmn:exclusiveGateway id="Gateway_Cierre_Superior" />
    <bpmn:exclusiveGateway id="Gateway_Cierre_Inferior" />
    <bpmn:exclusiveGateway id="Gateway_Cierre_Final" />
    <bpmn:endEvent id="EndEvent_Postcosecha" />

    <bpmn:textAnnotation id="Note_Bifurcacion_Pre">
      <bpmn:text>Se utiliza esta bifurcacion cuando se quiere guardar flor</bpmn:text>
    </bpmn:textAnnotation>
    <bpmn:textAnnotation id="Note_Grado_B1AB">
      <bpmn:text>AQUI SE ASIGNA GRADO AL TALLO</bpmn:text>
    </bpmn:textAnnotation>
    <bpmn:textAnnotation id="Note_Grado_B1C">
      <bpmn:text>EN B1C SE ASIGNA EL GRADO</bpmn:text>
    </bpmn:textAnnotation>
    <bpmn:textAnnotation id="Note_B3_NoAplica">
      <bpmn:text>TODO LO QUE SEA B3 YA NO APLICA GRADO NI TALLO</bpmn:text>
    </bpmn:textAnnotation>
    <bpmn:textAnnotation id="Note_B2A_NoAplica">
      <bpmn:text>TODO LO QUE SEA B2A YA NO APLICA GRADO NI TALLO</bpmn:text>
    </bpmn:textAnnotation>

    <bpmn:association id="Assoc_Bifurcacion_Pre" sourceRef="Note_Bifurcacion_Pre" targetRef="Event_Max10_Pre_GV" />
    <bpmn:association id="Assoc_Grado_B1AB_Pre" sourceRef="Note_Grado_B1AB" targetRef="Task_B1AB_Pre_Directo" />
    <bpmn:association id="Assoc_Grado_B1C" sourceRef="Note_Grado_B1C" targetRef="Task_B1C_Apertura_GV" />
    <bpmn:association id="Assoc_B3_NoAplica" sourceRef="Note_B3_NoAplica" targetRef="Task_General_Pre_Directo" />
    <bpmn:association id="Assoc_B2A_NoAplica" sourceRef="Note_B2A_NoAplica" targetRef="Task_General_Apertura_Directo" />

    <bpmn:sequenceFlow id="Flow_Start_Raiz" sourceRef="StartEvent_Postcosecha" targetRef="Gateway_Raiz" />
    <bpmn:sequenceFlow id="Flow_Raiz_Pre" sourceRef="Gateway_Raiz" targetRef="Task_B1_Preclasificacion" />
    <bpmn:sequenceFlow id="Flow_Raiz_Apertura" sourceRef="Gateway_Raiz" targetRef="Task_B1_Apertura" />

    <bpmn:sequenceFlow id="Flow_Pre_B1_Gateway" sourceRef="Task_B1_Preclasificacion" targetRef="Gateway_Pre_Rutas" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Max10" sourceRef="Gateway_Pre_Rutas" targetRef="Event_Max10_Pre_GV" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Pelado" sourceRef="Gateway_Pre_Rutas" targetRef="Task_PeladoTallo_Pre_Directo" />
    <bpmn:sequenceFlow id="Flow_Pre_Max10_Pelado" sourceRef="Event_Max10_Pre_GV" targetRef="Task_PeladoTallo_Pre_GV" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Pelado_B1AB" sourceRef="Task_PeladoTallo_Pre_GV" targetRef="Task_B1AB_Pre_GV" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_B1AB_Hidratacion" sourceRef="Task_B1AB_Pre_GV" targetRef="Event_Hidratacion_Pre_GV" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Hidratacion_B2" sourceRef="Event_Hidratacion_Pre_GV" targetRef="Task_B2_Pre_GV" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_B2_Destinos" sourceRef="Task_B2_Pre_GV" targetRef="Gateway_Pre_GV_Destinos" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Arcoiris_Clasificado" name="ARCOIRIS" sourceRef="Gateway_Pre_GV_Destinos" targetRef="Task_Clasificado_Pre_GV_Arcoiris" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Tinturado_Clasificado" name="TINTURADO" sourceRef="Gateway_Pre_GV_Destinos" targetRef="Task_Clasificado_Pre_GV_Tinturado" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Blanco_Clasificado" name="BLANCO" sourceRef="Gateway_Pre_GV_Destinos" targetRef="Task_Clasificado_Pre_GV_Blanco" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Clasificado_B3_Arcoiris" sourceRef="Task_Clasificado_Pre_GV_Arcoiris" targetRef="Task_B3_Pre_GV_Arcoiris" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Clasificado_B3_Tinturado" sourceRef="Task_Clasificado_Pre_GV_Tinturado" targetRef="Task_B3_Pre_GV_Tinturado" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_Clasificado_B3_Blanco" sourceRef="Task_Clasificado_Pre_GV_Blanco" targetRef="Task_B3_Pre_GV_Blanco" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_B3_General_Arcoiris" sourceRef="Task_B3_Pre_GV_Arcoiris" targetRef="Task_General_Pre_GV" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_B3_General_Tinturado" sourceRef="Task_B3_Pre_GV_Tinturado" targetRef="Task_General_Pre_GV" />
    <bpmn:sequenceFlow id="Flow_Pre_GV_B3_General_Blanco" sourceRef="Task_B3_Pre_GV_Blanco" targetRef="Task_General_Pre_GV" />

    <bpmn:sequenceFlow id="Flow_Pre_Directo_Pelado_B1AB" sourceRef="Task_PeladoTallo_Pre_Directo" targetRef="Task_B1AB_Pre_Directo" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_B1AB_Hidratacion" sourceRef="Task_B1AB_Pre_Directo" targetRef="Event_Hidratacion_Pre_Directo" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Hidratacion_B2" sourceRef="Event_Hidratacion_Pre_Directo" targetRef="Task_B2_Pre_Directo" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_B2_Destinos" sourceRef="Task_B2_Pre_Directo" targetRef="Gateway_Pre_Directo_Destinos" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Arcoiris_Clasificado" name="ARCOIRIS" sourceRef="Gateway_Pre_Directo_Destinos" targetRef="Task_Clasificado_Pre_Directo_Arcoiris" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Tinturado_Clasificado" name="TINTURADO" sourceRef="Gateway_Pre_Directo_Destinos" targetRef="Task_Clasificado_Pre_Directo_Tinturado" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Blanco_Clasificado" name="BLANCO" sourceRef="Gateway_Pre_Directo_Destinos" targetRef="Task_Clasificado_Pre_Directo_Blanco" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Clasificado_B3_Arcoiris" sourceRef="Task_Clasificado_Pre_Directo_Arcoiris" targetRef="Task_B3_Pre_Directo_Arcoiris" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Clasificado_B3_Tinturado" sourceRef="Task_Clasificado_Pre_Directo_Tinturado" targetRef="Task_B3_Pre_Directo_Tinturado" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Clasificado_B3_Blanco" sourceRef="Task_Clasificado_Pre_Directo_Blanco" targetRef="Task_B3_Pre_Directo_Blanco" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_B3_General_Arcoiris" sourceRef="Task_B3_Pre_Directo_Arcoiris" targetRef="Task_General_Pre_Directo" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_B3_General_Tinturado" sourceRef="Task_B3_Pre_Directo_Tinturado" targetRef="Task_General_Pre_Directo" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_B3_General_Blanco" sourceRef="Task_B3_Pre_Directo_Blanco" targetRef="Task_General_Pre_Directo" />

    <bpmn:sequenceFlow id="Flow_Apertura_B1_Gateway" sourceRef="Task_B1_Apertura" targetRef="Gateway_Apertura_Rutas" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_B1C" sourceRef="Gateway_Apertura_Rutas" targetRef="Task_B1C_Apertura_GV" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_B1C" sourceRef="Gateway_Apertura_Rutas" targetRef="Task_B1C_Apertura_Directo" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_B1C_Max10" sourceRef="Task_B1C_Apertura_GV" targetRef="Event_Max10_Apertura_GV" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Max10_Hidratacion" sourceRef="Event_Max10_Apertura_GV" targetRef="Event_Hidratacion_Apertura_GV" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Hidratacion_B2" sourceRef="Event_Hidratacion_Apertura_GV" targetRef="Task_B2_Apertura_Max10" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_B2_Destinos" sourceRef="Task_B2_Apertura_Max10" targetRef="Gateway_Apertura_GV_Destinos" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Arcoiris_Clasificado" name="ARCOIRIS" sourceRef="Gateway_Apertura_GV_Destinos" targetRef="Task_PeladoClasificado_Apertura_Max10_Arcoiris" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Tinturado_Clasificado" name="TINTURADO" sourceRef="Gateway_Apertura_GV_Destinos" targetRef="Task_PeladoClasificado_Apertura_Max10_Tinturado" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Blanco_Clasificado" name="BLANCO" sourceRef="Gateway_Apertura_GV_Destinos" targetRef="Task_PeladoClasificado_Apertura_Max10_Blanco" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Clasificado_B2A_Arcoiris" sourceRef="Task_PeladoClasificado_Apertura_Max10_Arcoiris" targetRef="Task_B2A_Apertura_Max10_Arcoiris" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Clasificado_B2A_Tinturado" sourceRef="Task_PeladoClasificado_Apertura_Max10_Tinturado" targetRef="Task_B2A_Apertura_Max10_Tinturado" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Clasificado_B2A_Blanco" sourceRef="Task_PeladoClasificado_Apertura_Max10_Blanco" targetRef="Task_B2A_Apertura_Max10_Blanco" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_B2A_General_Arcoiris" sourceRef="Task_B2A_Apertura_Max10_Arcoiris" targetRef="Task_General_Apertura_Max10" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_B2A_General_Tinturado" sourceRef="Task_B2A_Apertura_Max10_Tinturado" targetRef="Task_General_Apertura_Max10" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_B2A_General_Blanco" sourceRef="Task_B2A_Apertura_Max10_Blanco" targetRef="Task_General_Apertura_Max10" />

    <bpmn:sequenceFlow id="Flow_Apertura_Directo_B1C_Hidratacion" sourceRef="Task_B1C_Apertura_Directo" targetRef="Event_Hidratacion_Apertura_Directo" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_Hidratacion_B2" sourceRef="Event_Hidratacion_Apertura_Directo" targetRef="Task_B2_Apertura_Directo" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_B2_Destinos" sourceRef="Task_B2_Apertura_Directo" targetRef="Gateway_Apertura_Directo_Destinos" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_Arcoiris_Clasificado" name="ARCOIRIS" sourceRef="Gateway_Apertura_Directo_Destinos" targetRef="Task_PeladoClasificado_Apertura_Directo_Arcoiris" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_Tinturado_Clasificado" name="TINTURADO" sourceRef="Gateway_Apertura_Directo_Destinos" targetRef="Task_PeladoClasificado_Apertura_Directo_Tinturado" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_Blanco_Clasificado" name="BLANCO" sourceRef="Gateway_Apertura_Directo_Destinos" targetRef="Task_PeladoClasificado_Apertura_Directo_Blanco" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_Clasificado_B2A_Arcoiris" sourceRef="Task_PeladoClasificado_Apertura_Directo_Arcoiris" targetRef="Task_B2A_Apertura_Directo_Arcoiris" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_Clasificado_B2A_Tinturado" sourceRef="Task_PeladoClasificado_Apertura_Directo_Tinturado" targetRef="Task_B2A_Apertura_Directo_Tinturado" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_Clasificado_B2A_Blanco" sourceRef="Task_PeladoClasificado_Apertura_Directo_Blanco" targetRef="Task_B2A_Apertura_Directo_Blanco" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_B2A_General_Arcoiris" sourceRef="Task_B2A_Apertura_Directo_Arcoiris" targetRef="Task_General_Apertura_Directo" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_B2A_General_Tinturado" sourceRef="Task_B2A_Apertura_Directo_Tinturado" targetRef="Task_General_Apertura_Directo" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_B2A_General_Blanco" sourceRef="Task_B2A_Apertura_Directo_Blanco" targetRef="Task_General_Apertura_Directo" />

    <bpmn:sequenceFlow id="Flow_Pre_GV_Cierre" sourceRef="Task_General_Pre_GV" targetRef="Gateway_Cierre_Superior" />
    <bpmn:sequenceFlow id="Flow_Pre_Directo_Cierre" sourceRef="Task_General_Pre_Directo" targetRef="Gateway_Cierre_Superior" />
    <bpmn:sequenceFlow id="Flow_Apertura_GV_Cierre" sourceRef="Task_General_Apertura_Max10" targetRef="Gateway_Cierre_Inferior" />
    <bpmn:sequenceFlow id="Flow_Apertura_Directo_Cierre" sourceRef="Task_General_Apertura_Directo" targetRef="Gateway_Cierre_Inferior" />
    <bpmn:sequenceFlow id="Flow_Cierre_Superior_Final" sourceRef="Gateway_Cierre_Superior" targetRef="Gateway_Cierre_Final" />
    <bpmn:sequenceFlow id="Flow_Cierre_Inferior_Final" sourceRef="Gateway_Cierre_Inferior" targetRef="Gateway_Cierre_Final" />
    <bpmn:sequenceFlow id="Flow_Final_End" sourceRef="Gateway_Cierre_Final" targetRef="EndEvent_Postcosecha" />
  </bpmn:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_PostcosechaBalanzas">
    <bpmndi:BPMNPlane id="BPMNPlane_PostcosechaBalanzas" bpmnElement="Collab_Postcosecha">

      <bpmndi:BPMNShape id="Shape_Participant_Postcosecha" bpmnElement="Participant_Postcosecha" isHorizontal="true"><dc:Bounds x="${POOL_X}" y="${POOL_Y}" width="${POOL_W}" height="${POOL_H}" /></bpmndi:BPMNShape>
${LANES.map((l) => `      <bpmndi:BPMNShape id="Shape_${l.id}" bpmnElement="${l.id}" isHorizontal="true"><dc:Bounds x="${LANE_X}" y="${l.top}" width="${LANE_W}" height="${LANE_H}" /></bpmndi:BPMNShape>`).join("\n")}

      <!-- Lane 1: PRECLASIFICACION / GV (rama inactiva en datos pero visible en flujo) -->
${evt("StartEvent_Postcosecha", X.start, laneY(0))}
${gw("Gateway_Raiz", X.raiz, laneY(0))}
${task("Task_B1_Preclasificacion", "B1", X.b1, laneY(0))}
${gw("Gateway_Pre_Rutas", X.rutas, laneY(0))}
${evt("Event_Max10_Pre_GV", X.max10, laneY(0))}
${task("Task_PeladoTallo_Pre_GV", "PELADO TALLO", X.pelado, laneY(0))}
${task("Task_B1AB_Pre_GV", "B1AB", X.b1ab, laneY(0))}
${evt("Event_Hidratacion_Pre_GV", X.hidrata, laneY(0))}
${task("Task_B2_Pre_GV", "B2", X.b2, laneY(0))}
${gw("Gateway_Pre_GV_Destinos", X.gwDest, laneY(0))}
${task("Task_Clasificado_Pre_GV_Arcoiris",  "CLASIFICADO", X.clasif, laneY(0, "arcoiris"))}
${task("Task_Clasificado_Pre_GV_Blanco",    "CLASIFICADO", X.clasif, laneY(0, "blanco"))}
${task("Task_Clasificado_Pre_GV_Tinturado", "CLASIFICADO", X.clasif, laneY(0, "tinturado"))}
${task("Task_B3_Pre_GV_Arcoiris",  "B3", X.b3b2a, laneY(0, "arcoiris"))}
${task("Task_B3_Pre_GV_Blanco",    "B3", X.b3b2a, laneY(0, "blanco"))}
${task("Task_B3_Pre_GV_Tinturado", "B3", X.b3b2a, laneY(0, "tinturado"))}
${gw("Gateway_Cierre_Superior", X.gwCierre, laneY(0))}
${task("Task_General_Pre_GV", "GENERAL", X.general, laneY(0))}

      <!-- Lane 2: PRECLASIFICACION / DIRECTO (rama activa con overlays de datos) -->
${task("Task_PeladoTallo_Pre_Directo", "PELADO TALLO", X.pelado, laneY(1))}
${task("Task_B1AB_Pre_Directo", "B1AB", X.b1ab, laneY(1))}
${evt("Event_Hidratacion_Pre_Directo", X.hidrata, laneY(1))}
${task("Task_B2_Pre_Directo", "B2", X.b2, laneY(1))}
${gw("Gateway_Pre_Directo_Destinos", X.gwDest, laneY(1))}
${task("Task_Clasificado_Pre_Directo_Arcoiris",  "CLASIFICADO", X.clasif, laneY(1, "arcoiris"))}
${task("Task_Clasificado_Pre_Directo_Blanco",    "CLASIFICADO", X.clasif, laneY(1, "blanco"))}
${task("Task_Clasificado_Pre_Directo_Tinturado", "CLASIFICADO", X.clasif, laneY(1, "tinturado"))}
${task("Task_B3_Pre_Directo_Arcoiris",  "B3", X.b3b2a, laneY(1, "arcoiris"))}
${task("Task_B3_Pre_Directo_Blanco",    "B3", X.b3b2a, laneY(1, "blanco"))}
${task("Task_B3_Pre_Directo_Tinturado", "B3", X.b3b2a, laneY(1, "tinturado"))}
${task("Task_General_Pre_Directo", "GENERAL", X.general, laneY(1))}
${gw("Gateway_Cierre_Final", X.gwGlobal, laneY(1))}
${evt("EndEvent_Postcosecha", X.end, laneY(1))}

      <!-- Lane 3: APERTURA / GV PELADO -->
${task("Task_B1_Apertura", "B1", X.b1, laneY(2))}
${gw("Gateway_Apertura_Rutas", X.rutas, laneY(2))}
${task("Task_B1C_Apertura_GV", "B1C", X.pelado, laneY(2))}
${evt("Event_Max10_Apertura_GV", X.b1ab, laneY(2))}
${evt("Event_Hidratacion_Apertura_GV", X.hidrata, laneY(2))}
${task("Task_B2_Apertura_Max10", "B2", X.b2, laneY(2))}
${gw("Gateway_Apertura_GV_Destinos", X.gwDest, laneY(2))}
${task("Task_PeladoClasificado_Apertura_Max10_Arcoiris",  "PELADO TALLOS Y CLASIFICADO", X.clasif, laneY(2, "arcoiris"), true)}
${task("Task_PeladoClasificado_Apertura_Max10_Blanco",    "PELADO TALLOS Y CLASIFICADO", X.clasif, laneY(2, "blanco"), true)}
${task("Task_PeladoClasificado_Apertura_Max10_Tinturado", "PELADO TALLOS Y CLASIFICADO", X.clasif, laneY(2, "tinturado"), true)}
${task("Task_B2A_Apertura_Max10_Arcoiris",  "B2A", X.b3b2a, laneY(2, "arcoiris"))}
${task("Task_B2A_Apertura_Max10_Blanco",    "B2A", X.b3b2a, laneY(2, "blanco"))}
${task("Task_B2A_Apertura_Max10_Tinturado", "B2A", X.b3b2a, laneY(2, "tinturado"))}
${gw("Gateway_Cierre_Inferior", X.gwCierre, laneY(2))}
${task("Task_General_Apertura_Max10", "GENERAL", X.general, laneY(2))}

      <!-- Lane 4: APERTURA / APERTURA -->
${task("Task_B1C_Apertura_Directo", "B1C", X.pelado, laneY(3))}
${evt("Event_Hidratacion_Apertura_Directo", X.hidrata, laneY(3))}
${task("Task_B2_Apertura_Directo", "B2", X.b2, laneY(3))}
${gw("Gateway_Apertura_Directo_Destinos", X.gwDest, laneY(3))}
${task("Task_PeladoClasificado_Apertura_Directo_Arcoiris",  "PELADO TALLOS Y CLASIFICADO", X.clasif, laneY(3, "arcoiris"), true)}
${task("Task_PeladoClasificado_Apertura_Directo_Blanco",    "PELADO TALLOS Y CLASIFICADO", X.clasif, laneY(3, "blanco"), true)}
${task("Task_PeladoClasificado_Apertura_Directo_Tinturado", "PELADO TALLOS Y CLASIFICADO", X.clasif, laneY(3, "tinturado"), true)}
${task("Task_B2A_Apertura_Directo_Arcoiris",  "B2A", X.b3b2a, laneY(3, "arcoiris"))}
${task("Task_B2A_Apertura_Directo_Blanco",    "B2A", X.b3b2a, laneY(3, "blanco"))}
${task("Task_B2A_Apertura_Directo_Tinturado", "B2A", X.b3b2a, laneY(3, "tinturado"))}
${task("Task_General_Apertura_Directo", "GENERAL", X.general, laneY(3))}

      <!-- Text annotations + associations -->
${annotation("Note_Bifurcacion_Pre", X.max10, LANES[0].top + 30, 200, 50)}
${annotation("Note_Grado_B1AB", X.b1ab, LANES[1].top + LANE_H - 30, 180, 40)}
${annotation("Note_Grado_B1C", X.pelado, LANES[2].top + LANE_H - 30, 180, 40)}
${annotation("Note_B3_NoAplica", X.gwCierre, LANES[1].top + 30, 220, 50)}
${annotation("Note_B2A_NoAplica", X.gwCierre, LANES[3].top + LANE_H - 30, 220, 50)}

      <!-- Edges (all flows) -->
${flow("Flow_Start_Raiz", [[X.start + EVT_W/2, laneY(0)], [X.raiz - GW_W/2, laneY(0)]])}
${flow("Flow_Raiz_Pre", [[X.raiz + GW_W/2, laneY(0)], [X.b1 - TASK_W/2, laneY(0)]])}
${flow("Flow_Raiz_Apertura", [[X.raiz, laneY(0) + GW_H/2], [X.raiz, laneY(2)], [X.b1 - TASK_W/2, laneY(2)]])}

${flow("Flow_Pre_B1_Gateway", [[X.b1 + TASK_W/2, laneY(0)], [X.rutas - GW_W/2, laneY(0)]])}
${flow("Flow_Pre_GV_Max10", [[X.rutas + GW_W/2, laneY(0)], [X.max10 - EVT_W/2, laneY(0)]])}
${flow("Flow_Pre_Directo_Pelado", [[X.rutas, laneY(0) + GW_H/2], [X.rutas, laneY(1)], [X.pelado - TASK_W/2, laneY(1)]])}
${flow("Flow_Pre_Max10_Pelado", [[X.max10 + EVT_W/2, laneY(0)], [X.pelado - TASK_W/2, laneY(0)]])}
${flow("Flow_Pre_GV_Pelado_B1AB", [[X.pelado + TASK_W/2, laneY(0)], [X.b1ab - TASK_W/2, laneY(0)]])}
${flow("Flow_Pre_GV_B1AB_Hidratacion", [[X.b1ab + TASK_W/2, laneY(0)], [X.hidrata - EVT_W/2, laneY(0)]])}
${flow("Flow_Pre_GV_Hidratacion_B2", [[X.hidrata + EVT_W/2, laneY(0)], [X.b2 - TASK_W/2, laneY(0)]])}
${flow("Flow_Pre_GV_B2_Destinos", [[X.b2 + TASK_W/2, laneY(0)], [X.gwDest - GW_W/2, laneY(0)]])}
${flow("Flow_Pre_GV_Arcoiris_Clasificado", [[X.gwDest, laneY(0) - GW_H/2], [X.gwDest, laneY(0, "arcoiris")], [X.clasif - TASK_W/2, laneY(0, "arcoiris")]])}
${flow("Flow_Pre_GV_Blanco_Clasificado", [[X.gwDest + GW_W/2, laneY(0, "blanco")], [X.clasif - TASK_W/2, laneY(0, "blanco")]])}
${flow("Flow_Pre_GV_Tinturado_Clasificado", [[X.gwDest, laneY(0) + GW_H/2], [X.gwDest, laneY(0, "tinturado")], [X.clasif - TASK_W/2, laneY(0, "tinturado")]])}
${flow("Flow_Pre_GV_Clasificado_B3_Arcoiris", [[X.clasif + TASK_W/2, laneY(0, "arcoiris")], [X.b3b2a - TASK_W/2, laneY(0, "arcoiris")]])}
${flow("Flow_Pre_GV_Clasificado_B3_Blanco", [[X.clasif + TASK_W/2, laneY(0, "blanco")], [X.b3b2a - TASK_W/2, laneY(0, "blanco")]])}
${flow("Flow_Pre_GV_Clasificado_B3_Tinturado", [[X.clasif + TASK_W/2, laneY(0, "tinturado")], [X.b3b2a - TASK_W/2, laneY(0, "tinturado")]])}
${flow("Flow_Pre_GV_B3_General_Arcoiris", [[X.b3b2a + TASK_W/2, laneY(0, "arcoiris")], [X.general - TASK_W/2, laneY(0, "arcoiris")], [X.general - TASK_W/2, laneY(0)]])}
${flow("Flow_Pre_GV_B3_General_Blanco", [[X.b3b2a + TASK_W/2, laneY(0, "blanco")], [X.general - TASK_W/2, laneY(0, "blanco")]])}
${flow("Flow_Pre_GV_B3_General_Tinturado", [[X.b3b2a + TASK_W/2, laneY(0, "tinturado")], [X.general - TASK_W/2, laneY(0, "tinturado")], [X.general - TASK_W/2, laneY(0)]])}

${flow("Flow_Pre_Directo_Pelado_B1AB", [[X.pelado + TASK_W/2, laneY(1)], [X.b1ab - TASK_W/2, laneY(1)]])}
${flow("Flow_Pre_Directo_B1AB_Hidratacion", [[X.b1ab + TASK_W/2, laneY(1)], [X.hidrata - EVT_W/2, laneY(1)]])}
${flow("Flow_Pre_Directo_Hidratacion_B2", [[X.hidrata + EVT_W/2, laneY(1)], [X.b2 - TASK_W/2, laneY(1)]])}
${flow("Flow_Pre_Directo_B2_Destinos", [[X.b2 + TASK_W/2, laneY(1)], [X.gwDest - GW_W/2, laneY(1)]])}
${flow("Flow_Pre_Directo_Arcoiris_Clasificado", [[X.gwDest, laneY(1) - GW_H/2], [X.gwDest, laneY(1, "arcoiris")], [X.clasif - TASK_W/2, laneY(1, "arcoiris")]])}
${flow("Flow_Pre_Directo_Blanco_Clasificado", [[X.gwDest + GW_W/2, laneY(1, "blanco")], [X.clasif - TASK_W/2, laneY(1, "blanco")]])}
${flow("Flow_Pre_Directo_Tinturado_Clasificado", [[X.gwDest, laneY(1) + GW_H/2], [X.gwDest, laneY(1, "tinturado")], [X.clasif - TASK_W/2, laneY(1, "tinturado")]])}
${flow("Flow_Pre_Directo_Clasificado_B3_Arcoiris", [[X.clasif + TASK_W/2, laneY(1, "arcoiris")], [X.b3b2a - TASK_W/2, laneY(1, "arcoiris")]])}
${flow("Flow_Pre_Directo_Clasificado_B3_Blanco", [[X.clasif + TASK_W/2, laneY(1, "blanco")], [X.b3b2a - TASK_W/2, laneY(1, "blanco")]])}
${flow("Flow_Pre_Directo_Clasificado_B3_Tinturado", [[X.clasif + TASK_W/2, laneY(1, "tinturado")], [X.b3b2a - TASK_W/2, laneY(1, "tinturado")]])}
${flow("Flow_Pre_Directo_B3_General_Arcoiris", [[X.b3b2a + TASK_W/2, laneY(1, "arcoiris")], [X.general - TASK_W/2, laneY(1, "arcoiris")], [X.general - TASK_W/2, laneY(1)]])}
${flow("Flow_Pre_Directo_B3_General_Blanco", [[X.b3b2a + TASK_W/2, laneY(1, "blanco")], [X.general - TASK_W/2, laneY(1, "blanco")]])}
${flow("Flow_Pre_Directo_B3_General_Tinturado", [[X.b3b2a + TASK_W/2, laneY(1, "tinturado")], [X.general - TASK_W/2, laneY(1, "tinturado")], [X.general - TASK_W/2, laneY(1)]])}

${flow("Flow_Apertura_B1_Gateway", [[X.b1 + TASK_W/2, laneY(2)], [X.rutas - GW_W/2, laneY(2)]])}
${flow("Flow_Apertura_GV_B1C", [[X.rutas + GW_W/2, laneY(2)], [X.pelado - TASK_W/2, laneY(2)]])}
${flow("Flow_Apertura_Directo_B1C", [[X.rutas, laneY(2) + GW_H/2], [X.rutas, laneY(3)], [X.pelado - TASK_W/2, laneY(3)]])}
${flow("Flow_Apertura_GV_B1C_Max10", [[X.pelado + TASK_W/2, laneY(2)], [X.b1ab - EVT_W/2, laneY(2)]])}
${flow("Flow_Apertura_GV_Max10_Hidratacion", [[X.b1ab + EVT_W/2, laneY(2)], [X.hidrata - EVT_W/2, laneY(2)]])}
${flow("Flow_Apertura_GV_Hidratacion_B2", [[X.hidrata + EVT_W/2, laneY(2)], [X.b2 - TASK_W/2, laneY(2)]])}
${flow("Flow_Apertura_GV_B2_Destinos", [[X.b2 + TASK_W/2, laneY(2)], [X.gwDest - GW_W/2, laneY(2)]])}
${flow("Flow_Apertura_GV_Arcoiris_Clasificado", [[X.gwDest, laneY(2) - GW_H/2], [X.gwDest, laneY(2, "arcoiris")], [X.clasif - TASK_W_LONG/2, laneY(2, "arcoiris")]])}
${flow("Flow_Apertura_GV_Blanco_Clasificado", [[X.gwDest + GW_W/2, laneY(2, "blanco")], [X.clasif - TASK_W_LONG/2, laneY(2, "blanco")]])}
${flow("Flow_Apertura_GV_Tinturado_Clasificado", [[X.gwDest, laneY(2) + GW_H/2], [X.gwDest, laneY(2, "tinturado")], [X.clasif - TASK_W_LONG/2, laneY(2, "tinturado")]])}
${flow("Flow_Apertura_GV_Clasificado_B2A_Arcoiris", [[X.clasif + TASK_W_LONG/2, laneY(2, "arcoiris")], [X.b3b2a - TASK_W/2, laneY(2, "arcoiris")]])}
${flow("Flow_Apertura_GV_Clasificado_B2A_Blanco", [[X.clasif + TASK_W_LONG/2, laneY(2, "blanco")], [X.b3b2a - TASK_W/2, laneY(2, "blanco")]])}
${flow("Flow_Apertura_GV_Clasificado_B2A_Tinturado", [[X.clasif + TASK_W_LONG/2, laneY(2, "tinturado")], [X.b3b2a - TASK_W/2, laneY(2, "tinturado")]])}
${flow("Flow_Apertura_GV_B2A_General_Arcoiris", [[X.b3b2a + TASK_W/2, laneY(2, "arcoiris")], [X.general - TASK_W/2, laneY(2, "arcoiris")], [X.general - TASK_W/2, laneY(2)]])}
${flow("Flow_Apertura_GV_B2A_General_Blanco", [[X.b3b2a + TASK_W/2, laneY(2, "blanco")], [X.general - TASK_W/2, laneY(2, "blanco")]])}
${flow("Flow_Apertura_GV_B2A_General_Tinturado", [[X.b3b2a + TASK_W/2, laneY(2, "tinturado")], [X.general - TASK_W/2, laneY(2, "tinturado")], [X.general - TASK_W/2, laneY(2)]])}

${flow("Flow_Apertura_Directo_B1C_Hidratacion", [[X.pelado + TASK_W/2, laneY(3)], [X.hidrata - EVT_W/2, laneY(3)]])}
${flow("Flow_Apertura_Directo_Hidratacion_B2", [[X.hidrata + EVT_W/2, laneY(3)], [X.b2 - TASK_W/2, laneY(3)]])}
${flow("Flow_Apertura_Directo_B2_Destinos", [[X.b2 + TASK_W/2, laneY(3)], [X.gwDest - GW_W/2, laneY(3)]])}
${flow("Flow_Apertura_Directo_Arcoiris_Clasificado", [[X.gwDest, laneY(3) - GW_H/2], [X.gwDest, laneY(3, "arcoiris")], [X.clasif - TASK_W_LONG/2, laneY(3, "arcoiris")]])}
${flow("Flow_Apertura_Directo_Blanco_Clasificado", [[X.gwDest + GW_W/2, laneY(3, "blanco")], [X.clasif - TASK_W_LONG/2, laneY(3, "blanco")]])}
${flow("Flow_Apertura_Directo_Tinturado_Clasificado", [[X.gwDest, laneY(3) + GW_H/2], [X.gwDest, laneY(3, "tinturado")], [X.clasif - TASK_W_LONG/2, laneY(3, "tinturado")]])}
${flow("Flow_Apertura_Directo_Clasificado_B2A_Arcoiris", [[X.clasif + TASK_W_LONG/2, laneY(3, "arcoiris")], [X.b3b2a - TASK_W/2, laneY(3, "arcoiris")]])}
${flow("Flow_Apertura_Directo_Clasificado_B2A_Blanco", [[X.clasif + TASK_W_LONG/2, laneY(3, "blanco")], [X.b3b2a - TASK_W/2, laneY(3, "blanco")]])}
${flow("Flow_Apertura_Directo_Clasificado_B2A_Tinturado", [[X.clasif + TASK_W_LONG/2, laneY(3, "tinturado")], [X.b3b2a - TASK_W/2, laneY(3, "tinturado")]])}
${flow("Flow_Apertura_Directo_B2A_General_Arcoiris", [[X.b3b2a + TASK_W/2, laneY(3, "arcoiris")], [X.general - TASK_W/2, laneY(3, "arcoiris")], [X.general - TASK_W/2, laneY(3)]])}
${flow("Flow_Apertura_Directo_B2A_General_Blanco", [[X.b3b2a + TASK_W/2, laneY(3, "blanco")], [X.general - TASK_W/2, laneY(3, "blanco")]])}
${flow("Flow_Apertura_Directo_B2A_General_Tinturado", [[X.b3b2a + TASK_W/2, laneY(3, "tinturado")], [X.general - TASK_W/2, laneY(3, "tinturado")], [X.general - TASK_W/2, laneY(3)]])}

${flow("Flow_Pre_GV_Cierre", [[X.general + TASK_W/2, laneY(0)], [X.gwCierre - GW_W/2, laneY(0)]])}
${flow("Flow_Pre_Directo_Cierre", [[X.general, laneY(1) - TASK_H/2], [X.general, laneY(0)], [X.gwCierre - GW_W/2, laneY(0)]])}
${flow("Flow_Apertura_GV_Cierre", [[X.general + TASK_W/2, laneY(2)], [X.gwCierre - GW_W/2, laneY(2)]])}
${flow("Flow_Apertura_Directo_Cierre", [[X.general, laneY(3) - TASK_H/2], [X.general, laneY(2)], [X.gwCierre - GW_W/2, laneY(2)]])}
${flow("Flow_Cierre_Superior_Final", [[X.gwCierre + GW_W/2, laneY(0)], [X.gwGlobal, laneY(0)], [X.gwGlobal, laneY(1) - GW_H/2]])}
${flow("Flow_Cierre_Inferior_Final", [[X.gwCierre + GW_W/2, laneY(2)], [X.gwGlobal, laneY(2)], [X.gwGlobal, laneY(1) + GW_H/2]])}
${flow("Flow_Final_End", [[X.gwGlobal + GW_W/2, laneY(1)], [X.end - EVT_W/2, laneY(1)]])}

      <!-- Associations (notes) -->
      <bpmndi:BPMNEdge id="Edge_Assoc_Bifurcacion_Pre" bpmnElement="Assoc_Bifurcacion_Pre">
        <di:waypoint x="${X.max10}" y="${LANES[0].top + 55}" />
        <di:waypoint x="${X.max10}" y="${laneY(0) - EVT_H/2}" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Assoc_Grado_B1AB_Pre" bpmnElement="Assoc_Grado_B1AB_Pre">
        <di:waypoint x="${X.b1ab}" y="${LANES[1].top + LANE_H - 50}" />
        <di:waypoint x="${X.b1ab}" y="${laneY(1) + TASK_H/2}" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Assoc_Grado_B1C" bpmnElement="Assoc_Grado_B1C">
        <di:waypoint x="${X.pelado}" y="${LANES[2].top + LANE_H - 50}" />
        <di:waypoint x="${X.pelado}" y="${laneY(2) + TASK_H/2}" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Assoc_B3_NoAplica" bpmnElement="Assoc_B3_NoAplica">
        <di:waypoint x="${X.gwCierre}" y="${LANES[1].top + 55}" />
        <di:waypoint x="${X.general}" y="${laneY(1) - TASK_H/2}" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Edge_Assoc_B2A_NoAplica" bpmnElement="Assoc_B2A_NoAplica">
        <di:waypoint x="${X.gwCierre}" y="${LANES[3].top + LANE_H - 50}" />
        <di:waypoint x="${X.general}" y="${laneY(3) + TASK_H/2}" />
      </bpmndi:BPMNEdge>

    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>
`;

fs.writeFileSync(OUT, xml, "utf8");
console.log(`OK: ${OUT} (${xml.length} bytes)`);
